// The listed-term rules of the demo storyline: the company-form rules (HANGS Construction Services LLC is a C
// corporation: board, officers, shareholders, dividends) and the lookalike rules. Like the client-systems generator's
// rules, the patterns are stored rot13-encoded so this public repository carries none of the listed words; decode one
// with rot13 to read it. Each TERMS entry: [label, pattern, flags]. A hit is ignored when an ALLOW pattern covers it:
// roles (an audit firm's engagement partner, a law firm's partner), companies whose legal names end in "Partners LLC"
// (customers and vendors; the customer Juniper Ridge Partners may be named without "LLC" but not as a job name), and
// bare numbers in ids and cells (only form references are flagged: spreadsheet row ids such as 1446 in ledgers and
// workpapers pass). Encoded data (base64 runs, data: URIs) is removed before scanning, so letter pairs inside image
// data never count.
const rot13 = s => s.replace(/[a-z]/gi, c => { const b = c <= 'Z' ? 65 : 97; return String.fromCharCode((c.charCodeAt(0) - b + 13) % 26 + b); });
const ENC_TERMS = [
  ["cnegarefuvc jbeqvat","\\ocnegare(?:f|fuvc|fuvcf|f’|f')?\\o","gi"],
  ["yvzvgrq cnegarefuvc (YC)","\\oYC\\o","g"],
  ["wbvag iragher","\\o(?:WI|WIf|[Ww]bvag [Ii]ragherf?)\\o","g"],
  ["Sbez 1065","\\o(?:Sbezf?|Fpurqhyrf?|VEF|gur|n)\\f+1065\\o|\\o1065\\f+(?:erghea|svyvat|vafgehpgvbaf|Fpurqhyr)|\\ov1065\\o","gi"],
  ["Fpurqhyr X-1","\\oX-1f?\\o","g"],
  ["Sbez/frpgvba 1446","\\o(?:Sbezf?|[Ff]rpgvba|§)\\f*1446\\o","g"],
  ["qvfgevohgvbaf gb bjaref","\\o(?:cnegare|zrzore|bjare|pncvgny)f?[’']?\\f+qvfgevohgvbaf?\\o|\\oqvfgevohgvbaf?\\f+gb\\f+(?:cnegaref|zrzoref|bjaref)\\o","gi"],
  ["havg fnyrf","\\ohavg\\f+fnyrf?\\o","gi"],
  ["rfpebj pybfvat","\\orfpebj\\o","gi"],
  ["rnearfg zbarl","\\ornearfg\\f+zbarl\\o","gi"],
  ["cnqf / cunfrf","\\o(?:Cnqf?|Cunfrf?)\\f+\\q+\\o","g"],
  ["ubzrohvyqre / ubzrf","\\oubzr\\f?ohvyq(?:re|ref|vat)\\o|\\ogbjaubz(?:r|rf)\\o|\\oubzrf\\o","gi"],
  ["\"<Anzr> Ebj/Lneq\" cebwrpg anzr","\\o[N-M][n-m]+ (?:Ebj|Lneq)\\o","g"],
  ["Pnanqn","\\oPnanq(?:n|vna)\\o","g"],
  ["cevingr pyvrag anzr","vagenpbec","gi"],
  // names of the older audit design that the shared FY2026 books replaced
  ["byq nhqvg qrfvta anzr","\\oZnefutngr\\o","g"],
];
const ENC_ALLOW = [
  ["ratntrzrag cnegaref?\\o","i"],
  ["\\oCnegare, [N-M][N-Mn-m&' ]+ YYC\\o",""],
  ["\\o(?:[N-M][N-Mn-m.&'’-]*\\f){1,5}Cnegaref,? (?:YYP|Y\\.Y\\.P\\.|Vap\\.?|Ygq\\.?)",""],
  ["Xrfgery Cbvag Ubgry Cnegaref",""],
  ["Whavcre Evqtr Cnegaref(?![,’']?\\f+(?:9 |avar )?(?:syrk|wbo\\o|\\(W-))",""],
];
export const TERMS = ENC_TERMS.map(([l, s, f]) => [rot13(l), new RegExp(rot13(s), f)]);
export const ALLOW = ENC_ALLOW.map(([s, f]) => new RegExp(rot13(s), f));

const BEFORE = 60, AFTER = 40;
// Returns [{ label, match, context }] for one text.
export function scanTerms(text) {
  const hits = [];
  for (const [label, re] of TERMS) {
    re.lastIndex = 0;
    for (const m of text.matchAll(re)) {
      const from = Math.max(0, m.index - BEFORE), local = text.slice(from, m.index + m[0].length + AFTER);
      const covered = ALLOW.some(a => {
        const r = new RegExp(a.source, a.flags.includes('g') ? a.flags : a.flags + 'g');
        for (const x of local.matchAll(r)) { const s = from + x.index; if (s <= m.index && s + x[0].length >= m.index + m[0].length) return true; }
        return false;
      });
      if (covered) continue;
      hits.push({ label, match: m[0], context: text.slice(Math.max(0, m.index - 40), m.index + m[0].length + 40).replace(/\s+/g, ' ') });
    }
  }
  return hits;
}
