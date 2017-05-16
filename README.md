[![Build Status](https://travis-ci.org/nypl-registry/registry-api.svg?branch=master)](https://travis-ci.org/nypl-registry/registry-api) [![js-standard-style](https://img.shields.io/badge/code%20style-standard-brightgreen.svg)](http://standardjs.com/)

# Status

This is a fork of the old Registry API with revised endpoints. It's currently deployed here:

[https://api.nypltech.org/api/v0.1/discovery/resources ](https://api.nypltech.org/api/v0.1/discovery/resources)

# Documentation

Check the [v0.1.1 swagger](https://github.com/NYPL-discovery/discovery-api/blob/master/swagger.v0.1.1.json) for the machine readable api contract.

## Searching

Match by keyword:

> /resources?q=war peace

Match by exact phrase:

> /resources?q="war and peace"

In general, `q` param accepts [Elastic "Query String Query" strings](https://www.elastic.co/guide/en/elasticsearch/reference/current/query-dsl-query-string-query.html), which supports field-specific and/or boolean searches.

For example, you could `q` alone without filters to retrieve records matching war with a `dateStartYear` overlap on 1999-2012:

> /resources?q=war dateStartYear:[1999 TO 2012]

.. Or get things created in 1999 *or later*:

> /resources?q=dateStartYear:>1999

Or match "war" or "peace":

> /resources?q=war OR peace

Check the [Elastic "Query String Query" strings docs for more information](https://www.elastic.co/guide/en/elasticsearch/reference/current/query-dsl-query-string-query.html).

### Filters

Filters are applied using a `filters` param that expects this syntax on the query string:

> /resources?filters[property1]=value1&filters[property2]=value2

Where `property*` is one of: 'owner', 'subjectLiteral', 'holdingLocation', 'deliveryLocation', 'language', 'materialType', 'mediaType', 'carrierType', 'publisher', 'contributor', 'creator', 'issuance', 'createdYear', 'dateAfter', or 'dateBefore'.

The value given should be *exact*. Do not use quotes.

For example, to filter by English language:

> /resources?filters[language]=lang:eng

By contributor (literal):

> /resources?filters[contributorLiteral]=Dostoyevsky, Fyodor, 1821-1881.

Filters can be combined across different properties to form a boolean AND. This will match only English books written by Dostoyevsky:

> /resources?filters[language]=lang:eng&filters[contributorLiteral]=Dostoyevsky, Fyodor, 1821-1881.

Using two filters for the same property combines them as a boolean OR. This will match Dostoyevsky books written in English OR Russian:

> /resources?filters[language]=lang:eng&filters[language]=lang:rus&filters[contributorLiteral]=Dostoyevsky, Fyodor, 1821-1881.

Filter by publisher:

> /resources?filters[publisher]=Oxford University Press,

Filter by date range (resources created anywhere inside the range given, inclusive):

> /resources?filters[dateAfter]=1999&filters[dateBefore]=2012

Note that dateStartYear and dateEndYear are often very broad, causing the above to match many things catalogued with range 999-9999. To match against the specific catalogued "created" year, use `createdYear`:

> /resources?filters[createdYear]=1999

### Pagination

All search queries support:

 - `page`: Integer. Page number to retrieve. (Default 1)
 - `per_page`: Integer. Number of results to retrieve at a time. Default 50. Valid range 0-100.

### Sorting

All search queries support `sort`ing on:

 - `title`: Case insensitive sort on title. Default ascending.
 - `date`: Sort on dateStartYear. Default descending.
 - `creator`: Case insensitive sort on first creator. (Note the "first" creator may not be the best creator.) Default ascending.

To set a non-default direction use `sort_direction=(asc|desc)`. To sort by relevance (i.e. keyword query), omit the `sort` param.

### Aggregations

All searches above can be retrieved as aggregations. To fetch the standard set of aggregations, append '/aggregations' to a search path. For example:

> /resources/aggregations?q=dateStartYear:{1999 TO \*}

All aggregations (no filter):

> /resources/aggregations

To fetch a specific aggregation (especially useful when fetching more than the default number of buckets):

> /resources/aggregation/[aggregation id]

For example to fetch the first 100 subject aggregations:

> /resources/aggregation/subject?per_page=100

Note that `page=` is not supported for aggregations (ES doesn't seem to offer a way to jump to an offset https://www.elastic.co/guide/en/elasticsearch/reference/current/search-aggregations-bucket-terms-aggregation.html#_size )

## Get a single bib/item resource by id

> /resources/b15704876

.. Or by any item @id:

> /resources/b15704876-i25375512

## Running

The API can be run locally by running the following command:

> npm start

This will bypass the AWS Serverless Express package that wraps the API and allows it to run on AWS as a Lambda.

# AWS Services

Currently, the Discovery API is deployed as an AWS Lambda and the endpoints from the Express app are behind an AWS API Gateway called NYPL API - Lambda. Because the API Gateway has a specific endpoint structure, the Discovery API had to conform to that, specifically updating to `/api/v[VERSION_OF_API]/discovery/resources`. The Discovery API can still be run locally, or on a server, through the `node app.js` command.

### Lambda

The Discovery API is a NodeJS Express app and we wanted to convert this into an AWS Lambda. Lambdas are serverless so we used the `aws-serverless-express` npm package to "convert" the server and its endpoints into paths that the Lambda would understand. This was done in order to have all and any NYPL API endpoints in the same location.

#### node-lambda
The node-lambda npm package is used to invoke the lambda locally and to deploy it to AWS. In order to run the Lambda locally, the following files are needed:

* .env - should be updated to include the following credentials:
  * AWS_ACCESS_KEY_ID
  * AWS_SECRET_ACCESS_KEY
  * AWS_ROLE_ARN
  * AWS_REGION

  AWS_ROLE_ARN is the role for the Lambda. Add this file to .gitignore.  
* Index.js - is the wrapper file and handler that the Lambda uses. The `aws-serverless-express` npm package is used to allow the Express server to be access as a Lambda, turning the server application into a serverless application.

To push to AWS run `node-lambda deploy`.

### Test locally

The Discovery API can be tested locally as an AWS Lambda by running

> node-lambda run

This will use the `path` property found in `event.json` as the parameter passed to the API. The `event.json` file is mocking an AWS HTTP request that is similar to what the AWS API Gateway receives/sends.

### API Gateway

The Discovery API has endpoints which are currently behind an API Gateway called NYPL API - Lambda. Currently, the endpoints are manually created in the "Resources" section for the NYPL API in the AWS API Gateway admin. For a specific endpoint, say `/api/v0.1/discoverty/resources`, a new "GET" action is created and the Integration Request has to be set to "LAMBDA_PROXY". The API Gateway endpoint request will be automatically picked by the Discovery API Lambda and the request routed to the appropriate endpoint.

When creating the "GET" action and adding the Discovery API Lambda as the LAMBDA_PROXY, make sure to also update the "Method Request" section and add caching to the URL Query String Parameters. For example, `q` is the query search parameter and needs to be added or else `/api/v0.1/discoverty/resources?q=locofocos` will return the same data as ``/api/v0.1/discoverty/resources?q=war`.
