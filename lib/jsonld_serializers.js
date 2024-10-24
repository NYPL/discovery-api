'use strict'

const locations = require('@nypl/nypl-core-objects')('by-sierra-location')
const NyplSourceMapper = require('discovery-store-models/lib/nypl-source-mapper')

const util = require('./util.js')
const logger = require('./logger')
const PACK_DELIM = '||'

// Base class for all serialized types
class JsonLdSerializer {
  constructor (body, options) {
    this.body = body
    this.options = options || {}
  }

  format () {
    const base = {}
    if (this.options.root) {
      // If expandContext, dump full context doc into result, otherwise just give URL
      if (this.options.expandContext) base['@context'] = util.buildJsonLdContext({})
      else base['@context'] = `${this.options.baseUrl}/context_all.jsonld`
    }
    base['@type'] = this.type
    Object.assign(base, this.statements())
    return base
  }
}

/*
 * Base class for all list-like serialized types
 *
 * Usage:
 *   new JsonLdListSerializer(LIST, OPTS)
 *
 *   where LIST is an array of items serialized using this.itemSerializer (typically overridden by extending class)
 *   and OPTS is a hash with:
 *    * baseUrl: API base url
 *    * extraRootProperties: Hash of extra properties to place in the root of the doc (e.g. totalResults, pagination, etc.)
 */
class JsonLdListSerializer extends JsonLdSerializer {
  constructor (items, opts) {
    super(items, Object.assign({ root: true }, opts))
    this.items = this.body
    this.type = 'itemList'
  }

  statements () {
    return Object.assign({}, {
      itemListElement: this.items.map(this.itemSerializer.bind(this))
    }, (this.options.extraRootProperties || {}))
  }

  itemSerializer (item) {
    const element = {
      '@type': this.itemType,
      '@id': this.resultId(item)
    }
    Object.assign(element, item)
    return element
  }
}

// Base class for all item-like serialized types
class JsonLdItemSerializer extends JsonLdSerializer {
  resultId () {
    return `res:${this.body.uri}`
  }

  statements () {
    const stmts = { '@id': this.resultId() }

    // Takes any kind of value (array, object, string) and ensures .id props are formatted as '@id'
    const formatVal = (v) => {
      if (Array.isArray(v)) return v.map(formatVal)
      else if (v && typeof v === 'object') {
        const formatted = v
          // Reassign id to @id, type to @type, value to @value
          ;['id', 'type', 'value'].forEach((specialProp) => {
          if (formatted[specialProp]) {
            formatted[`@${specialProp}`] = formatted[specialProp]
            delete formatted[specialProp]
          }
        })
        // TODO need to correct this in the indexer, not here
        if (formatted.label) {
          formatted.prefLabel = formatted.label
          delete formatted.label
        }
        return formatted
      } else return v
    }

    // Serialize all of the fields in this.body
    // (except for _packed fields)
    Object.keys(this.body).sort().forEach((indexedProperty) => {
      let jsonLdKey = indexedProperty
      // By convention, any property that ends 'V[num]' should have the suffix removed
      // e.g. noteV2 becomes note
      jsonLdKey = indexedProperty.replace(/V\d+$/, '')
      const val = this.body[indexedProperty]
      // If it's a numeric, force it to appear as a single val
      const singleValue = val && val.length === 1 && (typeof val[0]) === 'number'
      // Properties with '_' exist for specialized querying; don't save them to object:
      if (indexedProperty.indexOf('_') < 0 && (this.body[indexedProperty] || typeof this.body[indexedProperty] === 'boolean')) {
        stmts[jsonLdKey] = formatVal(singleValue ? val[0] : val)
      }
    })

    // If updatedAt (int) found, add updatedAtDate (Date string)
    if (stmts.updatedAt && /^\d+$/.test(stmts.updatedAt)) {
      stmts.updatedAtDate = (new Date(stmts.updatedAt)).toISOString()
    }

    return stmts
  }

