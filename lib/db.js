'use strict'

var MongoClient = require('mongodb').MongoClient
var config = require('config')

var __connection = null
function connect () {
  // returns a promise:
  if (__connection) {
    return Promise.resolve(__connection)
  } else {
    return MongoClient.connect(config.get('TripleStore.mongoConnectURL')).then((connection) => {
      __connection = connection
      return __connection
    })
  }
}

class TriplesDoc {
  constructor (h) {
    this.statements = h
    this.uri = h.uri
    /* for (var k in h) {
      this[k] = h[k]
    }
    */
  }

  has (pred) {
    return Object.keys(this.statements).indexOf(pred) >= 0
  }

  each (pred, cb) {
    return this.statements[pred].map((trip) => cb(trip))
  }

  literal (pred, def) {
    return (this.statements[pred] && this.statements[pred][0] && this.statements[pred][0].objectLiteral) || def
  }

}

TriplesDoc.from = (record) => {
  return new TriplesDoc(record)
}

var db = {}

db.connect = connect
db.resources = () => connect().then((connection) => connection.collection('resources'))
db.resources.findOne = (query) => db.resources().then((coll) => coll.findOne(query)).then(TriplesDoc.from)
db.resources.find = (query) => db.resources().then((coll) => coll.find(query)).then((records) => records.map(TriplesDoc.from))

db.TriplesDoc = TriplesDoc

/*
var exports = module.exports = {}

var mongoConnectURLTripleStore = config['TripleStore']['mongoConnectURL']

exports.databaseTripleStore = null
exports.collectionLookup = {}

exports.databaseConnectTripleStore = function (cb) {
  if (exports.databaseTripleStore) {
    if (cb) cb()
    return true
  }
  MongoClient.connect(mongoConnectURLTripleStore, function (err, dbTripleStore) {
    if (err) {
      console.log('Error connecting to registry:', err)
    } else {
      console.log('[DB]:Connected to NYPL PCDM Triplestore')
      exports.databaseTripleStore = dbTripleStore
    }

    if (cb) cb()
  })
}

exports.returnCollectionTripleStore = function (collectionName, cb) {
  exports.databaseConnectTripleStore(function () {
    if (exports.collectionLookup[collectionName]) {
      cb(null, exports.collectionLookup[collectionName])
    } else {
      var collection = exports.databaseTripleStore.collection(collectionName)
      exports.collectionLookup[collectionName] = collection
      cb(null, exports.collectionLookup[collectionName])
    }
  })
}
*/

module.exports = db
