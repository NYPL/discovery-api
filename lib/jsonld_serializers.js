'use strict'

var R = require('ramda')
var lexicon = require('nypl-registry-utils-lexicon')

var util = require('./util.js')
const config = require('config')
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
      else base['@context'] = `${config.proto}://${config.host}${config.port && config.port !== 80 ? `:${config.port}` : ''}/api/v1/context_all.jsonld` // .protoutil.contextAll
    }
    base['@type'] = this.type
    Object.assign(base, this.statements())
    return base
  }

}

// Base class for all list-like serialized types
class JsonLdListSerializer extends JsonLdSerializer {
  constructor (items, extra) {
    super(items, {root: true})
    this.items = this.body
    this.extra = extra
    this.type = 'itemList'
  }

  statements () {
    return Object.assign({}, {
      'itemListElement': this.items.map(this.itemSerializer.bind(this))
    }, this.extra)
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
  constructor (items, extra) {
    super(items, extra)
    this.resultType = 'nypl:Resource'
  }

  itemSerializer (item) {
    var element = {
      '@type': 'searchResult',
      'score': item.score,
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
      var identifierTypes = { acqnum: 'idAcqnum', barcode: 'idBarcode', bnum: 'idBnum', callnum: 'idCallNum', catnyp: 'idCatnyp', dcc: 'idDcc', exhibition: 'idExhib', hathi: 'idHathi', isbn: 'idIsbn', issn: 'idIssn', lcc: 'idLcc', lccc: 'idLccCoarse', mmsdb: 'idMmmsDb', mss: 'idMss', objnum: 'idObjNum', oclc: 'idOclc', rlin: 'idRlin', uuid: 'idUuid' }
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

    stmts.suppressed = this.body.suppressed === true

    if (this.body.items) {
      stmts.items = this.body.items.map((item) => {
        return (new JsonLdItemSerializer(item)).statements()
      })
    }

    return stmts
  }

  static serialize (resp, options) {
    logger.debug('ResourceSerializer#serialize', resp)
    return (new ResourceSerializer(resp, options)).format()
  }
}

/*
 *  Search Results: Resources
 */

class ResourceResultsSerializer extends SearchResultsSerializer {
  constructor (items, extra) {
    super(items, extra)
    this.resultType = 'nypl:Resource'
  }

  resultId (result) {
    return `resources:${result.uri}`
  }

  static serialize (resp) {
    var results = resp.hits.hits.map((h) => ({ score: h._score, record: ResourceSerializer.serialize(h._source) }))
    return (new ResourceResultsSerializer(results, {totalResults: resp.hits.total})).format()
  }
}

/*
 *  Search Aggregations
 */

class AggregationsSerializer extends JsonLdListSerializer {
  constructor (aggs, extra) {
    super(aggs, extra)
    this.itemType = 'nypl:Aggregation'
  }

  resultId (result) {
    return `field:${result.field}`
  }

  static serialize (resp, options) {
    if ((typeof options) === 'undefined') options = {}

    var items = Object.keys(resp.aggregations).map((field) => AggregationSerializer.serialize(Object.assign({id: field}, resp.aggregations[field]), options))
    return (new AggregationsSerializer(items, {totalResults: resp.hits.total})).format()
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
  constructor (items, extra) {
    super(items, extra)
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
    return (new AgentResultsSerializer(results, {totalResults: resp.hits.total})).format()
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

module.exports = { JsonLdSerializer, ResourceSerializer, ResourceResultsSerializer, AggregationsSerializer, AgentResultsSerializer, AgentSerializer, AggregationSerializer }
