exports.doNyqlQueryForLinkedEntry = async (uri, linkedEntryObject, mismatchedIndex = false) => {
  console.log(`nyql query for ${uri}`)
  const response = { message: `nyql query`}
  if (mismatchedIndex) response.potentiallyStaleData = true
  return response
}
