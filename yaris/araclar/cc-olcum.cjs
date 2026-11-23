#!/usr/bin/env node
// cc-olcum: measure a race run from its Claude Code session transcript (READ-ONLY on the transcripts).
// For each run code it finds the Claude Code project folder of the run root (e.g. C:\yaris\K1-O-CC),
// reads the main session .jsonl (+ its subagent transcripts) and reports:
//   wall-clock minutes (first entry -> last assistant message), assistant turns, tool calls,
//   tokens (input / output / cache write / cache read) and the API-price equivalent in USD.
// Tokens are de-duplicated by message id (largest value per message), tool calls by tool_use id.
// Cost is an API-PRICE EQUIVALENT, not a bill: on a Claude subscription you pay a flat fee.
//
// Usage:
//   node yaris/araclar/cc-olcum.cjs --root C:\yaris K1-O-HF K1-O-CC ...
// Options:
//   --root <dir>        parent folder of the run roots (run root = <root>/<code>)          [required unless --project-dir]
//   --project-dir <d>   use this Claude Code project folder directly (one code only)
//   --projects <dir>    Claude Code projects folder (default: ~/.claude/projects)
//   --since <ISO time>  ignore sessions that started before this time (when a root has several sessions)
//   --session <id>      pick one session id (file name without .jsonl)
//   --prices <file>     JSON {"<model id>": {giris, cikis, cache_yazma_5dk, cache_yazma_1sa, cache_okuma}} in USD per million tokens
//   --out <file>        merge results into this JSON file as runs[<code>].ilk (created if missing); otherwise print JSON
const fs = require('fs'), path = require('path'), os = require('os');

const argv = process.argv.slice(2);
const opts = {}, codes = [];
for (let i = 0; i < argv.length; i++) { if (argv[i].startsWith('--')) opts[argv[i].slice(2)] = argv[++i]; else codes.push(argv[i]); }
if (!codes.length || (!opts.root && !opts['project-dir'])) {
  console.error('usage: node cc-olcum.cjs --root <runs parent dir> <code> [<code> ...]   (see header for options)'); process.exit(1);
}
const PROJ = opts.projects || path.join(os.homedir(), '.claude', 'projects');
// Public API prices (USD / million tokens) checked 2026-11-23 on the Claude pricing page. Prices change: verify, or pass --prices.
let PRICE = {
  'claude-opus-5-5': { giris: 4, cikis: 20, cache_yazma_5dk: 5, cache_yazma_1sa: 8, cache_okuma: 0.2 },
  'claude-fable-5-2': { giris: 8, cikis: 40, cache_yazma_5dk: 10, cache_yazma_1sa: 16, cache_okuma: 0.2 },
  'claude-fable-5-1': { giris: 10, cikis: 50, cache_yazma_5dk: 12.5, cache_yazma_1sa: 20, cache_okuma: 0.25 },
};
if (opts.prices) PRICE = { ...PRICE, ...JSON.parse(fs.readFileSync(opts.prices, 'utf8')) };
const SINCE = opts.since ? Date.parse(opts.since) : -Infinity;

// local ISO time with the machine's own UTC offset
function local(ms) {
  const off = -new Date(ms).getTimezoneOffset(), sign = off >= 0 ? '+' : '-', a = Math.abs(off);
  return new Date(ms + off * 60e3).toISOString().replace(/\.\d+Z$/, '') + sign + String(Math.floor(a / 60)).padStart(2, '0') + ':' + String(a % 60).padStart(2, '0');
}
function lines(f) { return fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean); }
// Claude Code names a project folder after its working directory with every non-alphanumeric character replaced by '-'
const sanitize = p => p.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
function projectDir(code) {
  if (opts['project-dir']) return opts['project-dir'];
  const want = sanitize(path.join(opts.root, code));
  const hit = fs.readdirSync(PROJ).find(d => d.toLowerCase() === want);
  if (!hit) throw new Error(`no Claude Code project folder for ${path.join(opts.root, code)} in ${PROJ} (looked for ${want})`);
  return path.join(PROJ, hit);
}

