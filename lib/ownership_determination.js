// This is based on uri now but should be changed to use the 'item.owner' field once it's more reliably serialized.
// This just talks about ownership, not recap vs non-recap
let isItemNyplOwned = (item) => {
  let match = item.uri.match(/^(\w?)i(.*)$/)
  if (match && match.length === 3) {
    let parnerPrefixes = ['c', 'p']
    return !(parnerPrefixes.indexOf(match[1]) >= 0)
  } else {
    return false
  }
}

module.exports = {isItemNyplOwned}
