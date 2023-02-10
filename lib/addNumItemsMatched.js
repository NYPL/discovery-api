const util = require('../lib/util')

const addNumItemsMatched = (resp, request) => {
  if (util.checkForNestedHitsAndSource(resp)) {
    const theBib = resp.hits.hits[0]
    // are there electronic items
    const hasElectronicResources = theBib._source.numElectronicResources[0] > 0
    // if there are electronic resources, we may need to decrement numItemsMatched
    let requestDoesNotHaveItemFilters
    let itemFormatQueryMatchesBibMaterialType
    if (hasElectronicResources) {
      const propertiesToTest = ['item_location', 'item_status', 'item_year', 'item_format']
      // if there are no item filters, we need to decrement
      requestDoesNotHaveItemFilters = !propertiesToTest.some((param) => { return param in request.params })
      // if item_format of electronic resource item matches bib material type, we need to decrement
      const bibMaterialType = theBib._source.materialType[0].label
      itemFormatQueryMatchesBibMaterialType = request.params.item_format === bibMaterialType
    }
    resp.hits.hits[0]._source.numItemsMatched = [theBib.inner_hits.items.hits.total]
    if (itemFormatQueryMatchesBibMaterialType || requestDoesNotHaveItemFilters) --theBib._source.numItemsMatched
  }
  return resp
}
module.exports = addNumItemsMatched
