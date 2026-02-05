const { Grammars } = require('ebnf')

// let cql = `
//   query ::=  sub_query " " connective " " query | sub_query
//   connective ::= "AND" | "OR"
//   sub_query ::= atomic_query | "NOT " atomic_query | "(" query ")"
//   atomic_query ::= scope " " relation " " quoted_term
//   scope ::= "title" | "author" | "keyword" | "callnumber" | "identifier" | "subject" | "language" | "date" | "series"| "genre" | "center" | "division" | "format"
//   relation ::= "any" | "adj" | "all" | "<=" | ">=" | "<" | ">" | "=" | "==" | "within" | "encloses"
//   quoted_term ::= '"' term '"'
//   term ::= escaped_char term | regular_char term | escaped_char | regular_char
//   regular_char ::= [^"\\\\]
//   escaped_char ::= slash char
//   slash ::= "\\\\"
//   char ::= [a-z]|[^a-z]
//
// `
//
// let alt_cql = `
//   query ::=  sub_query " " connective " " query | sub_query
//   connective ::= "AND" | "OR"
//   sub_query ::= atomic_query | "NOT " atomic_query | "(" query ")"
//   atomic_query ::= scope " " relation " " quoted_term
//   scope ::= "title" | "author" | "keyword" | "callnumber" | "identifier" | "subject" | "language" | "date" | "series"| "genre" | "center" | "division" | "format"
//   relation ::= "any" | "adj" | "all" | "<=" | ">=" | "<" | ">" | "=" | "==" | "within" | "encloses"
//   quoted_term ::= '"' TERM '"'
//   TERM ::= ESCAPED_CHAR TERM | REGULAR_CHAR TERM | ESCAPED_CHAR | REGULAR_CHAR
//   REGULAR_CHAR ::= [^"\\\\]
//   ESCAPED_CHAR ::= SLASH CHAR
//   SLASH ::= "\\\\"
//   CHAR ::= [a-z]|[^a-z]
// `

// let word_cql = `
//   query ::=  sub_query whitespace connective whitespace query | sub_query
//   connective ::= "AND" | "OR" | "NOT"
//   sub_query ::= atomic_query | "(" query ")"
//   atomic_query ::= scope optional_whitespace relation optional_whitespace quoted_term
//   scope ::= "title" | "author" | "keyword" | "callnumber" | "identifier" | "subject" | "language" | "date" | "series"| "genre" | "center" | "division" | "format"
//   relation ::= "any" | "adj" | "all" | "<=" | ">=" | "<" | ">" | "=" | "==" | "within" | "encloses"
//   quoted_term ::= '"' phrase '"'
//   phrase ::= word whitespace phrase | word
//   optional_whitespace ::= whitespace | ""
//   whitespace ::= [#x20#x09#x0A#x0D]+
//   word ::= escaped_char word | regular_char word | escaped_char | regular_char
//   regular_char ::= [^"\\\\#x20#x09#x0A#x0D]
//   escaped_char ::= slash char
//   slash ::= "\\\\"
//   char ::= [a-z]|[^a-z]

// NEED to add some allowed whitespace before and after atomic queries

const ridic = `
  query ::= sub_query whitespace connective whitespace query | sub_query
  connective ::= "TON DNA" | "DNA" | "RO" | "NOT"
  sub_query ::= atomic_query | ")" query "("
  atomic_query ::= [a-z]+
  whitespace ::= [#x20#x09#x0A#x0D]+
`

// const cql = `
//   query ::=  sub_query whitespace connective whitespace query | sub_query
//   connective ::= "AND NOT" | "AND" | "OR" | "NOT"
//   sub_query ::= atomic_query | "(" query ")"
//   atomic_query ::= scope relation quoted_term
//   scope ::= scope_term whitespace | scope_term
//   relation ::= relation_term whitespace | relation_term
//   scope_term ::= "title" | "author" | "keyword" | "callnumber" | "identifier" | "subject" | "language" | "date" | "series"| "genre" | "center" | "division" | "format"
//   relation_term ::= "any" | "adj" | "all" | "<=" | ">=" | "<" | ">" | "=" | "==" | "within" | "encloses"
//   quoted_term ::= '"' phrase '"'
//   phrase ::= word whitespace phrase | word
//   whitespace ::= [#x20#x09#x0A#x0D]+
//   word ::= escaped_char word | regular_char word | escaped_char | regular_char
//   regular_char ::= [^"\\\\#x20#x09#x0A#x0D]
//   escaped_char ::= slash char
//   slash ::= "\\\\"
//   char ::= [a-z]|[^a-z]
//
// `

// function reverseGrammar (grammar) {
//   return grammar.split("\n").map(line =>
//     (line.split("::=").map(side =>
//       (side.split("|").map(disjunct =>
//         (disjunct.split(" ").map(word =>
//           (word => word.includes("\"") ? reverseString(word) : word)
//         ).reverse().join(" "))
//       )).join("|")
//     )).join("::=")
//   ).join("\n")
// }

