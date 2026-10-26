/* Microphone use begins only after the reader presses Start. No audio is stored. */
(function(root){
 'use strict';
 const icon=name=>`<svg class="icon" aria-hidden="true"><use href="#i-${name}"/></svg>`;
 function mount({reader,source,host,toggle,fontSize,Recognition=root.SpeechRecognition||root.webkitSpeechRecognition}){
  const units=[...source.querySelectorAll('.verse')].map(v=>{
   const clone=v.cloneNode(true);clone.querySelector('.verse-number')?.remove();
   return {text:clone.textContent.trim(),sura:Number(v.dataset.sura),aya:Number(v.dataset.aya),label:v.getAttribute('aria-label')};
  });
  let active=false,destroyed=false,session=null,wantsAudio=false,recognition=null,started=false;
  let restartTimer,watchdog,idleEnds=0,painted=0,lastIndex=-1,hideText=true,sound=true,audio=null;
  let showNumbers=true,page=null,pageVerses=[],pageWords=[],settingsButton=null,theme='dark';
  const heading=reader.querySelector('#readerTitle'),originalHeading=heading.textContent;
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
       const word=document.createElement('span');word.className='recitation-word';word.textContent=piece;word.dataset.word=String(words.length);fragment.append(word);words.push(word);
      }else fragment.append(document.createTextNode(piece));
     }
     node.replaceWith(fragment);
    }
    const marker=verse.querySelector('.verse-number');
    if(marker){const bdi=document.createElement('bdi');bdi.dir='ltr';bdi.textContent=String(units[index].aya);marker.replaceChildren(bdi)}
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
   if(u)heading.textContent=u.label.split('،')[0];
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
   if(open)$('#recitationSettingsClose').focus();else settingsButton?.focus();
  }
  function setPageTheme(value){
   theme=value==='light'?'light':'dark';reader.dataset.recitationTheme=theme;
   try{localStorage.setItem('athman-recitation-theme',theme)}catch{}
  }
  function paintTransport(){
   const b=$('#recitationListen');if(!b)return;
   b.disabled=!Recognition||session.complete;
   b.setAttribute('aria-pressed',String(wantsAudio));
   const label=session.complete?'اكتمل المقطع':wantsAudio?(started?'إيقاف الاستماع':'إيقاف / جارٍ الاتصال…'):'بدء الاستماع';
   b.setAttribute('aria-label',label);b.title=label;
   b.innerHTML=icon(session.complete?'check':wantsAudio?'stop':'mic')+`<span aria-hidden="true">${session.complete?'اكتمل':wantsAudio?(started?'أستمع':'اتصال…'):'استماع'}</span>`;
   host.classList.toggle('is-listening',wantsAudio&&started);
  }
  function stop(text){
   wantsAudio=false;clearTimeout(restartTimer);abortRecognition();paintTransport();if(text)message(text);
  }
  function render(force=false){
   if(!active||destroyed)return;
   const s=session.snapshot();paintPage(force);
   $('#recitationProgress').innerHTML=`<bdi dir="ltr">${s.index} / ${s.total}</bdi>`;
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
   $('#recitationHide').innerHTML=icon(hideText?'eye-off':'eye')+'<span>النص</span>';
   $('#recitationNumbers').setAttribute('aria-pressed',String(showNumbers));
   $('#recitationAttempts').innerHTML=s.errorIndex!==null?`الكلمة ${s.errorIndex+1} · <bdi dir="ltr">${s.attempts} / 3</bdi>`:'';
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
  function enable(){
   if(active||!units.length||destroyed)return;active=true;hideText=true;sound=true;painted=0;lastIndex=-1;showNumbers=true;
   session=new root.ATHMAN_RECITATION.Session(units);
   host.innerHTML=`<section class="recitation-panel" aria-label="صفحة التسميع"><div class="recitation-settings" id="recitationSettingsPanel" hidden><div class="recitation-settings-heading"><strong>إعدادات التسميع</strong><button id="recitationSettingsClose" class="icon-button" aria-label="إغلاق إعدادات التسميع">${icon('close')}</button></div><p class="recitation-disclosure">تسميع تجريبي لمطابقة الكلمات، وليس تقييمًا للتجويد. قد تعالج خدمة متصفحك الصوت عبر الإنترنت؛ أثمان لا يحفظ تسجيلاتك. بعد 3 محاولات غير متطابقة تظهر الكلمة في مكانها. ألوان المساعدة تبيّن التقدم والتلميحات وموضع التعثر.</p><div class="recitation-settings-row"><label><input id="recitationSound" type="checkbox" checked> صوت التنبيه</label><label>المظهر <select id="recitationTheme" aria-label="مظهر صفحة التسميع"><option value="dark">داكن</option><option value="light">فاتح</option></select></label></div><div class="recitation-settings-row"><span>حجم الخط</span><button class="recitation-secondary" id="recitationSmaller" aria-label="تصغير خط التسميع">أ−</button><bdi id="recitationFontSize">${fontSize}</bdi><button class="recitation-secondary" id="recitationLarger" aria-label="تكبير خط التسميع">أ+</button></div><div class="recitation-settings-actions"><button class="recitation-secondary" id="recitationNext">متابعة الآية التالية بمساعدة</button><button class="recitation-secondary" id="recitationReset">إعادة التسميع من البداية</button><button class="recitation-secondary" id="recitationPassagePrev">المقطع السابق</button><button class="recitation-secondary" id="recitationPassageNext">المقطع التالي</button></div></div><div class="recitation-position"><span id="recitationPosition"></span><span id="recitationProgress"></span></div><div class="recitation-page-scroll" id="recitationPageScroll" tabindex="0" aria-label="صفحة الآيات للتسميع"></div><div class="recitation-feedback"><p class="recitation-status" id="recitationStatus" role="status" aria-live="polite"></p><div class="recitation-live-row"><span class="recitation-live" id="recitationLive" aria-live="off"></span><span id="recitationAttempts"></span></div><progress id="recitationProgressBar" aria-label="تقدم التسميع"></progress></div><div class="recitation-dock"><button class="recitation-mic" id="recitationListen" type="button"></button><div class="recitation-dock-actions"><button class="recitation-tool" id="recitationHide" type="button"></button><button class="recitation-tool" id="recitationWord" type="button" aria-label="إظهار كلمة مساعدة">${icon('chevron')}<span>كلمة</span></button><button class="recitation-tool" id="recitationVerse" type="button" aria-label="إظهار الآية الحالية">${icon('book')}<span>آية</span></button><button class="recitation-tool" id="recitationNumbers" type="button" aria-label="إظهار أو إخفاء أرقام الآيات"><bdi>1</bdi><span>الأرقام</span></button></div></div></section>`;
   reader.classList.add('recitation-reader');
   try{theme=localStorage.getItem('athman-recitation-theme')||'dark'}catch{theme='dark'}
   setPageTheme(theme);$('#recitationTheme').value=theme;
   source.hidden=true;source.setAttribute('aria-hidden','true');toggle.setAttribute('aria-pressed','true');toggle.setAttribute('aria-label','إنهاء التسميع والعودة إلى القراءة');toggle.innerHTML=icon('book');
   settingsButton=document.createElement('button');settingsButton.className='icon-button recitation-settings-button';settingsButton.id='recitationSettings';settingsButton.type='button';settingsButton.setAttribute('aria-label','إعدادات التسميع');settingsButton.setAttribute('aria-expanded','false');settingsButton.setAttribute('aria-controls','recitationSettingsPanel');settingsButton.innerHTML=icon('settings');settingsButton.addEventListener('click',toggleSettings);reader.querySelector('.reader-tools').append(settingsButton);
   $('#recitationPassagePrev').disabled=reader.querySelector('#readerPrev').disabled;$('#recitationPassageNext').disabled=reader.querySelector('#readerNext').disabled;
   buildPage();render(true);reader.scrollTop=0;
   message(Recognition?'الآيات مخفاة. قد تعالج خدمة المتصفح صوتك عبر الإنترنت؛ اضغط الميكروفون للبدء.':'التعرّف الصوتي غير مدعوم هنا. التلميحات متاحة؛ المتابعة اليدوية في الإعدادات.');
  }
  function toggleSettings(){setSettings($('#recitationSettingsPanel').hidden)}
  function leave(){
   stop();active=false;session=null;source.hidden=false;source.removeAttribute('aria-hidden');host.innerHTML='';host.classList.remove('has-mismatch','is-listening');
   reader.classList.remove('recitation-reader');delete reader.dataset.recitationTheme;heading.textContent=originalHeading;
   if(settingsButton){settingsButton.removeEventListener('click',toggleSettings);settingsButton.remove();settingsButton=null}
   page=null;pageWords=[];pageVerses=[];
   toggle.setAttribute('aria-pressed','false');toggle.setAttribute('aria-label','تسميع وإخفاء الآيات');toggle.innerHTML=icon('mic')+'تسميع';
   if(audio){audio.close().catch(()=>{});audio=null}
  }
  function handleClick(event){
   if(!active)return;const id=event.target.closest('button')?.id;
   if(id==='recitationListen'){
    if(wantsAudio){stop('الاستماع متوقف. يمكنك استئنافه من الموضع نفسه.');return}
    if(!Recognition||session.complete)return;wantsAudio=true;idleEnds=0;audioReady();message('جارٍ فتح الميكروفون وخدمة التعرّف…');beginCycle();
   }else if(id==='recitationWord'){session.hint();render();currentIntoView();message('أُظهرت كلمة في موضعها للمساعدة. أعد القراءة من الموضع الحالي.')}
   else if(id==='recitationVerse'){session.peek();render();currentIntoView()}
   else if(id==='recitationHide'){hideText=!hideText;render(true);message((hideText?'النص مخفي؛ تبقى مواضع الكلمات محفوظة.':'النص ظاهر كاملًا.')+(wantsAudio?' واصل التسميع.':' قد تعالج خدمة المتصفح صوتك عبر الإنترنت؛ اضغط الميكروفون للبدء.'))}
   else if(id==='recitationNumbers'){showNumbers=!showNumbers;render()}
   else if(id==='recitationSettingsClose'){setSettings(false)}
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
  }
  function toggleMode(){active?leave():enable()}
  function hidden(){if(active&&wantsAudio&&document.hidden)stop('أُوقف الميكروفون عند مغادرة الصفحة. اضغط بدء الاستماع للاستئناف.')}
  function pagehide(){if(active)stop()}
  toggle.disabled=false;toggle.addEventListener('click',toggleMode);host.addEventListener('click',handleClick);host.addEventListener('change',handleChange);
  document.addEventListener('visibilitychange',hidden);root.addEventListener('pagehide',pagehide);
  host.style.setProperty('--quran-size',fontSize+'px');
  return {
   updateFont(size){fontSize=size;host.style.setProperty('--quran-size',size+'px');if($('#recitationFontSize'))$('#recitationFontSize').textContent=String(size)},
   destroy(){if(destroyed)return;leave();destroyed=true;toggle.removeEventListener('click',toggleMode);host.removeEventListener('click',handleClick);host.removeEventListener('change',handleChange);document.removeEventListener('visibilitychange',hidden);root.removeEventListener('pagehide',pagehide)}
  };
 }
 root.ATHMAN_RECITATION_UI={mount};
})(window);
