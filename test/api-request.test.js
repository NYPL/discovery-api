const { expect } = require('chai')

const ApiRequest = require('../lib/api-request')

describe('ApiRequest', function () {
  it('empty params', () => {
    const request = ApiRequest.fromParams({ })
    expect(request.hasKeyword()).to.eq(false)
    expect(request.advancedSearchParams()).to.deep.eq([])
    expect(request.hasScope('keyword')).to.eq(false)
    expect(request.queryIsFullyQuoted()).to.eq(false)
  })

  it('hasKeyword', () => {
    const request = ApiRequest.fromParams({ q: 'toast' })
    expect(request.hasKeyword()).to.eq(true)
  })

  it('hasScope', () => {
    let request = ApiRequest.fromParams({ q: 'toast' })
    expect(request.hasScope('all')).to.eq(false)

    request = ApiRequest.fromParams({ q: 'toast', search_scope: 'all' })
    expect(request.hasScope('all')).to.eq(true)
  })

  it('queryIsFullyQuoted', () => {
    let request = ApiRequest.fromParams({ q: 'toast' })
    expect(request.queryIsFullyQuoted()).to.eq(false)

    request = ApiRequest.fromParams({ q: '"toast"' })
    expect(request.queryIsFullyQuoted()).to.eq(true)

    request = ApiRequest.fromParams({ q: '"toast" and jam' })
    expect(request.queryIsFullyQuoted()).to.eq(false)
  })

  it('querySansQuotes', () => {
    let request = ApiRequest.fromParams({ q: '"toast"' })
    expect(request.querySansQuotes()).to.eq('toast')

    // Don't strip quotes from something not fully quoted:
    request = ApiRequest.fromParams({ q: '"toast" and jam' })
    expect(request.querySansQuotes()).to.eq('"toast" and jam')
  })

  it('advancedSearchParams', () => {
    let request = ApiRequest.fromParams({ q: '"toast"' })
    expect(request.advancedSearchParams()).to.deep.eq([])

    request = ApiRequest.fromParams({ title: '"toast"', foo: 'bar' })
    expect(request.advancedSearchParams()).to.deep.eq(['title'])
  })
})
