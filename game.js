(function () {
'use strict';
var W = 360, H = 640;
var canvas = document.getElementById('c');
var ctx = canvas.getContext('2d');
canvas.width = W; canvas.height = H;

function fit() {
  var s = Math.min(window.innerWidth / W, window.innerHeight / H);
  canvas.style.width = Math.floor(W * s) + 'px';
  canvas.style.height = Math.floor(H * s) + 'px';
}
window.addEventListener('resize', fit);
window.addEventListener('orientationchange', fit);
fit();
ctx.imageSmoothingEnabled = false; ctx.webkitImageSmoothingEnabled = false;

/* ---------- images ---------- */
var IM = {}, loaded = 0;
var names = ['player','enemy1','enemy2','bullet','ebullet','star','power','boom','stars1','stars2'];
names.forEach(function (n) {
  var i = new Image();
  i.onload = i.onerror = function () { loaded++; };
  i.src = 'assets/img/' + n + '.png';
  IM[n] = i;
});

/* ---------- audio (Web Audio, webkit prefix, callback decode for iOS 9) ---------- */
var AC = window.AudioContext || window.webkitAudioContext;
var ac = null, bufs = {}, muted = false, musicSrc = null, musicGain = null;
var sounds = ['shoot','boom','pickup','hit','over','music'];
function gesture() {
  if (!AC || ac) return;
  try { ac = new AC(); } catch (e) { ac = null; return; }
  try { // unlock iOS audio
    var b = ac.createBuffer(1, 1, 22050), s = ac.createBufferSource();
    s.buffer = b; s.connect(ac.destination); s.start ? s.start(0) : s.noteOn(0);
  } catch (e) {}
  sounds.forEach(function (n) {
    var x = new XMLHttpRequest();
    x.open('GET', 'assets/snd/' + n + '.wav', true);
    x.responseType = 'arraybuffer';
    x.onload = function () {
      try { ac.decodeAudioData(x.response, function (b) { bufs[n] = b; }, function () {}); } catch (e) {}
    };
    x.send();
  });
}
function play(n, v) {
  if (!ac || muted || !bufs[n]) return;
  var s = ac.createBufferSource(), g = ac.createGain();
  s.buffer = bufs[n]; g.gain.value = v || 0.6;
  s.connect(g); g.connect(ac.destination);
  s.start ? s.start(0) : s.noteOn(0);
}
function startMusic() {
  if (!ac || !bufs.music || musicSrc) return;
  musicSrc = ac.createBufferSource(); musicSrc.buffer = bufs.music; musicSrc.loop = true;
  musicGain = ac.createGain(); musicGain.gain.value = muted ? 0 : 0.3;
  musicSrc.connect(musicGain); musicGain.connect(ac.destination);
  musicSrc.start ? musicSrc.start(0) : musicSrc.noteOn(0);
}
function stopMusic() {
  if (musicSrc) { try { musicSrc.stop ? musicSrc.stop(0) : musicSrc.noteOff(0); } catch (e) {} musicSrc = null; }
}
function toggleMute() {
  muted = !muted;
  if (musicGain) musicGain.gain.value = muted ? 0 : 0.3;
}

/* ---------- input ---------- */
var touch = { x: W / 2, y: H - 160, down: false };
function pos(e) {
  var r = canvas.getBoundingClientRect();
  var t = (e.touches && e.touches.length) ? e.touches[0] :
          (e.changedTouches && e.changedTouches.length) ? e.changedTouches[0] : e;
  return { x: (t.clientX - r.left) * W / r.width, y: (t.clientY - r.top) * H / r.height };
}
function onDown(e) {
  e.preventDefault();
  var p = pos(e);
  gesture();
  if (p.x > W - 50 && p.y < 50) { toggleMute(); return; }
  if (state === 'menu' || (state === 'over' && overT > 1)) startGame();
  touch.down = true; touch.x = p.x; touch.y = p.y - 50;
}
function onMove(e) {
  e.preventDefault();
  if (!touch.down) return;
  var p = pos(e); touch.x = p.x; touch.y = p.y - 50;
}
function onUp(e) { e.preventDefault(); touch.down = false; }
['touchstart','mousedown'].forEach(function (n) { canvas.addEventListener(n, onDown, false); });
['touchmove','mousemove'].forEach(function (n) { canvas.addEventListener(n, onMove, false); });
['touchend','touchcancel','mouseup'].forEach(function (n) { canvas.addEventListener(n, onUp, false); });
document.addEventListener('touchmove', function (e) { e.preventDefault(); }, false);

/* ---------- game state ---------- */
var state = 'menu', score = 0, hi = 0, lives = 3, t = 0, overT = 0, shake = 0;
var shootT = 0, power = 0, spawnT = 0, bgY = [0, 0];
var player, bullets = [], enemies = [], ebullets = [], pickups = [], booms = [];
try { hi = parseInt(localStorage.getItem('sd_hi'), 10) || 0; } catch (e) {}

function startGame() {
  score = 0; lives = 3; t = 0; power = 0; spawnT = 1; shootT = 0; shake = 0;
  bullets = []; enemies = []; ebullets = []; pickups = []; booms = [];
  player = { x: W / 2, y: H - 110, w: 24, h: 24, inv: 2 };
  touch.x = player.x; touch.y = player.y;
  state = 'play';
  startMusic();
}
function hit(a, b) {
  return Math.abs(a.x - b.x) * 2 < (a.w + b.w) && Math.abs(a.y - b.y) * 2 < (a.h + b.h);
}
function boom(x, y, s) { booms.push({ x: x, y: y, t: 0, s: s || 2 }); }

function fire() {
  if (power > 0) {
    bullets.push({ x: player.x, y: player.y - 18, vx: 0, vy: -540, w: 6, h: 14 });
    bullets.push({ x: player.x - 12, y: player.y - 10, vx: -70, vy: -520, w: 6, h: 14 });
    bullets.push({ x: player.x + 12, y: player.y - 10, vx: 70, vy: -520, w: 6, h: 14 });
  } else {
    bullets.push({ x: player.x - 8, y: player.y - 16, vx: 0, vy: -540, w: 6, h: 14 });
    bullets.push({ x: player.x + 8, y: player.y - 16, vx: 0, vy: -540, w: 6, h: 14 });
  }
}
function spawn(lvl) {
  var big = Math.random() < Math.min(0.6, 0.2 + lvl * 0.05);
  enemies.push({
    type: big ? 2 : 1, hp: big ? 3 : 1, w: big ? 34 : 28, h: big ? 26 : 20,
    bx: 30 + Math.random() * (W - 60), x: 0, y: -30, t: 0, ph: Math.random() * 6,
    amp: 15 + Math.random() * 40, sp: (big ? 55 : 80) + lvl * 8, st: 1 + Math.random()
  });
}
function hurt() {
  lives--; player.inv = 2; shake = 0.5; play('hit', 0.7);
  boom(player.x, player.y, 2);
  if (lives <= 0) {
    state = 'over'; overT = 0; stopMusic(); play('over', 0.6);
    if (score > hi) { hi = score; try { localStorage.setItem('sd_hi', String(hi)); } catch (e) {} }
  }
}
function killEnemy(e) {
  score += e.type === 2 ? 30 : 10;
  boom(e.x, e.y, e.type === 2 ? 2.4 : 1.8); play('boom', 0.5);
  var r = Math.random();
  if (r < 0.12) pickups.push({ x: e.x, y: e.y, type: 'star', w: 18, h: 18, vy: 90 });
  else if (r < 0.17) pickups.push({ x: e.x, y: e.y, type: 'power', w: 18, h: 18, vy: 90 });
}

function update(dt) {
  bgY[0] += 25 * dt; bgY[1] += 70 * dt;
  for (var b = booms.length - 1; b >= 0; b--) { booms[b].t += dt; if (booms[b].t > 0.4) booms.splice(b, 1); }
  if (shake > 0) shake -= dt;
  if (state === 'over') { overT += dt; return; }
  if (state !== 'play') return;
  t += dt;
  var lvl = 1 + Math.floor(score / 400), i, j;

  var k = Math.min(1, dt * 14);
  player.x += (touch.x - player.x) * k; player.y += (touch.y - player.y) * k;
  player.x = Math.max(20, Math.min(W - 20, player.x));
  player.y = Math.max(60, Math.min(H - 25, player.y));
  if (player.inv > 0) player.inv -= dt;
  if (power > 0) power -= dt;
  shootT -= dt;
  if (shootT <= 0) { shootT = 0.2; fire(); play('shoot', 0.22); }
  startMusic();

  spawnT -= dt;
  if (spawnT <= 0) { spawn(lvl); spawnT = Math.max(0.35, 1.1 - lvl * 0.08); }

  for (i = bullets.length - 1; i >= 0; i--) {
    var bl = bullets[i]; bl.x += bl.vx * dt; bl.y += bl.vy * dt;
    if (bl.y < -20) bullets.splice(i, 1);
  }
  for (i = enemies.length - 1; i >= 0; i--) {
    var e = enemies[i];
    e.t += dt; e.y += e.sp * dt; e.x = e.bx + Math.sin(e.t * 2 + e.ph) * e.amp;
    if (e.type === 2 && e.y > 0) {
      e.st -= dt;
      if (e.st <= 0) {
        e.st = 1.6;
        var dx = player.x - e.x, dy = player.y - e.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
        ebullets.push({ x: e.x, y: e.y + 10, vx: dx / d * 160, vy: dy / d * 160, w: 8, h: 8 });
      }
    }
    if (e.y > H + 30) { enemies.splice(i, 1); continue; }
    var dead = false;
    for (j = bullets.length - 1; j >= 0; j--) {
      if (hit(bullets[j], e)) {
        bullets.splice(j, 1); e.hp--;
        if (e.hp <= 0) { killEnemy(e); dead = true; break; }
      }
    }
    if (dead) { enemies.splice(i, 1); continue; }
    if (player.inv <= 0 && hit(player, e)) { killEnemy(e); enemies.splice(i, 1); hurt(); if (state !== 'play') return; }
  }
  for (i = ebullets.length - 1; i >= 0; i--) {
    var eb = ebullets[i]; eb.x += eb.vx * dt; eb.y += eb.vy * dt;
    if (eb.x < -20 || eb.x > W + 20 || eb.y < -20 || eb.y > H + 20) { ebullets.splice(i, 1); continue; }
    if (player.inv <= 0 && hit(player, eb)) { ebullets.splice(i, 1); hurt(); if (state !== 'play') return; }
  }
  for (i = pickups.length - 1; i >= 0; i--) {
    var p = pickups[i]; p.y += p.vy * dt;
    if (p.y > H + 20) { pickups.splice(i, 1); continue; }
    if (Math.abs(p.x - player.x) < 28 && Math.abs(p.y - player.y) < 28) {
      if (p.type === 'star') score += 50; else power = 8;
      play('pickup', 0.5); pickups.splice(i, 1);
    }
  }
}

/* ---------- drawing ---------- */
function img(n, x, y) { var i = IM[n]; ctx.drawImage(i, Math.round(x - i.width / 2), Math.round(y - i.height / 2)); }
function txt(s, x, y, size, color, align) {
  ctx.font = 'bold ' + size + 'px Helvetica, Arial, sans-serif';
  ctx.textAlign = align || 'center'; ctx.fillStyle = color || '#fff'; ctx.fillText(s, x, y);
}
function drawBg() {
  ctx.fillStyle = '#070720'; ctx.fillRect(0, 0, W, H);
  for (var l = 0; l < 2; l++) {
    var im = l ? IM.stars2 : IM.stars1, off = bgY[l] % 256;
    for (var x = 0; x < W; x += 256) for (var y = -256 + off; y < H; y += 256) ctx.drawImage(im, x, Math.round(y));
  }
}
function draw() {
  var i;
  ctx.save();
  if (shake > 0) ctx.translate((Math.random() - 0.5) * 12 * shake, (Math.random() - 0.5) * 12 * shake);
  drawBg();
  if (loaded < names.length) { ctx.restore(); txt('Ucitavanje...', W / 2, H / 2, 20); return; }
  for (i = 0; i < pickups.length; i++) img(pickups[i].type, pickups[i].x, pickups[i].y);
  for (i = 0; i < enemies.length; i++) img('enemy' + enemies[i].type, enemies[i].x, enemies[i].y);
  for (i = 0; i < ebullets.length; i++) img('ebullet', ebullets[i].x, ebullets[i].y);
  for (i = 0; i < bullets.length; i++) img('bullet', bullets[i].x, bullets[i].y);
  if (state === 'play' && (player.inv <= 0 || Math.floor(t * 14) % 2 === 0)) {
    img('player', player.x, player.y);
    if (power > 0) { ctx.strokeStyle = 'rgba(90,180,255,0.7)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(player.x, player.y, 26, 0, 6.283); ctx.stroke(); }
    // engine flame
    ctx.fillStyle = Math.floor(t * 30) % 2 ? '#ffb030' : '#ff6020';
    ctx.fillRect(Math.round(player.x - 3), Math.round(player.y + 16), 6, 6 + (Math.floor(t * 30) % 3) * 2);
  }
  for (i = 0; i < booms.length; i++) {
    var bm = booms[i], f = Math.min(3, Math.floor(bm.t / 0.1)), s = 32 * bm.s;
    ctx.drawImage(IM.boom, f * 32, 0, 32, 32, Math.round(bm.x - s / 2), Math.round(bm.y - s / 2), s, s);
  }
  ctx.restore();

  // HUD
  if (state !== 'menu') {
    txt('SCORE ' + score, 12, 26, 16, '#fff', 'left');
    for (i = 0; i < lives; i++) ctx.drawImage(IM.player, 12 + i * 24, 36, 20, 18);
    if (power > 0) txt('POWER ' + Math.ceil(power), W / 2, 26, 14, '#6cf');
  }
  txt('\u266A', W - 24, 28, 22, muted ? '#666' : '#fff');
  if (muted) { ctx.strokeStyle = '#f55'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(W - 36, 32); ctx.lineTo(W - 12, 10); ctx.stroke(); }

  if (state === 'menu') {
    txt('STAR', W / 2, 190, 52, '#6cf'); txt('DEFENDER', W / 2, 242, 44, '#ffd23c');
    img('player', W / 2, 330);
    txt('Prevuci prst da pomeras brod', W / 2, 410, 16);
    txt('Pucanje je automatsko', W / 2, 434, 16);
    if (Math.floor(Date.now() / 500) % 2) txt('TAP ZA START', W / 2, 500, 24, '#fff');
    if (hi) txt('REKORD ' + hi, W / 2, 550, 16, '#aaa');
  } else if (state === 'over') {
    txt('GAME OVER', W / 2, 250, 44, '#f55');
    txt('Rezultat: ' + score, W / 2, 300, 22);
    txt('Rekord: ' + hi, W / 2, 332, 18, '#ffd23c');
    if (overT > 1 && Math.floor(Date.now() / 500) % 2) txt('TAP ZA PONOVO', W / 2, 420, 22);
  }
}

/* ---------- loop ---------- */
var last = Date.now();
function loop() {
  requestAnimationFrame(loop);
  var now = Date.now(), dt = Math.min(0.05, (now - last) / 1000); last = now;
  update(dt); draw();
}
requestAnimationFrame(loop);
})();
