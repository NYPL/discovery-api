const { Grammars } = require('ebnf')

const cql = `
  query ::=  sub_query " " connective " " query | sub_query
  connective ::= "and" | "or"
  sub_query ::= atomic_query | "(" query ")"
  atomic_query ::= scope " " relation " " key | key
  scope ::= "title" | "contributor" | "keyword" | "callNumber" | "identifier" | "subject" | "language" | "date" | "center" | "format"
  relation ::= "any" | "adj" | "=" | "==" | "within" | "encloses"
  key ::= NON_WS_KEY | '"' KEYPHRASE '"'
  KEYPHRASE ::= [^"]+
  NON_WS_KEY ::= [^#x20#x09#x0A#x0D"()]+
`

const cqlParser = new Grammars.W3C.Parser(cql)

module.exports = { cqlParser }
