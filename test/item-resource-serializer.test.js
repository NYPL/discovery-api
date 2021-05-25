const { ItemResourceSerializer } = require('../lib/jsonld_serializers')

describe('ItemResourceSerializer', () => {
  const originalCoreVersion = process.env.NYPL_CORE_VERSION

  before(() => {
    process.env.NYPL_CORE_VERSION = 'v1.37a'
  })

  after(() => {
    process.env.NYPL_CORE_VERSION = originalCoreVersion
  })

  describe('sourceIdentifierPrefixByNyplSource', () => {
    it('produces camel case form of nypl source', () => {
      expect(ItemResourceSerializer.sourceIdentifierPrefixByNyplSource('sierra-nypl')).to.eq('SierraNypl')
      expect(ItemResourceSerializer.sourceIdentifierPrefixByNyplSource('recap-cul')).to.eq('RecapCul')
      expect(ItemResourceSerializer.sourceIdentifierPrefixByNyplSource('recap-pul')).to.eq('RecapPul')
      expect(ItemResourceSerializer.sourceIdentifierPrefixByNyplSource('recap-hl')).to.eq('RecapHl')
      expect(ItemResourceSerializer.sourceIdentifierPrefixByNyplSource('recap-someotherlibraryacronym')).to.eq('RecapSomeotherlibraryacronym')
    })
  })

  describe('serialize', () => {
    it('adds entity form of NYPL source identifier', () => {
      const item = ItemResourceSerializer.addSourceIdentifier({
        uri: 'i22566485',
        identifier: [
          'urn:barcode:33433058338470'
        ]
      })
      const doc = ItemResourceSerializer.serialize(item)
      expect(doc).to.be.a('object')
      expect(doc['@id']).to.eq('res:i22566485')
      expect(doc['identifier']).to.be.a('array')
      expect(doc['identifier'][0]).to.eq('urn:barcode:33433058338470')
      expect(doc['identifier'][1]).to.eq('urn:SierraNypl:22566485')
      expect(doc['idNyplSourceId']).to.be.a('object')
      expect(doc['idNyplSourceId']['@type']).to.eq('SierraNypl')
      expect(doc['idNyplSourceId']['@value']).to.eq('22566485')
    })

    it('adds entity form of CUL source identifier', () => {
      const item = ItemResourceSerializer.addSourceIdentifier({
        uri: 'ci98765'
      })
      const doc = ItemResourceSerializer.serialize(item)

      expect(doc).to.be.a('object')
      expect(doc['@id']).to.eq('res:ci98765')
      expect(doc['identifier']).to.be.a('array')
      expect(doc['identifier'][0]).to.eq('urn:RecapCul:98765')
      expect(doc['idNyplSourceId']).to.be.a('object')
      expect(doc['idNyplSourceId']['@type']).to.eq('RecapCul')
      expect(doc['idNyplSourceId']['@value']).to.eq('98765')
    })

    it('adds entity form of HL source identifier', () => {
      const item = ItemResourceSerializer.addSourceIdentifier({
        uri: 'hi9876543210'
      })
      const doc = ItemResourceSerializer.serialize(item)

      expect(doc).to.be.a('object')
      expect(doc['@id']).to.eq('res:hi9876543210')
      expect(doc['identifier']).to.be.a('array')
      expect(doc['identifier'][0]).to.eq('urn:RecapHl:9876543210')
      expect(doc['idNyplSourceId']).to.be.a('object')
      expect(doc['idNyplSourceId']['@type']).to.eq('RecapHl')
      expect(doc['idNyplSourceId']['@value']).to.eq('9876543210')
    })
  })

  describe('addSourceIdentifier', () => {
    it('adds source identifier for NYPL', () => {
      const item = { uri: 'i1234' }

      const itemWithSourceIds = ItemResourceSerializer.addSourceIdentifier(item)
      expect(itemWithSourceIds).to.be.a('object')
      expect(itemWithSourceIds.identifier).to.be.a('array')
      expect(itemWithSourceIds.identifier[0]).to.eq('urn:SierraNypl:1234')
    })

    it('adds source identifier for CUL', () => {
      const item = { uri: 'ci1234' }

      const itemWithSourceIds = ItemResourceSerializer.addSourceIdentifier(item)
      expect(itemWithSourceIds).to.be.a('object')
      expect(itemWithSourceIds.identifier).to.be.a('array')
      expect(itemWithSourceIds.identifier[0]).to.eq('urn:RecapCul:1234')
    })

    it('adds source identifier for PUL', () => {
      const item = { uri: 'pi1234' }

      const itemWithSourceIds = ItemResourceSerializer.addSourceIdentifier(item)
      expect(itemWithSourceIds).to.be.a('object')
      expect(itemWithSourceIds.identifier).to.be.a('array')
      expect(itemWithSourceIds.identifier[0]).to.eq('urn:RecapPul:1234')
    })

    it('adds source identifier for HL', () => {
      const item = { uri: 'hi1234' }

      const itemWithSourceIds = ItemResourceSerializer.addSourceIdentifier(item)
      expect(itemWithSourceIds).to.be.a('object')
      expect(itemWithSourceIds.identifier).to.be.a('array')
      expect(itemWithSourceIds.identifier[0]).to.eq('urn:RecapHl:1234')
    })
  })
})
