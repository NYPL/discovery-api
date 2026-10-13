const { expect } = require('chai')

describe('Logger', () => {
  let logger

  beforeEach(() => {
    // fresh logger for each test
    delete require.cache[require.resolve('../lib/logger')]
    logger = require('../lib/logger')
  })

  describe('LOG_TYPES constants', () => {
    it('defines all required error type constants', () => {
      expect(logger.LOG_TYPES).to.have.all.keys('SCSB_OUTAGE', 'ES_REJECTED_EXECUTION', 'ES_TIMEOUT', 'UNHANDLED_TYPE_ERROR')
      expect(logger.LOG_TYPES.SCSB_OUTAGE).to.equal('scsb_outage')
      expect(logger.LOG_TYPES.ES_REJECTED_EXECUTION).to.equal('es_rejected_execution')
      expect(logger.LOG_TYPES.ES_TIMEOUT).to.equal('es_timeout')
      expect(logger.LOG_TYPES.UNHANDLED_TYPE_ERROR).to.equal('unhandled_type_error')
    })
  })

  describe('error logging with type', () => {
    it('logs error with SCSB_OUTAGE type without throwing', () => {
      const error = new Error('Exhausted 5000ms timeout waiting for SCSB')
      expect(() => {
        logger.error('Error fetching customer code:', { type: logger.LOG_TYPES.SCSB_OUTAGE, error })
      }).to.not.throw()
    })

    it('logs error with ES_TIMEOUT type without throwing', () => {
      const error = new Error('Request timeout')
      error.name = 'TimeoutError'
      expect(() => {
        logger.error('ES request timed out', { type: logger.LOG_TYPES.ES_TIMEOUT, error })
      }).to.not.throw()
    })

    it('logs error with ES_REJECTED_EXECUTION type without throwing', () => {
      const error = new Error('429 Too Many Requests')
      error.name = 'ResponseError'
      expect(() => {
        logger.error('ES rejected execution', { type: logger.LOG_TYPES.ES_REJECTED_EXECUTION, error })
      }).to.not.throw()
    })

    it('logs error with UNHANDLED_TYPE_ERROR type without throwing', () => {
      const error = new TypeError("Cannot read property 'hits' of undefined")
      expect(() => {
        logger.error('handleError GET /api/v0.1/discovery/search:', { type: logger.LOG_TYPES.UNHANDLED_TYPE_ERROR, error })
      }).to.not.throw()
    })

    it('logs error without type (generic alarm) without throwing', () => {
      const error = new Error('Something unexpected')
      expect(() => {
        logger.error('Unexpected error', error)
      }).to.not.throw()
    })

    it('preserves additional metadata with type and error without throwing', () => {
      const error = new Error('SCSB API 502')
      expect(() => {
        logger.error('Error retrieving customer code', {
          type: logger.LOG_TYPES.SCSB_OUTAGE,
          error,
          barcode: 'bc123456',
          scsbError: error.message
        })
      }).to.not.throw()
    })
  })

  describe('error logging without type', () => {
    it('logs plain error without type field without throwing', () => {
      const error = new Error('Some error')
      expect(() => {
        logger.error('Error message', error)
      }).to.not.throw()
    })

    it('logs with metadata but no type without throwing', () => {
      const error = new Error('Some error')
      expect(() => {
        logger.error('Error message', { error, somemetd: 'value' })
      }).to.not.throw()
    })
  })
})
