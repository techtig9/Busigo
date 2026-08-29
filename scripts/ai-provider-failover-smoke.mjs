// Static/contract smoke test for the BusiGo AI failover layer.
import fs from 'node:fs';
import assert from 'node:assert/strict';

const provider = fs.readFileSync('lib/ai/provider.ts', 'utf8');
const env = fs.readFileSync('.env.example', 'utf8');
const route = fs.readFileSync('app/api/ai/plan/route.ts', 'utf8');

for (const key of ['GROQ_API_KEY', 'CEREBRAS_API_KEY', 'OPENROUTER_API_KEY', 'ANTHROPIC_API_KEY']) {
  assert.match(env, new RegExp(`^${key}=`, 'm'), `${key} missing from .env.example`);
}
assert.match(provider, /PROVIDER_ORDER: AIProviderName\[\] = \["groq", "cerebras", "openrouter", "anthropic"\]/);
assert.match(provider, /\[402, 429\]/);
assert.match(provider, /quotaOrRateLimit/);
assert.match(provider, /callOpenAICompatible/);
assert.match(provider, /callAnthropic/);
assert.match(route, /ai\.provider/);
assert.match(route, /ai\.model/);

console.log('AI provider failover smoke test: PASS');
console.log('Order: Groq -> Cerebras -> OpenRouter -> Anthropic');
