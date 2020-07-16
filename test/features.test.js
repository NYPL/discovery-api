const Feature = require('../lib/feature')

describe('Feature', function () {
  beforeEach(function () {
    process.env.FEATURES = undefined
  })

  it('handles missing env', function () {
    expect(Feature.enabled('foo')).to.equal(false)
  })

  it('handles malformed env', function () {
    process.env.FEATURES = ',,dasdfksdjfdsf,,'
    expect(Feature.enabled('foo')).to.equal(false)
    process.env.FEATURES = -1
    expect(Feature.enabled('foo')).to.equal(false)
    process.env.FEATURES = Math.PI
    expect(Feature.enabled('foo')).to.equal(false)
  })

  it('returns false if feature flag missing', function () {
    process.env.FEATURES = 'several,other,features'
    expect(Feature.enabled('foo')).to.equal(false)
  })

  it('returns true if feature flag found', function () {
    process.env.FEATURES = 'several,other,foo,features'
    expect(Feature.enabled('foo')).to.equal(true)
  })

  it('strips whitespace', function () {
    process.env.FEATURES = 'several ,other  , foo  , features'
    expect(Feature.enabled('foo')).to.equal(true)
  })

  describe('request header overrides', function () {
    it('handles missing request object', function () {
      expect(Feature.enabled('foo')).to.equal(false)
    })

    it('handles missing request header', function () {
      // Ignore non-sensical `request` param:
      expect(Feature.enabled('foo'), new Date()).to.equal(false)
      expect(Feature.enabled('foo'), { headers: {} }).to.equal(false)
    })

    it('honors features enabled by ENV', function () {
      process.env.FEATURES = 'several,other,foo,features'
      expect(Feature.enabled('foo', { headers: { 'x-features': 'bar' } })).to.equal(true)
    })

    it('returns true if feature enabled in ENV and request', function () {
      process.env.FEATURES = 'several,other,foo,features'
      expect(Feature.enabled('foo', { headers: { 'x-features': 'foo' } })).to.equal(true)
    })

    it('returns true if feature only in request', function () {
      process.env.FEATURES = 'several,other,foo,features'
      expect(Feature.enabled('bar', { headers: { 'x-features': 'bar' } })).to.equal(true)
    })

    it('returns true for all features set in either ENV or request', function () {
      process.env.FEATURES = 'several,other,foo,features'
      const request = { headers: { 'x-features': 'bar,other-request-features' } }
      expect(Feature.enabled('several', request)).to.equal(true)
      expect(Feature.enabled('other', request)).to.equal(true)
      expect(Feature.enabled('foo', request)).to.equal(true)
      expect(Feature.enabled('bar', request)).to.equal(true)
      expect(Feature.enabled('other-request-features', request)).to.equal(true)
      expect(Feature.enabled('feature-not-set', request)).to.equal(false)
    })
  })
})
