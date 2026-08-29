import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createHmac, randomBytes, timingSafeEqual, createCipheriv, createDecipheriv, createHash } from 'node:crypto';
const root = new URL('..', import.meta.url).pathname;
const required = [
  'lib/integrations/oauth.ts','lib/integrations/secret-vault.ts','lib/integrations/real-adapters.ts',
  'app/api/integrations/oauth/authorize/route.ts','app/api/integrations/oauth/callback/route.ts','app/api/integrations/execute/route.ts',
  'supabase/migrations/20260817090700_phase9_real_connectors.sql'
];
for (const f of required) if (!readFileSync(join(root,f),'utf8').trim()) throw new Error(`Missing/empty ${f}`);
const secret='test-secret'; const payload=Buffer.from(JSON.stringify({iat:Date.now()})).toString('base64url'); const sig=createHmac('sha256',secret).update(payload).digest('base64url'); const expected=createHmac('sha256',secret).update(payload).digest('base64url'); if(!timingSafeEqual(Buffer.from(sig),Buffer.from(expected))) throw new Error('HMAC test failed');
const key=createHash('sha256').update('phase9-test-key').digest(); const iv=randomBytes(12); const c=createCipheriv('aes-256-gcm',key,iv); const enc=Buffer.concat([c.update('BusiGo secret','utf8'),c.final()]); const tag=c.getAuthTag(); const d=createDecipheriv('aes-256-gcm',key,iv); d.setAuthTag(tag); if(Buffer.concat([d.update(enc),d.final()]).toString()!=='BusiGo secret') throw new Error('Vault round-trip failed');
const sql=readFileSync(join(root,'supabase/migrations/20260817090700_phase9_real_connectors.sql'),'utf8'); for(const token of ['encrypted_access_token','encrypted_refresh_token','token_expires_at','connections_user_service_unique']) if(!sql.includes(token)) throw new Error(`Migration missing ${token}`);
console.log('Phase 9 smoke tests: PASS');
