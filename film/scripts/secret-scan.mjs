// Scan the folders that go public for the Cesium ion token and for tile URLs with session keys.
// Prints only file paths, line numbers, parameter names and counts; never a secret value.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.argv[2];
const targets = ['page', 'scripts', 'data', 'models', 'qa', 'notes.md'];
const token = fs.readFileSync(path.join(ROOT, 'cesium-token.txt'), 'utf8').trim();
const tokenParts = token.split('.').filter((p) => p.length >= 16);   // JWT header/payload/signature pieces too

const files = [];
const walk = (p) => {
  if (!fs.existsSync(p)) { console.log('MISSING', path.relative(ROOT, p)); return; }
  const st = fs.statSync(p);
  if (st.isDirectory()) for (const f of fs.readdirSync(p)) walk(path.join(p, f));
  else files.push(p);
};
for (const t of targets) walk(path.join(ROOT, t));

// query parameters that carry credentials in Google / Cesium tile URLs
const paramRe = /[?&](key|session|access_token|token|sig|signature)=([^&\s"'<>]{6,})/gi;
const bearerRe = /Bearer\s+[A-Za-z0-9._-]{20,}/g;
const jwtRe = /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g;
const googleKeyRe = /AIza[0-9A-Za-z_-]{30,}/g;

let hits = 0, bytes = 0;
for (const f of files) {
  const buf = fs.readFileSync(f); bytes += buf.length;
  const s = buf.toString('latin1');
  const rel = path.relative(ROOT, f);
  if (s.includes(token)) { hits++; console.log('TOKEN', rel); }
  tokenParts.forEach((p, i) => { if (s.includes(p)) { hits++; console.log('TOKEN-PART', i, rel); } });
  const lines = s.split('\n');
  lines.forEach((ln, i) => {
    for (const m of ln.matchAll(paramRe)) {
      const v = m[2];
      const placeholder = /^(\$\{|REDACTED|\*+|<|xxx|\.\.\.)/i.test(v) || /^[A-Za-z_]+\)?$/.test(v) && v.length < 12;
      if (!placeholder) { hits++; console.log('PARAM', `${rel}:${i + 1}`, m[1], `(value length ${v.length})`); }
    }
    for (const re of [bearerRe, jwtRe, googleKeyRe]) for (const _ of ln.matchAll(re)) { hits++; console.log('PATTERN', `${rel}:${i + 1}`, re.source.slice(0, 12)); }
  });
}
console.log(`scanned ${files.length} files, ${(bytes / 1e6).toFixed(1)} MB; hits ${hits}`);
