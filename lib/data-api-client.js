let nyplDataApiClient = null

function makeNyplDataApiClient () {
  if (!nyplDataApiClient) {
    const NyplClient = require('@nypl/nypl-data-api-client')

    nyplDataApiClient = new NyplClient({
      base_url: process.env.NYPL_API_BASE_URL,
      oauth_key: process.env.NYPL_OAUTH_ID,
      oauth_secret: process.env.NYPL_OAUTH_SECRET,
      oauth_url: process.env.NYPL_OAUTH_URL
    })
  }
  return nyplDataApiClient
}

module.exports = { makeNyplDataApiClient }
