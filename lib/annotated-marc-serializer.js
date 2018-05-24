// Load rules form disc serialization:
const mappingRules = require('../data/annotated-marc-rules.json')
  .map((rule) => {
    return Object.assign({}, rule, {
      marcIndicatorRegExp: new RegExp(rule.marcIndicatorRegExp)
    })
  })

class AnnotatedMarcSerializer {
}

/**
 * Given the raw source of a webpub.def file, returns an array of usable
 * rules that relate field labels to marc queries.
 */
AnnotatedMarcSerializer.parseWebpubToAnnotatedMarcRules = function (webpubContent) {
  const mappingRules = webpubContent.split(/\n/)
    .map((line) => line.trim())
    // Make sure line has content (after removing # comments)
    .filter((line) => line && line.replace(/\s*#.*/, ''))
    // Convert to columns:
    .map((line) => line.split('|'))
    // Convert to named columns:
    .map((line) => {
      return {
        fieldGroupTag: line[1],
        marcIndicatorPattern: line[2],
        subfields: line[3],
        label: line[4]
      }
    })
    // Make sure there's some marcTag pattern & label:
    .filter((line) => line.marcIndicatorPattern && line.label)
    .map((line) => {
      // Raw examples:
      // b|s|8..|-6|Series||b|
      // b|r|310|-6|Current Frequency||b|
      // b|y|8[^5].|u|||b|

      let subfields = Array.from(line.subfields)
      let subfieldSpec = { subfields, directive: 'include' }
      if (subfields[0] === '-') subfieldSpec = { subfields: subfields.slice(1), directive: 'exclude' }

      return {
        fieldGroupTag: line.fieldGroupTag,
        marcIndicatorRegExp: new RegExp('^' + line.marcIndicatorPattern),
        subfieldSpec,
        label: line.label
      }
    })

  return mappingRules
}

AnnotatedMarcSerializer.buildAnnotatedMarcRules = function (webpubContent, bibRecordIndexRulesContent) {
  return AnnotatedMarcSerializer.parseWebpubToAnnotatedMarcRules(webpubContent)
}

/**
 * Given a sierra marc document, returns an array of varField bocks matching
 * the given rule
 */
AnnotatedMarcSerializer.matchingMarcFields = function (bib, rule) {
  return bib.varFields
    .filter((field) => {
      const fieldMarcIndicator = `${field.marcTag}${field.ind1 || ' '}${field.ind2 || ' '}`
      return rule.marcIndicatorRegExp.test(fieldMarcIndicator) &&
        rule.fieldGroupTag === field.fieldTag
    })
}

/**
 *  Given a varField, returns a copy with any hidden subfield content replaced
 *  with "[redacted]" based on given rule
 */
AnnotatedMarcSerializer.buildSourceWithMasking = function (field, rule) {
  return Object.assign({}, field, {
    subfields: field.subfields
      .map((subfield) => {
        let subfieldContent = subfield.content
        // If directive is 'include' and subfield not included
        // .. or directive is 'exclude', but subfield included,
        // [redact] it:
        if ((rule.subfieldSpec.directive === 'include' && rule.subfieldSpec.subfields.indexOf(subfield.tag) < 0) ||
            (rule.subfieldSpec.directive === 'exclude' && rule.subfieldSpec.subfields.indexOf(subfield.tag) >= 0)) {
          subfieldContent = '[redacted]'
        }
        return Object.assign({}, subfield, { content: subfieldContent })
      })
  })
}

/**
 *  Given an varfield block (presumably matching the given rule), returns
 *  an object representing the match.
 */
AnnotatedMarcSerializer.formatVarFieldMatch = function (matchingVarField, rule) {
  const matchedSubfields = (matchingVarField.subfields || []).filter((subfield) => {
    // If rule includes a subfields directive
    if (rule.subfieldSpec) {
      // Is subfields directive exclusionary? Remove matching:
      if (rule.subfieldSpec.directive === 'exclude') return rule.subfieldSpec.subfields.indexOf(subfield.tag) < 0
      // ..Otherwise keep matching:
      else return rule.subfieldSpec.subfields.indexOf(subfield.tag) >= 0
    }
  })
  const content = matchingVarField.content || matchedSubfields.map((f) => f.content).join(' ')

  // Collect other field values apart from primary value:
  const additionalFields = {}

  // For Url mapped blocks, extract label:
  if (rule.label === 'Url') {
    const labelSubfields = ['z']
    additionalFields.label = (matchingVarField.subfields || [])
      .filter((s) => labelSubfields.indexOf(s.tag) >= 0)
      .map((s) => s.content)
      .join(' ')
    // If no label found, use URL
    if (!additionalFields.label) additionalFields.label = content
  }

  // Include source field with masked subfields:
  const source = AnnotatedMarcSerializer.buildSourceWithMasking(matchingVarField, rule)

  return Object.assign(additionalFields, { content, source })
}

/**
 *  Given an array of varfield blocks and a annotated-marc rule
 *  returns an array of objects with `content` and `source` properties
 */
AnnotatedMarcSerializer.formatVarFieldMatches = function (matchingVarFields, rule) {
  return matchingVarFields.map((field) => AnnotatedMarcSerializer.formatVarFieldMatch(field, rule))
}

AnnotatedMarcSerializer.addStatementsToDoc = function (doc, label, values) {
  if (!doc[label]) doc[label] = []

  // Multiple rules may write to one label, so concat:
  doc[label] = doc[label].concat(values)

  return doc
}

AnnotatedMarcSerializer.addStatementsForRule = function (doc, bib, rule) {
  // Get bib varfields matching marc rule:
  const matchingVarFields = AnnotatedMarcSerializer.matchingMarcFields(bib, rule)

  // Add statements to doc:
  if (matchingVarFields.length > 0) {
    const content = AnnotatedMarcSerializer.formatVarFieldMatches(matchingVarFields, rule)
    doc = AnnotatedMarcSerializer.addStatementsToDoc(doc, rule.label, content)

    matchingVarFields.forEach((varField) => {
      const parallelNumbers = varField.subfields
        .filter((s) => s.tag === '6')
        .map((s) => s.content.replace(/^880-/, ''))

      if (parallelNumbers.length > 0) {
        // Get parallel varfields:
        const matchingParallels = AnnotatedMarcSerializer.matchingMarcFields(bib, Object.assign({}, rule, { fieldGroupTag: 'y', marcIndicatorRegExp: /^880/ }))
          .map((varField) => {
            return {
              field: varField,
              linkingValue: (varField.subfields.filter((s) => s.tag === '6') || [])
                .map((linkingSubfield) => linkingSubfield.content)
                .pop()
            }
          })
          .filter((parallel) => parallelNumbers.some((parallelNumber) => parallel.linkingValue.indexOf(parallelNumber) === 4))
          .map((parallel) => parallel.field)

        if (matchingParallels.length > 0) {
          const parallelLabel = `Parallel ${rule.label}`
          const parallelContent = AnnotatedMarcSerializer.formatVarFieldMatches(matchingParallels, rule)
          doc = AnnotatedMarcSerializer.addStatementsToDoc(doc, parallelLabel, parallelContent)
        }
      }
    })
  }

  return doc
}

/**
 *
 * Given a SierraMarc bib document, returns a new document that presents
 * fields queried via data/annotated-marc-rules.json, grouped by label,
 * and including the marc source - with hidden subfield values redacted.
 *
 * Returns an object resembling:
 *
 *  {
 *    bib: {
 *      fields: [
 *        {
 *          label: "Title",
 *          values: [
 *            {
 *              content: "Time is a flat circle",
 *              source: { ... }
 *            }
 *          ]
 *        }
 *      ]
 *    }
 *  }
 */
AnnotatedMarcSerializer.serialize = function (bib) {
  // Build an object where keys are field labels and values are matches
  const doc = mappingRules.reduce((doc, rule) => {
    return AnnotatedMarcSerializer.addStatementsForRule(doc, bib, rule)
  }, {})

  // Get doc sorted by keys:
  const sortedDoc = Object.keys(doc)
    .sort()
    .reduce((sortedDoc, key) => {
      sortedDoc[key] = doc[key]
      return sortedDoc
    }, {})

  // Format for return to client:
  return {
    bib: {
      id: bib.id,
      nyplSource: bib.nyplSource,
      fields: Object.keys(sortedDoc)
        .map((label) => {
          return {
            label: label,
            values: sortedDoc[label]
          }
        })
    }
  }
}

module.exports = AnnotatedMarcSerializer
