/* Service worker : le site reste consultable (et le jeu jouable) sans réseau.
   Pages : réseau d'abord (planning frais), cache si pas de réseau ou réseau trop lent.
   Images / polices : cache d'abord. */
var V="sb-{{ now.Unix }}",BASE="{{ "" | relURL }}";
var PRE=[BASE,BASE+"jeu/",BASE+"menu/",BASE+"ou-nous-trouver/",BASE+"fonts/lilita-one-latin.woff2"];
self.addEventListener("install",function(e){self.skipWaiting();e.waitUntil(caches.open(V).then(function(c){return c.addAll(PRE)}).catch(function(){}))});
self.addEventListener("activate",function(e){e.waitUntil(caches.keys().then(function(k){return Promise.all(k.filter(function(n){return n!==V}).map(function(n){return caches.delete(n)}))}).then(function(){return self.clients.claim()}))});
self.addEventListener("fetch",function(e){
  var r=e.request;if(r.method!=="GET"||new URL(r.url).origin!==location.origin)return;
  if(r.mode==="navigate"){
    e.respondWith(new Promise(function(ok){
      var fini=false,t=setTimeout(function(){caches.match(r).then(function(c){if(c&&!fini){fini=true;ok(c)}})},4000);
      fetch(r).then(function(res){var cp=res.clone();caches.open(V).then(function(c){c.put(r,cp)});if(!fini){fini=true;clearTimeout(t);ok(res)}})
      .catch(function(){caches.match(r).then(function(c){return c||caches.match(BASE+"jeu/")||caches.match(BASE)}).then(function(c){if(!fini){fini=true;ok(c||Response.error())}})});
    }));return;
  }
  e.respondWith(caches.match(r).then(function(c){return c||fetch(r).then(function(res){if(res.ok){var cp=res.clone();caches.open(V).then(function(ca){ca.put(r,cp)})}return res})}));
});
