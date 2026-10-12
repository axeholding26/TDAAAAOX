// Service worker de la caisse AXSO (mode hors ligne, drapeau offline_pos).
//
// PORTÉE : enregistré avec scope = /dashboard/pos/caisse. Il ne contrôle que
// l'écran de caisse : ni la vitrine, ni le reste du tableau de bord.
//
// CE QU'IL GARDE
//   - la page de la caisse (HTML) : RÉSEAU D'ABORD — en ligne, toujours la
//     version du serveur ; sans réseau (ou après 5 s sans réponse), la dernière
//     page gardée, pour qu'un rechargement rouvre la caisse ;
//   - les fichiers statiques de la page (/_next/static : nommés par leur
//     contenu, donc immuables) : CACHE D'ABORD ;
//   - les images et polices du site (même origine) : cache, rafraîchi en fond.
// Jamais les appels /api (les données passent par IndexedDB, pas par ce cache),
// jamais une autre origine, jamais autre chose qu'un GET.
//
// MISES À JOUR — pas de vieille version bloquée : le navigateur revérifie ce
// fichier à chaque visite (updateViaCache: "none"), la nouvelle version
// s'installe et prend la main tout de suite (skipWaiting + clients.claim) et
// efface les caches des versions précédentes. La page venant toujours du réseau
// quand il répond, un déploiement est visible au premier rechargement en ligne.
// Les fichiers des anciens déploiements sortent du cache par ancienneté (MAX).
const VERSION = "v1";
const CACHE = `axso-pos-${VERSION}`;
const PORTEE = "/dashboard/pos/caisse";
const MAX = 300;
const STATIQUE = /\.(?:png|jpe?g|webp|svg|ico|gif|woff2?|ttf|mp3)$/;

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    for (const nom of await caches.keys()) if (nom.startsWith("axso-pos-") && nom !== CACHE) await caches.delete(nom);
    await self.clients.claim();
  })());
});

/** Garde une réponse saine, puis fait sortir les plus anciennes au-delà de MAX (put replace l'entrée en fin de liste : le cache est trié par dernier usage). */
async function garder(cle, reponse) {
  if (!reponse || !reponse.ok || reponse.type !== "basic" || reponse.redirected) return;
  const cache = await caches.open(CACHE);
  await cache.put(cle, reponse);
  const cles = await cache.keys();
  // La page de la caisse n'est jamais évincée.
  for (const ancienne of cles.slice(0, Math.max(0, cles.length - MAX))) if (new URL(ancienne.url).pathname !== PORTEE) await cache.delete(ancienne);
}

function avecDelai(promesse, ms) {
  return new Promise((ok, ko) => {
    const minuterie = setTimeout(() => ko(new Error("délai dépassé")), ms);
    promesse.then((r) => { clearTimeout(minuterie); ok(r); }, (e) => { clearTimeout(minuterie); ko(e); });
  });
}

const PAGE_SECOURS = `<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Caisse hors ligne</title>
<body style="font-family:system-ui,sans-serif;margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#F5F5F5;color:#111">
<main style="max-width:26rem;padding:1.5rem;text-align:center"><h1 style="font-size:1.1rem">Connexion interrompue</h1>
<p style="font-size:.9rem;line-height:1.5;color:#555">La caisse n'a pas encore été enregistrée sur cet appareil : elle doit être ouverte une première fois avec le réseau. Les ventes déjà saisies hors ligne restent sur cet appareil.</p>
<button onclick="location.reload()" style="min-height:44px;padding:0 1.25rem;border:0;border-radius:.75rem;background:#F5A623;font-weight:700;font-size:.9rem">Réessayer</button></main></body></html>`;

/** Page de la caisse : réseau d'abord, dernière page gardée sinon. */
async function page(requete) {
  const cache = await caches.open(CACHE);
  try {
    const reponse = await avecDelai(fetch(requete), 5000);
    if (reponse.ok && !reponse.redirected && reponse.type === "basic") await garder(PORTEE, reponse.clone());
    // Redirection (session expirée, accès retiré) : la page gardée n'est plus la bonne, on l'efface.
    else if (reponse.redirected || reponse.type === "opaqueredirect" || reponse.status === 401 || reponse.status === 403) await cache.delete(PORTEE);
    return reponse;
  } catch {
    return (await cache.match(PORTEE)) || new Response(PAGE_SECOURS, { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } });
  }
}

/** Fichier immuable : le cache d'abord (et on note son usage), le réseau sinon. */
async function immuable(e) {
  const cache = await caches.open(CACHE);
  const garde = await cache.match(e.request);
  if (garde) { e.waitUntil(cache.put(e.request, garde.clone()).catch(() => {})); return garde; }
  const reponse = await fetch(e.request);
  e.waitUntil(garder(e.request, reponse.clone()).catch(() => {}));
  return reponse;
}

/** Image ou police du site : le cache tout de suite, rafraîchi en fond. */
async function rafraichi(e) {
  const cache = await caches.open(CACHE);
  const garde = await cache.match(e.request);
  const reseau = fetch(e.request).then((r) => { e.waitUntil(garder(e.request, r.clone()).catch(() => {})); return r; });
  if (!garde) return reseau;
  e.waitUntil(reseau.catch(() => {}));
  return garde;
}

self.addEventListener("fetch", (e) => {
  const requete = e.request;
  if (requete.method !== "GET") return;
  const url = new URL(requete.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;
  if (requete.mode === "navigate") {
    // La caisse elle-même seulement (pas /dashboard/pos/caisse/… ni une autre page).
    if (url.pathname === PORTEE) e.respondWith(page(requete));
    return;
  }
  if (url.pathname.startsWith("/_next/static/")) e.respondWith(immuable(e));
  else if (STATIQUE.test(url.pathname) || url.pathname === "/_next/image") e.respondWith(rafraichi(e));
});

// La page, chargée avant que ce service worker ne la contrôle, lui dit quoi garder dès la première visite.
self.addEventListener("message", (e) => {
  const m = e.data || {};
  if (m.type !== "amorcer") return;
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    if (m.page === PORTEE) await fetch(PORTEE, { credentials: "same-origin" }).then((r) => garder(PORTEE, r)).catch(() => {});
    for (const u of Array.isArray(m.fichiers) ? m.fichiers.slice(0, MAX) : []) {
      if (typeof u !== "string" || !u.startsWith(self.location.origin + "/_next/static/") || (await cache.match(u))) continue;
      await fetch(u).then((r) => garder(u, r)).catch(() => {});
    }
  })());
});
