/**
 *  Script to build a rc-mappings json document with detailed information that
 *  connects Indexer mappings to DiscoveryAPI properties and RC labels. This
 *  document can be used to build staff/patron facing reports.
 *
 *  Usage:
 *    node scripts/build-mappings-document.js [--outfile out.json]
 */

const { parseArgs: _parseArgs } = require('node:util')
const fs = require('fs')
const { parse: csvParse } = require('csv-parse/sync')

const elasticConfig = require('../lib/elasticsearch/config')
const cqlConfig = require('../lib/elasticsearch/cql/index-mapping')

const fetchRciMappings = async () => {
  console.info('Retrieving RCI mappings...')

  const ghBase = 'https://raw.githubusercontent.com/NYPL/research-catalog-indexer/refs/heads/main'

  const [bibMappings, itemMappings] = await Promise.all(
    [
      `${ghBase}/lib/mappings/bib-mapping.json`,
      `${ghBase}/lib/mappings/item-mapping.json`
    ].map(async (url) => {
      const resp = await fetch(url)
      return resp.json()
    })
  )

  console.info(`  Got ${Object.keys(bibMappings).length} bib mappings & ${Object.keys(itemMappings).length} item mappings`)

  return {
    bibMappings,
    itemMappings
  }
}

/**
 *  Fetches and inspects key RC files to extract patron-facing labels for discovery-api properties.
 *
 *  Returns a hash relating discovery-api property names (e.g. creatorLiteral)
 *  to RC label (e.g. "Additional authors")
 */
const fetchRcLabels = async () => {
  console.info('Retrieving RC property labels...')

  const resp = await fetch('https://raw.githubusercontent.com/NYPL/research-catalog/main/src/models/BibDetails.ts')
  const lines = (await resp.text()).split('\n')
  const labels = lines.reduce((h, line) => {
    // Look for lines of form `{ field: "contributorLiteral", label: "Additional authors" },`
    const reg = /field: "([^"]+)", label: "([^"]+)"/
    if (reg.test(line)) {
      const [, property, label] = line.match(reg)
      h[property] = label
    }
    return h
  }, {})

  console.info(`  Got ${Object.keys(labels).length} RC labels`)

  return labels
}

/**
 *  Fetch browse-terms mappings config and return a callback function that, for
 *  a marc tag, returns the appropriate set of subfields.
 */
const buildBrowseTermsSubfieldLookup = async () => {
  console.info('Retrieving Browse-Term module subfields...')

  const mappingsReq = await fetch('https://raw.githubusercontent.com/NYPL/browse-term/main/src/data/mappings.json')
  const mappings = await mappingsReq.json()

  const subjectsMappings = mappings.subjects.first.concat(mappings.subjects.last)
  const portionMap = mappings.contributors

  const subfieldsByMarc = (marc) => {
    if (marc >= '600' && marc <= '690') {
      return subjectsMappings
    } else {
      const key = marc.slice(1)
      return Object.values(portionMap[key] || portionMap['00'])
        .flat(1)
        .sort()
    }
  }

  console.info(`  Got ${subjectsMappings.length} subjects mappings and ${Object.keys(portionMap).length} sets of mappings for contributors`)

  return subfieldsByMarc
}

/**
 *  Returns an object defining:
 *   - properties: Hash of properties relating property (internal name) to an object that defines
 *     - label {string} - Preferred label (overrides RC derived label)
 *     - advSearchEquivalent {string} - Name of field in RC Adv Search providing similar search
 *     - notes {string} - Freeform descrption of field
 */
const fetchEditorial = async () => {
  console.info('Retrieving editorial from Google Sheet')

  const resp = await fetch('https://docs.google.com/spreadsheets/d/e/2PACX-1vSfPy-FGTOct1QjjZ3K8LOl2WQBZH8zgBViwWp5jd_sfXHg18BIvqvPej7mF_9ScSmxv0nO0l2FfoRr/pub?output=csv', { redirect: 'follow' })
  const data = await resp.text()
  const rows = csvParse(data)

  let category = null
  const lookup = rows
    .slice(1)
    .filter((row) => row[0] || row[1])
    .reduce((h, row) => {
      if (row[0]) category = row[0]

      const bucket = {
        'search scopes': 'searchScopes',
        'cql indexes': 'cqlIndexes',
        properties: 'properties'
      }[category.toLowerCase().trim()]

      const [, internalName, label, advSearchEquivalent, notes] = row

      if (!bucket) console.error('Invalid bucket? ', category)
      const o = {}
      if (label) o.label = label
      if (notes) o.notes = notes
      if (advSearchEquivalent) o.advSearchEquivalent = advSearchEquivalent

      h[bucket][internalName] = o

      return h
    }, { properties: {}, searchScopes: {}, cqlIndexes: {} })

  console.info(`  Got ${Object.entries(lookup).map(([cat, lookup]) => `${Object.keys(lookup).length} ${cat} entries`).join(', ')}`)

  return lookup
}

const propertyName = (field) => {
  return field
    .replace(/\.(folded.*|raw|keyword.*|clean|range|id|label(\.\w+)?)$/, '')
    .replace(/\^.*/, '')
}

const parallelName = (field) => {
  const capitalizedName = field.charAt(0).toUpperCase() + field.slice(1)

  return `parallel${capitalizedName}`
}

