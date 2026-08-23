# Becoming mind worker

This Cloudflare Worker keeps the DeepSeek credential outside the public GitHub Pages bundle.

## Validate locally

From the repository root:

```bash
npm run test:worker
```

The test covers health checks, origin enforcement, payload validation, language boundaries, role-lock behaviour, poisoned-history redaction, and output validation without calling the live provider.

## Deploy

1. Sign in to Cloudflare with Wrangler.
2. From this directory, run `npx wrangler secret put DEEPSEEK_API_KEY` and enter the key securely.
3. Run `npx wrangler deploy`.
4. Set the GitHub Actions repository variable `BECOMING_API_URL` to the resulting `https://...workers.dev` URL.

Never add the DeepSeek key to a `.env` file used by Vite or to any `VITE_*` variable.
