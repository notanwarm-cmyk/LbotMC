'use strict';
/*
 * Duel_Me: بوت دويل واحد. أرسل له /duel وسيقبل آخر طلب وصله ويقاتلك.
 * يعرف: كريستال، سبير ميس (ويند شارج + مايس)، سورد، UHC (لافا + ماء + كسر الشيلد).
 * ملف واحد فقط. في Render:
 *   Build Command:  npm install ws mineflayer mineflayer-pathfinder vec3
 *   Start Command:  node server.js
 * اختياري (Environment): MC_HOST و MC_PORT و BOT_NAME
 */
const http = require('http');
const dns = require('dns').promises;
const net = require('net');
const { WebSocketServer } = require('ws');
const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const v3 = require('vec3');
const Vec3 = v3.Vec3 || v3;

const PAGE = "<!DOCTYPE html>\n<html lang=\"ar\" dir=\"rtl\">\n<head>\n<meta charset=\"UTF-8\">\n<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n<title>بوت الدويل</title>\n<link rel=\"preconnect\" href=\"https://fonts.googleapis.com\">\n<link rel=\"preconnect\" href=\"https://fonts.gstatic.com\" crossorigin>\n<link href=\"https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;600&family=Reem+Kufi:wght@600&display=swap\" rel=\"stylesheet\">\n<style>\n  :root { --dirt: #4a3322; --panel: #c6c6c6; --ink: #373737; --ok: #55ff55; --warn: #ffaa00; --err: #ff5555; color-scheme: light; }\n  * { box-sizing: border-box; }\n  html, body { margin: 0; min-height: 100%; }\n  body {\n    font-family: \"IBM Plex Sans Arabic\", system-ui, sans-serif;\n    color: var(--ink);\n    background-color: var(--dirt);\n    background-image:\n      linear-gradient(45deg, rgba(0,0,0,.16) 25%, transparent 25%, transparent 75%, rgba(0,0,0,.16) 75%),\n      linear-gradient(45deg, rgba(255,255,255,.04) 25%, transparent 25%, transparent 75%, rgba(255,255,255,.04) 75%);\n    background-size: 32px 32px;\n    background-position: 0 0, 16px 16px;\n    padding: max(20px, env(safe-area-inset-top)) 14px max(24px, env(safe-area-inset-bottom));\n    display: flex; justify-content: center;\n  }\n  main {\n    width: 100%; max-width: 560px; margin: auto 0;\n    background: var(--panel); padding: 22px 20px 20px;\n    box-shadow: inset 4px 4px 0 #fff, inset -4px -4px 0 #555, 0 0 0 4px #000, 0 10px 0 4px rgba(0,0,0,.35);\n  }\n  h1 {\n    font-family: \"Reem Kufi\", \"IBM Plex Sans Arabic\", sans-serif; font-weight: 600;\n    font-size: clamp(26px, 7vw, 36px); line-height: 1.2; margin: 0 0 6px; text-shadow: 2px 2px 0 #eee;\n  }\n  .lead { margin: 0 0 18px; font-size: 15px; line-height: 1.7; color: #4a4a4a; }\n  .info { display: grid; gap: 10px; margin: 0 0 6px; }\n  .row { display: flex; justify-content: space-between; align-items: center; gap: 12px; background: #1a1a1a; box-shadow: inset 0 0 0 2px #8b8b8b; padding: 12px; color: #fff; }\n  .row span:first-child { color: #aaa; font-size: 14px; }\n  .row b { direction: ltr; unicode-bidi: plaintext; font-size: 16px; font-weight: 600; word-break: break-all; }\n  .status { display: flex; align-items: center; gap: 10px; margin: 20px 0 8px; font-weight: 600; font-size: 16px; }\n  .pip { width: 14px; height: 14px; background: #777; box-shadow: 0 0 0 2px #000; flex: none; }\n  .pip.connecting { background: #e8b339; animation: blink 1s steps(2) infinite; }\n  .pip.online { background: #55c52e; }\n  @keyframes blink { 50% { opacity: .25; } }\n  @media (prefers-reduced-motion: reduce) { .pip.connecting { animation: none; } }\n  #console {\n    height: 200px; overflow-y: auto; background: #000; color: #ddd;\n    font: 13px/1.6 ui-monospace, Menlo, Consolas, monospace; padding: 10px 12px; box-shadow: 0 0 0 2px #8b8b8b;\n  }\n  #console div { unicode-bidi: plaintext; text-align: start; word-break: break-word; }\n  .l-ok { color: var(--ok); } .l-warn { color: var(--warn); } .l-err { color: var(--err); } .l-info { color: #aaa; }\n  .empty { color: #777; }\n  .foot { margin: 16px 0 0; font-size: 13px; line-height: 1.7; color: #555; }\n</style>\n</head>\n<body>\n<main>\n  <h1>بوت الدويل</h1>\n  <p class=\"lead\">أرسل له طلب /duel داخل السيرفر وسيقبله تلقائياً ويقاتلك.</p>\n\n  <div class=\"info\">\n    <div class=\"row\"><span>السيرفر</span><b id=\"host\">...</b></div>\n    <div class=\"row\"><span>اسم البوت</span><b id=\"name\">...</b></div>\n  </div>\n\n  <div class=\"status\"><span id=\"pip\" class=\"pip\"></span><span id=\"statusText\">جارٍ الاتصال بالموقع...</span></div>\n  <div id=\"console\" aria-live=\"polite\"><div class=\"empty\">سجل الحالة سيظهر هنا.</div></div>\n  <p class=\"foot\">هذه الصفحة للمتابعة فقط، والبوت يعمل من الخادم حتى لو أغلقتها. آخر شخص يرسل طلباً هو الذي يُقبل.</p>\n</main>\n\n<script>\n// اتركه فارغاً إذا كان server.js هو الذي يعرض هذه الصفحة. غيّره فقط لو رفعت الصفحة في مكان آخر.\nconst BACKEND_URL = '';\n\nconst $ = (id) => document.getElementById(id);\nconst labels = { offline: 'البوت غير متصل، جارٍ إعادة المحاولة...', connecting: 'جارٍ دخول البوت...', online: 'البوت داخل السيرفر' };\n\nfunction addLog(text, level) {\n  const con = $('console');\n  const first = con.firstElementChild;\n  if (first && first.classList.contains('empty')) con.innerHTML = '';\n  const d = document.createElement('div');\n  d.className = 'l-' + (level || 'info');\n  d.textContent = text;\n  con.appendChild(d);\n  while (con.children.length > 100) con.removeChild(con.firstChild);\n  con.scrollTop = con.scrollHeight;\n}\n\nfunction wsUrl() {\n  let u = BACKEND_URL.trim();\n  if (!u && /^https?:/.test(location.origin)) u = location.origin;\n  return u.replace(/^http/i, 'ws');\n}\n\nfunction connect() {\n  const url = wsUrl();\n  if (!url) { $('statusText').textContent = 'ضع عنوان الخادم في BACKEND_URL'; return; }\n  const ws = new WebSocket(url);\n  ws.onmessage = (e) => {\n    let m; try { m = JSON.parse(e.data); } catch (err) { return; }\n    if (m.type === 'status') {\n      $('host').textContent = m.host;\n      $('name').textContent = m.name;\n      $('pip').className = 'pip ' + (m.state === 'offline' ? '' : m.state);\n      $('statusText').textContent = labels[m.state] || m.state;\n    } else if (m.type === 'log') {\n      addLog(m.text, m.level);\n    }\n  };\n  ws.onclose = () => {\n    $('pip').className = 'pip';\n    $('statusText').textContent = 'جارٍ إعادة الاتصال بالموقع...';\n    setTimeout(connect, 3000);\n  };\n  ws.onerror = () => {};\n}\nconnect();\n</script>\n</body>\n</html>\n";

