'use strict';
const assert=require('node:assert/strict');
const {SpeechService,ScreenAwake}=require('./dist/assets/recitation-audio.js');
const {Corpus,Follower,SpeechInput}=require('./dist/assets/recitation.js');
class Clock{
 constructor(){this.time=0;this.next=0;this.jobs=new Map()}
 schedule(fn,ms){const id=++this.next;this.jobs.set(id,{at:this.time+ms,fn});return id}
 cancel(id){this.jobs.delete(id)}
 advance(ms){const end=this.time+ms;let runs=0;while(true){const entry=[...this.jobs].sort((a,b)=>a[1].at-b[1].at)[0];if(!entry||entry[1].at>end)break;assert(++runs<10000,'no busy-loop retries');this.time=entry[1].at;this.jobs.delete(entry[0]);entry[1].fn()}this.time=end}
}
function make(options={}){
 const clock=new Clock(),instances=[],environment={visible:true,online:true},states=[],fatals=[];let boundaries=0;
 class Recognition{
  constructor(){instances.push(this);this.aborts=0}
  start(){options.start?.(this)}
  abort(){this.aborts++}
  emit(name,event={}){this['on'+name]?.(event)}
 }
 const service=new SpeechService({Recognition,now:()=>clock.time,schedule:(fn,ms)=>clock.schedule(fn,ms),cancel:id=>clock.cancel(id),visible:()=>environment.visible,online:()=>environment.online,onState:s=>states.push(s),onFatal:code=>fatals.push(code),onBoundary:()=>{boundaries++;options.boundary?.()},onResult:options.result||(()=>({hadSpeech:true,changed:true}))});
 return {service,clock,instances,environment,states,fatals,get boundaries(){return boundaries},get rec(){return instances.at(-1)}};
}
// Constructing/mounting never asks for microphone access. Only explicit Start does.
{const x=make();assert.equal(x.instances.length,0);x.service.start();assert.equal(x.instances.length,1);assert.equal(x.rec.lang,'ar-MA');assert.equal(x.rec.interimResults,true);assert.equal(x.rec.maxAlternatives,3);x.service.stop();assert.equal(x.clock.jobs.size,0)}
// Keep normal short native cycles fast; every new instance starts a new adapter.
{const x=make();x.service.start();x.rec.emit('start');x.rec.emit('result');const old=x.rec,late=old.onresult;x.clock.advance(400);old.emit('end');assert.equal(x.boundaries,1);x.clock.advance(79);assert.equal(x.instances.length,1);x.clock.advance(1);assert.equal(x.instances.length,2);late({});assert.equal(x.service.resultEvents,1);assert.equal(old.onresult,null);x.service.stop()}
// Audio/capture/speech/service states are distinct, not a fabricated volume meter.
{const x=make();x.service.start();x.rec.emit('start');assert.equal(x.service.snapshot().audio,'unconfirmed');x.rec.emit('audiostart');assert.equal(x.service.snapshot().audio,'capturing');x.rec.emit('speechstart');assert.equal(x.service.phase,'hearing');x.rec.emit('speechend');assert.equal(x.service.phase,'processing');x.rec.emit('result');assert.equal(x.service.phase,'receiving');x.service.stop()}
// No results can also mean silence or long final-only speech. Show a warning,
// but never kill active capture on that ambiguous evidence alone.
{const x=make();x.service.start();x.rec.emit('start');x.rec.emit('speechstart');x.clock.advance(65000);assert.equal(x.instances.length,1);assert.equal(x.service.phase,'delayed');assert.equal(x.rec.aborts,0);x.rec.emit('result');assert.equal(x.service.phase,'receiving');assert.equal(x.service.snapshot().lastResultAgeMs,0);x.service.stop()}
// Duplicate result snapshots do not conceal a stalled stream.
{let changed=true;const x=make({result:()=>({hadSpeech:true,changed})});x.service.start();x.rec.emit('start');x.rec.emit('result');changed=false;for(let i=0;i<16;i++){x.clock.advance(1000);x.rec.emit('result')}assert.equal(x.service.phase,'delayed');assert.equal(x.service.snapshot().lastResultAgeMs,16000);x.service.stop()}
// audioend without end previously left a false listening indicator forever.
// Pending final results have a full grace period and are still consumed.
{let results=0;const x=make({result:()=>{results++;return {hadSpeech:true,changed:true}}});x.service.start();x.rec.emit('start');x.rec.emit('audioend');x.clock.advance(7000);x.rec.emit('result');assert.equal(results,1);assert.equal(x.instances.length,1);x.clock.advance(1000);assert.equal(x.service.phase,'reconnecting');assert.equal(x.boundaries,1);x.clock.advance(600);assert.equal(x.instances.length,2);x.service.stop()}
// A healthy end during the grace period cancels the recovery watchdog.
{const x=make();x.service.start();x.rec.emit('start');x.rec.emit('result');x.rec.emit('audioend');x.clock.advance(1000);x.rec.emit('end');x.clock.advance(80);x.rec.emit('start');x.clock.advance(7500);assert.equal(x.instances.length,2);assert.equal(x.service.recoveries,0);x.service.stop()}
// Network failures retry with bounded backoff; onstart alone cannot reset the
// failure budget and produce endless start/error/start loops.
{const x=make();x.service.start();for(const delay of [600,1200,2400]){x.rec.emit('start');x.rec.emit('error',{error:'network'});assert.equal(x.service.phase,'reconnecting');x.clock.advance(delay)}x.rec.emit('start');x.rec.emit('error',{error:'network'});assert.deepEqual(x.fatals,['network']);assert.equal(x.service.wanted,false);assert.equal(x.service.recoveries,3);assert.equal(x.instances.length,4);x.clock.advance(60000);assert.equal(x.instances.length,4);assert.equal(x.clock.jobs.size,0)}
// A useful result restores the recovery budget; empty/duplicate events do not.
{const x=make();x.service.start();x.rec.emit('error',{error:'network'});x.clock.advance(600);x.rec.emit('start');x.rec.emit('result');assert.equal(x.service.failures,0);x.rec.emit('error',{error:'network'});x.clock.advance(600);assert.equal(x.instances.length,3);x.service.stop()}
// Permission/device failures require a deliberate next user Start, never retries.
for(const code of ['not-allowed','service-not-allowed','audio-capture']){const x=make();x.service.start();x.rec.emit('error',{error:code});x.clock.advance(60000);assert.equal(x.instances.length,1);assert.deepEqual(x.fatals,[code]);x.service.networkChanged();assert.equal(x.instances.length,1)}
// Actual offline state waits for connectivity without burning retry attempts.
{const x=make();x.environment.online=false;x.service.start();assert.equal(x.instances.length,0);assert.equal(x.service.phase,'offline');x.clock.advance(60000);assert.equal(x.service.recoveries,0);x.environment.online=true;x.service.networkChanged();x.clock.advance(250);assert.equal(x.instances.length,1);x.rec.emit('start');x.environment.online=false;x.service.networkChanged();assert.equal(x.boundaries,1);assert.equal(x.service.phase,'offline');x.service.stop();x.environment.online=true;x.service.networkChanged();x.clock.advance(60000);assert.equal(x.instances.length,1)}
// Backgrounding/stopping cancels pending retries and ignores queued callbacks.
{const x=make();x.service.start();const late=x.rec.onstart;x.rec.emit('error',{error:'network'});x.environment.visible=false;x.clock.advance(600);assert.equal(x.service.wanted,false);late();assert.equal(x.service.snapshot().started,false);x.environment.visible=true;x.service.networkChanged();x.clock.advance(60000);assert.equal(x.instances.length,1)}
// Language fallback changes the provider locale once; Warsh matching is external.
{const x=make();x.service.start();x.rec.emit('error',{error:'language-not-supported'});x.clock.advance(0);assert.equal(x.rec.lang,'ar-SA');assert.equal(x.service.fallback,true);x.rec.emit('error',{error:'language-not-supported'});assert.deepEqual(x.fatals,['language-not-supported'])}
// Brief silence is not a reading error and does not stop after three cycles.
{const x=make();x.service.start();for(const delay of [700,1400,2800,4000]){x.rec.emit('start');x.clock.advance(1000);x.rec.emit('error',{error:'no-speech'});x.rec.emit('end');x.clock.advance(delay)}assert.equal(x.instances.length,5);assert.equal(x.service.wanted,true);assert.equal(x.service.recoveries,0);assert.equal(x.fatals.length,0);x.service.stop()}
// Bound a service that repeatedly closes without words after a full minute.
{const x=make();x.service.start();x.rec.emit('start');x.clock.advance(60000);x.rec.emit('end');assert.deepEqual(x.fatals,['no-results']);assert.equal(x.clock.jobs.size,0)}
// Missing onstart and InvalidStateError cannot loop forever; synchronous
// start callbacks must also not leave an orphan watchdog behind.
{const x=make();x.service.start();x.clock.advance(60000);assert.equal(x.instances.length,4);assert.deepEqual(x.fatals,['start-timeout']);assert.equal(x.clock.jobs.size,0)}
{const x=make({start:()=>{const e=new Error();e.name='InvalidStateError';throw e}});x.service.start();x.clock.advance(10000);assert.equal(x.instances.length,4);assert.deepEqual(x.fatals,['start-busy']);assert.equal(x.clock.jobs.size,0)}
{const x=make({start:r=>r.emit('error',{error:'not-allowed'})});x.service.start();assert.equal(x.clock.jobs.size,0);assert.deepEqual(x.fatals,['not-allowed'])}
// A matcher exception becomes an actionable stop, not a dead microphone UI.
{const x=make({result:()=>{throw Error('matcher failure')}});x.service.start();x.rec.emit('result');assert.deepEqual(x.fatals,['processing']);assert.equal(x.clock.jobs.size,0)}
// Reconnect from interim-only speech preserves the follower provisionally,
// without journal credit, another global search, or duplicate final words.
{const corpus=new Corpus([{sura:1,aya:1,text:'الحمد لله رب العالمين الرحمن الرحيم مالك يوم الدين'},{sura:1,aya:2,text:'إياك نعبد وإياك نستعين'}]),f=new Follower(corpus);f.seek(1,1);let adapter=null;
 const x=make({result:event=>(adapter||(adapter=new SpeechInput(f))).update(event.results),boundary:()=>{f.endUtterance();adapter=null}}),result=(t,fin)=>Object.assign([{transcript:t,confidence:.9}],{isFinal:fin});
 x.service.start();x.rec.emit('start');x.rec.emit('result',{results:[result('الحمد لله رب',false)]});assert.equal(f.states.size,0);x.service.reconnect();assert.equal(f.pos,3);assert.equal(f.provisional.size,3);assert.equal(f.states.size,0);x.clock.advance(0);x.rec.emit('start');x.rec.emit('result',{results:[result('العالمين الرحمن الرحيم',true)]});assert.equal(f.pos,6);assert.equal(f.state(0).read.size,3);assert.equal(x.service.manualRecoveries,1);x.service.stop();assert.equal(x.clock.jobs.size,0)}
