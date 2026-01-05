/**
 * @typedef {object} MarcRuleSubfieldSpec
 * @property {array<string>} subfields - Array of subfields to match for suppression
 * @property {string} directive - Indicates whether the matching subfields
 *                                should be "include"d or "exclude"d
 */
/**
 * @typedef {object} MarcRule
 * @property {string} fieldTag - Single character tag broadly classifying tag (e.g. 'y')
 * @property {string} marcIndicatorRegExp - Stringified regex for matching a
 *                    VarField tag joined to 1st and 2nd indicators
 * @property {MarcRuleSubfieldSpec} subfieldSpec - How to match subfields
 * @property {string} directive - Whether to include/exclude if matched.
 */

/**
 * @typedef {object} SubField
 * @property {string} tag - Identifying tag (e.g. '6', 'a')
 * @property {string} content - Value of subfield
 */

/**
 * @typedef {object} VarField
 *  * @property {string} marcTag - Three digit number classifying field (e.g. '100')
 * @property {string} fieldTag - Single character tag broadly classifying tag (e.g. 'y')
 * @property {string} content - Root level content (usually null/ignored)
 * @property {array<SubField>} subfields
 * @property {string|null} ind1 - First indicator character (space if blank)
 * @property {string|null} ind2 - Second indicator character (space if blank)
 */

/**
 * @typedef {object} SerializedBib
 * @property {string} id - Bib ID
 * @property {string} nyplSource - MARC source
 * @property {array<VarField>} varFields - Array of varFields after suppression
 */

/**
 * @typedef {object} SerializedMarc
 * @property {SerializedBib} bib - The serialized bib object containing varFields
 */

const { varFieldMatches, buildSourceWithMasking } = require('./marc-util')

class MarcSerializer {}

// Load rules
MarcSerializer.mappingRules = require('../data/annotated-marc-rules.json')
  .map((rule) => ({
    ...rule,
    marcIndicatorRegExp: new RegExp(rule.marcIndicatorRegExp)
  }))

/**
 * Returns true if a field matches a given MARC rule
 * @param {VarField} field - MARC field to test
 * @param {MarcRule} rule - Rule to match against
 * @returns {boolean}
 */
MarcSerializer.varFieldMatches = varFieldMatches

/**
 * Returns a copy of a varField with masked subfields according to the rule
 * @param {VarField} field - MARC field to mask
 * @param {MarcRule} rule - Rule defining subfields to mask
 * @returns {VarField} Masked field
 */
MarcSerializer.buildSourceWithMasking = buildSourceWithMasking
/**
 * Check if a field is the LEADER
 * @param {VarField} field - Field to check
 * @returns {boolean}
 */
MarcSerializer.isLeaderField = function (field) {
  return field.fieldTag === '_' && field.marcTag === null && typeof field.content === 'string'
}

MarcSerializer.describeField = function (field) {
  return `${field.marcTag}${field.ind1 || ' '}${field.ind2 || ' '}`
}

/**
 * Finds linked 880 fields (parallel scripts) for a given field
 * @param {Bib} bib - Bib object containing varFields
 * @param {VarField} varField - Field to find parallels for
 * @returns {Array<VarField>} Array of parallel 880 fields
 */
MarcSerializer.findParallelFields = function (bib, varField) {
  const linkNumbers = (varField.subfields || [])
    .filter((s) => s.tag === '6')
    .map((s) => s.content.replace(/^880-/, ''))

  if (!linkNumbers.length) return []

  return bib.varFields.filter((f) => {
    if (!f.subfields || f.marcTag !== '880') return false
    const fLinks = f.subfields
      .filter((s) => s.tag === '6')
      .map((s) => s.content)
    return fLinks.some((link) => linkNumbers.some((n) => link.indexOf(n) === 4))
  })
}

/**
 * Sorts varFields numerically by marcTag, with leader first
 * @param {Array<VarField>} fields
 * @returns {Array<VarField>}
 */
function sortVarFields (fields) {
  return fields.slice().sort((a, b) => {
    if (a.marcTag === null) return -1
    if (b.marcTag === null) return 1

    const tagA = parseInt(a.marcTag, 10)
    const tagB = parseInt(b.marcTag, 10)
    return tagA - tagB
  })
}

/**
 * Serializes a bib with excluded fields and redacted subfields
 * @param {Bib} bib - Bib to serialize
 * @returns {SerializedMarc} Serialized bib
 */
MarcSerializer.serialize = function (bib) {
  const suppressedVarFields = bib.varFields
    .map((field) => {
      // Pass leader through
      if (MarcSerializer.isLeaderField(field)) return field

      // Find matching rule
      const matchingRule = MarcSerializer.mappingRules.find((rule) =>
        MarcSerializer.varFieldMatches(field, rule)
      )

      // If no rule, leave as is
      if (!matchingRule) return field

      // Handle field-level exclusion
      if (matchingRule.directive === 'exclude') {
        return null
      }

      // Mask field according to rule (handles subfield-level include/exclude)
      const maskedField = MarcSerializer.buildSourceWithMasking(field, matchingRule)

      // Handle parallel 880 fields
      const parallels = MarcSerializer.findParallelFields(bib, field)
      parallels.forEach((p) => {
        Object.assign(p, MarcSerializer.buildSourceWithMasking(p, matchingRule))
      })

      return maskedField
    })
    // Remove any nulls from excluded fields
    .filter(Boolean)

  return {
    bib: {
      id: bib.id,
      nyplSource: bib.nyplSource,
      varFields: sortVarFields(suppressedVarFields)
    }
  }
}

module.exports = MarcSerializer
