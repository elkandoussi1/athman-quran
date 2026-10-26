/* Local practice journal. Stores source references and counters, never audio or transcripts. */
(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ATHMAN_STUDY=api})(typeof window==='object'?window:null,function(){
 'use strict';
 const minutesLabel=n=>`${n} ${n>=3&&n<=10?'دقائق':'دقيقة'}`;
 const KEY='athman-study-v1',cap=100,validRef=r=>r&&Number.isInteger(r.sura)&&r.sura>=1&&r.sura<=114&&Number.isInteger(r.aya)&&r.aya>=1&&r.aya<=300&&Number.isInteger(r.word)&&r.word>=0&&r.word<1000;
 const ref=r=>({sura:r.sura,aya:r.aya,word:r.word}),key=r=>`${r.sura}:${r.aya}:${r.word}`,day=t=>{const d=new Date(t);return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`};
 function cleanSession(s){
  if(!s||typeof s.id!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(s.id)||!Number.isFinite(s.started)||!Number.isFinite(new Date(s.started).getTime())||!Number.isFinite(s.duration)||!validRef(s.first)||!validRef(s.last))return null;
  const mistakes=Array.isArray(s.mistakes)?s.mistakes.filter(validRef).slice(0,1000).map(m=>({...ref(m),count:Math.max(1,Math.min(1000,Math.floor(Number(m.count)||1))),ignored:!!m.ignored,corrected:!!m.corrected})):[];
  return {id:s.id,started:s.started,duration:Math.max(0,Math.min(86400000,s.duration)),mode:['follow','practice','read'].includes(s.mode)?s.mode:'follow',scope:s.scope==='passage'?'passage':'all',words:Math.max(0,Math.min(100000,Math.floor(Number(s.words)||0))),ayahs:Math.max(0,Math.min(6214,Math.floor(Number(s.ayahs)||0))),first:validRef(s.first)?ref(s.first):null,last:validRef(s.last)?ref(s.last):null,mistakes};
 }
 class Store{
  constructor(storage,{now=()=>Date.now()}={}){
   this.storage=storage;this.now=now;this.active=null;this.lastSaveOK=true;this.data={version:1,goalMinutes:10,sessions:[]};
   try{const s=JSON.parse(storage?.getItem(KEY)||'null');if(s?.version===1&&Array.isArray(s.sessions)){this.data.goalMinutes=Math.max(1,Math.min(180,Math.floor(Number(s.goalMinutes)||10)));this.data.sessions=s.sessions.map(cleanSession).filter(Boolean).slice(0,cap)}}catch{}
  }
  save(){try{if(!this.storage)throw new Error('Storage unavailable');this.storage.setItem(KEY,JSON.stringify(this.data));this.lastSaveOK=true}catch{this.lastSaveOK=false}return this.lastSaveOK}
  begin({mode='follow',scope='all'}={}){if(this.active)this.finish();const id=this.now().toString(36)+'_'+Math.random().toString(36).slice(2,11);this.active={id,started:this.now(),mode,scope,read:new Set(),verses:new Set(),mistakes:new Map(),first:null,last:null};return id}
  record(events=[]){
   const a=this.active;if(!a)return;
   for(const e of events){if(!validRef(e)||!['read','error','uncertain'].includes(e.type))continue;const k=key(e);a.first=a.first||ref(e);a.last=ref(e);
    if(e.type==='read'){a.read.add(k);a.verses.add(e.sura+':'+e.aya);const m=a.mistakes.get(k);if(m)m.corrected=true}
    else{const m=a.mistakes.get(k)||{...ref(e),count:0,ignored:false,corrected:false};m.count++;m.corrected=false;m.ignored=false;a.mistakes.set(k,m)}
   }
  }
  finish(){
   const a=this.active;if(!a)return null;this.active=null;if(!a.first)return null;
   const s=cleanSession({id:a.id,started:a.started,duration:this.now()-a.started,mode:a.mode,scope:a.scope,words:a.read.size,ayahs:a.verses.size,first:a.first,last:a.last,mistakes:[...a.mistakes.values()]});
   this.data.sessions=[s,...this.data.sessions.filter(x=>x.id!==s.id)].slice(0,cap);this.save();return s;
  }
  dismiss(id,reference){
   if(typeof id!=='string')return false;
   const k=key(reference);if(this.active?.id===id){const m=this.active.mistakes.get(k);if(m)m.ignored=true;return !!m}
   const s=this.data.sessions.find(s=>s.id===id),m=s?.mistakes.find(m=>key(m)===k);if(!m)return false;m.ignored=true;this.save();return true;
  }
  history(){
   const found=new Map();for(const s of this.data.sessions)for(const m of s.mistakes){if(m.ignored)continue;const k=key(m),v=found.get(k)||{...ref(m),sessions:0,count:0,last:s.started,sessionId:s.id};v.sessions++;v.count+=m.count;found.set(k,v)}
   return [...found.values()].sort((a,b)=>b.sessions-a.sessions||b.last-a.last);
  }
  frequency(reference){return this.history().find(m=>key(m)===key(reference))?.sessions||0}
  setGoal(minutes){const n=Number(minutes);if(!Number.isInteger(n)||n<1||n>180)throw new Error('اختر هدفًا من 1 إلى 180 دقيقة.');this.data.goalMinutes=n;return this.save()}
  metrics(){
   const today=this.data.sessions.filter(s=>day(s.started)===day(this.now())),minutes=today.reduce((n,s)=>n+s.duration,0)/60000;
   const activeDays=new Set(this.data.sessions.filter(s=>s.words>0).map(s=>day(s.started)));let streak=0,d=new Date(this.now());if(!activeDays.has(day(d.getTime())))d.setDate(d.getDate()-1);
   while(activeDays.has(day(d.getTime()))){streak++;d.setDate(d.getDate()-1)}
   return {sessions:today.length,minutes,words:today.reduce((n,s)=>n+s.words,0),flags:today.reduce((n,s)=>n+s.mistakes.filter(m=>!m.ignored).length,0),goal:this.data.goalMinutes,percent:Math.min(100,Math.floor(minutes/this.data.goalMinutes*100)),streak};
  }
  exportJSON(){return JSON.stringify(this.data,null,2)}
  mergeJSON(text){
   if(typeof text!=='string'||text.length>2000000)throw new Error('حجم النسخة غير صالح.');let incoming;try{incoming=JSON.parse(text)}catch{throw new Error('تعذّر قراءة النسخة.')}
   if(incoming?.version!==1||!Array.isArray(incoming.sessions)||incoming.sessions.length>cap)throw new Error('هذه ليست نسخة جلسات أثمان مدعومة.');
   const rows=incoming.sessions.map(cleanSession);if(rows.some(s=>!s))throw new Error('تتضمن النسخة جلسة غير صالحة.');
   const map=new Map(this.data.sessions.map(s=>[s.id,s]));let added=0;for(const row of rows)if(!map.has(row.id)){map.set(row.id,row);added++}
   this.data.sessions=[...map.values()].sort((a,b)=>b.started-a.started).slice(0,cap);if(!this.save())throw new Error('تعذّر حفظ البيانات على هذا الجهاز.');return added;
  }
 }
 function mount({dialog,store,data,openReference}){
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),label=r=>r?`سورة ${data.surahs[r.sura-1]?.name||r.sura} · الآية ${r.aya} · الكلمة ${r.word+1}`:'موضع غير محدد';
  const date=t=>new Intl.DateTimeFormat('ar-MA-u-nu-latn',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(t));
  let tab='sessions';const $=s=>dialog.querySelector(s);
  function render(){
   const m=store.metrics();dialog.innerHTML=`<div class="study-shell"><header class="study-header"><div><span class="study-eyebrow">صحبةٌ تُرى ثمرتها</span><h2 id="studyTitle">رحلتي مع القرآن</h2></div><button id="studyClose" class="icon-button" aria-label="إغلاق سجل المراجعة">×</button></header><div class="study-summary"><div><strong>${m.words}</strong><span>كلمات طابقتها اليوم</span></div><div><strong>${Math.floor(m.minutes)}</strong><span>دقائق جلسات اليوم</span></div><div><strong>${m.streak}</strong><span>أيام متتابعة</span></div></div><div class="study-goal-summary"><div><span>هدف اليوم · ${minutesLabel(m.goal)}</span><bdi>${m.percent}%</bdi></div><progress max="100" value="${m.percent}" aria-label="تقدم هدف اليوم"></progress></div><nav class="study-tabs" aria-label="أقسام سجل المراجعة">${[['sessions','الجلسات'],['mistakes','مواضع المراجعة'],['goal','هدفي ونسختي']].map(([id,title])=>`<button data-study-tab="${id}" aria-pressed="${tab===id}">${title}</button>`).join('')}</nav><div class="study-content" id="studyContent"></div><p class="study-note">تُحفظ آخر 100 جلسة على هذا الجهاز. العلامة موضع تعذّرت مطابقته آليًا؛ ويمكنك إزالتها إذا كانت غير صحيحة. مدة الجلسة تشمل التوقفات أثناء الاستماع.</p><p id="studyStatus" role="status" aria-live="polite"></p></div>`;
   const content=$('#studyContent');
   if(tab==='sessions')content.innerHTML=store.data.sessions.length?store.data.sessions.map(s=>{const n=s.mistakes.filter(m=>!m.ignored).length;return `<article class="study-session"><div class="study-session-top"><strong>${s.mode==='practice'?'مراجعة مقطع':s.mode==='read'?'قراءة':'تسميع حر'}</strong><time>${esc(date(s.started))}</time></div><p>${esc(label(s.first))}</p><div class="study-session-meta"><span>${s.words} كلمات مطابقة</span><span>${minutesLabel(Math.max(1,Math.ceil(s.duration/60000)))} للجلسة</span><span>${n} علامات مراجعة</span></div><button class="study-open" data-study-ref="${s.last?key(s.last):key(s.first)}">العودة إلى الموضع ←</button></article>`}).join(''):'<div class="study-empty"><span>۞</span><h3>كل جلسة خطوةٌ جديدة</h3><p>شغّل الميكروفون وابدأ التسميع. تُضاف الجلسة هنا عند إيقافه، بعد التقاط كلماتك.</p></div>';
   if(tab==='mistakes'){
    const rows=store.history();content.innerHTML=rows.length?`<p class="study-caption">مواضع تكررت فيها علامات المراجعة، مرتبة بالأكثر تكرارًا.</p>${rows.slice(0,100).map(r=>`<article class="study-mistake"><span class="study-frequency" data-frequency="${Math.min(3,r.sessions)}">${r.sessions}</span><div><strong>${esc(label(r))}</strong><p>جلسات تضمنت العلامة: ${r.sessions}</p><button class="study-open" data-study-ref="${key(r)}">مراجعة الموضع ←</button></div><button class="study-dismiss" data-study-dismiss="${esc(r.sessionId)}|${key(r)}" aria-label="إزالة أحدث علامة لهذا الموضع">إزالة العلامة</button></article>`).join('')}`:'<div class="study-empty"><span>✓</span><h3>لا توجد علامات محفوظة</h3><p>تظهر هنا الكلمات التي تحتاج منك مراجعة بعد جلسات التسميع.</p></div>';
   }
   if(tab==='goal')content.innerHTML=`<form id="studyGoalForm" class="study-goal-form"><label for="studyGoalMinutes">هدفي اليومي لدقائق الجلسات</label><div><input id="studyGoalMinutes" type="number" min="1" max="180" value="${m.goal}" inputmode="numeric" required><button class="primary-button" type="submit">حفظ الهدف</button></div></form><div class="study-backup"><h3>جلساتك ترافقك</h3><p>احفظ نسخة من السجل، أو ادمج نسخة سابقة دون استبدال جلساتك الموجودة.</p><div><button id="studyExport" class="study-secondary">تنزيل نسخة الجلسات</button><label class="study-secondary study-file">استيراد ودمج نسخة<input id="studyImport" type="file" accept="application/json,.json"></label></div></div>`;
  }
  async function click(event){
   const button=event.target.closest('button');if(!button)return;
   if(button.id==='studyClose'){dialog.close();return}
   if(button.dataset.studyTab){tab=button.dataset.studyTab;render();return}
   if(button.dataset.studyRef){const [sura,aya,word]=button.dataset.studyRef.split(':').map(Number);dialog.close();try{await openReference({sura,aya,word})}catch{dialog.showModal();$('#studyStatus').textContent='تعذّر فتح الموضع. حاول مجددًا.'}return}
   if(button.dataset.studyDismiss){const [id,k]=button.dataset.studyDismiss.split('|'),[sura,aya,word]=k.split(':').map(Number);store.dismiss(id,{sura,aya,word});render();$('#studyStatus').textContent='أُزيلت العلامة المختارة؛ تبقى العلامات من الجلسات الأخرى إن وجدت.';return}
   if(button.id==='studyExport'){
    const url=URL.createObjectURL(new Blob([store.exportJSON()],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='athman-sessions.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);$('#studyStatus').textContent='أُعدّت نسخة الجلسات للتنزيل.';
   }
  }
  dialog.addEventListener('click',click);
  dialog.addEventListener('submit',event=>{if(event.target.id!=='studyGoalForm')return;event.preventDefault();try{const n=Number($('#studyGoalMinutes').value);if(!store.setGoal(n))throw new Error('تعذّر حفظ الهدف.');render();$('#studyStatus').textContent='حُفظ هدفك اليومي.'}catch(error){$('#studyStatus').textContent=error.message}});
  dialog.addEventListener('change',async event=>{if(event.target.id!=='studyImport')return;const f=event.target.files?.[0];if(!f)return;try{if(f.size>2000000)throw new Error('النسخة أكبر من الحجم المسموح.');const added=store.mergeJSON(await f.text());render();$('#studyStatus').textContent=`أُضيفت ${added} جلسات جديدة.`}catch(error){$('#studyStatus').textContent=error.message}});
  return {open(selected='sessions'){tab=selected;render();if(!dialog.open)dialog.showModal();$('#studyClose').focus()}};
 }
 return {Store,mount,key};
});
