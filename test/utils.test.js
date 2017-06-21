const parseParams = require('../lib/util').parseParams

describe('Util', () => {
  describe('parseParams', () => {
    it('should parse an int', () => {
      var incoming = { 'foo': '3' }
      var spec = { foo: { type: 'int' } }
      var outgoing = parseParams(incoming, spec)

      expect(outgoing).to.be.an('object')
      expect(outgoing.foo).to.equal(3)
    })

    it('should parse a single value unless multiple allowed', () => {
      var incoming = { 'notRepeatable': ['first val', 'second val'], 'repeatable': ['1', '3'] }
      var spec = { notRepeatable: { type: 'string' }, repeatable: { type: 'int', repeatable: true } }
      var outgoing = parseParams(incoming, spec)

      expect(outgoing.notRepeatable).to.be.a('string')
      expect(outgoing.notRepeatable).to.equal('second val')

      expect(outgoing.repeatable).to.be.a('array')
      expect(outgoing.repeatable).to.deep.equal([1, 3])
    })

    it('should parse a hash of filters', () => {
      var incoming = {
        'filters': {
          'subjectLiteral': 'cats',
          'contributorLiteral': [ 'Contrib 1', 'Contrib 2' ],
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
      var outgoing = parseParams(incoming, spec)

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
      var outgoing = parseParams(incoming, spec)

      expect(outgoing).to.be.an('object')

      expect(outgoing.q).to.equal('')

      expect(outgoing.page).to.equal(1)

      expect(outgoing.filters.badNumeric).to.be.a('number')
      expect(outgoing.filters.badNumeric).to.equal(3)
    })
  })
})
