# Changelog

## Prerelease

- Update item location filter to use `buildingLocationId` (SCC-5490)
- Adds `shortLabel`s to the building locations
- Updates resources indexes: `resoruces-qa-2026-10-23`, `resources-prod-2026-1029`
- Updates NYPL core version to `2.43`

## [1.2.0] - 2026-10-27

- Default to false requestabilities for missing ReCAP customer codes (SCC-5697)
- Start of Discovery API changelog + documentation and changelog-enforcing (SCC-5390)
- Include journaltitle NYQL scope (SCC-5463) and integration tests
- Add version bump and git tag hooks, and resources/browse index to the JSON returned by health check "/" (SCC-5390)
- Bump to Node 22
- Stop logging full patron response (QA-20)