const results = {};
for (const code of codes) {
  let dir;
  try { dir = projectDir(code); } catch (e) { console.error(code + ': ' + e.message); continue; }
  let mains = fs.readdirSync(dir).filter(f => f.endsWith('.jsonl')).map(f => ({ id: f.slice(0, -6), L: lines(path.join(dir, f)) }))
    .filter(s => { const t = s.L.find(x => x.timestamp); return t && Date.parse(t.timestamp) >= SINCE; });
  if (opts.session) mains = mains.filter(s => s.id === opts.session);
  if (mains.length !== 1) { console.error(`${code}: ${mains.length} matching sessions in ${dir}; pass --since or --session`); continue; }
  const s = mains[0];
  let all = [...s.L], nsub = 0;
  const sub = path.join(dir, s.id, 'subagents');
  if (fs.existsSync(sub)) for (const f of fs.readdirSync(sub).filter(f => f.endsWith('.jsonl'))) { all = all.concat(lines(path.join(sub, f))); nsub++; }
  const msgs = {}, tools = new Set(); let model = null;
  for (const x of all) {
    if (x.type !== 'assistant' || !x.message) continue;
    const id = x.message.id || x.uuid, u = x.message.usage || {};
    if (!model && x.message.model && !x.isSidechain) model = x.message.model;
    const m = msgs[id] || (msgs[id] = { input: 0, output: 0, cw: 0, cr: 0, c5: 0, c1: 0 });
    m.input = Math.max(m.input, u.input_tokens || 0); m.output = Math.max(m.output, u.output_tokens || 0);
    m.cw = Math.max(m.cw, u.cache_creation_input_tokens || 0); m.cr = Math.max(m.cr, u.cache_read_input_tokens || 0);
    m.c5 = Math.max(m.c5, u.cache_creation?.ephemeral_5m_input_tokens || 0); m.c1 = Math.max(m.c1, u.cache_creation?.ephemeral_1h_input_tokens || 0);
    for (const c of x.message.content || []) if (c.type === 'tool_use') tools.add(c.id);
  }
  const ts = s.L.filter(x => x.timestamp).map(x => Date.parse(x.timestamp));
  const asst = s.L.filter(x => x.type === 'assistant' && x.timestamp).map(x => Date.parse(x.timestamp));
  const start = Math.min(...ts), end = Math.max(...asst);
  const t = Object.values(msgs).reduce((a, m) => { for (const k in m) a[k] = (a[k] || 0) + m[k]; return a; }, {});
  const p = PRICE[model];
  const c5 = t.c5 || 0, c1 = t.c1 || 0, cwRest = Math.max(0, (t.cw || 0) - c5 - c1);
  const cost = p ? (t.input * p.giris + t.output * p.cikis + c5 * p.cache_yazma_5dk + (c1 + cwRest) * p.cache_yazma_1sa + t.cr * p.cache_okuma) / 1e6 : null;
  const r = {
    baslangic: local(start), bitis: local(end), dakika: +((end - start) / 60e3).toFixed(2),
    asistan_tur: Object.keys(msgs).length, arac_cagri: tools.size, alt_ajan_dosyasi: nsub,
    token: { input: t.input, output: t.output, cache_olusturma: t.cw, cache_okuma: t.cr },
    token_toplam: t.input + t.output + t.cw + t.cr, model_id: model, fiyat_kullanilan_usd_mtok: p || null,
    cache_yazma_ayrinti: { ephemeral_5m: c5, ephemeral_1h: c1 }, cost_usd: cost == null ? null : +cost.toFixed(2),
  };
  if (!p) r.not = `no price for model ${model}; pass --prices`;
  results[code] = r;
  console.error(`${code} ${model} ${r.dakika} min, ${r.token_toplam} tokens, ${r.arac_cagri} tool calls, $${r.cost_usd} (API-price equivalent), subagent files ${nsub}`);
}

if (opts.out) {
  const o = fs.existsSync(opts.out) ? JSON.parse(fs.readFileSync(opts.out, 'utf8')) : { runs: {} };
  o.runs = o.runs || {};
  for (const [code, r] of Object.entries(results)) o.runs[code] = Object.assign(o.runs[code] || {}, { ilk: r });
  fs.writeFileSync(opts.out, JSON.stringify(o, null, 1));
  console.error('wrote ' + opts.out);
} else {
  console.log(JSON.stringify(results, null, 1));
}
