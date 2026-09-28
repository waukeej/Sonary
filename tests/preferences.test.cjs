const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../static/js/preferences.js'), 'utf8');

function environment(language, dark, storage = new Map(), blocked = false) {
  const events = {};
  const system = { matches: dark, addEventListener(_, fn) { this.change = fn; } };
  const controls = Object.fromEntries(['settingsLanguage', 'settingsTheme'].map(id => [id, {
    addEventListener(_, fn) { this.change = fn; }
  }]));
  const document = {
    documentElement: { dataset: {} },
    addEventListener(name, fn) { events[name] = fn; },
    dispatchEvent() {},
    getElementById(id) { return controls[id]; }
  };
  const context = { document, navigator: { languages: [language] }, window: {},
    CustomEvent: class { constructor(type) { this.type = type; } },
    matchMedia: () => system,
    localStorage: {
      getItem(key) { if (blocked) throw Error('blocked'); return storage.get(key); },
      setItem(key, value) { if (blocked) throw Error('blocked'); storage.set(key, value); }
    }
  };
  vm.runInNewContext(source, context);
  events.DOMContentLoaded();
  return { preferences: context.window.SonaryPreferences, document, system, controls };
}

test('browser language defaults and explicit preferences survive reload', () => {
  for (const [browser, expected] of [['ru-RU','ru'], ['ru-BY','ru'], ['en-GB','en'], ['de-DE','en']]) {
    const storage = new Map();
    const app = environment(browser, true, storage);
    assert.equal(app.preferences.language, expected);
    assert.equal(storage.has('sonary-language'), false);
    for (const chosen of ['ru','en']) {
      app.controls.settingsLanguage.value = chosen;
      app.controls.settingsLanguage.change();
      const reload = environment(browser, true, storage);
      assert.equal(reload.preferences.language, chosen);
      assert.equal(reload.document.documentElement.lang, chosen);
      assert.equal(reload.controls.settingsLanguage.value, chosen);
    }
  }
});

test('system theme follows OS; manual choices persist without following OS', () => {
  const storage = new Map();
  const app = environment('en-US', true, storage);
  assert.equal(app.preferences.theme, 'system');
  assert.equal(app.document.documentElement.dataset.theme, 'dark');
  app.system.matches = false; app.system.change();
  assert.equal(app.document.documentElement.dataset.theme, 'light');
  for (const choice of ['dark','light']) {
    app.controls.settingsTheme.value = choice; app.controls.settingsTheme.change();
    app.system.matches = choice === 'light'; app.system.change();
    assert.equal(app.document.documentElement.dataset.theme, choice);
    const reload = environment('en-US', choice === 'light', storage);
    assert.equal(reload.preferences.theme, choice);
    assert.equal(reload.document.documentElement.dataset.theme, choice);
  }
  app.preferences.setTheme('system');
  app.system.matches = true; app.system.change();
  assert.equal(app.document.documentElement.dataset.theme, 'dark');
  assert.equal(storage.get('sonary-theme'), 'system');
  assert.equal(environment('en', false, storage).document.documentElement.dataset.theme, 'light');
});

test('blocked or invalid storage still permits preferences in the current page', () => {
  const app = environment('ru', false, new Map(), true);
  app.preferences.setLanguage('en'); app.preferences.setTheme('dark');
  assert.equal(app.document.documentElement.lang, 'en');
  assert.equal(app.document.documentElement.dataset.theme, 'dark');
  const invalid = environment('de', false, new Map([['sonary-theme','bad'], ['sonary-language','bad']]));
  assert.equal(invalid.preferences.theme, 'system');
  assert.equal(invalid.preferences.language, 'en');
});
