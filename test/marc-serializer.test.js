const { expect } = require('chai')
const MarcSerializer = require('../lib/marc-serializer')

// Mock mapping rules
MarcSerializer.mappingRules = [
  // 700 should be removed entirely
  {
    fieldTag: 'b',
    marcIndicatorRegExp: /^700/,
    directive: 'exclude',
    subfieldSpec: null
  },
  // 856$u should be blanked, 856$z kept
  {
    fieldTag: 'y',
    marcIndicatorRegExp: /^856/,
    directive: 'include',
    subfieldSpec: {
      subfields: ['u'], // redact only $u
      directive: 'exclude'
    }
  }
]

const sampleBib = {
  id: 'testId',
  nyplSource: 'testSource',
  varFields: [
    {
      fieldTag: 'a',
      marcTag: '100',
      content: null,
      ind1: '1',
      ind2: ' ',
      subfields: [
        { tag: 'a', content: 'Porter, Bertha,' },
        { tag: 'd', content: '1852-1941.' }
      ]
    },
    {
      fieldTag: 'y',
      marcTag: '008',
      content: '      cyyyy2011nyua   f      000 faeng dnam a ',
      ind1: '',
      ind2: '',
      subfields: []
    },
    {
      fieldTag: 't',
      marcTag: '245',
      content: null,
      ind1: '1',
      ind2: '0',
      subfields: [
        { tag: 'a', content: 'Topographical bibliography of ancient Egyptian hieroglyphic texts, reliefs, and paintings /' },
        { tag: 'c', content: 'by Bertha Porter and Rosalind L.B. Moss.' }
      ]
    },
    {
      fieldTag: 'b',
      marcTag: '700',
      content: null,
      ind1: '1',
      ind2: ' ',
      subfields: [
        { tag: 'a', content: 'Moss, Rosalind L. B.' },
        { tag: 'q', content: '(Rosalind Louisa Beaufort)' }
      ]
    },
    {
      fieldTag: 'y',
      marcTag: '856',
      content: null,
      subfields: [
        { tag: 'u', content: 'This should be redacted' },
        { tag: 'z', content: 'This is ok' }
      ],
      ind1: '4',
      ind2: '0'
    },
    {
      fieldTag: '_',
      marcTag: null,
      content: '00000cam  2200769Ia 4500',
      subfields: [],
      ind1: null,
      ind2: null
    }
  ]
}

const sampleBibWithParallels = {
  id: 'testId',
  nyplSource: 'testSource',
  varFields: [
    {
      fieldTag: 'a',
      marcTag: '100',
      content: null,
      ind1: '1',
      ind2: ' ',
      subfields: [
        { tag: 'a', content: 'Porter, Bertha,' },
        { tag: 'd', content: '1852-1941.' }
      ]
    },
    {
      fieldTag: 't',
      marcTag: '245',
      content: null,
      ind1: '1',
      ind2: '0',
      subfields: [
        { tag: 'a', content: 'Topographical bibliography of ancient Egyptian hieroglyphic texts, reliefs, and paintings /' },
        { tag: 'c', content: 'by Bertha Porter and Rosalind L.B. Moss.' }
      ]
    },
    {
      fieldTag: 'b',
      marcTag: '700',
      content: null,
      ind1: '1',
      ind2: ' ',
      subfields: [
        { tag: 'a', content: 'Moss, Rosalind L. B.' },
        { tag: 'q', content: '(Rosalind Louisa Beaufort)' }
      ]
    },
    {
      fieldTag: 'y',
      marcTag: '856',
      content: null,
      subfields: [
        { tag: 'u', content: 'This should be redacted' },
        { tag: 'z', content: 'This is ok' },
        { tag: '6', content: '880-01' }
      ],
      ind1: '4',
      ind2: '0'
    },
    {
      fieldTag: '_',
      marcTag: null,
      content: '00000cam  2200769Ia 4500',
      subfields: [],
      ind1: null,
      ind2: null
    },
    {
      fieldTag: 'y',
      marcTag: '880',
      content: null,
      subfields: [
        { tag: '6', content: '856-01' }, // links to 856
        { tag: 'u', content: 'Parallel to redacted' },
        { tag: 'z', content: 'Parallel to ok' }
      ],
      ind1: '4',
      ind2: '0'
    }
  ]
}

