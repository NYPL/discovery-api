const request = require('supertest')
const baseUrl = process.env.NYQL_TEST_BASE_URL || 'https://qa-platform.nypl.org/api/v0.1'
const getId = (item) => item?.result?.['@id']
const endpoint = '/discovery/resources'
const TIMEOUT = 30000

const search = (params) =>
  request(baseUrl)
    .get(endpoint)
    .query({
      search_scope: 'cql',
      per_page: 100,
      ...params
    })
    .timeout(TIMEOUT)
    .expect(200)

const normalizeCallnumber = (value) =>
  String(value || '')
    .replace(/^[*"]+|[*"]+$/g, '')
    .trim()
    .toLowerCase()

const resultContainsCallnumber = (result, callnumber) => {
  const target = normalizeCallnumber(callnumber)
  const shelfMarks = [
    ...(Array.isArray(result?.shelfMark) ? result.shelfMark : []),
    ...(Array.isArray(result?.items)
      ? result.items.flatMap((item) =>
        Array.isArray(item?.shelfMark) ? item.shelfMark : []
      )
      : [])
  ]
    .filter(Boolean)
    .map(normalizeCallnumber)

  return shelfMarks.some(
    (mark) => mark.includes(target) || target.includes(mark)
  )
}


module.exports = {
  baseUrl,
  getId,
  normalizeCallnumber,
  resultContainsCallnumber,
  endpoint,
  search
}
