const { getLinkedEntryForUri } = require('./elasticsearch/client')
const logger = require('./logger')
const { NotFoundError } = require('./errors')

const doNyqlQueryForLinkedEntry = async (uri, linkedEntryObject, mismatchedIndex = false) => {
  console.log(`nyql query for ${uri}`)
  const response = { message: 'nyql query' }
  if (mismatchedIndex) response.potentiallyStaleData = true
  return response
}

exports.theThing = async (params) => {
  const response = await getLinkedEntryForUri(params.uri)
  const hashMatches = params.hash === response.hash
  const marcTagMatches = params.marcTag === response.marcTag
  const indexMatches = params.marcTagIndex === response.marcTagIndex
  if (hashMatches && marcTagMatches && indexMatches) {
    logger.debug('successful match')
    return await doNyqlQueryForLinkedEntry(params.uri, response)
  } else if (marcTagMatches && hashMatches && !indexMatches) {
    logger.debug('Mismatched marc tag index in linked entry url and live indexed bib data')
    logger.debug(params.marcTag, params.marcTagIndex)
    logger.debug(response.marcTag, response.marcTagIndex)
    return await doNyqlQueryForLinkedEntry(params.uri, response, !indexMatches)
  } else {
    throw new NotFoundError('Linking entry link is incorrect/out of date.')
  }
}
