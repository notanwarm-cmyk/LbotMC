'use strict';
/*
 * بوت ماينكرافت يدخل السيرفر تلقائياً ويبقى فيه، والصفحة تعرض حالته فقط.
 * ملف واحد فقط يكفي: الموقع مدمج بداخله.
 * Build Command:  npm install ws mineflayer
 * Start Command:  node server.js
 * يمكن تغيير الإعدادات من Render (Environment): MC_HOST و MC_PORT و BOT_NAME
 */
const http = require('http');
const dns = require('dns').promises;
const net = require('net');
const { WebSocketServer } = require('ws');
const mineflayer = require('mineflayer');

// ----- صفحة الموقع (مدمجة داخل الملف) -----
const PAGE = "<!DOCTYPE html>\n<html lang=\"ar\" dir=\"rtl\">\n<head>\n<meta charset=\"UTF-8\">\n<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n<title>بوت ماينكرافت</title>\n<link rel=\"preconnect\" href=\"https://fonts.googleapis.com\">\n<link rel=\"preconnect\" href=\"https://fonts.gstatic.com\" crossorigin>\n<link href=\"https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;600&family=Reem+Kufi:wght@600&display=swap\" rel=\"stylesheet\">\n<style>\n  :root { --dirt: #4a3322; --panel: #c6c6c6; --ink: #373737; --ok: #55ff55; --warn: #ffaa00; --err: #ff5555; color-scheme: light; }\n  * { box-sizing: border-box; }\n  html, body { margin: 0; min-height: 100%; }\n  body {\n    font-family: \"IBM Plex Sans Arabic\", system-ui, sans-serif;\n    color: var(--ink);\n    background-color: var(--dirt);\n    background-image:\n      linear-gradient(45deg, rgba(0,0,0,.16) 25%, transparent 25%, transparent 75%, rgba(0,0,0,.16) 75%),\n      linear-gradient(45deg, rgba(255,255,255,.04) 25%, transparent 25%, transparent 75%, rgba(255,255,255,.04) 75%);\n    background-size: 32px 32px;\n    background-position: 0 0, 16px 16px;\n    padding: max(20px, env(safe-area-inset-top)) 14px max(24px, env(safe-area-inset-bottom));\n    display: flex; justify-content: center;\n  }\n  main {\n    width: 100%; max-width: 560px; margin: auto 0;\n    background: var(--panel); padding: 22px 20px 20px;\n    box-shadow: inset 4px 4px 0 #fff, inset -4px -4px 0 #555, 0 0 0 4px #000, 0 10px 0 4px rgba(0,0,0,.35);\n  }\n  h1 {\n    font-family: \"Reem Kufi\", \"IBM Plex Sans Arabic\", sans-serif; font-weight: 600;\n    font-size: clamp(26px, 7vw, 36px); line-height: 1.2; margin: 0 0 6px; text-shadow: 2px 2px 0 #eee;\n  }\n  .lead { margin: 0 0 18px; font-size: 15px; line-height: 1.7; color: #4a4a4a; }\n  .info { display: grid; gap: 10px; margin: 0 0 6px; }\n  .row { display: flex; justify-content: space-between; align-items: center; gap: 12px; background: #1a1a1a; box-shadow: inset 0 0 0 2px #8b8b8b; padding: 12px; color: #fff; }\n  .row span:first-child { color: #aaa; font-size: 14px; }\n  .row b { direction: ltr; unicode-bidi: plaintext; font-size: 16px; font-weight: 600; word-break: break-all; }\n  .status { display: flex; align-items: center; gap: 10px; margin: 20px 0 8px; font-weight: 600; font-size: 16px; }\n  .pip { width: 14px; height: 14px; background: #777; box-shadow: 0 0 0 2px #000; flex: none; }\n  .pip.connecting { background: #e8b339; animation: blink 1s steps(2) infinite; }\n  .pip.online { background: #55c52e; }\n  @keyframes blink { 50% { opacity: .25; } }\n  @media (prefers-reduced-motion: reduce) { .pip.connecting { animation: none; } }\n  #console {\n    height: 200px; overflow-y: auto; background: #000; color: #ddd;\n    font: 13px/1.6 ui-monospace, Menlo, Consolas, monospace; padding: 10px 12px; box-shadow: 0 0 0 2px #8b8b8b;\n  }\n  #console div { unicode-bidi: plaintext; text-align: start; word-break: break-word; }\n  .l-ok { color: var(--ok); } .l-warn { color: var(--warn); } .l-err { color: var(--err); } .l-info { color: #aaa; }\n  .empty { color: #777; }\n  .foot { margin: 16px 0 0; font-size: 13px; line-height: 1.7; color: #555; }\n</style>\n</head>\n<body>\n<main>\n  <h1>بوت ماينكرافت</h1>\n  <p class=\"lead\">البوت يدخل السيرفر تلقائياً ويبقى فيه، وإذا انقطع يرجع بنفسه.</p>\n\n  <div class=\"info\">\n    <div class=\"row\"><span>السيرفر</span><b id=\"host\">...</b></div>\n    <div class=\"row\"><span>اسم البوت</span><b id=\"name\">...</b></div>\n  </div>\n\n  <div class=\"status\"><span id=\"pip\" class=\"pip\"></span><span id=\"statusText\">جارٍ الاتصال بالموقع...</span></div>\n  <div id=\"console\" aria-live=\"polite\"><div class=\"empty\">سجل الحالة سيظهر هنا.</div></div>\n  <p class=\"foot\">هذه الصفحة للمتابعة فقط، والبوت يعمل من الخادم حتى لو أغلقتها.</p>\n</main>\n\n<script>\n// اتركه فارغاً إذا كان server.js هو الذي يعرض هذه الصفحة. غيّره فقط لو رفعت الصفحة في مكان آخر.\nconst BACKEND_URL = '';\n\nconst $ = (id) => document.getElementById(id);\nconst labels = { offline: 'البوت غير متصل، جارٍ إعادة المحاولة...', connecting: 'جارٍ دخول البوت...', online: 'البوت داخل السيرفر' };\n\nfunction addLog(text, level) {\n  const con = $('console');\n  const first = con.firstElementChild;\n  if (first && first.classList.contains('empty')) con.innerHTML = '';\n  const d = document.createElement('div');\n  d.className = 'l-' + (level || 'info');\n  d.textContent = text;\n  con.appendChild(d);\n  while (con.children.length > 100) con.removeChild(con.firstChild);\n  con.scrollTop = con.scrollHeight;\n}\n\nfunction wsUrl() {\n  let u = BACKEND_URL.trim();\n  if (!u && /^https?:/.test(location.origin)) u = location.origin;\n  return u.replace(/^http/i, 'ws');\n}\n\nfunction connect() {\n  const url = wsUrl();\n  if (!url) { $('statusText').textContent = 'ضع عنوان الخادم في BACKEND_URL'; return; }\n  const ws = new WebSocket(url);\n  ws.onmessage = (e) => {\n    let m; try { m = JSON.parse(e.data); } catch (err) { return; }\n    if (m.type === 'status') {\n      $('host').textContent = m.host;\n      $('name').textContent = m.name;\n      $('pip').className = 'pip ' + (m.state === 'offline' ? '' : m.state);\n      $('statusText').textContent = labels[m.state] || m.state;\n    } else if (m.type === 'log') {\n      addLog(m.text, m.level);\n    }\n  };\n  ws.onclose = () => {\n    $('pip').className = 'pip';\n    $('statusText').textContent = 'جارٍ إعادة الاتصال بالموقع...';\n    setTimeout(connect, 3000);\n  };\n  ws.onerror = () => {};\n}\nconnect();\n</script>\n</body>\n</html>\n";

