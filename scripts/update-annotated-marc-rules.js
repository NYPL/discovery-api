#!/usr/bin/env node
/**
 *  This file rebuilds data/annotated-marc-rules.json from data/webpub.def
 *
 *  Webpub.def is a Sierra configuration file, which controls how specific marc
 *  fields are rendered in the catalog. We use it to build our own "annotated-
 *  marc-rules" document, which builds a similarly formatted document for the
 *  front-end. This script exists to rebuild that mapping file using the
 *  current Sierra webpub.def, which changes occassionally (e.g. to introduce
 *  a new mapping).
 *
 *  Usage:
 *    node ./scripts/update-annotated-marc-rules.js [--refetch]
 *
 *  If --refetch given, script updates local webpub.def from remote.
 */

const fs = require('fs')
const request = require('request-promise')

const AnnotatedMarcSerializer = require('../lib/annotated-marc-serializer')

require('dotenv').config()

const argv = require('minimist')(process.argv.slice(2))

const WEBPUB_DEF_LOCAL_PATH = './data/webpub.def'

/**
 * Fetch latest webpub.def from catalog server
 */
function refetch () {
  console.log(`Fetching latest webpub.def from ${process.env.CATALOG_WEBPUB_DEF_URL}`)
  return request({ uri: process.env.CATALOG_WEBPUB_DEF_URL })
    .then((resp) => {
      fs.writeFileSync(WEBPUB_DEF_LOCAL_PATH, resp)
      console.log('Updated webpub.def')
    })
}

/**
 * Rebuild local annotated-marc-rules from local webpub.def
 */
function updateAnnotatedMarcRules () {
  // Read raw webpub.def
  const mappingRulesRaw = fs.readFileSync(WEBPUB_DEF_LOCAL_PATH, 'utf8')

  // Transform raw webpub.def into a series of mapping rules:
  const mappingRules = AnnotatedMarcSerializer.buildAnnotatedMarcRules(mappingRulesRaw)
    .map((rule) => {
      return Object.assign({}, rule, {
        // RegExp.proto.source returns .toString() without '/' bookends
        marcIndicatorRegExp: rule.marcIndicatorRegExp.source
      })
    })

  // Serialize:
  const content = JSON.stringify(mappingRules, null, 2)

  // Write:
  fs.writeFileSync('./data/annotated-marc-rules.json', content)

  console.log('Finished updating annotated-marc-rules')
}

// If told to fetch latest webpub.def, do so:
if (argv.refetch) {
  refetch().then(updateAnnotatedMarcRules)

// Otherwise, just build from current copy of webpub.def:
} else {
  updateAnnotatedMarcRules()
}
