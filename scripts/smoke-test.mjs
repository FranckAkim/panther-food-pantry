// Run against a built container: PANTRY_SMOKE_URL defaults to localhost:8000.
// Only reads scaffold endpoints and static files; never changes pantry records.
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';

const base = new URL(process.env.PANTRY_SMOKE_URL || 'http://127.0.0.1:8000');
async function get(path) {
  // Keep a referenced timer while connecting during container startup.
  // AbortSignal.timeout uses an unref'ed timer; Node can otherwise exit with an
  // unsettled top-level await before the health retry loop gets a response.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);
  try {
    return await fetch(new URL(path, base), { signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

let started = false;
for (let attempt = 0; attempt < 20; attempt += 1) {
  try {
    const response = await get('/api/health');
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: 'ok' });
    started = true;
    break;
  } catch (error) {
    if (attempt === 19) throw error;
    await delay(1000);
  }
}
assert.ok(started);
console.log('PASS process health');

const home = await get('/');
assert.equal(home.status, 200);
assert.match(home.headers.get('content-type') || '', /text\/html/);
const html = await home.text();
assert.match(html, /id="root"/);
const assets = [...new Set([...html.matchAll(/(?:src|href)="(\/assets\/[^"?#]+)"/g)]
  .map(match => match[1]))];
assert.ok(assets.some(path => path.endsWith('.js')), 'Missing built JavaScript');
assert.ok(assets.some(path => path.endsWith('.css')), 'Missing built stylesheet');
for (const asset of assets) {
  const response = await get(asset);
  assert.equal(response.status, 200, asset);
  assert.doesNotMatch(response.headers.get('content-type') || '', /text\/html/, asset);
  assert.ok((await response.arrayBuffer()).byteLength > 0, asset);
}
console.log(`PASS React document and ${assets.length} referenced assets`);

const logo = await get('/assets/figma/126fe.svg');
assert.equal(logo.status, 200);
assert.match(await logo.text(), /<svg/);
console.log('PASS public image asset');

const schema = await get('/api/openapi.json');
assert.equal(schema.status, 200);
const spec = await schema.json();
assert.ok(spec.paths['/api/health']);
assert.ok(spec.paths['/api/health/db']);
const docs = await get('/api/docs');
assert.equal(docs.status, 200);
assert.match(await docs.text(), /swagger-ui/);
console.log('PASS OpenAPI and docs');

const missingApi = await get('/api/does-not-exist');
assert.equal(missingApi.status, 404);
assert.match(missingApi.headers.get('content-type') || '', /application\/json/);
const missingAsset = await get('/assets/does-not-exist.js');
assert.equal(missingAsset.status, 404);
console.log('PASS missing API and asset return 404');
