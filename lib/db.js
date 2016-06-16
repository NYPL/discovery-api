// this module works with the datastore to do things~

var MongoClient = require('mongodb').MongoClient
var config = require('config')
// var Db = require('mongodb').Db
// var Server = require('mongodb').Server

var exports = module.exports = {}

var mongoConnectURLTripleStore = config['TripleStore']['mongoConnectURL']
// var mongoIpTripleStore = config['TripleStore']['mongoIp']
// var mongoPortTripleStore = config['TripleStore']['mongoPort']
// var mongoDbTripleStore = config['TripleStore']['mongoDb']

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
      console.log('[DB]:Connecting to Registry Triplestore')
      exports.databaseTripleStore = dbTripleStore
    }

    if (cb) cb()
  })
}

exports.returnCollectionTripleStore = function (collectionName, cb) {
  var connect = (cb) => {
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
  // Support both callback and promise interface:
  if (!cb) {
    return new Promise((resolve, reject) => {
      connect((err, connection) => {
        if (connection) resolve(connection)
        else reject(err)
      })
    })
  } else {
    connect(cb)
  }
}

// exports.returnBibCollection = function(cb){

// 	var db = new Db(mongoDb, new Server(mongoIp, mongoPort))

// 	db.open(function(err, db) {

// 		var collection = db.collection('bib')

// 		cb(err, collection, db)

// 	})

// }

// //do a janky cache for the really large ones
// exports.storeSample = function(classmark, sampleJson){

// 	MongoClient.connect(mongoApiConnectURL, function(err, db) {

// 		var collection = db.collection('sampleStore')

// 		//delete any existing data first
// 		collection.remove({ _id: classmark },

// 			function(err, results) {

// 				var insert = {
// 					_id : classmark,
// 					json : sampleJson,
// 					timestamp : (Math.floor(Date.now() / 1000)  )
// 				}

// 				//store the new data
// 				collection.insert(insert, function(err, result) {
// 					console.log(err)
// 					db.close()
// 				})
// 			}
// 		)

// 	})

// }

// exports.retriveSample = function(classmark, cb){

// 	if (!classmark){
// 		cb([])
// 		return false
// 	}

// 	//check to see if we have it
// 	MongoClient.connect(mongoApiConnectURL, function(err, db) {

// 		var collection = db.collection('sampleStore')

// 		collection.find({ _id: classmark }).toArray(function(err, docs) {

// 			if (docs.length == 0){

// 				cb(err,false)

// 			}else{

// 				//we have it, check to see if it is still fresh (1 week)

// 				var r = docs[0]

// 				var setDate = r.timestamp

// 				if (Math.floor(Date.now() / 1000) - r.timestamp > 604800){
// 					cb(err,false)
// 				}else{
// 					cb(err,r.json)
// 				}
// 			}

// 			db.close()

// 		})
// 	})

// }

// exports.sampleByLccRange = function(range, cb){

// 	if (!range){
// 		cb([])
// 		return false
// 	}

// 	//range = range.toLowerCase().replace(/\./g,'').replace(/_/g,' ')

// 	exports.retriveSample(range,function(err,cache){

// 		if (cache){

// 			cb(null,JSON.parse(cache))

// 		}else{

// 			MongoClient.connect(mongoConnectURL, function(err, db) {

// 				var collection = (exports.testOverride) ? db.collection('test') : db.collection('bib')
// 				collection.find({ 'sc:lccCoarse' : range, 'sc:research': true}, {title: 1, publishYear: 1 }).sort( { _id : -1} ).limit(50).toArray(function(err, docs) {

// 					var r = []

// 					for (var x in docs){
// 						r.push({id:docs[x]['_id'], title:docs[x]['title'], publishYear:docs[x]['publishYear']})
// 					}

// 					db.close()
// 					cb(err,r)

// 					//store this result for later
// 					exports.storeSample(range,JSON.stringify(r))

// 				})
// 			})

// 		}

// 	})

// }

// exports.sampleByClassmark = function(classmark, cb){

// 	if (!classmark){
// 		cb([])
// 		return false
// 	}

// 	classmark = classmark.toLowerCase().replace(/\./g,'').replace(/_/g,' ')

// 	exports.retriveSample(classmark,function(err,cache){

// 		if (cache){

// 			cb(null,JSON.parse(cache))

// 		}else{

// 			MongoClient.connect(mongoConnectURL, function(err, db) {

// 				var collection = (exports.testOverride) ? db.collection('test') : db.collection('bib')
// 				collection.find({ 'sc:classmark' : classmark, 'sc:research': true}, {title: 1, publishYear: 1 }).sort( { _id : -1} ).limit(50).toArray(function(err, docs) {

// 					var r = []
// 					for (var x in docs){
// 						r.push({id:docs[x]['_id'], title:docs[x]['title'], publishYear:docs[x]['publishYear']})
// 					}

// 					db.close()
// 					cb(err,r)

// 					//store this result for later
// 					exports.storeSample(classmark,JSON.stringify(r))

// 				})
// 			})

// 		}

// 	})

// }

// exports.returnBots = function(cb){

// 	MongoClient.connect(mongoConnectURL, function(err, db) {
// 		var collection = (exports.testOverride) ? db.collection('test') : db.collection('bots')
// 		collection.find().sort({$natural: -1}).limit(50).toArray(function(err, docs) {
// 			db.close()
// 			cb(err,docs)
// 		})
// 	});
// }

// exports.returnBnumber = function(id,cb){

// 	//if a db is already active

// 	if (!id) return {}

// 	MongoClient.connect(mongoConnectURL, function(err, db) {

// 		id = id.replace(/b/gi,'').replace(/\s/gi,'')
// 		id = parseInt(id)
// 		console.log(err)
// 		var collection = (exports.testOverride) ? db.collection('test') : db.collection('bib')
// 		collection.find({_id : id}).toArray(function(err, docs) {

// 			db.close()
// 			cb(err,docs,db)
// 		})
// 	});

// }

// exports.returnAudience = function(q,cb){

// 	if (!q) return {}

// 	for (var x in q){
// 		if (q[x]['sc:oclc']) q[x]['sc:oclc'] = parseInt(q[x]['sc:oclc'])
// 		if (q[x]['classify:oclc']) q[x]['classify:oclc'] = parseInt(q[x]['classify:oclc'])
// 		if (q[x]['classify:owi']) q[x]['classify:owi'] = parseInt(q[x]['classify:owi'])
// 		if (q[x]['_id']) q[x]['_id'] = parseInt(q[x]['_id'].replace(/b/gi,'').replace(/\s/gi,''))
// 	}

// 	MongoClient.connect(mongoConnectURL, function(err, db) {
// 		if (err) console.log(err)

// 		var collection = (exports.testOverride) ? db.collection('test') : db.collection('bib')
// 		collection.find({ $or: q }).toArray(function(err, docs) {

// 			var owis = []

// 			docs.forEach(function(d){
// 				if (d['classify:owi']){
// 					owis.push(d['classify:owi'])
// 				}
// 			})

// 			if (owis.length==0) owis=[-9999999]

// 			console.log(JSON.stringify({ 'classify:owi' : { $in : owis } }))

// 			collection.find({ 'classify:owi' : { $in : owis } }).toArray(function(err, owiDocs) {

// 				docs = docs.concat(owiDocs)

// 				var bnumbers = []

// 				docs.forEach(function(b){
// 					bnumbers.push(b._id)
// 				})

// 				console.log(bnumbers,"<<")
// 				var collection = (exports.testOverride) ? db.collection('test') : db.collection('item')
// 				collection.find( {bibIds: { $in:  bnumbers } }).toArray(function(err, allItems) {

// 					var results = {

// 						isChildren: false,
// 						isYoungAdult : false,
// 						childrenType: false,
// 						youngAdultType: false

// 					}

// 					var countFiction = 0, countNonFiction = 0, countYa = 0, countChildren = 0, countAdult = 0
// 					var childrensType = {
// 						"YoungReader" :  0,
// 						"WorldLanguages" :  0,
// 						"Reference" :  0,
// 						"PictureBook" :  0,
// 						"NonPrint" :  0,
// 						"NonFiction" :  0,
// 						"HolidayBook" :  0,
// 						"Fiction" :  0,
// 						"FairyTale" :  0,
// 						"EasyBook" :  0,
// 						"DisabilitiesCollection" :  0
// 					}

// 					var youngAdultType = {
// 						"WorldLanguages" :  0,
// 						"Reference" :  0,
// 						"NonPrint" :  0,
// 						"NonFiction" :  0,
// 						"Fiction" :  0
// 					}

// 					allItems.forEach(function(i){

// 						console.log(i.location)

// 						if (i.location.name){
// 							if (i.location.name.search(/non\-fiction/i)>-1){
// 								countNonFiction++
// 							}else if (i.location.name.search(/fiction/i)>-1){
// 								countFiction++
// 							}

// 							if (i.location.name.search(/YA/)>-1){
// 								countYa++
// 							}else if (i.location.name.search(/Young Adult/i)>-1){
// 								countYa++
// 							}else if (i.location.name.search(/Children/i)>-1){
// 								countChildren++
// 							}else if (i.location.name.search(/Adult/i)>-1){
// 								countAdult++
// 							}

// 							if (i.location.name.search(/Young Reader/i)>-1){
// 								childrensType['YoungReader']++
// 							}else if (i.location.name.search(/World Languages/i)>-1){
// 								childrensType['WorldLanguages']++
// 							}else if (i.location.name.search(/Reference/i)>-1){
// 								childrensType['Reference']++
// 							}else if (i.location.name.search(/Picture Book/i)>-1){
// 								childrensType['PictureBook']++
// 							}else if (i.location.name.search(/Non\-Print/i)>-1){
// 								childrensType['NonPrint']++
// 							}else if (i.location.name.search(/Non\-fiction/i)>-1){
// 								childrensType['NonFiction']++
// 							}else if (i.location.name.search(/Holiday Book/i)>-1){
// 								childrensType['HolidayBook']++
// 							}else if (i.location.name.search(/fiction/i)>-1){
// 								childrensType['Fiction']++
// 							}else if (i.location.name.search(/Fairy Tale/i)>-1){
// 								childrensType['FairyTale']++
// 							}else if (i.location.name.search(/Easy Book/i)>-1){
// 								childrensType['EasyBook']++
// 							}else if (i.location.name.search(/Disabilities Collection/i)>-1){
// 								childrensType['DisabilitiesCollection']++
// 							}

// 							if (i.location.name.search(/World Languages/i)>-1){
// 								youngAdultType['WorldLanguages']++
// 							}else if (i.location.name.search(/Reference/i)>-1){
// 								youngAdultType['Reference']++
// 							}else if (i.location.name.search(/Non\-Print/i)>-1){
// 								youngAdultType['NonPrint']++
// 							}else if (i.location.name.search(/Non\-fiction/i)>-1){
// 								youngAdultType['NonFiction']++
// 							}else if (i.location.name.search(/fiction/i)>-1){
// 								youngAdultType['Fiction']++
// 							}

// 						}

// 					})

// 					if (countChildren > 0 || countYa > 0){

// 						if (countChildren>countYa){
// 							results.isChildren = true
// 							var type = "",topCount=0
// 							for (var x in childrensType){
// 								if (childrensType[x]>topCount){
// 									type = x
// 									topCount = childrensType[x]
// 								}
// 							}
// 							if (type!="") results.childrenType = type
// 							console.log(type)

// 						}else{
// 							results.isYoungAdult = true
// 							var type = "",topCount=0
// 							for (var x in youngAdultType){
// 								if (youngAdultType[x]>topCount){
// 									type = x
// 									topCount = youngAdultType[x]
// 								}
// 							}
// 							if (type!="") results.youngAdultType = type
// 							console.log(type)

// 						}

// 					}

// 					db.close()
// 					cb(err,results,db)

// 				})

// 			})

// 		})
// 	});

// }

// exports.returnStockNumber = function(id,cb){

// 	if (!id) return []

// 	MongoClient.connect(mongoConnectURL, function(err, db) {

// 		var collection = (exports.testOverride) ? db.collection('test') : db.collection('bib')
// 		collection.find({ 'sc:stockNumber' :  id}).toArray(function(err, docs) {

// 			db.close()
// 			cb(err,docs,db)
// 		})
// 	});

// }
// exports.returnOwi = function(id,cb){

// 	if (!id) return []

// 	id = parseInt(id)

// 	MongoClient.connect(mongoConnectURL, function(err, db) {

// 		var collection = (exports.testOverride) ? db.collection('test') : db.collection('bib')
// 		collection.find({ 'classify:owi' :  id}).toArray(function(err, docs) {

// 			db.close()
// 			cb(err,docs,db)
// 		})
// 	});

// }

// exports.returnWorksByIsbn = function(id,cb){

// 	//if a db is already active

// 	if (!id) return []

// 	MongoClient.connect(mongoConnectURL, function(err, db) {

// 		id = id.toString()

// 		var collection = (exports.testOverride) ? db.collection('test') : db.collection('bib')

// 		collection.find( { 'sc:isbn' : id  } ).toArray(function(err, docs) {

// 			if (docs.length > 0){

// 				var workIds = []

// 				for (var x in docs){
// 					if (docs[x]['classify:owi']){
// 						workIds.push(docs[x]['classify:owi'])
// 					}

// 				}

// 				collection.find( { 'classify:owi' : { $in : workIds }  } ).toArray(function(err, workDocs) {

// 					db.close()
// 					cb(err,workDocs,db)

// 				})

// 			}else{

// 				db.close()
// 				cb(err,[],db)

// 			}

// 		})
// 	});

// }

// exports.returnBibById = function(id,cb,db){

// 	//if a db is already active
// 	if (db){

// 		var collection = (exports.testOverride) ? db.collection('test') : db.collection('bib')
// 		collection.find({_id : id}).toArray(function(err, docs) {
// 			cb(err,docs)
// 		})

// 	}else{

// 		MongoClient.connect(mongoConnectURL, function(err, db) {
// 			var collection = (exports.testOverride) ? db.collection('test') : db.collection('bib')
// 			collection.find({_id : id}).toArray(function(err, docs) {
// 				db.close()
// 				cb(err,docs)
// 			})
// 		});

// 	}

// }

// exports.returnItemByBibIds = function(id,cb,db){

// 	if (!id) return {}

// 	id = id.replace(/b/gi,'').replace(/\s/gi,'')
// 	id = parseInt(id)

// 	//if a db is already active
// 	if (db){

// 		var collection = (exports.testOverride) ? db.collection('test') : db.collection('item')
// 		collection.find({bibIds : id}).toArray(function(err, docs) {
// 			cb(err,docs)
// 		})

// 	}else{

// 		MongoClient.connect(mongoConnectURL, function(err, db) {
// 			var collection = (exports.testOverride) ? db.collection('test') : db.collection('item')
// 			collection.find({bibIds : id}).toArray(function(err, docs) {
// 				db.close()
// 				cb(err,docs)
// 			})
// 		})

// 	}

// }

// exports.allBibs = function(cb){

// 	MongoClient.connect(mongoConnectURL, function(err, db) {
// 		var collection = (exports.testOverride) ? db.collection('test') : db.collection('bib')

// 		var cursor = collection.find({})

// 		cursor.on('data', function(doc) {

// 			cursor.pause()

// 			//send the data to the calling function with the cursor

// 			cb(doc,cursor,db)

// 		})

// 		cursor.once('end', function() {
// 			db.close()
// 		})

// 	})

// }

// exports.allItemsReverse = function(cb){

// 	MongoClient.connect(mongoConnectURL, function(err, db) {

// 		console.log(err)

// 		var collection = (exports.testOverride) ? db.collection('test') : db.collection('item')

// 		var cursor = collection.find({}).sort({ $natural: -1 })

// 		cursor.on('data', function(doc) {

// 			cursor.pause()

// 			//send the data to the calling function with the cursor

// 			cb(doc,cursor,db)

// 		})

// 		cursor.once('end', function() {
// 			db.close()
// 		})

// 	})

// }

// // exports.dropTestCollection = function(cb){
// // 	MongoClient.connect(mongoConnectURL, function(err, db) {
// // 		var collection = db.collection('test')
// // 		collection.drop(function(err, reply) {
// // 			if (cb) cb(reply)
// // 		})
// // 	})
// // }

// exports.returnNextApiHoldingsWork = function(cb){

// 	MongoClient.connect(mongoConnectURL, function(err, db) {
// 		var collection = (exports.testOverride) ? db.collection('test') : db.collection('apiHoldings')
// 		collection.find().limit(1).toArray(function(err, docs) {
// 			db.close()
// 			cb(err,docs)
// 		})
// 	})

// }

// exports.deleteApiHoldingsWork = function(id,cb){

// 	MongoClient.connect(mongoConnectURL, function(err, db) {
// 		var collection = (exports.testOverride) ? db.collection('test') : db.collection('apiHoldings')
// 		collection.remove({_id : id}, function(err, results){

// 			if (err) console.log(err)

// 			db.close()
// 			cb(err,results)

// 		})

// 	})

// }

// exports.returnNextApiLccnWork = function(cb){

// 	MongoClient.connect(mongoConnectURL, function(err, db) {
// 		if (err) console.log(err)
// 		var collection = (exports.testOverride) ? db.collection('test') : db.collection('apiLccn')
// 		collection.find().limit(1).toArray(function(err, docs) {
// 			db.close()
// 			cb(err,docs)
// 		})
// 	})

// }

// exports.deleteApiLccnWork = function(id,cb){

// 	MongoClient.connect(mongoConnectURL, function(err, db) {
// 		var collection = (exports.testOverride) ? db.collection('test') : db.collection('apiLccn')
// 		collection.remove({_id : id}, function(err, results){

// 			if (err) console.log(err)

// 			db.close()
// 			cb(err,results)

// 		})

// 	})

// }
