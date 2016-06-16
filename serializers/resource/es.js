'use strict'

var R = require('ramda')
var lexicon = require('nypl-registry-utils-lexicon')

var JsonLdItemSerializer = require('../base').JsonLdItemSerializer
var SearchResultsSerializer = require('../base').SearchResultsSerializer

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
    if (this.body.identifier) {
      var bnum = null
      if ((bnum = this.body.identifier.filter((i) => i.match(/^urn:bnum:/))) && (bnum = bnum[0]) && (bnum = bnum.split(':')) && (bnum = bnum[bnum.length - 1])) {
        stmts.depiction = `https://s3.amazonaws.com/data.nypl.org/bookcovers/${bnum}.jpg`
      }
    }
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
    if (this.body.parentUris_packed) stmts.memberOf = JsonLdItemSerializer.parsePackedStatement(this.body.parentUris_packed, { type: 'nypl:Resource' })
    if (this.body.note) stmts.note = this.body.note
    if (this.body.owner) stmts.owner = { '@id': this.body.owner[0], prefLabel: lexicon.labels.orgs[this.body.owner[0]] }
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

module.exports = { ResourceSerializer, ResourceResultsSerializer }
