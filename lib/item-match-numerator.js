const util = require('./util')

const addNumItemsMatched = (resp, request, electronicResourcesAlreadyRemoved = false) => {
  if (util.checkForNestedHitsAndSource(resp)) {
    const theBib = resp.hits.hits[0]
    // are there electronic items
    const hasElectronicResources = theBib._source.numElectronicResources && theBib._source.numElectronicResources[0] > 0 && !electronicResourcesAlreadyRemoved
    // if there are electronic resources, we may need to decrement numItemsMatched
    let numItemsMatched = theBib.inner_hits.items.hits.total
    if (hasElectronicResources) {
      const bibMaterialType = theBib._source.materialType && theBib._source.materialType.length ? theBib._source.materialType[0].label : false
      const itemFormatQueryMatchesBibMaterialType = request.query.item_format && request.query.item_format.includes(bibMaterialType)
      const propertiesToTest = ['item_location', 'item_status', 'item_year']
      // if the item format matches, we don't want to include it in requestHasItemFilters. if there are other filters,
      // even if the format matches, the other filters will filter out an e item because they don't have status, year,
      // location fields
      if (!itemFormatQueryMatchesBibMaterialType) propertiesToTest.push('item_format')
      // if there are no item filters, we need to decrement
      const requestHasItemFilters = propertiesToTest.some((param) => { return param in request.query })
      // if item_format of electronic resource item matches bib material type, we need to decrement
      const itemFormatMatchesBibAndFilterIsOnlyFormat = itemFormatQueryMatchesBibMaterialType && !requestHasItemFilters
      if (itemFormatMatchesBibAndFilterIsOnlyFormat || !requestHasItemFilters) numItemsMatched -= 1
    }
    resp.hits.hits[0]._source.numItemsMatched = [numItemsMatched]
  }
  return resp
}
module.exports = addNumItemsMatched
