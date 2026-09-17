/* eslint-disable @typescript-eslint/no-require-imports -- Browser integration fixture. */
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    let requests = 0;
    let response = { conversations: [{ id: 'a', messages: [{ text: 'Send your password immediately.' }] }] };
    await page.route('https://www.fiverr.com/**', route => {
      if (route.request().url().includes('/api/')) {
        requests++;
        return route.fulfill({ contentType: 'application/json', body: JSON.stringify(response) });
      }
      return route.fulfill({ contentType: 'text/html', body: '<nav>' + ['a', 'b', 'c', 'd', 'e'].map(id =>
        `<div data-testid="conversation-item" data-conversation-id="${id}"><span data-testid="username">Buyer ${id}</span></div>`).join('') + '</nav><main><header>Current chat</header></main>' });
    });
    await page.goto('https://www.fiverr.com/inbox/reading');
    await page.evaluate(() => {
      window.clicks = 0;
      window.sent = [];
      window.listeners = [];
      document.addEventListener('click', () => window.clicks++);
      window.chrome = {
        storage: { local: { get: async () => ({}) }, onChanged: { addListener: fn => window.listeners.push(fn) } },
        runtime: { onMessage: { addListener() {} }, sendMessage: async message => {
          window.sent.push(message); return { ok: true, scores: {} };
        } },
      };
      window.__INITIAL_STATE__ = { conversations: [
        { id: 'b', messages: [{ text: 'Thanks for the logo.' }] },
        { id: 'c', last_message: { text: 'Thanks for the logo.' } },
        { id: 'e', messages: [{ text: 'Thanks for the logo.' }] },
      ] };
    });
    const add = async name => page.addScriptTag({ path: path.resolve('extension/' + name + '.js') });
    for (const file of ['page-data', 'page-observer', 'conversation-data']) await add(file);
    await page.waitForTimeout(50);
    assert.deepEqual(await page.evaluate(async () => (await fetch('/api/inbox/conversations')).json()), response,
      'The page still receives the original response');
    for (const file of ['link-scanner', 'sensitive-information', 'analyzer', 'message-detector', 'message-extractor', 'conversation-detector', 'draft-guard']) await add(file);
    await page.evaluate(() => {
      const analyze = fsdAnalyze;
      window.analyses = 0;
      window.fsdAnalyze = (...args) => { window.analyses++; return analyze(...args); };
    });
    await add('content-script');
    const score = id => page.locator(`[data-conversation-id="${id}"] [data-fsd-flag]`).getAttribute('data-score');
    const waitScore = (id, expected) => page.waitForFunction(({ id, expected }) =>
      document.querySelector(`[data-conversation-id="${id}"] [data-fsd-flag]`)?.dataset.score === expected,
      { id, expected }, { timeout: 5000 });
    await waitScore('a', '100');
    await waitScore('b', '0');
    await waitScore('e', '0');
    assert.equal(await score('c'), 'null', 'Benign preview is insufficient for Safe');
    assert.equal(await score('d'), 'null', 'Missing data is not Safe');
    const calls = await page.evaluate(() => window.analyses);
    await page.evaluate(() => {
      const nav = document.querySelector('nav');
      for (const row of [...nav.children]) row.replaceWith(row.cloneNode(true));
    });
    await page.waitForTimeout(500);
    assert.equal(await page.evaluate(() => window.analyses), calls, 'Equivalent rerenders reuse per-ID content hashes');
    assert.equal(await score('b'), '0');
    await page.evaluate(() => {
      const row = document.createElement('div');
      row.dataset.testid = 'conversation-item';
      row.id = 'scrolled-row';
      row.textContent = 'A new buyer';
      row.__reactProps$fixture = { conversation: { id: 'f', messages: [{ text: 'Thanks for the logo.' }] } };
      document.querySelector('nav').append(row);
    });
    await page.waitForFunction(() => document.querySelector('#scrolled-row [data-fsd-flag]')?.dataset.score === '0');
    assert.equal(await page.evaluate(() => fsdConversationData.key(document.querySelector('#scrolled-row'))), 'id:f');
    const beforeRename = await page.evaluate(() => window.analyses);
    await page.locator('#scrolled-row').evaluate(row => { row.firstChild.data = 'Updated display name'; });
    await page.waitForTimeout(400);
    assert.equal(await page.locator('#scrolled-row [data-fsd-flag]').getAttribute('data-score'), '0');
    assert.equal(await page.evaluate(() => window.analyses), beforeRename, 'Display-name changes preserve ID association without reanalysis');
    response = { data: { conversations: { edges: [{ node: { id: 'b', messages: { nodes: [{ text: 'Send your password immediately.' }] } } }] } } };
    await page.evaluate(() => fetch('/api/graphql', { method: 'POST', body: '{}' }).then(result => result.json()));
    await waitScore('b', '100');
    response = { conversation_id: 'e', message_id: 'new-e', text: 'Send your password immediately.' };
    assert.deepEqual(await page.evaluate(() => new Promise(resolve => {
      const xhr = new XMLHttpRequest();
      xhr.open('GET', '/api/messages');
      xhr.onload = () => resolve(JSON.parse(xhr.responseText));
      xhr.send();
    })), response);
    await waitScore('e', '100');
    // State snapshot hydration, including a conversation previously lacking data.
    await page.evaluate(() => {
      const node = document.createElement('script');
      node.type = 'application/json';
      node.dataset.state = 'inbox';
      node.textContent = JSON.stringify({ conversations: [{ id: 'd', messages: [{ text: 'Thanks for the delivery.' }] }] });
      document.body.append(node);
    });
    await waitScore('d', '0');
    assert.equal(requests, 3, 'Observer never generates additional network requests');
    assert.equal(await page.evaluate(() => window.clicks), 0);
    assert.equal(new URL(page.url()).pathname, '/inbox/reading');
    assert.equal(await page.locator('main header').textContent(), 'Current chat');
    const payload = await page.evaluate(() => JSON.stringify(window.sent));
    assert.ok(!payload.includes('Thanks for the logo') && !payload.includes('password'), 'Background data text is never forwarded to storage/worker');
    const beforeStop = await page.evaluate(() => window.analyses);
    await page.evaluate(() => window.listeners.forEach(fn => fn({ fsd_enabled: { newValue: false } }, 'local')));
    response = { conversations: [{ id: 'd', messages: [{ text: 'Send your OTP.' }] }] };
    await page.evaluate(() => fetch('/api/messages').then(result => result.json()));
    await page.waitForTimeout(300);
    assert.equal(await page.evaluate(() => window.analyses), beforeStop, 'Disabled monitoring does not analyze responses');
    await page.locator('#scrolled-row').evaluate(row => {
      row.__reactProps$fixture.conversation.messages = [{ text: 'Send your password immediately.' }];
    });
    await page.evaluate(() => window.listeners.forEach(fn => fn({ fsd_enabled: { newValue: true } }, 'local')));
    await page.waitForFunction(() => document.querySelector('#scrolled-row [data-fsd-flag]')?.dataset.score === '100');
    console.log('PASS: unopened rows, early fetch, state, XHR, GraphQL, dynamic rows, rerenders, per-ID hashes, new messages, missing data, privacy, Stop, and no clicks/navigation/extra requests.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
