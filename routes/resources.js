module.exports = function(app){



	app.all('*', function(req, res, next) {
	  res.header('Access-Control-Allow-Origin', '*');
	  res.header('Access-Control-Allow-Methods', 'PUT, GET, POST, DELETE, OPTIONS');
	  res.header('Access-Control-Allow-Headers', 'Content-Type');
	  next();
	});



    app.get('/api/resources', function(req, res){



    	if (req.query.action){

    		if (req.query.action.toLowerCase() == 'search'){


					app.resources.findById(req.query.value, function(resource){    	
						res.type('application/json')
			    		res.status(200).send(JSON.stringify(resource, null, 2))
			    		return true
			    	})

			}

    		if (req.query.action.toLowerCase() == 'overview'){
    				

					app.resources.overview(req.query.value, function(resource){    	
						res.type('application/json')
			    		res.status(200).send(JSON.stringify(resource, null, 2))
			    		return true
			    	})

			}

    		if (req.query.action.toLowerCase() == 'byterm'){
    				

					app.resources.byTerm(req.query.value, function(resource){    	
						res.type('application/json')
			    		res.status(200).send(JSON.stringify(resource, null, 2))
			    		return true
			    	})

			}





		}else{

			res.type('application/json')
			res.status(500).send(JSON.stringify({error: "No Action requested"}, null, 2))



		}




    })

    //other routes..
}