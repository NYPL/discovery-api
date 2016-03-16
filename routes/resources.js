module.exports = function(app) {

	app.all('*', function(req, res, next) {
		res.header('Access-Control-Allow-Origin', '*');
		res.header('Access-Control-Allow-Methods', 'PUT, GET, POST, DELETE, OPTIONS');
		res.header('Access-Control-Allow-Headers', 'Content-Type');
		next();
	});

	app.get('/api/v1/resources', function(req, res){

		var actionHandlers = {
			'lookup': 				{ handler: app.resources.findById },
			'searchbytitle': 	{ handler: app.resources.searchByTitle },
			'search': 				{ handler: app.resources.search, params: ['value','filters'] },
			'overview': 			{ handler: app.resources.overview },
			'ntriples': 			{ handler: app.resources.overviewNtriples, contentType: 'text/plain' },
			'jsonld': 				{ handler: app.resources.overviewJsonld },
			'byterm': 				{ handler: app.resources.byTerm },
			'searchold': 			{ handler: app.resources.findByOldId },
			'byowi':					{ handler: app.resources.findByOwi },
			'random':					{ handler: function(v, cb) { return app.resources.randomResources(cb) } }
		}

		if (req.query.action) {
			var action = req.query.action.toLowerCase()

			// Error if action invalid:
			if (Object.keys(actionHandlers).indexOf(action) < 0) {
				res.type('application/json')
				res.status(500).send(JSON.stringify({error: "Invalid Action"}, null, 2))

			} else {
				var handlerConfig;
				if (handlerConfig = actionHandlers[action]) {
					var params = handlerConfig.params ? req.query : req.query.value
					handlerConfig.handler(params, function(_resp) {
						res.type(handlerConfig.contentType ? handlerConfig.contentType : 'application/ld+json')
						res.status(200).send(JSON.stringify(_resp, null, 2))
						return true
					})
				}
			}

		// Error if no action given:
		}else{
			res.type('application/json')
			res.status(500).send(JSON.stringify({error: "No Action requested"}, null, 2))
		}
	})
}
