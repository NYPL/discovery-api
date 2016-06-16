function UserError (message) {
  var err = new Error(message)
  Object.setPrototypeOf(err, UserError.prototype)

  return err
}

UserError.prototype = Object.create(
  Error.prototype,
  {name: {value: 'UserError', enumerable: false}}
)

module.exports = {
  user: UserError
}
