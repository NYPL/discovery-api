# Changelog

## Prerelease

## [1.2.2] - 2026-11-05

- Add idNyplSourceId to bibs (SCC-5619)
- redact PII from logs (SCC-5792)

## [1.2.1] - 2026-11-03

- Updates item location filter to use `buildingLocationId` (SCC-5490)
- Adds `shortLabel`s to the building locations
- Updates resources indexes: `resources-qa-2026-10-23`, `resources-prod-2026-10-29`
- Updates NYPL core version to `2.43`
- Stop logging full patron response (QA-20)

## [1.2.0] - 2026-10-27

- Default to false requestabilities for missing ReCAP customer codes (SCC-5697)
- Start of Discovery API changelog + documentation and changelog-enforcing (SCC-5390)
- Include journaltitle NYQL scope (SCC-5463) and integration tests
- Add version bump and git tag hooks, and resources/browse index to the JSON returned by health check "/" (SCC-5390)
- Bump to Node 22
