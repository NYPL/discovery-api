// Wrapper for vanilla js lib: https://github.com/rayvoelker/js-loc-callnumbers/

var execfile = require('../execfile')

module.exports = { LocParser: execfile('./lib/js-loc-callnumbers/locCallClass.js').locCallClass }
