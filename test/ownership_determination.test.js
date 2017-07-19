var isItemNyplOwned = require('../lib/ownership_determination').isItemNyplOwned

describe('isItemNyplOwned', function () {
  it('will only return true for certain items', function () {
    let fake_nypl_items = [{uri: 'i10022734'}, {uri: 'i123489'}]
    let fake_columbia_items = [{uri: 'ci10022734'}, {uri: 'ci123489'}]
    let fake_princeton_items = [{uri: 'pi10022734'}, {uri: 'pi123489'}]
    let fake_nonsense_items = [{uri: 'jsaoisjosjiaosjio'}, {uri: 'hello-mother'}]

    fake_nypl_items.forEach((nypl_item) => {
      expect(isItemNyplOwned(nypl_item)).to.equal(true)
    })

    fake_columbia_items.forEach((columbia_item) => {
      expect(isItemNyplOwned(columbia_item)).to.equal(false)
    })

    fake_princeton_items.forEach((princeton_item) => {
      expect(isItemNyplOwned(princeton_item)).to.equal(false)
    })

    fake_nonsense_items.forEach((fake_nonsense_item) => {
      expect(isItemNyplOwned(fake_nonsense_item)).to.equal(false)
    })
  })
})
