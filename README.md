[![Build Status](https://travis-ci.org/nypl-registry/registry-api.svg?branch=master)](https://travis-ci.org/nypl-registry/registry-api) [![js-standard-style](https://img.shields.io/badge/code%20style-standard-brightgreen.svg)](http://standardjs.com/)

# Status

This is a fork of the old Registry API with revised endpoints. It's currently deployed here:

[http://discovery-api.nypltech.org/api/v1](http://discovery-api.nypltech.org/api/v1)

# Documentation

Much of our [v0.2 aspirational spec](https://nypl-discovery.github.io/discovery-api/#/Resources) is now functional (Resources only). Some filtering methods are still sketchy. Here are some sample queries known to currently work:

## Searching

In general, at writing, `q` and `filters` params accept [Elastic "Query String Query" strings](https://www.elastic.co/guide/en/elasticsearch/reference/current/query-dsl-query-string-query.html)

Keywords (matching title, description, notes, subjects, contributors):

> /resources?q=war

By language:

> /resources?filters=language:"lang:eng"

> /resources?filters=language:"lang:spa"

By contributor (literal):

> /resources?filters=contributor:"Rowling, J. K."

By date created (year)

> /resources?filters=date:1999

Filter by date range (resources created anywhere inside the range given):

> /resources?filters=date:[1999 TO 2012]

Get things created in 1999 *or later*:

> /resources?filters=date:>1999

This is an alternate way of specifying above query, matching from 1999 ('{' indicates non-inclusive) to * (whenever):

> /resources?filters=date:{1999 TO \*}

Filter by material type (Text, Still Image, Audio, ...):

> /resources?filters=materialType:"resourcetypes:img"

Filter by publisher:

> /resources?filters=publisher:"Oxford University Press,"

Filters can be combined!

English resources about 'war':

> /resources?filters=language:"lang:eng"&q=war

English resources about 'war' and/or 'peace':

> /resources?filters=language:"lang:eng"&q=(war OR peace)

## Sorting

All search queries support `sort`ing on `title` or `date`. To set a non-default direction use `sort_direction=(asc|desc)`. To sort by relevance, omit the `sort` param.

## Get a single bib/item resource by id

> /resources/b15704876

.. Or by any item @id:

> /resources/b15704876-i25375512
