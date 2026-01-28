const { expect } = require('chai')
const MarcSerializer = require('../lib/marc-serializer')

// Mock mapping rules
MarcSerializer.mappingRules = [
  // 700 to be excluded
  {
    marcIndicatorRegExp: /^700/,
    directive: 'exclude',
    subfieldSpec: null
  },
  {
    fieldTag: 'y',
    marcIndicatorRegExp: /^856/,
    directive: 'include',
    subfieldSpec: {
      subfields: [],
      directive: 'include'
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

const sampleBibWithExcludedSourceAndParallel = {
  id: 'testId',
  nyplSource: 'testSource',
  varFields: [
    {
      marcTag: '700',
      ind1: '1',
      ind2: ' ',
      subfields: [
        { tag: '6', content: '880-02/$1' },
        { tag: 'a', content: 'Some name' }
      ]
    },
    {
      marcTag: '880',
      ind1: '1',
      ind2: ' ',
      subfields: [
        { tag: '6', content: '700-02/$1' },
        { tag: 'a', content: '並列表記' }
      ]
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

    it('keeps surviving fields present', () => {
      const tags = serialized.bib.fields.map(f => f.marcTag)
      // Null is the leader, 700 is removed
      expect(tags).to.include.members([null, '100', '245', '856'])
    })
  })

  describe('serialize removes parallel 880 when source field is excluded', () => {
    const serialized = MarcSerializer.serialize(sampleBibWithExcludedSourceAndParallel)

    it('removes the source 700 field', () => {
      const field700 = serialized.bib.fields.find(f => f.marcTag === '700')
      expect(field700).to.equal(undefined)
    })

    it('removes the linked 880 field', () => {
      const field880 = serialized.bib.fields.find(f => f.marcTag === '880')
      expect(field880).to.equal(undefined)
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
      const field700 = sampleBibWithExcludedSourceAndParallel.varFields.find(f => f.marcTag === '700')
      const parallels = MarcSerializer.findParallelFields(sampleBibWithExcludedSourceAndParallel, field700)
      expect(parallels).to.have.lengthOf(1)
      expect(parallels[0].marcTag).to.equal('880')
    })
  })
})
