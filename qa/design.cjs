'use strict';
// v38 browser check: home dashboard, bottom tab bar, compact index cards,
// clean settings rows, and no horizontal overflow from 320px to desktop.
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
const root=path.join(__dirname,'../dist');
const shots=process.env.ATHMAN_SHOTS||'';
const server=http.createServer((req,res)=>{const p=decodeURIComponent(new URL(req.url,'http://l').pathname),f=path.join(root,p==='/'?'index.html':p);try{const d=fs.readFileSync(f);res.writeHead(200,{'Content-Type':({'.js':'text/javascript','.css':'text/css','.html':'text/html','.json':'application/json','.ttf':'font/ttf','.svg':'image/svg+xml'})[path.extname(f)]||'application/octet-stream'});res.end(d)}catch{res.writeHead(404);res.end()}});
const inject=()=>{localStorage.setItem('athman-riwaya-chosen','1');class R{start(){this.onstart?.()}stop(){this.onend?.()}abort(){}}window.SpeechRecognition=R};
const overflow=page=>page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true,executablePath:process.env.ATHMAN_CHROMIUM||undefined,args:['--no-sandbox']});
 try{
  const ctx=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});await ctx.addInitScript(inject);
  await ctx.route(/jsdelivr|githubusercontent|mp3quran|everyayah/,r=>r.abort());
  const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url+'/');await page.waitForSelector('.home');
  // Home dashboard.
  assert.match(await page.locator('.home-resume').textContent(),/ابدأ القراءة/);
  assert.equal(await page.locator('.home-actions > *').count(),4);
  assert.match(await page.locator('.home-ring').getAttribute('aria-label'),/من 480/);
  // Bottom tab bar on the phone.
  assert.equal(await page.locator('.tabbar').isVisible(),true);
  assert.equal(await page.locator('.tabbar > *').count(),5);
  assert.equal(await page.locator('.tabbar [data-tab="home"]').getAttribute('aria-current'),'page');
  assert.equal(await page.locator('.topbar #listenAnywhere').isVisible(),false,'secondary actions leave the phone top bar');
  // Compact index cards.
  assert.equal(await page.locator('#cardsGrid .ix-card').count(),12);
  const h=await page.locator('#cardsGrid .ix-card').first().boundingBox();assert(h.height<130,`card height ${h.height}`);
  await page.locator('#cardsGrid .ix-card').first().locator('[data-save]').click();
  assert.equal(await page.locator('#cardsGrid .ix-card').first().locator('[data-save]').getAttribute('aria-pressed'),'true');
  for(const w of [320,360,369,390]){
   await page.setViewportSize({width:w,height:780});assert(await overflow(page)<=0,`home overflows at ${w}px`);
   // v39: one-line title, eyebrow, quick actions, and search row on the phone.
   const m=await page.evaluate(()=>{const h=s=>Math.round(document.querySelector(s).getBoundingClientRect().height);const t=s=>Math.round(document.querySelector(s).getBoundingClientRect().top);return {h1:h('.home h1'),eyebrow:h('.home-eyebrow'),actions:[...document.querySelectorAll('.home-actions>*')].map(x=>Math.round(x.getBoundingClientRect().top)),search:t('.search-box'),juz:t('.juz-select')}});
   assert(m.h1<=48,`title wraps at ${w}px`);assert(m.eyebrow<=30,`eyebrow wraps at ${w}px`);
   assert.equal(new Set(m.actions).size,1,`quick actions in one row at ${w}px`);assert.equal(m.search,m.juz,`search and juz on one row at ${w}px`);
  }
  await page.setViewportSize({width:390,height:844});
  if(shots)await page.screenshot({path:path.join(shots,'v38-home.png')});
  // Tabs: surahs, saved, «المزيد».
  await page.locator('.tabbar [data-tab="surahs"]').click();await page.waitForSelector('.ix-card--surah');
  assert.equal(await page.locator('.tabbar [data-tab="surahs"]').getAttribute('aria-current'),'page');
  assert(await overflow(page)<=0);
  if(shots)await page.screenshot({path:path.join(shots,'v38-surahs.png')});
  await page.locator('.tabbar [data-tab="saved"]').click();await page.waitForFunction(()=>/مواضعي المحفوظة/.test(document.querySelector('main h1')?.textContent||''));
  assert.equal(await page.locator('#cardsGrid .ix-card').count(),1,'the saved hizb is listed');
  await page.locator('.tabbar [data-tab-action="menu"]').click();
  await page.waitForSelector('#sidebar.open');await page.evaluate(()=>document.querySelector('#mobileShade').click());await page.waitForSelector('#sidebar:not(.open)',{state:'attached'});
  // A part opened from the index becomes the resume card.
  await page.goto(url+'/#/eighths');await page.waitForSelector('.ix-card');
  await page.locator('.ix-card').nth(2).locator('.ix-main').click();await page.waitForSelector('#recitationPage .verse');
  await page.evaluate(()=>closeReader());await page.goto(url+'/#/');await page.waitForSelector('.home-resume');
  assert.match(await page.locator('.home-resume').textContent(),/تابع من حيث توقفت/);
  assert.match(await page.locator('.home-resume').textContent(),/الثمن الثالث/);
  // Hizb page.
  await page.goto(url+'/#/hizb/12');await page.waitForSelector('.eighth-card');
  assert(await overflow(page)<=0);
  if(shots)await page.screenshot({path:path.join(shots,'v38-hizb.png')});
  // v39: the reader menu is a designed side drawer.
  await page.goto(url+'/#/');await page.evaluate(()=>openSurah(2));await page.waitForSelector('#recitationPage .verse');
  await page.locator('#recitationMenu').click();await page.waitForSelector('#recitationMenuPanel:not([hidden]) .rmenu-head');
  const drawer=await page.locator('#recitationMenuPanel').boundingBox();
  assert(drawer.height>=780&&drawer.x+drawer.width>=389,'drawer spans the height from the right edge');
  assert.equal(await page.locator('#recitationMenuPanel .rmenu-list a').count(),6);
  assert.equal(await page.locator('#recitationMenuPanel .rmenu-tile').count(),2);
  if(shots)await page.screenshot({path:path.join(shots,'v39-reader-menu.png')});
  await page.locator('#recitationMenuClose').click();assert.equal(await page.locator('#recitationMenuPanel').isHidden(),true);
  await page.evaluate(()=>closeReader());
  // The FAB opens the reader and starts listening.
  await page.goto(url+'/#/');await page.waitForSelector('.tabbar-fab');
  await page.locator('.tabbar-fab').click();await page.waitForSelector('#recitationPage .verse');
  // Settings: rows with switches and an actions list.
  await page.locator('#recitationSettings').click();
  const sw=await page.locator('#recitationAutoHide').evaluate(el=>({app:getComputedStyle(el).appearance,w:el.getBoundingClientRect().width}));
  assert.equal(sw.app,'none');assert(sw.w>=40,'checkbox drawn as a switch');
  const actions=await page.locator('#settingsPanel-recite .recitation-settings-actions > button:not([hidden])').evaluateAll(b=>b.map(x=>Math.round(x.getBoundingClientRect().width)));
  assert(actions.length>=4&&new Set(actions).size===1,'actions are full-width rows');
  if(shots)await page.screenshot({path:path.join(shots,'v38-settings.png')});
  await page.locator('#settingsTab-display').click();
  if(shots)await page.screenshot({path:path.join(shots,'v38-settings-display.png')});
  assert.deepEqual(errors,[]);
  await ctx.close();
  // Desktop: sidebar, no tab bar.
  const dctx=await browser.newContext({viewport:{width:1366,height:860},serviceWorkers:'block'});await dctx.addInitScript(inject);
  const dp=await dctx.newPage();await dp.goto(url+'/');await dp.waitForSelector('.home');
  assert.equal(await dp.locator('.tabbar').isVisible(),false);assert.equal(await dp.locator('#sidebar').isVisible(),true);
  assert(await overflow(dp)<=0);
  if(shots)await dp.screenshot({path:path.join(shots,'v38-desktop.png')});
  await dp.evaluate(()=>{localStorage.setItem('athman-theme','"dark"')});await dp.reload();await dp.waitForSelector('.home');
  if(shots)await dp.screenshot({path:path.join(shots,'v38-desktop-dark.png')});
  await dctx.close();
  console.log('PASS: home dashboard, bottom tab bar, compact cards, resume card, settings rows with switches, no overflow 320px–desktop.');
 }finally{await browser.close();server.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
