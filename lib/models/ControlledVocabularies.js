class ControlledVocabularies {
  // We'll store the promise here
  static fetchedVocabularies = null
  // We'll store the synchronously accessible data here
  static cachedData = {}

  /**
   * Initializes the fetch request. Call this once during app startup.
   */
  static async initialize (app) {
    if (!this.fetchedVocabularies) {
      // Assign the promise itself to the variable
      this.fetchedVocabularies = app.vocabularies({}, {})
        .then(data => {
          this.cachedData = {
            format: data.formats,
            language: data.languages,
            center: data.buildingLocations,
            division: data.collections
          }
          return this.cachedData
        })
        .catch(error => {
          // If it fails, clear the promise so we can try again next time
          this.fetchedVocabularies = null
          throw error
        })
    }

    return this.fetchedVocabularies
  }

  /**
   * Synchronously grab the data if you are absolutely sure it has resolved,
   * or await the promise to be safe.
   */
  static async getData () {
    if (!this.fetchedVocabularies) {
      throw new Error('ControlledVocabularies has not been initialized. Call initialize() first.')
    }

    // Returning the promise means callers can safely await it
    return this.fetchedVocabularies
  }

  /**
   * Synchronously return the cached data. Use this in synchronous functions
   * like cql_query_builder that cannot await the Promise.
   */
  static getCachedData () {
    return this.cachedData
  }
}

module.exports = ControlledVocabularies
