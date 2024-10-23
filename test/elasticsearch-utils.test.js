const esUtils = require('../lib/elasticsearch/utils')

describe('ES utils', () => {
  describe('escapeQuery', function () {
    it('should escape specials', function () {
      expect(esUtils.escapeQuery('? ^ * + (')).to.equal('\\? \\^ \\* \\+ \\(')
    })

    it('should escape unrecognized field indicators', function () {
      expect(esUtils.escapeQuery('fladeedle:gorf')).to.equal('fladeedle\\:gorf')
    })

    it('should not escape recognized field indicators', function () {
      expect(esUtils.escapeQuery('title:gorf')).to.equal('title:gorf')
    })

    it('should escape a single forward slash', function () {
      expect(esUtils.escapeQuery('/')).to.equal('\\/')
    })

    it('should escape floating colon', function () {
      // Make sure colons floating in whitespace are escaped:
      expect(esUtils.escapeQuery('Arkheologii︠a︡ Omska : illi︠u︡strirovannai︠a︡ ėnt︠s︡iklopedii︠a︡')).to.equal('Arkheologii︠a︡ Omska \\: illi︠u︡strirovannai︠a︡ ėnt︠s︡iklopedii︠a︡')
    })

    it('should escape colons in hyphenated phrases', function () {
      expect(esUtils.escapeQuery('Arkheologii︠a︡ Omska : illi︠u︡strirovannai︠a︡ ėnt︠s︡iklopedii︠a︡ / Avtor-sostavitelʹ: B.A. Konikov.')).to.equal('Arkheologii︠a︡ Omska \\: illi︠u︡strirovannai︠a︡ ėnt︠s︡iklopedii︠a︡ \\/ Avtor\\-sostavitelʹ\\: B.A. Konikov.')
    })
  })

  describe('prefixMatch', () => {
    it('builds a prefix clause', () => {
      expect(esUtils.prefixMatch('prop', 'val', 101)).to.nested
        .include({ 'prefix.prop.value': 'val' })
        .include({ 'prefix.prop.boost': 101 })
      // Default boost of 1:
      expect(esUtils.prefixMatch('prop', 'val')).to.nested
        .include({ 'prefix.prop.value': 'val' })
        .include({ 'prefix.prop.boost': 1 })
    })
  })

  describe('termMatch', () => {
    it('builds a term clause', () => {
      expect(esUtils.termMatch('prop', 'val', 101)).to.nested
        .include({ 'term.prop.value': 'val' })
        .include({ 'term.prop.boost': 101 })
      // Default boost of 1:
      expect(esUtils.termMatch('prop', 'val')).to.nested
        .include({ 'term.prop.value': 'val' })
        .include({ 'term.prop.boost': 1 })
    })
  })

  describe('phraseMatch', () => {
    it('builds a match_phrase clause', () => {
      expect(esUtils.phraseMatch('prop', 'val', 101)).to.nested
        .include({ 'match_phrase.prop.query': 'val' })
        .include({ 'match_phrase.prop.boost': 101 })
      // Default boost of 0:
      expect(esUtils.phraseMatch('prop', 'val')).to.nested
        .include({ 'match_phrase.prop.query': 'val' })
        .include({ 'match_phrase.prop.boost': 0 })
    })
  })
})
