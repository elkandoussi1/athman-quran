'use strict';
const APP_SCOPE=new URL(self.registration.scope);
// A project may share a github.io origin with other apps: isolate this app's cache.
const CACHE_PREFIX='athman:'+encodeURIComponent(APP_SCOPE.pathname)+':';
const CACHE=CACHE_PREFIX+'v32';
const FILES=['./','index.html','support.html','assets/support.css','assets/support.js','assets/style.css','assets/responsive.css','assets/theme.css','assets/index-cards.css','assets/index-cards.css?v=32','assets/recitation.css','assets/recitation.js','assets/recitation-ui.js','assets/recitation-audio.js','assets/recitation-matcher.js','assets/recitation-matcher.js?v=31','assets/recitation-diagnostics.js','assets/recitation-diagnostics.js?v=31','assets/recitation-capture.js','assets/recitation-capture.js?v=31','assets/recitation-remote.js','assets/recitation-remote.js?v=31','assets/recitation-worklet.js','assets/recitation-worklet.js?v=31','assets/recitation-audio.js?v=31','assets/recitation.css?v=31','assets/study.js','assets/study.css','assets/app.js','assets/app.js?v=32','assets/recitation.js?v=31','assets/recitation-ui.js?v=31','assets/pwa.js','assets/data.js','assets/divisions.js','assets/quran.json','assets/fonts.css','assets/ui-font-0.ttf','assets/ui-font-1.ttf','assets/ui-font-2.ttf','assets/ui-font-3.ttf','assets/warsh.ttf','assets/icon.svg','assets/icon-192.png','assets/icon-512.png','assets/icon-maskable-512.png','assets/apple-touch-icon.png','manifest.webmanifest'];
const appURL=path=>new URL(path,APP_SCOPE).href;
self.addEventListener('install',event=>{
 event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES.map(path=>new Request(appURL(path),{cache:'reload'})))).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
 event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith(CACHE_PREFIX)&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==APP_SCOPE.origin||!url.pathname.startsWith(APP_SCOPE.pathname))return;
 event.respondWith((async()=>{
  const cache=await caches.open(CACHE);
  try{
   const response=await fetch(request,{cache:'no-cache'});
   if(response.ok&&!response.redirected){try{await cache.put(request,response.clone())}catch{/* Reading still works if device storage is full. */}}
   return response;
  }catch{
   const cached=await cache.match(request);if(cached)return cached;
   if(request.mode==='navigate')return await cache.match(appURL('index.html'))||await cache.match(APP_SCOPE.href)||Response.error();
   return Response.error();
  }
 })());
});
