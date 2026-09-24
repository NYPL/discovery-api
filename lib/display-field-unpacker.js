// name+title is used for search links, name for browse links, label for full display
const toDisplayField = ({ name, title, label }) => ({
  displayLabel: label,
  name,
  nameTitle: title ? `${name} ${title}` : name
})

module.exports = (elasticSearchResponse) => {
  elasticSearchResponse.hits.hits.forEach((bib) => {
    Object.entries(bib._source).forEach(([key, value]) => {
      if (key.endsWith('_displayComponents')) {
        const fieldName = key.replace('_displayComponents', '')
        bib._source[fieldName + 'Display'] = value.map(toDisplayField)
        delete bib._source[key]
      }
    })

    return bib
  })
  return elasticSearchResponse
}
