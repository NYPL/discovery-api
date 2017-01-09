const util = require('./util')

module.exports = function (app) {
  // Load various two-col csvs mapping column 0 to value in column 1
  var promises = ['prefixes'].map((which) => {
    return util.readCsv(`./data/${which}.csv`).then((rows) => {
      return {
        [which]: rows.reduce((h, r) => {
          h[r[0]] = r[1]
          return h
        }, {})
      }
    })
  })

  return Promise.all(promises).then((globals) => {
    app.globals = globals
    return app
  })
}
