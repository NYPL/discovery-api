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

  resultId (result) {
    return result.uri
  }

  format () {
    var base = {}
    if (this.options.root) base['@context'] = util.contextAll
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
  format () {
    return Object.assign({'@id': this.resultId()}, JsonLdSerializer.prototype.format.call(this))
  }
}

JsonLdItemSerializer.parsePackedStatements = function (_body) {
  var body = Object.assign({}, _body)
  Object.keys(body).forEach((k) => {
    if (k.match(/\w+_packed$/)) {
      var value = body[k]
      var newField = k.replace(/_packed$/, '')
      if (newField === 'parentUris') newField = 'memberOf'

      var parse = (str) => {
        var urn = str.split(PACK_DELIM)[0]
        var id = urn.replace(/^\w+:/, '')
        id = id.match(/^\d+$/) ? parseInt(id) : id
        var label = str.split(PACK_DELIM)[1]
        return { '@id': urn, label: label }
      }

      if ((typeof value) === 'object') body[newField] = value.map(parse)
      else body[newField] = parse(value)

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
    this.type = 'nypl:Resource'
  }

  resultId () {
    return `resources:${this.body.uri}`
  }

  statements () {
    var body = JsonLdItemSerializer.parsePackedStatements(this.body)
    if (body.memberOf) body.memberOf = body.memberOf.map((parent) => Object.assign({ '@type': 'nypl:Resource' }, parent))
    if (body.title) body.prefLabel = body.title
    var newBody = Object.assign({}, body)
    Object.keys(body).forEach((field) => {
      var match = null
      if ((match = field.match(/^contributor_(\w+)$/))) {
        var role = match[1]
        var roleStatement = { '@id': `roles:${role}`, label: lexicon.labels.relators[role] }
        if (!newBody.contributor) newBody.contributor = []
        newBody[field].forEach((contributor) => {
          var ind = -1
          // Contributor already there? (should be)
          if ((typeof body.contributor === 'object') && (typeof body.contributor[0] === 'object') && (ind = R.findIndex(R.propEq('id', contributor.id))(body.contributor)) >= 0) {
            // Ensure has roles property:
            if (!newBody.contributor[ind].roles) newBody.contributor[ind].roles = []
            // Add the role:
            newBody.contributor[ind].roles.push(roleStatement)
          } else {
            // Contributor not in array for some reason; add it with role:
            newBody.contributor.push(Object.assign(contributor, {roles: [roleStatement]}))
          }
        })
        delete newBody[field]
      }
    })
    return Object.assign({}, {'@id': this.resultId()}, newBody)
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
  constructor (item) {
    super(item)

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

    var stmts = {}
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

  static serialize (resp) {
    if (resp.identifier) {
      var bnum = null
      if ((bnum = resp.identifier.filter((i) => i.match(/^urn:bnum:/))) && (bnum = bnum[0]) && (bnum = bnum.split(':')) && (bnum = bnum[bnum.length - 1])) {
        resp.depiction = `https://s3.amazonaws.com/data.nypl.org/bookcovers/${bnum}_ol.jpg`
      }
    }
    return (new AgentSerializer(resp)).format()
  }
}

module.exports = { JsonLdSerializer, ResourceSerializer, ResourceResultsSerializer, AggregationsSerializer, AgentResultsSerializer, AgentSerializer }
