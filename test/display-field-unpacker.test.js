const { expect } = require('chai')
const displayFieldsUnpacker = require('../lib/display-field-unpacker')
const packedDisplayBib = require('./fixtures/packed-display-response.json')

describe('Display field parser', () => {
  describe('When a bib has a display components property', () => {
    it('adds each of the items in that array as a name, label, nameTitle object', () => {
      const displayFieldsUnpacked = displayFieldsUnpacker(packedDisplayBib).hits.hits[0]._source
      expect(Object.keys(displayFieldsUnpacked).length).to.equal(2)
      expect(displayFieldsUnpacked).to.deep.equal({
        testDisplay: [
          { displayLabel: 'Smith, John, author', name: 'Smith, John', nameTitle: 'Smith, John' },
          { displayLabel: 'Bayer, Jeffrey. Cataloging test record.', name: 'Bayer, Jeffrey', nameTitle: 'Bayer, Jeffrey Cataloging test record' },
          { displayLabel: 'Org Inc.', name: 'Org Inc', nameTitle: 'Org Inc' }
        ],
        testOtherDisplay: [
          { displayLabel: 'Bean, Richard, 1956-, editor', name: 'Bean, Richard, 1956-', nameTitle: 'Bean, Richard, 1956-' }
        ]
      })
    })
  })
})
