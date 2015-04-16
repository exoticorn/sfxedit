import P from 'parsimmon';

var whitespace = P.whitespace.or(P.regex(/#[^\n]*\n/)).many();
function lexeme(p) { return p.skip(whitespace); }

var number = lexeme(P.regex(/-?\d+(\.\d+)?/).map(parseFloat));
var ident = lexeme(P.regex(/[a-z_]\w*/));
var lparen = lexeme(P.string('('));
var rparen = lexeme(P.string(')'));
var lsquare = lexeme(P.string('['));
var rsquare = lexeme(P.string(']'));
var comma = lexeme(P.string(','));
var equals = lexeme(P.string('='));
var mul = lexeme(P.string('*'));
var plus = lexeme(P.string('+'));
var slash = lexeme(P.string('/'));
var bang = lexeme(P.string('!'));
var lcurly = lexeme(P.string('{'));
var rcurly = lexeme(P.string('}'));
function repSep(p, s) {
    var rest = s.then(p).many();
    var list = P.seq(p, rest).map(r => r.slice(0, 1).concat(r[1]));
    return list.or(P.succeed([]));
}
function repOp(p, op) {
    return P.seq(p, P.seq(op, p).many()).map(r => {
        let result = r[0];
        for(let op of r[1]) {
            result = { op: op[0], left: result, right: op[1] };
        }
        return result;
    });
}

var expr = P.lazy('an expression', () => addOp);
var constExpr = P.lazy('a const expression', () => constAddOp);
var callParams = lparen.then(repSep(expr, comma)).skip(rparen);
var funCall = P.seq(ident, callParams).map(r => ({ call: r[0], params: r[1] }));
var sequenceData = P.seq(constExpr, P.seq(bang.or(slash), P.seq(constExpr, comma.then(constExpr))).atLeast(1)).map(r => {
    let result = [{ time: 0, set: r[0] }];
    for(let op of r[1]) {
        if(op[0] === '!') {
            result.push({ time: op[1][1], set: op[1][0] });
        } else {
            result.push({ time: op[1][1], slide: op[1][0] });
        }
    }
    return result;
});
var sequence = lsquare.then(sequenceData).skip(rsquare);
var random = lcurly.then(P.seq(constExpr, comma, constExpr).map(r => ({ rmin: r[0], rmax: r[2] }))).skip(rcurly);
var atom = funCall.or(ident).or(sequence).or(number).or(random).or(lparen.then(expr).skip(rparen));
var mulOp = repOp(atom, mul);
var addOp = repOp(mulOp, plus);

var constAtom = ident.or(number).or(random).or(lparen.then(constExpr).skip(rparen));
var constMulOp = repOp(constAtom, plus);
var constAddOp = repOp(constMulOp, plus);

var param = P.seq(ident.skip(equals), constExpr);
var params = lparen.then(repSep(param, comma)).skip(rparen.then(equals)).map(ps => {
    let pobj = {};
    for(let p of ps) {
        pobj[p[0]] = p[1];
    }
    return pobj;
});
var sfx = P.seq(ident, params, expr).mark().map(r => ({ name: r.value[0], params: r.value[1], body: r.value[2], start: r.start }));

var script = sfx.atLeast(1);

let parser = whitespace.then(script);
parser.formatError = P.formatError;
export default parser;