  /**
   *  Given an identifier value, which may be a plainobject (entity) or a
   *  string (urn: style), returns the identifier formatted urn: style
   *
   *  @example
   *  // The following returns "urn:barcode:1234"
   *  _ensureIdentifierIsUrnStyle({ '@type': 'bf:Barcode', value: '1234' })
   *
   *  @example
   *  // The following is a noop, also returns "urn:barcode:1234"
   *  _ensureIdentifierIsUrnStyle('urn:barcode:1234')
   */
  _ensureIdentifierIsUrnStyle (value) {
    if ((typeof value) === 'object' && value['@type']) {
      const matchingPrefixTypeEntry = util.objectEntries({
        barcode: 'bf:Barcode',
        bnum: 'nypl:Bnumber',
        callnumber: 'bf:ShelfMark',
        isbn: 'bf:Isbn',
        issn: 'bf:Issn',
        lccn: 'bf:Lccn',
        oclc: 'nypl:Oclc'
      })
        .filter((pair) => pair[1] === value['@type'])
        .pop()
      const prefix = Array.isArray(matchingPrefixTypeEntry) ? matchingPrefixTypeEntry[0] : value['@type']
      value = `urn:${prefix}:${value.value}`
    }
    return value
  }
}

// Utility function to pull apart objects serialized as `[value]||[label]`
// Some properties are "packed" in this way to allow us to aggregate on id/label pairs
JsonLdItemSerializer.parsePackedStatement = function (value, base) {
  if ((typeof base !== 'object')) base = {}

  const parse = (str) => {
    const urn = str.split(PACK_DELIM)[0]
    const label = str.split(PACK_DELIM)[1]

    const urnParts = urn.split(':')
    const type = { terms: 'nypl:Term', agents: 'nypl:Agent' }[urnParts[0]]

    return { '@type': type, '@id': urn, prefLabel: label }
  }

  if ((typeof value) === 'object') return value.map(parse)
  else if ((typeof value) === 'string') return parse(value)
}

// Parse all packed properties on given object, returning new object
JsonLdItemSerializer.parsePackedStatements = function (_body) {
  const body = Object.assign({}, _body)
  Object.keys(body).forEach((k) => {
    if (k.match(/\w+_packed$/)) {
      const value = body[k]
      const newField = k.replace(/_packed$/, '')
      body[newField] = JsonLdItemSerializer.parsePackedStatement(value)

      delete body[k]
    }
  })
  return body
}

/*
 *  Search Results
 */

class SearchResultsSerializer extends JsonLdListSerializer {
  constructor (items, opts) {
    super(items, opts)
    this.resultType = 'nypl:Resource'
  }

  itemSerializer (item) {
    const element = {
      '@type': 'searchResult',
      searchResultScore: item.score,
      result: {
        '@type': [this.resultType],
        '@id': this.resultId(item.record)
      }
    }
    element.result = Object.assign(element.result, item.record)

    // If using named queries, pass them through:
    if (item.matched_queries) element.matchedQueries = item.matched_queries

    if (item.title) element.result.prefLabel = item.title
    return element
  }
}

/*
 *  Resource
 */

class ResourceSerializer extends JsonLdItemSerializer {
  constructor (item, options) {
    super(item, options)
    // Serialize both the most general type (Resource) as well as any resource-specific type (Collection, Component, Capture, etc)
    this.type = [...new Set([item.type].concat('nypl:Resource').flat())]
  }

