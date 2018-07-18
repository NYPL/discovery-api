var wrapper = require('@nypl/sierra-wrapper')

function initialCheck (patronId) {
  const body = {
    json: true,
    method: 'POST',
    body: {
      recordType: 'i',
      recordNumber: 10000000,
      pickupLocation: 'maii2'
    }
  }
  return wrapper.apiPost(`patrons/${patronId}/holds/requests`, body, (errorBibReq, results) => {
    if (errorBibReq) {
      return new Promise((resolve, reject) => {
        resolve(errorBibReq.description === 'XCirc error : Bib record cannot be loaded')
      })
    }
  })
}

function handleEligible () {
  return 'eligible to place holds'
}

function getPatronInfo (patronId) {
  return wrapper.apiGet(`patrons/${patronId}`, (errorBibReq, results) => {
    if (errorBibReq) {
      console.log(errorBibReq)
    }
    return new Promise((resolve, reject) => {
      resolve(results)
    })
  })
}

function finesBlocksOrExpiration (info) {
  info = info.data.entries[0]
  return {
    expired: new Date(info.expirationDate) < new Date(),
    blocked: info.blockInfo.code !== '-', // will want to change this once we have a list of block codes
    moneyOwed: info.moneyOwed > 15 // may want to change this
  }
}

function handleFinesBlocksOrExpiration (data) {
  return JSON.stringify(data)
}

function getPatronHolds (patronId) {
  return 'not yet implemented'
}

function checkEligibility (patronId) {
  console.log(wrapper)
  let config = {
    'key': process.env.SIERRA_KEY,
    'secret': process.env.SIERRA_SECRET,
    'base': process.env.SIERRA_BASE
  }
  wrapper.loadConfig(config)
  return wrapper.promiseAuth((error, results) => {
    if (error) console.log(error)
    return new Promise((resolve, reject) => {
      initialCheck(patronId).then((eligible) => {
        if (eligible) {
          resolve(handleEligible())
        } else {
          getPatronInfo(patronId).then((info) => {
            const issues = finesBlocksOrExpiration(info)
            if (issues.expired || issues.blocked || issues.moneyOwed) {
              resolve(handleFinesBlocksOrExpiration(issues))
            } else {
              resolve(getPatronHolds(patronId))
            }
          })
        }
      })
    })
  })
}

exports.checkEligibility = checkEligibility
