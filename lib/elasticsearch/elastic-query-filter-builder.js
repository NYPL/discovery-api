const { esRangeValue } = require('../utils/resource-helpers')

/**
 * Given an object containing filters,
 * returns content of the ES query filter context
 *
 * @param {object} options - An object with keys,value pairs of the form [filter_name]:[filter_value]
 * @returns {object}
 */
const itemsFilterContext = (options) => {
  if (!options.query) return {}

  const filterHandlers = {
    volume: (volumes) => {
      return {
        range: {
          'items.volumeRange': esRangeValue(volumes)
        }
      }
    },
    date: (dates) => {
      return {
        range: {
          'items.dateRange': esRangeValue(dates)
        }
      }
    },
    format: (formats) => {
      return {
        terms: {
          'items.formatLiteral': formats
        }
      }
    },
    location: (locations) => {
      return {
        terms: {
          'items.holdingLocation.id': locations
        }
      }
    },
    status: (statuses) => {
      // Determine if all possible ReCAP statuses were selected:
      const selectedRecapStatuses = recapStatuses(statuses)

      if (selectedRecapStatuses.length === 1 &&
        Array.isArray(options.unavailable_recap_barcodes) &&
        options.unavailable_recap_barcodes.length > 0) {
        // There are known unavailable ReCAP items, so build a complicated
        // filter clause with appropriate barcode overrides:
        return itemStatusFilterWithUnavailableRecapItems(statuses, options.unavailable_recap_barcodes)
      } else {
        // If there are no known unavailable ReCAP items, just do a straight
        // status match:
        return {
          terms: {
            'items.status.id': statuses
          }
        }
      }
    },
    itemUri: (uri) => {
      return { term: { 'items.uri': uri } }
    }
  }

  const filters = Object.keys(options.query).map((filter) => {
    const value = options.query[filter]
    const handler = filterHandlers[filter]
    return value && handler ? handler(value) : null
  }).filter((x) => x)

  return filters.length
    ? { filter: filters }
    : {}
}

/**
 * Given an array of status ids (e.g. "status:a", "status:na") returns the
 * subset of statuses that are relevant in ReCAP
 */
const recapStatuses = (statuses) => {
  return statuses
    .filter((status) => ['status:a', 'status:na'].includes(status))
}

/**
 *  Builds a big complicated ES filter to allow us to filter items by status,
 *  but override the indexed status for ReCAP items with statuses retrieved
 *  from SCSB. This corrects for the fact that ReCAP item statuses tend to be
 *  wrong in the ES index:
 *   - partner items are indexed as Available and remain thus forever
 *   - NYPL item statuses _should_ equal SCSB status, but the mechanism
 *     for keeping them synced isn't perfect and operates on a delay
 *
 *  @param {string[]} statuses - An array of statuses to filter on
 *  @param {string[]} unavailableRecapBarcodes - An array of item barcodes
 *    known to be unavailble
 *
 *  Returns an ES filter that matches the desired statuses, but also uses
 *  the known unavailable items to override indexed item statuses for ReCAP
 *  items (because ReCAP is the authority for status of off-site items).
 *  Essentially, the criteria is for matching an item is:
 *
 *   - if on-site (non-ReCAP):
 *     - has a matching indexed status
 *   - if off-site:
 *     - if filtering on status:na
 *       - item barcode must be in unavailableRecapBarcodes
 *     - if filtering on status:a:
 *       - item barcode must NOT be in unavailableRecapBarcodes
 */
const itemStatusFilterWithUnavailableRecapItems = (statuses, unavailableRecapBarcodes) => {
  // First, let's set up some common clauses:

  // Item is in ReCAP:
  const itemIsRecapClause = {
    regexp: { 'items.holdingLocation.id': 'loc:rc.*' }
  }
  // Item's indexed status matches one of the filtered statuses:
  const itemHasIndexedStatusClause = {
    terms: { 'items.status.id': statuses }
  }
  // Item is marked Unavailable in SCSB:
  const itemIsUnavailableInRecapClause = {
    script: {
      script: {
        inline: 'doc[\'items.idBarcode\'].value == null || ' +
          'params.unavailableRecapBarcodes.contains(doc[\'items.idBarcode\'][0])',
        lang: 'painless',
        params: { unavailableRecapBarcodes }
      }
    }
  }
  // This function is only called if `statuses` param contains a single
  // ReCAP-relevant status (i.e. status:a or status:na), so determine which
  // ReCAP status to use:
  const selectedRecapStatus = recapStatuses(statuses).shift()
  // Item's ReCAP status agrees with filter:
  const itemRecapStatusAgreesWithFilterClause =
    selectedRecapStatus === 'status:na'
      ? itemIsUnavailableInRecapClause
      : { bool: { must_not: itemIsUnavailableInRecapClause } }

  return {
    bool: {
      should: [
        // Either 1) item is on-site and has correctly indexed status:
        {
          bool: {
            must: [
              // Item is on-site (i.e. not recap):
              { bool: { must_not: itemIsRecapClause } },
              // Item indexed status matches filter:
              itemHasIndexedStatusClause
            ]
          }
        },
        // Or 2) item is off-site and has a scsb status that agrees with the
        // filter (e.g. if filtering on status:na, scsb marks the barcode as
        // 'Not Available')
        {
          bool: {
            must: [
              // Item is off-site:
              JSON.parse(JSON.stringify(itemIsRecapClause)),
              // Item is not marked unavailable
              itemRecapStatusAgreesWithFilterClause
            ]
          }
        }
      ]
    }
  }
}

/**
 * Given an object containing query options,
 * returns content of the ES query context
 *
 * @param {object} options - An object with request options. `merge_checkin_card_items` is the only one
 * that matters right now
 * @returns {object}
 */
const itemsQueryContext = (options) => {
  const excludeClauses = []

  if (!options.merge_checkin_card_items) excludeClauses.push({ term: { 'items.type': 'nypl:CheckinCardItem' } })

  return excludeClauses.length ? { must_not: excludeClauses } : { must: { match_all: {} } }
}

const innerHits = (_options = {}) => {
  const options = Object.assign({
    size: process.env.SEARCH_ITEMS_SIZE || 200,
    from: 0,
    merge_checkin_card_items: true
  }, _options)

  // If there is any item query at all, run an additional inner_hits query
  // to retrieve the total number of items without filtering:
  const itemsQuery = {
    bool: Object.assign(
      itemsQueryContext(options),
      itemsFilterContext(options)
    )
  }

  const allItemsQuery = itemsQuery.bool.filter
    ? [{
        nested: {
          path: 'items',
          query: {
            bool: {
              must_not: [{ exists: { field: 'items.electronicLocator' } }]
            }
          },
          inner_hits: { name: 'allItems' }
        }
      }]
    : []

  const wrappedItemsQuery = {
    bool: {
      should: [
        {
          nested: {
            path: 'items',
            query: itemsQuery,
            inner_hits: {
              sort: [{ 'items.enumerationChronology_sort': 'desc' }],
              size: options.size,
              from: options.from,
              name: 'items'
            }
          }
        },
        // Add a catch-all to ensure we return the bib document even when
        // numItems=0 or applied item filters exclude all items:
        { match_all: {} },
        ...allItemsQuery
      ]
    }
  }

  return wrappedItemsQuery
}

module.exports = {
  innerHits,
  itemsQueryContext,
  itemsFilterContext
}
