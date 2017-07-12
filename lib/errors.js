
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
module.exports = { InvalidParameterError, NotFoundError }
