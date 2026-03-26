const { expect } = require('chai')
const displayFieldsUnpacker = require('../lib/display-field-unpacker')
const packedDisplayBib = require('./fixtures/packed-display-response.json')

describe('Display field unpacker', () => {
  describe('When a bib has a packed display property', () => {
    it('adds each of the items in that array as unpacked objects', () => {
      const displayFieldsUnpacked = displayFieldsUnpacker(packedDisplayBib).hits.hits[0]._source
      expect(Object.keys(displayFieldsUnpacked).length).to.equal(2)
      expect(displayFieldsUnpacked).to.deep.equal({
        testDisplay: [
          { value: 'someValue', display: 'someDisplay' },
          { value: 'someValueB', display: 'someDisplayB' },
          { value: 'someValueC', display: null }
        ],
        testOtherDisplay: [
          { value: 'otherValue', display: 'otherDisplay' }
        ]
      })
    })
  })
})