describe('MarcSerializer', () => {
  describe('serialize', () => {
    let serialized
    before(() => {
      serialized = MarcSerializer.serialize(sampleBib)
    })

    it('preserves leader field', () => {
      const leader = serialized.bib.fields.find(f => f.fieldTag === '_')
      expect(leader.content).to.equal('00000cam  2200769Ia 4500')
    })

    it('preserves non-suppressed fields', () => {
      const field100 = serialized.bib.fields.find(f => f.marcTag === '100')
      expect(field100.subfields.map(sf => sf.content)).to.include('Porter, Bertha,')
    })

    it('blanks subfields marked for exclusion', () => {
      const field856 = serialized.bib.fields.find(f => f.marcTag === '856')

      const subfieldU = field856.subfields.find(s => s.tag === 'u')
      expect(subfieldU.content).to.equal('[redacted]')

      const subfieldZ = field856.subfields.find(s => s.tag === 'z')
      expect(subfieldZ.content).to.equal('This is ok')
    })

    it('keeps surviving fields present', () => {
      const tags = serialized.bib.fields.map(f => f.marcTag)
      // Null is the leader, 700 is removed
      expect(tags).to.include.members([null, '100', '245', '856'])
    })
  })

  describe('serialize with parallels', () => {
    let serialized
    before(() => {
      serialized = MarcSerializer.serialize(sampleBibWithParallels)
    })

    it('blanks excluded subfields in main 856 and parallel 880', () => {
      const field856 = serialized.bib.fields.find(f => f.marcTag === '856')
      const field880 = serialized.bib.fields.find(f => f.marcTag === '880')

      // 856$u and 880$u should be redacted
      const subU856 = field856.subfields.find(s => s.tag === 'u')
      expect(subU856.content).to.equal('[redacted]')

      const subU880 = field880.subfields.find(s => s.tag === 'u')
      expect(subU880.content).to.equal('[redacted]')

      // z subfields remain
      expect(field856.subfields.find(s => s.tag === 'z').content).to.equal('This is ok')
      expect(field880.subfields.find(s => s.tag === 'z').content).to.equal('Parallel to ok')
    })
  })

  describe('findParallelFields', () => {
    it('returns empty array when no 880 fields are present', () => {
      const field100 = sampleBib.varFields.find(f => f.marcTag === '100')
      const parallels = MarcSerializer.findParallelFields(sampleBib, field100)
      expect(parallels).to.be.an('array')
      expect(parallels).to.have.lengthOf(0)
    })
    it('returns correct parallel 880 for a field', () => {
      const field856 = sampleBibWithParallels.varFields.find(f => f.marcTag === '856')
      const parallels = MarcSerializer.findParallelFields(sampleBibWithParallels, field856)
      expect(parallels).to.have.lengthOf(1)
      expect(parallels[0].marcTag).to.equal('880')
    })
  })

  describe('isLeaderField', () => {
    it('correctly identifies leader field', () => {
      const leader = sampleBib.varFields.find(field => field.fieldTag === '_')
      expect(MarcSerializer.isLeaderField(leader)).to.equal(true)
    })

    it('returns false for non-leader fields', () => {
      const field100 = sampleBib.varFields[1]
      expect(MarcSerializer.isLeaderField(field100)).to.equal(false)
    })
  })

  describe('isControlField', () => {
    it('correctly identifies control field', () => {
      const control = sampleBib.varFields.find(field => field.marcTag === '008')
      expect(MarcSerializer.isControlField(control)).to.equal(true)
    })

    it('returns false for data fields', () => {
      const field100 = sampleBib.varFields[1]
      expect(MarcSerializer.isControlField(field100)).to.equal(false)
    })
  })
})