  statements () {
    const stmts = JsonLdItemSerializer.prototype.statements.call(this)

    if (this.body.parentUri) stmts.memberOf = [util.eachValue(this.body.parentUri, (id) => ({ '@type': 'nypl:Resource', '@id': `res:${id}` }))].flat()

    // Override default serialization of bib.supplementaryContent statements (finding aids, TOCs, etc.):
    if (this.body.supplementaryContent) {
      stmts.supplementaryContent = this.body.supplementaryContent.map((link) => {
        return ResourceSerializer.formatElectronicResourceBlankNode(link, 'nypl:SupplementaryContent')
      })
    }

    if (this.body.items) {
      stmts.items = this.body.items
        // Amend items to include source identifier (e.g. urn:SierraNypl:1234, urn:RecapCul:4567)
        .map(ItemResourceSerializer.addSourceIdentifier)
        .map((item) => {
          return (new ItemResourceSerializer(item)).statements()
        })
    }

    if (this.body.itemAggregations) {
      stmts.itemAggregations = ResourceSerializer.formatItemFilterAggregations(this.body.itemAggregations)
    }

    // Add hasItemVolumes and hasItemDates bool properties to indicate whether
    // or not one can do meaningful date/volume filters on this bib
    stmts.hasItemVolumes = false
    stmts.hasItemDates = false
    // Check both numItemsTotal (the property written by RCI) and numItems
    // (written by legacy indexing process). Note that very old bibs may have
    // neither
    const numItems = (this.body.numItemsTotal && this.body.numItemsTotal[0]) ||
      (this.body.numItems && this.body.numItems[0])
    if (numItems) {
      if (Array.isArray(this.body.numItemVolumesParsed)) {
        stmts.hasItemVolumes = this.body.numItemVolumesParsed[0] / numItems >= parseFloat(process.env.BIB_HAS_VOLUMES_THRESHOLD)
      }
      if (Array.isArray(this.body.numItemDatesParsed)) {
        stmts.hasItemDates = this.body.numItemDatesParsed[0] / numItems >= parseFloat(process.env.BIB_HAS_DATES_THRESHOLD)
      }
    }

    // DFE depends on this being set to an empty array when null:
    stmts.electronicResources = stmts.electronicResources || []

    return stmts
  }

  static serialize (resp, options) {
    return (new ResourceSerializer(resp, options)).format()
  }
}

ResourceSerializer.formatElectronicResourceBlankNode = function (link, rdfsType) {
  // Get the link label (fall back on prefLabel if serialization moved it there)
  const label = link.label || link.prefLabel
  return {
    // Add rdf:type to this blank node:
    '@type': rdfsType,
    label,
    // TODO this is a temporary fix to accomodate supplementaryContent nodes that
    // were indexed with `id` instead of `url`. This ensures it's sent to
    // client in the correct `url` property regardless of where it's stored.
    url: link.id || link.url
  }
}

ResourceSerializer.formatItemFilterAggregations = function (aggregations) {
  return Object.keys(aggregations).map((aggregation) => {
    const field = aggregation.replace(/^item_/, '')
    const values = aggregations[aggregation]._nested.buckets.map((bucket) => {
      let value = bucket.key
      let label = value
      // If it's a packed value, parse out the value and label:
      if (value.split('||').length === 2) {
        ;[value, label] = value.split('||')
      }
      return {
        value,
        count: bucket.doc_count,
        label
      }
    }).filter((value) => Object.keys(value).length)
    return {
      '@type': 'nypl:Aggregation',
      '@id': 'res:' + field,
      id: field,
      field,
      values
    }
  })
}

class ItemResourceSerializer extends JsonLdItemSerializer {
  constructor (item, options) {
    super(item, options)
    this.type = 'bf:Item'
  }

  statements () {
    const stmts = JsonLdItemSerializer.prototype.statements.call(this)

    if (stmts.identifier) {
      // Add idNyplSourceId convenience property by parsing identifiers that match urn:[source]:[id]
      this.body.identifier
        .filter((urn) => /^urn:(SierraNypl|Recap.+):.+/.test(urn))
        .forEach((urn) => {
          const type = urn.split(':')[1]
          const value = urn.split(':')[2]
          stmts.idNyplSourceId = { '@type': type, '@value': value }
        })
    }

    // Override default serialization of item.electronicLocator statements (full digital surrogates):
    if (this.body.electronicLocator) {
      stmts.electronicLocator = this.body.electronicLocator.map((link) => ResourceSerializer.formatElectronicResourceBlankNode(link, 'nypl:ElectronicLocation'))
    }
    return stmts
  }

