module.exports = (elasticSearchResponse) => {
  elasticSearchResponse.hits.hits.forEach((bib) => {
    // Because front-end expects a certain format, let's transform parallelNote
    // objects into just their label for now:
    if (bib._source.parallelNote) {
      bib._source.parallelNote = bib._source.parallelNote.map((note) => {
        if (!note?.label) {
          return null
        } else {
          return note.label
        }
      })
    }

    if (bib._source.parallelDisplayField) {
      bib._source.parallelDisplayField.forEach((field) => {
        const capitalizedFieldName = field.fieldName.charAt(0).toUpperCase() + field.fieldName.slice(1)
        bib._source[`parallel${capitalizedFieldName}`] = []
        bib._source[`parallel${capitalizedFieldName}`][field.index] = field.value
      })
      delete bib._source.parallelDisplayField
    }
    return bib
  })
  return elasticSearchResponse
}
