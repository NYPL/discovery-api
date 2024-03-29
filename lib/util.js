const config = require('config')
const jsonld = require('jsonld')
const fs = require('fs')
const csv = require('fast-csv')
const logger = require('./logger')
const isItemNyplOwned = require('./ownership_determination').isItemNyplOwned

var exports = module.exports = {}

exports.contextAll = config['contextAll']

exports.buildJsonLdContext = function (prefixes) {
  var context = JSON.parse(JSON.stringify(prefixes))
  delete context['urn']

  return context
}

// Return a context doc for 'resource', or 'result'
exports.context = (which) => {
  var all = ['resource', 'result']
  var contexts = all.indexOf(which) < 0 ? all : [which]
  return Promise.all(
    contexts
      .map((f) => `./data/contexts/${f}.json`)
      .map(readJson)
  ).then((contexts) => {
    contexts = contexts.map((c) => c['@context'])
    var statements = Object.assign.apply(null, [{}].concat(contexts))

    // Order by keys, with prefix statements first
    statements = Object.keys(statements).sort((k1, k2) => {
      var isPrefix = [statements[k1].match(/^http/) !== null, statements[k2].match(/^http/) !== null]

      // If both are namespace declarations (or both not), order them by key
      // otherwise always order namespace declarations first
      var correctlyOrdered = null
      if (isPrefix[0] && isPrefix[1]) correctlyOrdered = k1 < k2
      else if (isPrefix[0]) correctlyOrdered = true
      else if (isPrefix[1]) correctlyOrdered = false
      else correctlyOrdered = k1 < k2

      return correctlyOrdered ? -1 : 1
    }).reduce((result, key) => {
      result[key] = statements[key]
      return result
    }, {})

    return statements
  })
}

const readJson = (path) => {
  var cacheKey = `readJson:${path}`
  if (__file_cache[cacheKey]) return Promise.resolve(__file_cache[cacheKey])

  var fs = require('fs')
  return new Promise((resolve, reject) => {
    fs.readFile(path, 'utf8', (err, data) => {
      if (err) reject(err)
      else {
        data = JSON.parse(data)
        __file_cache[cacheKey] = data
        resolve(data)
      }
    })
  })
}

var __file_cache = {}
exports.readCsv = (path) => {
  var cacheKey = `readCsv:${path}`
  if (__file_cache[cacheKey]) return Promise.resolve(__file_cache[cacheKey])

  return new Promise((resolve, reject) => {
    var rows = []

    fs.createReadStream(path)
      .pipe(csv())
      .on('data', (data) => {
        rows.push(data)
      })
      .on('end', () => {
        __file_cache[cacheKey] = rows
        resolve(rows)
      })
  })
}

exports.eachValue = function (a, cb) {
  switch (typeof a) {
    case 'object': return a.map(cb)
    case 'undefined': return null
    default: if (a) return cb(a)
  }
}

exports.flatenTriples = function (object) {
  var flat = { objectLiteral: {}, objectUri: {} }
  for (var key in object) {
    // is this a triple
    if (config['predicatesAgents'].indexOf(key) > -1 || config['predicatesResources'].indexOf(key) > -1) {
      object[key].forEach((value) => {
        if (value.objectLiteral) {
          if (!flat.objectLiteral[key]) flat.objectLiteral[key] = []
          flat.objectLiteral[key].push(value.objectLiteral)
        }
        if (value.objectUri) {
          if (!flat.objectUri[key]) flat.objectUri[key] = []
          flat.objectUri[key].push(value.objectUri)
          if (value.label) {
            if (!flat.objectUri[key + ':label']) flat.objectUri[key + ':label'] = []
            flat.objectUri[key + ':label'].push({ uri: value.objectUri, label: value.label })
          }
        }
      })
    }
  }
  return flat
}

exports.expandObjectUri = function (objectUri) {
  if (!objectUri) return false

  var split = objectUri.split(':')
  var prefix = split[0]
  split.shift(0, 1)
  var value = split.join(':')

  var uriBase = config.prefixes[prefix]
  if (!uriBase) {
    console.log('Unknown Prefix:', prefix)
    return false
  }
  return uriBase + value
}