/**
 *  Build array of objects representing properties.
 *
 *  Each entry defines:
 *   - name {string} - Name of property
 *   - marc {object[]} - Array of marc mappings (such as those defined in bib-mappings.json)
 *   - notes {string} - The optional "notes" prop sometimes offered in lieu of a mapping in *-mappings.json
 *   - label {string} - RC label for property (possibly overriden by "editorial" doc)
 *   - advSearchEquivalent {string} - Name of field in RC Adv Search providing
 *                                    similar search. Retrieved from
 *                                    "editorial" document.
 *
 */
const buildProperties = async (editorial, parallels) => {
  const rcLabels = await fetchRcLabels()
  const { bibMappings, itemMappings } = await fetchRciMappings()

  const basicMappings = Object.entries(bibMappings).map(([name, config]) => {
    name = name.replace('donorSponsor', 'donor')

    return {
      name,
      marc: config.paths,
      notes: config.notes,
      label: rcLabels[name],
      ...(editorial[name] || {}),
      hasParallel: parallels.includes(parallelName(name))
    }
  })
    .concat(Object.entries(itemMappings).map(([name, config]) => {
      name = `items.${name}`
      return {
        name,
        marc: config.paths,
        notes: config.notes,
        ...(editorial[name] || {})
      }
    }))

  const browseTermSubfieldsByMarc = await buildBrowseTermsSubfieldLookup()
  const browseTermManagedMappings = [
    'creatorLiteral',
    'contributorLiteral',
    'subjectLiteral',
    'seriesAddedEntry'
  ]
  return basicMappings.map((m) => {
    if (browseTermManagedMappings.includes(m.name)) {
      m.marc = m.marc.map((marc) => {
        marc.subfields = browseTermSubfieldsByMarc(marc.marc)
        // Disregard excludedSufields when found in RCI mappings, since those
        // are overridden by the `subfields` mappings found in browse-term:
        delete marc.excludedSubfields
        return marc
      })
    }
    return m
  })
}

const buildParallelProperties = () => {
  return Object.values(elasticConfig.SEARCH_SCOPES)
    .reduce((a, config) => {
      if (!config.fields) return a

      return a.concat(
        config.fields
          .map((field) => field.field || field)
          .map((field) => propertyName(field))
          .filter((field) => field.indexOf('parallel') === 0)
      )
    }, [])
}

/**
 *  Build array of objects representing search scopes.
 *
 *  Each entry defines:
 *   - name {string} - Name of cql index
 *   - properties {string[]} - Array of property names
 *   - advSearchEquivalent {string} - Name of field in RC Adv Search providing
 *                                    similar search. Retrieved from
 *                                    "editorial" document.
 *   - notes {string} - Freeform descrption of field. Retrieved from
 *                      "editorial" document.
 */
const buildSearchScopes = (editorial) => {
  return Object.entries(elasticConfig.SEARCH_SCOPES).map(([name, config]) => {
    let properties = null
    let parallelProperties = null

    if (config.fields) {
      properties = [...new Set(
        config.fields
          .map((field) => field.field || field)
          .map((field) => propertyName(field))
      )]

      parallelProperties = properties
        .filter((field) => field.indexOf('parallel') === 0)

      properties = properties
        .filter((field) => field.indexOf('parallel') !== 0)
    }
    return {
      name,
      properties,
      parallelProperties,
      ...(editorial[name] || {})
    }
  })
}

/**
 *  Build array of objects representing all CQL indexes.
 *
 *  Each entry defines:
 *   - name {string} - Name of cql index
 *   - properties {string[]} - Array of property names
 *   - advSearchEquivalent {string} - Name of field in RC Adv Search providing
 *                                    similar search. Retrieved from
 *                                    "editorial" document.
 *   - notes {string} - Freeform descrption of field. Retrieved from
 *                      "editorial" document.
 */
const buildCqlIndexes = (editorial) => {
  return Object.entries(cqlConfig.indexMapping).map(([name, config]) => {
    let properties = null
    let parallelProperties = null

    const fields = config.fields || config.term

    if (fields) {
      properties = [...new Set(
        fields
          .map((field) => field.field || field)
          .map((field) => propertyName(field))
      )]

      parallelProperties = properties
        .filter((field) => field.indexOf('parallel') === 0)

      properties = properties
        .filter((field) => field.indexOf('parallel') !== 0)
    }

    return {
      name,
      properties,
      parallelProperties,
      ...(editorial[name] || {})
    }
  })
}

const parseArgs = () => {
  return _parseArgs({
    args: process.args,
    options: {
      outfile: {
        type: 'string'
      }
    }
  }).values
}

/**
 *  Builds mappings document, returning result.
 */
const buildMappingsDocument = async () => {
  const editorial = await fetchEditorial()

  const parallels = buildParallelProperties()

  const properties = await buildProperties(editorial.properties, parallels)
  const searchScopes = buildSearchScopes(editorial.searchScopes)
  const cqlIndexes = buildCqlIndexes(editorial.cqlIndexes)

  return {
    properties,
    searchScopes,
    cqlIndexes
  }
}

/**
 *  Main script function. Fetch and collate data. Write result to outfile.
 */
const run = async () => {
  const args = parseArgs()

  const doc = await buildMappingsDocument()

  const outDoc = JSON.stringify(doc, null, 2)
  if (args.outfile) {
    console.info(`Writing unified doc to ${args.outfile}`)
    fs.writeFileSync(args.outfile, outDoc, 'utf-8')
  } else {
    console.info(outDoc)
  }

  console.info('Done')
}

if (require.main === module) {
  run()
}

module.exports = {
  buildMappingsDocument
}
