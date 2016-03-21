var config = require("config")
var fs = require("fs")
var jsonld = require('jsonld')

var exec = require('child_process').exec

var exports = module.exports = {};

exports.contextAll = config['contextAll']


exports.buildJsonLdContext = function(prefixes){
	var context = JSON.parse(JSON.stringify(prefixes))
	delete context['urn']

	//all the aliases

	//some fancy stuff for agents results
	context['topFiveTermsString'] = {
		"@id": "nyplapp:topFiveTermsString",
		"@container": "@list"
	}
	context['topFiveRolesString'] = {
		"@id": "nyplapp:topFiveTermsString",
		"@container": "@list"
	}

	context['birthDate'] = "dbo:birthDate"
	context['birthYear'] = "dbo:birthYear"
	context['birthDecade'] = "nypl:birthDecade"

	context['deathDate'] = "dbo:deathDate"
	context['deathYear'] = "dbo:deathYear"
	context['deathDecade'] = "nypl:deathDecade"

	//FIX ME
	context['startYear'] = "dbo:startYear"
	context['endYear'] = "dbo:endYear"

	context['thumbnail'] = "dbo:thumbnail"



	context['filename'] = "nypl:filename"
	context['owner'] = "nypl:owner"
	context['dcFlag'] = "nypl:dcflag"
	context['publicDomain'] = "nypl:publicDomain"
	context['suppressed'] = "nypl:suppressed"




	context['hasMember'] = "pcdm:hasMember"
	context['memberOf'] = "pcdm:memberOf"

	context['hasEquivalent'] = "bf:hasEquivalent"


	context['idBarcode'] = "dcterms:identifier"
	context['idBnum'] = "dcterms:identifier"
	context['idMss'] = "dcterms:identifier"
	context['idMssColl'] = "dcterms:identifier"
	context['idObjNum'] = "dcterms:identifier"
	context['idRlin'] = "dcterms:identifier"
	context['idOclc'] = "dcterms:identifier"
	context['idExhib'] = "dcterms:identifier"
	context['idUuid'] = "dcterms:identifier"
	context['idCallnum'] = "dcterms:identifier"
	context['idCatnyp'] = "dcterms:identifier"
	context['idMmsDb'] = "dcterms:identifier"
	context['idIsbn'] = "dcterms:identifier"
	context['idIssn'] = "dcterms:identifier"
	context['idHathi'] = "dcterms:identifier"
	context['idLccCoarse'] = "dcterms:identifier"
	context['idOwi'] = "dcterms:identifier"
	context['idDcc'] = "dcterms:identifier"
	context['idLcc'] = "dcterms:identifier"
	context['idAcqnum'] = "dcterms:identifier"
	// context['id'] = "dcterms:identifier"
	// context['id'] = "dcterms:identifier"
	// context['id'] = "dcterms:identifier"
	// context['id'] = "dcterms:identifier"

	context['uriWikidata'] = "skos:exactMatch"
	context['uriDbpedia'] = "skos:exactMatch"
	context['uriViaf'] = "skos:exactMatch"
	context['uriLc'] = "skos:exactMatch"
	context['prefLabel'] = "skos:prefLabel"
	context['note'] = "skos:note"


	context['depiction'] = "foaf:depiction"
	context['wikipedia'] = "foaf:isPrimaryTopicOf"

	context['title'] = "dcterms:title"
	context['type'] = "dcterms:type"
	context['titleAlt'] = "dcterms:alternative"
	context['identifier'] = "dcterms:identifier"
	context['description'] = "dcterms:description"
	context['contributor'] = "dcterms:contributor"
	context['subject'] = "dcterms:subject"
	context['language'] = "dcterms:language"


	context['holdingCount'] = "classify:holdings"


	context['searchResultScore'] = "nyplapp:searchResultScore"
	context['searchResult'] = "nyplapp:searchResult"
	context['totalResults'] = "nyplapp:totalResults"
	context['currentPage'] = "nyplapp:searchResultPage"
	context['morePages'] = "nyplapp:searchResultMorePages"
	context['useCount'] = "nyplapp:useCount"
	context['isSubject'] = "nyplapp:isSubject"
	context['isContributor'] = "nyplapp:isContributor"

	context['result'] = "schema:result"
	context['itemListElement'] = "schema:itemListElement"
	context['itemList'] = "schema:ItemList"

	return context
}


exports.context = exports.buildJsonLdContext(config.prefixes)



exports.flatenTriples = function(object){	
	var flat = { objectLiteral: {}, objectUri: {}}	
	for (var key in object){
		//is this a triple
		if (config['predicatesAgents'].indexOf(key)>-1 || config['predicatesResources'].indexOf(key)>-1 ){

			object[key].forEach(value => {
				if (value.objectLiteral){
					if (!flat.objectLiteral[key]) flat.objectLiteral[key] = []
					flat.objectLiteral[key].push(value.objectLiteral)
				}
				if (value.objectUri){
					if (!flat.objectUri[key]) flat.objectUri[key] = []
					flat.objectUri[key].push(value.objectUri)
					if (value.label){
						if (!flat.objectUri[key+':label']) flat.objectUri[key+':label'] = []
						flat.objectUri[key+':label'].push({ uri:value.objectUri, label: value.label})
					}
				}
			})
		}
	}
	return flat
}

