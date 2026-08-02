const CACHE="brew-brews-radio-v5.1.0";

const APP_SHELL=[
  "./",
  "index.html",
  "style.css",
  "player.js",
  "playlist.js",
  "manifest.json",
  "icon-192.png",
  "icon-512.png"
];

self.addEventListener("install",event=>{
  event.waitUntil(
    caches.open(CACHE).then(cache=>
      cache.addAll(APP_SHELL)
    )
  );

  self.skipWaiting();
});

self.addEventListener("activate",event=>{
  event.waitUntil(
    caches.keys().then(keys=>
      Promise.all(
        keys
          .filter(key=>key!==CACHE)
          .map(key=>caches.delete(key))
      )
    )
  );

  self.clients.claim();
});

self.addEventListener("fetch",event=>{
  if(event.request.method!=="GET")return;

  const url=new URL(event.request.url);

  const networkFirst=[
    "index.html",
    "style.css",
    "player.js",
    "playlist.js"
  ];

  if(
    networkFirst.some(name=>
      url.pathname.endsWith(name)
    )
  ){
    event.respondWith(
      fetch(event.request)
        .then(response=>{
          const copy=response.clone();

          caches.open(CACHE).then(cache=>
            cache.put(event.request,copy)
          );

          return response;
        })
        .catch(()=>caches.match(event.request))
    );

    return;
  }

  if(event.request.destination==="audio"){
    event.respondWith(fetch(event.request));
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached=>{
      if(cached)return cached;
      return fetch(event.request);
    })
  );
});
