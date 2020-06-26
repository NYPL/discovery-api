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
})
