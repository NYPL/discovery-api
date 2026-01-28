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
 * @property {array<VarField>} fields - Array of varFields after suppression
 */

/**
 * @typedef {object} SerializedMarc
 * @property {SerializedBib} bib - The serialized bib object containing varFields
 */

const { varFieldMatches } = require('./marc-util')

class MarcSerializer {}

// Load rules
MarcSerializer.mappingRules = require('../data/marc-rules.json')
  .map((rule) => {
    return Object.assign({}, rule, {
      marcIndicatorRegExp: new RegExp(rule.marcIndicatorRegExp)
    })
  })

/**
 * Returns true if a field matches a given MARC rule
 * @param {VarField} field - MARC field to test
 * @param {MarcRule} rule - Rule to match against
 * @returns {boolean}
 */
MarcSerializer.varFieldMatches = varFieldMatches

MarcSerializer.describeField = function (field) {
  return `${field.marcTag}${field.ind1 || ' '}${field.ind2 || ' '}`
}

/**
 * Finds linked 880 fields (parallel scripts) for a given field
 * @param {Bib} bib - Bib object containing varFields
 * @param {VarField} sourceField - Field to find parallels for
 * @returns {Array<VarField>} Array of parallel 880 fields
 */
MarcSerializer.findParallelFields = function (bib, sourceField) {
  const linkNumbers = extractLinkingNumbers(sourceField)
  if (linkNumbers.length === 0) return []

  return bib.varFields.filter((field) =>
    isLinked880Field(field, linkNumbers)
  )
}

/**
 * Extracts linking numbers from subfield 6, removing the 880- prefix
 */
function extractLinkingNumbers (varField) {
  return (varField.subfields || [])
    // Is a MARC linking subfield ($6)?
    .filter((subfield) => subfield.tag === '6')
    .map((subfield) => subfield.content.replace(/^880-/, ''))
}

/**
 * Determines whether a field is an 880 field linked to any of the given numbers
 */
function isLinked880Field (field, linkNumbers) {
  if (field.marcTag !== '880' || !field.subfields) return false

  const fieldLinks = field.subfields
    // Is a MARC linking subfield ($6)?
    .filter((subfield) => subfield.tag === '6')
    .map((subfield) => subfield.content)

  return fieldLinks.some((link) =>
    linkNumbers.some((linkNumber) => isMatchingLink(link, linkNumber))
  )
}

/**
 * Checks whether a link contains the link number at position 4
 */
function isMatchingLink (link, linkNumber) {
  return link.indexOf(linkNumber) === 4
}

/**
 * Serializes a bib with excluded fields
 * @param {Bib} bib - Bib to serialize
 * @returns {SerializedMarc} Serialized bib
 */
MarcSerializer.serialize = function (bib) {
  // Keep track of 880 parallels to exclude
  const excludedLinkNumbers = new Set()

  const serializedVarFields = bib.varFields.filter((field) => {
    // Check if this 880 field is linked to an excluded source
    if (field.marcTag === '880') {
      const fieldLinks = field.subfields
        .filter(sf => sf.tag === '6')
        .map(sf => sf.content)

      const shouldExclude = fieldLinks.some(link =>
        Array.from(excludedLinkNumbers).some(ln =>
          link.indexOf(ln) === 4
        )
      )

      if (shouldExclude) return false
    }

    // Find matching rule for this field
    const matchingRule = MarcSerializer.mappingRules.find((rule) =>
      MarcSerializer.varFieldMatches(field, rule)
    )

    if (!matchingRule) return true

    // If field is excluded, mark its link numbers for excluding 880 parallels
    if (matchingRule.directive === 'exclude') {
      const linkNumbers = extractLinkingNumbers(field)
      linkNumbers.forEach((ln) => excludedLinkNumbers.add(ln))
      return false
    }

    // Otherwise, keep the field
    return true
  })

  return {
    bib: {
      id: bib.id,
      nyplSource: bib.nyplSource,
      fields: serializedVarFields
    }
  }
}

module.exports = MarcSerializer
