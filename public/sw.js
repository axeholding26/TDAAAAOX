// Service worker des NOTIFICATIONS PUSH d'Axso (portée « / »). Il ne met rien en cache et ne
// touche à aucune requête : il reçoit les messages envoyés par lib/push.ts et les affiche comme
// une notification de l'appareil, même quand aucun onglet d'Axso n'est ouvert.
// (La caisse hors ligne a son propre service worker, sw-pos.js, limité à /dashboard/pos/caisse.)
//
// Son : celui des notifications du téléphone ou de l'ordinateur, au volume choisi par
// l'utilisateur (aucun site ne peut le forcer). `silent: false`, vibration longue et, pour les
// alertes urgentes (commande, inscription, course), notification qui reste affichée.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch { d = { message: event.data ? event.data.text() : "" }; }
  const titre = d.titre || "Axso";
  event.waitUntil(self.registration.showNotification(titre, {
    body: d.message || "",
    icon: "/icon.png",
    badge: "/icon.png",
    tag: d.tag || "axso",
    renotify: true,
    silent: false,
    requireInteraction: !!d.urgent,
    vibrate: d.urgent ? [400, 150, 400, 150, 400, 150, 800] : [250, 100, 250],
    timestamp: Date.now(),
    data: { lien: typeof d.lien === "string" && d.lien.startsWith("/") ? d.lien : "/" },
  }));
});

// Toucher la notification : ouvre (ou ramène au premier plan) la bonne page d'Axso.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const cible = new URL(event.notification.data?.lien || "/", self.location.origin).href;
  event.waitUntil((async () => {
    const fenetres = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const f of fenetres) {
      if (new URL(f.url).origin === self.location.origin && "focus" in f) {
        await f.focus();
        if ("navigate" in f) await f.navigate(cible).catch(() => {});
        return;
      }
    }
    await self.clients.openWindow(cible);
  })());
});
