/* Microphone use begins only after the reader presses Start. No audio is stored. */
(function(root){
 'use strict';
 const BUILD=27;
 const icon=name=>`<svg class="icon" aria-hidden="true"><use href="#i-${name}"/></svg>`;
 function mount({reader,source,host,toggle,fontSize,corpus,study=null,onJournalOpen=()=>{},resolveLocation=()=>false,adjacentReference=()=>null,contextFor=()=>({}),Recognition=root.SpeechRecognition||root.webkitSpeechRecognition}){
  const readUnits=()=>[...source.querySelectorAll('.verse')].map(v=>{
   const clone=v.cloneNode(true);clone.querySelector('.verse-number')?.remove();
   return {text:clone.textContent.trim(),sura:Number(v.dataset.sura),aya:Number(v.dataset.aya),startWord:Number(v.dataset.startWord)||0,label:v.getAttribute('aria-label')};
  });
  let units=readUnits();corpus=corpus||new root.ATHMAN_RECITATION.Corpus(units);
  let active=false,destroyed=false,session=null,wantsAudio=false,recognition=null,started=false;
  let restartTimer,watchdog,idleEnds=0,lastIndex=-1,hideText=true,sound=true,audio=null,localeFallback=false;
  let showNumbers=true,page=null,pageVerses=[],pageWords=[],pageUnitIndices=[],pageLocal=new Map(),settingsButton=null,theme='dark',marking=false,noticeTimer;
  let journalId=null,selectedWord=null,manualStart=false,locationResolved=false;const mistakeSessions=new Map(),liveIndices=new Set();
  let swipe=null,suppressClickUntil=0,clockTimer=null,listeningSince=null,elapsedMs=0,liveWordTypes=new Map(),liveFocus=null,liveHeading=null;
  let responseInfo={received:null,processing:0,kind:'',transcript:''},repeatVerses=new Set(),repeatCursor=null,audioCue=0,startFailures=0;
  const now=()=>root.performance.now();
  let prefs={mode:'follow',strict:false,reveal:'words',history:false,locale:'ar-MA'};
  try{const saved=JSON.parse(localStorage.getItem('athman-practice-prefs')||'null');if(saved){if(['follow','practice','read'].includes(saved.mode))prefs.mode=saved.mode;prefs.strict=!!saved.strict;prefs.reveal=saved.reveal==='verse'?'verse':'words';prefs.history=!!saved.history;if(['ar-MA','ar-SA'].includes(saved.locale))prefs.locale=saved.locale}}catch{}
  const savePrefs=()=>{try{localStorage.setItem('athman-practice-prefs',JSON.stringify(prefs))}catch{}};
  let marks=new Set();
  try{const saved=JSON.parse(localStorage.getItem('athman-recitation-marks')||'[]');if(Array.isArray(saved))marks=new Set(saved.filter(x=>typeof x==='string'&&/^\d+:\d+:\d+$/.test(x)))}catch{}
  const heading=reader.querySelector('#readerTitle');let originalHeading=heading.textContent;
  const originalLabel=reader.getAttribute('aria-labelledby');
  const $=s=>host.querySelector(s);
  const isCurrent=rec=>!destroyed&&active&&recognition===rec;
  const message=text=>{const status=$('#recitationStatus'),help=$('#recitationHelp');if(status&&status.textContent!==text)status.textContent=text;if(help&&help.title!==text)help.title=text};
  function notice(text){message(text);const el=$('#recitationNotice');if(!el)return;el.textContent=text;el.hidden=false;clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>{el.hidden=true},6500)}
  const markKey=(i,n)=>`${units[i].sura}:${units[i].aya}:${n+units[i].startWord}`;
  function saveMarks(){try{localStorage.setItem('athman-recitation-marks',JSON.stringify([...marks]))}catch{}}
  function audioReady(){
   if(!sound)return null;
   try{const Context=root.AudioContext||root.webkitAudioContext;if(!Context)return null;if(!audio)audio=new Context({latencyHint:'interactive'});return audio}catch{return null}
  }
  function playCue(kind){
   const ctx=audioReady(),ticket=++audioCue;if(!ctx)return;
   const play=()=>{
    if(audio!==ctx||!sound||ticket!==audioCue||ctx.state!=='running')return;
    try{
     const start=ctx.currentTime,notes=kind==='start'?[{f:540,to:810,t:0,d:.09}]:kind==='stop'?[{f:660,to:390,t:0,d:.12}]:[{f:260,to:180,t:0,d:.16}];
     for(const note of notes){
      const osc=ctx.createOscillator(),gain=ctx.createGain(),at=start+note.t;osc.type='sine';osc.frequency.setValueAtTime(note.f,at);osc.frequency.exponentialRampToValueAtTime(note.to,at+note.d);
      gain.gain.setValueAtTime(.0001,at);gain.gain.exponentialRampToValueAtTime(kind==='error' ? .09 : .055,at+.012);gain.gain.exponentialRampToValueAtTime(.0001,at+note.d);osc.connect(gain);gain.connect(ctx.destination);
      osc.onended=()=>{osc.disconnect();gain.disconnect()};osc.start(at);osc.stop(at+note.d+.01);
     }
    }catch{/* A blocked audio output never blocks the microphone. */}
   };
   if(ctx.state==='suspended')ctx.resume().then(play).catch(()=>{});else play();
  }
  const beep=()=>playCue('error');
  function abortRecognition(){
   clearTimeout(watchdog);pauseClock();const rec=recognition;recognition=null;started=false;
   if(rec){rec.onresult=rec.onend=rec.onerror=rec.onstart=rec.onnomatch=null;try{rec.abort()}catch{}}
  }
  function createSession(){locationResolved=false;const u=units[0];return new root.ATHMAN_RECITATION.Follower(corpus,{index:corpus.byReference.get(u.sura+':'+u.aya)||0,word:u.startWord})}
  function applyScope(){
   if(prefs.mode==='practice'){const a=units[0],last=units.length-1,b=units[last];session.setRange(corpus.position(a.sura,a.aya,a.startWord),corpus.starts[pageUnitIndices[last]]+b.startWord+pageWords[last].length)}else session.setRange(0,corpus.words.length);
   session.strict=prefs.strict;
  }
  function followingPosition(pos,fallback){
   if(prefs.mode!=='follow'||pos>=corpus.words.length)return fallback;
   const last=units.length-1,pageEnd=corpus.starts[pageUnitIndices[last]]+units[last].startWord+pageWords[last].length;
   return pos>=pageEnd?pos:fallback;
  }
  function syncLocation(pos,{allowJump=false}={}){
   const ref=corpus.reference(pos);if(!ref)return false;
   const visible=units.some((u,i)=>u.sura===ref.sura&&u.aya===ref.aya&&ref.word>=u.startWord&&ref.word<u.startWord+pageWords[i].length);
   // Retrying an ayah that spans two passages must not reopen the earlier one.
   const pageStart=corpus.position(units[0].sura,units[0].aya,units[0].startWord);
   if(locationResolved&&!allowJump&&pos<pageStart)return false;
   if(visible||!resolveLocation(ref))return false;
   originalHeading=heading.textContent;units=readUnits();page?.remove();lastIndex=-1;buildPage();$('#recitationPageScroll').scrollTop=0;
   const save=reader.querySelector('.reader-tools .save-button');
   if(save){$('#recitationSave').setAttribute('aria-pressed',save.getAttribute('aria-pressed'));$('#recitationSave').setAttribute('aria-label',save.getAttribute('aria-label'))}
   $('#recitationPassagePrev').disabled=reader.querySelector('#readerPrev').disabled;$('#recitationPassageNext').disabled=reader.querySelector('#readerNext').disabled;
   return true;
  }
  function buildPage(){
   page=source.cloneNode(true);page.id='recitationPage';page.className='recitation-page';
   page.hidden=false;page.removeAttribute('aria-hidden');page.style.removeProperty('--quran-size');
   pageVerses=[...page.querySelectorAll('.verse')];pageWords=[];pageUnitIndices=units.map(u=>corpus.byReference.get(u.sura+':'+u.aya));pageLocal=new Map(pageUnitIndices.map((index,local)=>[index,local]));repeatVerses.clear();repeatCursor=null;
   pageVerses.forEach((verse,index)=>{
    const words=[];
    for(const node of [...verse.childNodes]){
     if(node.nodeType!==3)continue;
     const fragment=document.createDocumentFragment();
     for(const piece of node.textContent.split(/(\s+|۞)/u)){
      if(piece==='۞'){
       const mark=document.createElement('span');mark.className='recitation-division-marker';mark.textContent=piece;mark.dataset.word=String(words.length);mark.setAttribute('role','img');mark.setAttribute('aria-label','علامة تقسيم المصحف');fragment.append(mark);
      }else if(root.ATHMAN_RECITATION.sourceWords(piece).length){
       const word=document.createElement('span');word.className='recitation-word';word.textContent=piece;word.dataset.word=String(words.length);word.classList.toggle('is-marked',marks.has(markKey(index,words.length)));fragment.append(word);words.push(word);
      }else fragment.append(document.createTextNode(piece));
     }
     node.replaceWith(fragment);
    }
    const divisions=root.ATHMAN_DIVISIONS?.markersForVerse?.(root.QURAN_DATA?.eighths||[],corpus.units[pageUnitIndices[index]],root.ATHMAN_RECITATION.sourceWords)||[];
    for(const boundary of divisions){
     const local=boundary.word-units[index].startWord,target=words[local];if(!target)continue;
     let mark=verse.querySelector(`.recitation-division-marker[data-word="${local}"]`);
     if(!mark){mark=document.createElement('span');mark.className='recitation-division-marker';mark.textContent='۞';mark.dataset.word=String(local);mark.setAttribute('role','img');target.before(mark,document.createTextNode('\u00a0'))}
     mark.dataset.eighth=String(boundary.id);mark.title=`بداية الثمن ${boundary.part} من الحزب ${boundary.hizb}`;mark.setAttribute('aria-label',mark.title);
    }
    const marker=verse.querySelector('.verse-number');
    if(marker){const bdi=document.createElement('bdi');bdi.dir='ltr';bdi.textContent=String(units[index].aya);marker.innerHTML=icon('verse-frame');marker.append(bdi)}
    verse.dataset.recitationIndex=String(index);pageWords.push(words);
   });
   $('#recitationPageScroll').append(page);
  }
  function currentIntoView(word=null){
   const s=session.snapshot(),ref=corpus.reference(s.focusPos),local=(pageLocal.get(s.index)??-1),focused=ref?(pageLocal.get(ref.index)??-1):-1;
   const el=word||pageWords[local]?.[Math.min(s.cursor-units[local].startWord,pageWords[local].length-1)]||pageWords[focused]?.[ref.word-units[focused].startWord];if(!el)return;
   const scroll=$('#recitationPageScroll'),a=el.getBoundingClientRect(),b=scroll.getBoundingClientRect();
   if(a.top<b.top+12||a.bottom>b.bottom-12)el.scrollIntoView({block:'nearest',inline:'nearest',behavior:'instant'});
  }
  function paintHeading(u){
   if(!u)return;const info=contextFor(u),label=u.label||('سورة '+(root.QURAN_DATA?.surahs[u.sura-1]?.name||u.sura)+'، الآية '+u.aya);
   heading.textContent=label.split('،')[0];$('#recitationSurah').textContent=heading.textContent;
   $('#recitationMeta').textContent=`ورش | آية ${u.aya}${info.juz?' | جزء '+info.juz:''}${info.hizb?' | حزب '+info.hizb:''}`;
   $('#recitationPosition').textContent=label;
  }
  function paintPage(force=false,{positions=null,preserveLive=false}={}){
   const s=session.snapshot(),assisted=new Map(s.outcomes.map(o=>[o.index,o.assisted]));
   const frequencies=prefs.history&&study?new Map(study.history().map(r=>[`${r.sura}:${r.aya}:${r.word}`,r.sessions])):null;
   page.classList.toggle('is-masked',hideText);page.classList.toggle('hide-verse-numbers',!showNumbers);
   const changed=new Set([lastIndex,s.index,...s.changed,...liveIndices]);
   for(let i=0;i<pageVerses.length;i++){
    const global=pageUnitIndices[i];if(!force&&!changed.has(global))continue;
    const current=global===s.index,state=session.state(global),hints=new Set(current?s.hints:session.hints.get(global)||[]);
    const passedFragment=session.pos>=corpus.starts[global]+units[i].startWord+pageWords[i].length;
    const provisionalComplete=passedFragment||pageWords[i].every((_,n)=>state.read.has(n+units[i].startWord)||state.unverified.has(n+units[i].startWord)||session.provisional.has(corpus.starts[global]+n+units[i].startWord)||session.provisionalUnverified.has(corpus.starts[global]+n+units[i].startWord));
    pageVerses[i].classList.toggle('is-current',current);
    pageVerses[i].classList.toggle('is-matched',state.complete&&!state.errors.size&&!state.partial&&!state.ignored.size);
    pageVerses[i].classList.toggle('is-assisted',!!assisted.get(global));
    pageVerses[i].classList.toggle('has-recitation-errors',state.errors.size>0);
    pageVerses[i].setAttribute('aria-label',units[i].label+(state.errors.size?`، مواضع تحتاج مراجعة: ${state.errors.size}`:assisted.get(global)?'، بمساعدة':''));
    pageWords[i].forEach((word,n)=>{
     if(positions&&!positions.has(corpus.starts[global]+n+units[i].startWord))return;
     const actual=n+units[i].startWord,pending=current&&actual===s.errorIndex,flag=state.errors.get(actual),flagged=!!flag||pending,severity=pending?s.errorSeverity:flag?.severity;
     const provisional=session.provisional.has(corpus.starts[global]+actual);
     const unverified=!state.read.has(actual)&&(state.unverified.has(actual)||session.provisionalUnverified.has(corpus.starts[global]+actual));
     const visible=!hideText||state.read.has(actual)&&(prefs.reveal==='words'||state.complete||passedFragment)||provisional&&(prefs.reveal==='words'||provisionalComplete)||unverified&&(prefs.reveal==='words'||passedFragment)||state.ignored.has(actual)||flagged||session.peeked.has(global)||hints.has(actual);
     word.classList.toggle('is-ignored',state.ignored.has(actual));
     const frequency=frequencies?.get(`${units[i].sura}:${units[i].aya}:${actual}`)||0;
     if(frequency)word.dataset.history=String(Math.min(3,frequency));else delete word.dataset.history;
     word.classList.toggle('is-concealed',!visible);
     word.classList.toggle('is-hint',hints.has(actual));
     word.classList.toggle('is-cursor',current&&actual===Math.min(s.cursor,s.wordCount-1));
     word.classList.toggle('is-error',flagged&&severity!=='partial');
     word.classList.toggle('is-uncertain',flagged&&severity==='partial');
     word.classList.toggle('is-unverified',unverified&&!flagged);
     word.classList.toggle('is-heard',provisional);
     if(flagged)word.title=severity==='partial'?'التقاط غير مؤكّد أو مطابقة جزئية؛ يمكنك مواصلة القراءة أو التحقق من الكلمة.':'اختلاف نصي تكرر في نتائج واضحة من خدمة الصوت؛ تحقق من الكلمة.';else if(unverified)word.title='أُظهرت لمتابعة القراءة بعد تجاوز موضعها؛ لم تتأكد مطابقتها صوتيًا ولم تُحتسب كلمة صحيحة.';else word.removeAttribute('title');
     if(visible)word.removeAttribute('aria-hidden');else word.setAttribute('aria-hidden','true');
    });
   }
   if(preserveLive)return;
   liveWordTypes.clear();liveFocus=null;liveHeading=null;
   const focus=corpus.reference(s.focusPos),headingIndex=pageUnitIndices.includes(s.index)?s.index:pageUnitIndices.includes(focus?.index)?focus.index:pageUnitIndices[0];
   paintHeading(corpus.units[headingIndex]);
   liveIndices.clear();
   if(lastIndex!==s.index)currentIntoView();lastIndex=s.index;
  }
  function paintInterim(preview){
   if(!preview)return;
   const reads=preview.operations.filter(op=>op.type==='read');
   // Paint the newest hypothesis from the committed state. A revised hypothesis
   // retracts the earlier reveal, without adding mistakes or journal entries.
   const target=followingPosition(preview.endPos,preview.focusPos),moved=reads.length&&syncLocation(target,{allowJump:!!preview.location&&!locationResolved});if(preview.location)locationResolved=true;if(moved)paintPage(true);
   const completed=new Set(preview.operations.filter(op=>{const w=corpus.words[op.pos],local=(pageLocal.get(w.index)??-1);return local>=0&&preview.endPos>=corpus.starts[w.index]+units[local].startWord+pageWords[local].length}).map(op=>corpus.words[op.pos].index));
   const next=new Map(preview.operations.map(op=>[op.pos,(op.type==='read'?'read':'unverified')+':'+(prefs.reveal==='words'||completed.has(corpus.words[op.pos].index)?'show':'hide')]));
   const restore=new Set([...liveWordTypes.keys()].filter(pos=>liveWordTypes.get(pos)!==next.get(pos)));
   if(restore.size)paintPage(false,{positions:restore,preserveLive:true});
   liveIndices.clear();
   for(const op of preview.operations){
    const ref=corpus.reference(op.pos),local=(pageLocal.get(ref.index)??-1),word=pageWords[local]?.[ref.word-units[local]?.startWord];
    if(!word)continue;liveIndices.add(ref.index);if(liveWordTypes.get(op.pos)===next.get(op.pos))continue;
    if(prefs.reveal==='words'||completed.has(ref.index)){
     word.classList.remove('is-concealed');word.removeAttribute('aria-hidden');
     if(op.type==='read'){word.classList.add('is-heard');word.classList.remove('is-unverified');if(!word.classList.contains('is-error')&&!word.classList.contains('is-uncertain'))word.removeAttribute('title')}
     else if(!session.state(ref.index).read.has(ref.word)&&!word.classList.contains('is-error')&&!word.classList.contains('is-uncertain')){word.classList.add('is-unverified');word.title='كشف مؤقت لموضع متجاوز لم تتأكد مطابقته؛ لا يُحتسب تسميعًا صحيحًا.'}
    }
   }
   liveWordTypes=next;
   const ref=corpus.reference(reads.length?preview.focusPos:target),local=(pageLocal.get(ref?.index)??-1),focused=pageWords[local]?.[ref?.word-units[local]?.startWord];
   if(reads.length&&ref){
    if(liveFocus!==preview.focusPos||moved||restore.size){page.querySelectorAll('.is-cursor').forEach(word=>word.classList.remove('is-cursor'));focused?.classList.add('is-cursor');currentIntoView(focused);liveFocus=preview.focusPos}
    if(liveHeading!==ref.index){paintHeading(corpus.units[ref.index]);$('#recitationMeta').textContent+=' · مباشر';liveHeading=ref.index}
    message('أتابع قراءتك الآن. الكشف المباشر مؤقت حتى تكتمل نتيجة الصوت.');
   }
  }
  function paintRepetition(repetition){
   const indices=new Set((repetition?.positions||[]).map(pos=>corpus.words[pos].index));
   for(const index of repeatVerses)if(!indices.has(index))pageVerses[pageLocal.get(index)]?.classList.remove('is-repeated');
   for(const index of indices)if(!repeatVerses.has(index))pageVerses[pageLocal.get(index)]?.classList.add('is-repeated');
   repeatVerses=indices;
   const ref=repetition?corpus.reference(repetition.focusPos):null,local=ref?(pageLocal.get(ref.index)??-1):undefined;
   const next=pageWords[local]?.[ref?.word-units[local]?.startWord]||null;
   if(next!==repeatCursor){repeatCursor?.classList.remove('is-repeat-cursor');next?.classList.add('is-repeat-cursor');repeatCursor=next;if(next)currentIntoView(next)}
   if(indices.size)message('أتابع إعادة الآية بالأخضر. يبقى تقدّمك محفوظًا؛ واصل القراءة عندما تتذكر.');
  }
  function setSettings(open){
   const panel=$('#recitationSettingsPanel');if(!panel)return;panel.hidden=!open;
   settingsButton?.setAttribute('aria-expanded',String(open));
   if(open){if($('#recitationWordMenu'))$('#recitationWordMenu').hidden=true;setPopover('Menu',false);setPopover('Search',false);$('#recitationSettingsStatus').textContent=$('#recitationStatus').textContent;$('#recitationSettingsClose').focus()}else settingsButton?.focus();
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
   const value=$('#recitationSearchInput').value,results=$('#recitationSearchResults');results.replaceChildren();if(!value.trim())return;
   const matches=corpus.search(value),count=document.createElement('p');count.textContent=matches.length?`${matches.length} موضعًا في القرآن`:'لا توجد نتائج مطابقة. جرّب عبارة أقصر أو مرجعًا مثل 29:46.';results.append(count);
   for(const r of matches){const button=document.createElement('button');button.type='button';button.dataset.recitationResult=String(r.pos);button.textContent=corpus.units[r.index].label;results.append(button)}
  }
  function goToReference(reference,{reveal=true}={}){
   stop();session.setRange(0,corpus.words.length);if(!session.seek(reference.sura,reference.aya,reference.word))return;
   if(reveal)hideText=false;manualStart=true;syncLocation(session.pos,{allowJump:true});locationResolved=true;applyScope();render(true);currentIntoView();
  }
  function canTurn(){return active&&!wantsAudio&&!marking&&![...host.querySelectorAll('.recitation-popover')].some(panel=>!panel.hidden)}
  function focusManualPage(){
   const top=$('#recitationPageScroll').getBoundingClientRect().top;
   const local=pageVerses.findIndex(verse=>verse.getBoundingClientRect().bottom>top+8);
   if(local<0)return;
   const word=pageWords[local].find(w=>w.getBoundingClientRect().bottom>top+8),u=units[local];
   session.seek(u.sura,u.aya,(word?Number(word.dataset.word):0)+u.startWord);session.beginSearch();manualStart=false;locationResolved=false;paintHeading(corpus.units[pageUnitIndices[local]]);
  }
  function turnPassage(direction){
   if(!canTurn())return false;
   const scroll=$('#recitationPageScroll'),last=Math.max(0,scroll.scrollHeight-scroll.clientHeight);
   const hasMore=direction>0?scroll.scrollTop<last-3:scroll.scrollTop>3;
   if(hasMore){
    const line=parseFloat(getComputedStyle(page).lineHeight)||fontSize*1.86,stride=Math.max(line,(Math.floor(scroll.clientHeight/line)-1)*line);
    scroll.scrollTop=Math.max(0,Math.min(last,scroll.scrollTop+direction*stride));focusManualPage();
    message('انتقلت إلى شاشة القراءة '+(direction>0?'التالية':'السابقة')+' داخل المقطع.');return true;
   }
   const reference=adjacentReference(direction);
   if(!reference){notice(direction>0?'وصلت إلى آخر مقطع.':'أنت في أول مقطع.');return false}
   goToReference(reference,{reveal:false});const next=$('#recitationPageScroll');next.scrollTop=direction>0?0:Math.max(0,next.scrollHeight-next.clientHeight);focusManualPage();
   message('انتقلت إلى المقطع '+(direction>0?'التالي':'السابق')+'. اسحب يمينًا للتالي ويسارًا للسابق.');return true;
  }
  function pointerDown(event){
   swipe=null;
   if(!canTurn()||!event.isPrimary||!['touch','pen'].includes(event.pointerType)||!event.target.closest('#recitationPageScroll'))return;
   swipe={id:event.pointerId,x:event.clientX,y:event.clientY,time:now(),width:$('#recitationPageScroll').clientWidth};
  }
  function pointerUp(event){
   const origin=swipe;swipe=null;if(!origin||event.pointerId!==origin.id||!canTurn())return;
   const dx=event.clientX-origin.x,dy=event.clientY-origin.y;
   if(now()-origin.time>1200||Math.abs(dx)<Math.max(48,Math.min(84,origin.width*.16))||Math.abs(dx)<Math.abs(dy)*1.5)return;
   suppressClickUntil=now()+400;event.preventDefault();turnPassage(dx>0?1:-1);
  }
  function pointerCancel(){swipe=null}
  function paintClock(){
   const timer=$('#recitationTimer'),value=$('#recitationElapsed');if(!timer||!value)return;
   const seconds=Math.floor((elapsedMs+(listeningSince===null?0:now()-listeningSince))/1000),minutes=Math.floor(seconds/60),pad=n=>String(n).padStart(2,'0');
   value.textContent=(minutes>=60?pad(Math.floor(minutes/60))+':':'')+pad(minutes%60)+':'+pad(seconds%60);
   timer.hidden=!wantsAudio;
   paintResponseInfo();
  }
  function paintResponseInfo(){
   const status=$('#recitationResponseInfo'),heard=$('#recitationHeardText');if(!status||!heard)return;
   status.textContent=responseInfo.received===null?'لم تصل كلمات من خدمة الصوت بعد. يبدأ الإظهار عند وصولها.':`آخر نتيجة ${responseInfo.kind} وصلت قبل ${Math.max(0,Math.floor((now()-responseInfo.received)/1000))} ث · المعالجة داخل أثمان: ${responseInfo.processing.toFixed(1)} ms`;
   heard.textContent=responseInfo.transcript||'لا توجد كلمات ملتقطة بعد.';
  }
  function recordResponse(event,received){
   let last=null;for(let i=event.results.length-1;i>=0;i--)if(event.results[i][0]?.transcript?.trim()){last=event.results[i];break}
   responseInfo={received,processing:now()-received,kind:last?.isFinal?'نهائية':'أولية',transcript:(last?.[0]?.transcript||'').trim().split(/\s+/u).slice(-32).join(' ').slice(-450)};paintResponseInfo();
  }
  function startClock(){if(listeningSince!==null)return;listeningSince=now();clearInterval(clockTimer);clockTimer=setInterval(paintClock,1000);paintClock()}
  function pauseClock(){if(listeningSince!==null){elapsedMs+=now()-listeningSince;listeningSince=null}clearInterval(clockTimer);clockTimer=null;paintClock()}
  function showWordMenu(word){
   const local=Number(word.closest('.verse').dataset.recitationIndex),actual=Number(word.dataset.word)+units[local].startWord;
   selectedWord={sura:units[local].sura,aya:units[local].aya,word:actual,index:pageUnitIndices[local]};
   if(word.classList.contains('is-concealed')){const hints=session.hints.get(selectedWord.index)||new Set();hints.add(actual);session.hints.set(selectedWord.index,hints);render()}
   $('#recitationWordLabel').textContent=word.textContent;$('#recitationWordReference').textContent=units[local].label+' · الكلمة '+(actual+1);
   $('#recitationIgnoreError').hidden=!word.matches('.is-error,.is-uncertain');$('#recitationWordMenu').hidden=false;$('#recitationWordMenuClose').focus();
  }
  function syncMarking(){
   page.classList.toggle('is-marking',marking);$('#recitationMarker').setAttribute('aria-pressed',String(marking));
   for(const words of pageWords)for(const word of words){
    if(marking&&!word.classList.contains('is-concealed')){word.tabIndex=0;word.setAttribute('role','button');word.setAttribute('aria-label','تبديل تحديد: '+word.textContent);word.setAttribute('aria-pressed',String(word.classList.contains('is-marked')))}
    else if(word.matches('.is-error,.is-uncertain')&&!word.classList.contains('is-concealed')){word.tabIndex=0;word.setAttribute('role','button');word.setAttribute('aria-label','مراجعة العلامة على: '+word.textContent);word.removeAttribute('aria-pressed')}
    else{word.removeAttribute('tabindex');word.removeAttribute('role');word.removeAttribute('aria-label');word.removeAttribute('aria-pressed')}
   }
  }
  function markWord(word){
   const i=Number(word.closest('.verse').dataset.recitationIndex),n=Number(word.dataset.word),key=markKey(i,n);
   marks.has(key)?marks.delete(key):marks.add(key);word.classList.toggle('is-marked',marks.has(key));saveMarks();syncMarking();
  }
  function paintTransport(){
   const b=$('#recitationListen');if(!b)return;
   b.disabled=!Recognition;
   b.setAttribute('aria-pressed',String(wantsAudio));
   const label=wantsAudio?(started?'إيقاف الاستماع مؤقتًا':'إيقاف / جارٍ الاتصال…'):'بدء الاستماع';
   b.setAttribute('aria-label',label);b.title=label;
   const transport=wantsAudio?'rec-pause':'rec-mic';if(b.dataset.transport!==transport){b.innerHTML=icon(transport);b.dataset.transport=transport}
   b.setAttribute('aria-describedby','recitationStatus');
   host.classList.toggle('is-listening',wantsAudio&&started);
   paintClock();
  }
  function stop(text,{audible=false}={}){
   const wasListening=wantsAudio;wantsAudio=false;if(audible&&wasListening)playCue('stop');paintRepetition(null);clearTimeout(restartTimer);abortRecognition();session?.endUtterance();
   if(active&&page&&(liveIndices.size||session?.provisional.size||session?.provisionalUnverified.size))paintPage();
   if(study?.active?.id===journalId){study.finish();if(!study.lastSaveOK)notice('تعذّر حفظ سجل الجلسة على هذا الجهاز.')}
   paintTransport();if(text)message(text);
  }
  function render(force=false,allowJump=false){
   if(!active||destroyed)return;
   const s=session.snapshot();if(syncLocation(followingPosition(session.pos,s.focusPos),{allowJump}))force=true;paintPage(force);
   const completed=s.outcomes.filter(o=>pageUnitIndices.includes(o.index)).length,total=units.length;
   $('#recitationProgress').textContent=String(completed)+(completed===1?' آية':' آيات');
   $('#recitationPercent').textContent=Math.floor(completed/Math.max(1,total)*100)+'%';
   $('#recitationSummary').setAttribute('aria-label',`تقدم التسميع: ${completed} من ${total} آية. مواضع تحتاج مراجعة: ${s.errorCount}. عرض الإعدادات`);
   const progress=$('#recitationProgressBar');progress.value=completed;progress.max=Math.max(1,total);
   if(s.complete){
    stop(`اكتمل نطاق الجلسة. مواضع تحتاج مراجعة: ${s.errorCount}.`);
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
   $('#recitationShowNumbers').checked=showNumbers;$('#recitationHintCount').textContent=String(s.errorCount);
   $('#recitationAttempts').innerHTML=s.errorIndex!==null?`الكلمة ${s.errorIndex+1} · <bdi dir="ltr">${s.attempts} / 3</bdi>`:'';
   $('#recitationLive').textContent=s.complete?'':`الموضع الحالي: الكلمة ${Math.min(s.cursor+1,s.wordCount)} من ${s.wordCount}`;
   host.classList.toggle('has-mismatch',s.errorIndex!==null||s.errorCount>0);paintTransport();syncMarking();
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
   recognition=rec;rec.lang=localeFallback?'ar-SA':prefs.locale;rec.continuous=true;rec.interimResults=true;rec.maxAlternatives=3;
   const stream=new root.ATHMAN_RECITATION.SpeechInput(session);let hadResult=false;
   rec.onstart=()=>{if(!isCurrent(rec))return;if(study&&!study.active)journalId=study.begin({mode:prefs.mode,scope:prefs.mode==='practice'?'passage':'all'});clearTimeout(watchdog);clearTimeout(noticeTimer);$('#recitationNotice').hidden=true;started=true;startFailures=0;startClock();paintTransport();message(session.locating?(prefs.mode==='practice'?'أستمع لآيات المقطع المحدد؛ الاستعاذة والبسملة لا تحددان البداية.':'أستمع إليك. اقرأ من أي موضع؛ أنتظر آيات التلاوة بعد الاستعاذة والبسملة.'):'أستمع إليك وأتابع موضع قراءتك.')};
   rec.onresult=event=>{
    if(!isCurrent(rec)||!wantsAudio)return;
    const received=now();try{
    const batch=stream.update(event.results);
    if(batch.hadSpeech){hadResult=true;idleEnds=0}if(!batch.changed)return;
    for(const result of batch.commits){
     if(study){if(!study.active)journalId=study.begin({mode:prefs.mode,scope:prefs.mode==='practice'?'passage':'all'});study.record(result.events);for(const e of result.events||[])if(e.type!=='read')mistakeSessions.set(`${e.sura}:${e.aya}:${e.word}`,journalId)}
    }
    if(batch.commits.length){
     const location=batch.commits.find(r=>r.location)?.location,result=batch.commits.at(-1);
     if(!batch.commits.every(r=>r.type==='repeated'))render(false,!!location&&!locationResolved);if(location)locationResolved=true;
     if(batch.commits.some(r=>r.definiteErrors))beep();
     if(result.type==='repeated')message('أتابع إعادة الآية بالأخضر؛ تقدّمك محفوظ.');
     else if(result.type==='locating')message(result.invocation?'أنتظر كلمات الآية بعد الاستعاذة أو البسملة لتحديد موضعك.':result.ambiguous?'هذه الكلمات تتكرر في أكثر من موضع. واصل القراءة لتحديد الآية.':'جارٍ تحديد الموضع. اقرأ كلمات متتابعة من الآية.');
     else if(result.autoHint)message('أُظهرت الكلمة بعد 3 محاولات واضحة. يمكنك تصحيحها أو مواصلة القراءة.');
     else if(result.definiteErrors)message('اختلاف نصي تكرر في نتائج واضحة؛ ظُلّلت الكلمة بالأحمر. يمكنك التحقق منها أو مواصلة القراءة.');
     else if(result.type==='unclear'||result.unclear)message('لم تتضح بعض الكلمات للخدمة؛ لا تُحسب أخطاء مؤكدة. واصل القراءة لأتابع موضعك.');
     else if(result.type==='mismatch'||result.continued)message('الأصفر موضع التقاط غير مؤكّد، وليس حكمًا بخطئك. يمكنك مواصلة القراءة أو إعادة الكلمة.');
     else message(location?'تم تحديد موضع التلاوة. تابع القراءة.':'أتابعك. تظهر الكلمات المطابقة مع تقدّمك في التلاوة.');
     if(result.complete)return;
    }
    if(batch.preview&&!session.complete){
     paintInterim(batch.preview);
     $('#recitationLive').textContent='متابعة مباشرة مؤقتة؛ تُراجع عند اكتمال نتيجة الصوت.';
    }else{if(liveIndices.size)paintPage();if(batch.locating)message(batch.invocation?'أنتظر كلمات الآية بعد الاستعاذة أو البسملة لتحديد موضعك.':batch.ambiguous?'المقطع متشابه في أكثر من موضع؛ واصل القراءة.':'أستمع إليك لتحديد الآية.')}
    paintRepetition(batch.preview?batch.preview.repetition:batch.commits.at(-1)?.repetition||null);
    }finally{recordResponse(event,received)}
   };
   rec.onnomatch=()=>{if(isCurrent(rec))message('لم يتضح الصوت. حاول مجددًا؛ لا تُحتسب هذه محاولة خاطئة.')};
   rec.onerror=event=>{
    if(!isCurrent(rec)||event.error==='aborted')return;
    if(event.error==='language-not-supported'&&rec.lang==='ar-MA'&&!localeFallback){localeFallback=true;abortRecognition();message('خدمة المتصفح لا تدعم العربية (المغرب)؛ جارٍ التجربة بالعربية. يبقى المصحف والمطابقة برواية ورش.');scheduleRestart(0);return}
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
    if(!isCurrent(rec))return;clearTimeout(watchdog);pauseClock();recognition=null;started=false;session.endUtterance();if(liveIndices.size||session.provisional.size||session.provisionalUnverified.size)paintPage();
    if(!wantsAudio)return;
    if(!hadResult)idleEnds++;if(idleEnds>=3){fatal('لم يصل صوت واضح من الخدمة. اضغط بدء الاستماع للمحاولة مجددًا.');return}
    paintTransport();scheduleRestart(hadResult?0:700);
   };
   try{rec.start();watchdog=setTimeout(()=>{if(isCurrent(rec)&&!started)fatal('لم تستجب خدمة التعرّف الصوتي. تحقق من اتصالك وإذن الميكروفون ثم حاول مجددًا.')},12000)}catch(error){if(error?.name==='InvalidStateError'&&startFailures<2){startFailures++;abortRecognition();scheduleRestart(startFailures*80);return}fatal('تعذّر بدء الاستماع. تحقق من إذن الميكروفون واتصالك ثم حاول مجددًا.')}
   paintTransport();
  }
  function enable(conceal=true){
   if(active||!units.length||destroyed)return;active=true;hideText=conceal||prefs.mode==='practice';sound=true;lastIndex=-1;showNumbers=true;marking=false;
   session=createSession();
   host.innerHTML=`<section class="recitation-panel" aria-label="صفحة التسميع">
    <header class="recitation-header" dir="ltr">
     <button class="recitation-header-button" id="recitationMenu" aria-label="قائمة المصحف" aria-expanded="false" aria-controls="recitationMenuPanel">${icon('rec-menu')}</button>
     <div class="recitation-title-card" dir="rtl"><button id="recitationSave" aria-label="حفظ الموضع">${icon('rec-bookmark')}</button><div><h2 id="recitationSurah"></h2><p id="recitationMeta"></p></div></div>
     <button class="recitation-header-button" id="recitationSearch" aria-label="البحث في القرآن" aria-expanded="false" aria-controls="recitationSearchPanel">${icon('rec-search')}</button>
     <a class="recitation-header-button recitation-gift" href="support.html" aria-label="دعم أثمان ومشاركته">${icon('rec-gift')}</a>
     <button class="recitation-header-button" id="recitationSettings" aria-label="إعدادات التسميع" aria-expanded="false" aria-controls="recitationSettingsPanel">${icon('rec-settings')}</button>
    </header>
    <nav class="recitation-popover recitation-menu" id="recitationMenuPanel" aria-label="قائمة المصحف" hidden><div class="recitation-settings-heading"><strong>أثمان</strong><button id="recitationMenuClose" class="icon-button" aria-label="إغلاق قائمة المصحف">${icon('close')}</button></div><button id="recitationJournal">جلساتي ومواضع المراجعة</button><button id="recitationExit">العودة إلى القراءة العادية</button><a data-recitation-route href="#/">الأحزاب</a><a data-recitation-route href="#/halves">الأنصاف</a><a data-recitation-route href="#/quarters">الأرباع</a><a data-recitation-route href="#/eighths">الأثمان</a><a data-recitation-route href="#/surahs">السور</a><a data-recitation-route href="#/saved">مواضعي المحفوظة</a><a href="support.html">الدعم والمشاركة</a><button id="recitationClose">إغلاق المصحف</button></nav>
    <div class="recitation-popover recitation-search" id="recitationSearchPanel" hidden><div class="recitation-settings-heading"><label for="recitationSearchInput">البحث في القرآن الكريم</label><button id="recitationSearchClose" class="icon-button" aria-label="إغلاق البحث">${icon('close')}</button></div><input id="recitationSearchInput" type="search" autocomplete="off" placeholder="ابحث بعبارة أو مرجع مثل 29:46"><div id="recitationSearchResults" aria-live="polite"></div></div>
    <div class="recitation-popover recitation-settings" id="recitationSettingsPanel" hidden><div class="recitation-settings-heading"><strong>إعدادات التسميع</strong><button id="recitationSettingsClose" class="icon-button" aria-label="إغلاق إعدادات التسميع">${icon('close')}</button></div><p class="recitation-disclosure">تسميع برواية ورش عن نافع: النص والترقيم ومرجع الكلمات من مصحف ورش. خدمة تحويل الصوت في المتصفح عامة، وليست نموذجًا صوتيًا مدرّبًا على ورش؛ لا تقيّم هذه الأداة الأوجه أو التجويد. قد تعالج خدمة متصفحك الصوت عبر الإنترنت؛ أثمان لا يحفظ تسجيلاتك. يحدّد التطبيق موضع قراءتك في القرآن كاملًا. لا تُستخدم الاستعاذة أو البسملة وحدها لاختيار موضع الآية. بعد تحديد الآية يثبت موضع المراجعة؛ لا يعاد البحث في السور المتشابهة إلا بطلبك من زر تحديد الموضع مجددًا. عند التعثر يستمر تتبع الكلمات القريبة؛ وعند التوقف للتصحيح تظهر الكلمة بعد 3 نتائج واضحة غير متطابقة؛ النتائج ضعيفة الالتقاط لا تضيف محاولة. الآيات المتشابهة تحتاج كلمات إضافية لتمييز موضعها. زر القلم يتيح تحديد الكلمات يدويًا؛ الألوان تخص التحديد والتلميحات والتعثر، وليست أحكام التجويد.</p><div class="recitation-settings-row"><label>لغة خدمة الصوت <select id="recitationLocale" aria-label="لغة خدمة التعرف الصوتي"><option value="ar-MA">العربية (المغرب)</option><option value="ar-SA">العربية (السعودية)</option></select></label></div><p class="recitation-disclosure">هذا اختيار للغة خدمة الصوت فقط؛ يظل المصحف برواية ورش في الخيارين. تظهر الكلمات الواضحة مؤقتًا مع وصولها، وتُراجع عند اكتمال نتيجة الصوت. تُعالج إعادة الكلمات وتداخل النتائج دون إجبارك على الإعادة. عند إعادة الآية الحالية أو السابقة يظهر تمييز أخضر فور تعرف الخدمة على عبارتها المحلية، ويبقى تقدّمك محفوظًا دون احتسابها مرتين أو الانتقال إلى سورة أخرى. يختفي التمييز عند مواصلة التلاوة. عند إعادة اتصال الخدمة يبقى الكشف المؤقت دون احتسابه تسميعًا مؤكدًا. إذا لم يوفر المتصفح نتائج أولية فستتأخر المتابعة حتى تصل النتيجة.</p><details class="recitation-response"><summary>تشخيص سرعة الاستجابة</summary><p>آخر كلمات وصلت من خدمة الصوت، وزمن معالجتها داخل أثمان. يساعد هذا العرض على تمييز انتظار الخدمة من انتظار المطابقة.</p><p id="recitationResponseInfo" aria-live="off"></p><p id="recitationHeardText" dir="rtl"></p><p>الزمن لا يشمل التقاط الصوت أو الشبكة أو وقت خدمة المتصفح. هذا عرض مؤقت للجلسة؛ لا تُحفظ الكلمات في السجل أو النسخة الاحتياطية.</p></details><div class="recitation-settings-row"><label>الوضع <select id="recitationMode" aria-label="وضع القراءة والتسميع"><option value="follow">تسميع حر من أي آية</option><option value="practice">مراجعة المقطع المفتوح فقط</option><option value="read">قراءة</option></select></label><label><input type="checkbox" id="recitationStrict"> التوقف حتى تصحيح الكلمة</label></div><div class="recitation-settings-row"><label>إظهار المطابقة <select id="recitationReveal" aria-label="طريقة إظهار الآيات"><option value="words">كلمة بكلمة</option><option value="verse">بعد اكتمال الآية</option></select></label><label><input type="checkbox" id="recitationHistory"> تظليل مواضع المراجعة السابقة</label></div><p class="recitation-disclosure recitation-legend"><span class="legend-red">● أحمر: اختلاف نصي متكرر في نتائج واضحة</span><span class="legend-yellow">● أصفر: التقاط غير مؤكّد أو مطابقة جزئية</span><span class="legend-green">● أخضر: إعادة الآية السابقة أو الحالية</span><span class="legend-unverified">● ذهبي خفيف: كلمة متجاوزة أُظهرت دون تأكيد صوتي</span></p><p class="recitation-disclosure">التلوين علامة مطابقة نصية، وليس حكمًا على صحة نطقك. لا يُحسب سقوط كلمة من خدمة الصوت وحده خطأ حذف، ولا تُحتسب الكلمة غير الملتقطة مطابقة. أول اختلاف يبقى أصفر؛ لا يظهر الأحمر والتنبيه إلا عند تكرار الاختلاف نفسه في نتائج نهائية ذات ثقة مرتفعة من الخدمة. قد تخطئ الخدمة في تقديرها. يمكنك مواصلة القراءة أو التحقق من العلامة. الكلمات التي تتجاوزها المتابعة تظهر بتظليل ذهبي خفيف بدل بقائها فراغات، ولا تُحتسب مطابقة صوتية لمجرد ظهورها. علامة الثمن تبقى ظاهرة مع إخفاء الآيات. التسميع الحر يبحث في القرآن كله عند البداية، ثم يثبت موضعك ويتابع بالتسلسل. مراجعة المقطع تحصر البحث والمتابعة في الجزء المفتوح. تظليل السجل: ذهبي لجلسة، برتقالي لجلستين، وأحمر لثلاث جلسات أو أكثر؛ وهو سجل علامات المطابقة.</p><div class="recitation-settings-row"><label><input id="recitationSound" type="checkbox" checked> أصوات الميكروفون والتنبيه</label><label>المظهر <select id="recitationTheme" aria-label="مظهر صفحة التسميع"><option value="dark">داكن</option><option value="light">فاتح</option></select></label><label><input id="recitationAutoHide" type="checkbox" checked> إخفاء النص عند بدء التسميع</label><label><input id="recitationShowNumbers" type="checkbox" checked> أرقام الآيات</label></div><div class="recitation-settings-row"><span>حجم الخط</span><button class="recitation-secondary" id="recitationSmaller" aria-label="تصغير خط التسميع">أ−</button><bdi id="recitationFontSize">${fontSize}</bdi><button class="recitation-secondary" id="recitationLarger" aria-label="تكبير خط التسميع">أ+</button></div><div class="recitation-settings-actions"><button class="recitation-secondary" id="recitationResync">تحديد موضع قراءتي مجددًا</button><button class="recitation-secondary" id="recitationJournalSettings">جلساتي ومواضع المراجعة</button><button class="recitation-secondary" id="recitationNext">متابعة الآية التالية بمساعدة</button><button class="recitation-secondary" id="recitationReset">إعادة التسميع من البداية</button><button class="recitation-secondary" id="recitationClearMarks">مسح تحديدات هذا المقطع</button><button class="recitation-secondary" id="recitationPassagePrev">المقطع السابق</button><button class="recitation-secondary" id="recitationPassageNext">المقطع التالي</button></div><p class="recitation-disclosure" id="recitationVersion">نسخة التسميع ${root.ATHMAN_RECITATION.version||'قديمة'}${root.ATHMAN_RECITATION.version===BUILD?'':' · يلزم تحديث التطبيق'}</p><button class="recitation-secondary" id="recitationReload">تحديث التطبيق</button><p class="recitation-disclosure" id="recitationSettingsStatus"></p><p class="recitation-disclosure">للمراجعة دون تسميع: اسحب يمينًا للمقطع التالي ويسارًا للسابق، مع بقاء التمرير العمودي للقراءة. يحافظ الانتقال على إخفاء النص أو إظهاره. تظهر علامة الإيقاف المؤقت ومدة الاستماع أثناء تشغيل الميكروفون. نغمة صاعدة عند طلب تشغيله، وهابطة عند إيقافه بالزر؛ يمكن كتمها من «أصوات الميكروفون والتنبيه».</p><p class="recitation-disclosure">النص برواية ورش، ويتكيّف مع الشاشة. يعرض الشريط رقم الآية؛ لا نضع رقم صفحة مطبوعة دون خريطة صفحات مطابقة.</p></div>
    <div id="recitationWordMenu" class="recitation-word-menu recitation-popover" hidden><div class="recitation-settings-heading"><strong id="recitationWordLabel"></strong><button id="recitationWordMenuClose" class="icon-button" aria-label="إغلاق خيارات الكلمة">${icon('close')}</button></div><p id="recitationWordReference"></p><button id="recitationIgnoreError" class="recitation-secondary">هذه العلامة غير صحيحة، أزلها</button><button id="recitationStartHere" class="recitation-secondary">المتابعة من هذه الكلمة</button><button id="recitationFindPhrase" class="recitation-secondary">مواضع العبارة في القرآن</button></div>
    <div class="recitation-position"><span id="recitationPosition"></span></div>
    <div class="recitation-page-scroll" id="recitationPageScroll" tabindex="0" aria-label="صفحة الآيات؛ اسحب يمينًا للمقطع التالي ويسارًا للسابق عند توقف الميكروفون"></div>
    <div class="recitation-notice" id="recitationNotice" hidden></div>
    <div class="recitation-feedback"><p class="recitation-status" id="recitationStatus" role="status" aria-live="polite"></p><div class="recitation-live-row"><span class="recitation-live" id="recitationLive" aria-live="off"></span><span id="recitationAttempts"></span></div><progress id="recitationProgressBar" aria-label="تقدم التسميع"></progress></div>
    <footer class="recitation-dock" dir="ltr"><div class="recitation-dock-left"><div class="recitation-counters"><button id="recitationHelp" aria-label="مساعدة التسميع">${icon('rec-help')}<bdi id="recitationHintCount">0</bdi></button><button id="recitationSummary"><bdi id="recitationProgress"></bdi><span aria-hidden="true">|</span><bdi id="recitationPercent"></bdi></button><span class="recitation-timer" id="recitationTimer" role="timer" aria-label="مدة الاستماع الحالية" aria-live="off" hidden><span class="recitation-timer-dot" aria-hidden="true"></span><bdi dir="ltr" id="recitationElapsed">00:00</bdi></span></div><div class="recitation-dock-actions"><button class="recitation-tool" id="recitationBook" aria-label="فهرس المصحف">${icon('rec-book')}</button><button class="recitation-tool" id="recitationHide" type="button"></button><div class="recitation-hints" id="recitationHints"><button class="recitation-tool recitation-hint" id="recitationWord" aria-label="إظهار كلمة مساعدة">${icon('rec-chevron')}</button><button class="recitation-tool recitation-hint" id="recitationVerse" aria-label="إظهار الآية الحالية">${icon('rec-double-chevron')}</button></div><button class="recitation-tool" id="recitationMarker" aria-label="تحديد الكلمات بالقلم" aria-pressed="false">${icon('rec-marker')}</button><button class="recitation-tool" id="recitationNumbers" aria-label="إظهار أو إخفاء أرقام الآيات">${icon('rec-panels')}</button></div></div><button class="recitation-mic" id="recitationListen" type="button"></button></footer>
   </section>`;
   reader.classList.add('recitation-reader');
   try{theme=localStorage.getItem('athman-recitation-theme')||'dark'}catch{theme='dark'}
   setPageTheme(theme);$('#recitationTheme').value=theme;
   source.hidden=true;source.setAttribute('aria-hidden','true');toggle.setAttribute('aria-pressed','true');toggle.setAttribute('aria-label','إنهاء التسميع والعودة إلى القراءة');
   reader.setAttribute('aria-labelledby','recitationSurah');
   settingsButton=$('#recitationSettings');
   $('#recitationLocale').value=prefs.locale;$('#recitationMode').value=prefs.mode;$('#recitationStrict').checked=prefs.strict;$('#recitationReveal').value=prefs.reveal;$('#recitationHistory').checked=prefs.history;
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
  function startAudio(){
   if(!active||!Recognition||wantsAudio)return;
   if(root.ATHMAN_RECITATION.version!==BUILD){setSettings(true);notice('ملفات التطبيق غير محدثة بالكامل. اضغط تحديث التطبيق ثم أعد فتح التسميع.');return;}
   if(prefs.mode==='read'){prefs.mode='follow';$('#recitationMode').value=prefs.mode;savePrefs()}
   applyScope();if(!manualStart&&(!session.locked||!session.canResume()))session.beginSearch();manualStart=false;localeFallback=false;elapsedMs=0;responseInfo={received:null,processing:0,kind:'',transcript:''};
   if($('#recitationAutoHide').checked)hideText=true;render(true);
   wantsAudio=true;idleEnds=0;startFailures=0;playCue('start');notice((session.locked?'أستأنف من موضع المراجعة الثابت.':prefs.mode==='practice'?'اقرأ آيات من المقطع المفتوح لتحديد البداية.':'اقرأ من أي موضع لتحديد بداية المراجعة.')+' جارٍ فتح الميكروفون؛ قد تعالج خدمة متصفحك الصوت عبر الإنترنت.');beginCycle();
  }
  function handleClick(event){
   if(!active)return;
   if(now()<suppressClickUntil&&event.target.closest('#recitationPageScroll')){event.preventDefault();event.stopPropagation();return}
   if(event.target.closest('[data-recitation-route]')){reader.querySelector('[data-close-reader]').click();return}
   const word=event.target.closest('.recitation-word');if(marking&&word){markWord(word);return}if(word&&(!word.classList.contains('is-concealed')||word.classList.contains('is-error'))){showWordMenu(word);return}
   const result=event.target.closest('[data-recitation-result]');
   if(result){setPopover('Search',false);goToReference(corpus.reference(Number(result.dataset.recitationResult)));return}
   const id=event.target.closest('button')?.id;
   if(id==='recitationListen'){
    if(wantsAudio){stop('الاستماع متوقف. يمكنك استئنافه من الموضع نفسه.',{audible:true});return}
    startAudio();
   }else if(id==='recitationWord'){session.hint();render();currentIntoView();message('أُظهرت كلمة في موضعها للمساعدة. أعد القراءة من الموضع الحالي.')}
   else if(id==='recitationVerse'){session.peek();render();currentIntoView()}
   else if(id==='recitationHide'){hideText=!hideText;render(true);message((hideText?'النص مخفي؛ تبقى مواضع الكلمات محفوظة.':'النص ظاهر كاملًا.')+(wantsAudio?' واصل التسميع.':' قد تعالج خدمة المتصفح صوتك عبر الإنترنت؛ اضغط الميكروفون للبدء.'))}
   else if(id==='recitationNumbers'){showNumbers=!showNumbers;render()}
   else if(id==='recitationWordMenuClose'){$('#recitationWordMenu').hidden=true}
   else if(id==='recitationIgnoreError'&&selectedWord){session.ignoreWord(selectedWord.index,selectedWord.word);const k=`${selectedWord.sura}:${selectedWord.aya}:${selectedWord.word}`;study?.dismiss(mistakeSessions.get(k)||journalId,selectedWord);$('#recitationWordMenu').hidden=true;render(true);message('أُزيلت العلامة بوصفها غير صحيحة؛ هذا تصحيح منك وليس مطابقة آلية.')}
   else if(id==='recitationStartHere'&&selectedWord){$('#recitationWordMenu').hidden=true;goToReference(selectedWord)}
   else if(id==='recitationFindPhrase'&&selectedWord){const words=corpus.units[selectedWord.index].words.slice(selectedWord.word,selectedWord.word+4);$('#recitationWordMenu').hidden=true;setPopover('Search',true);$('#recitationSearchInput').value=words.map(w=>w.forms[0]).join(' ');searchPassage()}
   else if(id==='recitationJournal'||id==='recitationJournalSettings'){stop();setPopover('Menu',false);setSettings(false);onJournalOpen()}
   else if(id==='recitationReload'){stop();const url=new URL(root.location.href);url.searchParams.set('update',String(BUILD));if(url.href===root.location.href)root.location.reload();else root.location.replace(url.href)}
   else if(id==='recitationResync'){if(wantsAudio)abortRecognition();applyScope();session.beginSearch();manualStart=false;locationResolved=false;paintPage();message('اقرأ كلمات متتابعة لتحديد موضعك مجددًا.');if(wantsAudio)scheduleRestart(0)}
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
   else if(id==='recitationReset'){stop();session=createSession();lastIndex=-1;render(true);$('#recitationPageScroll').scrollTop=0;message('أُعيد المقطع إلى البداية. اضغط الميكروفون عندما تكون مستعدًا.')}
  }
  function handleChange(event){
   if(['recitationMode','recitationStrict','recitationReveal','recitationHistory'].includes(event.target.id)){stop();prefs.mode=$('#recitationMode').value;prefs.strict=$('#recitationStrict').checked;prefs.reveal=$('#recitationReveal').value;prefs.history=$('#recitationHistory').checked;if(prefs.mode==='read')hideText=false;if(prefs.mode==='practice')hideText=true;applyScope();savePrefs();render(true)}
   if(event.target.id==='recitationTheme'){setPageTheme(event.target.value)}
   if(event.target.id==='recitationLocale'){stop('تغيّرت لغة خدمة الصوت. اضغط الميكروفون للاستئناف.');prefs.locale=event.target.value;savePrefs()}
   if(event.target.id==='recitationSound'){sound=event.target.checked;if(sound&&wantsAudio)audioReady()}
   if(event.target.id==='recitationShowNumbers'){showNumbers=event.target.checked;render()}
  }
  function handleInput(event){if(event.target.id==='recitationSearchInput')searchPassage()}
  function handleKey(event){
   if(!active)return;
   if(['ArrowRight','ArrowLeft'].includes(event.key)&&event.target.closest('#recitationPageScroll')&&canTurn()){event.preventDefault();turnPassage(event.key==='ArrowRight'?1:-1);return}
   const word=event.target.closest('.recitation-word');
   if(word&&['Enter',' '].includes(event.key)){event.preventDefault();if(marking)markWord(word);else if(word.matches('.is-error,.is-uncertain'))showWordMenu(word)}
   if(event.key==='Escape'&&[$('#recitationSettingsPanel'),$('#recitationMenuPanel'),$('#recitationSearchPanel')].some(el=>!el.hidden)){
    event.preventDefault();event.stopPropagation();setSettings(false);setPopover('Menu',false);setPopover('Search',false);
   }
  }
  function toggleMode(){active?leave():enable()}
  function hidden(){if(active&&wantsAudio&&document.hidden)stop('أُوقف الميكروفون عند مغادرة الصفحة. اضغط بدء الاستماع للاستئناف.')}
  function pagehide(){if(active)stop()}
  toggle.disabled=false;toggle.addEventListener('click',toggleMode);host.addEventListener('click',handleClick);host.addEventListener('change',handleChange);host.addEventListener('input',handleInput);host.addEventListener('keydown',handleKey);host.addEventListener('pointerdown',pointerDown);host.addEventListener('pointerup',pointerUp);host.addEventListener('pointercancel',pointerCancel);
  document.addEventListener('visibilitychange',hidden);root.addEventListener('pagehide',pagehide);
  host.style.setProperty('--quran-size',fontSize+'px');
  return {
   open({conceal=false}={}){enable(conceal)},
   focusReference(reference){goToReference(reference)},
   pause(){stop()},
   startListening(){if(!active)enable(false);startAudio()},
   updateFont(size){fontSize=size;host.style.setProperty('--quran-size',size+'px');if($('#recitationFontSize'))$('#recitationFontSize').textContent=String(size)},
   destroy(){if(destroyed)return;leave();destroyed=true;swipe=null;toggle.removeEventListener('click',toggleMode);host.removeEventListener('click',handleClick);host.removeEventListener('change',handleChange);host.removeEventListener('input',handleInput);host.removeEventListener('keydown',handleKey);host.removeEventListener('pointerdown',pointerDown);host.removeEventListener('pointerup',pointerUp);host.removeEventListener('pointercancel',pointerCancel);document.removeEventListener('visibilitychange',hidden);root.removeEventListener('pagehide',pagehide)}
  };
 }
 root.ATHMAN_RECITATION_UI={mount};
})(window);
