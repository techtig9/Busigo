# BusiGo AI Provider Failover

BusiGo uses this strict priority order:

1. **Groq** — primary and the only provider that is required.
2. **Cerebras** — first optional fallback.
3. **OpenRouter** — second optional fallback.
4. **Anthropic Claude** — final optional fallback.

The app can run with only `GROQ_API_KEY`. If a provider is not configured, BusiGo skips it. Claude is completely optional for now.

## Failover rules

BusiGo moves to the next configured provider when the current provider reports quota/rate exhaustion, including HTTP 402/429 or recognized quota/rate-limit messages. It does **not** silently fail over authentication errors, invalid requests, malformed responses, or application bugs; those need to be fixed instead of being hidden.

## Configuration

```text
GROQ_API_KEY=
GROQ_MODEL=llama-3.3-70b-versatile
GROQ_API_URL=https://api.groq.com/openai/v1/chat/completions

CEREBRAS_API_KEY=
CEREBRAS_MODEL=llama-3.3-70b
CEREBRAS_API_URL=https://api.cerebras.ai/v1/chat/completions

OPENROUTER_API_KEY=
OPENROUTER_MODEL=meta-llama/llama-3.3-70b-instruct:free
OPENROUTER_API_URL=https://openrouter.ai/api/v1/chat/completions

ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=claude-3-5-sonnet-latest
ANTHROPIC_API_URL=https://api.anthropic.com/v1/messages
```

All API keys are server-side environment variables. They are never returned by the provider-status endpoint.
