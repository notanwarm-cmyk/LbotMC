const express = require('express');
const cors = require('cors');
const mineflayer = require('mineflayer');

const HOST = process.env.MC_HOST || 'lhubx.funserver.top';
const MC_PORT = parseInt(process.env.MC_PORT || '25565', 10);
const NAME = process.env.BOT_NAME || 'Sub_To-Lynox';
const PASS = process.env.BOT_PASSWORD || 'Lynox12345'; // لو السيرفر يطلب /register و /login

let bot = null;
let state = 'offline'; // offline | connecting | online
let lastError = '';
let wanted = false;
let reconnectTimer = null;
let moveTimer = null;

function startWalking(b) {
  let yaw = Math.random() * Math.PI * 2;
  let lastPos = b.entity.position.clone();
  let lastTurn = 0;
  let tick = 0;

  const solid = (pos) => {
    const bl = b.blockAt(pos);
    return !!bl && bl.boundingBox === 'block';
  };

  const turnAround = () => {
    if (Date.now() - lastTurn < 600) return;
    lastTurn = Date.now();
    yaw += Math.PI + (Math.random() - 0.5) * 0.6; // الجهة المعاكسة
    b.look(yaw, 0, true);
  };

  b.look(yaw, 0, true);
  b.setControlState('forward', true);

  clearInterval(moveTimer);
  moveTimer = setInterval(() => {
    if (!b.entity) return;
    const p = b.entity.position;
    tick++;

    const dx = -Math.sin(yaw);
    const dz = -Math.cos(yaw);

    const feet = solid(p.offset(dx * 0.9, 0.1, dz * 0.9));
    const head = solid(p.offset(dx * 0.9, 1.1, dz * 0.9));

    if (feet && head) {
      turnAround(); // جدار
    } else {
      b.setControlState('jump', feet && !head); // درجة وحدة: يقفز
    }

    // حفرة أو حافة: يرجع
    if (b.entity.onGround) {
      const g1 = solid(p.offset(dx * 1.2, -1, dz * 1.2));
      const g2 = solid(p.offset(dx * 1.2, -2, dz * 1.2));
      if (!g1 && !g2) turnAround();
    }

    // لو علق ومش قادر يتحرك
    if (tick % 20 === 0) {
      if (p.distanceTo(lastPos) < 0.15) turnAround();
      lastPos = p.clone();
    }
  }, 50);
}

function startBot() {
  if (bot) return;
  wanted = true;
  state = 'connecting';
  lastError = '';

  bot = mineflayer.createBot({
    host: HOST,
    port: MC_PORT,
    username: NAME,
    auth: 'offline',
    hideErrors: true,
  });

  bot.once('spawn', () => {
    state = 'online';
    startWalking(bot);
  });

  bot.on('messagestr', (msg) => {
    const m = msg.toLowerCase();
    if (m.includes('/register')) bot.chat(`/register ${PASS} ${PASS}`);
    else if (m.includes('/login')) bot.chat(`/login ${PASS}`);
  });

  bot.on('kicked', (r) => {
    lastError = typeof r === 'string' ? r : JSON.stringify(r);
  });
  bot.on('error', (e) => {
    lastError = e.message;
  });
  bot.on('end', () => {
    clearInterval(moveTimer);
    bot = null;
    state = 'offline';
    if (wanted) reconnectTimer = setTimeout(startBot, 5000);
  });
}

function stopBot() {
  wanted = false;
  clearTimeout(reconnectTimer);
  clearInterval(moveTimer);
  if (bot) bot.quit();
  bot = null;
  state = 'offline';
}

const info = () => ({
  state,
  host: HOST,
  name: NAME,
  error: lastError,
  position: bot && bot.entity
    ? { x: Math.round(bot.entity.position.x), y: Math.round(bot.entity.position.y), z: Math.round(bot.entity.position.z) }
    : null,
});

const app = express();
app.use(cors());
app.use(express.json());
app.get('/health', (_q, r) => r.send('ok'));
app.get('/api/status', (_q, r) => r.json(info()));
app.post('/api/join', (_q, r) => { startBot(); r.json(info()); });
app.post('/api/stop', (_q, r) => { stopBot(); r.json(info()); });
app.use(express.static(__dirname + '/public'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('Server on ' + PORT);
  startBot(); // يدخل مباشرة أول ما يشتغل السيرفر
});
