module.exports = (elasticSearchResponse) => {
  const updatedHits = elasticSearchResponse.hits.hits.map((bib) => {
    if (bib._source.parallelDisplayField) {
      for (let field of bib._source.parallelDisplayField) {
        const capitalizedFieldName = field.fieldName.charAt(0).toUpperCase() + field.fieldName.slice(1)
        bib._source[`parallel${capitalizedFieldName}`] = [field['@value']]
      }
      delete bib._source.parallelDisplayField
    }
    return bib
  })
  elasticSearchResponse.hits.hits = updatedHits
  return elasticSearchResponse
}