const WEB_PORT = Number(process.env.PORT || 3000);
const HOST = process.env.MC_HOST || 'lhubx.funserver.top';
const MC_PORT = Number(process.env.MC_PORT || 25565);
const ADMIN_NAME = process.env.ADMIN_NAME || 'OrynoxX7';
const NAME = process.env.BOT_NAME || 'Sub_To-Lynox';

let bot = null;
let state = 'offline';
let starting = false;
let reconnectTimer = null;
let attempts = 0;
let afk = null;
const logs = [];
const clients = new Set();

const statusMsg = () => ({ type: 'status', state, name: NAME, host: HOST });

function broadcast(obj) {
  const t = JSON.stringify(obj);
  for (const c of clients) if (c.readyState === 1) c.send(t);
}
function log(text, level = 'info') {
  const e = { type: 'log', text, level };
  logs.push(e);
  if (logs.length > 60) logs.shift();
  broadcast(e);
}
function setState(s) {
  state = s;
  broadcast(statusMsg());
}
function reasonText(r) {
  return String(typeof r === 'string' ? r : JSON.stringify(r)).slice(0, 250);
}
// يرسل أوامر رانك ADMIN الأحمر (نفس شكل BOT و OWNER). يحتاج أن يكون البوت OP.
function setupAdminRank(b) {
  const cmds = [
    '/team add admin',
    '/team modify admin prefix [{"text":"ADMIN","color":"red","bold":true},{"text":" | ","color":"gray"}]',
    '/team join admin ' + ADMIN_NAME
  ];
  cmds.forEach((c, i) => setTimeout(() => { try { b.chat(c); } catch (e) {} }, 4000 + i * 1500));
  log('تم إرسال أوامر رانك ADMIN للاعب ' + ADMIN_NAME, 'info');
}