function reverseGrammar (grammar) {
  return grammar.split("\n")
    .map(line =>
      (line.split("::=")
        .map(side =>
          (side.split("|")
            .map(dis =>
              (dis.split(" ")
                .map(word =>
                  (word.includes("\"") ? word.split("").reverse().join("") : word))
                .reverse().join(" "))
              ).join("|"))).join("::= "))).join("\n")
}



const leftTest = `
  query ::= query connective sub_query | sub_query
  connective ::= "AND" | "OR"
  sub_query ::= [a-z]+
`

const leftCql = `
 query ::=  query whitespace connective whitespace sub_query | sub_query
 connective ::= "AND NOT" | "AND" | "OR" | "NOT"
 sub_query ::= atomic_query | "(" query ")"
 atomic_query ::= scope relation quoted_term
 scope ::= scope_term whitespace | scope_term
 relation ::= relation_term whitespace | relation_term
 scope_term ::= "title" | "author" | "keyword" | "callnumber" | "identifier" | "subject" | "language" | "date" | "series"| "genre" | "center" | "division" | "format"
 relation_term ::= "any" | "adj" | "all" | "<=" | ">=" | "<" | ">" | "=" | "==" | "within" | "encloses"
 quoted_term ::= quote phrase quote
 phrase ::= phrase whitespace word | word
 whitespace ::= [#x20#x09#x0A#x0D]+
 word ::= word escaped_char | word regular_char | escaped_char | regular_char
 regular_char ::= [^#x22#x5c#x20#x09#x0A#x0D]
 escaped_char ::= slash char
 slash ::= [#x5c]
 char ::= [a-z]|[^a-z]
 quote ::= [#x22]
`

const rightCql = reverseGrammar(leftCql)

const cql = `
 query ::=  sub_query whitespace connective whitespace query | sub_query
 connective ::= "AND NOT" | "AND" | "OR" | "NOT"
 sub_query ::= atomic_query | "(" query ")"
 atomic_query ::= scope relation quoted_term
 scope ::= scope_term whitespace | scope_term
 relation ::= relation_term whitespace | relation_term
 scope_term ::= "title" | "author" | "keyword" | "callnumber" | "identifier" | "subject" | "language" | "date" | "series"| "genre" | "center" | "division" | "format"
 relation_term ::= "any" | "adj" | "all" | "<=" | ">=" | "<" | ">" | "=" | "==" | "within" | "encloses"
 quoted_term ::= quote phrase quote
 phrase ::= word whitespace phrase | word
 whitespace ::= [#x20#x09#x0A#x0D]+
 word ::= escaped_char word | regular_char word | escaped_char | regular_char
 regular_char ::= [^#x22#x5c#x20#x09#x0A#x0D]
 escaped_char ::= slash char
 slash ::= [#x5c]
 char ::= [a-z]|[^a-z]
 quote ::= [#x22]
`

// const cql = `
//   query ::=  sub_query whitespace connective whitespace query | sub_query
//   connective ::= "AND NOT" | "AND" | "OR" | "NOT"
//   sub_query ::= atomic_query | "(" query ")"
//   atomic_query ::= scope relation quoted_term
//   scope ::= scope_term whitespace | scope_term
//   relation ::= relation_term whitespace | relation_term
//   scope_term ::= "title" | "author" | "keyword" | "callnumber" | "identifier" | "subject" | "language" | "date" | "series"| "genre" | "center" | "division" | "format"
//   relation_term ::= "any" | "adj" | "all" | "<=" | ">=" | "<" | ">" | "=" | "==" | "within" | "encloses"
//   quoted_term ::= quote phrase quote
//   phrase ::= word whitespace phrase | word
//   whitespace ::= [#x20#x09#x0A#x0D]+
//   word ::= escaped_char word | regular_char word | escaped_char | regular_char
//   regular_char ::= [^#5c#x22#x20#x09#x0A#x0D]
//   escaped_char ::= slash char
//   slash ::= [#x5c]
//   char ::= [a-z]|[^a-z]
//   quote ::= [#x22]
//
// `

// const escaping = `
//   quoted_term ::= quote phrase quote
//   phrase ::= word whitespace phrase | word
//   whitespace ::= [#x20#x09#x0A#x0D]+
//   word ::= escaped_char word | regular_char word | escaped_char | regular_char
//   regular_char ::= [^#5c#x22#x20#x09#x0A#x0D]
//   escaped_char ::= slash char
//   slash ::= [#x5c]
//   char ::= [a-z]|[^a-z]
//   quote ::= [#x22]
// `

function simplifyRidic (ast) {
  if (ast.type === 'atomic_query' || ast.type === 'connective') return ast.text
  return ast.children.map(child => simplifyRidic(child))
}

