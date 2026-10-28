/* Original browser-service lifecycle code. No audio or recognition text is stored. */
(function(root,factory){
 'use strict';
 const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ATHMAN_AUDIO=api;
})(typeof window==='object'?window:globalThis,function(){
 'use strict';
 const events=['start','result','end','error','nomatch','audiostart','audioend','soundstart','soundend','speechstart','speechend'];
 class SpeechService{
  constructor({Recognition,now=()=>performance.now(),schedule=(fn,ms)=>setTimeout(fn,ms),cancel=id=>clearTimeout(id),visible=()=>true,online=()=>true,onStart=()=>{},onResult=()=>null,onBoundary=()=>{},onState=()=>{},onFatal=()=>{}}={}){
   Object.assign(this,{Recognition,now,schedule,cancel,visible,online,onStart,onResult,onBoundary,onState,onFatal});
   this.wanted=false;this.current=null;this.retryTimer=null;this.healthTimer=null;this.phase='idle';this.reason='';this.locale='ar-MA';this.resetStats();
  }
  resetStats(){this.cycles=0;this.resultEvents=0;this.recoveries=0;this.manualRecoveries=0;this.failures=0;this.emptyEnds=0;this.lastResultAt=null;this.lastError='';this.fallback=false;this.requestedAt=this.now()}
  snapshot(){
   const c=this.current;
   return {phase:this.phase,reason:this.reason,wanted:this.wanted,started:!!c?.started,audio:c?.audio||'unconfirmed',speech:!!c?.speech,locale:this.locale,fallback:this.fallback,cycles:this.cycles,resultEvents:this.resultEvents,recoveries:this.recoveries,manualRecoveries:this.manualRecoveries,lastError:this.lastError,lastResultAgeMs:this.lastResultAt===null?null:Math.max(0,Math.round(this.now()-this.lastResultAt))};
  }
  publish(phase,reason=''){
   const changed=phase!==this.phase||reason!==this.reason;this.phase=phase;this.reason=reason;
   if(changed)this.onState(this.snapshot());
  }
  clearTimers(){this.cancel(this.retryTimer);this.cancel(this.healthTimer);this.retryTimer=this.healthTimer=null}
  detach(){
   this.cancel(this.healthTimer);this.healthTimer=null;
   const c=this.current;this.current=null;if(!c)return;
   for(const event of events)c.rec['on'+event]=null;
   try{c.rec.abort()}catch{}
   this.onBoundary();
  }
  start(locale='ar-MA'){
   this.stop();this.resetStats();this.locale=locale==='ar-SA'?'ar-SA':'ar-MA';this.wanted=true;this.connect();
  }
  stop(){this.wanted=false;this.clearTimers();this.detach();this.publish('idle')}
  fail(code){
   this.lastError=code;this.wanted=false;this.clearTimers();this.detach();this.publish('error',code);this.onFatal(code);
  }
  later(delay){
   this.cancel(this.retryTimer);this.retryTimer=null;if(!this.wanted)return;
   this.retryTimer=this.schedule(()=>{this.retryTimer=null;this.connect()},delay);
  }
  recover(reason,{manual=false}={}){
   if(!this.wanted)return;
   this.clearTimers();this.detach();
   if(!this.visible()){this.stop();return}
   if(!this.online()){this.publish('offline','network');return}
   if(manual){this.failures=0;this.emptyEnds=0;this.manualRecoveries++}
   else{this.lastError=reason;if(++this.failures>3){this.fail(reason);return}this.recoveries++}
   this.publish('reconnecting',reason);this.later(manual?0:Math.min(4000,600*2**(this.failures-1)));
  }
  reconnect(){this.recover('manual',{manual:true})}
  networkChanged(){
   if(!this.wanted)return;
   if(!this.online()){this.clearTimers();this.detach();this.publish('offline','network')}
   else if(this.phase==='offline'&&this.visible()){this.publish('reconnecting','online');this.later(250)}
  }
  tick(c){
   if(this.current!==c||!this.wanted)return;
   const elapsed=this.now()-c.created;
   if(!c.started&&elapsed>=12000){this.recover('start-timeout');return}
   // audioend means capture actually stopped. Give pending finals time to arrive
   // before recovering a browser that forgot to send its end event.
   if(c.audioEndedAt!==null&&this.now()-c.audioEndedAt>=8000){this.recover('audio-ended');return}
   if(c.started&&c.audioEndedAt===null&&this.now()-(c.lastResultAt??c.created)>=15000)this.publish('delayed','no-results');
   // Absence of text alone cannot distinguish a quiet reader from a slow
   // final-only service. Never abort active speech just because it is quiet.
   this.healthTimer=this.schedule(()=>this.tick(c),1000);
  }
  connect(){
   if(!this.wanted)return;
   this.clearTimers();
   if(!this.visible()){this.stop();return}
   if(!this.online()){this.publish('offline','network');return}
   this.detach();
   let rec;try{rec=new this.Recognition()}catch{this.fail('unsupported');return}
   const c={rec,created:this.now(),started:false,hadResult:false,lastResultAt:null,audio:'unconfirmed',audioEndedAt:null,speech:false};this.current=c;this.cycles++;
   const current=()=>this.wanted&&this.current===c;
   rec.lang=this.locale;rec.continuous=true;rec.interimResults=true;rec.maxAlternatives=3;
   rec.onstart=()=>{if(!current())return;c.started=true;this.publish('listening');this.onStart()};
   rec.onaudiostart=()=>{if(!current())return;c.audio='capturing';c.audioEndedAt=null;this.publish('listening','audio')};
   rec.onsoundstart=()=>{if(current())this.publish('hearing','sound')};
   rec.onspeechstart=()=>{if(!current())return;c.speech=true;this.publish('hearing','speech')};
   rec.onspeechend=()=>{if(!current())return;c.speech=false;this.publish('processing','speech-ended')};
   rec.onsoundend=()=>{if(current()&&!c.speech)this.publish('processing','sound-ended')};
   rec.onaudioend=()=>{if(!current())return;c.audio='ended';c.audioEndedAt=this.now();c.speech=false;this.publish('processing','audio-ended')};
   rec.onresult=event=>{
    if(!current())return;this.resultEvents++;
    let batch;try{batch=this.onResult(event)}catch{this.fail('processing');return}
    if(!current())return;
    // The text adapter decides whether anything new was heard. Do not re-read
    // immutable final slots here or let duplicate snapshots hide a stalled feed.
    if(batch?.hadSpeech&&batch.changed){c.hadResult=true;c.lastResultAt=this.now();this.lastResultAt=c.lastResultAt;this.failures=0;this.emptyEnds=0;this.publish('receiving')}
   };
   rec.onnomatch=()=>{if(current())this.publish('listening','no-match')};
   rec.onerror=event=>{
    if(!current())return;const code=event.error||'unknown';this.lastError=code;
    if(code==='no-speech'){this.publish('listening','no-speech');return}
    if(code==='language-not-supported'&&this.locale==='ar-MA'&&!this.fallback){this.fallback=true;this.locale='ar-SA';this.detach();this.publish('reconnecting','locale');this.later(0);return}
    if(['not-allowed','service-not-allowed','audio-capture','language-not-supported','asr-configuration','asr-access','asr-backlog','asr-response'].includes(code)){this.fail(code);return}
    this.recover(code);
   };
   rec.onend=()=>{
    if(!current())return;
    const age=this.now()-c.created;this.detach();if(!this.wanted)return;
    if(!this.visible()){this.stop();return}
    if(!this.online()){this.publish('offline','network');return}
    if(!c.hadResult&&age<250){this.recover('empty-start');return}
    if(!c.hadResult&&this.now()-(this.lastResultAt??this.requestedAt)>=60000){this.fail('no-results');return}
    this.emptyEnds=c.hadResult?0:this.emptyEnds+1;
    this.publish('reconnecting',c.hadResult?'cycle':'silence');this.later(c.hadResult?80:Math.min(4000,700*2**Math.min(3,this.emptyEnds-1)));
   };
   this.publish('connecting');
   // Arm before start(): some providers dispatch their events synchronously.
   this.healthTimer=this.schedule(()=>this.tick(c),1000);
   try{rec.start()}catch(error){
    if(!current())return;
    if(['NotAllowedError','SecurityError'].includes(error?.name))this.fail('not-allowed');
    else this.recover(error?.name==='InvalidStateError'?'start-busy':'start-failed');
   }
  }
 }
 class ScreenAwake{
  constructor({request=null,onChange=()=>{}}={}){this.request=request;this.onChange=onChange;this.wanted=false;this.lock=null;this.pending=null;this.generation=0;this.state=request?'idle':'unsupported'}
  change(state){this.state=state;this.onChange(state)}
  set(wanted){
   const previous=this.wanted;
   this.wanted=!!wanted;
   if(!wanted){this.generation++;const lock=this.lock;this.lock=null;if(lock)Promise.resolve().then(()=>lock.release()).catch(()=>{});this.change(this.request?'idle':'unsupported');return Promise.resolve()}
   if(!this.request||this.lock||this.pending||previous&&['unavailable','released'].includes(this.state))return this.pending||Promise.resolve();
   const generation=this.generation;this.change('requesting');
   const pending=Promise.resolve().then(()=>this.request('screen')).then(lock=>{
    if(!this.wanted||generation!==this.generation){return Promise.resolve(lock.release()).catch(()=>{})}
    this.lock=lock;this.change('active');lock.addEventListener?.('release',()=>{if(this.lock===lock){this.lock=null;this.change('released')}});
   }).catch(()=>{if(generation===this.generation)this.change('unavailable')}).finally(()=>{if(this.pending===pending)this.pending=null;if(this.wanted&&generation!==this.generation)this.set(true)});
   this.pending=pending;return pending;
  }
 }
 return {version:30,SpeechService,ScreenAwake};
});
