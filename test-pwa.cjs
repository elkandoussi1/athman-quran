'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const base='https://example.github.io/athman-quran/';
const manifest=JSON.parse(fs.readFileSync('dist/manifest.webmanifest','utf8'));
assert.equal(manifest.display,'standalone');assert.equal(manifest.id,'./');
assert.equal(new URL(manifest.start_url,new URL('manifest.webmanifest',base)).href,base);
assert.equal(new URL(manifest.scope,new URL('manifest.webmanifest',base)).href,base);
for(const size of [192,512])assert(manifest.icons.some(icon=>icon.sizes===`${size}x${size}`&&icon.type==='image/png'));
for(const icon of manifest.icons){
 const file=fs.readFileSync(path.join('dist',icon.src));
 assert.equal(file.subarray(1,4).toString(),'PNG');
 assert.equal(file.readUInt32BE(16),Number(icon.sizes.split('x')[0]));
 assert.equal(file.readUInt32BE(20),Number(icon.sizes.split('x')[1]));
}
const html=fs.readFileSync('dist/index.html','utf8');
for(const match of html.matchAll(/(?:src|href)="([^"]+)"/g)){
 const url=match[1];if(url.startsWith('#')||/^https?:/.test(url))continue;
 assert(!url.startsWith('/'),`Root-relative path breaks project Pages: ${url}`);
 const local=new URL(url,base).pathname.slice(new URL(base).pathname.length);
 assert(fs.existsSync(path.join('dist',local)),`Missing local resource: ${url}`);
 assert(new URL(url,base).pathname.startsWith('/athman-quran/'));
}
const listeners={},stores=new Map();let online=true;
const keyOf=input=>typeof input==='string'?input:input.url;
const caches={
 async open(name){
  if(!stores.has(name))stores.set(name,new Map());const data=stores.get(name);
  return {
   async addAll(urls){for(const input of urls){assert.equal(input.cache,'reload','New app versions must bypass stale HTTP assets');const url=keyOf(input);assert(url.startsWith(base));let rel=new URL(url).pathname.slice(new URL(base).pathname.length)||'index.html';const file=path.join('dist',rel);assert(fs.existsSync(file),`Missing offline asset ${rel}`);data.set(url,new Response(fs.readFileSync(file)))}},
   async match(input){return data.get(keyOf(input))?.clone()},
   async put(input,response){data.set(keyOf(input),response.clone())}
  };
 },
 async keys(){return [...stores.keys()]},async delete(name){return stores.delete(name)}
};
const self={registration:{scope:base},addEventListener:(name,fn)=>listeners[name]=fn,skipWaiting:async()=>{},clients:{claim:async()=>{}}};
vm.runInNewContext(fs.readFileSync('dist/sw.js','utf8'),{self,caches,URL,Request,Response,fetch:async(request,options)=>{assert.equal(options?.cache,'no-cache','Online requests must revalidate the browser HTTP cache');if(!online)throw Error('Offline');return new Response('network response',{status:200})}});
function lifecycle(name){let result;listeners[name]({waitUntil:promise=>result=promise});return result}
function request(url,mode='same-origin',method='GET'){
 let response;listeners.fetch({request:{url,mode,method},respondWith:promise=>response=promise});return response;
}
(async()=>{
 await lifecycle('install');const name=(await caches.keys())[0];
 stores.set(name.replace(/v\d+$/,'v0'),new Map());stores.set('other-app-cache',new Map());
 await lifecycle('activate');assert(stores.has(name));assert(stores.has('other-app-cache'));assert(!stores.has(name.replace(/v\d+$/,'v0')));
 assert.equal(request('https://example.github.io/another-project/'),undefined);
 assert.equal(request('https://another-origin.test/file.js'),undefined);
 assert.equal(request(base+'file','same-origin','POST'),undefined);
 assert.equal(await (await request(base+'health')).text(),'network response');
 online=false;
 const text=await (await request(base+'assets/quran.json')).json();assert.equal(text.length,6214);
 assert((await (await request(base+'offline-route','navigate')).text()).includes('أثمان'));
 assert.equal(await (await request(base+'health')).text(),'network response');
 for(const name of ['recitation.js','recitation-ui.js','app.js']){const url=`assets/${name}?v=27`;assert(html.includes(url));assert.equal(await (await request(base+url)).text(),fs.readFileSync('dist/assets/'+name,'utf8'),'Versioned startup scripts must remain available offline');}
 console.log('PASS: installable manifest and PNG sizes; project-relative assets; complete offline Quran; navigation fallback; cache isolation from other GitHub Pages projects.');
})().catch(error=>{console.error(error);process.exitCode=1});
