const { isAeonUrl, sortOnPropWithUndefinedLast } = require('../lib/util')

class ElasticSearchResponse {
  constructor (response, sortOnEnumerationChronology) {
    this.response = response
    this.sortOnEnumerationChronology = sortOnEnumerationChronology
  }

  get _rawBibs () {
    return this.response.hits?.hits?._source
  }

  get bibs () {
    const bibs = this._rawBibs.map(this.addItemsToBib)

    delete bibs.inner_hits
  }

  addItemsToBib (hit) {
    const bib = hit._source
    bib.items = hit.inner_hits.items.hits.hits.map((itemHit) => itemHit._source)
    if (this.sortOnEnumerationChronology) {
      bib.items.sort(sortOnPropWithUndefinedLast('enumerationChronology_sort'))
    }
    bib.numItemsMatched = [hit.inner_hits.items.hits.total.value]
    const unfilteredItems = (hit.inner_hits.allItems || hit.inner_hits.items)
    bib.numItemsTotal = [unfilteredItems.hits.total.value]
    return bib
  }

  processElectronicResourceInnerHits (hit) {
    if (hit?.inner_hits?.electronicResources) {
      // If record doesn't have indexed electronicResources...
      if (!hit._source.electronicResources || hit._source.electronicResources.length === 0) {
        // Gather up all records in the electronicResources inner_hit,
        // collect all of the electronicLocator values
        // and save the resulting array to .electronicResources:
        hit._source.electronicResources = hit.inner_hits.electronicResources.hits.hits
          .map((resource) => resource._source.electronicLocator)
          .reduce((acc, el) => acc.concat(el), [])
          .filter((resource) => !isAeonUrl(resource.url))
        hit._source.numElectronicResources = [hit._source.electronicResources.length]
      }
    }
  }
}

module.exports = ElasticSearchResponse
