const arrayUnique = require('./util').arrayUnique

// Load rules form disc serialization:
const mappingRules = require('../data/annotated-marc-rules.json')
  .map((rule) => {
    return Object.assign({}, rule, {
      marcIndicatorRegExp: new RegExp(rule.marcIndicatorRegExp),
      secondaryMarcIndicatorRegExp: new RegExp(rule.secondaryMarcIndicatorRegExp)
    })
  })

class AnnotatedMarcSerializer {
}

AnnotatedMarcSerializer.orderedFieldTags = arrayUnique(mappingRules.map((rule) => rule.fieldTag))

/**
 *  This parses the content of a "Bib Record Index Rules" document
 *  (i.e. data/bib-record-index-rules.txt), which contains lines like the
 *  following:
 *
 *    037 > SERIES(s)            400        KEEP x             ISBN/ISSN(i)
 *    196 > MISC(y)              880....690 REM  23468         Subject(d)
 *    189 > MISC(y)              880.[ 047]..611 REM  23468         Subject(d)
 *
 *  @return {Array} An array of rules resembling:
 *    {
 *      indexName: 'MISC'
 *      fieldGroupTag: 'y'
 *      marcIndicatorRegExp: /880.[ 047]/,
 *      targetMarcTag: '611',
 *      subfieldSpec: {
 *        directive: 'exclude',
 *        subfields: ['2', '3', '4', '6', '8']
 *      }
 *    }
 */
AnnotatedMarcSerializer.bibIndexRules = function (bibRecordIndexRulesContent) {
  // Build a big regex that extracts the things we need from each line:
  const lineMatch = new RegExp(
    [
      // Index num (e.g. "189")
      /^(\d+) > /,
      // Index name (e.g. "MISC(y)")
      /(\w+)\((\w)\)\s+/,
      // Marc tag and indicator pattern (e.g. "880.[ 047]")
      /((\d|\.|\[[\d ]+\]){3,5})/,
      // Target marc tag (e.g. "..611"):
      /(\.\.(\w+))?\s+/,
      // The phrase KEEP/REM mean things to us:
      /(KEEP|REM|EACH|N\/A)\s+/,
      // Subfields (e.g. "23468"
      /(\w+)\s+/,
      // A different label? (e.g. "Subject(d)")
      /([^\(]+\(\w\))/
    ]
      .map((r) => r.source)
      .join('')
  )

  return bibRecordIndexRulesContent.split('\n')
    .map((line) => line.match(lineMatch))
    .filter((m) => m)
    .map((matches) => {
      return {
        indexName: matches[2],
        fieldGroupTag: matches[3],
        marcIndicatorRegExp: new RegExp(matches[4]),
        targetMarcTag: matches[7],
        subfieldSpec: {
          directive: {
            REM: 'exclude',
            KEEP: 'include'
          }[matches[8]],
          subfields: Array.from(matches[9])
        }
      }
    })
}

/**
 * Given the raw source of a webpub.def file, returns an array of usable
 * rules that relate field labels to marc queries.
 */
AnnotatedMarcSerializer.parseWebpubToAnnotatedMarcRules = function (webpubContent, bibIndexRules = []) {
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

      // Add "secondary" marc-indicator patterns based on fieldGroupTag match in
      // bib bib-index-rules :
      const secondaryMarcIndicatorPatterns = arrayUnique(
        bibIndexRules
          .filter((rule) => rule.fieldGroupTag === line.fieldGroupTag)
          .map((rule) => rule.marcIndicatorRegExp.source)
      )
      const secondaryMarcIndicatorRegExp = secondaryMarcIndicatorPatterns.length > 0 ? new RegExp(`(${secondaryMarcIndicatorPatterns.join('|')})`) : /./

      return {
        fieldGroupTag: line.fieldGroupTag,
        marcIndicatorRegExp: new RegExp('^' + line.marcIndicatorPattern),
        secondaryMarcIndicatorRegExp,
        subfieldSpec,
        label: line.label
      }
    })

  return mappingRules
}

AnnotatedMarcSerializer.buildAnnotatedMarcRules = function (webpubContent, bibRecordIndexRulesContent) {
  const bibIndexRules = AnnotatedMarcSerializer.bibIndexRules(bibRecordIndexRulesContent)
  return AnnotatedMarcSerializer.parseWebpubToAnnotatedMarcRules(webpubContent, bibIndexRules)
}

/**
 * Given a sierra marc document, returns an array of varField bocks matching
 * the given rule
 */
AnnotatedMarcSerializer.matchingMarcFields = function (bib, rule) {
  return bib.varFields
    .filter((field) => {
      const fieldMarcIndicator = `${field.marcTag}${field.ind1 || ' '}${field.ind2 || ' '}`
      return rule.marcIndicatorRegExp.test(fieldMarcIndicator)
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
 *  Given an array of varfield blocks and a annotated-marc rule
 *  returns an array of objects with `content` and `source` properties
 */
AnnotatedMarcSerializer.formatVarFieldMatches = function (matchingVarFields, rule) {
  return matchingVarFields.map((field) => {
    const matchedSubfields = (field.subfields || []).filter((subfield) => {
      // If rule includes a subfields directive
      if (rule.subfieldSpec) {
        // Is subfields directive exclusionary? Remove matching:
        if (rule.subfieldSpec.directive === 'exclude') return rule.subfieldSpec.subfields.indexOf(subfield.tag) < 0
        // ..Otherwise keep matching:
        else return rule.subfieldSpec.subfields.indexOf(subfield.tag) >= 0
      }
    })
    const content = field.content || matchedSubfields.map((f) => f.content).join(' ')

    // Include source field with masked subfields:
    const source = AnnotatedMarcSerializer.buildSourceWithMasking(field, rule)

    return { content, source }
  })
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
    // Get bib varfields matching marc rule:
    const matchingVarFields = AnnotatedMarcSerializer.matchingMarcFields(bib, rule)

    // Add statements to doc:
    if (matchingVarFields.length > 0) {
      if (!doc[rule.label]) doc[rule.label] = []

      // Multiple rules may write to one label, so concat:
      doc[rule.label] = doc[rule.label].concat(AnnotatedMarcSerializer.formatVarFieldMatches(matchingVarFields, rule))
    }
    return doc
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
