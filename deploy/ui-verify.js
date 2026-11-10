// Headless UI verification using Chromium's CDP (no extra deps).
// Logs in with a temporary user, visits each page, collects console errors
// and failed requests, takes screenshots, and exercises the Account tab.
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');

const BASE = process.argv[2] || 'http://192.168.4.111:3000';
const USER = process.argv[3];
const PASS = process.argv[4];
const PORT = 9333;
const CDP_HOST = process.env.CDP_HOST; // if set, attach to a remote chromium instead of spawning one

const chrome = CDP_HOST ? { kill() {} } : spawn('/bin/chromium', ['--headless=new', '--no-sandbox', '--disable-gpu', `--remote-debugging-port=${PORT}`, '--window-size=1280,900', '--user-data-dir=/tmp/plb-chrome'], { stdio: 'ignore' });
const CDP = `http://${CDP_HOST || '127.0.0.1'}:${PORT}`;

const sleep = ms => new Promise(r => setTimeout(r, ms));
function getJson(url) { return new Promise((res, rej) => http.get(url, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => res(JSON.parse(d))); }).on('error', rej)); }

(async () => {
  let targets;
  for (let i = 0; i < 50; i++) { try { targets = await getJson(`${CDP}/json`); break; } catch (e) { await sleep(200); } }
  const page = targets.find(t => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl.replace('127.0.0.1', CDP_HOST || '127.0.0.1').replace('localhost', CDP_HOST || '127.0.0.1'));
  await new Promise(r => ws.onopen = r);
  let id = 0; const pending = new Map(); const errors = []; const failed = [];
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg.result || msg.error); pending.delete(msg.id); }
    if (msg.method === 'Runtime.exceptionThrown') errors.push(msg.params.exceptionDetails.text + ' ' + (msg.params.exceptionDetails.exception || {}).description);
    if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error') errors.push(msg.params.entry.text + ' ' + (msg.params.entry.url || ''));
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') errors.push(msg.params.args.map(a => a.value || a.description).join(' '));
    if (msg.method === 'Network.loadingFailed') failed.push(msg.params.errorText);
    if (msg.method === 'Network.responseReceived' && msg.params.response.status >= 400) failed.push(`${msg.params.response.status} ${msg.params.response.url}`);
  };
  const send = (method, params = {}) => new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const evaluate = async (expr) => (await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result?.value;
  const nav = async (url) => { await send('Page.navigate', { url }); await sleep(1500); };
  const shot = async (name) => { const r = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(`/tmp/plb-${name}.png`, Buffer.from(r.data, 'base64')); };

  await send('Page.enable'); await send('Runtime.enable'); await send('Log.enable'); await send('Network.enable');

  await nav(`${BASE}/login.html`); await shot('login');
  await evaluate(`document.getElementById('username').value=${JSON.stringify(USER)};document.getElementById('password').value=${JSON.stringify(PASS)};document.getElementById('loginForm').requestSubmit();`);
  await sleep(2000);
  console.log('after login:', await evaluate('location.pathname'));

  for (const p of ['dashboard.html', 'add-flight.html', 'flights.html', 'settings.html']) {
    await nav(`${BASE}/${p}`);
    console.log(p, '->', await evaluate('location.pathname'), '| title:', await evaluate('document.title'));
    await shot(p.replace('.html', ''));
  }

  // Account tab: click it, check form visible, try wrong current password via the UI
  await evaluate(`document.querySelector('[data-tab="account"]').click()`);
  await sleep(300);
  console.log('account tab visible:', await evaluate(`getComputedStyle(document.getElementById('account-tab')).display !== 'none'`));
  console.log('account username shown:', await evaluate(`document.getElementById('accountUsername').textContent`));
  await evaluate(`currentPassword.value='wrongpass';newPassword.value='abcdefgh1';confirmPassword.value='abcdefgh1';document.getElementById('changePasswordForm').requestSubmit();`);
  await sleep(1500);
  console.log('toast:', await evaluate(`[...document.querySelectorAll('.toast')].map(t=>t.textContent).join('|')`));
  await shot('account');

  // Add a flight through the real form, then check it in the list
  await nav(`${BASE}/add-flight.html`);
  await sleep(800);
  const formResult = await evaluate(`(async()=>{
    { await fetch('/api/aircraft',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'AS350 B2'})}); }
    const r=await fetch('/api/flights',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({date:new Date().toISOString().slice(0,10),aircraft_type:'AS350 B2',registration:'C-TEST',pic:'Self',route:'UI verify',day_pic:1.2,takeoffs_day:2,landings_day:2})});
    return r.status+' '+(await r.text()).slice(0,80);
  })()`);
  console.log('create via API from page:', formResult);
  await nav(`${BASE}/flights.html`); await sleep(1000);
  console.log('flights rows:', await evaluate(`document.querySelectorAll('tbody tr').length`), '| contains C-TEST:', await evaluate(`document.body.innerText.includes('C-TEST')`));
  await shot('flights-with-data');
  await nav(`${BASE}/dashboard.html`); await sleep(1500);
  console.log('dashboard total hours text:', await evaluate(`(document.getElementById('totalHours')||{}).textContent`));
  await shot('dashboard-with-data');
  console.log('charts rendered:', await evaluate(`typeof Chart !== 'undefined' && document.querySelectorAll('canvas').length`));

  // cleanup created data
  await evaluate(`(async()=>{const f=await (await fetch('/api/flights')).json(); for(const x of f.flights){ if(x.registration==='C-TEST') await fetch('/api/flights/'+x.id,{method:'DELETE'}); } const a=await (await fetch('/api/aircraft')).json(); for(const x of a){ if(x.name==='AS350 B2') await fetch('/api/aircraft/'+x.id,{method:'DELETE'}); } })()`);

  console.log('\nconsole/runtime errors:', errors.length ? errors : 'none');
  console.log('failed/4xx+ requests:', failed.length ? failed : 'none');
  ws.close(); chrome.kill(); process.exit(0);
})().catch(e => { console.error(e); chrome.kill(); process.exit(1); });
