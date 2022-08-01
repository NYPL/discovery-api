const {
  requestableBasedOnHoldingLocation,
  requestableBasedOnStatus,
  requestableBasedOnStatusAndHoldingLocation
} = require('../lib/requestability_determination')

describe('requestableBasedOnStatusAndHoldingLocation', function () {
  it('will flip a requestable item to not-requestable if its holding location is requestable=false', function () {
    let notRequestableByHoldingLocation = {
      holdingLocation: [ { id: 'loc:gdjr', label: 'I know that gdjr is currently flagged as not requestable' } ],
      status: [{id: 'status:a', label: 'Available (this should be knocked back because of location, not status)'}]
    }
    expect(requestableBasedOnStatusAndHoldingLocation(notRequestableByHoldingLocation)).to.equal(false)
  })

  it('will flip a requestable item if its availability status is requestable=false', function () {
    let notRequestableByStatus = {
      holdingLocation: [ { id: 'loc:rc2ma', label: 'I know that rc2ma is currently flagged as requestable' } ],
      status: [{ id: 'status:f', label: 'being filmed (i know this is mapped to requestable=false)' }]
    }

    expect(requestableBasedOnStatusAndHoldingLocation(notRequestableByStatus)).to.equal(false)
  })
})

describe('requestableBasedOnHoldingLocation', function () {
  // These expectations rely on the requestability of these locations being
  // somewhat static, which has been generally true

  it('identifies a non-requestable location', function () {
    expect(
      requestableBasedOnHoldingLocation({
        holdingLocation: [ { id: 'loc:rccd8' } ]
      })
    ).to.equal(false)
  })

  it('identifies a requestable location', function () {
    expect(
      requestableBasedOnHoldingLocation({
        holdingLocation: [ { id: 'loc:rcpm2' } ]
      })
    ).to.equal(true)
  })
})

describe('requestableBasedOnStatus', function () {
  it('identifies a non-requestable status', function () {
    expect(
      requestableBasedOnStatus({
        status: [ { id: 'status:b' } ]
      })
    ).to.equal(false)
  })

  it('identifies a requestable status', function () {
    expect(
      requestableBasedOnStatus({
        status: [ { id: 'status:a' } ]
      })
    ).to.equal(true)
  })
})
