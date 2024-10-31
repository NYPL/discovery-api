// NYPL item ids start with an 'i'
const NYPL_ITEM_ID_PATTERN = /^i/

const isItemNyplOwned = (item) => {
  return NYPL_ITEM_ID_PATTERN.test(item?.uri)
}

module.exports = { isItemNyplOwned }
