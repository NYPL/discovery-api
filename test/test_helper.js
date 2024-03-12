const chai = require('chai')
const chaiAsPromised = require('chai-as-promised')
const dotenv = require('dotenv')
const loadConfig = require('../lib/load-config')
const app = require('../app')
const sinon = require('sinon')

before(async () => {
  if (!process.env.UPDATE_FIXTURES) {
    // Load baseline test env vars:
    dotenv.config({ path: './config/test.env' })

    sinon.stub(loadConfig, 'decryptEncryptedConfig').callsFake(() => {
      Object.keys(process.env)
        .filter((key) => /^ENCRYPTED_/.test(key))
        .forEach((encryptedKey) => {
          const keyWithoutPrefix = encryptedKey.replace(/^ENCRYPTED_/, '')
          process.env[keyWithoutPrefix] = process.env[encryptedKey]
        })

      return Promise.resolve()
    })
  }

  await app.init()

  // Establish base url for local queries:
  global.TEST_BASE_URL = `http://localhost:${process.env.PORT}`
})

require('../lib/globals')

chai.use(chaiAsPromised)
global.expect = chai.expect
