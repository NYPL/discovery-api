const Location = require('../lib/models/Location')

describe('Location model', () => {
  it('will return empty delivery locations for an unrequestable onsite location code', function () {
    const loc = new Location(
      {
        holdingLocation: {
          id: 'loc:scf',
          label: 'Schomburg Center - Research & Reference'
        }
      }
    )
    expect(loc.deliveryLocation.length).to.equal(0)
  })
})
