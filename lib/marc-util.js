/**
 *  * Returns true if a field matches a given MARC rule
 * @param {VarField} field
 * @param {MarcRule} rule
 * @returns {boolean}
 */
function varFieldMatches (field, rule) {
  const indicator = `${field.marcTag || ''}${field.ind1 || ' '}${field.ind2 || ' '}`

  if (rule.fieldTag && rule.fieldTag !== field.fieldTag) {
    return false
  }

  return rule.marcIndicatorRegExp.test(indicator)
}

/**
 * Returns a copy of a varField with removed subfields according to the rule
 * @param {VarField} field
 * @param {MarcRule} rule
 * @returns {VarField}
 */
function buildSourceWithMasking (field, rule) {
  return {
    ...field,
    subfields: (field.subfields || []).filter((subfield) => {
      if (
        (rule.subfieldSpec.directive === 'include' &&
          !rule.subfieldSpec.subfields.includes(subfield.tag)) ||
        (rule.subfieldSpec.directive === 'exclude' &&
          rule.subfieldSpec.subfields.includes(subfield.tag))
      ) {
        return false
      }
      return true
    })
  }
}

module.exports = {
  varFieldMatches,
  buildSourceWithMasking
}
