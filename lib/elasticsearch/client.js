const elasticsearch = require('@elastic/elasticsearch')
const url = require('node:url')
const { deepValue } = require('../util')
const logger = require('../logger')
const { IndexConnectionError, IndexSearchError } = require('../errors')

const clientWrapper = {}

/**
 * Get an ES base client
 */
clientWrapper.esClient = function () {
  if (!this._esClient) {
    // Parse ES connection string, which is likely multiple http base URIs
    // separated by a comma:
    const elasticUris = process.env.ELASTICSEARCH_URI.split(',')
    const urisParsed = elasticUris.map((uri) => {
      // Extract parts of the URI:
      const { protocol, auth, host } = url.parse(uri)
      const [username, password] = auth ? auth.split(':') : []
      return {
        protocol,
        host,
        username,
        password
      }
    })
    // Build ES client connection config:
    const config = {}
    config.nodes = urisParsed.map((uri) => `${uri.protocol}//${uri.host}`)

    // Configure auth:
    if (process.env.ELASTICSEARCH_API_KEY) {
      // Auth with `apiKey`:
      config.auth = { apiKey: process.env.ELASTICSEARCH_API_KEY }
    } else if (urisParsed[0].username) {
      // Auth with username, password:
      config.auth = { username: urisParsed[0].username, password: urisParsed[0].password }
    }

    // Log out some of the connection details for debugging purposes:
    const authMethod = urisParsed[0].username ? 'with creds' : (process.env.ELASTICSEARCH_API_KEY ? 'with apiKey' : 'w/out creds')
    logger.info(`Connecting to ES at ${urisParsed.map((u) => u.host).join(',')} ${authMethod}`)

    this._esClient = new elasticsearch.Client(config)
  }
  return this._esClient
}.bind(clientWrapper)

/**
 *  Given an es request body (typically including a `query` property), queries
 *  the configured ES
 */
clientWrapper.search = function (body, index = process.env.RESOURCES_INDEX) {
  logger.debug(`Performing ES search: ${JSON.stringify(body, null, 2)}`)
  return this.esClient().search({
    index,
    body
  })
    .catch((e) => {
      // Collect failure types (to detect parsing error):
      const failureTypes = e.body?.error?.failed_shards
        ?.map((failure) => failure?.reason?.caused_by?.type) || []

      if (e.statusCode === 403) {
        logger.error(`Error connecting to index: ${e.statusCode}: ${JSON.stringify(e.body)}`)
        throw new IndexConnectionError('Error connecting to index')
      } else if (
        e.statusCode === 400 &&
        e.body?.error?.type === 'search_phase_execution_exception' &&
        failureTypes.includes('parse_exception')
      ) {
        // This kind of error appears to indicate structural problems in the
        // user's query, which we should specially handle downstream:
        throw new IndexSearchError('Error parsing user query')
      }

      throw e
    })
}.bind(clientWrapper)

/**
 *  Query ES for multiple queries at once
 */
clientWrapper.msearch = function (queries) {
  const payload = {
    searches: queries.map((query) => {
      return [
        { index: process.env.RESOURCES_INDEX },
        query
      ]
    }).flat()
  }
  logger.debug(`Performing ES msearch: ${JSON.stringify(payload, null, 2)}`)
  return this.esClient().msearch(payload)
    .catch((e) => {
      if (e.statusCode === 403) {
        logger.error(`Error connecting to index: ${e.statusCode}: ${JSON.stringify(e.body)}`)
        throw new IndexConnectionError('Error connecting to index')
      }

      throw e
    })
}.bind(clientWrapper)

/**
 *  Given a bnum, returns item statuses as an array of ES aggregation buckets
 */
clientWrapper.nonRecapItemStatusAggregation = (bnum) => {
  const esQuery = {
    size: 0,
    query: {
      bool: {
        must: [{
          term: {
            uri: bnum
          }
        }]
      }
    },
    _source: { includes: ['uri'] },
    aggs: {
      statuses: {
        nested: {
          path: 'items'
        },
        aggs: {
          nonrecap_statuses: {
            filter: {
              bool: {
                must_not: {
                  regexp: {
                    'items.holdingLocation.id': 'loc:rc.*'
                  }
                }
              }
            },
            aggs: {
              nonrecap_status_buckets: {
                terms: {
                  size: 100,
                  field: 'items.status_packed'
                }
              }
            }
          }
        }
      }
    }
  }

  return clientWrapper.search(esQuery)
    .then((resp) => {
      return deepValue(resp, 'aggregations.statuses.nonrecap_statuses.nonrecap_status_buckets.buckets')
    })
}

module.exports = clientWrapper
