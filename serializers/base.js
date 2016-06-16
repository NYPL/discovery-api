'use strict'

var util = require('../lib/util.js')

const PACK_DELIM = '||'

class JsonLdSerializer {
  constructor (body, options) {
    this.body = body
    this.options = options || {}
  }

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

    var id = urn
    var urnParts = urn.split(':')
    var props = {}
    if (urnParts.length === 2) {
      props['@type'] = { terms: 'nypl:Term', agents: 'nypl:Agent', res: 'nypl:Resource' }[urnParts[0]]
      // TODO temporary override of some memberOf, which wasn't indexed with res: prefix:
    }
    if (id.match(/^\d+$/)) id = `res:${id}`
    props['@id'] = id
    props['prefLabel'] = label

    return Object.assign({}, base, props)
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

module.exports = { JsonLdSerializer, JsonLdListSerializer, JsonLdItemSerializer, SearchResultsSerializer }
