const { Grammars } = require('ebnf')

function reverseGrammar (grammar) {
  return grammar.split('\n')
    .map(line =>
      (line.split('::=')
        .map(side =>
          (side.split('|')
            .map(dis =>
              (dis.split(' ')
                .map(word =>
                  (word.includes('"') ? word.split('').reverse().join('') : word))
                .reverse().join(' '))
            ).join('|'))).join('::= '))).join('\n')
}

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

function simplify (ast) {
  switch (ast.type) {
    case 'query': {
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

function reverseString (string) {
  return string.split('').reverse().join('')
}

function reverseAST (tree) {
  tree.text = reverseString(tree.text)
  tree.children = tree.children.map(child => reverseAST(child)).reverse()
  return tree
}

const rightCqlParser = new Grammars.W3C.Parser(rightCql)

function parseRight (string, parser) {
  return reverseAST(parser.getAST(reverseString(string)))
}

function parseWithRightCql (string) {
  return parseRight(string, rightCqlParser)
}

function display (ast) {
  if (!ast.type.includes('query')) {
    return ast.text
  }

  const childTypes = [
    'atomic_query', 'sub_query', 'query', 'connective',
    'scope', 'relation', 'quoted_term'
  ]

  const children = ast.children
    .filter(child => childTypes.includes(child.type))
    .map(child => display(child))

  if (children.length === 1) {
    return children[0]
  }

  return children
}

function displayParsed (string) {
  const parsed = rightCqlParser.getAST(reverseString(string))
  if (!parsed) return {}
  if (parsed.errors.length) {
    return {
      error: parsed.errors.map(error =>
        `Parsing error likely near end of "${reverseString(error.token.rest)}"`
      ).join("\n")
    }
  }
  return { parsed: display(reverseAST(parsed)) }
}

module.exports = { simplify, reverseAST, reverseGrammar, parseRight, parseWithRightCql, rightCqlParser, reverseString, displayParsed }
