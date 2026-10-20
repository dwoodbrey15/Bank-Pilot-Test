const VERSION='4.4.1',PREFIX='bank-pilot:'+self.registration.scope+':',CACHE=PREFIX+VERSION;
const CORE=['goal-engine.js','goal-data.json','multiplayer-policy.js','target-policy.js','solo-engine.js','solo-data.json','index.html','engine.js','neural.js','learning.js','trainer-worker.js','trainer-ui.js'],OPTIONAL=['manifest.webmanifest','icon.svg','icon-192.png','icon-512.png'];
const url=path=>new URL(path,self.registration.scope).href;
async function prepare(){const cache=await caches.open(CACHE);await Promise.all(CORE.map(async path=>{const response=await fetch(new Request(url(path),{cache:'reload'}));if(!response.ok)throw Error('Could not cache '+path);await cache.put(url(path),response);}));await Promise.all(OPTIONAL.map(async path=>{try{const response=await fetch(new Request(url(path),{cache:'reload'}));if(response.ok)await cache.put(url(path),response);}catch(e){}}));}
async function status(){const cache=await caches.open(CACHE),missing=[];for(const path of CORE)if(!await cache.match(url(path)))missing.push(path);return{version:VERSION,ready:missing.length===0,missing};}
self.addEventListener('install',event=>event.waitUntil(prepare().then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith(PREFIX)&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('message',event=>{if(!event.ports[0])return;event.waitUntil((async()=>{try{if(event.data?.type==='REPAIR')await prepare();event.ports[0].postMessage(await status());}catch(error){event.ports[0].postMessage({version:VERSION,ready:false,error:error.message});}})());});
self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;
 const target=new URL(event.request.url);if(!target.href.startsWith(self.registration.scope))return;
 event.respondWith((async()=>{const cache=await caches.open(CACHE);if(event.request.mode==='navigate'){const shell=await cache.match(url('index.html'));if(shell)return shell;return fetch(event.request);}
 const hit=await cache.match(event.request,{ignoreSearch:CORE.some(path=>target.pathname===new URL(url(path)).pathname)});if(hit)return hit;
 const response=await fetch(event.request);if(response.ok)await cache.put(event.request,response.clone());return response;})());
});