function antiAfk(b) {
  try {
    b.setControlState('jump', true);
    setTimeout(() => { try { b.setControlState('jump', false); } catch (e) {} }, 350);
    b.look(Math.random() * Math.PI * 2, (Math.random() - 0.5) * 0.6, false);
  } catch (e) {}
}

function cleanup() {
  clearInterval(afk);
  afk = null;
  if (bot) {
    const b = bot;
    bot = null;
    try { b.removeAllListeners(); b.on('error', () => {}); b.end(); } catch (e) {}
  }
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  attempts++;
  const delay = Math.min(60000, 10000 + attempts * 5000);
  log('إعادة المحاولة بعد ' + Math.round(delay / 1000) + ' ثانية...', 'info');
  reconnectTimer = setTimeout(() => { reconnectTimer = null; startBot(); }, delay);
}

async function startBot() {
  if (bot || starting || reconnectTimer) return;
  starting = true;
  try {
    setState('connecting');
    let host = HOST;
    let port = MC_PORT;
    if (!net.isIP(host) && port === 25565) {
      try {
        const srv = await dns.resolveSrv('_minecraft._tcp.' + host);
        if (srv.length) { host = srv[0].name; port = srv[0].port; }
      } catch (e) { /* لا يوجد SRV */ }
    }
    log('جارٍ الدخول إلى ' + HOST + ' ...');
    const b = mineflayer.createBot({
      host, port, fakeHost: HOST, username: NAME,
      auth: 'offline', hideErrors: true, checkTimeoutInterval: 60000
    });
    bot = b;
    b.once('login', () => log('تم الاتصال، جارٍ تحميل العالم...', 'ok'));
    b.once('spawn', () => {
      attempts = 0;
      setState('online');
      log('البوت ' + NAME + ' داخل السيرفر الآن', 'ok');
      afk = setInterval(() => antiAfk(b), 25000);
      setupAdminRank(b);
    });
    b.on('kicked', (r) => log('تم طرد البوت: ' + reasonText(r), 'err'));
    b.on('error', (e) => log('خطأ: ' + (e && e.message ? e.message : e), 'err'));
    b.once('end', () => {
      if (bot !== b) return;
      cleanup();
      setState('offline');
      log('انقطع الاتصال بالسيرفر', 'warn');
      scheduleReconnect();
    });
  } catch (e) {
    cleanup();
    setState('offline');
    log('تعذر تشغيل البوت: ' + (e && e.message ? e.message : e), 'err');
    scheduleReconnect();
  } finally {
    starting = false;
  }
}

const server = http.createServer((req, res) => {
  startBot(); // أي زيارة تتأكد أن البوت شغال
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('OK ' + state);
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(PAGE);
});

const wss = new WebSocketServer({ server, maxPayload: 1024 });
wss.on('connection', (ws) => {
  clients.add(ws);
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
  ws.on('close', () => clients.delete(ws));
  ws.on('error', () => {});
  ws.send(JSON.stringify(statusMsg()));
  logs.forEach((e) => ws.send(JSON.stringify(e)));
  startBot();
});

setInterval(() => {
  wss.clients.forEach((c) => {
    if (!c.isAlive) { c.terminate(); return; }
    c.isAlive = false;
    try { c.ping(); } catch (e) {}
  });
}, 30000);

process.on('uncaughtException', (e) => console.error('uncaught:', e && e.message));
process.on('unhandledRejection', (e) => console.error('unhandled:', e && e.message));

server.listen(WEB_PORT, () => {
  console.log('listening on :' + WEB_PORT);
  startBot();
});
