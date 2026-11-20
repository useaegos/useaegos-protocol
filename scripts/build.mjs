// Static build: src/ -> dist/ (override with AEGOS_OUT). No dependencies.
// AEGOS_CA=<address> writes a *stated* CA record into the output (used for the stated-branch proof only).
import { cpSync, rmSync, mkdirSync, readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(root, process.env.AEGOS_OUT || 'dist');
if (!out.startsWith(root)) throw new Error('refusing to write outside the project folder');

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
cpSync(join(root, 'src'), out, { recursive: true });

// Logo: brand/ original is copied explicitly, so the built site never depends on src/ derivatives alone.
const brandLogo = join(root, 'brand', 'LOGO AEGOS PNG...png');
if (!existsSync(brandLogo)) throw new Error('missing brand logo: ' + brandLogo);
mkdirSync(join(out, 'assets'), { recursive: true });
cpSync(brandLogo, join(out, 'assets', 'aegos-logo.png'));

if (process.env.AEGOS_CA) {
  const f = join(out, 'js', 'register.js');
  const src = readFileSync(f, 'utf8');
  const next = src.replace(/ca: \{ state: 'absent', value: null \}/, `ca: { state: 'stated', value: '${process.env.AEGOS_CA}' }`);
  if (next === src) throw new Error('ca record anchor not found');
  writeFileSync(f, next);
}

// Post-conditions: logo present and referenced with a correct relative path.
const html = readFileSync(join(out, 'index.html'), 'utf8');
for (const ref of ['./assets/aegos-lockup.png', './assets/aegos-mark.png', './assets/favicon.svg']) {
  if (!html.includes(ref)) throw new Error('index.html does not reference ' + ref);
  if (!existsSync(join(out, ref))) throw new Error('missing in output: ' + ref);
}
if (statSync(join(out, 'assets', 'aegos-logo.png')).size < 1000) throw new Error('logo copy looks empty');
console.log('built ->', out.replace(root, '.'), process.env.AEGOS_CA ? '(CA stated)' : '(CA absent)');
