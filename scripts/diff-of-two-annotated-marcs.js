const argv = require('minimist')(process.argv.slice(2))
const fs = require('fs')

const remote = require(argv[0])
const local = require(argv[1])

function fields (obj) {
  return obj.bib.fields
}

const remoteFields = fields(remote)
const localFields = fields(local)

const diff = {}

remoteFields.forEach((field) => {
  diff[field.label] = { remote: field.values, local: [] }
})

localFields.forEach((field) => {
  if (diff[field.label]) {
    diff[field.label].local = field.values
  } else {
    diff[field.label] = { remote: [], local: field.values }
  }
})

Object.keys(diff).forEach((key) => {
  diff[key] = differenceOfTwoFields(diff[key])
})

const result = {}
Object.keys(diff).forEach((key) => {
  if (diff[key].local.length !== 0 || diff[key].remote.length !== 0) {
    result[key] = diff[key]
  }
})

fs.writeFileSync('./diff_outputs2.json', JSON.stringify(result, null, 2))

function differenceOfTwoFields (obj) {
  return {
    local: setMinus(obj.local, obj.remote),
    remote: setMinus(obj.remote, obj.local)
  }
}

function setMinus (arr1, arr2) {
  const jsonized = arr2.map((item) => JSON.stringify(item))
  return arr1.filter((item) => !jsonized.includes(JSON.stringify(item)))
}
