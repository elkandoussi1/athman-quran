/* Microphone use begins only after the reader presses Start. No audio is stored. */
(function(root){
 'use strict';
 const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const icon=name=>`<svg class="icon" aria-hidden="true"><use href="#i-${name}"/></svg>`;
 function mount({reader,source,host,toggle,fontSize,Recognition=root.SpeechRecognition||root.webkitSpeechRecognition}){
  const units=[...source.querySelectorAll('.verse')].map(v=>{
   const clone=v.cloneNode(true);clone.querySelector('.verse-number')?.remove();
   return {text:clone.textContent.trim(),sura:Number(v.dataset.sura),aya:Number(v.dataset.aya),label:v.getAttribute('aria-label')};
  });
  let active=false,destroyed=false,session=null,wantsAudio=false,recognition=null,started=false;
  let restartTimer,watchdog,idleEnds=0,painted=0,hideText=true,sound=true,audio=null;
  const $=s=>host.querySelector(s);
  const isCurrent=rec=>!destroyed&&active&&recognition===rec;
  const message=text=>{if($('#recitationStatus'))$('#recitationStatus').textContent=text};
  function audioReady(){
   if(!sound)return;
   try{const Context=root.AudioContext||root.webkitAudioContext;if(!Context)return;if(!audio)audio=new Context();if(audio.state==='suspended')audio.resume().catch(()=>{})}catch{/* The visual alert remains available. */}
  }
  function beep(){
   if(!sound||!audio||audio.state!=='running')return;
   try{const osc=audio.createOscillator(),gain=audio.createGain(),now=audio.currentTime;osc.type='sine';osc.frequency.setValueAtTime(260,now);osc.frequency.exponentialRampToValueAtTime(180,now+.14);gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(.09,now+.015);gain.gain.exponentialRampToValueAtTime(.0001,now+.16);osc.connect(gain);gain.connect(audio.destination);osc.onended=()=>{osc.disconnect();gain.disconnect()};osc.start(now);osc.stop(now+.17)}catch{}
  }
  function abortRecognition(){
   clearTimeout(watchdog);const rec=recognition;recognition=null;started=false;
   if(rec){rec.onresult=rec.onend=rec.onerror=rec.onstart=rec.onnomatch=null;try{rec.abort()}catch{}}
  }
  function paintTransport(){
   const b=$('#recitationListen');if(!b)return;
   b.disabled=!Recognition||session.complete;
   b.setAttribute('aria-pressed',String(wantsAudio));
   b.innerHTML=icon(wantsAudio?'stop':'mic')+(session.complete?'اكتمل المقطع':wantsAudio?(started?'إيقاف الاستماع':'إيقاف / جارٍ الاتصال…'):'بدء الاستماع');
   host.classList.toggle('is-listening',wantsAudio&&started);
  }
  function stop(text){
   wantsAudio=false;clearTimeout(restartTimer);abortRecognition();paintTransport();if(text)message(text);
  }
  function render(){
   if(!active||destroyed)return;
   const s=session.snapshot(),shown=$('#recitationRevealed');
   for(const outcome of s.outcomes.slice(painted)){
    const u=session.units[outcome.index];
    shown.insertAdjacentHTML('beforeend',`<div class="recitation-shown"><div class="recitation-verse-label">${esc(u.label)}${outcome.assisted?' · بمساعدة':''}</div><p>${esc(u.text)} <span class="verse-number" dir="rtl">﴿<bdi dir="ltr">${u.aya}</bdi>﴾</span></p></div>`);
   }
   if(painted!==s.outcomes.length)shown.scrollTop=shown.scrollHeight;
   painted=s.outcomes.length;shown.hidden=painted===0;
   $('#recitationProgress').textContent=`${s.index} / ${s.total} ${s.complete?'· انتهى المقطع':'· آيات أُظهرت'}`;
   const progress=$('#recitationProgressBar');progress.value=s.index;progress.max=Math.max(1,s.total);
   const current=$('#recitationCurrent');
   if(s.complete){
    const assisted=s.outcomes.filter(o=>o.assisted).length;
    current.innerHTML=`<p class="recitation-finished">انتهى المقطع.</p><p>دون تلميح: ${s.total-assisted} · بمساعدة: ${assisted}</p><p>يمكنك العودة إلى القراءة أو إعادة التسميع.</p>`;
    stop('اكتمل المقطع. هذه مطابقة للكلمات الملتقطة، وليست حكمًا على التجويد.');
   }else{
    const hints=s.hints.map(i=>`<span class="recitation-word-hint"><small>الكلمة ${i+1}</small><b>${esc(s.unit.words[i].raw)}</b></span>`).join('');
    current.innerHTML=`<div class="recitation-verse-label">${esc(s.unit.label)}</div>${hideText?(s.peeked?`<p class="recitation-peek">${esc(s.unit.text)}</p><span class="recitation-help-note">الآية ظاهرة للمساعدة؛ اقرأها أو تابع يدويًا.</span>`:`<div class="recitation-concealed" aria-label="الآية الحالية مخفاة">${icon('eye-off')}<span>الآية مخفاة</span></div>`):'<p class="recitation-help-note">تابع من هذه الآية في النص الظاهر أدناه.</p>'}${hints?`<div class="recitation-hints" aria-label="الكلمات المساعدة">${hints}</div>`:''}<p class="recitation-attempts">${s.errorIndex!==null?`محاولات عند الكلمة ${s.errorIndex+1}: ${s.attempts} / 3`:'بعد 3 محاولات غير متطابقة تظهر الكلمة تلقائيًا.'}</p>`;
   }
   $('#recitationWord').disabled=s.complete||!hideText||s.hints.length>=s.wordCount;
   $('#recitationVerse').disabled=s.complete||!hideText;
   $('#recitationVerse').textContent=s.peeked?'إخفاء الآية':'إظهار الآية';
   $('#recitationNext').disabled=s.complete;
   $('#recitationLive').textContent=s.complete?'':`الموضع الحالي: الكلمة ${Math.min(s.cursor+1,s.wordCount)} من ${s.wordCount}`;
   host.classList.toggle('has-mismatch',s.errorIndex!==null);paintTransport();
  }
  function scheduleRestart(delay=220){
   clearTimeout(restartTimer);
   if(wantsAudio&&active&&!session.complete&&!document.hidden)restartTimer=setTimeout(beginCycle,delay);
  }
  function fatal(text){stop(text)}
  function beginCycle(){
   if(!active||destroyed||!wantsAudio||session.complete||document.hidden)return;
   abortRecognition();
   let rec;try{rec=new Recognition()}catch{fatal('تعذّر فتح خدمة التعرّف الصوتي في هذا المتصفح. يمكنك استخدام التلميحات والمتابعة اليدوية.');return}
   recognition=rec;rec.lang='ar-SA';rec.continuous=true;rec.interimResults=true;rec.maxAlternatives=1;
   const finals=new Set();let hadResult=false;
   rec.onstart=()=>{if(!isCurrent(rec))return;clearTimeout(watchdog);started=true;paintTransport();message('أستمع إليك. اقرأ الآية الحالية؛ يمكنك التوقّف قليلًا بين الآيات.')};
   rec.onresult=event=>{
    if(!isCurrent(rec)||!wantsAudio)return;
    const interim=[];
    for(let i=0;i<event.results.length;i++){
     const r=event.results[i],text=r[0]?.transcript||'';
     if(!text.trim())continue;hadResult=true;idleEnds=0;
     if(!r.isFinal){interim.push(text);continue}
     if(finals.has(i))continue;finals.add(i);
     const result=session.feed(text,{final:true});render();
     if(result.type==='mismatch'){
      abortRecognition();beep();
      message(result.autoHint?'أُظهرت الكلمة بعد 3 محاولات. أعد منها أو من بداية الآية.':`تعذّرت مطابقة الكلمة ${result.errorIndex+1}. أعد منها أو من بداية الآية؛ قد يكون التعرّف أخطأ.`);
      paintTransport();scheduleRestart(500);return;
     }
     if(result.complete)return;
     message(result.finished?.length?'أُظهرت الآية المطابقة. تابع القراءة.':'تم التقاط الجزء المطابق. أكمل الآية.');
    }
    if(interim.length&&!session.complete){
     const p=session.feed(interim.join(' ')),s=session.snapshot();
     const n=p.previewIndex>s.index?s.wordCount:p.previewCursor;
     $('#recitationLive').textContent=n===s.wordCount?'التُقطت كلمات الآية؛ جارٍ انتظار النتيجة النهائية…':`التقاط مباشر: ${n} / ${s.wordCount} كلمة`;
    }
   };
   rec.onnomatch=()=>{if(isCurrent(rec))message('لم يتضح الصوت. حاول مجددًا؛ لا تُحتسب هذه محاولة خاطئة.')};
   rec.onerror=event=>{
    if(!isCurrent(rec)||event.error==='aborted')return;
    if(event.error==='no-speech'){message('لم يُلتقط صوت واضح. لا تُحتسب هذه محاولة خاطئة.');return}
    const messages={
     'not-allowed':'لم يُسمح بالميكروفون. اسمح به من إعدادات الموقع، ثم اضغط بدء الاستماع.',
     'service-not-allowed':'خدمة التعرّف الصوتي غير متاحة في هذا المتصفح. جرّب متصفحًا داعمًا أو المتابعة اليدوية.',
     'audio-capture':'تعذّر الوصول إلى الميكروفون. تحقق من اتصاله ومن التطبيقات التي تستخدمه.',
     network:'انقطع اتصال خدمة التعرّف. تحقق من الإنترنت، ثم اضغط بدء الاستماع.',
     'language-not-supported':'التعرّف بالعربية غير متاح في خدمة هذا المتصفح. يمكنك استخدام التلميحات والمتابعة اليدوية.'
    };
    fatal(messages[event.error]||'توقّفت خدمة التعرّف الصوتي. يمكنك إعادة تشغيلها أو المتابعة يدويًا.');
   };
   rec.onend=()=>{
    if(!isCurrent(rec))return;clearTimeout(watchdog);recognition=null;started=false;
    if(!wantsAudio)return;
    if(!hadResult)idleEnds++;if(idleEnds>=3){fatal('لم يصل صوت واضح من الخدمة. اضغط بدء الاستماع للمحاولة مجددًا.');return}
    paintTransport();scheduleRestart(hadResult?220:700);
   };
   try{rec.start();watchdog=setTimeout(()=>{if(isCurrent(rec)&&!started)fatal('لم تستجب خدمة التعرّف الصوتي. تحقق من اتصالك وإذن الميكروفون ثم حاول مجددًا.')},12000)}catch{fatal('تعذّر بدء الاستماع. تحقق من إذن الميكروفون واتصالك ثم حاول مجددًا.')}
   paintTransport();
  }
  function enable(){
   if(active||!units.length||destroyed)return;active=true;hideText=true;sound=true;painted=0;
   session=new root.ATHMAN_RECITATION.Session(units);
   host.innerHTML=`<section class="recitation-panel" aria-label="التسميع وإخفاء الآيات"><div class="recitation-options"><strong>تسميع تجريبي</strong><label><input id="recitationHide" type="checkbox" checked> إخفاء الآيات</label><label><input id="recitationSound" type="checkbox" checked> صوت التنبيه</label></div><p class="recitation-disclosure">مساعدة لمطابقة الكلمات، وليست تقييمًا للتجويد. قد تعالج خدمة متصفحك الصوت عبر الإنترنت؛ أثمان لا يحفظ تسجيلاتك.</p><div class="recitation-transport"><button class="primary-button" id="recitationListen" type="button"></button><button class="recitation-secondary" id="recitationReset" type="button">إعادة البدء</button></div><p class="recitation-status" id="recitationStatus" role="status" aria-live="polite"></p><div class="recitation-progress"><span id="recitationProgress"></span><progress id="recitationProgressBar"></progress></div><div class="recitation-revealed" id="recitationRevealed" aria-label="الآيات التي أُظهرت" hidden></div><div class="recitation-current" id="recitationCurrent"></div><p class="recitation-live" id="recitationLive" aria-live="off"></p><div class="recitation-help"><button class="recitation-secondary" id="recitationWord" type="button">إظهار كلمة</button><button class="recitation-secondary" id="recitationVerse" type="button">إظهار الآية</button><button class="recitation-secondary" id="recitationNext" type="button">متابعة بمساعدة</button></div></section>`;
   source.hidden=true;source.setAttribute('aria-hidden','true');toggle.setAttribute('aria-pressed','true');toggle.setAttribute('aria-label','إنهاء التسميع والعودة إلى القراءة');toggle.innerHTML=icon('book')+'القراءة';
   render();message(Recognition?'الآيات مخفاة. اضغط بدء الاستماع عندما تكون مستعدًا.':'التعرّف الصوتي غير مدعوم هنا. الإخفاء والتلميحات والمتابعة اليدوية متاحة.');
  }
  function leave(){
   stop();active=false;session=null;source.hidden=false;source.removeAttribute('aria-hidden');host.innerHTML='';host.classList.remove('has-mismatch','is-listening');
   toggle.setAttribute('aria-pressed','false');toggle.setAttribute('aria-label','تسميع وإخفاء الآيات');toggle.innerHTML=icon('mic')+'تسميع';
   if(audio){audio.close().catch(()=>{});audio=null}
  }
  function handleClick(event){
   if(!active)return;const id=event.target.closest('button')?.id;
   if(id==='recitationListen'){
    if(wantsAudio){stop('الاستماع متوقف. يمكنك استئنافه من الموضع نفسه.');return}
    if(!Recognition||session.complete)return;wantsAudio=true;idleEnds=0;audioReady();message('جارٍ فتح الميكروفون وخدمة التعرّف…');beginCycle();
   }else if(id==='recitationWord'){session.hint();render();message('أُظهرت كلمة للمساعدة. يبقى إظهار الآية تلقائيًا مشروطًا بمطابقة كلماتها.')}
   else if(id==='recitationVerse'){session.peek();render()}
   else if(id==='recitationNext'){stop();session.skip();render();if(!session.complete)message('انتقلتَ بمساعدة؛ هذه الآية لم تُحتسب تسميعًا دون تلميح.')}
   else if(id==='recitationReset'){stop();session=new root.ATHMAN_RECITATION.Session(units);painted=0;$('#recitationRevealed').innerHTML='';render();message('أُعيد المقطع إلى البداية. اضغط بدء الاستماع عندما تكون مستعدًا.')}
  }
  function handleChange(event){
   if(event.target.id==='recitationHide'){hideText=event.target.checked;source.hidden=hideText;source.setAttribute('aria-hidden',String(hideText));render()}
   if(event.target.id==='recitationSound'){sound=event.target.checked;if(sound&&wantsAudio)audioReady()}
  }
  function toggleMode(){active?leave():enable()}
  function hidden(){if(active&&wantsAudio&&document.hidden)stop('أُوقف الميكروفون عند مغادرة الصفحة. اضغط بدء الاستماع للاستئناف.')}
  function pagehide(){if(active)stop()}
  toggle.disabled=false;toggle.addEventListener('click',toggleMode);host.addEventListener('click',handleClick);host.addEventListener('change',handleChange);
  document.addEventListener('visibilitychange',hidden);root.addEventListener('pagehide',pagehide);
  host.style.setProperty('--quran-size',fontSize+'px');
  return {
   updateFont(size){host.style.setProperty('--quran-size',size+'px')},
   destroy(){if(destroyed)return;leave();destroyed=true;toggle.removeEventListener('click',toggleMode);host.removeEventListener('click',handleClick);host.removeEventListener('change',handleChange);document.removeEventListener('visibilitychange',hidden);root.removeEventListener('pagehide',pagehide)}
  };
 }
 root.ATHMAN_RECITATION_UI={mount};
})(window);
