var util = require("../lib/util")
var async = require("async")
var config = require("config")

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

	app.resources.overviewNtriples = function(id, cb){
		app.resources.findById(id,function(resource){
			if (!resource){
				cb(false)
				return false
			}
			cb(util.returnNtTriples(resource,'resource').join("\n"))
		})

	}

	app.resources.overviewJsonld = function(id, cb){
		app.resources.overview(id,function(resource){
			if (!resource){
				cb(false)
				return false
			}
			//return the full context when spefically requesting jsonld format
			resource['@context'] = util.context
			for (var x in resource){
				if (Array.isArray(resource[x])) if (resource[x].length==0) delete resource[x]
			}
			cb(resource)

		})

	}

	app.resources.overview = function(id, cb){

		app.resources.findById(id,function(resource){
			if (!resource){
				cb(false)
				return false
			}		

			var base = {
				"@context": util.contextAll,
				"@id" : "res:"+id,
				"@type" : [],
				'startYear' : [],
				'endYear' : [],
				'thumbnail' : [],
				'filename' : [],
				'owner' : [],
				'dcFlag' : [],
				'publicDomain' : [],
				'hasMember' : [],
				'memberOf' : [],
				'hasEquivalent' : [],
				'idBarcode' : [],
				'idBnum' : [],
				'idMss' : [],
				'idMssColl' : [],
				'idObjNum' : [],
				'idRlin' : [],
				'idOclc' : [],
				'idOclcExact' : [],
				'idExhib' : [],
				'idUuid' : [],
				'idCallnum' : [],
				'idCatnyp' : [],
				'idMmsDb' : [],
				'idIsbn' : [],
				'idIssn' : [],
				'idHathi' : [],
				'idLccCoarse' : [],
				'idOwi' : [],
				'idDcc' : [],
				'idLcc' : [],
				'idAcqnum' : [],	
				'note' : [],
				'title' : [],
				'type' : [],
				'titleAlt' : [],
				//'identifier' : [],
				'description' : [],
				'contributor' : [],
				'subject' : [],
				'language' : [],
				'holdingCount' : [],
				'suppressed' : false
			}


			if (resource['rdf:type']){
				resource['rdf:type'].forEach(x => base['@type'].push(x.objectUri) )
			}
			if (resource['dcterms:title']){
				resource['dcterms:title'].forEach(x => base.title.push(x.objectLiteral) )
			}
			if (resource['dcterms:type']){
				resource['dcterms:type'].forEach(x => {
					base.type.push({
						'@id' : x.objectUri,
						"prefLabel" : config['thesaurus']['typeOfResource'][x.objectUri]
					}) 
				})
			}

			if (base.type.length==0) base.type.push({
				'@id' : "resourcetypes:unk",
				"prefLabel" : "Unspecified"
			}) 

			if (resource['db:dateStart']){
				resource['db:dateStart'].forEach(x => {
					base.startYear.push( (isNaN(x.objectLiteral) ? x.objectLiteral : parseInt(x.objectLiteral) ) )
				})
			}
			if (resource['db:dateEnd']){
				resource['db:dateEnd'].forEach(x => {
					base.endYear.push( (isNaN(x.objectLiteral) ? x.objectLiteral : parseInt(x.objectLiteral) ) )
				})
			}
			if (resource['nypl:filename']){
				resource['nypl:filename'].forEach(x => {
					base.filename.push(x.objectLiteral)
				})
			}

			if (resource['nypl:owner']){
				resource['nypl:owner'].forEach(x => {
					base.owner.push({
						'@id' : x.objectUri,
						"prefLabel" : config['thesaurus']['orgsMap'][x.objectUri]
					}) 
				})
			}
			if (resource['nypl:dcflag']){
				resource['nypl:dcflag'].forEach(x => {
					base.dcFlag.push(x.objectLiteral)
				})
			}
			if (resource['nypl:publicDomain']){
				resource['nypl:publicDomain'].forEach(x => {
					base.publicDomain.push(x.objectLiteral)
				})
			}

			var hasMembers = []
			if (resource['pcdm:hasMember']){
				resource['pcdm:hasMember'].forEach(x => {						
					hasMembers.push(parseInt(x.objectUri.split(":")[1]))
				})
			}
			var memberOf =[]
			if (resource['pcdm:memberOf']){
				resource['pcdm:memberOf'].forEach(x => {						
					memberOf.push(parseInt(x.objectUri.split(":")[1]))
				})
			}


			//TODO hasEquivalent



			if (resource['dcterms:identifier']){

				resource['dcterms:identifier'].forEach(function(t){


					if (t.objectUri.search('barcode')>-1){
						base.idBarcode.push(parseInt(t.objectUri.split('urn:barcode:')[1]))
					}

					if (t.objectUri.search('urn:bnum:')>-1){
						base.idBnum.push(t.objectUri.split('urn:bnum:')[1])
					}

					if (t.objectUri.search('urn:msscoll:')>-1){
						base.idMssColl.push(parseInt(t.objectUri.split('urn:msscoll:')[1]))
					}

					if (t.objectUri.search('urn:mss:')>-1){
						base.idMss.push(parseInt(t.objectUri.split('urn:mss:')[1]))
					}

					if (t.objectUri.search('urn:objnum:')>-1){
						base.idObjNum.push(t.objectUri.split('urn:objnum:')[1])
					}

					if (t.objectUri.search('urn:callnum:')>-1){
						base.idCallnum.push(t.objectUri.split('urn:callnum:')[1])
					}

					if (t.objectUri.search('urn:rlin:')>-1){
						base.idRlin.push(t.objectUri.split('urn:rlin:')[1])
					}

					if (t.objectUri.search('urn:oclc:')>-1){
						base.idOclc.push(parseInt(t.objectUri.split('urn:oclc:')[1]))
					}

					if (t.objectUri.search('urn:oclcExact:')>-1){
						base.idOclcExact.push(parseInt(t.objectUri.split('urn:oclcExact:')[1]))
					}

					if (t.objectUri.search('urn:exhibition:')>-1){
						base.idExhib.push(t.objectUri.split('urn:exhibition:')[1])
					}

					if (t.objectUri.search('urn:uuid:')>-1){
						base.idUuid.push(t.objectUri.split('urn:uuid:')[1])
					}

					if (t.objectUri.search('urn:catnyp:')>-1){
						base.idCatnyp.push(t.objectUri.split('urn:catnyp:')[1])
					}

					if (t.objectUri.search('urn:mmsdb:')>-1){
						base.idMmsDb.push(parseInt(t.objectUri.split('urn:mmsdb:')[1]))
					}


					if (t.objectUri.search('urn:isbn:')>-1){
						base.idIsbn.push(t.objectUri.split('urn:isbn:')[1])
					}

					if (t.objectUri.search('urn:issn:')>-1){
						base.idIssn.push(t.objectUri.split('urn:issn:')[1])
					}

					if (t.objectUri.search('urn:hathi:')>-1){
						base.idHathi.push(t.objectUri.split('urn:hathi:')[1])
					}

					if (t.objectUri.search('urn:lccc:')>-1){
						base.idLccCoarse.push(t.objectUri.split('urn:lccc:')[1])
					}

					if (t.objectUri.search('urn:owi:')>-1){
						base.idOwi.push(parseInt(t.objectUri.split('urn:owi:')[1]))
					}

					if (t.objectUri.search('urn:dcc:')>-1){
						base.idDcc.push(t.objectUri.split('urn:dcc:')[1])
					}

					if (t.objectUri.search('urn:lcc:')>-1){
						base.idLcc.push(t.objectUri.split('urn:lcc:')[1])
					}

					if (t.objectUri.search('urn:acqnum:')>-1){
						base.idAcqnum.push(t.objectUri.split('urn:acqnum:')[1])
					}					
				})	

			}

			if (resource['skos:note']){
				resource['skos:note'].forEach(function(t){
					if (t.objectLiteral.search("Admin:") == -1){
						base.note.push(t.objectLiteral.replace("\n","  "))
					}
				})	
			}


			if (resource['dcterms:alternative']){
				resource['dcterms:alternative'].forEach(function(t){
					base.title.push(t.objectLiteral.replace("\n","  "))
				})
			}

			if (resource['dcterms:description']){
				resource['dcterms:description'].forEach(function(t){
					base.description.push(t.objectLiteral.replace("\n","  "))
				})
			}

			if (resource['dcterms:contributor']){
				resource['dcterms:contributor'].forEach(function(t){						
					base.contributor.push({
						'@type' : "nypl:Agent",
						'@id' : t.objectUri,
						'prefLabel' : t.label
					})
				})
			}			

			for (var p in resource){
				if (p.search(/^roles:/)>-1){
					if (!base[p]) base[p] = []
					resource[p].forEach(function(t){	
						base[p].push({
							'@type' : "nypl:Agent",
							'@id' : t.objectUri,
							'prefLabel' : t.label,
							'note' :  (config['thesaurus']['relatorMap'][p]) ? config['thesaurus']['relatorMap'][p] : p
						})
					})
				}
			}

			if (resource['dcterms:subject']){
				resource['dcterms:subject'].forEach(function(t){						
					base.subject.push({
						'@type' : (t.objectUri.search(/^terms:/)>-1) ?  "nypl:Term" : "nypl:Agent",
						'@id' : t.objectUri,
						'prefLabel' : t.label
					})
				})
			}



			if (resource['dcterms:language']){
				resource['dcterms:language'].forEach(x => {
					base.language.push({
						'@id' : x.objectUri,
						"prefLabel" : (config['thesaurus']['languageCodes'][x.objectUri]) ? config['thesaurus']['languageCodes'][x.objectUri] : x.objectUri
					}) 
				})
			}


			if (resource['classify:holdings']){
				resource['classify:holdings'].forEach(function(t){
					base.holdingCount.push(t.objectLiteral)
				})
			}


			if (resource['nypl:suppressed']) if (resource['nypl:suppressed'][0]) if (resource['nypl:suppressed'][0].objectLiteral)  base.suppressed = true

			async.parallel({

				getMemberLabels: function(callback){
					app.db.returnCollectionTripleStore("resources",function(err,resources){							
						if (hasMembers.length>100) hasMembers = hasMembers.slice(0,99)
						resources.find( { uri : {$in: hasMembers} }, { uri:1, 'dcterms:title': 1, 'rdf:type':1, 'nypl:dcflag' : 1, 'nypl:publicDomain' : 1, 'nypl:filename': 1} ).toArray(function(err,members){
							callback(null, members.map(x => {								
								var r = {
									title: (!x['dcterms:title']) ? [] : x['dcterms:title'].map(y =>  y.objectLiteral), 
									'@type': (x['rdf:type']) ? x['rdf:type'][0].objectUri : null,
									'@id' : 'res:' + x.uri,
									"filename" : (!x['nypl:filename']) ? [] : x['nypl:filename'].map(y =>  y.objectLiteral),
									"dcflag" : (x['nypl:dcflag']) ? x['nypl:dcflag'][0].objectLiteral : null,
									"publicDomain" : (x['nypl:publicDomain']) ? x['nypl:publicDomain'][0].objectLiteral : null,
								}

								if (x['nypl:dcflag']) if (x['nypl:dcflag'][0]) if (x['nypl:dcflag'][0].objectLiteral === false) r.filename = []
								return r
							}))								
						})
					})
				},
				getParentLabels: function(callback){
					app.db.returnCollectionTripleStore("resources",function(err,resources){							
						if (memberOf.length>100) memberOf = memberOf.slice(0,99)
						resources.find( { uri : {$in: memberOf} }, { uri:1, 'dcterms:title': 1, 'rdf:type':1} ).toArray(function(err,members){
							console.log(members)
							callback(null, members.map(x => {
								return {
									title: (x['dcterms:title']) ? x['dcterms:title'][0].objectLiteral : null,
									'@type': (x['rdf:type']) ? x['rdf:type'][0].objectUri : null,
									'@id' : 'res:' + x.uri
								}
							}))								
						})
					})
				}					


			},
			function(err, results) {
				base.hasMember = results.getMemberLabels
				base.memberOf = results.getParentLabels
				cb(base)
			})		

			return
		})

	}


	app.resources.findByOldId = function(id, cb){

		app.db.returnCollectionTripleStore("resources",function(err,resources){

			var searchStrategies = []

			if (id.length===36){
				//mms
				searchStrategies.push({ "dcterms:identifier" : { "$elemMatch": { "objectUri": "urn:uuid:" + id } }})			
			}else if ( id.search(/b[0-9]{8,}/) > -1 ){
				//catalog
				id = id.replace(/b/gi,'')
				id = id.substr(0,8)
				searchStrategies.push({ "dcterms:identifier" : { "$elemMatch": { "objectUri": "urn:bnum:b" + id } }})			
				searchStrategies.push({ "dcterms:identifier" : { "$elemMatch": { "objectUri": "urn:bnum:" + id } }})			
			}else{
				//all other numeric identifiers
				searchStrategies.push({ "dcterms:identifier" : { "$elemMatch": { "objectUri": "urn:msscoll:" + id } }})
				searchStrategies.push({ "dcterms:identifier" : { "$elemMatch": { "objectUri": "urn:barcode:" + id } }})
			}


			var allResults = []

			async.each(searchStrategies, function(searchStrategie, callback) {
				resources.find( searchStrategie ).toArray(function(err,results){
					allResults.push(results[0])
					callback()
				})
			}, function(err){
				cb({ allResults : allResults })
			})

		})		
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