async function wakeTests(){
 const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve()};
 let releases=0,requests=0,listener;const lock=()=>({release:async()=>{releases++},addEventListener:(_,fn)=>listener=fn});
 let resolve;const awake=new ScreenAwake({request:()=>{requests++;return new Promise(r=>resolve=r)}});
 awake.set(true);awake.set(true);await flush();assert.equal(requests,1);awake.set(false);resolve(lock());await flush();assert.equal(releases,1);assert.equal(awake.lock,null);
 const ready=new ScreenAwake({request:async()=>lock()});await ready.set(true);assert.equal(ready.state,'active');listener();assert.equal(ready.state,'released');await ready.set(true);assert.equal(ready.state,'released','do not fight a system release/low battery');ready.set(false);await ready.set(true);assert.equal(ready.state,'active');ready.set(false);await flush();assert.equal(ready.lock,null);
 const denied=new ScreenAwake({request:async()=>{throw Error('low battery')}});await denied.set(true);assert.equal(denied.state,'unavailable');assert.equal(new ScreenAwake().state,'unsupported');
 let finish;const race=new ScreenAwake({request:()=>{requests++;return requests===2?new Promise(r=>finish=r):Promise.resolve(lock())}});race.set(true);await flush();race.set(false);race.set(true);finish(lock());await flush();assert.equal(race.state,'active','the latest intent wins a late permission response');race.set(false);await flush();
 console.log('PASS: capture/service states; slow final-only safety; stalled capture recovery; bounded network/start retries; permission and offline handling; stale-event cleanup; locale fallback; interim continuity without credit; wake-lock denial and asynchronous release races.');
}
wakeTests().catch(error=>{console.error(error);process.exitCode=1});
