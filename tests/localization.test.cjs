const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const staticPath = path.join(__dirname, '../static');

test('dynamic auth errors and split headings translate both ways without changing input values', async () => {
  const events = {};
  let observer;
  function element(tag, attrs = {}) {
    return { nodeType: 1, tagName: tag, childNodes: [], value: 'untouched-user-value',
      matches: () => false, closest: () => null,
      hasAttribute: name => name in attrs, getAttribute: name => attrs[name],
      setAttribute: (name, value) => { attrs[name] = value; } };
  }
  function text(parent, source) {
    const node = { nodeType: 3, parentElement: parent, nodeValue: source };
    parent.childNodes.push(node); return node;
  }
  const root = element('HTML'); root.lang = 'en';
  const heading = element('H1');
  const first = text(heading, 'Музыка, которая');
  const second = text(heading, 'звучит по-твоему');
  const error = element('SMALL');
  const errorText = text(error, 'Этот логин уже занят.');
  const textarea = element('TEXTAREA', { placeholder: 'От 10 до 150 слов' });
  const userText = text(textarea, 'Авторский текст');
  root.childNodes.push(heading, error, textarea);
  const context = {
    document: { documentElement: root, querySelector: () => null, addEventListener(name, fn) { events[name] = fn; } },
    window: {}, Node: { ELEMENT_NODE: 1, TEXT_NODE: 3 }, console,
    MutationObserver: class { constructor(fn) { observer = fn; } disconnect() {} observe() {} },
    fetch: async url => ({ ok: true, json: async () => JSON.parse(fs.readFileSync(path.join(staticPath, path.basename(url)), 'utf8')) })
  };
  vm.runInNewContext(fs.readFileSync(path.join(staticPath, 'js/localization.js'), 'utf8'), context);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(first.nodeValue, 'Music that');
  assert.equal(second.nodeValue, 'sounds like you');
  assert.equal(errorText.nodeValue, 'This username is taken.');
  assert.equal(textarea.getAttribute('placeholder'), '10 to 150 words');
  assert.equal(textarea.value, 'untouched-user-value');
  assert.equal(userText.nodeValue, 'Авторский текст');
  for (const [ru, en] of [
    ['Этот логин уже занят.', 'This username is taken.'],
    ['Эта почта уже занята.', 'This email is already in use.'],
    ['Аккаунт с таким логином или почтой не найден.', 'No account with that username or email was found.'],
    ['Неверный логин или пароль.', 'Incorrect username or password.']
  ]) {
    root.lang = 'en'; errorText.nodeValue = ru; observer();
    assert.equal(errorText.nodeValue, en);
    root.lang = 'ru'; events['sonary:language']();
    assert.equal(errorText.nodeValue, ru);
    root.lang = 'en'; events['sonary:language']();
    assert.equal(errorText.nodeValue, en);
  }
  root.lang = 'ru'; events['sonary:language']();
  assert.equal(first.nodeValue, 'Музыка, которая');
  assert.equal(textarea.getAttribute('placeholder'), 'От 10 до 150 слов');
  root.lang = 'en';
  assert.equal(context.window.SonaryI18n.translate('Перейти в приложение'), 'Open the app');
  assert.equal(context.window.SonaryI18n.translate('Выйти'), 'Sign out');
});
