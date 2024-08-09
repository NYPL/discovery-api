const sinon = require('sinon')
const scsbRestClient = require('@nypl/scsb-rest-client')
const scsbClient = require('../lib/scsb-client')

describe('scsb-client', () => {
  describe('getItemsAvailabilityForBnum', () => {
    beforeEach(() => {
      sinon.stub(scsbRestClient, 'scsbQuery')
        .callsFake((path, body) => {
          return Promise.resolve([
            {
              itemBarcode: 'some-barcode',
              itemAvailabilityStatus: 'Available'
            }
          ])
        })
    })

    afterEach(() => {
      scsbRestClient.scsbQuery.restore()
    })

    it('returns barcode-status map for NYPL bnum', () => {
      return scsbClient.getItemsAvailabilityForBnum('b123')
        .then((resp) => {
          // Verify SCSB API hit once:
          expect(scsbRestClient.scsbQuery.callCount).to.equal(1)
          // Verify SCSB bibAvailabilityStatus query performed
          expect(scsbRestClient.scsbQuery.firstCall.args[0])
            .to.equal('/sharedCollection/bibAvailabilityStatus')
          expect(scsbRestClient.scsbQuery.firstCall.args[1])
            .to.deep.equal({
              institutionId: 'NYPL',
              // Verify payload has NYPL padded bnum:
              bibliographicId: '.b1235'
            })

          // Verify stubbed response is intact
          expect(resp).to.deep.equal([
            {
              itemBarcode: 'some-barcode',
              itemAvailabilityStatus: 'Available'
            }
          ])
        })
    })

    it('returns barcode-status map for partner bnum', () => {
      return scsbClient.getItemsAvailabilityForBnum('hb123')
        .then((resp) => {
          // Verify SCSB API hit once:
          expect(scsbRestClient.scsbQuery.callCount).to.equal(1)
          // Verify SCSB bibAvailabilityStatus query performed
          expect(scsbRestClient.scsbQuery.firstCall.args[0])
            .to.equal('/sharedCollection/bibAvailabilityStatus')
          expect(scsbRestClient.scsbQuery.firstCall.args[1])
            .to.deep.equal({
              institutionId: 'HL',
              // Verify payload has original HL bnum:
              bibliographicId: '123'
            })
        })
    })
  })
})
