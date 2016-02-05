var util = require("../lib/util")


module.exports = function(app){

	app.resources = {}

	app.resources.findById = function(id, cb){


		app.db.returnCollectionTripleStore("resources",function(err,resources){
			resources.find({ uri:  parseInt(id)  }).toArray(function(err,results){
				if (results.length==0){
					cb(false)
				}else{
					cb(results[0])
				}
			})
		})		
	}


	app.resources.overview = function(id, cb){

			app.resources.findById(id,function(resource){
				if (!resource){
					cb(false)
					return false
				}

				resource.title = ""
				if (resource['dcterms:title']) if (resource['dcterms:title'][0]) if (resource['dcterms:title'][0].objectLiteral) resource.title = resource['dcterms:title'][0].objectLiteral

				resource.type = "resourcetypes:unk"
				if (resource['dcterms:type']) if (resource['dcterms:type'][0]) if (resource['dcterms:type'][0].objectUri) resource.type = resource['dcterms:type'][0].objectUri

				resource.typeImage = app.thesaurus['typeOfResourceImg'][resource.type]
				

				var data = []
				var checkForCaptures = false



				if (resource['dcterms:title']){
					var ary = { label : "Title", values: [] }
					resource['dcterms:title'].forEach(function(t){
						ary.values.push(t.objectLiteral)
					})
					data.push(ary)
				}

				if (resource['dcterms:alternative']){
					var ary = { label : "Alt-Title", values: [] }
					resource['dcterms:alternative'].forEach(function(t){
						ary.values.push(t.objectLiteral)
					})
					data.push(ary)
				}

				if (resource['dcterms:description']){
					var ary = { label : "Description", values: [] }
					resource['dcterms:description'].forEach(function(t){
						ary.values.push(t.objectLiteral)
					})
					data.push(ary)
				}




				//do the roles
				var ary = { label : "Contributors", values: [] }
				for (var x in resource){
					if (x.search("roles") > -1){
						resource[x].forEach(function(t){
							//console.log(app.thesaurus.relatorMap[x] )
							ary.values.push( { "label" : t.label + " (" + app.thesaurus.relatorMap[x] + ")", "uri" : t.objectUri, "url" : "/agents/" + t.objectUri.split(":")[1] })
						})

					}
				}
				if (resource['dcterms:contributor']){
					resource['dcterms:contributor'].forEach(function(t){
						ary.values.push( { "label" : t.label, "uri" : t.objectUri, "url" : "/agents/" + t.objectUri.split(":")[1] })
					})				
				}
				
				if (ary.values.length>0) data.push(ary)


				if (resource['dcterms:subject']){
					var ary = { label : "Terms", values: [] }
					resource['dcterms:subject'].forEach(function(t){
						if (t.objectUri.search("agents:")>-1){
							ary.values.push( { "label" : t.label, "uri" : t.objectUri, "url" : "/agents/" + t.objectUri.split(":")[1] })
						}else{
							ary.values.push( { "label" : t.label, "uri" : t.objectUri, "url" : "#terms_coming_soon_" + t.objectUri.split(":")[1] })	
						}
						
					})	
					data.push(ary)		
				}
				if (resource['nypl:owner']){
					var ary = { label : "Division", values: [] }
					resource['nypl:owner'].forEach(function(t){
						ary.values.push(  app.thesaurus.orgsMap[t.objectUri])
					})	
					data.push(ary)		
				}
				if (resource['db:dateStart']){
					var ary = { label : "Dates", values: [] }
					resource['db:dateStart'].forEach(function(t){
						ary.values.push( { "label" : "Date Start", "value" : t.objectLiteral })
					})	
					data.push(ary)		
				}
				if (resource['db:dateEnd']){
					var ary = { label : "Dates", values: [] }
					resource['db:dateEnd'].forEach(function(t){
						ary.values.push( { "label" : "Date End", "value" : t.objectLiteral })
					})	
					data.push(ary)		
				}


				if (resource['skos:note']){
					var ary = { label : "Notes", values: [] }
					resource['skos:note'].forEach(function(t){
						if (t.objectLiteral.search("Admin:") == -1){
							ary.values.push( { "label" : "", "value" : t.objectLiteral.replace("\n","  ") })
						}
					})	
					if (ary.values.length>0) data.push(ary)		
				}

				

				if (resource['dcterms:identifier']){
					var ary = { label : "Identifiers", values: [] }
					resource['dcterms:identifier'].forEach(function(t){


						if (t.objectUri.search('barcode')>-1){
							ary.values.push( { "label" : "Barcode", "value" : t.objectUri.split('urn:barcode:')[1], url : false })
						}
						if (t.objectUri.search('urn:bnum:')>-1){
							ary.values.push( { "label" : "BNumber", "value" : t.objectUri.split('urn:bnum:')[1], url : "http://catalog.nypl.org/record=" + t.objectUri.split('urn:bnum:')[1] })
						}
						if (t.objectUri.search('urn:msscoll:')>-1){
							ary.values.push( { "label" : "MSS Col", "value" : t.objectUri.split('urn:msscoll:')[1], url : "http://archives.nypl.org/" + t.objectUri.split('urn:msscoll:')[1] })
						}


						if (t.objectUri.search('urn:oclc:')>-1){
							ary.values.push( { "label" : "OCLC", "value" : t.objectUri.split('urn:oclc:')[1], url : "www.worldcat.org/oclc/" + t.objectUri.split('urn:oclc:')[1] })
						}
						if (t.objectUri.search('urn:uuid:')>-1){ checkForCaptures = true}

						if (t.objectUri.search('urn:isbn:')>-1){
							ary.values.push( { "label" : "ISBN", "value" : t.objectUri.split('urn:isbn:')[1], url : false })
						}
						if (t.objectUri.search('urn:issn:')>-1){
							ary.values.push( { "label" : "ISSN", "value" : t.objectUri.split('urn:issn:')[1], url : false })
						}
						if (t.objectUri.search('urn:owi:')>-1){
							ary.values.push( { "label" : "OCLC Classify", "value" : t.objectUri.split('urn:owi:')[1], url : "http://classify.oclc.org/classify2/ClassifyDemo?owi=" + t.objectUri.split('urn:owi:')[1] })
						}

						
					})	
					if (ary.values.length>0) data.push(ary)	
				}

				if (checkForCaptures){

					app.db.returnCollectionTripleStore("resources",function(err,resources){
						var captureUris = []
						if (resource['pcdm:hasMember']){
							resource['pcdm:hasMember'].forEach(function(c){
								captureUris.push( parseInt(c.objectUri.replace('res:','')) )
							})
						}

						var imageIds = []
						resources.find( { uri : {$in: captureUris} } ).toArray(function(err,resultsCaptures){
							resultsCaptures.forEach(function(cap){
								if (cap['rdf:type'][0].objectUri == 'nypl:Capture'){


									if (cap['nypl:dcflag'][0].objectLiteral){


										var uuid = false
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
							})


							resource.data = data
							resource.images = imageIds
							//console.log("-----")
							//console.log(JSON.stringify(resource,null,2))
							cb(resource)
							
						})
					})



				}else{

					data.imageIds = []
					resource.data = data
					//console.log(JSON.stringify(data,null,2))
					cb(resource)
				}



				
				


				





			})
		//})


	}




	app.resources.byTerm = function(id, cb){


		app.db.returnCollectionTripleStore("resources",function(err,resources){
			resources.find({ allTerms:  parseInt(id)  }).limit(100).toArray(function(err,results){
				if (results.length==0){
					cb(false)
				}else{
					cb(results)
				}
			})
		})		
	}


}