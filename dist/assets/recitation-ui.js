/* Microphone use begins only after the reader presses Start. No audio is stored. */
(function(root){
 'use strict';
 const icon=name=>`<svg class="icon" aria-hidden="true"><use href="#i-${name}"/></svg>`;
 function mount({reader,source,host,toggle,fontSize,contextFor=()=>({}),Recognition=root.SpeechRecognition||root.webkitSpeechRecognition}){
  const units=[...source.querySelectorAll('.verse')].map(v=>{
   const clone=v.cloneNode(true);clone.querySelector('.verse-number')?.remove();
   return {text:clone.textContent.trim(),sura:Number(v.dataset.sura),aya:Number(v.dataset.aya),startWord:Number(v.dataset.startWord)||0,label:v.getAttribute('aria-label')};
  });
  let active=false,destroyed=false,session=null,wantsAudio=false,recognition=null,started=false;
  let restartTimer,watchdog,idleEnds=0,painted=0,lastIndex=-1,hideText=true,sound=true,audio=null;
  let showNumbers=true,page=null,pageVerses=[],pageWords=[],settingsButton=null,theme='dark',marking=false,noticeTimer;
  let marks=new Set();
  try{const saved=JSON.parse(localStorage.getItem('athman-recitation-marks')||'[]');if(Array.isArray(saved))marks=new Set(saved.filter(x=>typeof x==='string'&&/^\d+:\d+:\d+$/.test(x)))}catch{}
  const heading=reader.querySelector('#readerTitle'),originalHeading=heading.textContent;
  const originalLabel=reader.getAttribute('aria-labelledby');
  const $=s=>host.querySelector(s);
  const isCurrent=rec=>!destroyed&&active&&recognition===rec;
  const message=text=>{if($('#recitationStatus'))$('#recitationStatus').textContent=text;if($('#recitationHelp'))$('#recitationHelp').title=text};
  function notice(text){message(text);const el=$('#recitationNotice');if(!el)return;el.textContent=text;el.hidden=false;clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>{el.hidden=true},6500)}
  const markKey=(i,n)=>`${units[i].sura}:${units[i].aya}:${n+units[i].startWord}`;
  function saveMarks(){try{localStorage.setItem('athman-recitation-marks',JSON.stringify([...marks]))}catch{}}
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
  function buildPage(){
   page=source.cloneNode(true);page.id='recitationPage';page.className='recitation-page';
   page.hidden=false;page.removeAttribute('aria-hidden');page.style.removeProperty('--quran-size');
   pageVerses=[...page.querySelectorAll('.verse')];pageWords=[];
   pageVerses.forEach((verse,index)=>{
    const words=[];
    for(const node of [...verse.childNodes]){
     if(node.nodeType!==3)continue;
     const fragment=document.createDocumentFragment();
     for(const piece of node.textContent.split(/(\s+)/u)){
      if(root.ATHMAN_RECITATION.sourceWords(piece).length){
       const word=document.createElement('span');word.className='recitation-word';word.textContent=piece;word.dataset.word=String(words.length);word.classList.toggle('is-marked',marks.has(markKey(index,words.length)));fragment.append(word);words.push(word);
      }else fragment.append(document.createTextNode(piece));
     }
     node.replaceWith(fragment);
    }
    const marker=verse.querySelector('.verse-number');
    if(marker){const bdi=document.createElement('bdi');bdi.dir='ltr';bdi.textContent=String(units[index].aya);marker.innerHTML=icon('verse-frame');marker.append(bdi)}
    verse.dataset.recitationIndex=String(index);pageWords.push(words);
   });
   $('#recitationPageScroll').append(page);
  }
  function currentIntoView(word=null){
   const s=session.snapshot(),el=word||pageVerses[s.index];if(!el)return;
   const scroll=$('#recitationPageScroll'),a=el.getBoundingClientRect(),b=scroll.getBoundingClientRect();
   if(a.top<b.top+12||a.bottom>b.bottom-12)el.scrollIntoView({block:'nearest',inline:'nearest',behavior:'instant'});
  }
  function paintPage(force=false){
   const s=session.snapshot(),assisted=new Map(s.outcomes.map(o=>[o.index,o.assisted]));
   page.classList.toggle('is-masked',hideText);page.classList.toggle('hide-verse-numbers',!showNumbers);
   const indices=new Set([lastIndex,s.index]);
   if(force)pageVerses.forEach((_,i)=>indices.add(i));else for(let i=painted;i<s.index;i++)indices.add(i);
   for(const i of indices){
    if(!pageVerses[i])continue;
    const current=i===s.index,done=i<s.index,hints=new Set(current?s.hints:[]);
    pageVerses[i].classList.toggle('is-current',current);
    pageVerses[i].classList.toggle('is-matched',done);
    pageVerses[i].classList.toggle('is-assisted',!!assisted.get(i));
    pageVerses[i].setAttribute('aria-label',units[i].label+(assisted.get(i)?'، بمساعدة':''));
    pageWords[i].forEach((word,n)=>{
     const visible=!hideText||done||current&&(s.peeked||hints.has(n));
     word.classList.toggle('is-concealed',!visible);
     word.classList.toggle('is-hint',current&&hints.has(n));
     word.classList.toggle('is-cursor',current&&n===Math.min(s.cursor,s.wordCount-1));
     word.classList.toggle('is-error',current&&n===s.errorIndex);
     word.classList.remove('is-heard');
     if(visible)word.removeAttribute('aria-hidden');else word.setAttribute('aria-hidden','true');
    });
   }
   const u=session.units[Math.min(s.index,s.total-1)];
   if(u){
    const info=contextFor(u);heading.textContent=u.label.split('،')[0];$('#recitationSurah').textContent=heading.textContent;
    // Use the actual verse reference; this reflowable Warsh text has no fixed printed-page map.
    $('#recitationMeta').textContent=`الآية ${u.aya}${info.juz?' | جزء '+info.juz:''}${info.hizb?' | حزب '+info.hizb:''}`;
   }
   $('#recitationPosition').textContent=s.complete?'اكتمل المقطع':u?.label||'';
   if(lastIndex!==s.index)currentIntoView();lastIndex=s.index;painted=s.index;
  }
  function paintInterim(count){
   const s=session.snapshot(),words=pageWords[s.index]||[],cursor=Math.min(count,words.length-1);
   words.forEach((word,n)=>{word.classList.toggle('is-cursor',n===cursor);word.classList.toggle('is-heard',n<count)});
   currentIntoView(words[cursor]);
  }
  function setSettings(open){
   const panel=$('#recitationSettingsPanel');if(!panel)return;panel.hidden=!open;
   settingsButton?.setAttribute('aria-expanded',String(open));
   if(open){setPopover('Menu',false);setPopover('Search',false);$('#recitationSettingsStatus').textContent=$('#recitationStatus').textContent;$('#recitationSettingsClose').focus()}else settingsButton?.focus();
  }
  function setPageTheme(value){
   theme=value==='light'?'light':'dark';reader.dataset.recitationTheme=theme;
   try{localStorage.setItem('athman-recitation-theme',theme)}catch{}
  }
  function setPopover(name,open){
   const panel=$('#recitation'+name+'Panel');if(!panel)return;
   panel.hidden=!open;$('#recitation'+name)?.setAttribute('aria-expanded',String(open));
   if(open){
    setSettings(false);setPopover(name==='Menu'?'Search':'Menu',false);
    (name==='Search'?$('#recitationSearchInput'):$('#recitationMenuClose')).focus();
   }
  }
  function searchPassage(){
   const query=root.ATHMAN_RECITATION.normalize($('#recitationSearchInput').value).replace(/[٠-٩]/g,c=>'٠١٢٣٤٥٦٧٨٩'.indexOf(c)).replace(/[۰-۹]/g,c=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(c));
   const results=$('#recitationSearchResults');results.replaceChildren();if(!query)return;
   const matches=units.map((u,i)=>({u,i})).filter(({u})=>/^\d+$/.test(query)?String(u.aya)===query:root.ATHMAN_RECITATION.normalize(u.text).includes(query));
   const count=document.createElement('p');count.textContent=matches.length?`${matches.length} موضعًا في هذا المقطع`:'لا توجد نتائج في المقطع الحالي.';results.append(count);
   for(const {u,i} of matches.slice(0,30)){
    const button=document.createElement('button');button.type='button';button.dataset.recitationResult=String(i);button.textContent=u.label;results.append(button);
   }
  }
  function syncMarking(){
   page.classList.toggle('is-marking',marking);$('#recitationMarker').setAttribute('aria-pressed',String(marking));
   for(const words of pageWords)for(const word of words){
    if(marking&&!word.classList.contains('is-concealed')){word.tabIndex=0;word.setAttribute('role','button');word.setAttribute('aria-label','تبديل تحديد: '+word.textContent);word.setAttribute('aria-pressed',String(word.classList.contains('is-marked')))}
    else{word.removeAttribute('tabindex');word.removeAttribute('role');word.removeAttribute('aria-label');word.removeAttribute('aria-pressed')}
   }
  }
  function markWord(word){
   const i=Number(word.closest('.verse').dataset.recitationIndex),n=Number(word.dataset.word),key=markKey(i,n);
   marks.has(key)?marks.delete(key):marks.add(key);word.classList.toggle('is-marked',marks.has(key));saveMarks();syncMarking();
  }
  function paintTransport(){
   const b=$('#recitationListen');if(!b)return;
   b.disabled=!Recognition||session.complete;
   b.setAttribute('aria-pressed',String(wantsAudio));
   const label=session.complete?'اكتمل المقطع':wantsAudio?(started?'إيقاف الاستماع':'إيقاف / جارٍ الاتصال…'):'بدء الاستماع';
   b.setAttribute('aria-label',label);b.title=label;
   b.innerHTML=icon(session.complete?'check':wantsAudio?'stop':'rec-mic');
   b.setAttribute('aria-describedby','recitationStatus');
   host.classList.toggle('is-listening',wantsAudio&&started);
  }
  function stop(text){
   wantsAudio=false;clearTimeout(restartTimer);abortRecognition();paintTransport();if(text)message(text);
  }
  function render(force=false){
   if(!active||destroyed)return;
   const s=session.snapshot();paintPage(force);
   $('#recitationProgress').textContent=String(s.index)+' آيات';
   $('#recitationPercent').textContent=Math.floor(s.index/Math.max(1,s.total)*100)+'%';
   $('#recitationSummary').setAttribute('aria-label',`تقدم التسميع: ${s.index} من ${s.total} آية. عرض الإعدادات`);
   const progress=$('#recitationProgressBar');progress.value=s.index;progress.max=Math.max(1,s.total);
   if(s.complete){
    const assisted=s.outcomes.filter(o=>o.assisted).length;
    stop(`اكتمل المقطع. دون تلميح: ${s.total-assisted} · بمساعدة: ${assisted}.`);
   }
   $('#recitationWord').disabled=s.complete||!hideText||s.hints.length>=s.wordCount;
   $('#recitationVerse').disabled=s.complete||!hideText;
   $('#recitationVerse').setAttribute('aria-label',s.peeked?'إخفاء الآية الحالية':'إظهار الآية الحالية');
   $('#recitationVerse').classList.toggle('is-selected',s.peeked);
   $('#recitationNext').disabled=s.complete;
   $('#recitationHide').setAttribute('aria-pressed',String(hideText));
   $('#recitationHide').setAttribute('aria-label',hideText?'إظهار النص كاملًا':'إخفاء النص');
   $('#recitationHide').innerHTML=icon(hideText?'rec-eye-off':'rec-eye');
   $('#recitationHints').hidden=!hideText;
   $('#recitationNumbers').setAttribute('aria-pressed',String(showNumbers));
   $('#recitationShowNumbers').checked=showNumbers;$('#recitationHintCount').textContent=String(s.outcomes.filter(o=>o.assisted).length+(s.hints.length||s.peeked?1:0));
   $('#recitationAttempts').innerHTML=s.errorIndex!==null?`الكلمة ${s.errorIndex+1} · <bdi dir="ltr">${s.attempts} / 3</bdi>`:'';
   $('#recitationLive').textContent=s.complete?'':`الموضع الحالي: الكلمة ${Math.min(s.cursor+1,s.wordCount)} من ${s.wordCount}`;
   host.classList.toggle('has-mismatch',s.errorIndex!==null);paintTransport();syncMarking();
  }
  function scheduleRestart(delay=220){
   clearTimeout(restartTimer);
   if(wantsAudio&&active&&!session.complete&&!document.hidden)restartTimer=setTimeout(beginCycle,delay);
  }
  function fatal(text){stop(text);notice(text)}
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
      notice($('#recitationStatus').textContent);
      paintTransport();scheduleRestart(500);return;
     }
     if(result.complete)return;
     message(result.finished?.length?'أُظهرت الآية المطابقة. تابع القراءة.':'تم التقاط الجزء المطابق. أكمل الآية.');
    }
    if(interim.length&&!session.complete){
     const p=session.feed(interim.join(' ')),s=session.snapshot();
     const n=p.previewIndex>s.index?s.wordCount:p.previewCursor;
     paintInterim(n);
     $('#recitationLive').innerHTML=n===s.wordCount?'التُقطت كلمات الآية؛ جارٍ انتظار النتيجة النهائية…':`التقاط مباشر: <bdi dir="ltr">${n} / ${s.wordCount}</bdi> كلمة`;
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
  function enable(conceal=true){
   if(active||!units.length||destroyed)return;active=true;hideText=conceal;sound=true;painted=0;lastIndex=-1;showNumbers=true;marking=false;
   session=new root.ATHMAN_RECITATION.Session(units);
   host.innerHTML=`<section class="recitation-panel" aria-label="صفحة التسميع">
    <header class="recitation-header" dir="ltr">
     <button class="recitation-header-button" id="recitationMenu" aria-label="قائمة المصحف" aria-expanded="false" aria-controls="recitationMenuPanel">${icon('rec-menu')}</button>
     <div class="recitation-title-card" dir="rtl"><button id="recitationSave" aria-label="حفظ الموضع">${icon('rec-bookmark')}</button><div><h2 id="recitationSurah"></h2><p id="recitationMeta"></p></div></div>
     <button class="recitation-header-button" id="recitationSearch" aria-label="البحث في المقطع" aria-expanded="false" aria-controls="recitationSearchPanel">${icon('rec-search')}</button>
     <a class="recitation-header-button recitation-gift" href="support.html" aria-label="دعم أثمان ومشاركته">${icon('rec-gift')}</a>
     <button class="recitation-header-button" id="recitationSettings" aria-label="إعدادات التسميع" aria-expanded="false" aria-controls="recitationSettingsPanel">${icon('rec-settings')}</button>
    </header>
    <nav class="recitation-popover recitation-menu" id="recitationMenuPanel" aria-label="قائمة المصحف" hidden><div class="recitation-settings-heading"><strong>أثمان</strong><button id="recitationMenuClose" class="icon-button" aria-label="إغلاق قائمة المصحف">${icon('close')}</button></div><button id="recitationExit">العودة إلى القراءة العادية</button><a data-recitation-route href="#/">الأحزاب</a><a data-recitation-route href="#/halves">الأنصاف</a><a data-recitation-route href="#/quarters">الأرباع</a><a data-recitation-route href="#/eighths">الأثمان</a><a data-recitation-route href="#/surahs">السور</a><a data-recitation-route href="#/saved">مواضعي المحفوظة</a><a href="support.html">الدعم والمشاركة</a><button id="recitationClose">إغلاق المصحف</button></nav>
    <div class="recitation-popover recitation-search" id="recitationSearchPanel" hidden><div class="recitation-settings-heading"><label for="recitationSearchInput">البحث في المقطع الحالي</label><button id="recitationSearchClose" class="icon-button" aria-label="إغلاق البحث">${icon('close')}</button></div><input id="recitationSearchInput" type="search" autocomplete="off" placeholder="ابحث بكلمات الآية أو رقمها"><div id="recitationSearchResults" aria-live="polite"></div></div>
    <div class="recitation-popover recitation-settings" id="recitationSettingsPanel" hidden><div class="recitation-settings-heading"><strong>إعدادات التسميع</strong><button id="recitationSettingsClose" class="icon-button" aria-label="إغلاق إعدادات التسميع">${icon('close')}</button></div><p class="recitation-disclosure">تسميع تجريبي لمطابقة الكلمات، وليس تقييمًا للتجويد. قد تعالج خدمة متصفحك الصوت عبر الإنترنت؛ أثمان لا يحفظ تسجيلاتك. بعد 3 محاولات غير متطابقة تظهر الكلمة في مكانها. زر القلم يتيح تحديد الكلمات يدويًا؛ الألوان تخص التحديد والتلميحات والتعثر، وليست أحكام التجويد.</p><div class="recitation-settings-row"><label><input id="recitationSound" type="checkbox" checked> صوت التنبيه</label><label>المظهر <select id="recitationTheme" aria-label="مظهر صفحة التسميع"><option value="dark">داكن</option><option value="light">فاتح</option></select></label><label><input id="recitationShowNumbers" type="checkbox" checked> أرقام الآيات</label></div><div class="recitation-settings-row"><span>حجم الخط</span><button class="recitation-secondary" id="recitationSmaller" aria-label="تصغير خط التسميع">أ−</button><bdi id="recitationFontSize">${fontSize}</bdi><button class="recitation-secondary" id="recitationLarger" aria-label="تكبير خط التسميع">أ+</button></div><div class="recitation-settings-actions"><button class="recitation-secondary" id="recitationNext">متابعة الآية التالية بمساعدة</button><button class="recitation-secondary" id="recitationReset">إعادة التسميع من البداية</button><button class="recitation-secondary" id="recitationClearMarks">مسح تحديدات هذا المقطع</button><button class="recitation-secondary" id="recitationPassagePrev">المقطع السابق</button><button class="recitation-secondary" id="recitationPassageNext">المقطع التالي</button></div><p class="recitation-disclosure" id="recitationSettingsStatus"></p><p class="recitation-disclosure">النص برواية ورش، ويتكيّف مع الشاشة. يعرض الشريط رقم الآية؛ لا نضع رقم صفحة مطبوعة دون خريطة صفحات مطابقة.</p></div>
    <div class="recitation-position"><span id="recitationPosition"></span></div>
    <div class="recitation-page-scroll" id="recitationPageScroll" tabindex="0" aria-label="صفحة الآيات للتسميع"></div>
    <div class="recitation-notice" id="recitationNotice" hidden></div>
    <div class="recitation-feedback"><p class="recitation-status" id="recitationStatus" role="status" aria-live="polite"></p><div class="recitation-live-row"><span class="recitation-live" id="recitationLive" aria-live="off"></span><span id="recitationAttempts"></span></div><progress id="recitationProgressBar" aria-label="تقدم التسميع"></progress></div>
    <footer class="recitation-dock" dir="ltr"><div class="recitation-dock-left"><div class="recitation-counters"><button id="recitationHelp" aria-label="مساعدة التسميع">${icon('rec-help')}<bdi id="recitationHintCount">0</bdi></button><button id="recitationSummary"><bdi id="recitationProgress"></bdi><span aria-hidden="true">|</span><bdi id="recitationPercent"></bdi></button></div><div class="recitation-dock-actions"><button class="recitation-tool" id="recitationBook" aria-label="فهرس المصحف">${icon('rec-book')}</button><button class="recitation-tool" id="recitationHide" type="button"></button><div class="recitation-hints" id="recitationHints"><button class="recitation-tool recitation-hint" id="recitationWord" aria-label="إظهار كلمة مساعدة">${icon('rec-chevron')}</button><button class="recitation-tool recitation-hint" id="recitationVerse" aria-label="إظهار الآية الحالية">${icon('rec-double-chevron')}</button></div><button class="recitation-tool" id="recitationMarker" aria-label="تحديد الكلمات بالقلم" aria-pressed="false">${icon('rec-marker')}</button><button class="recitation-tool" id="recitationNumbers" aria-label="إظهار أو إخفاء أرقام الآيات">${icon('rec-panels')}</button></div></div><button class="recitation-mic" id="recitationListen" type="button"></button></footer>
   </section>`;
   reader.classList.add('recitation-reader');
   try{theme=localStorage.getItem('athman-recitation-theme')||'dark'}catch{theme='dark'}
   setPageTheme(theme);$('#recitationTheme').value=theme;
   source.hidden=true;source.setAttribute('aria-hidden','true');toggle.setAttribute('aria-pressed','true');toggle.setAttribute('aria-label','إنهاء التسميع والعودة إلى القراءة');
   reader.setAttribute('aria-labelledby','recitationSurah');
   settingsButton=$('#recitationSettings');
   const save=reader.querySelector('.reader-tools .save-button');
   if(save){$('#recitationSave').setAttribute('aria-pressed',save.getAttribute('aria-pressed'));$('#recitationSave').setAttribute('aria-label',save.getAttribute('aria-label'))}
   $('#recitationPassagePrev').disabled=reader.querySelector('#readerPrev').disabled;$('#recitationPassageNext').disabled=reader.querySelector('#readerNext').disabled;
   buildPage();render(true);reader.scrollTop=0;
   message(Recognition?(hideText?'الآيات مخفاة.':'النص ظاهر كاملًا.')+' قد تعالج خدمة المتصفح صوتك عبر الإنترنت؛ اضغط الميكروفون للبدء.':'التعرّف الصوتي غير مدعوم هنا. التلميحات متاحة؛ المتابعة اليدوية في الإعدادات.');
  }
  function toggleSettings(){setSettings($('#recitationSettingsPanel').hidden)}
  function leave(){
   stop();active=false;session=null;source.hidden=false;source.removeAttribute('aria-hidden');host.innerHTML='';host.classList.remove('has-mismatch','is-listening');
   reader.classList.remove('recitation-reader');delete reader.dataset.recitationTheme;heading.textContent=originalHeading;
   settingsButton=null;clearTimeout(noticeTimer);if(originalLabel)reader.setAttribute('aria-labelledby',originalLabel);
   page=null;pageWords=[];pageVerses=[];
   toggle.setAttribute('aria-pressed','false');toggle.setAttribute('aria-label','تسميع وإخفاء الآيات');toggle.innerHTML=icon('mic')+'تسميع';
   if(audio){audio.close().catch(()=>{});audio=null}
  }
  function handleClick(event){
   if(!active)return;
   if(event.target.closest('[data-recitation-route]')){reader.querySelector('[data-close-reader]').click();return}
   const word=event.target.closest('.recitation-word');if(marking&&word){markWord(word);return}
   const result=event.target.closest('[data-recitation-result]');
   if(result){setPopover('Search',false);pageVerses[Number(result.dataset.recitationResult)]?.scrollIntoView({block:'center',behavior:'instant'});return}
   const id=event.target.closest('button')?.id;
   if(id==='recitationListen'){
    if(wantsAudio){stop('الاستماع متوقف. يمكنك استئنافه من الموضع نفسه.');return}
    if(!Recognition||session.complete)return;wantsAudio=true;idleEnds=0;audioReady();notice('جارٍ فتح الميكروفون. قد تعالج خدمة متصفحك الصوت عبر الإنترنت.');beginCycle();
   }else if(id==='recitationWord'){session.hint();render();currentIntoView();message('أُظهرت كلمة في موضعها للمساعدة. أعد القراءة من الموضع الحالي.')}
   else if(id==='recitationVerse'){session.peek();render();currentIntoView()}
   else if(id==='recitationHide'){hideText=!hideText;render(true);message((hideText?'النص مخفي؛ تبقى مواضع الكلمات محفوظة.':'النص ظاهر كاملًا.')+(wantsAudio?' واصل التسميع.':' قد تعالج خدمة المتصفح صوتك عبر الإنترنت؛ اضغط الميكروفون للبدء.'))}
   else if(id==='recitationNumbers'){showNumbers=!showNumbers;render()}
   else if(id==='recitationMenu'){setPopover('Menu',$('#recitationMenuPanel').hidden)}
   else if(id==='recitationMenuClose'){setPopover('Menu',false);$('#recitationMenu').focus()}
   else if(id==='recitationSearch'){setPopover('Search',$('#recitationSearchPanel').hidden)}
   else if(id==='recitationSearchClose'){setPopover('Search',false);$('#recitationSearch').focus()}
   else if(['recitationSettings','recitationHelp','recitationSummary'].includes(id)){toggleSettings()}
   else if(id==='recitationSettingsClose'){setSettings(false)}
   else if(id==='recitationBook'){setPopover('Menu',true)}
   else if(id==='recitationExit'){leave();toggle.focus()}
   else if(id==='recitationClose'){reader.querySelector('[data-close-reader]').click()}
   else if(id==='recitationSave'){
    const save=reader.querySelector('.reader-tools .save-button');save?.click();
    if(save){$('#recitationSave').setAttribute('aria-pressed',save.getAttribute('aria-pressed'));$('#recitationSave').setAttribute('aria-label',save.getAttribute('aria-label'))}
   }
   else if(id==='recitationMarker'){marking=!marking;syncMarking();if(marking)notice('اختر كلمة لتحديدها بالقلم أو لإزالة تحديدها. التحديد يدوي، ولا يدل على حكم تجويد.')}
   else if(id==='recitationClearMarks'){
    pageWords.forEach((words,i)=>words.forEach((word,n)=>{marks.delete(markKey(i,n));word.classList.remove('is-marked')}));saveMarks();syncMarking();$('#recitationSettingsStatus').textContent='مُسحت تحديدات هذا المقطع.';
   }
   else if(id==='recitationSmaller'){reader.querySelector('#fontSmaller').click()}
   else if(id==='recitationLarger'){reader.querySelector('#fontLarger').click()}
   else if(id==='recitationPassagePrev'){reader.querySelector('#readerPrev').click()}
   else if(id==='recitationPassageNext'){reader.querySelector('#readerNext').click()}
   else if(id==='recitationNext'){stop();session.skip();render();if(!session.complete)message('انتقلتَ بمساعدة؛ هذه الآية لم تُحتسب تسميعًا دون تلميح.')}
   else if(id==='recitationReset'){stop();session=new root.ATHMAN_RECITATION.Session(units);painted=0;lastIndex=-1;render(true);$('#recitationPageScroll').scrollTop=0;message('أُعيد المقطع إلى البداية. اضغط الميكروفون عندما تكون مستعدًا.')}
  }
  function handleChange(event){
   if(event.target.id==='recitationTheme'){setPageTheme(event.target.value)}
   if(event.target.id==='recitationSound'){sound=event.target.checked;if(sound&&wantsAudio)audioReady()}
   if(event.target.id==='recitationShowNumbers'){showNumbers=event.target.checked;render()}
  }
  function handleInput(event){if(event.target.id==='recitationSearchInput')searchPassage()}
  function handleKey(event){
   if(!active)return;
   const word=event.target.closest('.recitation-word');
   if(marking&&word&&['Enter',' '].includes(event.key)){event.preventDefault();markWord(word)}
   if(event.key==='Escape'&&[$('#recitationSettingsPanel'),$('#recitationMenuPanel'),$('#recitationSearchPanel')].some(el=>!el.hidden)){
    event.preventDefault();event.stopPropagation();setSettings(false);setPopover('Menu',false);setPopover('Search',false);
   }
  }
  function toggleMode(){active?leave():enable()}
  function hidden(){if(active&&wantsAudio&&document.hidden)stop('أُوقف الميكروفون عند مغادرة الصفحة. اضغط بدء الاستماع للاستئناف.')}
  function pagehide(){if(active)stop()}
  toggle.disabled=false;toggle.addEventListener('click',toggleMode);host.addEventListener('click',handleClick);host.addEventListener('change',handleChange);host.addEventListener('input',handleInput);host.addEventListener('keydown',handleKey);
  document.addEventListener('visibilitychange',hidden);root.addEventListener('pagehide',pagehide);
  host.style.setProperty('--quran-size',fontSize+'px');
  return {
   open({conceal=false}={}){enable(conceal)},
   updateFont(size){fontSize=size;host.style.setProperty('--quran-size',size+'px');if($('#recitationFontSize'))$('#recitationFontSize').textContent=String(size)},
   destroy(){if(destroyed)return;leave();destroyed=true;toggle.removeEventListener('click',toggleMode);host.removeEventListener('click',handleClick);host.removeEventListener('change',handleChange);host.removeEventListener('input',handleInput);host.removeEventListener('keydown',handleKey);document.removeEventListener('visibilitychange',hidden);root.removeEventListener('pagehide',pagehide)}
  };
 }
 root.ATHMAN_RECITATION_UI={mount};
})(window);
