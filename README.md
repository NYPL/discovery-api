[![Build Status](https://travis-ci.com/NYPL/discovery-api.svg?branch=main)](https://travis-ci.com/NYPL/discovery-api)

# Discovery API (aka Research Catalog API)

This is the API providing most of bibliographic data to the [NYPL Research Catalog front-end](https://github.com/NYPL/discovery-front-end). Check the [current swagger](https://github.com/NYPL/discovery-api/blob/main/swagger.v1.1.x.json) for the machine readable api contract.

## Installing & Running Locally

For local development, it's easiest to just use local node binaries:

```
nvm use; npm i
nvm use; ENV=qa LOCAL=true npm start
```

Note that when developing locally, if connecting to a IP ACL protected index (a practice we're currently deprecating), you may need to [add your IP to the access control policy of the relevant ES domain](https://github.com/NYPL/aws/blob/b5c0af0ec8357af9a645d8b47a5dbb0090966071/common/elasticsearch.md#2-make-the-domain-public-restrict-by-ip). If your IP has not been authorized, you will see errors such as the following in the application logs:

```
error: Error connecting to index: 403: {"Message":"User: anonymous is not authorized to perform: es:ESHttpPost because no resource-based policy allows the es:ESHttpPost action"}
```

### Running with NewRelic Locally

If you want to test the newrelic integration locally, get a license key from newrelic, and pass it in as an environment variable locally:
```
nvm use; ENV=qa LOCAL=true NEW_RELIC_LICENSE_KEY=mylicensekey npm start
```

### Using Docker

Docker files are included for deployment and can be used locally.

To start the container with AWS creds so that the app can decrypt config from `config/*`:

```
 AWS_ACCESS_KEY_ID=... AWS_SECRET_ACCESS_KEY=... docker-compose up
```

After making changes, rebuild the image:

```
docker-compose build
```

Or, equivalently, to build and run the image and container directly:

```
docker image build -t discovery-api:local .
docker container rm discovery-api
docker run --name discovery-api -e ENV=qa -e AWS_ACCESS_KEY_ID=... -e AWS_SECRET_ACCESS_KEY=... -p 8082:8082 -it discovery-api:local
```

## Contributing

This app uses a [Main-QA-Production](https://github.com/NYPL/engineering-general/blob/master/standards/git-workflow.md#main-qa-production) git workflow.  

Our `main` is essentially a staging area for `qa`, but merging into `main` indicates it's dev-approved and ready for other developers to pull it down into their own feature work.

### Changelog

This project maintains a [CHANGELOG](./CHANGELOG.md).

- All PRs should include a relevant CHANGELOG entry with a brief summary of the PR's changes and the relevant ticket (if there is one) in the `Prerelease` section
- For releases to production, update the `Prerelease` section with the next version and the current date (e.g., `## [1.0.1] - 2026-10-15`)
- To skip CHANGELOG enforcement, add the `skip-changelog` label to your PR. Generally, avoid this (hot fixes need a CHANGELOG entry even if you're in a rush) 

Example format:
```
## Prerelease

- Removed every letter Z (SCC-0123)
- Updated EDD criteria thresholds and added unit tests for availability resolver (SCC-1234)
```

### Development workflow

1. Cut a feature branch off of `main`
2. Commit changes to your feature branch
3. File a pull request against `main` and assign reviewers
4. After the PR is accepted, merge into `main`
5. Merge `main` > `qa`
6. Confirm app deploys to QA and run appropriate testing
7. Check out `qa` branch
8. Update the `Prerelease` section heading to the next logical version with the current date (e.g., `## [1.0.1] - 2026-10-15`)
9. Commit that update directly to `qa`
10. Create a PR to merge `qa` > `production` (indicate release version in the PR)
11. After approval:
   - Merge to production and test
   - Create a git tag: `git tag v1.0.1` and push tags
   - Back-merge `qa` > `main` manually and handle any CHANGELOG conflicts


## Deploying

App deploys through [GH Actions](./.github/workflows/test-and-deploy.yml) to ECS when updates are made to deployment branches:

- `qa`: discovery-api-qa.nypl.org
- `qa2`: discovery-api-qa2.nypl.org
- `production`: discovery-api-production.nypl.org

## Testing

Run all tests:

```
npm test
```

### API testing

NYQL integration tests are a QA contract suite in `test/integration/nyql/`. They verify that NYQL queries return the expected results against live QA data and are not run by default during `npm test` to avoid adding latency to CI.  They do, however, run after deploys to QA and Production.  The call to run them has been added to integration-tests.yml file.

To run them locally:

```bash
npm run nyql-api-test
```

To override the QA URL (e.g., to test against your local environment):

```bash
NYQL_TEST_BASE_URL=http://localhost:3000/api/v0.1 npm run nyql-api-test
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

.. Or get things created in 1999 _or later_:

> /resources?q=dateStartYear:>1999

Or match "war" or "peace":

> /resources?q=war OR peace

Check the [Elastic "Query String Query" strings docs for more information](https://www.elastic.co/guide/en/elasticsearch/reference/current/query-dsl-query-string-query.html).

### Filters

Filters are applied using a `filters` param that expects this syntax on the query string:

> /resources?filters[property1]=value1&filters[property2]=value2

Where `property*` is one of: 'owner', 'subjectLiteral', 'holdingLocation', 'deliveryLocation', 'language', 'materialType', 'mediaType', 'carrierType', 'publisher', 'contributor', 'creator', 'contributorNameTitle', 'issuance', 'createdYear', 'dateAfter', or 'dateBefore'.

The value given should be _exact_. Do not use quotes.

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

NB: numAvailable and numItem\*Parsed counts do not **exclude** the e-item, but these items are not indexed with statuses, volumes, or date ranges, and are therefore not actually included in this count.

NB: As the table above indicates, there is a mismatch between what the front end and API regard as "electronic items". As far as the API is concerned, there is only at most ONE electronic item, which can have many electronic locator values. `numElectronicResources` counts these locator values, but the other item count values treat all the electronic resources as a single item.
