/**
 *  * Returns true if a field matches a given MARC rule
 * @param {VarField} field
 * @param {MarcRule} rule
 * @returns {boolean}
 */
function varFieldMatches (field, rule) {
  const indicator = `${field.marcTag || ''}${field.ind1 || ' '}${field.ind2 || ' '}`
  return rule.fieldTag === field.fieldTag && rule.marcIndicatorRegExp.test(indicator)
}

/**
 * Returns a copy of a varField with masked subfields according to the rule
 * @param {VarField} field
 * @param {MarcRule} rule
 * @returns {VarField}
 */
function buildSourceWithMasking (field, rule) {
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

module.exports = {
  varFieldMatches,
  buildSourceWithMasking
}
