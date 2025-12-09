/**
 * Given a range represented as an array, returns a corresponding ES range object
 *
 * @param {Array.<string>} range - An array consisting of a single date or a pair of dates
 * @returns {object}
 */
const esRangeValue = (range) => {
  // the greater-than-equal value will always be the first value in the range array.
  // depending on the number of values and their equality, we query using less-than-equal
  // the second value, or just less-than the first value plus one

  // Treat case where range start equals range end same as case of single value:
  if (range[0] === range[1]) range = range.slice(0, 1)
  const rangeQuery = {
    gte: range[0]
  }
  if (range.length === 2) {
    // search on both range values
    rangeQuery.lte = range[range.length - 1]
  } else if (range.length === 1) {
    // if there is just one range, query up until the next year
    rangeQuery.lt = range[0] + 1
  }
  return rangeQuery
}

module.exports = {
  esRangeValue
}
