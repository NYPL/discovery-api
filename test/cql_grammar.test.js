const { expect } = require('chai')

const { cqlParser, simplify, rectifyTree } = require('../lib/elasticsearch/cql_grammar')


function validateAtomicQuery(parsed, scope, relation, quotedTerm) {
  expect(parsed.type).to.equal("query")
  expect(parsed.children.length).to.equal(1)
  const subQuery = parsed.children[0]
  expect(subQuery.type).to.equal("sub_query")
  expect(subQuery.children.length).to.equal(1)
  const atomicQuery = subQuery.children[0]
  expect(atomicQuery.type).to.equal("atomic_query")
  const scopeNode = atomicQuery.children.find(child => child.type === "scope")
  const scopeTerm = scopeNode.children.find(child => child.type === "scope_term")
  expect(scopeTerm.text).to.equal(scope)
  const relationNode = atomicQuery.children.find(child => child.type === "relation")
  const relationTerm = relationNode.children.find(child => child.type === "relation_term")
  expect(relationTerm.text).to.equal(relation)
  const quotedTermNode = atomicQuery.children.find(child => child.type === "quoted_term")
  expect(quotedTermNode.text).to.equal(quotedTerm)
}

function validateBooleanQuery(parsed, expected) {

}

describe.only('CQL Grammar', function  () {
  describe('parsing queries', function () {
    it('parses atomic queries', function () {
      validateAtomicQuery(cqlParser.getAST("title=\"hamlet\""), "title", "=", "\"hamlet\"")
      validateAtomicQuery(cqlParser.getAST("author adj \"shakespeare\""), "author", "adj", "\"shakespeare\"")
      validateAtomicQuery(cqlParser.getAST("keyword  any \"hamlet shakespeare\""), "keyword", "any", "\"hamlet shakespeare\"")
      validateAtomicQuery(cqlParser.getAST("subject all \"hamlet shakespeare\""), "subject", "all", "\"hamlet shakespeare\"")
    })

    it('allows whitespace variants', function () {
      validateAtomicQuery(cqlParser.getAST("title =\"hamlet\""), "title", "=", "\"hamlet\"")
      validateAtomicQuery(cqlParser.getAST("title= \"hamlet\""), "title", "=", "\"hamlet\"")
      validateAtomicQuery(cqlParser.getAST("title = \"hamlet\""), "title", "=", "\"hamlet\"")
      validateAtomicQuery(cqlParser.getAST("title  = \"hamlet\""), "title", "=", "\"hamlet\"")
      validateAtomicQuery(cqlParser.getAST("title  =  \"hamlet\""), "title", "=", "\"hamlet\"")
      validateAtomicQuery(cqlParser.getAST("author adj \"shakespeare\""), "author", "adj", "\"shakespeare\"")
      validateAtomicQuery(cqlParser.getAST("author  adj \"shakespeare\""), "author", "adj", "\"shakespeare\"")
      validateAtomicQuery(cqlParser.getAST("author adj  \"shakespeare\""), "author", "adj", "\"shakespeare\"")
      validateAtomicQuery(cqlParser.getAST("author  adj  \"shakespeare\""), "author", "adj", "\"shakespeare\"")
    })

    it('correctly escapes escape characters', function () {
      validateAtomicQuery(cqlParser.getAST("keyword=\"Notes on \\\"The Underground\\\"\""), "keyword", "=", "\"Notes on \\\"The Underground\\\"\"")
      validateAtomicQuery(cqlParser.getAST("title=\"This title ends in a slash \\\\\""), "title", "=", "\"This title ends in a slash \\\\\"")
    })

    it('identifies words correctly', function () {
      const parsed = cqlParser.getAST("keyword adj \"A multiword keyword\"")
      const words = []
      let nodes = [parsed]
      while (nodes.length) {
        let node = nodes.shift()
        if (node.type === "word") {
          words.push(node.text)
        } else {
          nodes = nodes.concat(node.children)
        }
      }
      const expectedWords = ["A", "multiword", "keyword"]
      words.forEach(word => {
        expect(expectedWords).to.include(word)
      })
      expect(words.length).to.equal(3)
    })

    it('parses boolean queries', function () {
      expect(simplify(cqlParser.getAST(
        "title=\"dogs\" AND keyword=\"cats\""
      ))).to.deep.equal(
        [ [ 'title', '=', [ 'dogs' ] ], 'AND', [ 'keyword', '=', [ 'cats' ] ] ]
      )

      expect(simplify(cqlParser.getAST(
        "title=\"dogs\" AND keyword=\"cats\" OR author adj \"Bird\""
      ))).to.deep.equal(
        [
          [
            "title", "=", ["dogs"]
          ],
          "AND",
          [
            [
              "keyword", "=", ["cats"]
            ],
            "OR",
            [
              "author", "adj", ["Bird"]
            ]
          ]
        ]
      )
    })

    it('parses queries with parentheses', function () {
      expect()
        .to.deep.equal(
          [
            [ [ 'title', '=', ['dogs'] ], 'AND', [ 'keyword', '=', ['cats'] ] ],
            'OR',
            [ 'author', 'adj', [ 'Bird' ] ]
          ]
        )
    })
  })
})
