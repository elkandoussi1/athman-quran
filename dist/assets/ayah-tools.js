/* أثمان — المقرئون والتفاسير ومعاني الكلمات (الإصدار 37).
   - مقرئون لكل رواية: ورش (ملف السورة كاملًا مع توقيت كل آية بترقيم ورش)،
     وحفص (ملف لكل آية من everyayah.com).
   - التفاسير بترقيم حفص؛ تُقابَل آيات ورش بآيات حفص عبر warsh-hafs.json.
   - معاني الكلمات من «الميسر في غريب القرآن». */
(function(root,factory){
 'use strict';
 const api=factory(root);
 if(typeof module==='object'&&module.exports)module.exports=api;else root.ATHMAN_AYAH=api;
})(typeof window==='object'?window:globalThis,function(root){
 'use strict';
 const doc=root.document;
 const RIWAYA=root.ATHMAN_RIWAYA?.id==='hafs'?'hafs':'warsh';
 const BASE=(()=>{try{return new URL('.',doc.currentScript?.src||root.location.href).href}catch{return 'assets/'}})();
 const TAFSIR_SHA='311a038bf532fa84566ca1bb2cdbeb210da3d5ed';
 const TAFSIR_REMOTE=[
  (slug,s,a)=>`https://cdn.jsdelivr.net/gh/spa5k/tafsir_api@${TAFSIR_SHA}/tafsir/${slug}/${s}/${a}.json`,
  (slug,s,a)=>`https://raw.githubusercontent.com/spa5k/tafsir_api/${TAFSIR_SHA}/tafsir/${slug}/${s}/${a}.json`
 ];
 const MP3QURAN='https://cdn.mp3quran.net/audio/';
 const EVERYAYAH='https://everyayah.com/data/';

 const RECITERS={
  warsh:[
   {id:'qazabri',name:'عمر القزابري',note:'المغرب · مرتّل',folder:MP3QURAN+'omar-kazabri/r1/'},
   {id:'kouchi',name:'العيون الكوشي',note:'المغرب · مرتّل',folder:MP3QURAN+'laayoun-kouchi/r1/'},
   {id:'husary',name:'محمود خليل الحصري',note:'مصر · مرتّل برواية ورش',folder:MP3QURAN+'mahmoud-husary/r3/'},
   {id:'jazairi',name:'ياسين الجزائري',note:'الجزائر · مرتّل',folder:MP3QURAN+'yassen-jazairi/r1/'}
  ].map(r=>({...r,type:'surah',timings:`audio/warsh-${r.id}.json`})),
  hafs:[
   {id:'husary',name:'محمود خليل الحصري',note:'مرتّل',folder:'Husary_128kbps'},
   {id:'husary-muallim',name:'الحصري — المصحف المعلّم',note:'للحفظ والترديد',folder:'Husary_Muallim_128kbps'},
   {id:'minshawi',name:'محمد صديق المنشاوي',note:'مرتّل',folder:'Minshawy_Murattal_128kbps'},
   {id:'abdulbasit',name:'عبد الباسط عبد الصمد',note:'مرتّل',folder:'Abdul_Basit_Murattal_192kbps'},
   {id:'alafasy',name:'مشاري راشد العفاسي',note:'مرتّل',folder:'Alafasy_128kbps'},
   {id:'maher',name:'ماهر المعيقلي',note:'مرتّل',folder:'MaherAlMuaiqly128kbps'},
   {id:'sudais',name:'عبد الرحمن السديس',note:'مرتّل',folder:'Abdurrahmaan_As-Sudais_192kbps'},
   {id:'shuraim',name:'سعود الشريم',note:'مرتّل',folder:'Saood_ash-Shuraym_128kbps'},
   {id:'ghamdi',name:'سعد الغامدي',note:'مرتّل',folder:'Ghamadi_40kbps'},
   {id:'basfar',name:'عبد الله بصفر',note:'مرتّل',folder:'Abdullah_Basfar_192kbps'}
  ].map(r=>({...r,type:'ayah'}))
 };
 // ترتيب التفاسير: الأيسر والأوثق أولًا، ثم أمهات التفسير المعتمدة في الغرب الإسلامي.
 const TAFSIRS=[
  {id:'muyassar',name:'التفسير الميسر',short:'الميسر',by:'نخبة من العلماء — مجمع الملك فهد',note:'مختصر واضح العبارة، يناسب الفهم السريع والتلاميذ.',local:true},
  {id:'jalalayn',name:'تفسير الجلالين',short:'الجلالين',by:'جلال الدين المحلي وجلال الدين السيوطي',note:'مختصر متداول في الكتاتيب والمدارس العتيقة بالمغرب.',local:true},
  {id:'ibn-atiyya',name:'المحرر الوجيز',short:'ابن عطية',by:'ابن عطية الأندلسي (ت 542هـ)',note:'تفسير مالكي أندلسي، من أصول التفسير في الغرب الإسلامي.',slug:'al-muharrar-al-wajiz-ibn-atiyyah'},
  {id:'qurtubi',name:'الجامع لأحكام القرآن',short:'القرطبي',by:'أبو عبد الله القرطبي المالكي (ت 671هـ)',note:'تفسير الأحكام على مذهب مالك، مرجع الفقه والتفسير بالمغرب.',slug:'ar-tafseer-al-qurtubi'},
  {id:'ibn-ashur',name:'التحرير والتنوير',short:'ابن عاشور',by:'محمد الطاهر ابن عاشور المالكي (ت 1393هـ)',note:'تفسير مالكي مغاربي في البلاغة والمقاصد.',slug:'ar-tafseer-tahrir-al-tanwir'},
  {id:'ibn-kathir',name:'تفسير القرآن العظيم',short:'ابن كثير',by:'الحافظ ابن كثير (ت 774هـ)',note:'تفسير بالمأثور: الآيات والأحاديث وأقوال السلف.',slug:'ar-tafsir-ibn-kathir'},
  {id:'tabari',name:'جامع البيان',short:'الطبري',by:'ابن جرير الطبري (ت 310هـ)',note:'إمام المفسرين، أوسع تفسير بالمأثور.',slug:'ar-tafsir-al-tabari'},
  {id:'saadi',name:'تيسير الكريم الرحمن',short:'السعدي',by:'عبد الرحمن السعدي (ت 1376هـ)',note:'عبارة سهلة مع فوائد وهدايات.',slug:'ar-tafseer-al-saddi'}
 ];
 const GHARIB={id:'gharib',name:'الميسر في غريب القرآن',by:'مجمع الملك فهد لطباعة المصحف الشريف'};
 const REPEATS=[1,2,3,5,10,0];// 0 = بلا حد
 const RATES=[0.75,0.9,1,1.15,1.3];
 const KEY='athman-ayah-v1';
 const prefs={warsh:'qazabri',hafs:'husary',tafsir:'muyassar',repeat:1,rate:1,continuous:true,follow:true,turn:true};
 try{Object.assign(prefs,JSON.parse(root.localStorage.getItem(KEY)||'{}'))}catch{}
 if(!TAFSIRS.some(t=>t.id===prefs.tafsir))prefs.tafsir='muyassar';
 if(!REPEATS.includes(prefs.repeat))prefs.repeat=1;
 if(!RATES.includes(prefs.rate))prefs.rate=1;
 function savePrefs(){try{root.localStorage.setItem(KEY,JSON.stringify(prefs))}catch{}}
 const reciters=()=>RECITERS[RIWAYA];
 const reciter=()=>reciters().find(r=>r.id===prefs[RIWAYA])||reciters()[0];

 const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c]);
 const digits=n=>String(n);
 const surahs=()=>root.QURAN_DATA?.surahs||[];
 const surahName=s=>surahs()[s-1]?.name||'';
 const ayahCount=s=>surahs()[s-1]?.ayahs||0;
 const pad=n=>String(n).padStart(3,'0');
 const icon=name=>`<svg class="icon" aria-hidden="true"><use href="#i-${name}"/></svg>`;

 /* ---------- مطابقة الحروف (هيكل الكلمة دون ضبط) ---------- */
 const LETTER_MAP={'ٱ':'','ا':'','أ':'','إ':'','آ':'','ء':'','ى':'ي','ئ':'ي','ؤ':'و','ة':'ه','ـ':''};
 function skeleton(word){
  let out='';
  for(const ch of String(word).normalize('NFKD')){
   const o=ch.codePointAt(0);
   if(/\p{M}/u.test(ch)||o>=0x0600&&o<=0x0605||o>=0x06D6&&o<=0x06ED||o>=0x08A0&&o<=0x08FF)continue;
   const c=ch in LETTER_MAP?LETTER_MAP[ch]:ch;
   if(c>='ء'&&c<='ي')out+=c;
  }
  return out;
 }
 // يحذف حروف العطف والجر و«ال» من أول الكلمة للمقارنة التقريبية.
 const core=w=>{let s=skeleton(w);if(s.length>3&&/^[وف]/.test(s))s=s.slice(1);if(s.length>4&&/^[بكل]ل/.test(s))s=s.slice(2);else if(s.length>3&&s[0]==='ل')s=s.slice(1);return s};

 /* ---------- ورش ← حفص ---------- */
 let mapPromise=null;
 function loadMap(){return mapPromise||(mapPromise=fetch(BASE+'warsh-hafs.json').then(r=>{if(!r.ok)throw new Error('map');return r.json()}).catch(e=>{mapPromise=null;throw e}))}
 async function hafsRange(s,a){
  if(RIWAYA==='hafs')return [a,a];
  const m=await loadMap(),v=m[s-1]?.[a-1];
  if(v===undefined)return [a,a];
  return Array.isArray(v)?v:[v,v];
 }

 /* ---------- التفاسير ---------- */
 const memory=new Map();
 let cachePromise=null;
 const tafsirCache=()=>cachePromise||(cachePromise=(root.caches?.open?.('athman-tafsir-v1')||Promise.resolve(null)).catch(()=>null));
 function localSurah(id,s){
  const key=id+':'+s;
  if(!memory.has(key))memory.set(key,fetch(`${BASE}tafsir/${id}/${s}.json`).then(r=>{if(!r.ok)throw new Error(String(r.status));return r.json()}).catch(e=>{memory.delete(key);throw e}));
  return memory.get(key);
 }
 async function remoteAyah(slug,s,a){
  const key=slug+':'+s+':'+a;
  if(memory.has(key))return memory.get(key);
  const job=(async()=>{
   const cache=await tafsirCache(),primary=TAFSIR_REMOTE[0](slug,s,a);
   let missing=false;
   for(const make of TAFSIR_REMOTE){
    const url=make(slug,s,a);
    try{
     const r=await fetch(url,{mode:'cors'});
     if(r.status===404){missing=true;break}
     if(!r.ok)continue;
     const data=await r.json();
     if(cache)try{await cache.put(primary,new Response(JSON.stringify(data),{headers:{'content-type':'application/json'}}))}catch{}
     return data;
    }catch{/* try the mirror, then the cache */}
   }
   if(!missing&&cache){const hit=await cache.match(primary);if(hit)return hit.json()}
   if(missing)return null;
   throw new Error('offline');
  })();
  memory.set(key,job);job.catch(()=>memory.delete(key));
  return job;
 }
 function tidy(text){
  return String(text||'').replace(/\r/g,'').replace(/^\s*صفحة\s+[٠-٩0-9]+\s*$/gmu,'').replace(/\n{3,}/g,'\n\n').trim();
 }
 /** Returns {parts:[{from,to,text}],intro,info}. Numbers are Hafs numbers. */
 async function tafsir(id,s,a){
  const info=TAFSIRS.find(t=>t.id===id)||TAFSIRS[0];
  const [lo,hi]=await hafsRange(s,a);
  const parts=[];let intro='';
  if(info.local){
   const data=await localSurah(info.id,s),list=data.ayahs||[];
   if(lo===1||lo===2&&s===1&&RIWAYA==='warsh')intro=data.intro||'';
   for(let h=lo;h<=hi;h++){
    const text=list[h-1];if(!text)continue;
    let from=h,to=h;while(from>1&&list[from-2]===text)from--;while(to<list.length&&list[to]===text)to++;
    if(parts.some(p=>p.text===text))continue;
    parts.push({from,to,text:tidy(text)});
   }
  }else{
   for(let h=lo;h<=hi;h++){
    let data=null,from=h;
    for(let back=0;back<8&&from>=1;back++,from--){data=await remoteAyah(info.slug,s,from);if(data?.text)break}
    if(!data?.text)continue;
    const text=tidy(data.text);if(parts.some(p=>p.text===text))continue;
    parts.push({from,to:h,text});
   }
  }
  return {info,parts,intro:tidy(intro),hafs:[lo,hi]};
 }
 async function meanings(s,a,word=''){
  const [lo,hi]=await hafsRange(s,a),data=await localSurah('gharib',s),list=data.ayahs||[];
  const entries=[];
  for(let h=lo;h<=hi;h++){
   for(const block of String(list[h-1]||'').split(/\n\s*\n/)){
    const m=/﴿([^﴾]+)﴾\s*:?\s*([\s\S]*)/u.exec(block.trim());
    if(m)entries.push({word:m[1].trim(),meaning:m[2].trim(),hafs:h,score:0});
   }
  }
  if(word){
   const w=skeleton(word),c=core(word);
   for(const e of entries){
    const tokens=e.word.split(/\s+/).map(skeleton),ctoks=e.word.split(/\s+/).map(core);
    e.score=tokens.includes(w)?3:ctoks.includes(c)&&c.length>1?2:(c.length>2&&ctoks.some(t=>t.includes(c)||c.includes(t)&&t.length>2))?1:0;
   }
  }
  return entries;
 }

 /* ---------- المشغل ---------- */
 const listeners=new Set();
 const state={sura:0,aya:0,playing:false,loading:false,error:'',count:1,limit:prefs.repeat,continuous:prefs.continuous,progress:0,preface:false,reciter:reciter().id};
 let lastFinish='';
 function emit(kind){for(const fn of [...listeners])try{fn(state,kind)}catch(e){console.error(e)}}
 const audio=typeof root.Audio==='function'?new root.Audio():null;
 const nextAudio=typeof root.Audio==='function'?new root.Audio():null;
 if(audio)audio.preload='auto';
 if(nextAudio)nextAudio.preload='auto';
 const timings=new Map();
 function loadTimings(r){
  if(!timings.has(r.id))timings.set(r.id,fetch(BASE+r.timings).then(x=>{if(!x.ok)throw new Error('timings');return x.json()}).catch(e=>{timings.delete(r.id);throw e}));
  return timings.get(r.id);
 }
 const ayahURL=(r,s,a)=>`${EVERYAYAH}${r.folder}/${pad(s)}${pad(a)}.mp3`;
 let window_=null,seq=0,frame=null,poll=null;
 function srcIs(url){try{return audio.src===new URL(url).href}catch{return false}}
 function waitMeta(){
  if(audio.readyState>=1)return Promise.resolve();
  return new Promise((resolve,reject)=>{
   const ok=()=>{off();resolve()},bad=()=>{off();reject(new Error('media'))};
   const off=()=>{audio.removeEventListener('loadedmetadata',ok);audio.removeEventListener('error',bad)};
   audio.addEventListener('loadedmetadata',ok);audio.addEventListener('error',bad);
  });
 }
 async function load(s,a,{fromStart=false}={}){
  const r=reciter(),my=++seq;
  state.reciter=r.id;state.sura=s;state.aya=a;state.loading=true;state.error='';state.progress=0;window_=null;emit('ayah');
  try{
   if(r.type==='surah'){
    const t=await loadTimings(r);if(my!==seq)return;
    const row=t.surahs[s-1],k=(a-1)*2;if(!row||row[k]===undefined)throw new Error('timing');
    window_={start:row[k]/100,end:row[k+1]/100};
    const url=r.folder+pad(s)+'.mp3';
    if(!srcIs(url)){audio.src=url;audio.load()}
    await waitMeta();if(my!==seq)return;
    const at=fromStart?0:window_.start;
    if(Math.abs(audio.currentTime-at)>0.25)audio.currentTime=at;
   }else{
    const wantPreface=state.preface;
    const url=wantPreface?ayahURL(r,1,1):ayahURL(r,s,a);
    if(!srcIs(url)){audio.src=url;audio.load()}else audio.currentTime=0;
    // يُحمَّل ملف الآية التالية مسبقًا لتقليل الفجوة.
    if(nextAudio&&a<ayahCount(s))try{nextAudio.src=ayahURL(r,s,wantPreface?a:a+1)}catch{}
   }
   audio.playbackRate=prefs.rate;
   await audio.play();if(my!==seq)return;
   state.loading=false;state.playing=true;emit('play');watch();media();
  }catch(e){
   if(my!==seq)return;
   state.loading=false;state.playing=false;
   state.error=e?.name==='NotAllowedError'?'اضغط زر التشغيل للاستماع.':'تعذّر تحميل التلاوة. تحقق من الاتصال بالإنترنت ثم أعد المحاولة.';
   emit('error');
  }
 }
 function watch(){
  if(frame!==null&&root.cancelAnimationFrame)root.cancelAnimationFrame(frame);frame=null;
  clearInterval(poll);
  const tick=()=>{
   if(!state.playing)return;
   if(window_){
    const len=Math.max(0.1,window_.end-window_.start);
    state.progress=Math.max(0,Math.min(1,(audio.currentTime-window_.start)/len));
    if(audio.currentTime>=window_.end-0.04)return finished();
   }else if(audio.duration)state.progress=audio.currentTime/audio.duration;
   emit('progress');
  };
  poll=setInterval(tick,80);
 }
 function finished(){
  // يمنع التقدم مرتين للآية نفسها (نهاية التوقيت وحدث ended معًا).
  const key=seq+':'+state.sura+':'+state.aya+':'+state.count+':'+state.preface;if(key===lastFinish)return;lastFinish=key;
  if(state.preface){state.preface=false;return load(state.sura,state.aya)}
  const r=reciter(),limit=state.limit||Infinity;
  if(state.count<limit){state.count++;emit('repeat');return replay()}
  state.count=1;
  if(!state.continuous){pause();if(window_)audio.currentTime=window_.start;emit('end');return}
  let s=state.sura,a=state.aya+1;
  if(a>ayahCount(s)){
   s++;a=1;
   if(s>114){stop();return}
   state.preface=r.type==='ayah'&&s!==9;
   return load(s,a,{fromStart:r.type==='surah'});
  }
  if(r.type==='surah'&&window_){
   // في ملف السورة الواحد تتصل الآيات: نحدّث الآية دون إعادة التحميل.
   const t=timings.get(r.id);
   return t.then(data=>{
    const row=data.surahs[s-1],k=(a-1)*2;window_={start:row[k]/100,end:row[k+1]/100};
    state.aya=a;state.progress=0;
    if(audio.currentTime<window_.start-0.6||audio.currentTime>window_.start+0.6)audio.currentTime=window_.start;
    emit('ayah');media();
   });
  }
  return load(s,a);
 }
 function replay(){if(window_){audio.currentTime=window_.start;emit('ayah');return audio.play().catch(()=>{})}return load(state.sura,state.aya)}
 if(audio){
  audio.addEventListener('ended',()=>{if(state.playing)finished()});
  audio.addEventListener('error',()=>{if(state.playing||state.loading){state.playing=false;state.loading=false;state.error='تعذّر تحميل التلاوة. تحقق من الاتصال بالإنترنت ثم أعد المحاولة.';clearInterval(poll);emit('error')}});
  audio.addEventListener('waiting',()=>{if(state.playing){state.loading=true;emit('progress')}});
  audio.addEventListener('playing',()=>{if(state.loading){state.loading=false;emit('progress')}});
 }
 function play(s,a,{continuous=prefs.continuous,withBasmala=true,repeat=prefs.repeat}={}){
  if(!audio)return;
  const r=reciter();
  state.count=1;state.continuous=continuous;state.limit=repeat;lastFinish='';
  state.preface=r.type==='ayah'&&withBasmala&&continuous&&a===1&&s!==1&&s!==9;
  return load(s,a,{fromStart:r.type==='surah'&&withBasmala&&continuous&&a===1});
 }
 function pause(){if(!audio)return;audio.pause();state.playing=false;clearInterval(poll);emit('pause')}
 function resume(){if(!audio||!state.sura)return;state.error='';if(audio.src&&!state.error){audio.playbackRate=prefs.rate;audio.play().then(()=>{state.playing=true;emit('play');watch()}).catch(()=>load(state.sura,state.aya))}else load(state.sura,state.aya)}
 function toggle(){state.playing?pause():resume()}
 function stop(){if(!audio)return;seq++;audio.pause();clearInterval(poll);state.playing=false;state.loading=false;state.sura=0;state.aya=0;state.progress=0;window_=null;emit('stop')}
 function step(dir){
  if(!state.sura)return;let s=state.sura,a=state.aya+dir;
  if(a<1){if(s===1)return;s--;a=ayahCount(s)}else if(a>ayahCount(s)){if(s===114)return;s++;a=1}
  state.count=1;state.preface=false;load(s,a);
 }
 function setReciter(id){
  if(!reciters().some(r=>r.id===id))return;prefs[RIWAYA]=id;savePrefs();
  const was=state.playing,s=state.sura,a=state.aya;state.reciter=id;
  emit('reciter');
  if(state.sura){seq++;audio.pause();audio.removeAttribute('src');window_=null;state.playing=false;clearInterval(poll);if(was)load(s,a);else emit('pause')}
 }
 function setRepeat(n){prefs.repeat=REPEATS.includes(n)?n:1;state.limit=prefs.repeat;savePrefs();state.count=1;emit('prefs')}
 function setRate(v){prefs.rate=RATES.includes(v)?v:1;savePrefs();if(audio)audio.playbackRate=prefs.rate;emit('prefs')}
 function setContinuous(on){prefs.continuous=!!on;state.continuous=prefs.continuous;savePrefs();emit('prefs')}
 function media(){
  const ms=root.navigator?.mediaSession;if(!ms||!root.MediaMetadata)return;
  try{
   ms.metadata=new root.MediaMetadata({title:`سورة ${surahName(state.sura)} — الآية ${state.aya}`,artist:reciter().name,album:'أثمان'});
   ms.setActionHandler('play',resume);ms.setActionHandler('pause',pause);
   ms.setActionHandler('previoustrack',()=>step(-1));ms.setActionHandler('nexttrack',()=>step(1));
  }catch{}
 }
 const player={state,play,pause,resume,toggle,stop,step,setReciter,setRepeat,setRate,setContinuous,
  subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn)},get audio(){return audio}};

 /* ---------- شريط المشغل داخل القارئ ---------- */
 let bar=null;
 function barHTML(){
  return `<div class="ayah-player-main">
   <button type="button" class="ayah-player-btn" data-ap="close" aria-label="إغلاق المشغل">${icon('close')}</button>
   <button type="button" class="ayah-player-who" data-ap="reciters" aria-haspopup="true" aria-expanded="false"><b data-ap-name></b><span data-ap-where></span></button>
   <div class="ayah-player-controls" dir="ltr">
    <button type="button" class="ayah-player-btn" data-ap="next" aria-label="الآية التالية">${icon('ap-prev')}</button>
    <button type="button" class="ayah-player-btn ayah-player-play" data-ap="toggle" aria-label="تشغيل">${icon('ap-play')}</button>
    <button type="button" class="ayah-player-btn" data-ap="prev" aria-label="الآية السابقة">${icon('ap-next')}</button>
   </div>
   <button type="button" class="ayah-player-chip" data-ap="repeat" aria-label="عدد التكرار"></button>
   <button type="button" class="ayah-player-chip" data-ap="mode" aria-label="طريقة التشغيل"></button>
  </div>
  <div class="ayah-player-progress"><span data-ap-progress></span></div>
  <div class="ayah-player-list" data-ap-list hidden></div>`;
 }
 function attachBar(host){
  if(!host||!doc)return null;
  if(!bar){
   bar=doc.createElement('div');bar.className='ayah-player';bar.setAttribute('role','region');bar.setAttribute('aria-label','مشغل التلاوة');bar.hidden=true;bar.innerHTML=barHTML();
   bar.addEventListener('click',event=>{
    const b=event.target.closest('[data-ap]');if(!b)return;const k=b.dataset.ap;
    if(k==='toggle')toggle();else if(k==='next')step(1);else if(k==='prev')step(-1);
    else if(k==='close'){stop();bar.hidden=true}
    else if(k==='repeat'){const i=REPEATS.indexOf(prefs.repeat);setRepeat(REPEATS[(i+1)%REPEATS.length])}
    else if(k==='mode')setContinuous(!prefs.continuous);
    else if(k==='reciters'){const list=bar.querySelector('[data-ap-list]');list.hidden=!list.hidden;b.setAttribute('aria-expanded',String(!list.hidden));if(!list.hidden)paintList(list)}
    else if(k==='pick'){setReciter(b.dataset.id);const list=bar.querySelector('[data-ap-list]');list.hidden=true;bar.querySelector('[data-ap="reciters"]').setAttribute('aria-expanded','false')}
   });
   player.subscribe(paintBar);
  }
  if(bar.parentNode!==host)host.append(bar);
  paintBar(state,'attach');
  return bar;
 }
 function paintList(list){
  list.innerHTML=`<p>${RIWAYA==='hafs'?'مقرئون برواية حفص عن عاصم':'مقرئون برواية ورش عن نافع'}</p>`+reciters().map(r=>`<button type="button" data-ap="pick" data-id="${r.id}" aria-pressed="${r.id===reciter().id}"><b>${esc(r.name)}</b><small>${esc(r.note)}</small></button>`).join('');
 }
 function paintBar(st,kind){
  if(!bar)return;
  if(kind==='play'||kind==='ayah')bar.hidden=false;
  const r=reciter();
  bar.querySelector('[data-ap-name]').textContent=r.name;
  bar.querySelector('[data-ap-where]').textContent=st.error||(st.sura?`سورة ${surahName(st.sura)} · الآية ${st.aya}${st.loading?' · جارٍ التحميل…':''}${st.limit!==1?` · ${st.count}/${st.limit||'∞'}`:''}`:'اختر آية للاستماع');
  const t=bar.querySelector('[data-ap="toggle"]');t.innerHTML=icon(st.playing?'ap-pause':'ap-play');t.setAttribute('aria-label',st.playing?'إيقاف مؤقت':'تشغيل');
  bar.querySelector('[data-ap="repeat"]').textContent=prefs.repeat===0?'تكرار ∞':prefs.repeat===1?'دون تكرار':`تكرار ×${prefs.repeat}`;
  bar.querySelector('[data-ap="mode"]').textContent=prefs.continuous?'متواصل':'آية واحدة';
  bar.querySelector('[data-ap-progress]').style.inlineSize=Math.round((st.progress||0)*100)+'%';
  bar.classList.toggle('is-loading',!!st.loading);bar.classList.toggle('has-error',!!st.error);
 }

 /* ---------- لوحة الآية: التفسير ومعاني الكلمات ---------- */
 let sheet=null,current=null,sheetSeq=0;
 function ensureSheet(host){
  if(!doc)return null;
  if(!sheet){
   sheet=doc.createElement('dialog');sheet.className='ayah-sheet';sheet.setAttribute('aria-labelledby','ayahSheetTitle');
   sheet.innerHTML=`<div class="ayah-sheet-card">
    <header class="ayah-sheet-head"><span class="ayah-sheet-grip" aria-hidden="true"></span>
     <div><small id="ayahSheetMeta"></small><h2 id="ayahSheetTitle"></h2></div>
     <button type="button" class="icon-button" data-as="close" aria-label="إغلاق">${icon('close')}</button></header>
    <div class="ayah-sheet-scroll">
     <p class="ayah-sheet-text" id="ayahSheetText"></p>
     <div class="ayah-sheet-actions">
      <button type="button" data-as="play">${icon('ap-play')}<span>استمع</span></button>
      <button type="button" data-as="repeat">${icon('ap-repeat')}<span>كرّرها</span></button>
      <button type="button" data-as="recite">${icon('mic')}<span>سمّعها</span></button>
      <button type="button" data-as="copy">${icon('copy')}<span>نسخ</span></button>
     </div>
     <div class="ayah-sheet-tabs" role="tablist">
      <button type="button" role="tab" data-as-tab="tafsir" id="ayahTabTafsir">التفسير</button>
      <button type="button" role="tab" data-as-tab="words" id="ayahTabWords">معاني الكلمات</button>
     </div>
     <section data-as-panel="tafsir" role="tabpanel" aria-labelledby="ayahTabTafsir">
      <div class="ayah-tafsir-picker" role="radiogroup" aria-label="اختر التفسير">${TAFSIRS.map(t=>`<button type="button" role="radio" data-as-tafsir="${t.id}"${t.local?'':' data-remote'}>${esc(t.short)}</button>`).join('')}</div>
      <div class="ayah-tafsir-about" id="ayahTafsirAbout"></div>
      <article class="ayah-tafsir-body" id="ayahTafsirBody" aria-live="polite"></article>
     </section>
     <section data-as-panel="words" role="tabpanel" aria-labelledby="ayahTabWords" hidden>
      <article class="ayah-words-body" id="ayahWordsBody" aria-live="polite"></article>
     </section>
    </div>
    <footer class="ayah-sheet-foot" dir="ltr">
     <button type="button" data-as="next" class="ayah-sheet-nav">${icon('ap-prev')}<span>الآية التالية</span></button>
     <button type="button" data-as="prev" class="ayah-sheet-nav">الآية السابقة${icon('ap-next')}</button>
    </footer></div>`;
   sheet.addEventListener('click',onSheetClick);
   sheet.addEventListener('close',()=>{sheetSeq++;current?.onClose?.()});
   sheet.addEventListener('cancel',()=>{});
  }
  const target=host||doc.body;if(sheet.parentNode!==target)target.append(sheet);
  return sheet;
 }
 function onSheetClick(event){
  if(event.target===sheet){const r=sheet.querySelector('.ayah-sheet-card').getBoundingClientRect();if(event.clientY<r.top||event.clientX<r.left||event.clientX>r.right){sheet.close();return}}
  const t=event.target.closest('[data-as-tafsir]');if(t){prefs.tafsir=t.dataset.asTafsir;savePrefs();paintTafsir();return}
  const tab=event.target.closest('[data-as-tab]');if(tab){showTab(tab.dataset.asTab);return}
  const go=event.target.closest('[data-as-go]');if(go){showTab(go.dataset.asGo);return}
  const retry=event.target.closest('[data-as-retry]');if(retry){current.tab==='words'?paintWords():paintTafsir();return}
  const b=event.target.closest('[data-as]');if(!b||!current)return;const k=b.dataset.as;
  if(k==='close')sheet.close();
  else if(k==='play'){current.onPlay?.(current);play(current.sura,current.aya,{continuous:false,repeat:1})}
  else if(k==='repeat'){current.onPlay?.(current);play(current.sura,current.aya,{continuous:false,repeat:prefs.repeat>1?prefs.repeat:3})}
  else if(k==='recite'){const c=current;sheet.close();c.onRecite?.(c)}
  else if(k==='copy'){const text=`${current.text} ﴿${current.aya}﴾ [${surahName(current.sura)}: ${current.aya}]`;root.navigator?.clipboard?.writeText(text).then(()=>flash(b,'نُسخت'),()=>flash(b,'تعذّر'))}
  else if(k==='next'||k==='prev'){
   let s=current.sura,a=current.aya+(k==='next'?1:-1);
   if(a<1){if(s===1)return;s--;a=ayahCount(s)}else if(a>ayahCount(s)){if(s===114)return;s++;a=1}
   openSheet({...current,sura:s,aya:a,word:'',text:current.textFor?.(s,a)||''});
  }
 }
 function flash(button,text){const span=button.querySelector('span');if(!span)return;const old=span.textContent;span.textContent=text;setTimeout(()=>{span.textContent=old},1400)}
 function showTab(id){
  current.tab=id;
  for(const b of sheet.querySelectorAll('[data-as-tab]')){const on=b.dataset.asTab===id;b.setAttribute('aria-selected',String(on));b.tabIndex=on?0:-1}
  for(const p of sheet.querySelectorAll('[data-as-panel]'))p.hidden=p.dataset.asPanel!==id;
  id==='words'?paintWords():paintTafsir();
 }
 function paragraphs(text){
  return text.split(/\n+/).filter(Boolean).map(p=>`<p>${esc(p).replace(/﴿([^﴾]{1,400})﴾/g,'<q class="ayah-quote">﴿$1﴾</q>')}</p>`).join('');
 }
 const loadingHTML='<div class="ayah-loading" role="status"><span></span>جارٍ التحميل…</div>';
 const errorHTML=(remote)=>`<div class="ayah-error"><p>${remote?'تعذّر جلب هذا التفسير. يحتاج أول فتح له إلى الإنترنت، ثم يبقى محفوظًا على جهازك.':'تعذّر التحميل. تحقق من الاتصال ثم أعد المحاولة.'}</p><button type="button" data-as-retry>إعادة المحاولة</button></div>`;
 function hafsNote(lo,hi){
  if(RIWAYA!=='warsh')return '';
  if(lo===current.aya&&hi===current.aya)return '';
  return `<p class="ayah-numbering">يقابلها في ترقيم حفص المعتمد في كتب التفسير: ${lo===hi?'الآية '+lo:'الآيتان '+lo+' و'+hi}.</p>`;
 }
 async function paintTafsir(){
  const my=++sheetSeq,id=prefs.tafsir,info=TAFSIRS.find(t=>t.id===id);
  for(const b of sheet.querySelectorAll('[data-as-tafsir]'))b.setAttribute('aria-checked',String(b.dataset.asTafsir===id));
  sheet.querySelector(`[data-as-tafsir="${id}"]`)?.scrollIntoView?.({block:'nearest',inline:'nearest'});
  sheet.querySelector('#ayahTafsirAbout').innerHTML=`<b>${esc(info.name)}</b> — ${esc(info.by)}<small>${esc(info.note)}</small>`;
  const body=sheet.querySelector('#ayahTafsirBody');body.innerHTML=loadingHTML;
  try{
   const res=await tafsir(id,current.sura,current.aya);if(my!==sheetSeq)return;
   const [lo,hi]=res.hafs;let html=hafsNote(lo,hi);
   if(res.intro)html+=`<details class="ayah-intro"><summary>مقدمة السورة: تسميتها ومقاصدها</summary>${paragraphs(res.intro)}</details>`;
   if(!res.parts.length)html+='<p class="ayah-empty">لا يوجد في هذا التفسير كلام مستقل على هذه الآية. جرّب تفسيرًا آخر.</p>';
   for(const p of res.parts){
    const label=p.from!==p.to?`تفسير الآيات ${p.from}–${p.to}`:(lo!==hi?`الآية ${p.from}`:'');
    html+=`${label?`<h3 class="ayah-part-label">${label}${RIWAYA==='warsh'?' <small>بترقيم حفص</small>':''}</h3>`:''}${paragraphs(p.text)}`;
   }
   body.innerHTML=html;
  }catch{if(my===sheetSeq)body.innerHTML=errorHTML(!info.local)}
 }
 async function paintWords(){
  const my=++sheetSeq,body=sheet.querySelector('#ayahWordsBody');body.innerHTML=loadingHTML;
  try{
   const list=await meanings(current.sura,current.aya,current.word);if(my!==sheetSeq)return;
   const best=Math.max(0,...list.map(e=>e.score));
   let html='';
   if(current.word){
    const hit=list.filter(e=>best>0&&e.score===best);
    html+=`<div class="ayah-word-focus"><span class="ayah-word-big">${esc(current.word)}</span>${hit.length?hit.map(e=>`<p>${esc(e.meaning)}</p>`).join(''):'<p class="ayah-empty">لم يذكر «الميسر في غريب القرآن» هذه الكلمة في هذه الآية؛ فهي ظاهرة المعنى غالبًا. اقرأ معنى الآية كاملًا في التفسير.</p>'}<button type="button" class="ayah-link" data-as-go="tafsir">تفسير الآية كاملة</button></div>`;
   }
   const rest=current.word?list.filter(e=>!(best>0&&e.score===best)):list;
   if(rest.length)html+=`${current.word?'<h3 class="ayah-part-label">كلمات أخرى في الآية</h3>':''}<dl class="ayah-glossary">${rest.map(e=>`<div><dt>﴿${esc(e.word)}﴾</dt><dd>${esc(e.meaning)}</dd></div>`).join('')}</dl>`;
   else if(!current.word)html+='<p class="ayah-empty">لا توجد كلمات غريبة في هذه الآية.</p>';
   html+=`<p class="ayah-source">المصدر: ${esc(GHARIB.name)} — ${esc(GHARIB.by)}.</p>`;
   body.innerHTML=html;
  }catch{if(my===sheetSeq)body.innerHTML=errorHTML(false)}
 }
 function openSheet(opts){
  const el=ensureSheet(opts.host||current?.host);if(!el)return;
  current={tab:opts.word?'words':'tafsir',...opts};
  el.querySelector('#ayahSheetMeta').textContent=`سورة ${surahName(current.sura)} · الآية ${current.aya}${RIWAYA==='warsh'?' · ترقيم ورش':''}`;
  el.querySelector('#ayahSheetTitle').textContent=current.word?`معنى «${current.word}»`:'تفسير الآية ومعانيها';
  el.querySelector('#ayahSheetText').textContent=current.text||'';
  el.querySelector('#ayahSheetText').hidden=!current.text;
  el.querySelector('[data-as="recite"]').hidden=!current.onRecite;
  if(!el.open){try{el.showModal()}catch{el.setAttribute('open','')}}
  el.querySelector('.ayah-sheet-scroll').scrollTop=0;
  showTab(current.tab);
 }
 function closeSheet(){if(sheet?.open)sheet.close()}

 /* ---------- لوحة الإعدادات: «الاستماع والتفسير» ---------- */
 function settingsHTML(){
  const radios=(name,items,value)=>items.map(r=>`<label class="ayah-choice"><input type="radio" name="${name}" value="${r.id}"${r.id===value?' checked':''}><span><b>${esc(r.name)}</b><small>${esc(r.note)}</small></span></label>`).join('');
  return `<section class="settings-group" aria-labelledby="settingsRecitersTitle">
   <h3 id="settingsRecitersTitle">القارئ — ${RIWAYA==='hafs'?'رواية حفص عن عاصم':'رواية ورش عن نافع'}</h3>
   <div class="ayah-choices" data-ayah-pref="reciter">${radios('athmanReciter',reciters(),reciter().id)}</div>
   <p class="settings-note">${RIWAYA==='hafs'?'تُجلب التلاوة آيةً آيةً من everyayah.com.':'تُجلب تلاوة السورة من mp3quran.net، وتُضبط كل آية بتوقيتها في رواية ورش.'} يحتاج الاستماع إلى الإنترنت.</p>
  </section>
  <section class="settings-group" aria-labelledby="settingsPlaybackTitle">
   <h3 id="settingsPlaybackTitle">طريقة الاستماع</h3>
   <label class="settings-field"><span>تكرار كل آية</span><select id="ayahRepeat" data-ayah-pref="repeat">${REPEATS.map(n=>`<option value="${n}"${n===prefs.repeat?' selected':''}>${n===0?'بلا حد':n===1?'مرة واحدة':n+' مرات'}</option>`).join('')}</select></label>
   <label class="settings-field"><span>سرعة التلاوة</span><select id="ayahRate" data-ayah-pref="rate">${RATES.map(n=>`<option value="${n}"${n===prefs.rate?' selected':''}>${n===1?'عادية':'×'+n}</option>`).join('')}</select></label>
   <label class="settings-switch"><input type="checkbox" id="ayahContinuous" data-ayah-pref="continuous"${prefs.continuous?' checked':''}><span class="settings-switch-track" aria-hidden="true"></span><span class="settings-switch-copy"><b>متابعة الآيات تلقائيًا</b><small>بعد انتهاء الآية تبدأ التالية؛ أطفئه للاستماع إلى آية واحدة.</small></span></label>
   <label class="settings-switch"><input type="checkbox" id="ayahFollow" data-ayah-pref="follow"${prefs.follow?' checked':''}><span class="settings-switch-track" aria-hidden="true"></span><span class="settings-switch-copy"><b>تتبّع الآية المسموعة</b><small>تمييز الآية والتمرير إليها، والانتقال إلى المقطع التالي عند نهايته.</small></span></label>
  </section>
  <section class="settings-group" aria-labelledby="settingsTafsirTitle">
   <h3 id="settingsTafsirTitle">التفسير المفضل</h3>
   <div class="ayah-choices" data-ayah-pref="tafsir">${radios('athmanTafsir',TAFSIRS.map(t=>({id:t.id,name:t.name+' — '+t.short,note:t.note+(t.local?' متاح دون إنترنت بعد أول فتح.':' يُجلب عند الطلب ويُحفظ.')})),prefs.tafsir)}</div>
   <p class="settings-note">اضغط رقم الآية لفتح تفسيرها، واضغط أي كلمة لمعرفة معناها من «الميسر في غريب القرآن». التفاسير بترقيم حفص؛ ويقابل أثمان آيات ورش بما يوافقها تلقائيًا.</p>
  </section>`;
 }
 function bindSettings(container){
  if(!container||container.dataset.ayahBound)return;container.dataset.ayahBound='1';
  container.addEventListener('change',event=>{
   const t=event.target,k=t.closest('[data-ayah-pref]')?.dataset.ayahPref;if(!k)return;
   if(k==='reciter')setReciter(t.value);
   else if(k==='tafsir'){prefs.tafsir=t.value;savePrefs()}
   else if(k==='repeat')setRepeat(Number(t.value));
   else if(k==='rate')setRate(Number(t.value));
   else if(k==='continuous')setContinuous(t.checked);
   else if(k==='follow'){prefs.follow=t.checked;savePrefs();emit('prefs')}
  });
  player.subscribe((st,kind)=>{if(kind!=='prefs'&&kind!=='reciter')return;const r=container.querySelector(`input[name="athmanReciter"][value="${reciter().id}"]`);if(r)r.checked=true;const rep=container.querySelector('#ayahRepeat');if(rep)rep.value=String(prefs.repeat);const c=container.querySelector('#ayahContinuous');if(c)c.checked=prefs.continuous});
 }
 function settingsNodes(){const wrap=doc.createElement('div');wrap.className='ayah-settings';wrap.innerHTML=settingsHTML();bindSettings(wrap);return wrap}

 // القراءة العادية (دون صفحة التسميع): رقم الآية يفتح التفسير.
 doc?.addEventListener('click',event=>{
  const num=event.target.closest?.('#readerText .verse-number');if(!num)return;
  const verse=num.closest('.verse');if(!verse)return;
  const copy=verse.cloneNode(true);copy.querySelector('.verse-number')?.remove();
  openSheet({sura:Number(verse.dataset.sura),aya:Number(verse.dataset.aya),text:copy.textContent.trim(),host:verse.closest('dialog')||undefined});
 });

 return {version:37,RIWAYA,RECITERS,TAFSIRS,GHARIB,REPEATS,RATES,prefs,savePrefs,reciter,reciters,skeleton,core,hafsRange,tafsir,meanings,
  player,attachBar,openSheet,closeSheet,settingsHTML,settingsNodes,bindSettings};
});
