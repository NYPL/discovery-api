Master: [![Build Status](https://travis-ci.org/NYPL-discovery/discovery-api.svg?branch=master)](https://travis-ci.org/NYPL-discovery/discovery-api)

# Documentation

Check the [v0.1.1 swagger](https://github.com/NYPL-discovery/discovery-api/blob/master/swagger.v0.1.json) for the machine readable api contract.

## Installing & Running Locally

This app uses [nvm](https://github.com/creationix/nvm).

1.  Clone this repo.
1.  `cd` into the newly cloned directory
1.  `nvm use`
1.  `npm install`
1.  Decrypt the appropriate config/[environment].env file and copy to .env. The values are encrypted using nypl-digital-dev
`npm start` to start the app!

Note that when developing locally, you may need to [add your IP to the access control policy of the relevant ES domain](https://github.com/NYPL/aws/blob/b5c0af0ec8357af9a645d8b47a5dbb0090966071/common/elasticsearch.md#2-make-the-domain-public-restrict-by-ip).

## About Environment Variables

See `.env.example` for a description the variables. **If you're adding new variables please add them to .env.example and `./lib/preflight_check.js`**

Note that config variables are maintained in `./config/*.env` as a formality and to assist onboarding; Changes made to those files will not effect deployed config. Config changes must be applied to the deployed Beanstalk app manually. Note that sensitive values are encrypted in `./config/*.env` whereas they are not in the deployed Beanstalk.

### Changes to SCSB/UAT endpoints

When HTC changes the SCSB endpoint, apply changes to the relevant environment file in `config/` (encrypting the value if sensitive) and also manually apply the change to the running Beanstalk app (without encrypting the value).

## Git & Deployment Workflow

This app uses a [PRs Target Main, Merge to Deployment Branches](https://github.com/NYPL/engineering-general/blob/master/standards/git-workflow.md#prs-target-main-merge-to-deployment-branches) git workflow.

[`master`](https://github.com/NYPL-discovery/discovery-api/tree/master) has the lastest-and-greatest commits, [`production`](https://github.com/NYPL-discovery/discovery-api/tree/production) should represent what's in
our production environment. Because we deploy often, `master` and `production`
will often be in parity.

### Ideal Workflow

1. Cut a feature branch off of `master`.
1. Commit changes to your feature branch.
1. File a pull request against `master` and assign reviewers.
1. After the PR is accepted, merge into `master`.
1. Merge / promote master into `production` and push to origin.
1. [Deploy](#deployment) to production when appropriate (Ideally very soon)

### Release Tags

Release tags are created based on production branch after a new version has been deployed to the Production tier.
We're dedicated to:

* Making sure release tag version mirrors the app version in `package.json`.
* Bumping that version on each deployment.

## Initial Creation / Deployment to Elastic Beanstalk

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

The following runs a series of tests against local fixtures:

```
npm test
```

Almost all HTTP dependencies are rerouted to fixtures (nypl-core mapping files are a known exception). All fixtures can be updated dynamically (using whatever elastic, scsb, & platform api config is present in `process.env` or `./.env`) via the following:

```
UPDATE_FIXTURES=all npm test
```

Rebuilding fixtures tends to introduce trivial git diff noise, so one may use the following to *only* generate fixtures that don't already exist:

```
UPDATE_FIXTURES=if-missing npm test
```

Remove fixtures that are no longer used in any test with this flag:

```
REMOVE_UNUSED_FIXTURES=true npm test
```

The above command can be used to fill in missing fixtures as new tests are written.

## Deployment

`npm run deploy-[development|qa|production]`

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

