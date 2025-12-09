const { parseParams } = require('../util')
const { FILTER_CONFIG, SEARCH_SCOPES, AGGREGATIONS_SPEC, SORT_FIELDS } = require('../elasticsearch/config')

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

module.exports = {
  esRangeValue,
  parseSearchParams
}
