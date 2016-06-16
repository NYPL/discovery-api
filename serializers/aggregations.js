'use strict'

var lexicon = require('nypl-registry-utils-lexicon')

var JsonLdListSerializer = require('./base').JsonLdListSerializer

const PACK_DELIM = '||'

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

module.exports = { AggregationsSerializer }
