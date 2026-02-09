const simpleAnyQuery = {
  "query": {
    "bool": {
      "should": [
        {
          "bool": {
            "should": [
              {
                "multi_match": {
                  "query": "Hamlet",
                  "fields": [
                    "title",
                    "title.folded",
                    "titleAlt.folded",
                    "uniformTitle.folded",
                    "titleDisplay.folded",
                    "seriesStatement.folded",
                    "contentsTitle.folded",
                    "donor.folded",
                    "parallelTitle.folded",
                    "parallelTitleDisplay.folded",
                    "parallelSeriesStatement.folded",
                    "parallelTitleAlt.folded",
                    "parallelCreatorLiteral.folded",
                    "parallelUniformTitle",
                    "formerTitle",
                    "addedAuthorTitle"
                  ],
                  "type": "phrase"
                }
              }
            ]
          }
        },
        {
          "nested": {
            "path": "items",
            "query": {
              "bool": {
                "should": [
                  {
                    "multi_match": {
                      "query": "Hamlet",
                      "fields": [],
                      "type": "phrase"
                    }
                  }
                ]
              }
            }
          }
        },
        {
          "nested": {
            "path": "holdings",
            "query": {
              "bool": {
                "should": [
                  {
                    "multi_match": {
                      "query": "Hamlet",
                      "fields": [],
                      "type": "phrase"
                    }
                  }
                ]
              }
            }
          }
        }
      ]
    }
  }
}

module.exports =  {
  simpleAnyQuery
}
