const { parseParams } = require('../util')
const { FILTER_CONFIG, SEARCH_SCOPES, AGGREGATIONS_SPEC, SORT_FIELDS } = require('../elasticsearch/config')
const NyplSourceMapper = require('research-catalog-indexer/lib/utils/nypl-source-mapper')
const errors = require('../errors')
const LocationLabelUpdater = require('../location_label_updater')
const AvailableDeliveryLocationTypes = require('../available_delivery_location_types')

/**
 * Given a range represented as an array, returns a corresponding ES range object
 *
 * @param {Array.<string>} range - An array consisting of a single date or a pair of dates
 * @returns {object}
 */
const esRangeValue = (range) => {
  // the greater-than-equal value will always be the first value in the range array.
  // depending on the number of values and their equality, we query using less-than-equal
  // the second value, or just less-than the first value plus one

  // Treat case where range start equals range end same as case of single value:
  if (range[0] === range[1]) range = range.slice(0, 1)
  const rangeQuery = {
    gte: range[0]
  }
  if (range.length === 2) {
    // search on both range values
    rangeQuery.lte = range[range.length - 1]
  } else if (range.length === 1) {
    // if there is just one range, query up until the next year
    rangeQuery.lt = range[0] + 1
  }
  return rangeQuery
}

// Configure controller-wide parameter parsing:
const parseSearchParams = function (params, overrideParams = {}) {
  return parseParams(params, {
    q: { type: 'string' },
    page: { type: 'int', default: 1 },
    per_page: { type: 'int', default: 50, range: [0, 100] },
    field: { type: 'string', range: Object.keys(AGGREGATIONS_SPEC) },
    sort: { type: 'string', range: Object.keys(SORT_FIELDS), default: 'relevance' },
    sort_direction: { type: 'string', range: ['asc', 'desc'] },
    search_scope: { type: 'string', range: Object.keys(SEARCH_SCOPES), default: 'all' },
    filters: { type: 'hash', fields: FILTER_CONFIG },
    items_size: { type: 'int', default: 100, range: [0, 200] },
    items_from: { type: 'int', default: 0 },
    callnumber: { type: 'string' },
    standard_number: { type: 'string' },
    contributor: { type: 'string' },
    title: { type: 'string' },
    subject: { type: 'string' },
    subject_prefix: { type: 'string' },
    isbn: { type: 'string' },
    issn: { type: 'string' },
    lccn: { type: 'string' },
    oclc: { type: 'string' },
    merge_checkin_card_items: { type: 'boolean', default: true },
    include_item_aggregations: { type: 'boolean', default: true },
    ...overrideParams
  })
}

const nyplSourceAndId = async function (params) {
  const nyplSourceMapper = await NyplSourceMapper.instance()
  const { id, nyplSource } = nyplSourceMapper.splitIdentifier(params.uri) ?? {}
  if (!id || !nyplSource) {
    throw new errors.InvalidParameterError(`Invalid bnum: ${params.uri}`)
  }
  return { id, nyplSource }
}

function itemsByFilter (identifierValues, app) {
  const filter = { terms: { 'items.identifier': identifierValues } }
  let opts = { _source: ['uri', 'type', 'items.uri', 'items.type', 'items.identifier', 'items.holdingLocation', 'items.status', 'items.catalogItemType', 'items.accessMessage', 'items.m2CustomerCode'] }

  opts = Object.assign({
    _source: null
  }, opts)

  // Build ES query body:
  const body = {
    query: {
      nested: {
        path: 'items',
        score_mode: 'avg',
        query: {
          constant_score: {
            filter
          }
        }
      }
    }
  }
  if (opts._source) body._source = opts._source

  app.logger.debug('Resources#itemsByFilter', body)
  return app.esClient.search(body)
    .then((resp) => {
      if (!resp || !resp.hits || resp.hits.total === 0) return Promise.reject(new Error('No matching items'))
      resp = new LocationLabelUpdater(resp).responseWithUpdatedLabels()
      // Convert this ES bibs response into an array of flattened items:
      return resp.hits.hits
        .map((doc) => doc._source)
        // Reduce to a flat array of items
        .reduce((a, bib) => {
          return a.concat(bib.items)
            // Let's affix that bnum into the item's identifiers so we know where it came from:
            .map((i) => {
              return Object.assign(i, { identifier: [`urn:bnum:${bib.uri}`].concat(i.identifier) })
            })
        }, [])
    }).then((items) => {
      return items.filter((item) => {
        return item.identifier.filter((i) => identifierValues.indexOf(i) >= 0).length > 0
      })
    })
}

/**
* Given an array of ES aggregations responses (such as that returned from msearch)
**/
const mergeAggregationsResponses = (responses) => {
  // Filter out errored responses:
  responses = responses.filter((resp) => resp.aggregations)
  if (responses.length === 0) {
    return {}
  }
  return {
    // Use `hits` of last element, somewhat arbitrarily:
    hits: responses[responses.length - 1].hits,
    aggregations: responses
      .reduce((allAggs, resp) => {
        const respAggs = Object.entries(resp.aggregations)
          // Build hash of response aggs, squashing _nested aggs:
          .reduce((a, [field, _a]) => {
            // If it's nested, it will be in our special '_nested' prop:
            a[field] = _a._nested || _a
            return a
          }, {})
        // Add response aggs to combined aggs:
        return Object.assign(allAggs, respAggs)
      }, {})
  }
}

// Create promise to resolve deliveryLocationTypes by patron type:
const lookupPatronType = async function (params) {
  try {
    await AvailableDeliveryLocationTypes.getScholarRoomByPatronId(params.patronId)
  } catch (e) {
    throw new errors.InvalidParameterError('Invalid patronId')
  }
}

module.exports = {
  esRangeValue,
  parseSearchParams,
  nyplSourceAndId,
  itemsByFilter,
  mergeAggregationsResponses,
  lookupPatronType
}
