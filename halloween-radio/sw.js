const VERSION='halloween-radio-pwa-v1';
const CORE=`${VERSION}-core`;
const RUNTIME=`${VERSION}-runtime`;
const CORE_ASSETS=[
  './','./index.html','./manifest.webmanifest','./offline.html',
  './assets/css/skin-radio.css','./assets/css/mode-controls.css','./assets/css/library-panels.css',
  './assets/js/skin-radio.js','./assets/js/radio-enhancements.js','./assets/js/mode-controls.js','./assets/js/library-panels.js','./assets/js/witch-ride-launcher.js','./assets/js/app-shell.js',
  './artwork/desktop-skin.webp','./artwork/phone-skin.webp',
  './data/tracks.json','./data/broadcasts.json',
  './assets/icons/halloween-radio-icon.svg'
];

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CORE).then(cache=>cache.addAll(CORE_ASSETS)).then(()=>self.skipWaiting()));
});

self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CORE&&k!==RUNTIME).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});

function isAudio(url,request){
  return request.destination==='audio'||url.pathname.includes('/halloween-radio/audio/')||/\.(mp3|m4a|aac|ogg|wav)$/i.test(url.pathname);
}

async function networkFirst(request,fallback){
  try{
    const response=await fetch(request);
    if(response&&response.ok){const cache=await caches.open(RUNTIME);cache.put(request,response.clone());}
    return response;
  }catch(err){
    const cached=await caches.match(request);
    if(cached)return cached;
    if(fallback){const fb=await caches.match(fallback);if(fb)return fb;}
    throw err;
  }
}

async function staleWhileRevalidate(request){
  const cached=await caches.match(request);
  const update=fetch(request).then(async response=>{
    if(response&&response.ok){const cache=await caches.open(RUNTIME);await cache.put(request,response.clone());}
    return response;
  }).catch(()=>null);
  return cached||update||Response.error();
}

self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET')return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin)return;

  // Music always streams. Never pre-cache or runtime-cache the song library.
  if(isAudio(url,request)){event.respondWith(fetch(request));return;}

  if(request.mode==='navigate'){
    event.respondWith(networkFirst(request,'./index.html').catch(()=>caches.match('./offline.html')));
    return;
  }

  // Witch Ride is deliberately lazy: nothing under the game path is pre-cached.
  if(url.pathname.includes('/halloween-radio/games/witch-ride-3d/')){
    event.respondWith(networkFirst(request));
    return;
  }

  const localPath=url.pathname;
  if(/\.(css|js|json|svg|webp|png|jpg|jpeg)$/i.test(localPath)){
    event.respondWith(staleWhileRevalidate(request));
  }
});
