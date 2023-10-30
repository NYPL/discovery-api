const sinon = require('sinon')
const ScsbRestClient = require('@nypl/scsb-rest-client')
const scsbClient = require('../lib/scsb-client')

describe('scsb-client', () => {
  describe('getItemsAvailabilityForBnum', () => {
    beforeEach(() => {
      sinon.stub(ScsbRestClient.prototype, 'scsbQuery')
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
      ScsbRestClient.prototype.scsbQuery.restore()
    })

    it('returns barcode-status map for NYPL bnum', () => {
      return scsbClient.getItemsAvailabilityForBnum('b123')
        .then((resp) => {
          // Verify SCSB API hit once:
          expect(ScsbRestClient.prototype.scsbQuery.callCount).to.equal(1)
          // Verify SCSB bibAvailabilityStatus query performed
          expect(ScsbRestClient.prototype.scsbQuery.firstCall.args[0])
            .to.equal('/sharedCollection/bibAvailabilityStatus')
          expect(ScsbRestClient.prototype.scsbQuery.firstCall.args[1])
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
          expect(ScsbRestClient.prototype.scsbQuery.callCount).to.equal(1)
          // Verify SCSB bibAvailabilityStatus query performed
          expect(ScsbRestClient.prototype.scsbQuery.firstCall.args[0])
            .to.equal('/sharedCollection/bibAvailabilityStatus')
          expect(ScsbRestClient.prototype.scsbQuery.firstCall.args[1])
            .to.deep.equal({
              institutionId: 'HL',
              // Verify payload has original HL bnum:
              bibliographicId: '123'
            })
        })
    })
  })
})
