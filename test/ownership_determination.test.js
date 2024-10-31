const isItemNyplOwned = require('../lib/ownership_determination').isItemNyplOwned

describe('isItemNyplOwned', function () {
  it('will only return true for certain items', function () {
    const fakeNyplItems = [
      { uri: 'i10022734' },
      { uri: 'i123489' },
      // An item generated from a checkin card in a holding has this form:
      { uri: 'i-h1234-1' }
    ]
    const fakeColumbiaItems = [{ uri: 'ci10022734' }, { uri: 'ci123489' }]
    const fakePrincetonItems = [{ uri: 'pi10022734' }, { uri: 'pi123489' }]
    const fakeNonsenseItems = [{ uri: 'jsaoisjosjiaosjio' }, { uri: 'hello-mother' }]

    fakeNyplItems.forEach((nyplItem) => {
      expect(isItemNyplOwned(nyplItem)).to.equal(true)
    })

    fakeColumbiaItems.forEach((columbiaItem) => {
      expect(isItemNyplOwned(columbiaItem)).to.equal(false)
    })

    fakePrincetonItems.forEach((princetonItem) => {
      expect(isItemNyplOwned(princetonItem)).to.equal(false)
    })

    fakeNonsenseItems.forEach((fakeNonsenseItem) => {
      expect(isItemNyplOwned(fakeNonsenseItem)).to.equal(false)
    })
  })
})
