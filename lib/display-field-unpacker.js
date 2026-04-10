const parseValueAndLabel = (delimitedString) => {
  if (!delimitedString.includes('||')) {
    return { value: delimitedString, display: null }
  }
  const [value, display] = delimitedString.split('||')
  return { value, display }
}

module.exports = (elasticSearchResponse) => {
  elasticSearchResponse.hits.hits.forEach((bib) => {
    // Contributors and creators are packed like so <name>||<display label> where <display label>
    // can have prefix, title, and roles. We'd like to unpack them in a friendly format for the frontend
    // to display the full label and use the isolated name for link-building
    Object.entries(bib._source).forEach(([key, value]) => {
      if (key.endsWith('_displayPacked')) {
        const fieldName = key.replace('_displayPacked', '')
        bib._source[fieldName + 'Display'] = value.map((packedValue) => parseValueAndLabel(packedValue))
        delete bib._source[key]
      }
    })

    return bib
  })
  return elasticSearchResponse
}
