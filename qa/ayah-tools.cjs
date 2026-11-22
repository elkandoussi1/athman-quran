'use strict';
// v37 browser check: reciters per riwaya (player, highlight, auto-advance),
// ayah sheet with tafsirs (bundled + remote), word meanings, «سمّعها», and the
// «الاستماع والتفسير» settings tab. External audio/tafsir hosts are mocked.
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
const root=path.join(__dirname,'../dist');
const shots=process.env.ATHMAN_SHOTS||'';
const server=http.createServer((req,res)=>{const p=decodeURIComponent(new URL(req.url,'http://l').pathname),f=path.join(root,p==='/'?'index.html':p);try{const d=fs.readFileSync(f);res.writeHead(200,{'Content-Type':({'.js':'text/javascript','.css':'text/css','.html':'text/html','.json':'application/json','.ttf':'font/ttf'})[path.extname(f)]||'application/octet-stream'});res.end(d)}catch{res.writeHead(404);res.end()}});
const inject=()=>{localStorage.setItem('athman-riwaya-chosen','1');window.__recognitions=[];class R{constructor(){window.__recognitions.push(this);this.results=[];this.started=false}start(){this.started=true;this.onstart?.();this.onaudiostart?.()}stop(){this.onend?.()}abort(){}}window.SpeechRecognition=R;window.webkitSpeechRecognition=undefined};
// Silent 8 kHz mono WAV of the given length.
function wav(seconds){
 const n=Math.round(8000*seconds),b=Buffer.alloc(44+n);
 b.write('RIFF',0);b.writeUInt32LE(36+n,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);
 b.writeUInt32LE(8000,24);b.writeUInt32LE(8000,28);b.writeUInt16LE(1,32);b.writeUInt16LE(8,34);b.write('data',36);b.writeUInt32LE(n,40);b.fill(128,44);return b;
}
const LONG=wav(200),SHORT=wav(1.2);
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true,executablePath:process.env.ATHMAN_CHROMIUM||undefined,args:['--no-sandbox','--autoplay-policy=no-user-gesture-required']});
 const requested=[];
 const ctxFor=async()=>{
  const ctx=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});await ctx.addInitScript(inject);
  // Real CDNs answer byte ranges; seeking inside a surah file depends on it.
  await ctx.route(/cdn\.mp3quran\.net|everyayah\.com/,async route=>{
   const req=route.request();requested.push(req.url());const data=/everyayah/.test(req.url())?SHORT:LONG;
   const range=/bytes=(\d+)-(\d*)/.exec((await req.allHeaders()).range||'');
   if(!range)return route.fulfill({status:200,headers:{'Content-Type':'audio/wav','Accept-Ranges':'bytes','Content-Length':String(data.length)},body:data});
   const a=+range[1],b=range[2]?Math.min(+range[2],data.length-1):data.length-1;
   route.fulfill({status:206,headers:{'Content-Type':'audio/wav','Accept-Ranges':'bytes','Content-Range':`bytes ${a}-${b}/${data.length}`,'Content-Length':String(b-a+1)},body:data.subarray(a,b+1)});
  });
  await ctx.route(/cdn\.jsdelivr\.net|raw\.githubusercontent\.com/,route=>{const u=route.request().url();requested.push(u);const m=/tafsir\/([^/]+)\/(\d+)\/(\d+)\.json$/.exec(u);route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({text:`قوله تعالى: ﴿نص﴾ تفسير تجريبي من ${m[1]} للآية ${m[3]}.\nصفحة ١٧\nفقرة ثانية.`,surah:+m[2],ayah:+m[3]})})});
  return ctx;
 };
 try{
  /* ---------------- ورش ---------------- */
  const ctx=await ctxFor(),page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url+'/');await page.waitForFunction(()=>typeof openSurah==='function'&&window.ATHMAN_AYAH);
  assert.equal(await page.evaluate(()=>ATHMAN_AYAH.RIWAYA),'warsh');
  await page.evaluate(()=>openSurah(2));await page.waitForSelector('#recitationPage .verse');
  assert.equal(await page.locator('#recitationPlayer').count(),1,'listen button in the dock');

  // Tap the verse number of 2:1 → tafsir sheet (Muyassar, bundled).
  await page.locator('#recitationPage .verse[data-aya="1"] .verse-number').click();
  await page.waitForSelector('dialog.ayah-sheet[open] #ayahTafsirBody p');
  assert.match(await page.locator('#ayahSheetMeta').textContent(),/البقرة · الآية 1 · ترقيم ورش/);
  assert.match(await page.locator('#ayahTafsirBody').textContent(),/الآيتان 1 و2/);
  assert.equal(await page.locator('#ayahTafsirBody .ayah-intro').count(),1,'surah intro on the first ayah');
  assert.equal(await page.locator('[data-as-tafsir="muyassar"]').getAttribute('aria-checked'),'true');
  if(shots)await page.screenshot({path:path.join(shots,'v37-tafsir-sheet.png')});
  // Jalalayn (bundled) then Qurtubi (remote, cached).
  await page.locator('[data-as-tafsir="jalalayn"]').click();await page.waitForFunction(()=>/الجلالين/.test(document.querySelector('#ayahTafsirAbout').textContent)&&document.querySelector('#ayahTafsirBody p'));
  await page.locator('[data-as-tafsir="qurtubi"]').click();await page.waitForFunction(()=>/تفسير تجريبي/.test(document.querySelector('#ayahTafsirBody').textContent));
  const body=await page.locator('#ayahTafsirBody').textContent();
  assert.match(body,/للآية 1/);assert.match(body,/للآية 2/);assert.doesNotMatch(body,/صفحة ١٧/,'page markers removed');
  assert.equal(await page.locator('#ayahTafsirBody .ayah-quote').count(),2);
  assert(requested.some(u=>/ar-tafseer-al-qurtubi\/2\/1\.json$/.test(u))&&requested.some(u=>/ar-tafseer-al-qurtubi\/2\/2\.json$/.test(u)));
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('athman-ayah-v1')).tafsir),'qurtubi','tafsir choice is remembered');
  // Next ayah in the sheet, then the words tab.
  await page.locator('[data-as-tafsir="muyassar"]').click();
  await page.locator('[data-as="next"]').click();await page.waitForFunction(()=>/الآية 2 ·/.test(document.querySelector('#ayahSheetMeta').textContent));
  assert.match(await page.locator('#ayahSheetText').textContent(),/يُومِنُونَ/);
  await page.locator('[data-as-tab="words"]').click();await page.waitForSelector('.ayah-glossary dt');
  assert(await page.locator('.ayah-glossary dt').count()>=3);
  await page.locator('[data-as="close"]').click();await page.waitForSelector('dialog.ayah-sheet[open]',{state:'detached'}).catch(()=>{});
  assert.equal(await page.evaluate(()=>document.querySelector('dialog.ayah-sheet').open),false);

  // Tap a word → its meaning in the word menu.
  await page.locator('#recitationPage .verse[data-aya="2"] .recitation-word').nth(1).click();
  await page.waitForFunction(()=>/يصدقون|يُصَدِّقُون/.test(document.querySelector('#recitationWordMeaning').textContent.replace(/[ً-ْ]/g,'')));
  assert.match(await page.locator('#recitationWordMeaning').textContent(),/الميسر في غريب القرآن/);
  if(shots)await page.screenshot({path:path.join(shots,'v37-word-meaning.png')});
  await page.locator('#recitationWordMore').click();await page.waitForSelector('dialog.ayah-sheet[open] .ayah-word-focus');
  assert.equal(await page.locator('[data-as-tab="words"]').getAttribute('aria-selected'),'true');
  if(shots)await page.screenshot({path:path.join(shots,'v37-word-sheet.png')});
  // «سمّعها» closes the sheet, stops any recitation audio and starts the microphone.
  await page.locator('[data-as="recite"]').click();
  await page.waitForFunction(()=>window.__recognitions.some(r=>r.started));
  assert.equal(await page.evaluate(()=>document.querySelector('dialog.ayah-sheet').open),false);
  assert.match(await page.locator('#recitationListen').getAttribute('aria-label'),/^إيقاف/);

  // Player: Qazabri, whole-surah file + Warsh timings; highlight follows the ayah.
  await page.locator('#recitationPlayer').click();
  await page.waitForFunction(()=>ATHMAN_AYAH.player.state.playing);
  assert(requested.some(u=>u==='https://cdn.mp3quran.net/audio/omar-kazabri/r1/002.mp3'),'Warsh audio is the surah file');
  assert.equal(await page.evaluate(()=>window.__recognitions.at(-1).started&&document.querySelector('#recitationListen').getAttribute('aria-label')),'بدء الاستماع','microphone stopped while the reciter plays');
  const st=await page.evaluate(()=>({s:ATHMAN_AYAH.player.state.sura,a:ATHMAN_AYAH.player.state.aya}));
  await page.waitForSelector(`#recitationPage .verse[data-aya="${st.a}"].is-playing`);
  assert.equal(await page.locator('.ayah-player').isVisible(),true);
  // Jump close to the end of the ayah window → the next ayah is highlighted.
  const t=await page.evaluate(()=>fetch('assets/audio/warsh-qazabri.json').then(r=>r.json()));
  const end=t.surahs[1][(st.a-1)*2+1]/100;
  await page.evaluate(e=>{ATHMAN_AYAH.player.audio.currentTime=e-0.02},end);
  await page.waitForFunction(a=>ATHMAN_AYAH.player.state.aya===a+1,st.a);
  await page.waitForSelector(`#recitationPage .verse[data-aya="${st.a+1}"].is-playing`);
  assert.equal(await page.locator('#recitationPage .verse.is-playing').count(),1);
  if(shots)await page.screenshot({path:path.join(shots,'v37-player.png')});
  // Repeat chip cycles; the reciter list switches reciters.
  await page.locator('.ayah-player [data-ap="repeat"]').click();
  assert.match(await page.locator('.ayah-player [data-ap="repeat"]').textContent(),/×2/);
  await page.locator('.ayah-player [data-ap="reciters"]').click();
  assert.equal(await page.locator('.ayah-player [data-ap="pick"]').count(),4);
  await page.locator('.ayah-player [data-ap="pick"][data-id="kouchi"]').click();
  await page.waitForFunction(()=>ATHMAN_AYAH.reciter().id==='kouchi');
  await page.waitForFunction(()=>ATHMAN_AYAH.player.state.playing);
  assert(requested.some(u=>u==='https://cdn.mp3quran.net/audio/laayoun-kouchi/r1/002.mp3'));
  await page.locator('.ayah-player [data-ap="toggle"]').click();
  await page.waitForFunction(()=>!ATHMAN_AYAH.player.state.playing);

  // Settings tab «الاستماع والتفسير».
  await page.locator('#recitationSettings').click();
  await page.locator('#settingsTab-listen').click();
  assert.equal(await page.locator('#settingsPanel-listen input[name="athmanReciter"]').count(),4);
  assert.equal(await page.locator('#settingsPanel-listen input[name="athmanReciter"][value="kouchi"]').isChecked(),true);
  assert.equal(await page.locator('#settingsPanel-listen input[name="athmanTafsir"]').count(),8);
  await page.locator('#settingsPanel-listen label:has(input[value="husary"])').click();
  assert.equal(await page.evaluate(()=>ATHMAN_AYAH.reciter().id),'husary');
  await page.locator('#ayahRepeat').selectOption('3');
  assert.equal(await page.evaluate(()=>ATHMAN_AYAH.prefs.repeat),3);
  if(shots)await page.screenshot({path:path.join(shots,'v37-settings.png')});
  await page.locator('#recitationSettingsClose').click();

  // Closing the reader stops playback.
  await page.evaluate(()=>ATHMAN_AYAH.player.play(1,1));await page.waitForFunction(()=>ATHMAN_AYAH.player.state.playing);
  await page.evaluate(()=>closeReader());
  assert.equal(await page.evaluate(()=>ATHMAN_AYAH.player.state.playing),false);
  assert.deepEqual(errors,[]);
  await ctx.close();

  /* ---------------- حفص ---------------- */
  const hctx=await ctxFor();await hctx.addInitScript(()=>localStorage.setItem('athman-riwaya','hafs'));
  const hp=await hctx.newPage(),herr=[];hp.on('pageerror',e=>herr.push(e.message));
  await hp.goto(url+'/');await hp.waitForFunction(()=>typeof openSurah==='function'&&window.ATHMAN_AYAH);
  assert.equal(await hp.evaluate(()=>ATHMAN_AYAH.RIWAYA),'hafs');
  await hp.evaluate(()=>openSurah(112));await hp.waitForSelector('#recitationPage .verse');
  requested.length=0;
  await hp.locator('#recitationPlayer').click();
  // Ayah 1 of a surah other than الفاتحة: the basmala is played first.
  await hp.waitForFunction(()=>ATHMAN_AYAH.player.state.playing);
  assert.equal(requested[0],'https://everyayah.com/data/Husary_128kbps/001001.mp3');
  await hp.waitForFunction(()=>ATHMAN_AYAH.player.state.aya===2,null,{timeout:15000});
  assert(requested.includes('https://everyayah.com/data/Husary_128kbps/112001.mp3'));
  assert(requested.includes('https://everyayah.com/data/Husary_128kbps/112002.mp3'));
  await hp.waitForSelector('#recitationPage .verse[data-aya="2"].is-playing');
  await hp.locator('.ayah-player [data-ap="toggle"]').click();
  await hp.locator('#recitationPage .verse[data-aya="1"] .verse-number').click();
  await hp.waitForSelector('dialog.ayah-sheet[open] #ayahTafsirBody > p');
  const hmeta=await hp.locator('#ayahSheetMeta').textContent();assert.doesNotMatch(hmeta,/ورش/);
  assert.doesNotMatch(await hp.locator('#ayahTafsirBody').textContent(),/ترقيم حفص/);
  assert.match(await hp.locator('#ayahTafsirBody').textContent(),/المتفرد بالألوهية/);
  await hp.locator('[data-as="close"]').click();
  await hp.locator('#recitationSettings').click();await hp.locator('#settingsTab-listen').click();
  assert(await hp.locator('#settingsPanel-listen input[name="athmanReciter"]').count()>=8);
  assert.deepEqual(herr,[]);
  await hctx.close();
  console.log('PASS: reciters per riwaya with highlight and auto-advance; tafsir sheet (bundled + remote); word meanings; recite-from-sheet; listening settings tab.');
 }finally{await browser.close();server.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
