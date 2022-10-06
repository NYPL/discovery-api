# Cloudwatch Logs to TSV
This folder holds two script files. query-logs.js queries AWS Cloudwatch for approximately 200,000 GET requests that look like initial searches from the Discovery Front End. It then writes the api requests to logs-to-tsv/logs-out. write-logs-tsv.js takes the files in that directory and writes them to a tsv.

## How to use
`cd logs-to-tsv`
`nvm use`
`node query-logs`
`node write-logs-tsv`
The .tsv output will be found at `logs-to-tsv/logs-out.tsv`

## Sample TSV output
timestamp	searchScope	query	contributor	title	subject
07/Aug/2022:18:44:29		Carre+d'Agnelet+Boulangere+aux+Champignons+Frais			
07/Aug/2022:18:44:23	standard_number	9789839963199			
07/Aug/2022:18:44:19		Entrecot+a+la+Bordelaise,+Double			