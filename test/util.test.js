const { expect } = require('chai')
const mangledEnumerationChronologyItems = require('./fixtures/mangled_enumerationChronology_items.json')

const util = require('../lib/util')
const { FILTER_CONFIG } = require('../lib/elasticsearch/config')

describe('Util', function () {
  describe('sortOnPropWithUndefinedLast', () => {
    it('sorts badly formatted enumerationChronologies that result in undefined enumerationChronology_sort last', () => {
      const sortedItemEnums = mangledEnumerationChronologyItems
        .sort(util.sortOnPropWithUndefinedLast('enumerationChronology_sort'))
        .map((item) => item.enumerationChronology)
      expect(sortedItemEnums).to.deep.equal([
        ['Feb 7 2007 - Feb 13 2007'],
        ['Feb 8 2002 - Feb 14 2002'],
        ['Sept. 1-15, 1979'],
        ['Sept. 1-24, 1957'],
        ['Aug 1 216 - Aug 10 216'],
        ['Feb. 1-14, 19828']
      ])
    })
  })
  describe('backslashes', function () {
    it('escapes specials', function () {
      const result = util.backslashes('?', 2)
      // Expect doubly escaped (which looks quadruply escaped here:)
      expect(result).to.equal('\\\\?')
    })
  })

  describe('parseParams', () => {
    it('should parse an int', () => {
      const incoming = { foo: '3' }
      const spec = { foo: { type: 'int' } }
      const outgoing = util.parseParams(incoming, spec)

      expect(outgoing).to.be.an('object')
      expect(outgoing.foo).to.equal(3)
    })

    it('should parse a boolean', () => {
      const incoming = { true: 'true', false: 'false' }
      const spec = { true: { type: 'boolean' }, false: { type: 'boolean' } }
      const outgoing = util.parseParams(incoming, spec)

      expect(outgoing).to.be.an('object')
      expect(outgoing.true).to.equal(true)
      expect(outgoing.false).to.equal(false)
    })

    it('should parse a single value unless multiple allowed', () => {
      const incoming = { notRepeatable: ['first val', 'second val'], repeatable: ['1', '3'] }
      const spec = { notRepeatable: { type: 'string' }, repeatable: { type: 'int', repeatable: true } }
      const outgoing = util.parseParams(incoming, spec)

      expect(outgoing.notRepeatable).to.be.a('string')
      expect(outgoing.notRepeatable).to.equal('second val')

      expect(outgoing.repeatable).to.be.a('array')
      expect(outgoing.repeatable).to.deep.equal([1, 3])
    })

    it('should parse a hash of filters', () => {
      const incoming = {
        filters: {
          subjectLiteral: 'cats',
          contributorLiteral: ['Contrib 1', 'Contrib 2'],
          date: '2012',
          badNumeric: 'blah'
        }
      }
      const spec = {
        filters: {
          type: 'hash',
          fields: {
            subjectLiteral: { type: 'string' },
            contributorLiteral: { type: 'string' },
            date: { type: 'int' },
            badNumeric: { type: 'int' }
          }
        }
      }
      const outgoing = util.parseParams(incoming, spec)

      expect(outgoing).to.be.an('object')
      expect(outgoing.filters).to.be.a('object')

      expect(outgoing.filters.subjectLiteral).to.be.a('string')
      expect(outgoing.filters.subjectLiteral).to.equal('cats')

      expect(outgoing.filters.date).to.be.a('number')
      expect(outgoing.filters.date).to.equal(2012)

      expect(outgoing.filters.badNumeric).to.be.a('undefined')
    })

    it('should apply defaults', () => {
      const incoming = {
        q: '',
        filters: {
          badNumeric: 'blah'
        }
      }
      const spec = {
        q: { type: 'string', default: 'default query' },
        page: { type: 'int', default: 1 },
        filters: {
          type: 'hash',
          fields: {
            badNumeric: { type: 'int', default: 3 }
          }
        }
      }
      const outgoing = util.parseParams(incoming, spec)

      expect(outgoing).to.be.an('object')

      expect(outgoing.q).to.equal('')

      expect(outgoing.page).to.equal(1)

      expect(outgoing.filters.badNumeric).to.be.a('number')
      expect(outgoing.filters.badNumeric).to.equal(3)
    })
  })

  it('should strip a terminal period from a single subjectLiteral', () => {
    const incoming = {
      filters: {
        subjectLiteral: 'Cats.'
      }
    }

    const spec = {
      filters: { type: 'hash', fields: FILTER_CONFIG }
    }

    const outgoing = util.parseParams(incoming, spec)
    expect(outgoing.filters.subjectLiteral).to.equal('Cats')
  })

  it('should string a terminal period from each subjectLiteral in an array', () => {
    const incoming = {
      filters: {
        subjectLiteral: ['Cats.', 'Dogs.']
      }
    }

    const spec = {
      filters: { type: 'hash', fields: FILTER_CONFIG }
    }

    const outgoing = util.parseParams(incoming, spec)
    expect(outgoing.filters.subjectLiteral.length).to.equal(2)
    expect(outgoing.filters.subjectLiteral[0]).to.equal('Cats')
    expect(outgoing.filters.subjectLiteral[1]).to.equal('Dogs')
  })

  describe('parseParam', () => {
    it('parses an int', () => {
      expect(util.parseParam('12', { type: 'int' })).to.equal(12)
    })

    it('fails to parse an invalid int', () => {
      expect(util.parseParam('fladeedle', { type: 'int' })).to.be.a('undefined')
    })

    it('parses a string', () => {
      expect(util.parseParam('fladeedle', { type: 'string' })).to.equal('fladeedle')
    })

    it('parses a range of ints', () => {
      expect(util.parseParam('1', { type: 'int-range' })).to.deep.equal([1])
      expect(util.parseParam('1-2', { type: 'int-range' })).to.deep.equal([1, 2])
      expect(util.parseParam('1 - 2', { type: 'int-range' })).to.deep.equal([1, 2])
    })

    it('parses a list of strings', () => {
      expect(util.parseParam('1', { type: 'string-list' })).to.deep.equal(['1'])
      expect(util.parseParam('1,2', { type: 'string-list' })).to.deep.equal(['1', '2'])
      expect(util.parseParam('foo,bar', { type: 'string-list' })).to.deep.equal(['foo', 'bar'])
    })
  })

  describe('deepValue', () => {
    it('extracts existant values', () => {
      expect(util.deepValue({ a: { b: { c: 'foo' } } }, 'a.b')).to.deep.equal({ c: 'foo' })
      expect(util.deepValue({ a: { b: { c: 'foo' } } }, 'a.b.c')).to.deep.equal('foo')
      expect(util.deepValue({ a: { b: [{ b1: 'foo' }, { b2: 'foo2' }] } }, 'a.b[1].b2')).to.deep.equal('foo2')
    })

    it('returns null/undefined for nonexistant values', () => {
      expect(util.deepValue({ a: { b: { c: 'foo' } } }, 'a.b.x')).to.deep.equal(null)
      expect(util.deepValue({ a: { b: { c: 'foo' } } }, 'x.y')).to.deep.equal(null)
      expect(util.deepValue({ a: { b: { c: 'foo' } } }, 'a.b.c.d')).to.deep.equal(null)
      expect(util.deepValue({ a: { b: [{ b1: 'foo' }] } }, 'a.b[1].b2')).to.deep.equal(null)
    })

    it('resorts to default for nonexistant values', () => {
      expect(util.deepValue({ a: { b: { c: 'foo' } } }, 'x.y', 'fladeedle')).to.deep.equal('fladeedle')
    })
  })

  describe('itemHasRecapHoldingLocation', () => {
    it('identifies an item with a rc location', () => {
      expect(util.itemHasRecapHoldingLocation({ holdingLocation: [{ id: 'loc:rc' }] })).to.equal(true)
      expect(util.itemHasRecapHoldingLocation({ holdingLocation: [{ id: 'loc:rc2ma' }] })).to.equal(true)
    })

    it('rejects an item with a non-rc location', () => {
      expect(util.itemHasRecapHoldingLocation({ holdingLocation: [{ id: 'loc:xx' }] })).to.equal(false)
      expect(util.itemHasRecapHoldingLocation({ holdingLocation: [] })).to.equal(false)
      expect(util.itemHasRecapHoldingLocation({})).to.equal(false)
    })
  })

  describe('barcodeFromItem', () => {
    it('extracts barcode from item', () => {
      expect(util.barcodeFromItem({ identifier: ['urn:barcode:1234'] })).to.equal('1234')
      expect(util.barcodeFromItem({ identifier: ['urn:another:foo', 'urn:barcode:1234'] })).to.equal('1234')
      expect(util.barcodeFromItem({ identifier: ['', null, 'fladeedle', 'urn:barcode:1234'] })).to.equal('1234')
    })

    it('gracefully handles missing identifier prop', () => {
      expect(util.barcodeFromItem({})).to.equal(null)
      expect(util.barcodeFromItem({ identifier: null })).to.equal(null)
      expect(util.barcodeFromItem({ identifier: [] })).to.equal(null)
      expect(util.barcodeFromItem({ identifier: [null] })).to.equal(null)
    })
  })
})