  static serialize (resp, options) {
    logger.debug('ItemResourceSerializer#serialize', resp)
    return (new ItemResourceSerializer(resp, options)).format()
  }

  // Given an item, returns item with an added `identifier`
  // of form 'urn:[sourceIdentifierPrefix]:[sourceIdentifier]'
  // e.g.
  //   urn:SierraNypl:1234
  //   urn:RecapCul:4567
  //   urn:RecapPul:6789
  //   urn:RecapHl:87654321
  static addSourceIdentifier (item) {
    // Ensure identifiers array exists:
    item.identifier = item.identifier || []

    const { id, nyplSource, type } = NyplSourceMapper.instance().splitIdentifier(item.uri)
    if (type === 'item') {
      // Build prefix nyplSource as camel case
      const sourceIdentifierPrefix = ItemResourceSerializer.sourceIdentifierPrefixByNyplSource(nyplSource)
      item.identifier.push(`urn:${sourceIdentifierPrefix}:${id}`)
    }

    return item
  }

  static sourceIdentifierPrefixByNyplSource (nyplSource) {
    return nyplSource
      .split('-')
      .map((term) => term.replace(/^\w/, (c) => c.toUpperCase()))
      .join('')
  }
}

/*
 *  Item Results
 */

class ItemResultsSerializer extends JsonLdListSerializer {
  constructor (items, opts) {
    super(items, opts)
    this.resultType = 'nypl:Resource'
  }

  resultId (result) {
    return `resources:${result.uri}`
  }

  static serialize (items, opts) {
    const results = items.map((i) => ItemResourceSerializer.serialize(i))
    return (new ItemResultsSerializer(results, opts)).format()
  }
}

/*
 *  Search Results: Resources
 */

class ResourceResultsSerializer extends SearchResultsSerializer {
  constructor (items, opts) {
    super(items, opts)
    this.resultType = 'nypl:Resource'
  }

  resultId (result) {
    return `resources:${result.uri}`
  }

  static serialize (resp, opts) {
    const results = resp.hits.hits.map((h) => ({ score: h._score, record: ResourceSerializer.serialize(h._source), matched_queries: h.matched_queries }))
    const totalResults = typeof resp.hits.total?.value === 'number' ? resp.hits.total.value : resp.hits.total
    opts = Object.assign({ extraRootProperties: { totalResults } }, opts)
    return (new ResourceResultsSerializer(results, opts)).format()
  }
}

/*
 *  Search Aggregations
 */

class AggregationsSerializer extends JsonLdListSerializer {
  constructor (aggs, opts) {
    super(aggs, opts)
    this.itemType = 'nypl:Aggregation'
  }

  resultId (result) {
    return `field:${result.field}`
  }

  static serialize (resp, options) {
    if ((typeof options) === 'undefined') options = {}

    const items = Object.keys(resp.aggregations).map((field) => AggregationSerializer.serialize(Object.assign({ id: field }, resp.aggregations[field]), options))
    return (new AggregationsSerializer(items, Object.assign({ extraRootProperties: { totalResults: resp.hits.total } }, options))).format()
  }
}

class AggregationSerializer extends JsonLdItemSerializer {
  constructor (item, options) {
    super(item, options)
    // Serialize both the most general type (Resource) as well as any resource-specific type (Collection, Component, Capture, etc)
    this.type = 'nypl:Aggregation'
  }

  resultId () {
    return `res:${this.body.id}`
  }

