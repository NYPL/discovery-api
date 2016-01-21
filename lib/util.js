var config = require("config")
var fs = require("fs")

var exec = require('child_process').exec

var exports = module.exports = {};


exports.parseLocationFile = function(cb){

	var locations = {}

	var stream = fs.createReadStream(__dirname + "/data/locations.csv")

	var csvStream = csv()
		.on("data", function(data){
	 		locations[data[0]] = {
	 			name : data[1],
	 			location : data[2],
	 			code : data[3],
	 			slug : data[4],
	 			lat : data[5],
	 			lng : data[6],
	 			research : data[7].toLowerCase()
	 		}
		})
		.on("end", function(){

			cb(locations)
		})

	stream.pipe(csvStream);

}



//check for the filename of the script running in ps aux output and return true if it is already listed
exports.checkIfRunning = function(cb,threshold){

	//on linux servers running this as a cron job it will be 3
	if (!threshold) threshold = 3

	var scriptName = process.argv[1].split("/")[process.argv[1].split("/").length-1]

	var child = exec("ps aux",
		function (error, stdout, stderr) {

			if (stdout.split(scriptName).length > threshold){
				cb(true)
			}else{
				cb(false)
			}
	})

}

//our own exit method to kill the process but allow the logger to finish up anything it is doing
exports.exit = function(){
	setTimeout(function(){process.exit()},2000)
}




