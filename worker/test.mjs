import assert from 'node:assert/strict';
import worker from './src/index.js';

const origin = 'https://megabomb420.github.io';

async function request(path, init = {}, env = {}) {
  return worker.fetch(new Request(`https://mind.example${path}`, init), env);
}

let response = await request('/health');
assert.equal(response.status, 200);
assert.deepEqual(await response.json(), { ok: true, model: 'deepseek-v4-flash' });

response = await request('/chat', { method: 'POST', headers: { Origin: 'https://attacker.example' } });
assert.equal(response.status, 403);

response = await request('/chat', { method: 'OPTIONS', headers: { Origin: origin } });
assert.equal(response.status, 204);
assert.equal(response.headers.get('Access-Control-Allow-Origin'), origin);

response = await request('/chat', {
  method: 'POST',
  headers: { Origin: origin, 'Content-Type': 'application/json' },
  body: JSON.stringify({ messages: [] }),
});
assert.equal(response.status, 503);

response = await request('/chat', {
  method: 'POST',
  headers: { Origin: origin, 'Content-Type': 'application/json' },
  body: JSON.stringify({ messages: [] }),
}, { DEEPSEEK_API_KEY: 'test-only' });
assert.equal(response.status, 400);

console.log('Worker checks passed.');
