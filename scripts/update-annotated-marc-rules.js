/**
 *  This file rebuilds data/annotated-marc-rules.json from data/webpub.def
 */

const fs = require('fs')

const AnnotatedMarcSerializer = require('../lib/annotated-marc-serializer')

// Read raw webpub.def
const mappingRulesRaw = fs.readFileSync('./data/webpub.def', 'utf8')
// Read raw bib-record-index-rules.txt
const bibRecordIndexRules = fs.readFileSync('./data/bib-record-index-rules.txt', 'utf8')

// Transform raw webpub.def into a series of mapping rules:
const mappingRules = AnnotatedMarcSerializer.buildAnnotatedMarcRules(mappingRulesRaw, bibRecordIndexRules)
  .map((rule) => {
    return Object.assign({}, rule, {
      // RegExp.proto.source returns .toString() without '/' bookends
      marcIndicatorRegExp: rule.marcIndicatorRegExp.source,
      secondaryMarcIndicatorRegExp: rule.secondaryMarcIndicatorRegExp.source
    })
  })

// Serialize:
const content = JSON.stringify(mappingRules, null, 2)

// Write:
fs.writeFileSync('./data/annotated-marc-rules.json', content)