const WEB_PORT = Number(process.env.PORT || 3000);
const HOST = process.env.MC_HOST || 'lhubx.funserver.top';
const MC_PORT = Number(process.env.MC_PORT || 25565);
const NAME = process.env.BOT_NAME || 'Duel_Me';

let bot = null;
let state = 'offline';
let starting = false;
let reconnectTimer = null;
let attempts = 0;
let afk = null;
let combat = null;
let inDuel = false;
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
function setState(s) { state = s; broadcast(statusMsg()); }
function reasonText(r) { return String(typeof r === 'string' ? r : JSON.stringify(r)).slice(0, 250); }

// ======================= أدوات =======================
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rnd = (a, b) => a + Math.random() * (b - a);
function withTimeout(p, ms) {
  return Promise.race([Promise.resolve(p), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);
}
const TIERS = ['netherite', 'diamond', 'iron', 'stone', 'golden', 'wooden', 'copper'];
function tierRank(n) { const i = TIERS.findIndex((t) => n.startsWith(t)); return i < 0 ? 99 : i; }

// ======================= القتال =======================
function initCombat(b) {
  let duel = null;
  let busy = false;
  let nextAttack = 0;
  let strafeDir = 0;
  let strafeUntil = 0;
  let followId = null;
  let eating = false;
  let smash = { phase: 'idle', since: 0, readyAt: 0 };
  let lastAxeHit = 0, lavaReadyAt = 0, waterReadyAt = 0, waterPlacedAt = 0;
  let crystalActAt = 0, placeAt = 0, totemCheckAt = 0;
  let acceptTimer = null;
  let lastAccept = { name: '', at: 0 };

  const items = () => b.inventory.items();
  const find = (pred) => items().find((i) => pred(i.name));
  const heldName = () => (b.heldItem ? b.heldItem.name : '');
  const eye = () => b.entity.position.offset(0, 1.62, 0);

  async function equip(item, dest) {
    if (!item) return false;
    dest = dest || 'hand';
    if (dest === 'hand' && b.heldItem && b.heldItem.type === item.type) return true;
    try { await withTimeout(b.equip(item, dest), 800); return true; } catch (e) { return false; }
  }

  function look(point, force) {
    return Promise.resolve(b.lookAt(point, !!force)).catch(() => {});
  }
  function faceTarget(t, force) {
    const h = t.height || 1.8;
    return look(t.position.offset(rnd(-0.15, 0.15), h * 0.75 + rnd(-0.12, 0.12), rnd(-0.15, 0.15)), force);
  }

  // ---------- حركة ----------
  function clearMove() {
    for (const c of ['forward', 'back', 'left', 'right', 'sprint', 'jump']) b.setControlState(c, false);
  }
  function follow(t) {
    if (followId !== t.id) {
      clearMove();
      b.pathfinder.setGoal(new goals.GoalFollow(t, 2), true);
      followId = t.id;
    }
  }
  function unfollow() {
    if (followId !== null) { b.pathfinder.setGoal(null); followId = null; }
  }
  function strafe() {
    const now = Date.now();
    if (now > strafeUntil) {
      const r = Math.random();
      strafeDir = r < 0.4 ? -1 : r < 0.8 ? 1 : 0;
      strafeUntil = now + rnd(500, 1300);
    }
    b.setControlState('left', strafeDir === -1);
    b.setControlState('right', strafeDir === 1);
  }
  function meleeMove(t, dist) {
    if (dist > 4.8) { follow(t); return; }
    unfollow();
    faceTarget(t);
    b.setControlState('sprint', dist > 3);
    b.setControlState('forward', dist > 2.4);
    b.setControlState('back', dist < 1.3);
    strafe();
    if (b.entity.onGround && Math.random() < 0.015) {
      b.setControlState('jump', true);
      setTimeout(() => { try { b.setControlState('jump', false); } catch (e) {} }, 120);
    }
  }
  function ringMove(t, dist, near, far) {
    if (dist > far + 1.5) { follow(t); return; }
    unfollow();
    faceTarget(t);
    b.setControlState('sprint', false);
    b.setControlState('forward', dist > far);
    b.setControlState('back', dist < near);
    strafe();
  }

  // ---------- رؤية ومدى ----------
  function reachDist(t) {
    const e = eye();
    const hw = 0.3;
    const cx = Math.max(t.position.x - hw, Math.min(e.x, t.position.x + hw));
    const cy = Math.max(t.position.y, Math.min(e.y, t.position.y + (t.height || 1.8)));
    const cz = Math.max(t.position.z - hw, Math.min(e.z, t.position.z + hw));
    return Math.sqrt((e.x - cx) ** 2 + (e.y - cy) ** 2 + (e.z - cz) ** 2);
  }
  function clearLine(from, to) {
    const d = to.minus(from);
    const len = d.norm();
    if (len < 0.5) return true;
    const steps = Math.ceil(len / 0.25);
    for (let i = 1; i < steps; i++) {
      const p = from.plus(d.scaled(i / steps));
      const blk = b.blockAt(p);
      if (blk && blk.boundingBox === 'block') return false;
    }
    return true;
  }
  function canSee(t) {
    const e = eye();
    const h = t.height || 1.8;
    return clearLine(e, t.position.offset(0, h * 0.6, 0)) || clearLine(e, t.position.offset(0, h * 0.9, 0));
  }

  // ---------- أسلحة ----------
  function best(suffix) {
    return items().filter((i) => i.name.endsWith(suffix)).sort((a, c) => tierRank(a.name) - tierRank(c.name))[0];
  }
  function pickMelee(t) {
    const sw = best('_sword');
    const ax = best('_axe');
    const sp = best('_spear');
    const off = t.equipment && t.equipment[1];
    const shield = off && off.name === 'shield';
    if (shield && ax && Date.now() - lastAxeHit > 4500) return ax; // الفأس يكسر الشيلد
    return sw || sp || ax || null;
  }
  function cooldownFor(n) {
    if (n.endsWith('_axe')) return 1050;
    if (n === 'mace') return 1700;
    if (n.endsWith('_spear')) return 750;
    if (n.endsWith('_sword')) return 650;
    return 550;
  }
  function tryHit(t) {
    const now = Date.now();
    if (now < nextAttack) return false;
    if (reachDist(t) > 3.0 || !canSee(t)) return false; // مدى 3 بلوكات وبدون ضرب من خلف الحيط
    if (Math.random() < 0.08) { nextAttack = now + rnd(80, 200); return false; }
    const hn = heldName();
    b.attack(t);
    if (hn.endsWith('_axe')) lastAxeHit = now;
    nextAttack = now + cooldownFor(hn) + rnd(0, 130);
    return true;
  }

  // ---------- أكل وتوتم ----------
  async function maybeEat(dist) {
    if (b.health > 10) return false;
    if (dist < 2.8 && b.health > 5) return false;
    const f = find((n) => n === 'golden_apple' || n === 'enchanted_golden_apple');
    if (!f) return false;
    eating = true;
    unfollow(); clearMove();
    try { await equip(f); await withTimeout(b.consume(), 3500); } catch (e) {}
    eating = false;
    return true;
  }
  async function ensureTotem() {
    const now = Date.now();
    if (now < totemCheckAt) return;
    totemCheckAt = now + 3000;
    const off = b.inventory.slots[45];
    if (off && off.name === 'totem_of_undying') return;
    const t = find((n) => n === 'totem_of_undying');
    if (t) await equip(t, 'off-hand');
  }

  // ---------- أمان من اللافا والنار (UHC) ----------
  function onFire() {
    const m = b.entity.metadata && b.entity.metadata[0];
    return typeof m === 'number' && (m & 1) === 1;
  }
  function lavaNear() {
    const p = b.entity.position.floored();
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
      const blk = b.blockAt(p.offset(dx, dy, dz));
      if (blk && blk.name === 'lava') return true;
    }
    return false;
  }
  async function lavaSafety() {
    const water = find((n) => n === 'water_bucket');
    const bucket = find((n) => n === 'bucket');
    if (!water && !bucket) return false;
    const now = Date.now();
    const fire = onFire();
    const near = water ? lavaNear() : false;
    if (water && (fire || near || b.entity.isInLava) && now >= waterReadyAt) {
      unfollow(); clearMove();
      await equip(water);
      await withTimeout(b.look(b.entity.yaw, -Math.PI / 2, true), 500).catch(() => {});
      b.activateItem();
      waterReadyAt = now + 2500;
      waterPlacedAt = now;
      return true;
    }
    if (waterPlacedAt && now - waterPlacedAt > 2200 && !fire && !lavaNear() && bucket) {
      await equip(bucket);
      await withTimeout(b.look(b.entity.yaw, -Math.PI / 2, true), 500).catch(() => {});
      b.activateItem();
      waterPlacedAt = 0;
      return true;
    }
    return false;
  }

  // ---------- أنماط القتال ----------
  async function swordFight(t, dist) {
    await equip(pickMelee(t));
    meleeMove(t, dist);
    tryHit(t);
  }

  async function uhcFight(t, dist) {
    const now = Date.now();
    const lava = find((n) => n === 'lava_bucket');
    if (lava && now >= lavaReadyAt && dist >= 2.5 && dist <= 4.8 && canSee(t)) {
      unfollow(); clearMove();
      await equip(lava);
      await withTimeout(b.lookAt(t.position.offset(0, 0.05, 0), true), 500).catch(() => {});
      b.activateItem();
      lavaReadyAt = now + rnd(6000, 9000);
      return;
    }
    await swordFight(t, dist);
  }

  async function launch(t, mace, wind) {
    unfollow(); clearMove();
    const dx = t.position.x - b.entity.position.x;
    const dz = t.position.z - b.entity.position.z;
    const yaw = Math.atan2(-dx, -dz);
    await equip(wind);
    await withTimeout(b.look(yaw, -Math.PI / 2, true), 500).catch(() => {});
    b.setControlState('jump', true);
    await sleep(100);
    b.activateItem(); // ويند شارج تحت رجليه
    await sleep(60);
    b.setControlState('jump', false);
    b.setControlState('forward', true);
    b.setControlState('sprint', true);
    smash = { phase: 'air', since: Date.now(), readyAt: 0 };
    await sleep(120);
    await equip(mace);
  }

  async function maceFight(t, dist) {
    const now = Date.now();
    const mace = find((n) => n === 'mace');
    const wind = find((n) => n === 'wind_charge');
    if (smash.phase === 'air') {
      faceTarget(t, false);
      b.setControlState('forward', true);
      b.setControlState('sprint', true);
      if ((b.entity.onGround && now - smash.since > 400) || now - smash.since > 3500) {
        smash = { phase: 'idle', since: 0, readyAt: now + 2200 };
        clearMove();
        return;
      }
      if (b.entity.velocity.y < -0.25 && reachDist(t) <= 3.0 && canSee(t) && now >= nextAttack) {
        if (heldName() !== 'mace') await equip(mace);
        b.attack(t);
        nextAttack = now + 1700;
      }
      return;
    }
    if (mace && wind && b.entity.onGround && dist >= 3.5 && dist <= 9 && now >= smash.readyAt && canSee(t)) {
      await launch(t, mace, wind);
      return;
    }
    await equip(pickMelee(t) || mace);
    meleeMove(t, dist);
    tryHit(t);
  }

  // ---------- كريستال ----------
  const isAir = (p) => { const k = b.blockAt(p); return !!k && (k.name === 'air' || k.name === 'cave_air' || k.name === 'void_air'); };
  function nearestCrystal(t) {
    let bestE = null, bd = 99;
    for (const id in b.entities) {
      const e = b.entities[id];
      if (!e || e.name !== 'end_crystal') continue;
      const d = e.position.distanceTo(t.position);
      if (d <= 6 && d < bd) { bestE = e; bd = d; }
    }
    return bestE;
  }
  function breakCrystal(cr) {
    const c = cr.position.offset(0, 1, 0);
    const e = eye();
    if (e.distanceTo(c) > 4.5) return false;
    if (b.health < 8 && b.entity.position.distanceTo(cr.position) < 4.5) return false;
    if (!clearLine(e, c)) return false;
    look(c, true);
    b.attack(cr);
    return true;
  }
  async function placeNear(t) {
    const bx = Math.floor(t.position.x);
    const bz = Math.floor(t.position.z);
    const fy = Math.floor(t.position.y + 0.01);
    const offs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1], [2, 0], [-2, 0], [0, 2], [0, -2]]
      .sort(() => Math.random() - 0.5);
    const e = eye();
    const crystal = find((n) => n === 'end_crystal');
    if (crystal) {
      for (const y of [fy, fy - 1]) {
        for (const [dx, dz] of offs) {
          const gp = new Vec3(bx + dx, y, bz + dz);
          const g = b.blockAt(gp);
          if (!g || (g.name !== 'obsidian' && g.name !== 'bedrock')) continue;
          if (!isAir(gp.offset(0, 1, 0)) || !isAir(gp.offset(0, 2, 0))) continue;
          if (e.distanceTo(gp.offset(0.5, 1, 0.5)) > 4.5) continue;
          await equip(crystal);
          await look(gp.offset(0.5, 1, 0.5), true);
          Promise.resolve(b.activateBlock(g, new Vec3(0, 1, 0))).catch(() => {});
          return true;
        }
      }
    }
    const obs = find((n) => n === 'obsidian');
    if (!obs) return false;
    for (const [dx, dz] of offs) {
      const gp = new Vec3(bx + dx, fy - 1, bz + dz);
      const g = b.blockAt(gp);
      if (!g || g.boundingBox !== 'block' || g.name === 'obsidian' || g.name === 'bedrock') continue;
      if (!isAir(gp.offset(0, 1, 0)) || !isAir(gp.offset(0, 2, 0)) || !isAir(gp.offset(0, 3, 0))) continue;
      if (e.distanceTo(gp.offset(0.5, 1, 0.5)) > 4.5) continue;
      await equip(obs);
      await look(gp.offset(0.5, 1, 0.5), true);
      await withTimeout(b.placeBlock(g, new Vec3(0, 1, 0)), 600).catch(() => {});
      return true;
    }
    return false;
  }

  async function crystalFight(t, dist) {
    const now = Date.now();
    await ensureTotem();
    if (now >= crystalActAt) {
      const cr = nearestCrystal(t);
      if (cr && breakCrystal(cr)) {
        crystalActAt = now + rnd(110, 210);
        ringMove(t, dist, 3.5, 5);
        return;
      }
    }
    if (dist <= 3.1) {
      await equip(pickMelee(t));
      meleeMove(t, dist);
      tryHit(t);
      return;
    }
    ringMove(t, dist, 3.5, 5);
    if (now >= placeAt) {
      placeAt = now + rnd(280, 520);
      await placeNear(t);
    }
  }

  // ---------- الحلقة الرئيسية ----------
  function detectMode() {
    if (find((n) => n === 'mace')) return 'spearmace';
    if (find((n) => n === 'end_crystal')) return 'crystal';
    if (find((n) => n === 'lava_bucket')) return 'uhc';
    return 'sword';
  }

  function getTarget() {
    if (!duel) return null;
    const want = duel.name.toLowerCase();
    for (const k of Object.keys(b.players)) {
      if (k.toLowerCase() === want) return b.players[k].entity || null;
    }
    return null;
  }

  function endDuel(reason) {
    if (!duel) return;
    duel = null;
    inDuel = false;
    smash = { phase: 'idle', since: 0, readyAt: 0 };
    unfollow(); clearMove();
    log(reason, 'info');
  }

  async function fight() {
    const now = Date.now();
    const t = getTarget();
    if (!t) {
      if (now - duel.lastSeen > 12000) endDuel('انتهى الدويل (الخصم غير موجود)');
      return;
    }
    duel.lastSeen = now;
    if (now - duel.since > 6 * 60e3) { endDuel('انتهى الوقت'); return; }
    const dist = b.entity.position.distanceTo(t.position);
    if (dist > 48) return;
    if (await lavaSafety()) return;
    if (await maybeEat(dist)) return;
    const mode = detectMode();
    if (mode === 'spearmace') await maceFight(t, dist);
    else if (mode === 'crystal') await crystalFight(t, dist);
    else if (mode === 'uhc') await uhcFight(t, dist);
    else await swordFight(t, dist);
  }

  async function tick() {
    if (busy || !duel || eating) return;
    busy = true;
    try { await fight(); } catch (e) {} finally { busy = false; }
  }

  // ---------- طلبات الدويل ----------
  const BAD = /accepted|started|won |lost|cancel|expire|declin|ended|finished|victory|winner/i;
  const REQ = /challeng|request|invit|wants? to|sent you|duel you|has sent/i;

  function findPlayerName(msg) {
    const tokens = msg.match(/[A-Za-z0-9_]{3,16}/g) || [];
    const names = Object.keys(b.players);
    for (const tk of tokens) {
      if (tk.toLowerCase() === b.username.toLowerCase()) continue;
      const hit = names.find((n) => n.toLowerCase() === tk.toLowerCase());
      if (hit) return hit;
    }
    return null;
  }

  function onMsg(msg) {
    if (!msg || !/duel/i.test(msg)) return;
    let name = null;
    const m = msg.match(/\/duel\s+accept\s+([A-Za-z0-9_]{3,16})/i);
    if (m) name = m[1];
    else {
      if (BAD.test(msg) || !REQ.test(msg)) return;
      name = findPlayerName(msg);
    }
    if (!name || name.toLowerCase() === b.username.toLowerCase()) return;
    if (duel && getTarget() && Date.now() - duel.lastSeen < 5000) return; // وسط قتال
    clearTimeout(acceptTimer);
    acceptTimer = setTimeout(() => {
      const now = Date.now();
      if (lastAccept.name === name && now - lastAccept.at < 2500) return;
      lastAccept = { name, at: now };
      b.chat('/duel accept ' + name); // آخر شخص أرسل طلباً هو اللي يُقبل
      duel = { name, since: now, lastSeen: now };
      inDuel = true;
      log('قبلت طلب الدويل من ' + name, 'ok');
    }, 700);
  }

  b.on('messagestr', onMsg);
  b.on('death', () => endDuel('مات البوت، انتهى الدويل'));
  const timer = setInterval(tick, 50);
  return {
    stop() { clearInterval(timer); clearTimeout(acceptTimer); inDuel = false; }
  };
}

// ======================= الاتصال =======================
function antiAfk(b) {
  if (inDuel) return;
  try {
    b.setControlState('jump', true);
    setTimeout(() => { try { b.setControlState('jump', false); } catch (e) {} }, 350);
    b.look(Math.random() * Math.PI * 2, (Math.random() - 0.5) * 0.6, false);
  } catch (e) {}
}

function cleanup() {
  clearInterval(afk);
  afk = null;
  if (combat) { combat.stop(); combat = null; }
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
    b.loadPlugin(pathfinder);
    b.once('login', () => log('تم الاتصال، جارٍ تحميل العالم...', 'ok'));
    b.once('spawn', () => {
      attempts = 0;
      try {
        const mv = new Movements(b);
        mv.canDig = false;
        mv.allow1by1towers = false;
        mv.scafoldingBlocks = [];
        b.pathfinder.setMovements(mv);
      } catch (e) { log('تعذر تجهيز التنقل: ' + e.message, 'err'); }
      combat = initCombat(b);
      setState('online');
      log('البوت ' + NAME + ' جاهز، أرسل له /duel', 'ok');
      afk = setInterval(() => antiAfk(b), 25000);
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
  startBot();
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
