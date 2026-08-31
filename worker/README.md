# Becoming mind worker

This Cloudflare Worker keeps the DeepSeek credential outside the public GitHub Pages bundle.

## Validate locally

From the repository root:

```bash
npm run test:worker
```

The test covers health checks, exact origin and route enforcement, request and provider size limits, Cloudflare rate bindings, daily quota, Turnstile validation, language boundaries, role-lock behaviour, poisoned-history redaction, and output validation without calling the live provider.

## Deploy

1. Sign in to Cloudflare with Wrangler.
2. Store `DEEPSEEK_API_KEY` and `TURNSTILE_SECRET_KEY` as encrypted Worker secrets.
3. Create a Turnstile widget restricted to the production hostname and set the public site key as the GitHub Actions repository variable `TURNSTILE_SITE_KEY`.
4. Run `npx wrangler deploy`. Wrangler provisions the native burst/minute limits and the Durable Object daily quota from `wrangler.toml`.
5. Set `BECOMING_API_URL` to the resulting `https://...workers.dev` URL.

Never add the DeepSeek or Turnstile secret key to a `.env` file used by Vite or to any `VITE_*` variable. Only the Turnstile site key is public.
