const util = require('../lib/util')

describe('Util', function () {
  describe('backslashes', function () {
    it('escapes specials', function () {
      const result = util.backslashes('?', 2)
      // Expect doubly escaped (which looks quadruply escaped here:)
      expect(result).to.equal('\\\\?')
    })
  })
})
