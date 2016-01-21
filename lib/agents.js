var md5 = require("md5")

module.exports = function(app){

	app.agents = {}

	app.agents.findById = function(id, cb){

		app.db.returnCollectionTripleStore("agents",function(err,agents){
			agents.find({ uri: "agent:" + id  }).toArray(function(err,results){
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

	app.agents.resources = function(id, tor, cb){


		app.db.returnCollectionTripleStore("resources",function(err,resources){

			var searchObj = {allAgents: parseInt(id), 'dcterms:type' : { $elemMatch: { objectUri: tor} } }

			if (tor=='resourcetypes:unk'){
				searchObj = {allAgents: parseInt(id), 'dcterms:type' : { $exists: false } }
			}


			resources.find( searchObj, {'dcterms:title': 1, uri: 1, 'db:dateStart': 1} ).toArray(function(err,results){
				if (results.length==0){
					cb(false)
				}else{

					var resources = []

					results.forEach(function(r){
						var item = { title : "[Title]", uri: r.uri, dateStart: null}
						if (r['dcterms:title']){
							if (r['dcterms:title'][0]){
								item.title = r['dcterms:title'][0].objectLiteral
							}
						}
						if (r['db:dateStart']){
							if (r['db:dateStart'][0]){
								item.dateStart = r['db:dateStart'][0].objectLiteral
							}
						}
						resources.push(item)
					})
					cb(resources)
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

			if (results.agent.triples['skos:prefLabel']) if (results.agent.triples['skos:prefLabel'][0]) if (results.agent.triples['skos:prefLabel'][0].objectLiteral) results.agent.name = results.agent.triples['skos:prefLabel'][0].objectLiteral
			

			app.agents.reportResourceType(id, function(reportResourceTypeResults){
				results.tor = reportResourceTypeResults
				cb(results)
			})
		})

	}


	app.agents.searchByName = function(text, cb){

		var results = []
		app.esClient.search({
		  index: 'agents',
		  type: 'agent',
		  body: {
			"query": {
				"bool": {
					"must": [{
						"query_string": {
							"default_field": "agent.name",
							"query": text
						}
					}],
					"must_not": [],
					"should": [{
						"wildcard": {
							"wikidata": "Q*"
						}
					}]
				}
			}
		  }
		}).then(function (resp) {
		    var hits = resp.hits.hits;
		    
		    hits.forEach(function(h){

		    	if (h._source.image){

					var imageMd5 = md5(h._source.image)
					var commonsImageLink = "https://upload.wikimedia.org/wikipedia/commons/thumb/" + imageMd5.charAt(0) + '/' + imageMd5.charAt(0) + imageMd5.charAt(1) + '/' + encodeURI(h._source.image) + '/200px-' + encodeURI(h._source.image)
					
					h._source.commonsLink = commonsImageLink
			

		    	}

		    	results.push(h._source)


		    })

		    cb(results)

		}, function (err) {
		    //console.trace(err.message);
		    cb(false)
		});




	}






	



}