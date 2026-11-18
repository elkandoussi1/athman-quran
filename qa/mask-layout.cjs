'use strict';
// v33 browser check: hiding the text must not move any word, verse number or
// eighth marker (the reported Al-Jathiyah "misplaced markers" view), and every
// concealed word must draw a visible placeholder so markers stay in context.
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
const root=path.join(__dirname,'../dist');
const server=http.createServer((req,res)=>{const p=decodeURIComponent(new URL(req.url,'http://l').pathname),f=path.join(root,p==='/'?'index.html':p);try{const d=fs.readFileSync(f);res.writeHead(200,{'Content-Type':({'.js':'text/javascript','.css':'text/css','.html':'text/html','.json':'application/json','.ttf':'font/ttf'})[path.extname(f)]||'application/octet-stream'});res.end(d)}catch{res.writeHead(404);res.end()}});
const inject=()=>{try{localStorage.setItem('athman-riwaya-chosen','1')}catch{}window.__recognitions=[];class R{constructor(){window.__recognitions.push(this);this.results=[]}start(){this.onstart?.();this.onaudiostart?.()}stop(){this.onend?.()}abort(){}}window.SpeechRecognition=R;window.webkitSpeechRecognition=undefined};
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true,executablePath:process.env.ATHMAN_CHROMIUM||undefined,args:['--no-sandbox']});
 try{
  for(const [width,height,theme] of [[390,844,'light'],[1380,820,'dark'],[320,568,'light']]){
   const ctx=await browser.newContext({viewport:{width,height},serviceWorkers:'block'});await ctx.addInitScript(inject);
   await ctx.addInitScript(t=>localStorage.setItem('athman-theme',JSON.stringify(t)),theme);
   const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto(url+'/');await page.waitForFunction(()=>typeof openSurah==='function');
   await page.evaluate(()=>openSurah(45));await page.waitForSelector('#readerDialog[open] #recitationPage .verse');
   assert.equal(await page.evaluate(()=>document.getElementById('readerDialog').dataset.recitationTheme),theme,'reader follows the app theme by default');
   const rects=()=>page.evaluate(()=>[...document.querySelectorAll('#recitationPage .verse-number,#recitationPage .recitation-division-marker,#recitationPage .recitation-word')].slice(0,400).map(e=>{const r=e.getBoundingClientRect();return [Math.round(r.left),Math.round(r.top+document.getElementById('recitationPageScroll').scrollTop)]}));
   const before=await rects();
   await page.locator('#recitationListen').click();await page.waitForFunction(()=>document.querySelector('#recitationPage').classList.contains('is-masked'));
   const after=await rects();
   assert.deepEqual(after,before,`masking keeps every word and marker in place at ${width}x${height}`);
   const placeholder=await page.evaluate(()=>{const w=document.querySelector('#recitationPage .recitation-word.is-concealed:not(.is-cursor)');return getComputedStyle(w).backgroundImage});
   assert(placeholder.includes('gradient'),'concealed words draw a placeholder');
   assert.deepEqual(errors,[]);await ctx.close();
  }
  console.log('PASS: hidden-text recitation keeps words, verse numbers and eighth markers fixed; placeholders drawn; reader follows app theme.');
 }finally{await browser.close();server.close()}
})().catch(e=>{console.error(e);process.exit(1)});