exports.expandObjectUri = function(objectUri){

	if (!objectUri) return false

	var split =objectUri.split(":")
	var prefix = split[0]
	split.shift(0,1)
	value = split.join(":")

	var uriBase = config.prefixes[prefix]
	if (!uriBase) {
		console.log("Unknown Prefix:",prefix)
		return false
	}
	return uriBase + value
}


//turns the objects into triples sans provo
exports.returnNtTriples = function(obj, type){
	var uri, triples = []
	if (type==='resource'){
		uri = "<http://data.nypl.org/resources/"+obj.uri+">"
	}else if (type==='agent'){
		uri = "<http://data.nypl.org/agents/"+obj.uri+">"
	}else if (type==='term'){
		uri = "<http://data.nypl.org/terms/"+obj.uri+">"
	}else if (type==='org'){
		uri = "<http://data.nypl.org/organizations/"+obj.uri+">"
	}else if (type==='dataset'){
		uri = "<http://data.nypl.org/datasets/"+obj.uri+">"
	}else{
		return false
	}
	for (var p in obj){
		if (config['predicatesAgents'].indexOf(p)>-1 || config['predicatesResources'].indexOf(p)>-1 ){
			//it is a triple
			var expandedPredicate = "<" + exports.expandObjectUri(p) + ">"
			obj[p].forEach(o =>{
				if (o.objectUri){
					var expandedObject = "<" + exports.expandObjectUri(o.objectUri) + ">"
				}else{
					var expandedObject = exports.expandObjectUri(o.objectLiteralType)
					if (expandedObject===false && o.objectLiteralType){
						expandedObject = '@'+o.objectLiteralType
					}else if (typeof expandedObject === 'string'){
						expandedObject = "^^<"+expandedObject + ">"
					}else{
						expandedObject = ''
					}
					if (typeof o.objectLiteral === 'string') o.objectLiteral = o.objectLiteral.replace('"','\\"').replace('\n','  ')
					expandedObject =  '"' + o.objectLiteral + '"' + expandedObject
				}
				triples.push(uri + " " + expandedPredicate + " " + expandedObject + ".")
			})
		}
	}
	return triples
}

exports.returnNtJsonLd = function(obj, type, cb){
	var triples = exports.returnNtTriples(obj,type).join("\n")
	//console.log(triples)
	jsonld.fromRDF(triples, {format: 'application/nquads'}, function(err, doc) {
	  	if (err) console.log(JSON.stringify(err,null,2) )
	  	jsonld.compact(doc, exports.context, function(err, compacted) {
	  		if (err) console.log(err)
	  		cb(err,compacted)
	  	})	  	
	})
}


// Applies validation against hash of params given spec
// see `parseParams`
exports.parseParams = function(params, spec) {
  var ret = {}
  Object.keys(spec).forEach(function(param) {
    if(params[param]) {
      ret[param] = exports.parseParam(params[param], spec[param])

    } else if (spec[param].default) {
      ret[param] = spec[param].default
    }
  })
  return ret
}

// Given raw query param value `val`
// returns value validated against supplied spec:
//   `type`: (int, string, date, object) - Type to validate (and cast) against
//   `range`: Array - Constrain allowed values to range
//   `fields`: Hash - When `type` is 'object', this property provides field spec to validate internal fields against
exports.parseParam = function(val, spec) {
  if((typeof val) === 'object' && ! isNaN(Object.keys(val)[0])) {
    return Object.keys(val).map( i => exports.parseParam(val[i], spec) )
  }
  switch(spec.type) {
    case 'date':
    case 'int':
      if ( isNaN(val))
        return spec.default
      val = Number.parseInt(val)
      break

    case 'object':
      val = exports.parseParams(val, spec.keys)
      break
  }

  if(spec.range) {
    if ( val < spec.range[0] )
      return spec.default
    if ( val > spec.range[1] )
      return spec.range[1]
  }

  return val
}


// exports.parseLocationFile = function(cb){

// 	var locations = {}

// 	var stream = fs.createReadStream(__dirname + "/data/locations.csv")

// 	var csvStream = csv()
// 		.on("data", function(data){
// 	 		locations[data[0]] = {
// 	 			name : data[1],
// 	 			location : data[2],
// 	 			code : data[3],
// 	 			slug : data[4],
// 	 			lat : data[5],
// 	 			lng : data[6],
// 	 			research : data[7].toLowerCase()
// 	 		}
// 		})
// 		.on("end", function(){

// 			cb(locations)
// 		})

// 	stream.pipe(csvStream);

// }



// //check for the filename of the script running in ps aux output and return true if it is already listed
// exports.checkIfRunning = function(cb,threshold){

// 	//on linux servers running this as a cron job it will be 3
// 	if (!threshold) threshold = 3

// 	var scriptName = process.argv[1].split("/")[process.argv[1].split("/").length-1]

// 	var child = exec("ps aux",
// 		function (error, stdout, stderr) {

// 			if (stdout.split(scriptName).length > threshold){
// 				cb(true)
// 			}else{
// 				cb(false)
// 			}
// 	})

// }

// //our own exit method to kill the process but allow the logger to finish up anything it is doing
// exports.exit = function(){
// 	setTimeout(function(){process.exit()},2000)
// }

