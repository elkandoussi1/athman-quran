'use strict';
// Browser regression suite. Uses synthetic recognition events, not a real ASR
// or a human reciter. Run with Playwright and ATHMAN_CHROMIUM if needed.
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
const {Corpus}=require('../dist/assets/recitation.js'),q=require('../dist/assets/quran.json');
const c=new Corpus(q.map(([sura,aya,text])=>({sura,aya,text}))),at=(s,a,w=0)=>c.position(s,a,w);
const server=http.createServer((req,res)=>{const pathname=decodeURIComponent(new URL(req.url,'http://local').pathname),file=path.join(__dirname,'../dist',pathname==='/'?'index.html':pathname);try{const data=fs.readFileSync(file),ext=path.extname(file);res.writeHead(200,{'Content-Type':({'.js':'text/javascript','.css':'text/css','.html':'text/html','.json':'application/json','.ttf':'font/ttf'})[ext]||'application/octet-stream'});res.end(data)}catch{res.writeHead(404);res.end()}});
const inject=()=>{
 window.__recognitions=[];window.__openings=[];window.__legacyFrames=0;
 class Recognition{
  constructor(){window.__recognitions.push(this);this.results=[]}
  start(){this.onstart?.();this.onaudiostart?.()}
  stop(){this.onend?.()}
  abort(){}
  send(text,isFinal=false,index=0){this.results[index]=Object.assign([{transcript:text,confidence:.92}],{isFinal});this.results.length=index+1;this.onresult?.({results:this.results,resultIndex:index})}
 }
 window.SpeechRecognition=Recognition;window.webkitSpeechRecognition=undefined;
 const show=HTMLDialogElement.prototype.showModal;
 HTMLDialogElement.prototype.showModal=function(){if(this.id==='readerDialog')window.__openings.push({modern:this.classList.contains('recitation-reader'),words:this.querySelectorAll('.recitation-word').length,loading:!!this.querySelector('.reader-loading')});return show.call(this)};
 const check=()=>{const dialog=document.getElementById('readerDialog');if(dialog?.open&&!dialog.classList.contains('recitation-reader'))window.__legacyFrames++;requestAnimationFrame(check)};requestAnimationFrame(check);
};
const frame=page=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
const send=(page,text,final=false,index=0)=>page.evaluate(({text,final,index})=>window.__recognitions.at(-1).send(text,final,index),{text,final,index});
const openSurah=(page,id)=>page.evaluate(id=>openSurah(id),id);
const start=async page=>{await page.locator('#recitationListen').click();assert.equal(await page.locator('#recitationListen').getAttribute('aria-pressed'),'true')};
async function run(){
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
 const args=['--no-sandbox','--disable-dev-shm-usage'];
 if(process.env.ATHMAN_SPARTICUZ){const x=require(process.env.ATHMAN_SPARTICUZ).default;args.push(...x.args.filter(a=>a!=='--single-process'))}
 const browser=await chromium.launch({headless:true,executablePath:process.env.ATHMAN_CHROMIUM||undefined,args});
 try{
  const context=await browser.newContext({viewport:{width:1380,height:768},serviceWorkers:'block'});await context.addInitScript(inject);
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));let release;
  const gate=new Promise(r=>release=r);
  await page.route('**/assets/quran.json',async route=>{await gate;await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(q)})});
  await page.goto(url+'/#/eighths',{waitUntil:'domcontentloaded'});
  await page.locator('[data-open-kind="eighth"][data-part-id="1"]').first().click();
  assert.equal(await page.locator('#readerDialog').getAttribute('open'),null,'slow first fetch must never open the old reader');
  assert.equal(await page.locator('#main').getAttribute('aria-busy'),'true');
  await page.locator('[data-open-kind="eighth"][data-part-id="2"]').first().click();release();
  await page.waitForSelector('#readerDialog[open].recitation-reader #recitationPage');await frame(page);
  assert((await page.evaluate(()=>location.hash)).includes('thumn=2'),'latest reading request wins');
  assert.deepEqual(await page.evaluate(()=>window.__openings.map(x=>x.modern&&x.words>0&&!x.loading)),[true]);
  console.log('PASS: cold delayed fetch, racing selections and atomic first modern dialog');
  for(const [kind,list] of [['eighth','eighths'],['quarter','quarters'],['half','halves']]){
   for(const id of [1,2])await page.evaluate(({kind,id})=>openPart(kind,id),{kind,id});
  }
  for(const id of [1,29,112])await openSurah(page,id);
  await frame(page);assert.equal(await page.evaluate(()=>window.__legacyFrames),0);
  for(const [width,height] of [[1380,768],[390,844],[320,568],[844,390]]){
   await page.setViewportSize({width,height});await frame(page);
   const layout=await page.evaluate(()=>{const rect=id=>document.getElementById(id).getBoundingClientRect(),header=document.querySelector('.recitation-header').getBoundingClientRect(),scroll=rect('recitationPageScroll'),dock=document.querySelector('.recitation-dock').getBoundingClientRect();return {header:header.bottom,top:scroll.top,bottom:scroll.bottom,dock:dock.top,readHeight:scroll.height,scopeInSettings:!!document.getElementById('recitationQuickMode').closest('#recitationSettingsPanel'),statusInSettings:!!document.getElementById('recitationConnectionStatus').closest('#recitationSettingsPanel'),overflow:document.querySelector('.recitation-panel').scrollWidth>innerWidth,bodyOverflow:document.body.scrollWidth>innerWidth}});
   assert(Math.abs(layout.top-layout.header)<2);assert(Math.abs(layout.bottom-layout.dock)<2);assert(layout.readHeight/height>.65);assert(layout.scopeInSettings&&layout.statusInSettings);assert(!layout.overflow&&!layout.bodyOverflow,JSON.stringify(layout));
  }
  await page.setViewportSize({width:390,height:844});await page.locator('#recitationAudioStatus').click();await page.waitForSelector('#recitationSettingsPanel:not([hidden])');assert(await page.locator('#recitationConnectionStatus').isVisible());await page.locator('#recitationSettingsClose').click();
  console.log('PASS: no scope/status rows consume the canvas on desktop, mobile and landscape; status stays accessible');
  await openSurah(page,29);await start(page);await send(page,'ألف لام ميم');await frame(page);
  assert(await page.locator('.recitation-word').first().evaluate(el=>!el.classList.contains('is-concealed')),'first received word is visible without global acquisition');
  await page.locator('#recitationListen').click();
  // Direct opening of the photographed passage, then 120 successive 3-word
  // rolling interim windows. No final results are supplied in this phase.
  await page.evaluate(()=>openPart('eighth',QURAN_DATA.eighths.find(e=>e.sura===29&&e.aya<=46&&e.endSura===29&&e.endAya>=46).id));
  const partStart=await page.locator('#readerText .verse').first().evaluate(el=>({sura:Number(el.dataset.sura),aya:Number(el.dataset.aya),word:Number(el.dataset.startWord)}));
  const startAt=at(partStart.sura,partStart.aya,partStart.word),words=c.words.slice(startAt,startAt+120).map(w=>w.forms[0]);
  await start(page);
  await page.evaluate(words=>{const rec=window.__recognitions.at(-1);for(let n=3;n<=words.length;n++)rec.send(words.slice(n-3,n).join(' '))},words);await frame(page);
  const end=c.reference(startAt+119);
  const last=page.locator(`#recitationPage .verse[data-sura="${end.sura}"][data-aya="${end.aya}"] .recitation-word`).filter({hasText:c.words[startAt+119].raw});
  assert(await last.first().evaluate(el=>!el.classList.contains('is-concealed')),'rolling service must not leave the page stalled');
  assert.equal(await page.locator('.recitation-word.is-verified').count(),0,'interims never become final credit');
  await send(page,words.slice(-3).join(' '),true);await frame(page);assert.equal(await page.locator('.recitation-word.is-verified').count(),3);
  assert.equal(await page.locator('.recitation-word.is-error').count(),0);
  console.log('PASS: immediate page anchor; 120 rolling interim words across passages; final credits only its last actual window');
  await openSurah(page,112);await start(page);for(let n=0;n<3;n++)await send(page,'شيء',true);await frame(page);
  assert.equal(await page.locator('.recitation-word.is-error').count(),0);assert((await page.locator('#recitationAttempts').textContent()).includes('1 / 3'));
  console.log('PASS: replaying identical final events cannot create false red errors');
  // Long-surah performance: a burst commits several verses before its frame.
  // Already-settled unrelated words must not receive per-result attribute writes.
  await page.setViewportSize({width:1380,height:768});await openSurah(page,2);await start(page);
  await page.evaluate(()=>{window.__farWrites=0;const far=document.querySelectorAll('#recitationPage .recitation-word')[3000];for(const name of ['setAttribute','removeAttribute']){const original=Element.prototype[name];Element.prototype[name]=function(...args){if(this===far)window.__farWrites++;return original.apply(this,args)}}});
  const first=c.words.slice(at(2,1),at(2,1)+80).map(w=>w.forms[0]);
  await page.evaluate(words=>{const rec=window.__recognitions.at(-1);for(let n=0;n<words.length;n++)rec.send(words[n],true,n)},first);await frame(page);
  assert.equal(await page.locator('#recitationPage .recitation-word.is-verified').count(),80,'all dirty verses in a result burst must paint');
  assert.equal(await page.evaluate(()=>window.__farWrites),0,'no all-surah accessibility scan on each word');
  await page.locator('#recitationListen').click();
  await openSurah(page,2);await start(page);
  const rolling=c.words.slice(at(2,1),at(2,1)+120).map(w=>w.forms[0]);
  await page.evaluate(words=>{const rec=window.__recognitions.at(-1);for(let n=3;n<=words.length;n++)rec.send(words.slice(n-3,n).join(' '))},rolling);await frame(page);
  assert.equal(await page.locator('#recitationPage .recitation-word:not(.is-concealed)').count(),120,'coalesced rolling events must paint retained provisional words too');
  await page.locator('#recitationListen').click();
  await page.locator('#recitationSettings').click();await page.selectOption('#recitationStartMode','auto');await page.locator('#recitationSettingsClose').click();await start(page);await send(page,'قل هو الله أحد الله الصمد');await frame(page);assert((await page.locator('#recitationSurah').textContent()).includes('الإخلاص'),'explicit automatic global location remains available');
  assert.equal(await page.locator('#recitationProgress').textContent(),'0 آيات','old surah counters cannot survive an interim relocation');
  await page.locator('#recitationListen').click();
  await page.evaluate(()=>openPart('eighth',QURAN_DATA.eighths.find(e=>e.sura===2&&e.aya<=75&&e.endSura===2&&e.endAya>=75).id));
  await page.setViewportSize({width:1380,height:768});await frame(page);await page.screenshot({path:'/tmp/athman-v31-desktop.png'});
  await page.setViewportSize({width:390,height:844});await frame(page);await page.screenshot({path:process.env.ATHMAN_QA_OUT?path.join(process.env.ATHMAN_QA_OUT,'v31-mobile.png'):'/tmp/athman-v31-mobile.png'});
  assert.deepEqual(errors,[]);await context.close();
  console.log('PASS: multi-verse burst painting; bounded DOM writes on Al-Baqara; explicit Quran-wide start; no browser errors');
 }finally{await browser.close();await new Promise(r=>server.close(r))}
}
run().catch(error=>{console.error(error);server.close();process.exitCode=1});
