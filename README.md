[![Build Status](https://travis-ci.org/nypl-registry/registry-api.svg?branch=master)](https://travis-ci.org/nypl-registry/registry-api) [![js-standard-style](https://img.shields.io/badge/code%20style-standard-brightgreen.svg)](http://standardjs.com/)

# Sample Queries

Full documentation is TK

## Resources

Keywords (matching title, description, notes, subjects, contributors):
`/api/v1/resources?action=search&value=fortitude`

By subject id:
`/api/v1/resources?action=search&filters[subject]=terms:10004719`

By contributor id:
`/api/v1/resources?action=search&filters[contributor]=agents:13447571`

By date (year), matching resources with start/end overlap on given date:
`/api/v1/resources?action=search&filters[date]=1984`

When two dates are provided, a range is assumed; All resources overlapping the range defined by the two dates will be returned:
`/api/v1/resources?action=search&filters[date]=1984&filters[date]=2016`

Filters can be combined. Filters of different type are AND'd; filters of same type are OR'd.

This returns resources from either `agents:10112414` OR `agents:10378651`:
`/api/v1/resources?action=search&filters[contributor]=agents:10112414&filters[contributor]=agents:10378651`

This returns resources associated with `agents:10112414` AND owned by `orgs:1000`:
`/api/v1/resources?action=search&filters[contributor]=agents:10112414&filters[contributor]=agents:10378651&filters[owner]=orgs:1000`

This restricts the above to resources matching "Bandquart":
`/api/v1/resources?action=search&filters[contributor]=agents:10112414&filters[contributor]=agents:10378651&filters[owner]=orgs:1000&value=Bandquart`

Get 5 random resources:
`/api/v1/resources?action=random&per_page=5`

Get full resource (by uri/id):
`/api/v1/resources/100301756`
OR
`/api/v1/resources?action=lookup&value=100301756`

