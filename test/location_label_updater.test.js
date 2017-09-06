let LocationLabelUpdater = require('../lib/location_label_updater.js')

describe('Location LabelUpdater', function () {
  it('will overwrite an ElasticSearch Response\'s holding location label', function () {
    // This is just enough information for LocationLabelUpdater to make use of
    let fakeESResponse = {'hits':
    {'hits': [{
      '_id': 'b10980129',
      '_source': {
        'items': [{
          'holdingLocation': [{'id': 'mai87', 'label': 'Some disgusting room'}]
        }]
      }
    }]}
    }

    let updatedResponse = new LocationLabelUpdater(fakeESResponse).responseWithUpdatedLabels()
    expect(updatedResponse.hits.hits[0]._source.items[0].holdingLocation[0].label).to.equal('Schwarzman Building - Periodicals and Microforms Room 119')
  })
})
