/* أثمان — أصوات التنبيه (الإصدار 34).
   كل الأصوات مولّدة داخل الجهاز عبر Web Audio؛ لا ملفات صوتية ولا تسجيل.
   الإخراج الصوتي الفاشل لا يعطّل الميكروفون أبدًا. */
(function(root,factory){
 'use strict';
 const api=factory(root);
 if(typeof module==='object'&&module.exports)module.exports=api;else root.ATHMAN_SOUNDS=api;
})(typeof window==='object'?window:globalThis,function(root){
 'use strict';
 const KEY='athman-sound-prefs';
 const MISTAKE_SOUNDS={
  knock:'طرقة خشبية',
  soft:'نغمة هادئة',
  bell:'جرس تنبيه',
  double:'تنبيه مزدوج',
  buzz:'طنين قصير',
  fall:'نغمة هابطة'
 };
 const SENSITIVITY={
  balanced:'متوازن — عند كلمة مختلفة أو آية مشتبهة',
  sensitive:'حساس — عند كل اختلاف ولو غير مؤكد',
  confirmed:'محافظ — عند الخطأ المؤكد فقط',
  off:'بلا تنبيه للأخطاء'
 };
 const DEFAULTS={enabled:true,volume:.7,micCues:true,mistake:'balanced',mistakeSound:'knock',vibrate:true,complete:true,connection:true,taps:false};
 const VIBRATION={start:[22],stop:[14],mistake:[70,50,70],complete:[40,60,40,60,120],connection:[180],tap:[8]};

 function load(storage=root.localStorage){
  const prefs={...DEFAULTS};
  try{
   const saved=JSON.parse(storage?.getItem(KEY)||'null');
   if(saved&&typeof saved==='object'){
    for(const key of ['enabled','micCues','vibrate','complete','connection','taps'])if(typeof saved[key]==='boolean')prefs[key]=saved[key];
    if(Number.isFinite(saved.volume))prefs.volume=Math.min(1,Math.max(0,saved.volume));
    if(saved.mistake in SENSITIVITY)prefs.mistake=saved.mistake;
    if(saved.mistakeSound in MISTAKE_SOUNDS)prefs.mistakeSound=saved.mistakeSound;
   }
  }catch{}
  return prefs;
 }
 function save(prefs,storage=root.localStorage){try{storage?.setItem(KEY,JSON.stringify(prefs))}catch{}}

 // Which final results deserve an audible mistake alert at a sensitivity level.
 function shouldAlert(commit,level){
  if(!commit||level==='off')return false;
  if(level==='confirmed')return !!commit.definiteErrors;
  if(level==='sensitive')return !!(commit.mistake||commit.definiteErrors||commit.type==='mismatch'||commit.events?.some(e=>e.type!=='read'));
  return !!(commit.mistake||commit.definiteErrors);
 }

 class Player{
  constructor(prefs=load()){this.prefs=prefs;this.ctx=null;this.lastAt=new Map()}
  context(){
   try{const Context=root.AudioContext||root.webkitAudioContext;if(!Context)return null;if(!this.ctx||this.ctx.state==='closed')this.ctx=new Context({latencyHint:'interactive'});return this.ctx}catch{return null}
  }
  warm(){const ctx=this.context();if(ctx?.state==='suspended')ctx.resume().catch(()=>{})}
  close(){if(this.ctx){this.ctx.close().catch(()=>{});this.ctx=null}}
  allowed(kind){
   const p=this.prefs;if(!p.enabled)return false;
   if(kind==='start'||kind==='stop')return p.micCues;
   if(kind==='mistake')return p.mistake!=='off';
   if(kind==='complete')return p.complete;
   if(kind==='connection')return p.connection;
   if(kind==='tap')return p.taps;
   return true;
  }
  vibrate(kind){
   if(!this.prefs.enabled||!this.prefs.vibrate||!this.allowed(kind))return false;
   try{return !!root.navigator?.vibrate?.(VIBRATION[kind]||[30])}catch{return false}
  }
  // play(kind, {force}) — force is used by the preview buttons in settings.
  play(kind,{force=false,variant=null}={}){
   if(!force&&!this.allowed(kind))return false;
   const t=Date.now(),gap=kind==='mistake'?650:kind==='tap'?40:150;
   if(!force){if(t-(this.lastAt.get(kind)||0)<gap)return false;this.lastAt.set(kind,t)}
   const ctx=this.context();if(!ctx)return false;
   const run=()=>{try{this.render(ctx,kind,variant||this.prefs.mistakeSound)}catch{}};
   if(ctx.state==='suspended')ctx.resume().then(run).catch(()=>{});else run();
   return true;
  }
  render(ctx,kind,variant){
   const out=ctx.createGain(),at=ctx.currentTime+.005;out.gain.value=Math.max(0.0001,this.prefs.volume);out.connect(ctx.destination);
   const tone=(f,start,dur,{type='sine',to=null,peak=.25,attack=.008,detune=0}={})=>{
    const osc=ctx.createOscillator(),g=ctx.createGain(),s=at+start;
    osc.type=type;osc.frequency.setValueAtTime(f,s);if(detune)osc.detune.value=detune;
    if(to)osc.frequency.exponentialRampToValueAtTime(to,s+dur);
    g.gain.setValueAtTime(.0001,s);g.gain.exponentialRampToValueAtTime(peak,s+attack);g.gain.exponentialRampToValueAtTime(.0001,s+dur);
    osc.connect(g);g.connect(out);osc.start(s);osc.stop(s+dur+.02);osc.onended=()=>{osc.disconnect();g.disconnect()};
   };
   const bell=(f,start,dur,peak=.18)=>{tone(f,start,dur,{peak});tone(f*2.01,start,dur*.6,{peak:peak*.35});tone(f*2.76,start,dur*.35,{peak:peak*.18})};
   const noise=(start,dur,freq,peak=.3)=>{
    const length=Math.max(1,Math.floor(ctx.sampleRate*dur)),buffer=ctx.createBuffer(1,length,ctx.sampleRate),data=buffer.getChannelData(0);
    for(let i=0;i<length;i++)data[i]=(Math.random()*2-1)*(1-i/length)**3;
    const src=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),g=ctx.createGain(),s=at+start;
    filter.type='bandpass';filter.frequency.value=freq;filter.Q.value=4;g.gain.value=peak;
    src.buffer=buffer;src.connect(filter);filter.connect(g);g.connect(out);src.start(s);src.onended=()=>{src.disconnect();filter.disconnect();g.disconnect()};
   };
   if(kind==='start'){bell(587,0,.22,.16);bell(880,.09,.32,.16)}
   else if(kind==='stop'){bell(880,0,.2,.14);bell(587,.09,.3,.14)}
   else if(kind==='complete'){[523,659,784,1047].forEach((f,i)=>bell(f,i*.11,.55,.13))}
   else if(kind==='connection'){tone(392,0,.18,{type:'triangle',peak:.2});tone(311,.2,.26,{type:'triangle',peak:.2})}
   else if(kind==='tap'){tone(1400,0,.03,{peak:.08,attack:.002})}
   else if(kind==='mistake'){
    if(variant==='soft'){tone(330,0,.28,{to:247,peak:.28})}
    else if(variant==='bell'){bell(659,0,.7,.22);bell(622,.16,.7,.18)}
    else if(variant==='double'){tone(440,0,.11,{type:'triangle',peak:.3});tone(440,.16,.11,{type:'triangle',peak:.3})}
    else if(variant==='buzz'){const lp=ctx.createBiquadFilter();lp.type='lowpass';lp.frequency.value=900;lp.connect(out);
     const osc=ctx.createOscillator(),g=ctx.createGain();osc.type='square';osc.frequency.value=150;g.gain.setValueAtTime(.0001,at);g.gain.exponentialRampToValueAtTime(.18,at+.01);g.gain.setValueAtTime(.18,at+.16);g.gain.exponentialRampToValueAtTime(.0001,at+.22);
     osc.connect(g);g.connect(lp);osc.start(at);osc.stop(at+.25);osc.onended=()=>{osc.disconnect();g.disconnect();lp.disconnect()}}
    else if(variant==='fall'){tone(560,0,.32,{to:280,peak:.26,type:'triangle'})}
    else{noise(0,.06,900,.55);tone(190,0,.12,{to:120,peak:.35,attack:.003});noise(.13,.06,1000,.45);tone(200,.13,.12,{to:125,peak:.3,attack:.003})}
   }
   setTimeout(()=>{try{out.disconnect()}catch{}},2500);
  }
 }
 return {version:34,KEY,DEFAULTS,MISTAKE_SOUNDS,SENSITIVITY,VIBRATION,load,save,shouldAlert,Player};
});