// turns the objects into triples sans provo
exports.returnNtTriples = function (obj, type) {
  var uri = null
  var triples = []
  if (type === 'resource') {
    uri = '<http://data.nypl.org/resources/' + obj.uri + '>'
  } else if (type === 'agent') {
    uri = '<http://data.nypl.org/agents/' + obj.uri + '>'
  } else if (type === 'term') {
    uri = '<http://data.nypl.org/terms/' + obj.uri + '>'
  } else if (type === 'org') {
    uri = '<http://data.nypl.org/organizations/' + obj.uri + '>'
  } else if (type === 'dataset') {
    uri = '<http://data.nypl.org/datasets/' + obj.uri + '>'
  } else {
    return false
  }

  for (var p in obj.statements) {
    if ((typeof obj.statements[p]) !== 'object') continue

    if (config['predicatesAgents'].indexOf(p) > -1 || config['predicatesResources'].indexOf(p) > -1) {
      // it is a triple
      var expandedPredicate = '<' + exports.expandObjectUri(p) + '>'
      obj.statements[p].forEach((o) => {
        var expandedObject = null
        if (o.objectUri) {
          expandedObject = '<' + exports.expandObjectUri(o.objectUri) + '>'
        } else {
          expandedObject = exports.expandObjectUri(o.objectLiteralType)
          if (expandedObject === false && o.objectLiteralType) {
            expandedObject = '@' + o.objectLiteralType
          } else if (typeof expandedObject === 'string') {
            expandedObject = '^^<' + expandedObject + '>'
          } else {
            expandedObject = ''
          }
          if (typeof o.objectLiteral === 'string') o.objectLiteral = o.objectLiteral.replace('"', '\\"').replace('\n', '  ')
          expandedObject = '"' + o.objectLiteral + '"' + expandedObject
        }
        triples.push(uri + ' ' + expandedPredicate + ' ' + expandedObject + '.')
      })
    }
  }
  return triples
}

exports.returnNtJsonLd = function (obj, type, cb) {
  var triples = exports.returnNtTriples(obj, type).join('\n')
  jsonld.fromRDF(triples, { format: 'application/nquads' }, function (err, doc) {
    if (err) console.log(JSON.stringify(err, null, 2))
    jsonld.compact(doc, exports.context, function (err, compacted) {
      if (err) console.log(err)
      cb(err, compacted)
    })
  })
}

// Applies validation against hash of params given spec
// see `parseParams`
exports.parseParams = function (params, spec) {
  var ret = {}
  Object.keys(spec).forEach(function (param) {
    // For type 'string', we consider '' a truthy val
    var isEmptyString = spec[param].type === 'string' && params[param] === ''

    // If user supplied a truthy value
    if (params[param] || isEmptyString) {
      var parsed = exports.parseParam(params[param], spec[param])

      // Make sure it's a valid value
      if ((typeof parsed) !== 'undefined') {
        ret[param] = parsed

        // If not valid, fall back on default, if specified:
      } else if (spec[param].default) {
        ret[param] = spec[param].default
      }
    } else if (spec[param].default !== undefined) {
      ret[param] = spec[param].default
    }
  })
  return ret
}

// Given raw query param value `val`
// returns value validated against supplied spec:
//   `type`: (int, int-range, string, string-list, date, object, boolean) - Type to validate (and cast) against
//   `range`: Array - Constrain allowed values to range
//   `default`: (mixed) - Return this if value missing
//   `fields`: Hash - When `type` is 'hash', this property provides field spec to validate internal fields against
//   `repeatable`: Boolean - If true, array of values may be returned. Otherwise will select last. Default false
exports.parseParam = function (val, spec) {
  if (spec.fields &&
    spec.fields.subjectLiteral &&
    spec.fields.subjectLiteral.field === 'subjectLiteral_exploded' &&
    val.subjectLiteral
  ) {
    if (typeof val.subjectLiteral === 'string' && val.subjectLiteral.slice(-1) === '.') {
      val.subjectLiteral = val.subjectLiteral.slice(0, -1)
      logger.debug('Removing terminal period', JSON.stringify(val, null, 4))
    } else if (Array.isArray(val.subjectLiteral)) {
      val.subjectLiteral.forEach((sub, i) => {
        if (sub.slice(-1) === '.') {
          val.subjectLiteral[i] = sub.slice(0, -1)
          logger.debug('Removing terminal period', JSON.stringify(sub, null, 4))
        }
      })
    }
  }

  // Unless it's marked repeatable, convert arrays of values to just last value:
  if (!spec.repeatable && Array.isArray(val)) val = val[val.length - 1]

  // If it's an array of vals, apply this function to all values:
  if (Array.isArray(val)) return val.map((v) => exports.parseParam(v, spec))

  switch (spec.type) {
    case 'int':
      if (isNaN(val)) return spec.default
      val = Number.parseInt(val)
      break
    case 'int-range':
      if (!val.match(/^(\d+)(\s*-\s*(\d+))?$/)) return spec.default
      return val.split('-')
        .map((v) => v.trim())
        .map((v) => exports.parseParam(v, { type: 'int' }))
    case 'hash':
      val = exports.parseParams(val, spec.fields || {})
      break
    case 'boolean':
      if (val === 'true' || val === 'false') return val === 'true'
      else return spec.default
    case 'string-list':
      return val.split(',')
        .map((v) => v.trim())

  }

  if (spec.range) {
    if (spec.type === 'string') {
      if (spec.range.indexOf(val) < 0) return spec.default
    } else {
      if (val < spec.range[0]) return spec.default
      if (val > spec.range[1]) return spec.range[1]
    }
  }

  return val
}

