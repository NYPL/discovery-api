const { Grammars } = require('ebnf')

let cql = `
  query ::=  sub_query " " connective " " query | sub_query
  connective ::= "AND" | "OR"
  sub_query ::= atomic_query | "NOT " atomic_query | "(" query ")"
  atomic_query ::= scope " " relation " " quoted_term
  scope ::= "title" | "author" | "keyword" | "callnumber" | "identifier" | "subject" | "language" | "date" | "series"| "genre" | "center" | "division" | "format"
  relation ::= "any" | "adj" | "all" | "<=" | ">=" | "<" | ">" | "=" | "==" | "within" | "encloses"
  quoted_term ::= '"' term '"'
  term ::= escaped_char term | regular_char term | escaped_char | regular_char
  regular_char ::= [^"\\\\]
  escaped_char ::= slash char
  slash ::= "\\\\"
  char ::= [a-z]|[^a-z]

`

let alt_cql = `
  query ::=  sub_query " " connective " " query | sub_query
  connective ::= "AND" | "OR"
  sub_query ::= atomic_query | "NOT " atomic_query | "(" query ")"
  atomic_query ::= scope " " relation " " quoted_term
  scope ::= "title" | "author" | "keyword" | "callnumber" | "identifier" | "subject" | "language" | "date" | "series"| "genre" | "center" | "division" | "format"
  relation ::= "any" | "adj" | "all" | "<=" | ">=" | "<" | ">" | "=" | "==" | "within" | "encloses"
  quoted_term ::= '"' TERM '"'
  TERM ::= ESCAPED_CHAR TERM | REGULAR_CHAR TERM | ESCAPED_CHAR | REGULAR_CHAR
  REGULAR_CHAR ::= [^"\\\\]
  ESCAPED_CHAR ::= SLASH CHAR
  SLASH ::= "\\\\"
  CHAR ::= [a-z]|[^a-z]
`

const cqlParser = new Grammars.W3C.Parser(cql)
const alt_cqlParser = new Grammars.W3C.Parser(alt_cql)

module.exports = { cqlParser, alt_cqlParser }
