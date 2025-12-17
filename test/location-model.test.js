const Location = require('../lib/models/Item')

describe('Location model', () => {
  it.only('will return empty delivery locations for an unrequestable onsite location code', function () {
    const loc = new Location([
      {
        id: 'loc:scf',
        label: 'Schomburg Center - Research & Reference'
      }
    ])
    expect(loc.deliveryLocation.length).to.equal(0)
  })
})
