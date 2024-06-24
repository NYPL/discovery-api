const LocationLabelUpdater = require('../lib/location_label_updater.js')

describe('Location LabelUpdater', function () {
  it('will overwrite an ElasticSearch Response\'s item holding location label', function () {
    // This is just enough information for LocationLabelUpdater to make use of
    const fakeESResponse = {
      hits:
    {
      hits: [{
        _id: 'b10980129',
        _source: {
          items: [{
            holdingLocation: [{ id: 'mai82', label: 'Some disgusting room' }]
          }]
        }
      }]
    }
    }

    const updatedResponse = new LocationLabelUpdater(fakeESResponse).responseWithUpdatedLabels()
    expect(updatedResponse.hits.hits[0]._source.items[0].holdingLocation[0].label).to.equal('Schwarzman Building - Microforms Room 315')
  })

  it('will overwrite an ElasticSearch Response\'s holdings record location label', function () {
    // This is just enough information for LocationLabelUpdater to make use of
    const fakeESResponse = {
      hits:
    {
      hits: [{
        _id: 'b10980129',
        _source: {
          holdings: [{
            location: [{ code: 'mai', label: 'Some other room name' }]
          }]
        }
      }]
    }
    }

    const updatedResponse = new LocationLabelUpdater(fakeESResponse).responseWithUpdatedLabels()
    expect(updatedResponse.hits.hits[0]._source.holdings[0].location[0].label).to.equal('Schwarzman Building - Microforms Room 315')
  })
})
