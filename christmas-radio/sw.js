const CACHE_PREFIX='bb-christmas-radio-shell-';
const CACHE_NAME=`${CACHE_PREFIX}phase10-1-v1`;
const SHELL=[
  './','./index.html','./manifest.webmanifest','./favicon.svg',
  './assets/css/christmas-radio.css','./assets/css/art-skin.css','./assets/css/stations.css',
  './assets/js/christmas-radio.js','./assets/js/audio-engine.js',
  './artwork/christmas-radio-approved-skin.avif',
  './data/stations.json','./data/tracks.json'
];

const isAudio=url=>url.pathname.includes('/audio/')||/\.(?:mp3|m4a|aac|ogg|wav|flac)(?:$|\?)/i.test(url.pathname+url.search);

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting()));
});

self.addEventListener('activate',event=>{
  event.waitUntil(Promise.all([
    caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith(CACHE_PREFIX)&&key!==CACHE_NAME).map(key=>caches.delete(key)))),
    self.clients.claim()
  ]));
});

self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET'||request.headers.has('range'))return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin||isAudio(url))return;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE_NAME);
    const cached=await cache.match(request);
    if(cached)return cached;
    try{
      const response=await fetch(request);
      if(response.ok&&response.type!=='opaque')event.waitUntil(cache.put(request,response.clone()));
      return response;
    }catch(error){
      if(request.mode==='navigate'){
        const fallback=await cache.match('./');
        if(fallback)return fallback;
      }
      throw error;
    }
  })());
});
