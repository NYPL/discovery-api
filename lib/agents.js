var md5 = require("md5")
var async = require("async")
var config = require("config")

var util = require("../lib/util")

module.exports = function(app){

	app.agents = {}

	app.agents.findById = function(id, cb){

		app.db.returnCollectionTripleStore("agents",function(err,agents){
			agents.find({ uri: parseInt(id)  }).toArray(function(err,results){
				if (results.length==0){
					cb(false)
				}else{
					cb(results[0])
				}
			})
		})		
	}


	app.agents.reportResourceType = function(id, cb){


		app.db.returnCollectionTripleStore("resources",function(err,resources){

			

			resources.find( {allAgents: parseInt(id) }, { 'dcterms:type' : 1, 'dcterms:identifier' : 1 } ).toArray(function(err,results){
				if (results.length==0){
					cb(false)
				}else{
					var torMap = {}
					//make a map of the differnt types
					results.forEach(function(r){
						if (r['dcterms:type']){
							r['dcterms:type'].forEach(function(r){
								if (!torMap[r.objectUri]) torMap[r.objectUri] = { label: app.thesaurus.typeOfResource[r.objectUri], count: 0}					
								torMap[r.objectUri].count++
							})
						}else{
							if (!torMap['resourcetypes:unk']) torMap['resourcetypes:unk'] = { label: 'Unspecified', count: 0}		
							torMap['resourcetypes:unk'].count++
						}
					})
					cb(torMap)
				}
			})
		})
	}

	app.agents.imagesOf = function(id, cb){

		

		app.db.returnCollectionTripleStore("resources",function(err,resources){

			resources.find( {allAgents: parseInt(id) }, { 'dcterms:type' : 1, 'dcterms:identifier' : 1, 'uri' : 1, 'dcterms:subject' : 1, 'dcterms:subject' : 1, 'pcdm:hasMember': 1  } ).toArray(function(err,results){
				if (results.length==0){
					cb(false)
				}else{


					var check = []
					var captureUris = []
					results.forEach(function(r){
						if (r['dcterms:identifier']){
							r['dcterms:identifier'].forEach(function(ident){
								if (ident.objectUri.search('urn:uuid')>-1){
									check.push(r)
								}
							})
						}

					})
					check.forEach(function(r){
						if (r['dcterms:subject']){
							r['dcterms:subject'].forEach(function(s){
								if (s.objectUri == 'agents:' + id){
									if (r['pcdm:hasMember']){
										r['pcdm:hasMember'].forEach(function(c){
											captureUris.push( parseInt(c.objectUri.replace('res:','')) )
										})
									}

								}
							})
						}
					})
					
					var imageIds = []

					resources.find( { uri : {$in: captureUris} } ).toArray(function(err,resultsCaptures){
						resultsCaptures.forEach(function(cap){
							if (cap['rdf:type'][0].objectUri == 'nypl:Capture'){

								var uuid = false
								
								if (cap['nypl:dcflag']){
									if (cap['nypl:dcflag'][0]){
										if (cap['nypl:dcflag'][0].objectLiteral){
											cap['dcterms:identifier'].forEach(function(id){
												if (id.objectUri.search('urn:uuid:') > -1){
													uuid = id.objectUri.replace("urn:uuid:",'')
												}
											})
											imageIds.push({
												imageId: cap['nypl:filename'].map(function( i ){ return i.objectLiteral  }),
											    uuid: uuid

											})
										}

									}
								}

							}
						})

						cb(imageIds)
						
					})

					
					
					

				}
			})
		})
	}

	// app.agents.resources = function(id, tor, cb){

	// 	app.db.returnCollectionTripleStore("resources",function(err,resources){

	// 		var searchObj = {allAgents: parseInt(id), 'dcterms:type' : { $elemMatch: { objectUri: tor} } }

	// 		if (tor=='resourcetypes:unk'){
	// 			searchObj = {allAgents: parseInt(id), 'dcterms:type' : { $exists: false } }
	// 		}


	// 		resources.find( searchObj, {'dcterms:title': 1, uri: 1, 'db:dateStart': 1} ).toArray(function(err,results){
	// 			if (results.length==0){
	// 				cb(false)
	// 			}else{

	// 				var resources = []

	// 				results.forEach(function(r){
	// 					var item = { title : "[Title]", uri: r.uri, dateStart: null}
	// 					if (r['dcterms:title']){
	// 						if (r['dcterms:title'][0]){
	// 							item.title = r['dcterms:title'][0].objectLiteral
	// 						}
	// 					}
	// 					if (r['db:dateStart']){
	// 						if (r['db:dateStart'][0]){
	// 							item.dateStart = r['db:dateStart'][0].objectLiteral
	// 						}
	// 					}
	// 					resources.push(item)
	// 				})
	// 				cb(resources)
	// 			}
	// 		})
	// 	})
	// }

	app.agents.resources = function(id, cb){



		app.db.returnCollectionTripleStore("resources",function(err,resources){

			var searchObj = {allAgents: parseInt(id) }

			var contributed = {}, about = {}


			resources.find( searchObj).limit(5000).toArray(function(err,results){
				if (results.length==0){
					cb(false)
				}else{

					results.forEach(r => {

						var resource = util.flatenTriples(r)

						var tor = ["Unspecified"]

						if (resource.objectUri['dcterms:type']){
							tor = []
							resource.objectUri['dcterms:type'].forEach(t=>{
								tor.push(config['thesaurus']['typeOfResource'][t])
							})

						}

						tor = tor.join(" / ")

						var isContributor = false

						//see if this resource is by the agent or it is about the subject
						for (var x in resource.objectUri){

							if (config['predicateCreators'].indexOf(x)>-1){
								if (resource.objectUri[x].indexOf('agents:'+id)>-1){
									isContributor = true
								}
							}
						}


						var item = { title : "[Title]", uri: r.uri, dateStart: null}
						if (resource.objectLiteral['dcterms:title']) if (resource.objectLiteral['dcterms:title'][0]) item.title = resource.objectLiteral['dcterms:title'][0]
						if (resource.objectLiteral['db:dateStart']) if (resource.objectLiteral['db:dateStart'][0]) item.dateStart = resource.objectLiteral['db:dateStart'][0] 

						if (isContributor){							
							if (!contributed[tor]) contributed[tor] = []
							contributed[tor].push(item)
						}else{
							if (!about[tor]) about[tor] = []
							about[tor].push(item)
						}

						




					})


					cb({ contributed: contributed, about: about })
				}
			})
		})
	}


	app.agents.overview = function(id, cb){

		var results = {}

		app.agents.findById(id, function(findByIdResults){

			if (!findByIdResults){
				cb(false)
				return
			}

			results.agent = findByIdResults

			results.agent.name = ""

			if (results.agent['skos:prefLabel']) if (results.agent['skos:prefLabel'][0]) if (results.agent['skos:prefLabel'][0].objectLiteral) results.agent.name = results.agent['skos:prefLabel'][0].objectLiteral
			
			results.flat = util.flatenTriples(findByIdResults)

			var wikidataID = false

			if (results.flat.objectUri['skos:exactMatch']){
				results.flat.objectUri['skos:exactMatch'].forEach(uri => {
					if (uri.substr(0,8) === 'wikidata'){
						wikidataID = uri.split('wikidata:')[1]
					}

				})
			}

			var depiction = false
			if (results.flat.objectLiteral['foaf:depiction']){
				if (results.flat.objectLiteral['foaf:depiction'][0]){
					if (wikidataID){
						var filename = results.flat.objectLiteral['foaf:depiction'][0].substr(results.flat.objectLiteral['foaf:depiction'][0].length-4,4).toLowerCase()
						if (filename=='jpeg') filename = '.jpg'
						if (filename=='tiff') filename = '.tif'	
						if (filename=='.svg') filename = '.png'
						if (filename=='.tif') filename = '.jpg'
						if (filename.search(/\./)==-1) filename = "."+filename
						depiction = "https://s3.amazonaws.com/data.nypl.org/wikimedia_cache/" + wikidataID + filename
					}
				}
			}
			results.agent.depiction = depiction


			var description = ""
			if (results.flat.objectLiteral['dcterms:description']){
				if (results.flat.objectLiteral['dcterms:description'][0]){
					description = results.flat.objectLiteral['dcterms:description'][0]
				}
			}			

			results.agent.description = description


			// async.parallel({

				// es: function(callback) {

				// 	app.esClient.get({
				// 	  index: 'agentstest',
				// 	  type: 'agenttest',
				// 	  id: id
				// 	}, function (error, response) {

				// 		if (response) response = response._source
					  

				// 		callback(null,response)


				// 	});



				// },
			// 	tor: function(callback) {

			// 		app.agents.reportResourceType(id, function(reportResourceTypeResults){
			// 			callback(null,reportResourceTypeResults)
			// 		})


			// 	}


			// }, function(err, asyncResults) {
				// results is now equals to: {one: 'abc\n', two: 'xyz\n'}

				//results.es = asyncResults.es
				// results.tor = asyncResults.tor

				// console.log(results)
				cb(results)


			// });




		})

	}

	var searchAgentByName = function(text,fuzziness,max_expansions,cb){
		var results = []
		app.esClient.search({
		  index: 'agents',
		  type: 'agent',
		  body: {
			  "query": {
			    "function_score": {
			      "query": {
			        "bool": {
			          "should": [
			            {
			              "match": {
			                "label.folded": {
			                  "query": text,
			                  "operator": "and",
			                  "fuzziness": fuzziness,
			                  "max_expansions": max_expansions
			                }
			              }
			            },
			            {
			              "range": {
			                "useCount": {
			                  "gt": 100,
			                  "boost": 10
			                }
			              }
			            },
			            {
			              "term": {
			                "type": "Person"
			              }
			            }
			          ]
			        }
			      }
			    }
			  },
			  "min_score": 0.65,
			  "size": 50
			}
		}).then(function (resp) {
		    var hits = resp.hits.hits;		    
		    hits.forEach(function(h){
		    	//console.log(h)
		    	if (h._source.depiction){					
					h._source.depiction = "https://s3.amazonaws.com/data.nypl.org/wikimedia_cache/" + h._source.depiction
		    	}
		    	results.push(h._source)
		    })
		    cb(results)
		}, function (err) {
		    //console.trace(err.message);
		    cb(false)
		})
	}

	app.agents.searchByName = function(text, cb){

		searchAgentByName(text,0,1,function(results){

			if (results.length==0){
				searchAgentByName(text,5,10,function(results){
					if (results.length==0){
						searchAgentByName(text,10,20,function(results){
							cb(results)

						})
					}else{
						cb(results)
					}
					
				})
			}else{
				cb(results)
			}
		})
	}

	app.agents.randomAgents = function(cb){

		var results = []
		app.esClient.search({
		  index: 'agentstest',
		  type: 'agenttest',
		  body: {
			  "size": 3,
			  "query": {
			    "function_score": {
			      "functions": [
			        {
			          "random_score": {
			            "seed": Math.floor(Math.random() * (4000000 - 1 + 1)) + 1
			          }
			        }
			      ],
			      "query": {
			        "filtered": {
			          "filter": {
			            "bool": {
			              "must": {},
			              "should": {},
			              "must_not": {
			                "missing": {
			                  "field": "depiction",
			                  "existence": true,
			                  "null_value": true
			                }
			              }
			            }
			          }
			        }
			      },
			      "score_mode": "sum"
			    }
			  }
			}
		}).then(function (resp) {

		    var hits = resp.hits.hits;		    
		    hits.forEach(function(h){
		    	//console.log(h)
		    	if (h._source.depiction){					
					h._source.depiction = "https://s3.amazonaws.com/data.nypl.org/wikimedia_cache/" + h._source.depiction
		    	}
		    	results.push(h._source)
		    })

		    cb(results)
		}, function (err) {
		    //console.trace(err.message);
		    cb(false)
		})

	}










	



}
