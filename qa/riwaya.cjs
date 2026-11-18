'use strict';
// v36 browser check: first-visit riwaya chooser, switching Warsh ⇄ Hafs, Hafs
// index (240 quarters, 4 per hizb, no eighths), reader text/font/basmala,
// Hafs recitation, and progress kept separately for each riwaya.
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
const root=path.join(__dirname,'../dist');
const server=http.createServer((req,res)=>{const p=decodeURIComponent(new URL(req.url,'http://l').pathname),f=path.join(root,p==='/'?'index.html':p);try{const d=fs.readFileSync(f);res.writeHead(200,{'Content-Type':({'.js':'text/javascript','.css':'text/css','.html':'text/html','.json':'application/json','.ttf':'font/ttf'})[path.extname(f)]||'application/octet-stream'});res.end(d)}catch{res.writeHead(404);res.end()}});
const inject=()=>{window.__recognitions=[];class R{constructor(){window.__recognitions.push(this);this.results=[]}start(){this.onstart?.();this.onaudiostart?.()}stop(){this.onend?.()}abort(){}send(t,f=false,i=0){this.results[i]=Object.assign([{transcript:t,confidence:.92}],{isFinal:f});this.results.length=i+1;this.onresult?.({results:this.results,resultIndex:i})}}window.SpeechRecognition=R;window.webkitSpeechRecognition=undefined};
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true,executablePath:process.env.ATHMAN_CHROMIUM||undefined,args:['--no-sandbox']});
 try{
  const ctx=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});await ctx.addInitScript(inject);
  const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url+'/');await page.waitForSelector('#riwayaDialog[open]');
  assert.equal(await page.evaluate(()=>ATHMAN_RIWAYA.id),'warsh','Warsh stays the default');
  assert.equal(await page.locator('[data-riwaya-option]').count(),2);
  // Warsh progress, then switch to Hafs from the chooser.
  await page.locator('[data-riwaya-close]').first().click();
  await page.evaluate(()=>localStorage.setItem('athman-completed','[1,2,3]'));
  await page.locator('.topbar .riwaya-chip').click();await page.locator('[data-riwaya-option="hafs"]').click();
  await Promise.all([page.waitForEvent('load'),page.locator('[data-riwaya-confirm]').click()]);
  await page.waitForFunction(()=>typeof openSurah==='function');
  const info=await page.evaluate(()=>({id:ATHMAN_RIWAYA.id,dataset:document.documentElement.dataset.riwaya,units:QURAN_DATA.eighths.length,per:QURAN_DATA.unitsPerHizb,halves:QURAN_DATA.halves.length,completed:localStorage.getItem('athman-completed'),font:getComputedStyle(document.documentElement).getPropertyValue('--quran-font').trim(),chosen:!!document.querySelector('#riwayaDialog[open]')}));
  assert.deepEqual(info,{id:'hafs',dataset:'hafs',units:240,per:4,halves:120,completed:null,font:'HafsUthmani',chosen:false});
  // Index: no eighths, quarters route maps to the base unit.
  assert.equal(await page.locator('.browse-sections a[href="#/quarters"]').count(),0);
  await page.goto(url+'/#/quarters');await page.waitForFunction(()=>location.hash==='#/eighths');
  assert.match(await page.locator('h1').first().textContent(),/الأرباع/);
  await page.goto(url+'/#/hizb/3');await page.waitForSelector('#detailParts .eighth-card');
  assert.equal(await page.locator('#detailParts .eighth-card').count(),4);
  // Reader: Al-Fatiha has the basmala as ayah 1, no extra basmala header.
  await page.evaluate(()=>openSurah(1));await page.waitForSelector('#recitationPage .verse');
  assert.equal(await page.locator('#recitationPage .basmala').count(),0);
  assert.equal(await page.locator('#recitationPage .verse').count(),7);
  assert.match(await page.locator('#recitationMeta').textContent(),/^حفص/);
  await page.locator('#recitationListen').click();
  await page.evaluate(()=>window.__recognitions.at(-1).send('بسم الله الرحمن الرحيم الحمد لله رب العالمين',true,0));await page.waitForTimeout(150);
  assert.equal(await page.locator('#recitationPage .recitation-word.is-verified').count(),8);
  assert.equal(await page.locator('#recitationPage .is-error,#recitationPage .is-uncertain').count(),0);
  await page.locator('#recitationListen').click();
  // Settings: the Mushaf tab names the riwaya and offers to change it; Hafs tajweed legend.
  await page.locator('#recitationSettings').click();await page.locator('[data-settings-tab="display"]').click();
  assert.match(await page.locator('.settings-riwaya-name b').textContent(),/حفص عن عاصم/);
  assert(await page.locator('.tj-legend .tj-munfasil').count()===1,'Hafs legend lists munfasil separately');
  // Hafs progress is separate; switching back restores Warsh progress.
  await page.evaluate(()=>localStorage.setItem('athman-completed','[7]'));
  await page.locator('.settings-riwaya-change').click();await page.locator('[data-riwaya-option="warsh"]').click();
  await Promise.all([page.waitForEvent('load'),page.locator('[data-riwaya-confirm]').click()]);
  await page.waitForFunction(()=>typeof openSurah==='function');
  assert.deepEqual(await page.evaluate(()=>[ATHMAN_RIWAYA.id,QURAN_DATA.eighths.length,localStorage.getItem('athman-completed'),localStorage.getItem('athman-hafs:completed')]),['warsh',480,'[1,2,3]','[7]']);
  assert.deepEqual(errors,[]);
  console.log('PASS: first-visit chooser; Warsh ⇄ Hafs switching; Hafs index (240 quarters, 4 per hizb); Hafs reader and recitation; separate progress per riwaya.');
 }finally{await browser.close();server.close()}
})().catch(e=>{console.error(e);process.exit(1)});
