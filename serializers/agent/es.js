'use strict'

var JsonLdItemSerializer = require('../base').JsonLdItemSerializer
var SearchResultsSerializer = require('../base').SearchResultsSerializer

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

module.exports = { AgentResultsSerializer, AgentSerializer }
