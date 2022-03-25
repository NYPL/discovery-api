module.exports = (elasticSearchResponse) => {
  const updatedHits = elasticSearchResponse.hits.hits.map((bib) => {
    if (bib.parallelDisplayField) {
      for (let field in bib.parallelDisplayField) {
        bib[`parallel${field.fieldName}`] = field['@value']
      }
    }
    return bib
  })
  elasticSearchResponse.hits.hits = updatedHits
  return elasticSearchResponse
}
