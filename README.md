[![Build Status](https://travis-ci.com/NYPL/discovery-api.svg?branch=main)](https://travis-ci.com/NYPL/discovery-api)

# Discovery API

This is the API providing most of bibliographic data to the [NYPL Research Catalog front-end](https://github.com/NYPL/discovery-front-end). Check the [current swagger](https://github.com/NYPL/discovery-api/blob/main/swagger.v1.1.x.json) for the machine readable api contract.

## Installing & Running Locally

Use [nvm](https://github.com/creationix/nvm) to set your Node version:

```
nvm use
```

Install dependencies:

```
npm i
```

Create a `.env` based on `.env.example`. Fill it with values from the appropriate `config/[environment].env` file (`qa.env` is probably sensible). Note - if using values from `config/[environment].env` - you must decrypt the following keys using [`aws kms decrypt`](https://github.com/NYPL/engineering-general/blob/main/security/secrets.md#encryptingdecrypting) (or [kms-util](https://github.com/NYPL-discovery/kms-util)) (i.e. all values in `.env` must be decrypted):
 * `SCSB_URL`
 * `SCSCB_API_KEY`
 * `NYPL_OAUTH_SECRET`

Now start the app:

```
npm start
```

Note that when developing locally, you may need to [add your IP to the access control policy of the relevant ES domain](https://github.com/NYPL/aws/blob/b5c0af0ec8357af9a645d8b47a5dbb0090966071/common/elasticsearch.md#2-make-the-domain-public-restrict-by-ip).

If you are adding a dependency or need to rebuild package-lock.json, run this script:

```
nvm use; npm i -g npm@5.10.0
```

## About Environment Variables

See `.env.example` for a description the variables. **If you're adding new variables please add them to .env.example and `./lib/preflight_check.js`**

Note that config variables are maintained in `./config/*.env` as a formality and to assist onboarding; Changes made to those files will not effect deployed config. Config changes must be applied to the deployed Beanstalk app manually. Note that sensitive values are encrypted in `./config/*.env` whereas they are not in the deployed Beanstalk.

### Changes to SCSB/UAT endpoints

When HTC changes the SCSB endpoint, apply changes to the relevant environment file in `config/` (encrypting the value if sensitive) and also manually apply the change to the running Beanstalk app (without encrypting the value).

## Contributing

This app uses a [PRs Target Main, Merge to Deployment Branches](https://github.com/NYPL/engineering-general/blob/master/standards/git-workflow.md#prs-target-main-merge-to-deployment-branches) git workflow.

[`main`](https://github.com/NYPL-discovery/discovery-api/tree/main) has the lastest-and-greatest commits, [`production`](https://github.com/NYPL-discovery/discovery-api/tree/production) should represent what's in our production environment. Because we deploy often, `main` and `production` will often be in parity.

### Ideal Workflow

1. Cut a feature branch off of `main`
1. Commit changes to your feature branch
1. File a pull request against `main` and assign a reviewer
1. After the PR is accepted, merge into `main`
1. Merge `main` > `qa`
1. Confirm app deploys to QA and run appropriate testing
1. Merge `main` > `production`

## Deployment

This app is deployed via a deployment hook in `.travis.yml`. Pushes to `qa` deploy to our QA deployment; Pushes to `production` deploy to our Production deployment. We generally don't update `development` or use the Development deployment.

### Initial Creation / Deployment to Elastic Beanstalk

1. `.ebextensions` directory needed at application's root directory
2. `.ebextensions/00_environment.config` to store environment variables. For environment variables that needs to be hidden,
3. `.ebextensions/03_nodecommand.config` to start node app after deployment.
4. `eb init -i --profile <<your AWS profile>>`
5. Initial creation of instance on Beanstalk:

Please use the instance profile of _cloudwatchable-beanstalk_.
Which has all the permissions needed for a traditional or Docker-flavored Beanstalk
machine that wants to log to CloudWatch.

```bash
eb create discovery-api-[environmentname] \
    --instance_type t2.small \
    --instance_profile cloudwatchable-beanstalk \
    --cname discovery-api-[environmentname] \
    --vpc.id vpc-1e293a7b \
    --vpc.elbsubnets public-subnet-id-1,public-subnet-id-2 \
    --vpc.ec2subnets private-subnet-id-1,private-subnet-id-2 \
    --vpc.elbpublic \
    --tags Project=Discovery, Foo=Bar \
    --keyname dgdvteam \
    --scale 2 \
    --envvars VAR_NAME_1="xxx",VAR_NAME_2="xxx"
```

## Testing

Run all tests:

```
npm test
```

### Adding fixtures

Almost all HTTP dependencies are rerouted to fixtures (except for requesting nypl-core mapping files). All fixtures can be updated dynamically (using creds in `./config/production.env`) via the following:

Run tests and automatically build any missing Elasticsearch or SCSB fixtures:

```
UPDATE_FIXTURES=if-missing npm test
```

The above command can be used to fill in missing fixtures as new tests are written or ES queries change.

As ES queries change, some auto generated fixtures may no longer be used by any tests. Remove them with this flag:

```
REMOVE_UNUSED_FIXTURES=true npm test
```

Note that other Platform API fixtures (e.g. requests on the Bib service like `bibs/sierra-nypl/1234`) must be fetched and saved manually and then enabled in a `before` via `fixtures.enableDataApiFixtures({ %requestpath% : %fixturepath%`, ... })`. (There's not a great reason for the extra work required to create and use other Platform API fixtures except that there are fewer of them and they tend not to need to change as ES queries change.)

## API Documentation

The following summarises the kinds of queries that are possible with this app. See the [swagger](https://github.com/NYPL/discovery-api/blob/main/swagger.v1.1.x.json) for the complete [OpenAPI 2.0](https://swagger.io/resources/open-api/) spec.

### Searching

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

Using two filters for the same property combines them as a boolean OR, but you must add explicit, distinct indexes to the duplicated filter (the ordering of the parameters does not have to match the index order). This is because the AWS API Gateway deserializes the filter parameters to a JSON object, so specifying two filters with the same property key will cause one to be overwritten. It may help, therefore, to think of the `filters` parameters as a serialized JSON object. For example, this will match Dostoyevsky books written in English OR Russian:

> /resources?filters[language][0]=lang:eng&filters[language][1]=lang:rus&filters[contributorLiteral]=Dostoyevsky, Fyodor, 1821-1881.

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

### Get a single bib/item resource by id

> /resources/b15704876

.. Or by any item @id:

> /resources/b15704876-i25375512

### Features

There is currently one feature flag in this app, which is 'no-on-site-edd'. When it is set, all onsite items have an eddRequestable property of false.

NB: numAvailable and numItem*Parsed counts do not **exclude** the e-item, but these items are not indexed with statuses, volumes, or date ranges, and are therefore not actually included in this count.

NB: As the table above indicates, there is a mismatch between what the front end and API regard as "electronic items". As far as the API is concerned, there is only at most ONE electronic item, which can have many electronic locator values. `numElectronicResources` counts these locator values, but the other item count values treat all the electronic resources as a single item.
