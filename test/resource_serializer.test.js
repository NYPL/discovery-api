const { expect } = require('chai')
const { ResourceSerializer } = require('../lib/jsonld_serializers')
const esResponse = require('./fixtures/item-filter-aggregations.json')
describe('Resource Serializer', () => {
  describe('collectionIds', () => {
    it('should attach collection entities', async () => {
      const resource = await ResourceSerializer.serialize(require('./fixtures/collection-bib.json'))
      expect(resource.collection).to.deep.equal([
        {
          '@id': 'mal',
          buildingLocationLabel: 'Stephen A. Schwarzman Building (SASB)',
          prefLabel: 'General Research Division'
        },
        {
          '@id': 'bur',
          buildingLocationLabel: 'Stavros Niarchos Foundation Library (SNFL)',
          prefLabel: 'Yoseloff Business Center'
        }
      ])
    })
  })
  describe('format format', () => {
    it('should format properly', () => {
      expect(ResourceSerializer.getFormattedFormat('a')).to.deep.equal([{ '@id': 'a', prefLabel: 'Book/Text' }])
    })
  })
  describe('formatCollection', () => {
    it('should format collection entity', () => {
      const collectionEntity = ResourceSerializer.getFormattedCollections(['mab'])[0]
      expect(collectionEntity.prefLabel).to.equal('Art & Architecture Collection')
      expect(collectionEntity['@id']).to.equal('mab')
      expect(collectionEntity.buildingLocationLabel).to.equal('Stephen A. Schwarzman Building (SASB)')
    })
  })
  describe('.formatItemFilterAggregations()', () => {
    let aggregationsFormatted
    before(() => {
      const aggs = esResponse.aggregations
      aggregationsFormatted = ResourceSerializer.formatItemFilterAggregations(aggs)
    })
    it('should return an array', () => {
      expect(aggregationsFormatted).to.be.an('array')
    })
    it('should format properly', () => {
      expect(aggregationsFormatted).to.deep.equal([
        {
          '@type': 'nypl:Aggregation',
          '@id': 'res:location',
          id: 'location',
          field: 'location',
          values: [
            {
              value: 'loc:maf92',
              count: 1,
              label: 'Schwarzman Building M2 - Dorot Jewish Division Room 111'
            }
          ]
        },
        {
          '@type': 'nypl:Aggregation',
          '@id': 'res:format',
          id: 'format',
          field: 'format',
          values: []
        },
        {
          '@type': 'nypl:Aggregation',
          '@id': 'res:status',
          id: 'status',
          field: 'status',
          values: [
            {
              value: 'status:a',
              count: 1,
              label: 'Available'
            }
          ]
        }
      ])
    })
  })
})
