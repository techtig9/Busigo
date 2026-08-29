import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const errors = [];
const warnings = [];

const mustExist = [
  'package.json', '.env.example', 'middleware.ts', 'README.md',
  'app/(dashboard)/dashboard/page.tsx',
  'app/(dashboard)/business-brain/page.tsx',
  'app/(dashboard)/connect/page.tsx',
  'app/(dashboard)/automation-center/page.tsx',
  'app/(dashboard)/workforce/page.tsx',
  'app/(dashboard)/agent-orchestration/page.tsx',
  'app/(dashboard)/business-intelligence/page.tsx',
  'app/(dashboard)/growth-engine/page.tsx',
  'app/(dashboard)/security-governance/page.tsx',
  'app/(dashboard)/scale-reliability/page.tsx',
  'app/(dashboard)/marketplace/page.tsx',
  'app/(dashboard)/billing/page.tsx',
  'supabase/migrations/20260817090000_business_os.sql',
  'supabase/migrations/20260817091300_phase15_monetization_marketplace.sql',
];
for (const f of mustExist) if (!fs.existsSync(path.join(root, f))) errors.push(`Missing required file: ${f}`);

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
for (const s of ['qa','qa:phase9','build','typecheck','test']) if (!pkg.scripts?.[s]) errors.push(`Missing npm script: ${s}`);

const migrationsDir = path.join(root, 'supabase/migrations');
const migrations = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
if (migrations.length < 14) errors.push(`Expected at least 14 migrations, found ${migrations.length}`);
const policyKeys = new Set();
for (const file of migrations) {
  const text = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
  const opens = (text.match(/\(/g) || []).length;
  const closes = (text.match(/\)/g) || []).length;
  if (opens !== closes) errors.push(`Unbalanced SQL parentheses: ${file}`);
  const re = /create policy\s+"([^"]+)"\s+on\s+([a-zA-Z0-9_]+)/gi;
  let m;
  while ((m = re.exec(text))) {
    const key = `${m[2]}.${m[1]}`;
    if (policyKeys.has(key)) errors.push(`Duplicate RLS policy: ${key}`);
    policyKeys.add(key);
  }
}

// Required environment variables must be documented, but must never contain values in this template.
const env = fs.readFileSync(path.join(root, '.env.example'), 'utf8').split(/\r?\n/);
for (const line of env) {
  if (!line || line.trim().startsWith('#')) continue;
  const i = line.indexOf('=');
  if (i < 1) errors.push(`Malformed .env.example line: ${line}`);
  else if (line.slice(i + 1).trim() !== '' && !line.startsWith('NEXT_PUBLIC_APP_NAME=') && !line.startsWith('GROQ_MODEL=') && !line.startsWith('GROQ_API_URL=') && !line.startsWith('CEREBRAS_MODEL=') && !line.startsWith('CEREBRAS_API_URL=') && !line.startsWith('OPENROUTER_MODEL=') && !line.startsWith('OPENROUTER_API_URL=') && !line.startsWith('ANTHROPIC_MODEL=') && !line.startsWith('ANTHROPIC_API_URL=')) errors.push(`Secret/value present in .env.example: ${line.slice(0, i + 1)}`);
}

// Lightweight secret scan over tracked source/config files.
const exts = new Set(['.ts','.tsx','.js','.mjs','.sql','.json','.md']);
const secretPatterns = [
  /sk-[A-Za-z0-9]{20,}/,
  /-----BEGIN (?:RSA|EC|OPENSSH|PRIVATE) KEY-----/,
  /xox[baprs]-[A-Za-z0-9-]{20,}/,
];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, {withFileTypes:true})) {
    if (['node_modules','.next','.git'].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (exts.has(path.extname(entry.name))) {
      const text = fs.readFileSync(full, 'utf8');
      for (const p of secretPatterns) if (p.test(text)) errors.push(`Possible credential in source: ${path.relative(root, full)}`);
    }
  }
}
walk(root);

const routes = fs.readdirSync(path.join(root,'app/(dashboard)'), {withFileTypes:true})
  .filter(e => e.isDirectory())
  .map(e => e.name)
  .filter(n => fs.existsSync(path.join(root,'app/(dashboard)',n,'page.tsx')));
if (routes.length < 20) warnings.push(`Dashboard route count is ${routes.length}; review manually before launch.`);

if (errors.length) {
  console.error('FINAL PRODUCTION QA: FAIL');
  errors.forEach(e => console.error(`- ${e}`));
  process.exit(1);
}
console.log(`FINAL PRODUCTION QA: PASS (${migrations.length} migrations, ${policyKeys.size} unique policies, ${routes.length} dashboard routes)`);
if (warnings.length) warnings.forEach(w => console.log(`WARN: ${w}`));
