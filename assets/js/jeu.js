/* Bokit Run – le camion Saveur Boucanée sur la route des Antilles.
   Comme le jeu du dinosaure de Chrome, en plus facile : double saut, 3 vies, vitesse plafonnée.
   Aucun fichier image : tout est dessiné en canvas (reprend les formes du camion SVG du site). */
(function () {
  "use strict";
  var cv = document.getElementById("jeu"); if (!cv) return;
  var ctx = cv.getContext("2d");
  var W = 800, H = 320, SOL = 262;           // monde logique ; y du sol
  var dpr = 1, sx = 1;
  function taille() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = cv.parentNode.clientWidth < 620 ? 480 : 800;          // sur téléphone : monde plus étroit = sprites plus gros
    cv.style.aspectRatio = W + "/" + H;
    var w = cv.clientWidth; sx = w / W;
    cv.width = Math.round(w * dpr); cv.height = Math.round(w * H / W * dpr);
  }
  addEventListener("resize", taille); taille();

  // ---------- camion (chemins du SVG du site, viewBox 340x170) ----------
  var P = function (d) { return new Path2D(d); };
  var T = {
    corps: P("M14 38c0-5 4-8 9-8h214c6 0 10 2 13 6l36 48c2 3 3 6 3 9v43c0 5-4 8-8 8H22c-5 0-8-3-8-8z"),
    bas: P("M14 104h267v34c0 5-4 8-8 8H22c-5 0-8-3-8-8z"),
    pare: P("M244 42h6l34 46h-40z"),
    auvent: P("M34 30h118l10-14H26z")
  };
  function camion(x, y, s, roue, flash) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    if (flash) ctx.globalAlpha = 0.45;
    ctx.fillStyle = "#f7f1e3"; ctx.fill(T.corps);
    ctx.fillStyle = "#b89655"; ctx.fill(T.bas);
    ctx.fillStyle = "#8a6d35"; ctx.fillRect(14, 100, 267, 6);
    ctx.fillStyle = "#26343f"; ctx.fill(T.pare); ctx.fillRect(196, 48, 38, 32);
    ctx.fillStyle = "#e0c98f"; ctx.fill(T.auvent);
    ctx.fillStyle = "#3b2a20"; ctx.fillRect(34, 44, 116, 42);
    ctx.fillStyle = "#f5c518"; ctx.fillRect(40, 50, 30, 10);
    ctx.fillStyle = "#e53935"; ctx.fillRect(76, 50, 30, 10);
    ctx.fillStyle = "#43a047"; ctx.fillRect(112, 50, 30, 10);
    madrasBande(34, 88, 116, 8);
    ctx.fillStyle = "#1b1b1b"; rond(176, 66, 15); ctx.fillStyle = "#f5c518"; rond(176, 66, 10);
    ctx.fillStyle = "#e53935"; ctx.fillRect(171, 58, 4, 16);
    ctx.fillStyle = "#5d4037"; ctx.fillRect(88, 22, 16, 12);            // cheminée du boucan
    ctx.fillStyle = "#fff59d"; ctx.fillRect(274, 110, 10, 8);
    rouePeinte(76, 144, roue); rouePeinte(236, 144, roue);
    ctx.restore();
  }
  function rouePeinte(x, y, a) {
    ctx.fillStyle = "#222"; rond(x, y, 20); ctx.fillStyle = "#cfd8dc"; rond(x, y, 9);
    ctx.strokeStyle = "#555"; ctx.lineWidth = 3; ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * 8, y + Math.sin(a) * 8); ctx.lineTo(x - Math.cos(a) * 8, y - Math.sin(a) * 8); ctx.stroke();
  }
  function rond(x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fill(); }
  function madrasBande(x, y, w, h) {
    ctx.fillStyle = "#f5c518"; ctx.fillRect(x, y, w, h);
    for (var i = 0; i < w; i += 24) { ctx.fillStyle = "#e53935"; ctx.fillRect(x + i + 6, y, 8, h); ctx.fillStyle = "#2e7d32"; ctx.fillRect(x + i + 18, y, 3, h); }
  }

  // ---------- état ----------
  var S = 0.4, TW = 340 * S, TH = 150 * S;    // camion à l'échelle 0.4
  var joueur, obs, bonus, parts, deco, vitesse, dist, score, vies, invinc, piment, etat = "menu", tprev = 0, msg = null, record = 0;
  try { record = +localStorage.getItem("bokitrun-record") || 0; } catch (e) {}
  function reset() {
    joueur = { x: W < 600 ? 30 : 70, y: SOL - TH, vy: 0, sauts: 0 };
    obs = []; bonus = []; parts = []; vitesse = 250; dist = 0; score = 0; vies = 3; invinc = 0; piment = 0; msg = null;
    prochain = 500; prochainB = 300;
  }
  var prochain = 0, prochainB = 0;
  deco = { palm: [], cases: [], cannes: [] };
  for (var i = 0; i < 5; i++) deco.palm.push({ x: i * 190 + Math.random() * 80, h: 70 + Math.random() * 40 });
  for (i = 0; i < 3; i++) deco.cases.push({ x: i * 300 + 120, c: ["#ff8a65", "#4dd0e1", "#aed581", "#ffd54f"][i % 4] });
  for (i = 0; i < 9; i++) deco.cannes.push({ x: i * 100 + Math.random() * 40 });
  reset();

  function sauter() {
    if (etat !== "jeu") { reset(); etat = "jeu"; return; }
    if (joueur.sauts < 2) { joueur.vy = joueur.sauts ? -700 : -820; joueur.sauts++; fumee(6); }
  }
  cv.addEventListener("pointerdown", function (e) { e.preventDefault(); sauter(); });
  addEventListener("keydown", function (e) {
    if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") { e.preventDefault(); sauter(); }
  });
  document.addEventListener("visibilitychange", function () { if (document.hidden && etat === "jeu") etat = "pause"; });

  function fumee(n) {
    for (var i = 0; i < n; i++) parts.push({ x: joueur.x + 96 * S, y: joueur.y + 20 * S, vx: -40 - Math.random() * 40, vy: -30 - Math.random() * 30, v: 1, r: 4 + Math.random() * 4, c: "255,255,255" });
  }

  // ---------- obstacles & bonus ----------
  var TYPES = [
    { n: "crabe", w: 34, h: 22 }, { n: "coco", w: 26, h: 26 }, { n: "iguane", w: 54, h: 18 }, { n: "caisse", w: 30, h: 30 }
  ];
  function nouvelObstacle() {
    var t = TYPES[Math.floor(Math.random() * (dist > 1500 ? 4 : 2))];
    obs.push({ n: t.n, x: W + 20, w: t.w, h: t.h, y: SOL - t.h, a: 0 });
    prochain = Math.max(330, vitesse * 1.15) + Math.random() * 320;
  }
  function nouveauBonus() {
    var r = Math.random(), n = r < 0.55 ? "bokit" : r < 0.9 ? "accras" : "piment";
    bonus.push({ n: n, x: W + 20, y: SOL - 70 - Math.random() * 90, w: 30, h: 24, a: 0 });
    prochainB = 260 + Math.random() * 380;
  }

  // ---------- décor antillais ----------
  function ciel(t) {
    var k = Math.min(1, dist / 12000); // la journée avance vers le coucher de soleil
    var g = ctx.createLinearGradient(0, 0, 0, SOL);
    g.addColorStop(0, mix([74, 196, 229], [255, 126, 95], k)); g.addColorStop(1, mix([200, 240, 245], [255, 214, 140], k));
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, SOL);
    ctx.fillStyle = "rgba(255,236,150,.9)"; rond(W - 150, 70 + k * 60, 34);
    ctx.fillStyle = "rgba(255,236,150,.25)"; rond(W - 150, 70 + k * 60, 52);
    // nuages
    ctx.fillStyle = "rgba(255,255,255,.85)";
    for (var i = 0; i < 3; i++) { var x = ((i * 330 - dist * 0.05) % 1000 + 1000) % 1000 - 100; nuage(x, 40 + i * 22); }
  }
  function mix(a, b, k) { return "rgb(" + Math.round(a[0] + (b[0] - a[0]) * k) + "," + Math.round(a[1] + (b[1] - a[1]) * k) + "," + Math.round(a[2] + (b[2] - a[2]) * k) + ")"; }
  function nuage(x, y) { rond(x, y, 16); rond(x + 18, y - 8, 20); rond(x + 40, y, 16); ctx.fillRect(x, y, 40, 16); }
  function mornes() {
    // la Soufrière au loin + les mornes verts
    var o = -(dist * 0.1) % 900;
    for (var k = 0; k < 2; k++) {
      var x = o + k * 900;
      ctx.fillStyle = "#5b8f7b";
      ctx.beginPath(); ctx.moveTo(x, 200); ctx.lineTo(x + 170, 88); ctx.lineTo(x + 200, 92); ctx.lineTo(x + 380, 200); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,.7)"; nuage(x + 175, 84);
      ctx.fillStyle = "#3f7d4f";
      ctx.beginPath(); ctx.moveTo(x + 300, 205);
      ctx.quadraticCurveTo(x + 420, 110, x + 540, 190); ctx.quadraticCurveTo(x + 640, 130, x + 760, 205); ctx.quadraticCurveTo(x + 830, 160, x + 900, 205); ctx.fill();
    }
    // la mer
    ctx.fillStyle = "#1fa3c4"; ctx.fillRect(0, 200, W, 30);
    ctx.fillStyle = "#57c7de"; ctx.fillRect(0, 200, W, 6);
    ctx.strokeStyle = "rgba(255,255,255,.6)"; ctx.lineWidth = 2;
    var v = -(dist * 0.25) % 60;
    for (var i = v; i < W; i += 60) { ctx.beginPath(); ctx.moveTo(i, 216); ctx.quadraticCurveTo(i + 8, 211, i + 16, 216); ctx.stroke(); }
    // voilier
    var bx = W - ((dist * 0.18) % (W + 200)) + 100;
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.moveTo(bx, 206); ctx.lineTo(bx, 176); ctx.lineTo(bx + 18, 206); ctx.fill();
    ctx.fillStyle = "#d7261e"; ctx.fillRect(bx - 12, 206, 34, 5);
    // plage
    ctx.fillStyle = "#f4d58d"; ctx.fillRect(0, 228, W, 20);
  }
  function palmier(x, h) {
    var b = 238;
    ctx.strokeStyle = "#8d6e63"; ctx.lineWidth = 7; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(x, b); ctx.quadraticCurveTo(x + 8, b - h / 2, x + 14, b - h); ctx.stroke();
    ctx.fillStyle = "#2e7d32";
    var tx = x + 14, ty = b - h;
    for (var i = 0; i < 6; i++) {
      var a = -2.9 + i * 0.55;
      ctx.beginPath(); ctx.moveTo(tx, ty);
      ctx.quadraticCurveTo(tx + Math.cos(a - 0.3) * 30, ty + Math.sin(a - 0.3) * 30 - 8, tx + Math.cos(a) * 46, ty + Math.sin(a) * 46 + 10);
      ctx.quadraticCurveTo(tx + Math.cos(a + 0.3) * 24, ty + Math.sin(a + 0.3) * 24, tx, ty); ctx.fill();
    }
    ctx.fillStyle = "#6d4c2f"; rond(tx - 3, ty + 4, 4); rond(tx + 4, ty + 5, 4);
  }
  function caseCreole(x, c) {
    var b = 240;
    ctx.fillStyle = c; ctx.fillRect(x, b - 38, 56, 38);
    ctx.fillStyle = "#b71c1c"; ctx.beginPath(); ctx.moveTo(x - 6, b - 38); ctx.lineTo(x + 28, b - 60); ctx.lineTo(x + 62, b - 38); ctx.fill();
    ctx.fillStyle = "#5d4037"; ctx.fillRect(x + 22, b - 24, 12, 24);
    ctx.fillStyle = "#fff"; ctx.fillRect(x + 6, b - 30, 10, 10); ctx.fillRect(x + 40, b - 30, 10, 10);
    ctx.fillStyle = "#fff"; for (var i = 0; i < 56; i += 7) ctx.fillRect(x + i, b - 6, 3, 6);
  }
  function route() {
    ctx.fillStyle = "#4a3b33"; ctx.fillRect(0, 246, W, H - 246);
    ctx.fillStyle = "#3a2d26"; ctx.fillRect(0, 246, W, 4);
    ctx.fillStyle = "rgba(255,255,255,.75)";
    var o = -(dist % 70);
    for (var i = o; i < W; i += 70) ctx.fillRect(i, 290, 36, 5);
    // cannes à sucre au premier plan
    for (var k = 0; k < deco.cannes.length; k++) {
      var c = deco.cannes[k], x = ((c.x - dist * 1.25) % 900 + 900) % 900 - 50;
      ctx.strokeStyle = "#7cb342"; ctx.lineWidth = 3;
      for (var j = 0; j < 3; j++) { ctx.beginPath(); ctx.moveTo(x + j * 6, H); ctx.lineTo(x + j * 6 - 3 + j * 3, H - 18 - j * 5); ctx.stroke(); }
    }
  }
  function guirlande() {
    ctx.strokeStyle = "rgba(0,0,0,.25)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, 6); ctx.quadraticCurveTo(W / 2, 26, W, 6); ctx.stroke();
    var cols = ["#f5c518", "#d7261e", "#1f7a3a"];
    for (var i = 0; i < W / 33; i++) {
      var x = i * 33 + 6, y = 6 + Math.sin(x / W * Math.PI) * 13;
      ctx.fillStyle = cols[i % 3]; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 20, y); ctx.lineTo(x + 10, y + 16); ctx.fill();
    }
  }

  // ---------- sprites ----------
  function dessineObs(o) {
    var x = o.x, y = o.y;
    if (o.n === "crabe") {
      var p = Math.sin(o.a * 12) * 3;
      ctx.strokeStyle = "#b71c1c"; ctx.lineWidth = 3;
      for (var i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(x + 8 + i * 8, y + 16); ctx.lineTo(x + 2 + i * 8 + p, y + 22); ctx.stroke(); }
      ctx.fillStyle = "#e53935"; ctx.beginPath(); ctx.ellipse(x + 17, y + 13, 16, 9, 0, 0, 6.3); ctx.fill();
      rond(x + 2, y + 4 + p, 5); rond(x + 32, y + 4 - p, 5);
      ctx.fillStyle = "#fff"; rond(x + 12, y + 4, 3); rond(x + 22, y + 4, 3);
      ctx.fillStyle = "#000"; rond(x + 12, y + 4, 1.5); rond(x + 22, y + 4, 1.5);
    } else if (o.n === "coco") {
      ctx.save(); ctx.translate(x + 13, y + 13); ctx.rotate(-o.a * 8);
      ctx.fillStyle = "#6d4c2f"; rond(0, 0, 13); ctx.fillStyle = "#4e342e"; rond(-4, -3, 2); rond(3, -4, 2); rond(0, 3, 2);
      ctx.restore();
    } else if (o.n === "iguane") {
      var q = Math.sin(o.a * 10) * 2;
      ctx.fillStyle = "#43a047";
      ctx.beginPath(); ctx.ellipse(x + 26, y + 11, 18, 7, 0, 0, 6.3); ctx.fill();
      ctx.beginPath(); ctx.ellipse(x + 6, y + 8, 8, 5, 0, 0, 6.3); ctx.fill();
      ctx.strokeStyle = "#2e7d32"; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x + 42, y + 12); ctx.quadraticCurveTo(x + 52, y + 4 + q, x + 56, y + 14); ctx.stroke();
      ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x + 18, y + 14); ctx.lineTo(x + 14 + q, y + 18); ctx.moveTo(x + 34, y + 14); ctx.lineTo(x + 38 - q, y + 18); ctx.stroke();
      ctx.fillStyle = "#000"; rond(x + 4, y + 6, 1.5);
      ctx.fillStyle = "#9ccc65"; for (var k = 0; k < 4; k++) { ctx.beginPath(); ctx.moveTo(x + 14 + k * 7, y + 5); ctx.lineTo(x + 17 + k * 7, y); ctx.lineTo(x + 20 + k * 7, y + 5); ctx.fill(); }
    } else {
      ctx.fillStyle = "#a1887f"; ctx.fillRect(x, y, 30, 30);
      ctx.strokeStyle = "#6d4c41"; ctx.lineWidth = 3; ctx.strokeRect(x + 1.5, y + 1.5, 27, 27);
      ctx.fillStyle = "#ffb300"; rond(x + 9, y - 1, 6); ctx.fillStyle = "#ff7043"; rond(x + 20, y - 2, 6);
      ctx.fillStyle = "#43a047"; ctx.fillRect(x + 18, y - 10, 3, 5);
    }
  }
  function dessineBonus(b) {
    var x = b.x, y = b.y + Math.sin(b.a * 4) * 4;
    ctx.fillStyle = "rgba(255,240,150,.35)"; rond(x + 15, y + 12, 20);
    if (b.n === "bokit") {
      ctx.fillStyle = "#e7a94a"; ctx.beginPath(); ctx.ellipse(x + 15, y + 17, 15, 5, 0, 0, 6.3); ctx.fill();
      ctx.fillStyle = "#4caf50"; ctx.fillRect(x + 1, y + 11, 28, 4); ctx.fillStyle = "#7a3b1c"; ctx.fillRect(x + 2, y + 9, 26, 3);
      ctx.fillStyle = "#f2bf5e"; ctx.beginPath(); ctx.ellipse(x + 15, y + 8, 15, 8, 0, 3.14, 6.3); ctx.fill();
    } else if (b.n === "accras") {
      ctx.fillStyle = "#d9892b"; rond(x + 8, y + 14, 8); rond(x + 22, y + 14, 8); rond(x + 15, y + 5, 8);
      ctx.fillStyle = "#2e7d32"; rond(x + 10, y + 16, 1.5); rond(x + 20, y + 12, 1.5);
    } else {
      ctx.fillStyle = "#e53935"; ctx.beginPath(); ctx.ellipse(x + 15, y + 14, 10, 9, 0, 0, 6.3); ctx.fill();
      ctx.strokeStyle = "#2e7d32"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x + 15, y + 6); ctx.lineTo(x + 19, y); ctx.stroke();
    }
  }
  function coeur(x, y, plein) {
    ctx.fillStyle = plein ? "#e53935" : "rgba(0,0,0,.25)";
    ctx.beginPath(); ctx.moveTo(x, y + 4); ctx.bezierCurveTo(x, y - 2, x - 9, y - 2, x - 9, y + 4); ctx.bezierCurveTo(x - 9, y + 9, x, y + 14, x, y + 16);
    ctx.bezierCurveTo(x, y + 14, x + 9, y + 9, x + 9, y + 4); ctx.bezierCurveTo(x + 9, y - 2, x, y - 2, x, y + 4); ctx.fill();
  }
  function texte(t, x, y, taille, coul, align) {
    ctx.font = taille + 'px "Lilita One","Arial Rounded MT Bold",sans-serif'; ctx.textAlign = align || "center";
    ctx.lineWidth = 5; ctx.strokeStyle = "rgba(26,18,13,.85)"; ctx.strokeText(t, x, y);
    ctx.fillStyle = coul || "#fff"; ctx.fillText(t, x, y);
  }

  // ---------- boucle ----------
  function touche(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }
  function maj(dt) {
    if (etat !== "jeu") return;
    vitesse = Math.min(470, vitesse + dt * 6);
    var dx = vitesse * dt; dist += dx; score += dx / 10;
    joueur.vy += 2200 * dt; joueur.y += joueur.vy * dt;
    if (joueur.y >= SOL - TH) { joueur.y = SOL - TH; joueur.vy = 0; joueur.sauts = 0; }
    prochain -= dx; if (prochain <= 0) nouvelObstacle();
    prochainB -= dx; if (prochainB <= 0) nouveauBonus();
    if (invinc > 0) invinc -= dt; if (piment > 0) piment -= dt;
    if (msg) { msg.t -= dt; if (msg.t <= 0) msg = null; }
    var hb = { x: joueur.x + 14, y: joueur.y + 16, w: TW - 26, h: TH - 18 }; // boîte de collision indulgente
    for (var i = obs.length - 1; i >= 0; i--) {
      var o = obs[i]; o.x -= dx + (o.n === "crabe" ? 30 * dt : o.n === "coco" ? 50 * dt : 0); o.a += dt;
      if (o.x < -80) { obs.splice(i, 1); continue; }
      if (invinc <= 0 && piment <= 0 && touche(hb, { x: o.x + 4, y: o.y + 4, w: o.w - 8, h: o.h - 4 })) {
        vies--; invinc = 1.4; msg = { t: 1, s: ["Aïe !", "Wouch !", "Fouté !"][vies % 3] };
        if (vies <= 0) fin();
      } else if (piment > 0 && touche(hb, o)) { obs.splice(i, 1); score += 15; msg = { t: .6, s: "+15 🔥" }; }
    }
    for (i = bonus.length - 1; i >= 0; i--) {
      var b = bonus[i]; b.x -= dx; b.a += dt;
      if (b.x < -40) { bonus.splice(i, 1); continue; }
      if (touche(hb, b)) {
        bonus.splice(i, 1);
        if (b.n === "bokit") { score += 25; msg = { t: .8, s: "+25 Bokit !" }; }
        else if (b.n === "accras") { score += 10; msg = { t: .8, s: "+10 Accras" }; }
        else { piment = 4; msg = { t: 1.4, s: "Sauce chien ! 🔥" }; }
      }
    }
    if (Math.random() < dt * 14) parts.push({ x: joueur.x + 96 * S, y: joueur.y + 22 * S, vx: -vitesse * 0.4, vy: -40, v: 1, r: 3 + Math.random() * 3, c: piment > 0 ? "255,120,40" : "240,240,240" });
    for (i = parts.length - 1; i >= 0; i--) { var p = parts[i]; p.x += p.vx * dt; p.y += p.vy * dt; p.r += dt * 8; p.v -= dt * 1.2; if (p.v <= 0) parts.splice(i, 1); }
  }
  function fin() {
    etat = "fin"; score = Math.floor(score);
    if (score > record) { record = score; try { localStorage.setItem("bokitrun-record", record); } catch (e) {} }
  }
  function rendu(t) {
    ctx.setTransform(dpr * sx, 0, 0, dpr * sx, 0, 0);
    ciel(t); mornes();
    for (var i = 0; i < deco.cases.length; i++) { var c = deco.cases[i]; caseCreole(((c.x - dist * 0.5) % 900 + 900) % 900 - 80, c.c); }
    for (i = 0; i < deco.palm.length; i++) { var pm = deco.palm[i]; palmier(((pm.x - dist * 0.6) % 950 + 950) % 950 - 60, pm.h); }
    route();
    for (i = 0; i < parts.length; i++) { var p = parts[i]; ctx.fillStyle = "rgba(" + p.c + "," + (p.v * 0.6) + ")"; rond(p.x, p.y, p.r); }
    for (i = 0; i < bonus.length; i++) dessineBonus(bonus[i]);
    for (i = 0; i < obs.length; i++) dessineObs(obs[i]);
    var rebond = joueur.y >= SOL - TH ? Math.sin(t / 60) * 0.8 : 0;
    ctx.fillStyle = "rgba(0,0,0,.25)"; ctx.beginPath(); ctx.ellipse(joueur.x + TW / 2, SOL + 2, TW / 2 * (1 - (SOL - TH - joueur.y) / 400), 5, 0, 0, 6.3); ctx.fill();
    if (piment > 0) { ctx.fillStyle = "rgba(255,120,40,.25)"; rond(joueur.x + TW / 2, joueur.y + TH / 2, TW / 1.6); }
    camion(joueur.x, joueur.y + rebond, S, dist / 18, invinc > 0 && Math.floor(t / 90) % 2 === 0);
    guirlande();
    for (i = 0; i < 3; i++) coeur(24 + i * 26, 30, i < vies);
    texte(String(Math.floor(score)).padStart(5, "0"), W - 18, 46, 28, "#fff", "right");
    if (record) texte("Record " + record, W - 18, 70, 16, "#f5c518", "right");
    if (msg) texte(msg.s, W / 2, 110, 30, "#f5c518");
    if (etat === "menu") panneau("Bokit Run", "Touchez l'écran (ou Espace) pour sauter", "Double saut autorisé · attrape les bokits !");
    if (etat === "pause") panneau("Pause", "Touchez pour reprendre", "");
    if (etat === "fin") panneau("Oups, fin de la tournée !", "Score : " + score + (score >= record ? "  🏆 Nouveau record !" : "  · Record : " + record), "Touchez pour rejouer");
  }
  function panneau(a, b, c) {
    ctx.fillStyle = "rgba(26,18,13,.55)"; ctx.fillRect(0, 0, W, H);
    texte(a, W / 2, 130, W < 600 ? 34 : 44, "#f5c518"); texte(b, W / 2, 172, W < 600 ? 18 : 22); if (c) texte(c, W / 2, 204, 18, "#ffe0b2");
  }
  // reprise après pause : premier tap relance sans reset
  var sauterOrig = sauter;
  sauter = function () { if (etat === "pause") { etat = "jeu"; return; } sauterOrig(); };
  function boucle(t) {
    var dt = Math.min(0.033, (t - tprev) / 1000 || 0); tprev = t;
    maj(dt); rendu(t); requestAnimationFrame(boucle);
  }
  if (document.fonts && document.fonts.load) document.fonts.load('20px "Lilita One"').catch(function () {});
  requestAnimationFrame(boucle);
})();
