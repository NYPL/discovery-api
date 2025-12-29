const arrayUnique = require('./util').arrayUnique

class MarcSerializer {}

// Load rules from disc serialization:
MarcSerializer.mappingRules = require('../data/annotated-marc-rules.json')
  .map((rule) => ({
    ...rule,
    marcIndicatorRegExp: new RegExp(rule.marcIndicatorRegExp)
  }))

MarcSerializer.orderedFieldTags = arrayUnique(
  MarcSerializer.mappingRules.map((rule) => rule.fieldTag)
)

/**
 * Given a Sierra MARC document, returns an array of varField blocks matching
 * the given rule
 */
MarcSerializer.matchingMarcFields = function (bib, rule) {
  return bib.varFields.filter((field) =>
    MarcSerializer.varFieldMatches(field, rule)
  )
}

/**
 * Given a {VarField} and a {AnnotatedMarcRule}, returns true if matched.
 */
MarcSerializer.varFieldMatches = function (field, rule) {
  const indicator = `${field.marcTag}${field.ind1 || ' '}${field.ind2 || ' '}`
  return (
    rule.fieldTag === field.fieldTag &&
    rule.marcIndicatorRegExp.test(indicator)
  )
}
/**
 *  Given a varField, returns a copy with any hidden subfield content replaced
 *  with '[redacted]' based on given rule
 */
MarcSerializer.buildSourceWithMasking = function (field, rule) {
  return {
    ...field,
    subfields: (field.subfields || []).map((subfield) => {
      let content = subfield.content

      if (
        (rule.subfieldSpec.directive === 'include' &&
          !rule.subfieldSpec.subfields.includes(subfield.tag)) ||
        (rule.subfieldSpec.directive === 'exclude' &&
          rule.subfieldSpec.subfields.includes(subfield.tag))
      ) {
        content = '[redacted]'
      }

      return { ...subfield, content }
    })
  }
}

/**
 * Given a varfield block, returns a structured annotated match
 */
MarcSerializer.formatVarFieldMatch = function (matchingVarField, rule) {
  const matchedSubfields = (matchingVarField.subfields || []).filter(
    (subfield) => {
      if (!rule.subfieldSpec) return false

      if (rule.subfieldSpec.directive === 'exclude') {
        return !rule.subfieldSpec.subfields.includes(subfield.tag)
      }

      return rule.subfieldSpec.subfields.includes(subfield.tag)
    }
  )

  if (!matchedSubfields.length) return null

  return {
    label: rule.label,
    marcTag: matchingVarField.marcTag,
    fieldTag: matchingVarField.fieldTag,
    indicators: [
      matchingVarField.ind1 || ' ',
      matchingVarField.ind2 || ' '
    ],
    subfields: matchedSubfields,
    source: MarcSerializer.buildSourceWithMasking(
      matchingVarField,
      rule
    )
  }
}

/**
 * Given an array of varfield blocks and a rule,
 * returns structured matches
 */
MarcSerializer.formatVarFieldMatches = function (
  matchingVarFields,
  rule
) {
  return matchingVarFields
    .map((field) =>
      MarcSerializer.formatVarFieldMatch(field, rule)
    )
    .filter(Boolean)
}

/**
 * Given a document, a rule, and an array of values, adds them to doc
 */
MarcSerializer.addStatementsToDoc = function (doc, rule, values) {
  const fields = doc[rule.fieldTag]
  const last = fields[fields.length - 1]

  if (last && last.label === rule.label) {
    last.values = last.values.concat(values)
  } else {
    fields.push({
      label: rule.label,
      values
    })
  }

  return doc
}

/**
 *  Given a doc and a matching rule, writes statement to doc for given varField
 *
 *  @param {object} doc - The plainobject doc to write to
 *  @param {Bib} bib - Bib document (for use in looking up parallel fields)
 *  @param {VarField} varField - VarField from which to extract content.
 *  @param {MarcRule} rule - Rule to apply when extracting content
 *                                    (and looking up parallel fields)
 *
 */
MarcSerializer.addStatementsForVarFieldForRule = function (
  doc,
  bib,
  varField,
  rule
) {
  const content = MarcSerializer.formatVarFieldMatch(
    varField,
    rule
  )

  if (content) {
    MarcSerializer.addStatementsToDoc(doc, rule, [content])
  }

  const parallelNumbers = (varField.subfields || [])
    .filter((s) => s.tag === '6')
    .map((s) => s.content.replace(/^880-/, ''))

  if (parallelNumbers.length > 0) {
    const matchingParallels = MarcSerializer.matchingMarcFields(
      bib,
      { ...rule, fieldTag: 'y', marcIndicatorRegExp: /^880/ }
    )
      .map((vf) => ({
        field: vf,
        linkingValue: (vf.subfields || [])
          .filter((s) => s.tag === '6')
          .map((s) => s.content)
          .pop()
      }))
      .filter((p) =>
        parallelNumbers.some(
          (n) => p.linkingValue?.indexOf(n) === 4
        )
      )
      .map((p) => p.field)

    if (matchingParallels.length) {
      const parallelLabel = `Alternate Script for ${rule.label}`
      const parallelContent =
        MarcSerializer.formatVarFieldMatches(
          matchingParallels,
          rule
        )

      MarcSerializer.addStatementsToDoc(
        doc,
        { ...rule, label: parallelLabel },
        parallelContent.map((v) => ({ ...v, isParallel: true }))
      )
    }
  }

  return doc
}

/**
 * Rule setup
 */
MarcSerializer.setRules = function (rules) {
  MarcSerializer.mappingRules = rules
}

MarcSerializer.initialStateObjectForSerialization = function () {
  return MarcSerializer.orderedFieldTags.reduce((acc, tag) => {
    acc[tag] = []
    return acc
  }, {})
}

MarcSerializer.setRules(MarcSerializer.mappingRules)

MarcSerializer.serialize = function (bib) {
  const doc = bib.varFields.reduce((doc, field) => {
    let foundMatch = false

    MarcSerializer.mappingRules.forEach((rule) => {
      if (!foundMatch && MarcSerializer.varFieldMatches(field, rule)) {
        if (rule.directive === 'include') {
          MarcSerializer.addStatementsForVarFieldForRule(
            doc,
            bib,
            field,
            rule
          )
        }
        foundMatch = true
      }
    })

    return doc
  }, MarcSerializer.initialStateObjectForSerialization())

  return {
    bib: {
      unserialized: bib,
      id: bib.id,
      nyplSource: bib.nyplSource,
      fields: Object.values(doc).flat()
    }
  }
}

module.exports = MarcSerializer