exports.arrayIntersection = (a1, a2) => {
  return a1.filter(function (n) {
    return a2.indexOf(n) !== -1
  })
}

/**
 * Get array of key-value pairs for object
 *
 * ( In lieu of https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/entries )
 */
exports.objectEntries = (obj) => {
  return Object.keys(obj)
    .map((key) => [key, obj[key]])
}

exports.gatherParams = function (req, acceptedParams) {
  // If specific params configured, pass those to handler
  // otherwise just pass `value` param (i.e. keyword search)
  acceptedParams = (typeof acceptedParams === 'undefined') ? ['page', 'per_page', 'value', 'q', 'filters', 'contributor', 'subject', 'title', 'isbn', 'issn', 'lccn', 'oclc', 'merge_checkin_card_items', 'include_item_aggregations'] : acceptedParams

  var params = {}
  acceptedParams.forEach((k) => {
    params[k] = req.query[k]
  })
  if (req.query.q) params.value = req.query.q
  return params
}

/*
 * Expects array of strings, numbers
 */
exports.arrayUnique = (a) => {
  const h = a.reduce((h, element) => {
    h[JSON.stringify(element)] = element
    return h
  }, {})
  return Object.keys(h).map((k) => h[k])
}

/**
 * Given a phrase of any length, returns that same phrase with each character
 * prefixed by the indicated count of backslashes.
 * Useful for escaping (and doubly escaping) special characters/phrases) in ES
 */
exports.backslashes = (phrase, count = 1) => {
  if (phrase.length === 1) {
    const slashes = (new Array(count)).fill('\\').join('')
    return `${slashes}${phrase}`
  } else {
    return Array.from(phrase)
      .map((c) => exports.backslashes(c, count))
      .join('')
  }
}

/**
 *  Given a bibid (e.g. 12345), returns the same value but with Sierra's
 *  "checksum" character on the end
 */
exports.bNumberWithCheckDigit = (bibid) => {
  const ogBnumber = bibid
  const results = []
  let multiplier = 2
  for (const digit of bibid.split('').reverse().join('')) {
    results.push(parseInt(digit) * multiplier++)
  }

  const remainder = results.reduce(function (a, b) { return a + b }, 0) % 11

  // OMG THIS IS WRONG! Sierra doesn't do mod11 riggghhttttt
  // remainder = 11 - remainder

  if (remainder === 11) return `${ogBnumber}0`
  if (remainder === 10) return `${ogBnumber}x`

  return `${ogBnumber}${remainder}`
}

/**
 * Given an object and a path expression, returns the value at that path in the
 * object if it exists. Returns a configurable default value if it does not.
 *
 * @param {object} object - An object of any depth
 * @param {string} path - A path to evaluate in dot notation
 *   (e.g. "prop1.prop2[0].prop3")
 * @param {object} defaultTo - Value to return when the path fails.
 *   Default null
 *
 * @example
 * const obj = {
 *   a: {
 *     b: {
 *       c: 'foo',
 *       d: [
 *         { d1: 'foo2' }
 *       ]
 *     }
 *   }
 * }
 *
 * deepValue(obj, 'a.b.c')
 *  => 'foo'
 *
 * deepValue(obj, 'a.b.d[0].d1')
 *  => 'foo2'
 *
 * deepValue(obj, 'x.y.z', {})
 *  => {}
 *
 * deepValue(obj, 'x.y.z')
 *  => null
 *
 * deepValue(obj, 'x.y.z', {})
 *  => {}
 */
