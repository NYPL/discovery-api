const { expect } = require('chai')

const util = require('../lib/util')

describe('Util', function () {
  describe('backslashes', function () {
    it('escapes specials', function () {
      const result = util.backslashes('?', 2)
      // Expect doubly escaped (which looks quadruply escaped here:)
      expect(result).to.equal('\\\\?')
    })
  })

  describe('parseParams', () => {
    it('should parse an int', () => {
      var incoming = { 'foo': '3' }
      var spec = { foo: { type: 'int' } }
      var outgoing = util.parseParams(incoming, spec)

      expect(outgoing).to.be.an('object')
      expect(outgoing.foo).to.equal(3)
    })

    it('should parse a boolean', () => {
      const incoming = { 'true': 'true', 'false': 'false' }
      const spec = { true: { type: 'boolean' }, false: { type: 'boolean' } }
      const outgoing = util.parseParams(incoming, spec)

      expect(outgoing).to.be.an('object')
      expect(outgoing.true).to.equal(true)
      expect(outgoing.false).to.equal(false)
    })

    it('should parse a single value unless multiple allowed', () => {
      var incoming = { 'notRepeatable': ['first val', 'second val'], 'repeatable': ['1', '3'] }
      var spec = { notRepeatable: { type: 'string' }, repeatable: { type: 'int', repeatable: true } }
      var outgoing = util.parseParams(incoming, spec)

      expect(outgoing.notRepeatable).to.be.a('string')
      expect(outgoing.notRepeatable).to.equal('second val')

      expect(outgoing.repeatable).to.be.a('array')
      expect(outgoing.repeatable).to.deep.equal([1, 3])
    })

    it('should parse a hash of filters', () => {
      var incoming = {
        'filters': {
          'subjectLiteral': 'cats',
          'contributorLiteral': ['Contrib 1', 'Contrib 2'],
          'date': '2012',
          'badNumeric': 'blah'
        }
      }
      var spec = {
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
      var outgoing = util.parseParams(incoming, spec)

      expect(outgoing).to.be.an('object')
      expect(outgoing.filters).to.be.a('object')

      expect(outgoing.filters.subjectLiteral).to.be.a('string')
      expect(outgoing.filters.subjectLiteral).to.equal('cats')

      expect(outgoing.filters.date).to.be.a('number')
      expect(outgoing.filters.date).to.equal(2012)

      expect(outgoing.filters.badNumeric).to.be.a('undefined')
    })

    it('should apply defaults', () => {
      var incoming = {
        'q': '',
        'filters': {
          'badNumeric': 'blah'
        }
      }
      var spec = {
        q: { type: 'string', default: 'default query' },
        page: { type: 'int', default: 1 },
        filters: {
          type: 'hash',
          fields: {
            badNumeric: { type: 'int', default: 3 }
          }
        }
      }
      var outgoing = util.parseParams(incoming, spec)

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
      filters: {
        type: 'hash',
        fields: {
          subjectLiteral: {
            type: 'string',
            field: 'subjectLiteral_exploded'
          }
        }
      }
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
      filters: {
        type: 'hash',
        fields: {
          subjectLiteral: {
            type: 'string',
            field: 'subjectLiteral_exploded',
            repeatable: true
          }
        }
      }
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
})
