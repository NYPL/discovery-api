const AnnotatedMarcSerializer = require('../lib/annotated-marc-serializer')
const fixtures = require('./fixtures')

const realMappingRules = AnnotatedMarcSerializer.mappingRules
function overRideMappingRules (rules) {
  AnnotatedMarcSerializer.setRules(AnnotatedMarcSerializer.parseWebpubToAnnotatedMarcRules(rules))
}
function restoreMappingRules () {
  AnnotatedMarcSerializer.setRules(realMappingRules)
}

describe('Annotated Marc Rules', function () {
  describe('marc tag parsing', function () {
    it('should extract simple marc tag', function () {
      const rules = AnnotatedMarcSerializer.parseWebpubToAnnotatedMarcRules('b|a|100|-06|Author||b|')
      expect(rules).to.be.a('array')
      expect(rules.length).to.equal(1)

      expect(rules[0]).to.be.a('object')
      expect(rules[0].fieldTag).to.equal('a')
      expect(rules[0].marcIndicatorRegExp).to.be.an.instanceOf(RegExp)
      expect(rules[0].marcIndicatorRegExp.toString()).to.equal('/^100/')
    })

    it('should extract wildcarded marc tag', function () {
      let rules = AnnotatedMarcSerializer.parseWebpubToAnnotatedMarcRules('b|a|10.|-06|Author||b|')
      expect(rules).to.be.a('array')
      expect(rules.length).to.equal(1)

      expect(rules[0]).to.be.a('object')
      expect(rules[0].marcIndicatorRegExp).to.be.an.instanceOf(RegExp)
      expect(rules[0].marcIndicatorRegExp.toString()).to.equal('/^10./')

      rules = AnnotatedMarcSerializer.parseWebpubToAnnotatedMarcRules('b|a|1..|-06|Author||b|')
      expect(rules).to.be.a('array')
      expect(rules.length).to.equal(1)

      expect(rules[0]).to.be.a('object')
      expect(rules[0].marcIndicatorRegExp).to.be.an.instanceOf(RegExp)
      expect(rules[0].marcIndicatorRegExp.toString()).to.equal('/^1../')
    })
  })

  describe('building annotated marc rules', function () {
    it('should apply bib index rule to marc rule', function () {
      // Test rule *without bib index rule applied:
      const rule = AnnotatedMarcSerializer.parseWebpubToAnnotatedMarcRules('b|s|8..|-6|Series||b|').pop()
      expect(rule).to.be.a('object')
      expect(rule.label).to.equal('Series')
      expect(rule.marcIndicatorRegExp).to.be.a('RegExp')
      expect(rule.marcIndicatorRegExp.source).to.equal('^8..')
    })
  })

  describe('bib parsing', function () {
    it('identifies varfields', function () {
      const sampleBib = {
        varFields: [
          { fieldTag: 'a', marcTag: 362, ind1: '', ind2: 1 },
          { fieldTag: 'a', marcTag: 361, ind1: 2, ind2: 4 },
          { fieldTag: 'a', marcTag: 360, ind1: '', ind2: '' }
        ]
      }
      // Match 362, any indicators:
      const rule1 = AnnotatedMarcSerializer.parseWebpubToAnnotatedMarcRules('b|a|362|-06|Publication Date||b|').pop()
      const matching = AnnotatedMarcSerializer.matchingMarcFields(sampleBib, rule1)
      // Matches only first varField:
      expect(matching).to.be.a('array')
      expect(matching).to.have.lengthOf(1)
      expect(matching[0]).to.be.a('object')
      expect(matching[0].marcTag).to.equal(362)

      // Match 362, ind2=2:
      const rule2 = AnnotatedMarcSerializer.parseWebpubToAnnotatedMarcRules('b|a|362 2|-06|Publication Date||b|').pop()
      const emptyMatching = AnnotatedMarcSerializer.matchingMarcFields(sampleBib, rule2)
      // Fails because we only have a rule for 362, ind2=1
      expect(emptyMatching).to.be.a('array')
      expect(emptyMatching).to.have.lengthOf(0)

      // Match 36., any indicators:
      const rule3 = AnnotatedMarcSerializer.parseWebpubToAnnotatedMarcRules('b|a|36.|-06|Publication Date||b|').pop()
      const matching3 = AnnotatedMarcSerializer.matchingMarcFields(sampleBib, rule3)
      // Matches all varFields:
      expect(matching3).to.be.a('array')
      expect(matching3).to.have.lengthOf(3)

      // Match 36[20] (not 361), any indicators:
      const rule4 = AnnotatedMarcSerializer.parseWebpubToAnnotatedMarcRules('b|a|36[20]|-06|Publication Date||b|').pop()
      const matching4 = AnnotatedMarcSerializer.matchingMarcFields(sampleBib, rule4)
      // Matches two varFields:
      expect(matching4).to.be.a('array')
      expect(matching4).to.have.lengthOf(2)
      expect(matching4[1]).to.be.a('object')
      expect(matching4[1].marcTag).to.equal(360)

      // Match 36[20] (not 361), ind2 != 1:
      const rule5 = AnnotatedMarcSerializer.parseWebpubToAnnotatedMarcRules('b|a|36[20] [^1]|-06|Publication Date||b|').pop()
      const matching5 = AnnotatedMarcSerializer.matchingMarcFields(sampleBib, rule5)
      // Matches only 360 because ind2 is ''
      expect(matching5).to.be.a('array')
      expect(matching5).to.have.lengthOf(1)
      expect(matching5[0]).to.be.a('object')
      expect(matching5[0].marcTag).to.equal(360)
    })
  })

  describe('subfield parsing', function () {
    it('should extract exclusionary subfield directive', function () {
      const rules = AnnotatedMarcSerializer.parseWebpubToAnnotatedMarcRules('b|a|100|-06|Author||b|')
      expect(rules).to.be.a('array')
      expect(rules.length).to.equal(1)

      expect(rules[0]).to.be.a('object')
      expect(rules[0].subfieldSpec).to.be.a('object')
      expect(rules[0].subfieldSpec.directive).to.equal('exclude')
      expect(rules[0].subfieldSpec.subfields).to.be.a('array')
      expect(rules[0].subfieldSpec.subfields.length).to.equal(2)
      expect(rules[0].subfieldSpec.subfields).to.include.members(['0', '6'])
    })

    it('should extract inclusionary subfield directive', function () {
      const rules = AnnotatedMarcSerializer.parseWebpubToAnnotatedMarcRules('b|r|336|a|Type of Content||b|')
      expect(rules).to.be.a('array')
      expect(rules.length).to.equal(1)

      expect(rules[0]).to.be.a('object')
      expect(rules[0].subfieldSpec).to.be.a('object')
      expect(rules[0].subfieldSpec.directive).to.equal('include')
      expect(rules[0].subfieldSpec.subfields).to.be.a('array')
      expect(rules[0].subfieldSpec.subfields.length).to.equal(1)
      expect(rules[0].subfieldSpec.subfields).to.include.members(['a'])
    })
  })

  describe('label parsing ', function () {
    it('should extract label', function () {
      let rules = AnnotatedMarcSerializer.parseWebpubToAnnotatedMarcRules('b|a|100|-06|Author||b|')
      expect(rules).to.be.a('array')
      expect(rules.length).to.equal(1)

      expect(rules[0]).to.be.a('object')
      expect(rules[0].label).to.equal('Author')

      rules = AnnotatedMarcSerializer.parseWebpubToAnnotatedMarcRules('b|r|336|a|Type of Content||b|')
      expect(rules).to.be.a('array')
      expect(rules.length).to.equal(1)

      expect(rules[0]).to.be.a('object')
      expect(rules[0].label).to.equal('Type of Content')
    })
  })

  describe('record serialization', function () {
    it('should serialize 310', function () {
      /*
       * We expect to match this:
      {
        "marcIndicatorRegExp": "^310",
        "subfieldSpec": {
          "subfields": [
            "6"
          ],
          "directive": "exclude"
        },
        "label": "Current Frequency"
      },
      */

      const sampleBib = {
        id: 'testid',
        nyplSource: 'testSource',
        varFields: [
          {
            fieldTag: 'r',
            marcTag: '310',
            ind1: ' ',
            ind2: ' ',
            content: null,
            subfields: [
              {
                tag: 'a',
                content: 'Weekly'
              }
            ]
          }
        ]
      }

      const serialization = AnnotatedMarcSerializer.serialize(sampleBib)
      expect(serialization).to.be.a('object')
      expect(serialization.bib).to.be.a('object')
      expect(serialization.bib.id).to.be.a('string')
      expect(serialization.bib.nyplSource).to.be.a('string')
      expect(serialization.bib.fields).to.be.a('array')
      expect(serialization.bib.fields).to.have.lengthOf(1)
      expect(serialization.bib.fields[0]).to.be.a('object')
      expect(serialization.bib.fields[0].label).to.equal('Current Frequency')
      expect(serialization.bib.fields[0].values).to.be.a('array')
      expect(serialization.bib.fields[0].values).to.have.lengthOf(1)
      expect(serialization.bib.fields[0].values[0]).to.be.a('object')
      expect(serialization.bib.fields[0].values[0].content).to.equal('Weekly')
    })

    it('should serialize title', function () {
      const sampleBib = {
        id: 'testid',
        nyplSource: 'testSource',
        varFields: [
          {
            fieldTag: 't',
            marcTag: '245',
            ind1: '0',
            ind2: '0',
            content: null,
            subfields: [
              {
                tag: 'a',
                content: 'Razvedchik'
              },
              {
                tag: 'h',
                content: '[microform] :'
              },
              {
                tag: 'b',
                content: 'zhurnal voennyĭ i literaturnyĭ.'
              }
            ]
          }
        ]
      }
      const serialization = AnnotatedMarcSerializer.serialize(sampleBib)
      expect(serialization.bib).to.be.a('object')
      expect(serialization.bib.id).to.be.a('string')
      expect(serialization.bib.nyplSource).to.be.a('string')
      expect(serialization.bib.fields).to.be.a('array')
      expect(serialization.bib.fields).to.have.lengthOf(1)
      expect(serialization.bib.fields[0]).to.be.a('object')
      expect(serialization.bib.fields[0].label).to.equal('Title')
      expect(serialization.bib.fields[0].values).to.be.a('array')
      expect(serialization.bib.fields[0].values).to.have.lengthOf(1)
      expect(serialization.bib.fields[0].values[0]).to.be.a('object')
      expect(serialization.bib.fields[0].values[0].content).to.equal('Razvedchik [microform] : zhurnal voennyĭ i literaturnyĭ.')
    })

    it('should serialize parallel title', function () {
      const sampleBib = {
        id: 'testid',
        nyplSource: 'testSource',
        varFields: [
          {
            fieldTag: 't',
            marcTag: '245',
            ind1: '0',
            ind2: '0',
            content: null,
            subfields: [
              {
                tag: 'a',
                content: 'Razvedchik'
              },
              {
                tag: '6',
                content: '880-01'
              }
            ]
          },
          {
            fieldTag: 'y',
            marcTag: '880',
            ind1: '0',
            ind2: '0',
            content: null,
            subfields: [
              {
                tag: 'a',
                content: 'parallel value'
              },
              {
                tag: '6',
                content: '245-01/(2/r'
              }
            ]
          }
        ]
      }
      const serialization = AnnotatedMarcSerializer.serialize(sampleBib)
      expect(serialization.bib).to.be.a('object')
      expect(serialization.bib.id).to.be.a('string')
      expect(serialization.bib.nyplSource).to.be.a('string')
      expect(serialization.bib.fields).to.be.a('array')
      expect(serialization.bib.fields).to.have.lengthOf(2)

      expect(serialization.bib.fields[1]).to.be.a('object')
      expect(serialization.bib.fields[1].label).to.equal('Alternate Script for Title')
      expect(serialization.bib.fields[1].values).to.be.a('array')
      expect(serialization.bib.fields[1].values).to.have.lengthOf(1)
      expect(serialization.bib.fields[1].values[0].content).to.equal('parallel value')

      expect(serialization.bib.fields[0]).to.be.a('object')
      expect(serialization.bib.fields[0].label).to.equal('Title')
      expect(serialization.bib.fields[0].values).to.be.a('array')
      expect(serialization.bib.fields[0].values).to.have.lengthOf(1)
      expect(serialization.bib.fields[0].values[0]).to.be.a('object')
      expect(serialization.bib.fields[0].values[0].content).to.equal('Razvedchik')
    })
  })

  describe('source masking', function () {
    it('should mask subfields excluded', function () {
      const sampleField = {
        marcTag: '245',
        subfields: [
          {
            tag: 'a',
            content: 'Razvedchik'
          },
          {
            tag: 'h',
            content: '[microform] :'
          }
        ]
      }

      // Build a rule that selects 245, and excludes subfields 0, 6, and h
      const rule = AnnotatedMarcSerializer.parseWebpubToAnnotatedMarcRules('b|a|245|-06h|Field name||b|').pop()
      const maskedSource = AnnotatedMarcSerializer.buildSourceWithMasking(sampleField, rule)

      expect(maskedSource).to.be.a('object')
      expect(maskedSource.marcTag).to.equal('245')
      expect(maskedSource.subfields).to.be.a('array')
      expect(maskedSource.subfields).to.have.lengthOf(2)
      expect(maskedSource.subfields[0]).to.be.a('object')
      expect(maskedSource.subfields[0].tag).to.equal('a')
      expect(maskedSource.subfields[0].content).to.equal('Razvedchik')
      expect(maskedSource.subfields[1]).to.be.a('object')
      expect(maskedSource.subfields[1].tag).to.equal('h')
      expect(maskedSource.subfields[1].content).to.equal('[redacted]')
    })

    it('should mask subfields not included', function () {
      const sampleField = {
        marcTag: '245',
        subfields: [
          {
            tag: 'a',
            content: 'Razvedchik'
          },
          {
            tag: 'h',
            content: '[microform] :'
          }
        ]
      }

      // Build a rule that selects 245, but ONLY includes subfields 0, 6, and h
      const rule = AnnotatedMarcSerializer.parseWebpubToAnnotatedMarcRules('b|a|245|06h|Field name||b|').pop()
      const maskedSource = AnnotatedMarcSerializer.buildSourceWithMasking(sampleField, rule)

      expect(maskedSource).to.be.a('object')
      expect(maskedSource.marcTag).to.equal('245')
      expect(maskedSource.subfields).to.be.a('array')
      expect(maskedSource.subfields).to.have.lengthOf(2)
      expect(maskedSource.subfields[0]).to.be.a('object')
      expect(maskedSource.subfields[0].tag).to.equal('a')
      expect(maskedSource.subfields[0].content).to.equal('[redacted]')
      expect(maskedSource.subfields[1]).to.be.a('object')
      expect(maskedSource.subfields[1].tag).to.equal('h')
      expect(maskedSource.subfields[1].content).to.equal('[microform] :')
    })
  })

  describe('catch-alls', function () {
    before(function () {
      overRideMappingRules([
        'b|a|245|a|Field name||b|',
        'b|a||a|Catch-all name||b|'
      ].join('\n'))
    })
    after(restoreMappingRules)
    it('should match varfields based on fieldTag', function () {
      const sampleBib = {
        varFields: [
          {
            fieldTag: 'a',
            marcTag: '245',
            subfields: [
              {
                tag: 'a',
                content: 'Varfield 245'
              }
            ]
          },
          {
            fieldTag: 'a',
            marcTag: '246',
            subfields: [
              {
                tag: 'a',
                content: 'Varfield 246'
              }
            ]
          }

        ]
      }
      expect(AnnotatedMarcSerializer.mappingRules[0]).to.be.a('object')
      expect(AnnotatedMarcSerializer.mappingRules[0].marcIndicatorRegExp).to.be.a('RegExp')
      expect(AnnotatedMarcSerializer.mappingRules[0].marcIndicatorRegExp.source).to.equal('^245')
      expect(AnnotatedMarcSerializer.mappingRules[1]).to.be.a('object')
      expect(AnnotatedMarcSerializer.mappingRules[1].marcIndicatorRegExp).to.be.a('RegExp')
      expect(AnnotatedMarcSerializer.mappingRules[1].marcIndicatorRegExp.source).to.equal('^')

      const doc = AnnotatedMarcSerializer.serialize(sampleBib)

      expect(doc).to.be.a('object')
      expect(doc.bib).to.be.a('object')
      expect(doc.bib.fields).to.be.a('array')
      expect(doc.bib.fields).to.have.lengthOf(2)

      const fieldNameMatch = doc.bib.fields.filter((f) => f.label === 'Field name').pop()
      expect(fieldNameMatch).to.be.a('object')
      expect(fieldNameMatch.values).to.be.a('array')
      expect(fieldNameMatch.values).to.have.lengthOf(1)
      expect(fieldNameMatch.values[0]).to.be.a('object')
      expect(fieldNameMatch.values[0].content).to.equal('Varfield 245')

      const catchAllMatch = doc.bib.fields.filter((f) => f.label === 'Catch-all name').pop()
      expect(catchAllMatch).to.be.a('object')
      expect(catchAllMatch.values).to.be.a('array')
      expect(catchAllMatch.values).to.have.lengthOf(1)
      expect(catchAllMatch.values[0]).to.be.a('object')
      expect(catchAllMatch.values[0].content).to.equal('Varfield 246')
    })
  })

  describe('exclusionary rules', function () {
    before(function () {
      overRideMappingRules([
        'b|a|245|a|Keep this one||b|',
        'b|a|246|a|||b|'
      ].join('\n'))
    })
    after(function () {
      restoreMappingRules()
    })
    it('should exclude varfields if rule has blank label', function () {
      const sampleBib = {
        varFields: [
          {
            fieldTag: 'a',
            marcTag: '245',
            subfields: [
              {
                tag: 'a',
                content: 'Varfield 245'
              }
            ]
          },
          {
            fieldTag: 'a',
            marcTag: '246',
            subfields: [
              {
                tag: 'a',
                content: 'Varfield 246'
              }
            ]
          }

        ]
      }

      const doc = AnnotatedMarcSerializer.serialize(sampleBib)

      expect(doc).to.be.a('object')
      expect(doc.bib).to.be.a('object')
      expect(doc.bib.fields).to.be.a('array')
      expect(doc.bib.fields).to.have.lengthOf(1)

      const fieldNameMatch = doc.bib.fields.filter((f) => f.label === 'Keep this one').pop()
      expect(fieldNameMatch).to.be.a('object')
      expect(fieldNameMatch.values).to.be.a('array')
      expect(fieldNameMatch.values).to.have.lengthOf(1)
      expect(fieldNameMatch.values[0]).to.be.a('object')
      expect(fieldNameMatch.values[0].content).to.equal('Varfield 245')
    })
  })

  describe('correct ordering of field tags', function () {
    it('should generate field tags in order', function () {
      expect(AnnotatedMarcSerializer.orderedFieldTags).to.be.a('Array')
      expect(AnnotatedMarcSerializer.orderedFieldTags).to.have.ordered.members(['a', 'f', 't', 'p', 'H', 'T', 'e', 'r', 's', 'n', 'm', 'y', 'd', 'b', 'u', 'h', 'x', 'z', 'w', 'l', 'i', 'g', 'c', 'q'])
    })

    it('should place field tags in correct order when given a bib', function () {
      const sampleBib = {
        varFields: [{ fieldTag: 't', marcTag: '130', ind1: '', ind2: '', subfields: [{ tag: 'a', content: 'anyone' }] },
          { fieldTag: 'a', marcTag: '100', ind1: '', ind2: '', subfields: [{ tag: 'a', content: 'lived' }] },
          { fieldTag: 'p', marcTag: '260', ind1: '', ind2: '', subfields: [{ tag: 'a', content: 'in' }] }
        ]
      }
      const serialized = AnnotatedMarcSerializer.serialize(sampleBib)
      expect(serialized.bib).to.be.an('object')
      expect(serialized.bib.fields).to.be.an('array')
      expect(serialized.bib.fields).to.have.lengthOf(3)
      expect(serialized.bib.fields[0].label).to.equal('Author')
      expect(serialized.bib.fields[1].label).to.equal('Uniform Title')
      expect(serialized.bib.fields[2].label).to.equal('Imprint')
    })

    it('should place MARC tags in correct order within a field tag when given a bib', function () {
      const sampleBib = {
        varFields: [{ fieldTag: 't', marcTag: '130', ind1: '', ind2: '', subfields: [{ tag: 'a', content: 'anyone' }] },
          { fieldTag: 'a', marcTag: '100', ind1: '', ind2: '', subfields: [{ tag: 'a', content: 'lived' }] },
          { fieldTag: 'p', marcTag: '260', ind1: '', ind2: '', subfields: [{ tag: 'a', content: 'in' }] },
          { fieldTag: 't', marcTag: '130', indx1: '', ind2: '', subfields: [{ tag: 'a', content: 'a' }] },
          { fieldTag: 't', marcTag: '130', indx1: '', ind2: '', subfields: [{ tag: 'a', content: 'pretty' }] }
        ]
      }
      const serialized = AnnotatedMarcSerializer.serialize(sampleBib)
      expect(serialized.bib).to.be.an('object')
      expect(serialized.bib.fields).to.be.an('array')
      expect(serialized.bib.fields).to.have.lengthOf(3)
      expect(serialized.bib.fields[1].label).to.equal('Uniform Title')
      expect(serialized.bib.fields[1].values.map((value) => value.content)).to.have.ordered.members(['anyone', 'a', 'pretty'])
    })

    it('should place parallel fields next to the fields they parallel', function () {
      const sampleBib = {
        varFields: [{ fieldTag: 'a', marcTag: '100', ind1: '', ind2: '', subfields: [{ tag: 'a', content: 'how' }, { tag: '6', content: '880-01' }] },
          { fieldTag: 't', marcTag: '130', ind1: '', ind2: '', subfields: [{ tag: 'a', content: 'town' }] },
          { fieldTag: 'y', marcTag: '880', ind1: '1', ind2: '', subfields: [{ tag: 'a', content: 'with' }, { tag: '6', content: '880-01' }] }
        ]
      }
      const serialized = AnnotatedMarcSerializer.serialize(sampleBib)
      expect(serialized.bib).to.be.an('object')
      expect(serialized.bib.fields).to.be.an('array')
      expect(serialized.bib.fields).to.have.lengthOf(3)
      expect(serialized.bib.fields[0].label).to.equal('Author')
      expect(serialized.bib.fields[1].label).to.equal('Alternate Script for Author')
    })
  })

  describe('Added Title Page Title 246 Fields', function () {
    it('should have added title field for MARC tags 24615/1/blank', function () {
      const sampleBib = {
        varFields: [
          {
            fieldTag: 'u',
            marcTag: '246',
            ind1: '1',
            ind2: '5',
            subfields: [{ tag: 'a', content: 'how' }, { tag: '6', content: '880-01' }]
          },
          // This one is a 246, but won't match the current pattern of ^24615:
          {
            fieldTag: 'u',
            marcTag: '246',
            ind1: '3',
            ind2: ' ',
            subfields: [{ tag: 'a', content: 'town' }]
          }
        ]
      }
      const serialized = AnnotatedMarcSerializer.serialize(sampleBib)
      expect(serialized.bib).to.be.an('object')
      expect(serialized.bib.fields).to.be.an('array')
      expect(serialized.bib.fields).to.have.lengthOf(1)
      expect(serialized.bib.fields[0].label).to.equal('Added Title Page Title')
      expect(serialized.bib.fields[0].values).to.be.an('array')
      // Only the first 246 in the sampleBib matches:
      expect(serialized.bib.fields[0].values).to.have.lengthOf(1)
      expect(serialized.bib.fields[0].values[0].content).to.equal('how')
    })
  })

  describe('Relator Mappings', function () {
    it('should replace designated codes in designated fields', function () {
      const sampleBib = {
        varFields: [{ fieldTag: 'b', marcTag: '700', ind1: '1', ind2: '', subfields: [{ tag: 'a', content: 'Cramer, Richard' }, { tag: '4', content: 'aut -- 700 1b' }] },
          { fieldTag: 'a', marcTag: '100', ind1: '', ind2: '', subfields: [{ tag: 'a', content: 'up' }, { tag: '4', content: 'cos so' }] }
        ]
      }

      const serialized = AnnotatedMarcSerializer.serialize(sampleBib)
      expect(serialized.bib).to.be.an('object')
      expect(serialized.bib.fields).to.be.an('array')
      expect(serialized.bib.fields).to.have.lengthOf(2)
      expect(serialized.bib.fields[0].label).to.equal('Author')
      expect(serialized.bib.fields[0].values[0].content).to.equal('up Contestant so')
      expect(serialized.bib.fields[1].label).to.equal('Added Author')
      expect(serialized.bib.fields[1].values[0].content).to.equal('Cramer, Richard Author -- 700 1b')
    })

    it('should replace multiple consecutive $4 subfields with mapped relator labels, joined by a period', function () {
      const sampleBib = {
        varFields: [
          {
            fieldTag: 'b',
            marcTag: '700',
            ind1: '1',
            ind2: '',
            subfields: [
              { tag: 'a', content: 'Cramer, Richard' },
              { tag: '4', content: 'aut' },
              { tag: '4', content: 'prt' }
            ]
          }
        ]
      }

      const serialized = AnnotatedMarcSerializer.serialize(sampleBib)
      expect(serialized.bib).to.be.an('object')
      expect(serialized.bib.fields).to.be.an('array')
      expect(serialized.bib.fields).to.have.lengthOf(1)
      expect(serialized.bib.fields[0].label).to.equal('Added Author')
      expect(serialized.bib.fields[0].values[0].content).to.equal('Cramer, Richard Author. Printer')
    })
  })

  describe('"Connect to:" labels', function () {
    it('should extract label from $z, $y, or $3', function () {
      const sampleBib = {
        varFields: [
          { fieldTag: 'y', marcTag: '856', subfields: [{ tag: 'u', content: 'http://example.com#0' }, { tag: 'z', content: 'Label 1' }] },
          { fieldTag: 'y', marcTag: '856', subfields: [{ tag: 'u', content: 'http://example.com#1' }, { tag: 'y', content: 'Label 2' }, { tag: '3', content: 'This additional lable is ignored because we found $y first' }] },
          { fieldTag: 'y', marcTag: '856', subfields: [{ tag: 'a', content: 'Ignore tag' }, { tag: 'u', content: 'http://example.com#2' }, { tag: '3', content: 'Label 3' }] },
          { fieldTag: 'y', marcTag: '856', subfields: [{ tag: 'x', content: '[redacted]' }] }
        ]
      }

      const serialized = AnnotatedMarcSerializer.serialize(sampleBib)
      expect(serialized.bib).to.be.a('object')
      expect(serialized.bib.fields).to.be.a('array')
      expect(serialized.bib.fields[0]).to.be.a('object')
      expect(serialized.bib.fields[0].label).to.equal('Connect to:')
      expect(serialized.bib.fields[0].values).to.be.a('array')
      expect(serialized.bib.fields[0].values[0]).to.be.a('object')
      expect(serialized.bib.fields[0].values[0].label).to.equal('Label 1')
      expect(serialized.bib.fields[0].values[1].label).to.equal('Label 2')
      expect(serialized.bib.fields[0].values[2].label).to.equal('Label 3')
      // field tag x should not be included
      expect(serialized.bib.fields[0].values.length).to.equal(3)
    })

    it('should use default label when none specified', function () {
      const sampleBib = {
        varFields: [
          { fieldTag: 'y', marcTag: '856', subfields: [{ tag: 'u', content: 'http://example.com#0' }] }
        ]
      }

      const serialized = AnnotatedMarcSerializer.serialize(sampleBib)
      expect(serialized.bib).to.be.a('object')
      expect(serialized.bib.fields).to.be.a('array')
      expect(serialized.bib.fields[0]).to.be.a('object')
      expect(serialized.bib.fields[0].label).to.equal('Connect to:')
      expect(serialized.bib.fields[0].values).to.be.a('array')
      expect(serialized.bib.fields[0].values[0]).to.be.a('object')
      expect(serialized.bib.fields[0].values[0].label).to.equal('http://example.com#0')
    })
  })

  describe('Subject delimiters', function () {
    it('should use -- delimiters', function () {
      const sampleBib = {
        varFields: [
          { fieldTag: 'd', marcTag: '600', subfields: [{ tag: 'a', content: 'Artist, Starving,' }, { tag: 'd', content: '1900-1999' }, { tag: 'v', content: 'Autobiography.' }] },
          { fieldTag: 'd', marcTag: '611', subfields: [{ tag: 'a', content: 'Stonecutters\' Annual Picnic' }, { tag: 'n', content: '(12th :' }, { tag: 'd', content: '1995 :' }, { tag: 'c', content: 'Springfield)' }, { tag: 'x', content: 'History' }, { tag: 'v', content: 'Drama.' }] },
          { fieldTag: 'd', marcTag: '651', subfields: [{ tag: 'a', content: 'New York (N.Y.)' }, { tag: 'y', content: '21st century' }, { tag: 'x', content: 'Diaries.' }] }
        ]
      }

      const serialized = AnnotatedMarcSerializer.serialize(sampleBib)
      expect(serialized.bib).to.be.a('object')
      expect(serialized.bib.fields).to.be.a('array')
      expect(serialized.bib.fields[0]).to.be.a('object')
      expect(serialized.bib.fields[0].label).to.equal('Subject')
      expect(serialized.bib.fields[0].values).to.be.a('array')
      expect(serialized.bib.fields[0].values[0].content).to.equal('Artist, Starving, 1900-1999 -- Autobiography.')
      expect(serialized.bib.fields[0].values[1].content).to.equal('Stonecutters\' Annual Picnic (12th : 1995 : Springfield) -- History -- Drama.')
      expect(serialized.bib.fields[0].values[2].content).to.equal('New York (N.Y.) -- 21st century -- Diaries.')
    })
  })

  describe('Annotated marc endpoint', function () {
    const app = {}

    before(function () {
      // Get a minimal instance of app (just controller code):
      require('../lib/resources')(app)
      app.logger = require('../lib/logger')

      // Reroute this (and only this) api path to local fixture:
      fixtures.enableDataApiFixtures({
        'bibs/sierra-nypl/11055155': 'bib-11055155.json'
      })
    })

    after(function () {
      fixtures.disableDataApiFixtures()
    })

    it('transforms fetched marc-in-json document into "annotated-marc" format', function () {
      return app.resources.annotatedMarc({ uri: 'b11055155' })
        .then((resp) => {
          expect(resp.bib.id).to.equal('11055155')
          expect(resp.bib.nyplSource).to.equal('sierra-nypl')
          expect(resp.bib.fields).to.be.an('array')

          const lccn = resp.bib.fields
            .filter((field) => field.label === 'LCCN')
            .pop()
          expect(lccn).to.be.a('object')
          expect(lccn.values).to.be.a('array')
          expect(lccn.values[0]).to.be.a('object')
          expect(lccn.values[0].content).to.equal('   28025172')

          const title = resp.bib.fields
            .filter((field) => field.label === 'Title')
            .pop()
          expect(title).to.be.a('object')
          expect(title.values).to.be.a('array')
          expect(title.values[0]).to.be.a('object')
          expect(title.values[0].content).to.equal('Topographical bibliography of ancient Egyptian hieroglyphic texts, reliefs, and paintings / by Bertha Porter and Rosalind L.B. Moss.')
        })
    })
  })

  describe('Creator/Contributor Characteristics', function () {
    it('should extract Creator/Contributor Characteristics from 386', function () {
      const sampleBib = {
        varFields: [
          { fieldTag: 'r', marcTag: '386', subfields: [{ tag: 'a', content: 'Creator/Contributor Characteristics content' }, { tag: '6', content: 'ignore' }] }
        ]
      }

      const serialized = AnnotatedMarcSerializer.serialize(sampleBib)
      expect(serialized.bib).to.be.a('object')
      expect(serialized.bib.fields).to.be.a('array')
      expect(serialized.bib.fields[0]).to.be.a('object')
      expect(serialized.bib.fields[0].label).to.equal('Creator/Contributor Characteristics')
      expect(serialized.bib.fields[0].values).to.be.a('array')
      expect(serialized.bib.fields[0].values[0]).to.be.a('object')
      expect(serialized.bib.fields[0].values[0].content).to.equal('Creator/Contributor Characteristics content')
    })
  })
})
