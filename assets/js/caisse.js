/* Caisse Saveur Boucanée : panier, total TTC, TVA et rendu monnaie.
   Montants en CENTIMES (entiers) pour éviter les erreurs d'arrondi.
   Les prix du menu sont TTC ; la TVA est calculée « dont TVA », par taux. */
(function () {
  "use strict";
  var CAT = window.CATALOGUE || [], parId = {};
  CAT.forEach(function (a) { parId[a.id] = a; });
  var CLE = "sb-caisse-panier", libres = 0;
  var panier = charger(); // [{id, titre, prix, tva, qte}]

  /* ------------------------------------------------------------------
     PAIEMENTS : point d'extension prévu pour encaisser directement.
     Chaque mode reçoit la commande et renvoie une Promise :
       resolve({ ok: true, ref: "..." })  -> paiement accepté
       reject(Error)                      -> paiement refusé / annulé
     Pistes pour "carte" : SumUp (Payment Switch / SDK), Stripe Terminal,
     ou un TPE Bluetooth. Pour "lien" : afficher un QR code vers un lien
     de paiement (Stripe Payment Links, SumUp, Lydia Pro…) avec le total.
     Ces services demandent un compte marchand et, pour Stripe Terminal,
     un petit serveur (jeton de connexion) : rien de tout ça n'est actif ici.
     ------------------------------------------------------------------ */
  var PAIEMENTS = {
    especes: { encaisser: function () { return Promise.resolve({ ok: true, ref: "especes" }); } },
    carte:   { encaisser: function () { return Promise.reject(new Error("Paiement carte non configuré")); } },
    lien:    { encaisser: function () { return Promise.reject(new Error("Lien de paiement non configuré")); } }
  };
  window.SB_CAISSE = { PAIEMENTS: PAIEMENTS, commande: function () { return commande(); } };

  function $(s) { return document.querySelector(s); }
  function eur(c) { return (c / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" }); }
  function cents(txt) { var v = parseFloat(String(txt).replace(/\s|€/g, "").replace(",", ".")); return isNaN(v) ? NaN : Math.round(v * 100); }
  function charger() { try { return JSON.parse(localStorage.getItem(CLE)) || []; } catch (e) { return []; } }
  function sauver() { try { localStorage.setItem(CLE, JSON.stringify(panier)); } catch (e) {} }

  function ajouter(a) {
    var l = panier.filter(function (x) { return x.id === a.id; })[0];
    if (l) l.qte++; else panier.push({ id: a.id, titre: a.titre, prix: a.prix, tva: a.tva, qte: 1 });
    rendu();
    if (navigator.vibrate) navigator.vibrate(15);
  }
  function changer(id, d) {
    panier = panier.filter(function (x) { if (x.id === id) x.qte += d; return x.qte > 0; });
    rendu();
  }

  function commande() {
    var ttc = 0, parTaux = {};
    panier.forEach(function (l) {
      var t = l.prix * l.qte; ttc += t;
      parTaux[l.tva] = (parTaux[l.tva] || 0) + t;
    });
    var tva = {}, totalTva = 0;
    Object.keys(parTaux).forEach(function (k) {
      var base = parTaux[k], m = Math.round(base - base / (1 + k / 100));
      tva[k] = { base: base, montant: m }; totalTva += m;
    });
    return { lignes: panier.slice(), ttc: ttc, tva: tva, totalTva: totalTva, ht: ttc - totalTva, date: new Date().toISOString() };
  }

  function rendu() {
    sauver();
    var c = commande(), ul = $("#lignes"), nb = 0;
    ul.innerHTML = "";
    if (!panier.length) ul.innerHTML = '<li class="vide">Touchez un article pour l\'ajouter.</li>';
    panier.forEach(function (l) {
      nb += l.qte;
      var li = document.createElement("li");
      li.innerHTML = '<button type="button" class="m" aria-label="Retirer un">−</button><span class="q"></span><button type="button" class="p" aria-label="Ajouter un">+</button><span class="t"></span><b></b>';
      li.querySelector(".q").textContent = l.qte;
      li.querySelector(".t").textContent = l.titre;
      li.querySelector("b").textContent = eur(l.prix * l.qte);
      li.querySelector(".m").onclick = function () { changer(l.id, -1); };
      li.querySelector(".p").onclick = function () { changer(l.id, 1); };
      ul.appendChild(li);
    });
    $("#t-ht").textContent = eur(c.ht);
    $("#t-tva-detail").innerHTML = Object.keys(c.tva).sort().map(function (k) {
      return "<div><span>TVA " + String(k).replace(".", ",") + " %</span><span>" + eur(c.tva[k].montant) + "</span></div>";
    }).join("") || "<div><span>TVA</span><span>" + eur(0) + "</span></div>";
    $("#t-ttc").textContent = eur(c.ttc);
    $("#p-total-mini").textContent = eur(c.ttc);
    $("#p-nb").textContent = nb + (nb > 1 ? " articles" : " article");
    $("#encaisser").disabled = !panier.length;
    document.querySelectorAll(".tuile").forEach(function (b) {
      var l = panier.filter(function (x) { return x.id === b.dataset.id; })[0], q = b.querySelector(".qte");
      q.hidden = !l; if (l) q.textContent = l.qte;
    });
  }

  // tuiles & filtres
  document.querySelectorAll(".tuile").forEach(function (b) {
    b.addEventListener("click", function () { ajouter(parId[b.dataset.id]); b.classList.remove("pop"); void b.offsetWidth; b.classList.add("pop"); });
  });
  document.querySelectorAll(".filtres button").forEach(function (f) {
    f.addEventListener("click", function () {
      var c = f.dataset.cat;
      if (c === "libre") { $("#l-prix").value = ""; $("#d-libre").showModal(); $("#l-prix").focus(); return; }
      document.querySelectorAll(".filtres button").forEach(function (x) { x.classList.toggle("on", x === f); });
      document.querySelectorAll(".tuile").forEach(function (t) { t.hidden = c !== "*" && t.dataset.cat !== c; });
    });
  });
  $("#l-ok").addEventListener("click", function () {
    var p = cents($("#l-prix").value);
    if (!(p > 0)) { $("#l-prix").focus(); return; }
    libres++;
    ajouter({ id: "libre-" + Date.now() + "-" + libres, titre: $("#l-nom").value || "Divers", prix: p, tva: parseFloat($("#l-tva").value) });
    $("#d-libre").close();
  });

  $("#vider").addEventListener("click", function () { if (!panier.length || confirm("Vider la commande ?")) { panier = []; rendu(); } });
  $("#poignee").addEventListener("click", function () {
    var o = $("#panier").classList.toggle("ouvert"); this.setAttribute("aria-expanded", o);
  });

  // encaissement
  var mode = null, dlg = $("#d-paiement");
  $("#encaisser").addEventListener("click", function () {
    mode = null;
    $("#m-total").textContent = eur(commande().ttc);
    $("#m-especes").hidden = true; $("#m-recu").value = ""; $("#m-rendu").textContent = "–";
    $("#m-valider").disabled = true;
    dlg.querySelectorAll(".mode").forEach(function (m) { m.classList.remove("on"); });
    dlg.showModal();
  });
  dlg.querySelectorAll(".mode").forEach(function (m) {
    m.addEventListener("click", function () {
      mode = m.dataset.mode;
      dlg.querySelectorAll(".mode").forEach(function (x) { x.classList.toggle("on", x === m); });
      $("#m-especes").hidden = mode !== "especes";
      majRendu();
    });
  });
  function majRendu() {
    var total = commande().ttc, r = cents($("#m-recu").value);
    if (mode !== "especes") { $("#m-valider").disabled = !mode; return; }
    if (isNaN(r)) { $("#m-rendu").textContent = "–"; $("#m-valider").disabled = true; return; }
    var diff = r - total;
    $("#m-rendu").textContent = diff >= 0 ? eur(diff) : "manque " + eur(-diff);
    $("#m-rendu").className = diff >= 0 ? "" : "manque";
    $("#m-valider").disabled = diff < 0;
  }
  $("#m-recu").addEventListener("input", majRendu);
  dlg.querySelectorAll(".billets button").forEach(function (b) {
    b.addEventListener("click", function () {
      var v = b.dataset.v === "exact" ? commande().ttc : (cents($("#m-recu").value) || 0) + (+b.dataset.v);
      $("#m-recu").value = (v / 100).toFixed(2).replace(".", ",");
      majRendu();
    });
  });
  $("#m-valider").addEventListener("click", function () {
    var bouton = this; bouton.disabled = true;
    PAIEMENTS[mode].encaisser(commande()).then(function () {
      panier = []; rendu(); dlg.close(); $("#panier").classList.remove("ouvert");
    }).catch(function (e) { alert(e.message); bouton.disabled = false; });
  });

  rendu();
})();
