const { loadConfig } = require('../../lib/load-config')
const client = require('../../lib/elasticsearch/client')
const { SEARCH_SCOPES, FILTER_CONFIG } = require('../../lib/elasticsearch/config')

/**
 * Verify if current filter and search scope config is compatible with an elastic search index. Config is incompatible if it includes fields that do not exist in the mapping.
 *    By default, the script checks the environment's config file for an index name and fetches that index's mappings.
 *    Optional param skips fetch and instead validates against local mapping file.
 * Usage:
 *    ENV={env} node mapping-check.js {schema-file-path}
 * Params:
 *    schema-file-path: absolute path to your local copy of research-catalog-indexer/lib/elastic-search/index-schema.js.
 *
*/

const schemaFilePath = process.argv[2] || null
/**
 * Extract all unique field names from SEARCH_SCOPES and FILTER_CONFIG,
 * stripping any boost suffixes (e.g. "^4").
 */
const extractConfigFields = () => {
  const fields = new Set()

  for (const scope of Object.values(SEARCH_SCOPES)) {
    if (!scope.fields) continue
    for (const entry of scope.fields) {
      const fieldName = typeof entry === 'string'
        ? entry.replace(/\^\d+(\.\d+)?$/, '')
        : entry.field
      if (fieldName) fields.add(fieldName)
    }
  }

  for (const config of Object.values(FILTER_CONFIG)) {
    if (!config.field) continue
    for (const fieldName of config.field) {
      fields.add(fieldName)
    }
  }

  return [...fields]
}

/**
 * Fetch the mapping properties for the configured index.
 */
const fetchMappingProperties = async () => {
  if (schemaFilePath) {
    console.log(`Loading mapping from schema file: ${schemaFilePath}`)
    const schemaModule = require(schemaFilePath)
    return schemaModule.schema()
  }
  const index = process.env.RESOURCES_INDEX
  const response = await client.esClient().indices.getMapping({ index })
  const indexMapping = Object.values(response)[0]
  return indexMapping.mappings.properties
}

/**
 * Traverse the mapping for a dot-separated field path, checking both
 * `properties` (nested objects) and `fields` (multi-field analyzers) at each
 * step.
 */
const fieldExistsInMapping = (properties, fieldPath) => {
  const parts = fieldPath.split('.')
  let current = properties

  for (const part of parts) {
    if (!current || !current[part]) return false
    const node = current[part]
    current = node.properties || node.fields || null
  }

  return true
}

const theThing = async () => {
  await loadConfig()

  const mappingProperties = await fetchMappingProperties()
  const configFields = extractConfigFields()

  // Identify config fields missing from the mapping (errors)
  const missingFields = configFields.filter((f) => !fieldExistsInMapping(mappingProperties, f))

  if (missingFields.length) {
    console.error(`\n${missingFields.length} field(s) referenced in config.js were NOT found in the ES mapping:`)
    missingFields.forEach((f) => console.error(`  - ${f}`))
    throw new Error('Mapping check failed: config references fields missing from the ES mapping.')
  }

  console.log(`\nAll ${configFields.length} field(s) from config.js verified in the ES mapping.`)
}

theThing()
