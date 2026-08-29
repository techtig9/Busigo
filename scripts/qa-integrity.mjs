import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const migrationsDir = path.join(root, 'supabase', 'migrations');
const migrations = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
const policies = new Map();
const requiredRoutes = [
  'business-brain', 'business-intelligence', 'connect', 'automation-center', 'workforce',
  'growth', 'insights', 'approvals', 'autonomous-ops'
];
const errors = [];

for (const file of migrations) {
  const text = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
  const re = /create policy\s+"([^"]+)"\s+on\s+([a-zA-Z0-9_]+)/gi;
  let m;
  while ((m = re.exec(text))) {
    const key = `${m[2]}.${m[1]}`;
    if (policies.has(key)) errors.push(`Duplicate policy: ${key}`);
    policies.set(key, file);
  }
  if ((text.match(/\(/g) || []).length !== (text.match(/\)/g) || []).length) {
    errors.push(`Unbalanced parentheses: ${file}`);
  }
}

for (const route of requiredRoutes) {
  const routePath = path.join(root, 'app', '(dashboard)', route, 'page.tsx');
  if (!fs.existsSync(routePath)) errors.push(`Missing route: ${route}`);
}

for (const dir of ['app', 'components', 'lib', 'supabase', 'test']) {
  if (!fs.existsSync(path.join(root, dir))) errors.push(`Missing project directory: ${dir}`);
}

if (errors.length) {
  console.error('QA integrity: FAIL');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`QA integrity: PASS (${migrations.length} migrations, ${policies.size} unique policies, ${requiredRoutes.length} core routes)`);
