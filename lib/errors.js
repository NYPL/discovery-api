// Thrown when parameter(s) are missing/invalid
// See https://httpstatuses.com/422
class InvalidParameterError extends Error {
  constructor (message) {
    super()
    this.name = 'InvalidParameterError'
    this.message = message
  }
}

// Thrown when request targets something permanently or temporarily missing
// See https://httpstatuses.com/404
class NotFoundError extends Error {
  constructor (message) {
    super()
    this.name = 'NotFoundError'
    this.message = message
  }
}

/**
* Thrown when there's an error connecting to the ES index
*/
class IndexConnectionError extends Error {
  constructor (message) {
    super()
    this.name = 'IndexConnectionError'
    this.message = message
  }
}

/**
* Thrown when there's an error connecting to the ES index
*/
class IndexSearchError extends Error {
  constructor (message) {
    super()
    this.name = 'IndexSearchError'
    this.message = message
  }
}

module.exports = { InvalidParameterError, NotFoundError, IndexConnectionError, IndexSearchError }