exports.deepValue = (object, path, defaultTo = null) => {
  if (typeof object === 'undefined') return defaultTo

  // Initialize array of paths to use:
  const paths = (typeof path === 'string')
    ? path
      // Each path part is delimited by a . or a [
      .split(/\.|\[/)
      // Remove trailing ] on any path part:
      .map((key) => key.replace(/\]$/, ''))
    : path
  const nextPath = paths.shift()

  // If we've reached the end of the queried path, return value:
  if (paths.length === 0) {
    return typeof object[nextPath] === 'undefined'
      ? defaultTo
      : object[nextPath]
  }

  // Return next level:
  return exports.deepValue(object[nextPath], paths, defaultTo)
}

exports.checkForNestedHitsAndSource = (resp, type) => {
  return exports.deepValue(resp, 'hits.hits[0]._source') &&
    exports.deepValue(resp, `hits.hits[0].inner_hits.${type}.hits.hits`)
  /*
   * Original check:
  return resp
    && resp.hits
    && resp.hits.hits
    && resp.hits.hits[0]
    && resp.hits.hits[0]._source
    && resp.hits.hits[0].inner_hits
    && resp.hits.hits[0].inner_hits.items
    && resp.hits.hits[0].inner_hits.items.hits
    && resp.hits.hits[0].inner_hits.items.hits.hits
  */
}

/**
 *  Given an ES item, returns true if the item has a ReCAP holding location
 */
exports.itemHasRecapHoldingLocation = (item) => {
  if (!exports.deepValue(item, 'holdingLocation[0].id')) return false
  return /^loc:rc/.test(item.holdingLocation[0].id)
}

/**
 *  Given an ES item, returns the item's barcode from the identifer array
 */
exports.barcodeFromItem = (item) => {
  if (!item.identifier || !Array.isArray(item.identifier)) return null
  const barcodeIdentifier = item.identifier.find((identifier) => /^urn:barcode:/.test(identifier))
  if (!barcodeIdentifier) return null
  return barcodeIdentifier.split(':').pop()
}

/**
 *
 * Confirm the url is an Aeon Link
 * @param url string | string[]
 * @return A boolean indicating the passed url[s] are valid Aeon links
 *
 * Example URL:
 * - https://specialcollections.nypl.org/aeon/Aeon.dll
 * - https://nypl-aeon-test.aeon.atlas-sys.com
 */
exports.isAeonUrl = (url) => {
  if (!url) return false
  const aeonLinks = [
    'https://specialcollections.nypl.org/aeon/Aeon.dll',
    'https://nypl-aeon-test.aeon.atlas-sys.com'
  ]
  const link = Array.isArray(url) ? url[0] : url
  return Boolean(aeonLinks.some((path) => link.startsWith(path)))
}

exports.isInRecap = (item) => {
  return !!item.recapCustomerCode ||
    exports.itemHasRecapHoldingLocation(item) ||
    !isItemNyplOwned(item)
}

exports.isInSchomburg = (item) => {
  const holdingLocation = exports.deepValue(item, 'holdingLocation[0].id')
  if (holdingLocation) {
    return holdingLocation.startsWith('loc:sc')
  }
}

exports.getSchomburgDeliveryInfo = (item, deliveryInfo) => {
  const itemType = exports.deepValue(item, 'catalogItemType[0].id')
  if (itemType) {
    const itemNumber = itemType.split(':')[1]
    const holdingLocation = exports.deepValue(item, 'holdingLocation[0].id')
    const case1 = holdingLocation === 'loc:scff3' && itemNumber === '26'
    const case2 = holdingLocation === 'loc:scff2' && itemNumber === '6'
    let criteria
    if (case1) criteria = 'scff3 microfiche'
    else if (case2) criteria = 'scff2 microfilm'
    else {
      deliveryInfo.deliveryLocation = []
      criteria = 'Non requestable schomburg catalog item type ' + itemNumber
    }
    return Object.assign({}, deliveryInfo, { criteria })
  }
}
