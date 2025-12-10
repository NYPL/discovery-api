const Item = require('./models/item')

class RequestabilityResolver {
  static fixItemRequestability (elasticSearchResponse) {
    elasticSearchResponse.hits.hits
      .forEach((hit) => {
        hit._source.items = hit._source.items.map(function (item) {
          const itemModel = new Item(item)
          return { ...item, eddRequestable: itemModel.eddRequestable, physRequestable: itemModel.physRequestable, specRequestable: itemModel.specRequestable, requestable: itemModel.requestable }
        })
      })
    return elasticSearchResponse
  }
}

module.exports = RequestabilityResolver
