'use strict';
// v35 browser check: starting mid-passage (Al-Hashr 9, as in the user's report)
// reveals everything before the start as context without credit; Warsh tajweed
// colours are drawn without changing word text; toggling tajweed keeps the page.
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
const root=path.join(__dirname,'../dist');
const server=http.createServer((req,res)=>{const p=decodeURIComponent(new URL(req.url,'http://l').pathname),f=path.join(root,p==='/'?'index.html':p);try{const d=fs.readFileSync(f);res.writeHead(200,{'Content-Type':({'.js':'text/javascript','.css':'text/css','.html':'text/html','.json':'application/json','.ttf':'font/ttf'})[path.extname(f)]||'application/octet-stream'});res.end(d)}catch{res.writeHead(404);res.end()}});
const inject=()=>{try{localStorage.setItem('athman-riwaya-chosen','1')}catch{}window.__recognitions=[];class R{constructor(){window.__recognitions.push(this);this.results=[]}start(){this.onstart?.();this.onaudiostart?.()}stop(){this.onend?.()}abort(){}send(t,f=false,i=0){this.results[i]=Object.assign([{transcript:t,confidence:.92}],{isFinal:f});this.results.length=i+1;this.onresult?.({results:this.results,resultIndex:i})}}window.SpeechRecognition=R;window.webkitSpeechRecognition=undefined};
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true,executablePath:process.env.ATHMAN_CHROMIUM||undefined,args:['--no-sandbox']});
 try{
  const ctx=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});await ctx.addInitScript(inject);
  const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url+'/');await page.waitForFunction(()=>typeof openSurah==='function');
  await page.evaluate(()=>openSurah(59));await page.waitForSelector('#readerDialog[open] #recitationPage .verse');
  const texts=await page.evaluate(()=>[...document.querySelectorAll('#recitationPage .recitation-word')].slice(0,300).map(w=>w.textContent));
  assert(await page.locator('#recitationPage .tj').count()>100,'tajweed spans drawn');
  assert(await page.evaluate(()=>document.querySelector('#recitationMount').classList.contains('tajweed-on')));
  await page.locator('#recitationListen').click();
  await page.evaluate(()=>window.__recognitions.at(-1).send('على أنفسهم ولو كان بهم خصاصة ومن يوق شح نفسه فأولئك هم المفلحون',true,0));
  await page.waitForTimeout(200);
  const state=await page.evaluate(()=>({context:[...document.querySelectorAll('.verse.is-context-verse')].map(v=>+v.dataset.aya),words:[...document.querySelectorAll('.verse[data-aya="9"] .recitation-word')].map(w=>w.className),progress:document.getElementById('recitationProgress').textContent}));
  assert.deepEqual(state.context,[1,2,3,4,5,6,7,8],'ayahs before the start are context');
  assert(state.words.slice(0,5).every(c=>c.includes('is-context')&&!c.includes('is-verified')),'earlier words of the starting ayah are context, not credited');
  assert(state.words.at(-1).includes('is-verified'));
  assert.equal(await page.evaluate(()=>document.querySelectorAll('.is-error,.is-uncertain').length),0);
  await page.locator('#recitationListen').click();
  // Toggle tajweed off and on: same words, same text.
  await page.locator('#recitationSettings').click();await page.locator('[data-settings-tab="display"]').click();
  await page.locator('label:has(#recitationTajweed)').click();assert.equal(await page.locator('#recitationPage .tj').count(),0);
  await page.locator('label:has(#recitationTajweed)').click();assert(await page.locator('#recitationPage .tj').count()>100);
  assert.deepEqual(await page.evaluate(()=>[...document.querySelectorAll('#recitationPage .recitation-word')].slice(0,300).map(w=>w.textContent)),texts);
  assert.deepEqual(errors,[]);
  console.log('PASS: mid-passage start reveals earlier ayahs as uncredited context; tajweed colours drawn and toggled without changing text.');
 }finally{await browser.close();server.close()}
})().catch(e=>{console.error(e);process.exit(1)});
