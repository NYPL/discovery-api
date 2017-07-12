const config = require('config')
const jsonld = require('jsonld')
const fs = require('fs')
const csv = require('fast-csv')

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
  var flat = {objectLiteral: {}, objectUri: {}}
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
            flat.objectUri[key + ':label'].push({uri: value.objectUri, label: value.label})
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
  // console.log(triples)
  jsonld.fromRDF(triples, {format: 'application/nquads'}, function (err, doc) {
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
    } else if (spec[param].default) {
      ret[param] = spec[param].default
    }
  })
  return ret
}

// Given raw query param value `val`
// returns value validated against supplied spec:
//   `type`: (int, string, date, object) - Type to validate (and cast) against
//   `range`: Array - Constrain allowed values to range
//   `default`: (mixed) - Return this if value missing
//   `fields`: Hash - When `type` is 'hash', this property provides field spec to validate internal fields against
//   `repeatable`: Boolean - If true, array of values may be returned. Otherwise will select last. Default false
exports.parseParam = function (val, spec) {
  // TODO I don't think this recursion is necessary here
  /* if ((typeof val) === 'object' && !Array.isArray(val)) {
    return Object.keys(val).map((i) => exports.parseParam(val[i], spec)).filter((v) => (typeof v) !== 'undefined')
  } */

  // Unless it's marked repeatable, convert arrays of values to just last value:
  if (!spec.repeatable && Array.isArray(val)) val = val[val.length - 1]

  // If it's an array of vals, apply this function to all values:
  if (Array.isArray(val)) return val.map((v) => exports.parseParam(v, spec))

  switch (spec.type) {
    case 'date':
    case 'int':
      if (isNaN(val)) return spec.default
      val = Number.parseInt(val)
      break

    case 'hash':
      val = exports.parseParams(val, spec.fields || {})
      break
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

exports.gatherParams = function (req, acceptedParams) {
  // If specific params configured, pass those to handler
  // otherwise just pass `value` param (i.e. keyword search)
  acceptedParams = (typeof acceptedParams === 'undefined') ? ['page', 'per_page', 'value', 'q', 'filters'] : acceptedParams

  var params = {}
  acceptedParams.forEach((k) => {
    params[k] = req.query[k]
  })
  if (req.query.q) params.value = req.query.q
  return params
}
