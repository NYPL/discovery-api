'use strict'

var lexicon = require('nypl-registry-utils-lexicon')

var util = require('./util.js')
// var inherits = require('util').inherits

class JsonLdSerializer {
  constructor (body, extraProperties) {
    this.body = body
    this.extraProperties = extraProperties
  }

  resultId (result) {
    return result.uri
  }

  format () {
    var base = {
      '@context': util.contextAll,
      '@type': this.type
    }
    Object.assign(base, this.statements())
    return base
  }

}

class JsonLdListSerializer extends JsonLdSerializer {
  constructor (items, extra) {
    super(items, extra)
    this.items = this.body
    this.type = 'itemList'
    this.extra = extra
  }

  statements () {
    // if (this.extraProperties) Object.assign(base, this.extraProperties)
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
  constructor (body, extra) {
    super(body, extra)
    this.type = this.body.type
  }

  statements () {
    return Object.assign({}, {'@id': this.resultId()}, this.body)
  }
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
  constructor (item) {
    super(item)
    this.resultType = 'nypl:Resource'
  }

  resultId () {
    return `resource:${this.body.uri}`
  }

  static serialize (resp) {
    if (resp.identifier) {
      var bnum = null
      if ((bnum = resp.identifier.filter((i) => i.match(/^urn:bnum:/))) && (bnum = bnum[0]) && (bnum = bnum.split(':')) && (bnum = bnum[bnum.length - 1])) {
        resp.depiction = `https://s3.amazonaws.com/data.nypl.org/bookcovers/${bnum}_ol.jpg`
      }
    }
    return (new ResourceSerializer(resp)).format()
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
    return `resource:${result.uri}`
  }

  static serialize (resp) {
    var results = []
    var hits = resp.hits.hits
    hits.forEach(function (h) {
      if (h._source.identifier) {
        var bnum = null
        if ((bnum = h._source.identifier.filter((i) => i.match(/^urn:bnum:/))) && (bnum = bnum[0]) && (bnum = bnum.split(':')) && (bnum = bnum[bnum.length - 1])) {
          h._source.depiction = `https://s3.amazonaws.com/data.nypl.org/bookcovers/${bnum}_ol.jpg`
        }
      }
      results.push(h._source)
    })
    return (new ResourceResultsSerializer(results, {totalResults: resp.hits.total})).format()
  }
}

/*
 *  Search Aggregations
 */

const PACK_DELIM = '||'
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
        else if (field === 'type') v.label = lexicon.labels.resourcetypes[v.value]
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

module.exports = { JsonLdSerializer, ResourceSerializer, ResourceResultsSerializer, AggregationsSerializer }
