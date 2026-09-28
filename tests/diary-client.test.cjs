const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../static/js/diary-client.js'), 'utf8');

function environment(response) {
  const calls = [], redirects = [];
  const errorNode = { dataset: { trackError: 'title' }, hidden: true, textContent: '' };
  const root = { querySelectorAll: () => [errorNode], querySelector: () => errorNode };
  const context = { window: {}, document: { addEventListener() {} }, console,
    location: { assign(url) { redirects.push(url); } },
    fetch: async (url, options) => {
      calls.push({ url, options });
      return calls.length === 1
        ? { ok: true, json: async () => ({ csrf_token: 'fresh-token' }) }
        : response;
    } };
  vm.runInNewContext(source, context);
  return { api: context.window.SonaryDiary, calls, redirects, root, errorNode };
}

test('diary submission refreshes CSRF in both multipart body and header before PRG', async () => {
  const app = environment({ ok: true, redirected: true, url: 'http://localhost/track/7' });
  const body = new FormData(); body.set('csrf_token', 'stale-token'); body.set('title', 'My track');
  assert.equal(await app.api.send('/tracks', body, app.root), true);
  assert.equal(app.calls[0].url, '/auth/csrf');
  assert.equal(app.calls[1].options.method, 'POST');
  assert.equal(app.calls[1].options.headers['X-CSRFToken'], 'fresh-token');
  assert.equal(body.get('csrf_token'), 'fresh-token');
  assert.equal(body.get('title'), 'My track');
  assert.deepEqual(app.redirects, ['http://localhost/track/7']);
});

test('diary validation stays on the form and exposes the matching inline error', async () => {
  const app = environment({ ok: false, json: async () => ({ errors: { title: 'Enter a track title.' } }) });
  assert.equal(await app.api.send('/tracks', new FormData(), app.root), false);
  assert.equal(app.errorNode.hidden, false);
  assert.equal(app.errorNode.textContent, 'Enter a track title.');
  assert.deepEqual(app.redirects, []);
});
