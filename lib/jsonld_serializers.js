'use strict'

var R = require('ramda')
var lexicon = require('nypl-registry-utils-lexicon')

var util = require('./util.js')

const PACK_DELIM = '||'

class JsonLdSerializer {
  constructor (body, options) {
    this.body = body
    this.options = options || {}
  }

  /*
  resultId (result) {
    var pair = result.uri.split(':')
    switch (pair[0]) {
      case 'resources': return `res:${pair[1]}`
      case 'agents': return `agents:${pair[1]}`
      default: return result.uri
    }
  }
  */

  format () {
    var base = {}
    if (this.options.root) {
      if (this.options.expandContext) base['@context'] = util.buildJsonLdContext({})
      else base['@context'] = util.contextAll
    }
    base['@type'] = this.type
    Object.assign(base, this.statements())
    return base
  }

}

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

class JsonLdItemSerializer extends JsonLdSerializer {
  statements () {
    return {'@id': this.resultId()}
  }
}

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
  else return parse(value)
}

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
      'result': {
        '@type': [this.resultType],
        '@id': this.resultId(item)
      }
    }
    element['result'] = Object.assign(element['result'], item)
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

  resultId () {
    return `res:${this.body.uri}`
  }

  statements () {
    var stmts = JsonLdItemSerializer.prototype.statements.call(this)

    if (this.body.contributor_packed) stmts.contributor = JsonLdItemSerializer.parsePackedStatement(this.body.contributor_packed)
    if (this.body.createdYear) stmts.createdYear = this.body.createdYear
    if (this.body.createdString) stmts.created = this.body.createdString
    if (this.body.description) stmts.description = this.body.description
    if (this.body.dateEndYear) stmts.endYear = this.body.dateEndYear
    if (this.body.holdings) stmts.holdingCount = this.body.holdings
    if (this.body.identifier) {
      var identifierTypes = { acqnum: 'idAcqnum', barcode: 'idBarcode', bnum: 'idBnum', callnum: 'idCallNum', catnyp: 'idCatnyp', dcc: 'idDcc', exhibition: 'idExhib', hathi: 'idHathi', isbn: 'idIsbn', issn: 'idIssn', lcc: 'idLcc', lccc: 'idLccCoarse', mmsdb: 'idMmmsDb', mss: 'idMss', objnum: 'idObjNum', oclc: 'idOclc', owi: 'idOwi', rlin: 'idRlin', uuid: 'idUuid' }
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
    if (this.body.language) stmts.language = this.body.language.map((id) => ({ '@id': id, prefLabel: lexicon.labels.languages[id] }))
    if (this.body.note) stmts.note = this.body.note
    if (this.body.owner) stmts.owner = { '@id': this.body.owner[0], prefLabel: lexicon.labels.orgs[this.body.owner[0]] }
    if (this.body.parentUri) stmts.memberOf = R.flatten([util.eachValue(this.body.parentUri, (id) => ({ '@type': 'nypl:Resource', '@id': `res:${id}` }))])
    if (this.body.title) stmts.prefLabel = stmts.title = this.body.title

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

    if (this.body.dateStartYear) stmts.startYear = this.body.dateStartYear
    if (this.body.subject_packed) stmts.subject = JsonLdItemSerializer.parsePackedStatement(this.body.subject_packed)
    stmts.suppressed = this.body.suppressed === true
    if (this.body.materialType) stmts.type = this.body.materialType.map((id) => ({ '@id': id, prefLabel: lexicon.labels.resourcetypes[id] }))

    return stmts
  }

  static serialize (resp, options) {
    if (resp.identifier) {
      var bnum = null
      if ((bnum = resp.identifier.filter((i) => i.match(/^urn:bnum:/))) && (bnum = bnum[0]) && (bnum = bnum.split(':')) && (bnum = bnum[bnum.length - 1])) {
        resp.depiction = `https://s3.amazonaws.com/data.nypl.org/bookcovers/${bnum}_ol.jpg`
      }
    }
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
    var results = resp.hits.hits.map((h) => ResourceSerializer.serialize(h._source))
    // console.log('serializing results: ', results)
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

    var items = []
    Object.keys(resp.aggregations).forEach(function (field) {
      var values = resp.aggregations[field].buckets.map((b) => ({ value: b.key, count: b.doc_count }))
      values = values.map(function (v) {
        if (field === 'owner') v.label = lexicon.labels.orgs[v.value]
        else if (field === 'resourceType') v.label = lexicon.labels.resourcetypes[v.value]
        else if (field === 'language') v.label = lexicon.labels.languages[v.value]
        else if (options.packed_fields && options.packed_fields.indexOf(field) >= 0) {
          // Look for label-packed field (only check first value)
          var p = v.value.split(PACK_DELIM)
          v.value = p[0]
          v.label = p[1]
        }
        return v
      })
      items.push({field: field, values: values})
    })
    return (new AggregationsSerializer(items, {totalResults: resp.hits.total})).format()
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

module.exports = { JsonLdSerializer, ResourceSerializer, ResourceResultsSerializer, AggregationsSerializer, AgentResultsSerializer, AgentSerializer }
