
// Thrown when parameter(s) are missing/invalid
// See https://httpstatuses.com/422
class InvalidParameterError extends Error {
  constructor (message) {
    super()
    this.name = 'InvalidParameterError'
    this.message = message
  }
}

module.exports = { InvalidParameterError }
