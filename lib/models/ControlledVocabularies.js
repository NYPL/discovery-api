class ControlledVocabularies {
  // We'll store the promise here
  static fetchedVocabularies = null;

  /**
   * Initializes the fetch request. Call this once during app startup.
   */
  static async initialize() {
    if (!this.fetchedVocabularies) {
      // Assign the promise itself to the variable
      this.fetchedVocabularies = fetch(process.env.vocabulariesEndpoint)
        .then(async response => {
          if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
          }
          const data = await response.json();
          return {
            format: data.formats,
            language: data.languages,
            center: data.buildingLocations,
            division: data.collections
          };
        })
        .catch(error => {
          // If it fails, clear the promise so we can try again next time
          this.fetchedVocabularies = null;
          throw error;
        });
    }
    
    return this.fetchedVocabularies;
  }

  /**
   * Synchronously grab the data if you are absolutely sure it has resolved,
   * or await the promise to be safe.
   */
  static async getData() {
    if (!this.fetchedVocabularies) {
      throw new Error('ControlledVocabularies has not been initialized. Call initialize() first.');
    }
    
    // Returning the promise means callers can safely await it
    return this.fetchedVocabularies;
  }
}

module.exports = ControlledVocabularies;
