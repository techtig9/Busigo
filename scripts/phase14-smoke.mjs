import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const required = [
  'supabase/migrations/20260817091200_phase14_scale_reliability.sql',
  'lib/platform/reliability.ts',
  'app/api/platform/health/route.ts',
  'app/api/platform/metrics/route.ts',
  'app/(dashboard)/scale-reliability/page.tsx'
];
const missing = required.filter(f => !fs.existsSync(path.join(root, f)));
const sql = fs.readFileSync(path.join(root, required[0]), 'utf8');
const tables = ['system_jobs','idempotency_keys','rate_limit_buckets','service_health_checks','dead_letter_jobs','platform_metrics'];
const absent = tables.filter(t => !sql.includes(`table if not exists public.${t}`));
if (missing.length || absent.length || !fs.readFileSync(path.join(root,'components/dashboard/Sidebar.tsx'),'utf8').includes('/scale-reliability')) {
  console.error('Phase 14 smoke: FAIL');
  if (missing.length) console.error('Missing:', missing);
  if (absent.length) console.error('Missing tables:', absent);
  process.exit(1);
}
console.log('Phase 14 smoke: PASS (6 reliability tables, health/metrics APIs, dashboard route, navigation)');
