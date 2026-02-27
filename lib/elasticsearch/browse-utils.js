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

exports.applySort = function (params, request) {
  // sort is done different for different search scopes due to how we manage variants
  if (params.sort === 'termLabel') {
    // When doing startsWith alphabetical sorting, we might get hits inside the "variants" array.
    // The way ES deals with sorting matches in an array is it looks at the lowest/highest lexicographical
    // entry in the array and uses that- *not* the entry that caused the match. So we use simple painless scripts
    // here which peek into the variants array and uses an actual matching term for the sort.
    const order = params.sort_direction || 'asc'
    const painlessScript = `
      Pattern p = /[^a-zA-Z0-9]+/;
      String sortValue = null;
      String searchValue = params['prefix_value'].toLowerCase().replaceAll(p, match -> '');
      for (Map variant : params._source.getOrDefault('variants', [])) {
          String variantKeyword = variant['variant'].toLowerCase().replaceAll(p, match -> '');
          if (variantKeyword.startsWith(searchValue)) {
              if (sortValue == null || variantKeyword.compareTo(sortValue) ${order === 'asc' ? '>' : '<'} 0) {
                sortValue = variantKeyword;
              }
          }
      }
      String preferredTerm = null;
      if (params._source['preferredTerm'] instanceof List) {
        preferredTerm = params._source['preferredTerm'][0].toLowerCase().replaceAll(p, match -> '');
      } else {
        preferredTerm = params._source['preferredTerm'].toLowerCase().replaceAll(p, match -> '');
      }
      if (sortValue == null || preferredTerm.startsWith(searchValue)) {
          sortValue = preferredTerm;
      }
      return sortValue;
    `

    return [
      {
        _script: {
          type: 'string',
          order,
          script: {
            lang: 'painless',
            source: painlessScript,
            params: {
              prefix_value: request.querySansQuotes().toLowerCase()
            }
          }
        }
      }
    ]
  } else {
    const direction = params.sort_direction || 'desc'
    if (params.sort === 'relevance') {
      return [{ _score: { order: direction } }]
    } else if (params.sort === 'count') {
      return [{ count: { order: direction } }]
    }
  }
  return null
}
