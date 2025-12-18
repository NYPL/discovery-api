const { Grammars } = require('ebnf')

const cql = `
  query ::=  sub_query " " connective " " query | sub_query
  connective ::= "and" | "or"
  sub_query ::= atomic_query | "(" query ")"
  atomic_query ::= scope " " relation " " key | key
  scope ::= "title" | "contributor" | "keyword" | "callnumber" | "identifier" | "subject" | "language" | "date" | "center" | "format"
  relation ::= "any" | "adj" | "=" | "==" | "within" | "encloses"
  key ::= non_ws_key | '"' keyphrase '"'
  keyphrase ::= [^"]+
  non_ws_key ::= [^#x20#x09#x0A#x0D"()]+
`

const cqlParser = new Grammars.W3C.Parser(cql)

module.exports = { cqlParser }
