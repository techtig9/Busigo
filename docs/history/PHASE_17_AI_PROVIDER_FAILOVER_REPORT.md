# Phase 17 — AI Provider Failover

## Implemented

BusiGo now uses the requested provider order:

**Groq → Cerebras → OpenRouter → Anthropic Claude**

Groq is the primary provider. Cerebras, OpenRouter, and Anthropic are optional. If a provider is not configured, it is skipped. If the current provider returns a recognized quota/rate-limit condition (including HTTP 402/429), BusiGo automatically tries the next configured provider.

Authentication/configuration errors and malformed requests do not silently fail over; this avoids masking configuration bugs and avoids unintended duplicate operations.

## Security

- API keys are server-side environment variables.
- No API key is returned by the provider-status endpoint.
- Provider usage is recorded using provider/model metadata rather than secrets.
- Claude remains optional and does not need to be purchased/configured to run the primary path.

## New configuration

See `.env.example` and `AI_PROVIDER_FAILOVER.md`.

## Verification

- AI failover contract smoke test: PASS
- Core QA: PASS
- Final production QA: PASS
- JavaScript syntax check for smoke test: PASS
- ZIP integrity: verified after packaging

A live provider-chain test was not claimed because real API keys were not supplied. The application is therefore ready for real credentials, but live provider availability and quota behavior must still be tested in staging with actual accounts.
