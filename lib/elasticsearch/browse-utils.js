const { parseParams } = require('../util')

// Default sort orders for different search scopes
const SEARCH_SCOPE_SORT_ORDER = {
  has: 'count',
  starts_with: 'termLabel'
}

const SEARCH_SCOPES = [
  'has',
  'starts_with'
]

const SORT_FIELDS = [
  'termLabel',
  'count',
  'relevance'
]

exports.parseBrowseParams = function (params) {
  return parseParams(params, {
    q: { type: 'string' },
    page: { type: 'int', default: 1 },
    per_page: { type: 'int', default: 50, range: [0, 100] },
    sort: { type: 'string', range: SORT_FIELDS, default: SEARCH_SCOPE_SORT_ORDER[params.search_scope] || 'termLabel' },
    sort_direction: { type: 'string', range: ['asc', 'desc'] },
    search_scope: { type: 'string', range: SEARCH_SCOPES, default: '' }
  })
}
