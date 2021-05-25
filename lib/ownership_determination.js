const NyplSourceMapper = require('discovery-store-models/lib/nypl-source-mapper')

// This is based on uri now but should be changed to use the 'item.owner' field once it's more reliably serialized.
// This just talks about ownership, not recap vs non-recap
let isItemNyplOwned = (item) => {
  const { nyplSource } = NyplSourceMapper.instance().splitIdentifier(item.uri)
  return nyplSource === 'sierra-nypl'
}

module.exports = {isItemNyplOwned}
