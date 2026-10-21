exports.doNyqlQueryForLinkedEntry = async (uri, linkedEntryObject, mismatchedIndex = false) => {
  console.log(`nyql query for ${uri}`)
  if (mismatchedIndex) console.log('indicate that data may be stale')
}
