const elasticsearch = require('@elastic/elasticsearch')
const url = require('node:url')
const { deepValue } = require('./util')
const logger = require('./logger')

const clientWrapper = {}

/**
 * Get an ES base client
 */
clientWrapper.esClient = function () {
  if (!this._esClient) {
    // Parse ES connection string:
    const { protocol, auth, host, port } = url.parse(process.env.ELASTICSEARCH_URI)
    const [ username, password ] = auth ? auth.split(':') : []
    const options = {
      node: `${protocol}//${host}`,
      port,
      auth: { username, password }
    }
    logger.debug(`Connecting to ES at ${host}:${port} ${username && password ? 'with creds' : 'w/out creds'}`)
    this._esClient = new elasticsearch.Client(options)
  }
  return this._esClient
}.bind(clientWrapper)

/**
 *  Given an es request body (typically including a `query` property), queries
 *  the configured ES
 */
clientWrapper.search = function (body) {
  logger.debug(`Performing ES search: ${JSON.stringify(body)}`)
  return this.esClient().search({
    index: process.env.RESOURCES_INDEX,
    body
  })
}.bind(clientWrapper)

/**
 *  Given a bnum, returns item statuses as an array of ES aggregation buckets
 */
clientWrapper.nonRecapItemStatusAggregation = (bnum) => {
  const esQuery = {
    size: 0,
    query: { bool: { must: [ { term: {
      uri: bnum
    } } ] } },
    _source: { includes: [ 'uri' ] },
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
