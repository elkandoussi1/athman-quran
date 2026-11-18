'use strict';
// v34 browser check: tabbed settings keep every original control reachable,
// sound/vibration preferences persist, and recitation events produce cues:
// microphone start/stop, a mistake alert for a mutashabih confusion (Warsh
// 2:122 read with the ending of 2:47), and no alert for a clean recitation.
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
const root=path.join(__dirname,'../dist'),shots=process.env.ATHMAN_SHOTS||'';
const server=http.createServer((req,res)=>{const p=decodeURIComponent(new URL(req.url,'http://l').pathname),f=path.join(root,p==='/'?'index.html':p);try{const d=fs.readFileSync(f);res.writeHead(200,{'Content-Type':({'.js':'text/javascript','.css':'text/css','.html':'text/html','.json':'application/json','.ttf':'font/ttf'})[path.extname(f)]||'application/octet-stream'});res.end(d)}catch{res.writeHead(404);res.end()}});
const inject=()=>{try{localStorage.setItem('athman-riwaya-chosen','1')}catch{}
 window.__recognitions=[];window.__cues=[];window.__vibes=[];
 class R{constructor(){window.__recognitions.push(this);this.results=[]}start(){this.onstart?.();this.onaudiostart?.()}stop(){this.onend?.()}abort(){}
  send(t,f=false,i=0){this.results[i]=Object.assign([{transcript:t,confidence:.92}],{isFinal:f});this.results.length=i+1;this.onresult?.({results:this.results,resultIndex:i})}}
 window.SpeechRecognition=R;window.webkitSpeechRecognition=undefined;
 Object.defineProperty(navigator,'vibrate',{value:p=>{window.__vibes.push(p);return true},configurable:true});
 const hook=()=>{if(!window.ATHMAN_SOUNDS)return setTimeout(hook,5);const P=window.ATHMAN_SOUNDS.Player.prototype,render=P.render;P.render=function(ctx,kind,variant){window.__cues.push(kind==='mistake'?kind+':'+variant:kind);return render.call(this,ctx,kind,variant)}};hook();
};
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true,executablePath:process.env.ATHMAN_CHROMIUM||undefined,args:['--no-sandbox','--autoplay-policy=no-user-gesture-required']});
 try{
  const ctx=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});await ctx.addInitScript(inject);
  const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url+'/');await page.waitForFunction(()=>typeof openSurah==='function');
  await page.evaluate(()=>openSurah(2));await page.waitForSelector('#readerDialog[open] #recitationPage .verse');
  // Tabs: every original control is still in the panel.
  await page.locator('#recitationSettings').click();await page.waitForSelector('#recitationSettingsPanel:not([hidden]) .settings-tabs');
  const ids=['recitationQuickMode','recitationStartMode','recitationMode','recitationStrict','recitationReveal','recitationHistory','recitationAutoHide','recitationResync','recitationTheme','recitationShowNumbers','recitationSmaller','recitationKeepAwake','recitationLocale','recitationEngine','recitationReconnect','recitationDetailedLog','recitationReload','recitationSound','recitationVolume','recitationMistakeLevel','recitationMistakeSound','recitationVibrate','recitationMicCues','recitationCompleteCue','recitationConnectionCue','recitationTapCue'];
  const where=await page.evaluate(ids=>ids.map(id=>{const el=document.getElementById(id);return [id,el?.closest('.settings-panel')?.id||null]}),ids);
  for(const [id,tab] of where)assert(tab,`${id} is inside a settings tab`);
  assert.equal(await page.locator('.settings-panel:not([hidden])').count(),1);
  for(const tab of ['recite','alerts','display','service','advanced']){
   await page.locator(`[data-settings-tab="${tab}"]`).click();
   assert(await page.locator('#settingsPanel-'+tab).isVisible());
   if(shots)await page.screenshot({path:`${shots}/settings-${tab}.png`});
  }
  // Preferences: choose a mistake sound, preview it, and persist.
  await page.locator('[data-settings-tab="alerts"]').click();
  await page.locator('#recitationMistakeLevel + .settings-segment [data-segment-value="balanced"]').click();await page.selectOption('#recitationMistakeSound','bell');
  await page.locator('[data-sound-preview="mistake"]').click();
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('athman-sound-prefs')));
  assert.equal(saved.mistakeSound,'bell');assert.equal(saved.mistake,'balanced');
  assert((await page.evaluate(()=>window.__cues)).includes('mistake:bell'),'preview plays the chosen mistake sound');
  await page.locator('#recitationSettingsClose').click();
  // Audio-status badge opens the service tab.
  await page.locator('#recitationAudioStatus').click();assert(await page.locator('#settingsPanel-service').isVisible());await page.locator('#recitationSettingsClose').click();
  // Mutashabih confusion: Warsh 2:122 read with the ending of 2:47.
  await page.evaluate(()=>{window.__cues.length=0;window.__vibes.length=0});
  await page.evaluate(()=>document.querySelector('[data-close-reader]')&&0);
  await page.evaluate(()=>window.ATHMAN_APP_TEST_SEEK?.());
  await page.evaluate(()=>{const r=document.querySelector('#recitationSearchInput');});
  await page.locator('#recitationSearch').click();await page.fill('#recitationSearchInput','2:122');await page.locator('[data-recitation-result]').first().click();
  await page.locator('#recitationListen').click();
  assert((await page.evaluate(()=>window.__cues)).includes('start'),'microphone start sound');
  const say=(t,i)=>page.evaluate(([t,i])=>window.__recognitions.at(-1).send(t,true,i),[t,i]);
  await say('واتقوا يوما لا تجزي نفس عن نفس شيئا',0);
  await say('ولا يقبل منها شفاعة ولا يؤخذ منها عدل',1);
  await page.waitForTimeout(120);
  const cues=await page.evaluate(()=>window.__cues);
  assert(cues.includes('mistake:bell'),'mutashabih confusion triggers the mistake sound: '+cues);
  assert((await page.evaluate(()=>window.__vibes)).some(v=>JSON.stringify(v)==='[70,50,70]'),'mistake vibration');
  assert(await page.evaluate(()=>[...document.querySelectorAll('.verse[data-aya="122"] .recitation-word.is-error,.verse[data-aya="122"] .recitation-word.is-uncertain')].length>=3),'skipped words are flagged');
  if(shots)await page.screenshot({path:`${shots}/mutashabih.png`});
  // Stop: falling cue.
  await page.locator('#recitationListen').click();assert((await page.evaluate(()=>window.__cues)).includes('stop'));
  // Clean recitation of the correct verse: no mistake alert.
  await page.locator('#recitationSettings').click();await page.locator('[data-settings-tab="recite"]').click();await page.locator('#recitationReset').click();
  await page.locator('#recitationSearch').click();await page.fill('#recitationSearchInput','2:122');await page.locator('[data-recitation-result]').first().click();
  await page.evaluate(()=>{window.__cues.length=0});await page.locator('#recitationListen').click();
  await say('واتقوا يوما لا تجزي نفس عن نفس شيئا ولا يقبل منها عدل',0);await say('ولا تنفعها شفاعة ولا هم ينصرون',1);await page.waitForTimeout(120);
  assert(!(await page.evaluate(()=>window.__cues)).some(c=>c.startsWith('mistake')),'clean recitation: no mistake sound');
  // Master switch silences everything.
  await page.locator('#recitationListen').click();
  await page.locator('#recitationSettings').click();await page.locator('[data-settings-tab="alerts"]').click();await page.locator('label:has(#recitationSound)').click();
  await page.evaluate(()=>{window.__cues.length=0});await page.locator('#recitationSettingsClose').click();await page.locator('#recitationListen').click();
  assert.deepEqual(await page.evaluate(()=>window.__cues),[],'sounds off: no cues');
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('athman-sound-prefs')).enabled),false);
  assert.deepEqual(errors,[]);
  console.log('PASS: tabbed settings keep all controls; sound prefs persist; mic start/stop cues; mutashabih confusion alert with vibration; no alert on clean recitation; master mute.');
 }finally{await browser.close();server.close()}
})().catch(e=>{console.error(e);process.exit(1)});
