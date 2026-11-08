// Bundle parsing (the one dev dependency, @babel/parser): string literals of a bundle, and JSX children arrays.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let parser;
try { parser = require('@babel/parser'); } catch {
  throw new Error('@babel/parser is missing: run "npm ci" (or "npm install") in the repository root first');
}

export const parse = src => parser.parse(src, { sourceType: 'module', errorRecovery: false });

function visit(n, fn) {
  if (!n || typeof n.type !== 'string') return;
  fn(n);
  for (const k in n) {
    if (k === 'loc' || k === 'start' || k === 'end' || k === 'extra' || k === 'leadingComments' || k === 'trailingComments') continue;
    const v = n[k];
    if (Array.isArray(v)) for (const x of v) visit(x, fn); else if (v && typeof v.type === 'string') visit(v, fn);
  }
}
export const walkAst = (ast, fn) => visit(ast.program, fn);

// Every string and template text in a bundle: what a visitor can be shown (code identifiers are not included).
export function stringLiterals(src, ast = parse(src)) {
  const out = [];
  visit(ast.program, n => {
    if (n.type === 'StringLiteral') out.push(n.value);
    else if (n.type === 'TemplateElement') out.push(n.value.cooked ?? n.value.raw);
  });
  return out;
}

const lit = n => n && (n.type === 'StringLiteral' ? n.value : n.type === 'TemplateLiteral' && !n.expressions.length ? n.quasis[0].value.cooked : null);
const firstText = n => {
  if (!n) return null; const v = lit(n); if (v != null) return v;
  if (n.type === 'TemplateLiteral') return n.quasis[0].value.cooked;
  if (n.type === 'ConditionalExpression') { const c = firstText(n.consequent), a = firstText(n.alternate); return [c, a].find(x => x && /^[A-Za-z]/.test(x)) ?? c ?? a; }
  if (n.type === 'LogicalExpression') return firstText(n.right);
  return null;
};

// JSX children arrays where a text literal and an expression meet without a space ("review and" + {x}): GLUED, renders
// as "andfile"; or where a sentence is split into several text nodes at a space ("review and " + {cond ? 'sign' :
// 'file'}): SPLIT, renders fine, but readers that trim each text node show "andfile". (Port of qa/content/joins-static.mjs.)
export function joins(src, ast = parse(src)) {
  const out = [];
  visit(ast.program, n => {
    if (n.type !== 'ObjectProperty' || !(n.key.name === 'children' || n.key.value === 'children') || n.value.type !== 'ArrayExpression') return;
    const el = n.value.elements;
    for (let i = 0; i + 1 < el.length; i++) {
      if (!el[i] || !el[i + 1]) continue;
      const a = lit(el[i]), b = lit(el[i + 1]);
      if (a != null && b != null) continue; // two literals render as written
      const bt = b ?? firstText(el[i + 1]);
      const ctx = src.slice(el[i].start, el[i + 1].end).slice(0, 160).replace(/\s+/g, ' ');
      if (a != null && /[A-Za-z]$/.test(a) && el[i + 1].type !== 'CallExpression' && bt != null && /^[A-Za-z]/.test(bt)) out.push({ kind: 'GLUED', ctx });
      else if (a != null && /[a-z] $/.test(a) && bt != null && /^[a-z]/.test(bt)) out.push({ kind: 'SPLIT', ctx });
      else if (a == null && b != null && /^[a-z]/.test(b) && el[i].type !== 'CallExpression' && /[A-Za-z]$/.test(firstText(el[i]) ?? '')) out.push({ kind: 'GLUED', ctx });
    }
  });
  return out;
}
