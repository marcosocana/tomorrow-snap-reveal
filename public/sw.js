// Service worker de retirada.
//
// La app ya no registra ningún service worker (ver src/main.tsx), pero los
// dispositivos que instalaron la versión antigua —que servía `/` e
// `/index.html` desde caché sin actualizarlos nunca— siguen controlados por
// ella y reciben un index.html obsoleto que apunta a ficheros que ya no existen.
//
// El navegador vuelve a pedir este fichero en cada visita (Cache-Control
// max-age=0 en vercel.json); al ver que ha cambiado instala esta versión, que
// borra las cachés, se desregistra y recarga las pestañas abiertas para que
// carguen la app actual directamente desde la red.
//
// No tiene manejador de `fetch` a propósito: nunca intercepta peticiones.

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
      await self.registration.unregister();
      const windows = await self.clients.matchAll({ type: 'window' });
      await Promise.all(
        windows.map((client) => client.navigate(client.url).catch(() => undefined))
      );
    })()
  );
});
