module.exports = (elasticSearchResponse) => {
  elasticSearchResponse.hits.hits.forEach((bib) => {
    if (bib._source.parallelDisplayField) {
      bib._source.parallelDisplayField.forEach((field) => {
        const capitalizedFieldName = field.fieldName.charAt(0).toUpperCase() + field.fieldName.slice(1)
        bib._source[`parallel${capitalizedFieldName}`] = []
        bib._source[`parallel${capitalizedFieldName}`][field.index] = field['@value']
      })
      delete bib._source.parallelDisplayField
    }
    return bib
  })
  return elasticSearchResponse
}
