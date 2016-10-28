[![Build Status](https://travis-ci.org/nypl-registry/registry-api.svg?branch=master)](https://travis-ci.org/nypl-registry/registry-api) [![js-standard-style](https://img.shields.io/badge/code%20style-standard-brightgreen.svg)](http://standardjs.com/)

# Status

This is a fork of the old Registry API with revised endpoints. It's currently deployed here:

[http://discovery-api.nypltech.org/api/v1](http://discovery-api.nypltech.org/api/v1)

# Documentation

Much of our [v0.2 aspirational spec](https://nypl-discovery.github.io/discovery-api/#/Resources) is now functional (Resources only). Some filtering methods are still sketchy. Here are some sample queries known to currently work:

Keywords (matching title, description, notes, subjects, contributors):

/resources?q=war

By language:

> /resources?q=language:"lang:eng"

> /resources?q=language:"lang:spa"

By contributor (literal):

> /resources?q=contributor:"Rowling, J. K."

By date created (year)

> /resources?q=date:1999

Filter by date range (resources created anywhere inside the range given):

> /resources?q=date:[1999 TO 2012]

Get things created in 1999 *or later*:

> /resources?q=date:>1999

This is an alternate way of specifying above query, matching from 1999 ('{' indicates non-inclusive) to * (whenever):

> /resources?q=date:{1999 TO \*}

Filter by material type (Text, Still Image, Audio, ...):

> /resources?q=materialType:"resourcetypes:img"

Filter by publisher:

> /resources?q=publisher:"Oxford University Press,"

Filters can be combined!

English resources about 'war':

> /resources?q=language:"lang:eng" war

English resources about 'war' and/or 'peace':

> /resources?q=language:"lang:eng" (war OR peace)

Finally, get a single result by top-level (bib) @id:

> /resources/b15704876

.. Or by any item @id:

> /resources/b15704876-i25375512
