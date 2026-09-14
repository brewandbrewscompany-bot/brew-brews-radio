const CACHE='brew-brews-radio-regular-final-v4';
const APP_SHELL=[
  './',
  'index.html',
  'style.css',
  'radio-experience.css',
  'materials-polish.css',
  'photoreal-skin.css',
  'photoreal-final-polish.css',
  'player.js',
  'playlist.js',
  'photoreal-interaction.js',
  'manifest.json',
  'icon-192.png',
  'icon-512.png',
  'assets/regular-radio/radio-desktop-approved.avif',
  'assets/regular-radio/radio-mobile-approved.avif'
];
const NETWORK_FIRST=[
  'index.html',
  'style.css',
  'radio-experience.css',
  'materials-polish.css',
  'photoreal-skin.css',
  'photoreal-final-polish.css',
  'player.js',
  'playlist.js',
  'photoreal-interaction.js'
];
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(APP_SHELL)));
  self.skipWaiting();
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))));
  self.clients.claim();
});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET') return;
  const url=new URL(event.request.url);
  if(event.request.destination==='audio'){
    event.respondWith(fetch(event.request));
    return;
  }
  if(NETWORK_FIRST.some(name=>url.pathname.endsWith(name))){
    event.respondWith(
      fetch(event.request).then(response=>{
        const copy=response.clone();
        caches.open(CACHE).then(cache=>cache.put(event.request,copy));
        return response;
      }).catch(()=>caches.match(event.request))
    );
    return;
  }
  event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request)));
});