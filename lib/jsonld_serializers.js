'use strict'

var R = require('ramda')
var lexicon = require('nypl-registry-utils-lexicon')

var util = require('./util.js')
const logger = require('./logger')
const PACK_DELIM = '||'

// Base class for all serialized types
class JsonLdSerializer {
  constructor (body, options) {
    this.body = body
    this.options = options || {}
  }

  format () {
    var base = {}
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
    super(items, Object.assign({root: true}, opts))
    this.items = this.body
    this.type = 'itemList'
  }

  statements () {
    return Object.assign({}, {
      'itemListElement': this.items.map(this.itemSerializer.bind(this))
    }, (this.options.extraRootProperties || {}))
  }

  itemSerializer (item) {
    var element = {
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
    var stmts = {'@id': this.resultId()}

    // Takes any kind of value (array, object, string) and ensures .id props are formatted as '@id'
    var formatVal = (v) => {
      if (Array.isArray(v)) return v.map(formatVal)
      else if (v && typeof v === 'object') {
        var formatted = v
        // Reassign id to @id
        if (formatted.id) {
          formatted = Object.assign({ '@id': v.id }, formatted)
          delete formatted.id
        }
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
    for (var k in this.body) {
      var prop = k
      var val = this.body[k]
      // If it's a numeric, force it to appear as a single val
      var singleValue = val && val.length === 1 && (typeof val[0]) === 'number'
      // Properties with '_' exist for specialized querying; don't save them to object:
      if (prop.indexOf('_') < 0 && this.body[k]) {
        stmts[prop] = formatVal(singleValue ? val[0] : val)
      }
    }

    return stmts
  }

  _bubbleIdentifiersUpToStatements (identifierTypes, stmts) {
    this.body.identifier.sort().forEach((identifier) => {
      var idParts = identifier.split(':')
      if (idParts.length === 3) {
        var prefix = idParts[1]
        var value = idParts[2]
        if (identifierTypes[prefix]) {
          var apiProp = identifierTypes[prefix]
          if (!stmts[apiProp]) stmts[apiProp] = []
          stmts[apiProp].push(value)
        }
      }
    })
    return stmts
  }
}

// Utility function to pull apart objects serialized as `[value]||[label]`
// Some properties are "packed" in this way to allow us to aggregate on id/label pairs
JsonLdItemSerializer.parsePackedStatement = function (value, base) {
  if ((typeof base !== 'object')) base = {}

  var parse = (str) => {
    var urn = str.split(PACK_DELIM)[0]
    var label = str.split(PACK_DELIM)[1]

    var urnParts = urn.split(':')
    var type = { terms: 'nypl:Term', agents: 'nypl:Agent' }[urnParts[0]]
    var id = urnParts[1]
    id = id.match(/^\d+$/) ? parseInt(id) : id

    return { '@type': type, '@id': urn, prefLabel: label }
  }

  if ((typeof value) === 'object') return value.map(parse)
  else if ((typeof value) === 'string') return parse(value)
}

// Parse all packed properties on given object, returning new object
JsonLdItemSerializer.parsePackedStatements = function (_body) {
  var body = Object.assign({}, _body)
  Object.keys(body).forEach((k) => {
    if (k.match(/\w+_packed$/)) {
      var value = body[k]
      var newField = k.replace(/_packed$/, '')
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
    var element = {
      '@type': 'searchResult',
      'searchResultScore': item.score,
      'result': {
        '@type': [this.resultType],
        '@id': this.resultId(item.record)
      }
    }
    element['result'] = Object.assign(element['result'], item.record)
    if (item.title) element['result']['prefLabel'] = item.title
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
    this.type = R.uniq(R.flatten([item.type].concat('nypl:Resource')))
  }

  statements () {
    var stmts = JsonLdItemSerializer.prototype.statements.call(this)

    if (this.body.identifier) {
      stmts = this._bubbleIdentifiersUpToStatements({ acqnum: 'idAcqnum', barcode: 'idBarcode',
      bnum: 'idBnum', callnum: 'idCallNum', catnyp: 'idCatnyp', dcc: 'idDcc',
      exhibition: 'idExhib', hathi: 'idHathi', isbn: 'idIsbn', issn: 'idIssn',
      lcc: 'idLcc', lccc: 'idLccCoarse', mmsdb: 'idMmmsDb', mss: 'idMss', objnum: 'idObjNum',
      oclc: 'idOclc', rlin: 'idRlin', uuid: 'idUuid' }, stmts)
    }

    if (this.body.parentUri) stmts.memberOf = R.flatten([util.eachValue(this.body.parentUri, (id) => ({ '@type': 'nypl:Resource', '@id': `res:${id}` }))])

    // Parse all contributor_(aut|ill|...) statements:
    Object.keys(this.body).forEach((field) => {
      var match = null
      if ((match = field.match(/^contributor_(\w{3})_packed$/))) {
        var role = match[1]
        stmts[`roles:${role}`] = JsonLdItemSerializer.parsePackedStatement(this.body[field]).map((contributor) => {
          return Object.assign(contributor, { note: lexicon.labels.relators[role] })
        })
      }
    })

    // Override default serialization of bib.supplementaryContent statements (finding aids, TOCs, etc.):
    if (this.body.supplementaryContent) {
      stmts.supplementaryContent = this.body.supplementaryContent.map((link) => {
        return ResourceSerializer.formatElectronicResourceBlankNode(link, 'nypl:SupplementaryContent')
      })
    }

    stmts.suppressed = this.body.suppressed === true

    if (this.body.items) {
      stmts.items = this.body.items
        // Amend items to include source identifier (e.g. urn:SierraNypl:1234, urn:RecapCul:4567)
        .map(ItemResourceSerializer.addSourceIdentifier)
        .map((item) => {
          return (new ItemResourceSerializer(item)).statements()
        })
    }

    return stmts
  }

  static serialize (resp, options) {
    logger.debug('ResourceSerializer#serialize', resp)
    return (new ResourceSerializer(resp, options)).format()
  }
}

ResourceSerializer.formatElectronicResourceBlankNode = function (link, rdfsType) {
  // Get the link label (fall back on prefLabel if serialization moved it there)
  let label = link.label || link.prefLabel
  return {
    // Add rdf:type to this blank node:
    '@type': rdfsType,
    label: label,
    // TODO this is a temporary fix to accomodate supplementaryContent nodes that
    // were indexed with `id` instead of `url`. This ensures it's sent to
    // client in the correct `url` property regardless of where it's stored.
    url: link.id || link.url
  }
}

class ItemResourceSerializer extends JsonLdItemSerializer {
  constructor (item, options) {
    super(item, options)
    this.type = 'bf:Item'
  }

  statements () {
    var stmts = JsonLdItemSerializer.prototype.statements.call(this)

    if (this.body.identifier) {
      stmts = this._bubbleIdentifiersUpToStatements({ barcode: 'idBarcode', callnum: 'idCallNum' }, stmts)

      // Add idNyplSourceId convenience property by parsing identifiers that match urn:[source]:[id]
      this.body.identifier
        .filter((urn) => /^urn:(SierraNypl|RecapCul|RecapPul):.+/.test(urn))
        .forEach((urn) => {
          var type = urn.split(':')[1]
          var value = urn.split(':')[2]
          stmts['idNyplSourceId'] = { '@type': type, '@value': value }
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
  //   urn:Recappul:6789
  static addSourceIdentifier (item) {
    // Ensure identifiers array exists:
    if (!item.identifier) item.identifier = []

    // Partner items will have prefix 'c' or 'p'
    var m = item.uri.match(/^(\w?)i(.*)$/)
    if (m.length === 3) {
      var sourceIdentifier = m[2]
      var sourceIdentifierPrefix = 'SierraNypl'
      if (m[1] === 'c') sourceIdentifierPrefix = 'RecapCul'
      else if (m[1] === 'p') sourceIdentifierPrefix = 'RecapPul'

      item.identifier.push(`urn:${sourceIdentifierPrefix}:${sourceIdentifier}`)
    }
    return item
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
    var results = items.map((i) => ItemResourceSerializer.serialize(i))
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
    var results = resp.hits.hits.map((h) => ({ score: h._score, record: ResourceSerializer.serialize(h._source) }))
    opts = Object.assign({ extraRootProperties: { totalResults: resp.hits.total } }, opts)
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

    var items = Object.keys(resp.aggregations).map((field) => AggregationSerializer.serialize(Object.assign({id: field}, resp.aggregations[field]), options))
    return (new AggregationsSerializer(items, Object.assign({ extraRootProperties: {totalResults: resp.hits.total} }, options))).format()
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
    var stmts = JsonLdItemSerializer.prototype.statements.call(this)

    stmts.field = this.body.id
    var field = this.body.id
    var values = this.body.buckets.map((b) => ({ value: b.key, count: b.doc_count }))
    try {
      stmts.values = values.map((v) => {
        if (this.options.packed_fields && this.options.packed_fields.indexOf(field) >= 0) {
          // Look for label-packed field (only check first value)
          var p = v.value.split(PACK_DELIM)
          v.value = p[0]
          v.label = p[1]
        } else v.label = v.value
        // v.link = `${this.options.baseUrl}/resources?filters[${field}]=${v.value}`
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
    var results = []
    var hits = resp.hits.hits
    hits.forEach(function (h) {
      var serialized = AgentSerializer.serialize(h._source)
      results.push(serialized)
    })
    return (new AgentResultsSerializer(results, {extraRootProperties: {totalResults: resp.hits.total}})).format()
  }
}
/*
 *  Agents
 */

class AgentSerializer extends JsonLdItemSerializer {
  constructor (item, options) {
    super(item, options)

    this.type = ['edm:Agent']
    var foafType = 'foaf:Person'
    if (item.type === 'Meeting') foafType = 'foaf:Group'
    if (item.type === 'Coporation') foafType = 'foaf:Organization'
    if (item.type === 'Organization') foafType = 'foaf:Organization'
    this.type.push(foafType)
  }

  resultId () {
    return `agents:${this.body.uri}`
  }

  statements () {
    var h = JsonLdItemSerializer.parsePackedStatements(this.body)

    var stmts = JsonLdItemSerializer.prototype.statements.call(this)

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
      var bnum = null
      if ((bnum = resp.identifier.filter((i) => i.match(/^urn:bnum:/))) && (bnum = bnum[0]) && (bnum = bnum.split(':')) && (bnum = bnum[bnum.length - 1])) {
        resp.depiction = `https://s3.amazonaws.com/data.nypl.org/bookcovers/${bnum}_ol.jpg`
      }
    }
    return (new AgentSerializer(resp, options)).format()
  }
}

module.exports = { JsonLdSerializer, ResourceSerializer, ItemResultsSerializer, ResourceResultsSerializer, AggregationsSerializer, AgentResultsSerializer, AgentSerializer, AggregationSerializer }