function simplify (ast) {
  switch (ast.type) {
    case 'query': {
      console.log('query')
      const children = ast.children.filter(child => child.type !== 'whitespace').map(child => simplify(child))
      return children.length > 1 ? children : children[0]
    }
    case 'connective':
      return ast.text
    case 'sub_query':
      return simplify(ast.children.find(child => child.type.includes('query')))
    case 'atomic_query':
      return ast.children.map(child => simplify(child))
    case 'scope':
      return simplify(ast.children.find(child => child.type.includes('scope_term')))
    case 'relation':
      return simplify(ast.children.find(child => child.type.includes('relation_term')))
    case 'scope_term':
      return ast.text
    case 'relation_term':
      return ast.text
    case 'quoted_term':
      return simplify(ast.children.find(child => child.type.includes('phrase')))
    case 'phrase': {
      const word = ast.children.find(child => child.type === 'word')
      const phrase = ast.children.find(child => child.type === 'phrase')
      return [simplify(word)].concat(phrase ? simplify(phrase) : [])
    }
    case 'word':
      return ast.text
    default:
      break
  }
}

function partialSimplify (tree) {
  if (['phrase', 'relation_term', 'scope_term', 'connective'].includes(tree.type)) {
    return tree.text
  }
  if (tree.type === 'sub_query') {
    return [partialSimplify(tree.children.find(child => child.type.includes('query')))]
  }
  const simplifiedChildren = tree.children.map(child => partialSimplify(child))
  return simplifiedChildren.length === 1 ? simplifiedChildren[0]: simplifiedChildren

}

function rectifyTree (tree) {
  // collect all the boolean queries that directly contain boolean queries
  const toRotate = []
  const nodeQueue = [tree]
  while (nodeQueue.length) {
    let node = nodeQueue.shift()
    if (node.type === 'query' && node.children.find(child => child.type === 'connective')) {
      let rightChild = node.children.find(child => child.type === 'query')
      if (rightChild && rightChild.children.find(child => child.type === 'connective')) {
        toRotate.push(node)
      }
    }
    node.children.forEach(child => {nodeQueue.push(child)})
  }
  console.log('toRotate: ', toRotate)
  toRotate.forEach(node => {
    console.log('rotating: ', node)
    console.dir(tree, {depth: null})
    const lastChild = node.children[node.children.length - 1]
    const grandChild = lastChild.children[0]
    node.children[node.children.length - 1] = grandChild
    lastChild[0] = node
  })
}

function rectifySkeleton (tree) {
  const connectives = ["AND", "OR"]
  const toRotate = []
  const nodeQueue = [tree]
  while (nodeQueue.length) {
    let node = nodeQueue.shift()
    if (node.find(child => connectives.includes(child))) {
      let rightChild = node[node.length - 1]
      if (rightChild.find(child => connectives.includes(child))) {
        toRotate.push(node)
      }
    }
    node.forEach(child => {nodeQueue.push(child)})
  }
  console.log('toRotate: ', toRotate)
  toRotate.forEach(node => {
    console.log('rotating: ', node)
    console.dir(tree, {depth: null})
    const lastChild = node.pop()
    node.push(lastChild.shift())
    lastChild.unshift(node)
  })
}

function reverseString (string) {
  return string.split("").reverse().join("")
}

function reverseAST (tree) {
  tree.text = reverseString(tree.text)
  tree.children = tree.children.map(child => reverseAST(child)).reverse()
  return tree
}

// let convenient_cql = `
//   query ::=  sub_query " " connective " " query | sub_query
//   connective ::= "AND" | "OR"
//   sub_query ::= atomic_query | "NOT " atomic_query | "(" query ")"
//   atomic_query ::= scope " " relation " " quoted_term | quoted_term | word
//   scope ::= "title" | "author" | "keyword" | "callnumber" | "identifier" | "subject" | "language" | "date" | "series"| "genre" | "center" | "division" | "format"
//   relation ::= "any" | "adj" | "all" | "<=" | ">=" | "<" | ">" | "=" | "==" | "within" | "encloses"
//   quoted_term ::= '"' phrase '"'
//   phrase ::= word whitespace phrase | word
//   whitespace ::= [#x20#x09#x0A#x0D]+
//   word ::= escaped_char word | regular_char word | escaped_char | regular_char
//   regular_char ::= [^"\\\\#x20#x09#x0A#x0D]
//   escaped_char ::= slash char
//   slash ::= "\\\\"
//   char ::= [a-z]|[^a-z]
//
// `

// const cqlParser = new Grammars.W3C.Parser(cql)
// const alt_cqlParser = new Grammars.W3C.Parser(alt_cql)
const cqlParser = new Grammars.W3C.Parser(cql)
const ridicParser = new Grammars.W3C.Parser(ridic)
const rightCqlParser = new Grammars.W3C.Parser(rightCql)

function parseRight (string, parser) {
  return reverseAST(parser.getAST(reverseString(string)))
}

function parseWithRightCql (string) {
  return parseRight(string, rightCqlParser)
}
// const escapingParser = new Grammars.W3C.Parser(escaping)

module.exports = { cqlParser, simplify, rectifyTree, partialSimplify, ridicParser, simplifyRidic, reverseAST, leftTest, reverseGrammar, leftCql, Grammars, parseRight, parseWithRightCql }//, escapingParser }
