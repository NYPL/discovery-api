const { expect } = require('chai')
const MarcSerializer = require('../lib/marc-serializer')

const sampleBibNoParallels = {
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
      marcTag: '005',
      content: '20150416154259.0',
      subfields: [],
      ind1: null,
      ind2: null
    },
    {
      fieldTag: 'y',
      marcTag: '856',
      content: null,
      subfields: [
        { tag: 'u', content: 'This should be suppressed' },
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
      marcTag: '005',
      content: '20150416154259.0',
      subfields: [],
      ind1: null,
      ind2: null
    },
    {
      fieldTag: 'y',
      marcTag: '856',
      content: null,
      subfields: [
        { tag: 'u', content: 'This should be suppressed' },
        { tag: 'z', content: 'This is ok' }
      ],
      ind1: '4',
      ind2: '0'
    },
    {
      fieldTag: 'y',
      marcTag: '880',
      content: null,
      subfields: [
        { tag: '6', content: '856-01' },
        { tag: 'u', content: 'Parallel to suppressed' },
        { tag: 'z', content: 'Parallel to ok' }
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

describe('MarcSerializer', () => {
  describe('serialize', () => {
    let serialized

    before(() => {
      serialized = MarcSerializer.serialize(sampleBibNoParallels)
    })

    it('preserves leader field', () => {
      const leader = serialized.bib.varFields.find(f => f.fieldTag === '_')
      expect(leader).to.exist()
      expect(leader.content).to.equal('00000cam  2200769Ia 4500')
    })

    it('preserves non-suppressed fields', () => {
      const field100 = serialized.bib.varFields.find(f => f.marcTag === '100')
      expect(field100).to.exist()
      expect(field100.subfields.map(sf => sf.content)).to.include('Porter, Bertha,')
    })

    it('masks included subfields according to rules', () => {
      // Find the suppressed field 856
      const field856 = serialized.bib.varFields.find(f => f.marcTag === '856')
      expect(field856).to.exist()

      // 856$u should be blanked
      const subfieldU = field856.subfields.find(s => s.tag === 'u')
      expect(subfieldU).to.exist()
      expect(subfieldU.content).to.satisfy(c => c === null || c === '')

      // 856$z should remain unchanged
      const subfieldZ = field856.subfields.find(s => s.tag === 'z')
      expect(subfieldZ).to.exist()
      expect(subfieldZ.content).to.equal('This is ok')
    })

    it('sorts varFields with leader first', () => {
      expect(serialized.bib.varFields[0].fieldTag).to.equal('_')
    })

    it('keeps all other varFields present', () => {
      const tags = serialized.bib.varFields.map(f => f.marcTag)
      expect(tags).to.include.members(['100', '245', '700', '005'])
    })
  })

  describe('serialize with parallel 880 fields', () => {
    let serialized

    before(() => {
      serialized = MarcSerializer.serialize(sampleBibWithParallels)
    })

    it('suppresses included subfields in both main and parallel 880 fields', () => {
      // Find the original 856 field that should be suppressed
      const field856 = serialized.bib.varFields.find(
        (f) => f.marcTag === '856'
      )
      expect(field856).to.exist()

      // 856$u should be blanked
      const subfieldU856 = field856.subfields.find((s) => s.tag === 'u')
      expect(subfieldU856).to.exist()
      expect(subfieldU856.content).to.satisfy((c) => c === null || c === '')

      // 856$z should remain unchanged
      const subfieldZ856 = field856.subfields.find((s) => s.tag === 'z')
      expect(subfieldZ856.content).to.equal('This is ok')

      // Find the parallel 880 field linked to 856
      const field880 = serialized.bib.varFields.find(
        (f) => f.marcTag === '880'
      )
      expect(field880).to.exist()

      // 880$u (parallel to suppressed) should also be blanked
      const subfieldU880 = field880.subfields.find((s) => s.tag === 'u')
      expect(subfieldU880).to.exist()
      expect(subfieldU880.content).to.satisfy((c) => c === null || c === '')

      // 880$z (parallel to ok) should remain unchanged
      const subfieldZ880 = field880.subfields.find((s) => s.tag === 'z')
      expect(subfieldZ880.content).to.equal('Parallel to ok')
    })
  })

  describe('findParallelFields', () => {
    it('returns empty array when no 880 fields are present', () => {
      const field100 = sampleBibNoParallels.varFields.find(f => f.marcTag === '100')
      const parallels = MarcSerializer.findParallelFields(sampleBibNoParallels, field100)
      expect(parallels).to.be.an('array').that.is.empty()
    })
    it('returns correct parallel 880 for a field', () => {
      const field856 = sampleBibWithParallels.varFields.find(f => f.marcTag === '856')
      const parallels = MarcSerializer.findParallelFields(sampleBibWithParallels, field856)
      expect(parallels).to.have.lengthOf(1)
      expect(parallels[0].marcTag).to.equal('880')
    })
  })

  describe('varFields sort order', () => {
    it('places leader first and sorts other fields numerically by marcTag', () => {
      const serialized = MarcSerializer.serialize(sampleBibWithParallels)
      const varFields = serialized.bib.varFields

      // Leader should be first
      expect(varFields[0].fieldTag).to.equal('_')

      // Remaining fields should be sorted ascending by marcTag
      const marcTags = varFields.slice(1).map(f => parseInt(f.marcTag, 10))
      const sortedTags = [...marcTags].sort((a, b) => a - b)
      expect(marcTags).to.deep.equal(sortedTags)
    })
  })

  describe('isLeaderField', () => {
    it('correctly identifies leader field', () => {
      const leader = sampleBibNoParallels.varFields[0]
      expect(MarcSerializer.isLeaderField(leader)).to.be.true()
    })

    it('returns false for non-leader fields', () => {
      const field100 = sampleBibNoParallels.varFields[1]
      expect(MarcSerializer.isLeaderField(field100)).to.be.false()
    })
  })
})
