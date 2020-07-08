class Feature {
  /**
   *  Returns `true` if the named feature is enabled
   *
   *  Inspects process.env.FEATURES, which is expeced to be a string of comma-
   *  delimited shish-kebob case feature flags, e.g.
   *    "feature-1,feature-2,yet-another-feature"
   */
  static enabled (key) {
    return (process.env.FEATURES || '')
      .split(',')
      .map((v) => v.trim())
      .some((v) => v === key)
  }
}

module.exports = Feature
