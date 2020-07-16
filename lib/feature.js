class Feature {
  /**
   *  Returns `true` if the named feature is enabled
   *
   *  There are two ways to enable a feature:
   *   1. Environment variable "FEATURES"
   *   2. Request header "X-Features"
   *
   *  Both values are expeced to be a string of comma-delimited shish-kebob
   *  case feature flags, e.g.
   *    "feature-1,feature-2,yet-another-feature"
   *
   *  Methods can be combined; The set of all features enabled is the set of
   *  features enabled by either method
   */
  static enabled (key, request = null) {
    const envFeatures = (process.env.FEATURES || '').split(',')
    const requestFeatures = (request && request.headers ? request.headers['x-features'] || '' : '').split(',')
    return envFeatures.concat(requestFeatures)
      .map((v) => v.trim())
      .some((v) => v === key)
  }
}

module.exports = Feature
