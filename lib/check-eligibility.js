
var wrapper = require('@nypl/sierra-wrapper');
// need to deal with wrapper for auth and postApi


function initialCheck(patronId) {
  const body = {
    json: true,
    method: 'POST',
    body: {
      recordType: 'i',
      recordNumber: 10000000,
      pickupLocation: 'maii2'
    },
  };
  return wrapper.apiPost(`patrons/${patronId}/holds/requests`, body, (errorBibReq, results) => {
    if (errorBibReq) {
      return new Promise((resolve, reject) => {
        resolve(errorBibReq.description === 'XCirc error : Bib record cannot be loaded');
      });
    }
  });
}

function handleEligible() {
  return JSON.stringify('eligible to place holds');
}

function getPatronInfo(patronId) {
  return wrapper.apiGet(`patrons/${patronId}`, (errorBibReq, results) => {
    if (errorBibReq) {
      console.log(errorBibReq);
    }
    return new Promise((resolve, reject) => {
      resolve(results);
    });
  });
}

function finesBlocksOrExpiration(info) {
  // console.log('info: ', JSON.stringify(info, null, 2))
  info = info.data.entries[0];
  // return {}
  return {
    expired: new Date(info.expirationDate) < new Date(),
    blocked: info.blockInfo.code !== "-", //will want to change this once we have a list of block codes
    moneyOwed: info.moneyOwed > 15, //may want to change this
  };
}

function handleFinesBlocksOrExpiration(data) {
  return JSON.stringify(data);
}

function getPatronHolds(patronId) {
  return JSON.stringify('not ready for this');
}

function checkEligibility(patronId) {

  console.log(wrapper);
  const loadedConfig = wrapper.loadConfig('/Users/danielappel/sierra-api/patron-eligibility/credentials.json');
  return wrapper.newAuth((error, results) => {
    return new Promise((resolve, reject) => {
      initialCheck(patronId).then((eligible) => {
        if (eligible) {
          resolve(handleEligible());
        } else {
          getPatronInfo(patronId).then((info) => {
            const phinesBlocksOrExpiration = finesBlocksOrExpiration(info);
            if(phinesBlocksOrExpiration.expired || phinesBlocksOrExpiration.blocked || phinesBlocksOrExpiration.moneyOwed) {
              resolve(handleFinesBlocksOrExpiration(phinesBlocksOrExpiration));
            } else {
              resolve(getPatronHolds(patronId))
            }
          });
        }
      })
    })
  })
}

exports.checkEligibility = checkEligibility;