  statements () {
    const stmts = JsonLdItemSerializer.prototype.statements.call(this)

    stmts.field = this.body.id
    const field = this.body.id
    const values = this.body.buckets.map((b) => ({ value: b.key, count: b.doc_count }))
    try {
      stmts.values = values.map((v) => {
        if (this.options.packed_fields && this.options.packed_fields.indexOf(field) >= 0) {
          // Look for label-packed field (only check first value)
          const p = v.value.split(PACK_DELIM)
          v.value = p[0]
          v.label = p[1]
        } else if (field === 'buildingLocation') {
          // Build buildingLocation agg labels from nypl-core:
          v.label = locations[v.value]?.label
        } else {
          v.label = v.value
        }

        return v
      })
    } catch (e) { console.error(e) }

    // Now that we've formatted buckets (into `values` prop), delete `buckets`
    delete stmts.buckets

    return stmts
  }

  static serialize (agg, options) {
    return (new AggregationSerializer(agg, options)).format()
  }
}

/*
 *  Search Results: Agents
 */

class AgentResultsSerializer extends SearchResultsSerializer {
  constructor (items, opts) {
    super(items, opts)
    this.resultType = 'nypl:Person'
  }

  resultId (result) {
    return `agents:${result.uri}`
  }

  static serialize (resp) {
    const results = []
    const hits = resp.hits.hits
    hits.forEach(function (h) {
      const serialized = AgentSerializer.serialize(h._source)
      results.push(serialized)
    })
    return (new AgentResultsSerializer(results, { extraRootProperties: { totalResults: resp.hits.total } })).format()
  }
}
/*
 *  Agents
 */

class AgentSerializer extends JsonLdItemSerializer {
  constructor (item, options) {
    super(item, options)

    this.type = ['edm:Agent']
    let foafType = 'foaf:Person'
    if (item.type === 'Meeting') foafType = 'foaf:Group'
    if (item.type === 'Coporation') foafType = 'foaf:Organization'
    if (item.type === 'Organization') foafType = 'foaf:Organization'
    this.type.push(foafType)
  }

  resultId () {
    return `agents:${this.body.uri}`
  }

  statements () {
    const h = JsonLdItemSerializer.parsePackedStatements(this.body)

    const stmts = JsonLdItemSerializer.prototype.statements.call(this)

    if (h.label) stmts.prefLabel = h.label

    if (h.dobString) stmts.birthDate = h.dobString
    if (h.dobYear) stmts.birthYear = h.dobYear
    if (h.dobDecade) stmts.birthDecade = h.dobDecade
    if (h.dodString) stmts.deathDate = h.dodString
    if (h.dodYear) stmts.deathYear = h.dodYear
    if (h.dodDecade) stmts.deathDecade = h.dodDecade

    stmts.topFiveTermsString = h.topFiveTerms
    stmts.topFiveRolesString = h.topFiveRoles

    if (h.description) stmts.description = h.description
    if (h.viaf) stmts.uriViaf = 'viaf:' + h.viaf
    if (h.wikidata) stmts.uriWikidata = 'wikidata:' + h.wikidata
    if (h.lc) stmts.uriLc = 'lc:' + h.lc
    if (h.dbpedia) stmts.uriDbpedia = 'dbpedia:' + h.dbpedia
    if (h.depiction) stmts.depiction = h.depiction
    if (h.wikipedia) stmts.wikipedia = 'https://wikipedia.org/wiki/' + h.wikipedia
    if (h.label) stmts.prefLabel = h.label
    if (h.useCount) stmts.useCount = h.useCount
    if (h.score) stmts.searchResultScore = h.score

    return stmts
  }

  static serialize (resp, options) {
    if (resp.identifier) {
      let bnum = null
      if ((bnum = resp.identifier.filter((i) => i.match(/^urn:bnum:/))) && (bnum = bnum[0]) && (bnum = bnum.split(':')) && (bnum = bnum[bnum.length - 1])) {
        resp.depiction = `https://s3.amazonaws.com/data.nypl.org/bookcovers/${bnum}_ol.jpg`
      }
    }
    return (new AgentSerializer(resp, options)).format()
  }
}

module.exports = { JsonLdSerializer, ResourceSerializer, ItemResourceSerializer, ItemResultsSerializer, ResourceResultsSerializer, AggregationsSerializer, AgentResultsSerializer, AgentSerializer, AggregationSerializer }
