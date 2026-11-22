/* أثمان — لوحة إعدادات التسميع المبوّبة (الإصدار 34).
   تعيد ترتيب عناصر الإعدادات القائمة داخل تبويبات دون تغيير معرّفاتها،
   فتبقى كل معالجات الأحداث في recitation-ui.js كما هي، وتضيف قسم الأصوات والتنبيه. */
(function(root,factory){
 'use strict';
 const api=factory(root);
 if(typeof module==='object'&&module.exports)module.exports=api;else root.ATHMAN_SETTINGS=api;
})(typeof window==='object'?window:globalThis,function(root){
 'use strict';
 const TABS=[
  {id:'recite',label:'التسميع',icon:'mic'},
  {id:'display',label:'المصحف',icon:'book'},
  {id:'listen',label:'الاستماع والتفسير',icon:'headphones'},
  {id:'alerts',label:'التنبيهات',icon:'bell'},
  {id:'service',label:'خدمة الصوت',icon:'wave'},
  {id:'advanced',label:'متقدم',icon:'tool'}
 ];
 const ICONS={
  mic:'<path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Zm-6 9a6 6 0 0 0 12 0M12 18v3"/>',
  bell:'<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15ZM10 20a2 2 0 0 0 4 0"/>',
  eye:'<path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  wave:'<path d="M3 12h2M7 8v8M11 5v14M15 9v6M19 11v2"/>',
  tool:'<path d="M14.5 5.5a4 4 0 0 0-5 5L4 16l4 4 5.5-5.5a4 4 0 0 0 5-5l-2.5 2.5-2.5-.5-.5-2.5Z"/>',
  play:'<path d="M8 5v14l11-7Z"/>',
  headphones:'<path d="M4 14v-2a8 8 0 0 1 16 0v2"/><path d="M4 14h3v6H5a1 1 0 0 1-1-1zM20 14h-3v6h2a1 1 0 0 0 1-1z"/>',
  book:'<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5Zm0 15A2.5 2.5 0 0 1 6.5 18H20v3H6.5A2.5 2.5 0 0 1 4 20.5Z"/>'
 };
 const svg=name=>`<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]}</svg>`;
 const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c]);
 const STORE='athman-settings-tab';

 function soundSection(sounds,prefs){
  const options=(map,value)=>Object.entries(map).map(([k,v])=>`<option value="${k}"${k===value?' selected':''}>${esc(v)}</option>`).join('');
  const check=(id,on,label,hint='')=>`<label class="settings-switch"><input type="checkbox" id="${id}"${on?' checked':''}><span class="settings-switch-track" aria-hidden="true"></span><span class="settings-switch-copy"><b>${label}</b>${hint?`<small>${hint}</small>`:''}</span></label>`;
  const preview=(kind,label)=>`<button type="button" class="settings-preview" data-sound-preview="${kind}" aria-label="تجربة ${label}">${svg('play')}<span>${label}</span></button>`;
  return `<section class="settings-group" aria-labelledby="settingsSoundTitle">
   <h3 id="settingsSoundTitle">الأصوات</h3>
   ${check('recitationSound',prefs.enabled,'تفعيل الأصوات','المفتاح العام لكل أصوات أثمان وتنبيهاته.')}
   <label class="settings-field settings-volume"><span>مستوى الصوت</span><input type="range" id="recitationVolume" min="0" max="100" step="5" value="${Math.round(prefs.volume*100)}" aria-valuetext="${Math.round(prefs.volume*100)}%"><output id="recitationVolumeValue">${Math.round(prefs.volume*100)}%</output></label>
   ${check('recitationMicCues',prefs.micCues,'صوت تشغيل الميكروفون وإيقافه','نغمة صاعدة عند البدء وهابطة عند الإيقاف.')}
   <div class="settings-previews">${preview('start','البدء')}${preview('stop','الإيقاف')}</div>
  </section>
  <section class="settings-group" aria-labelledby="settingsMistakeTitle">
   <h3 id="settingsMistakeTitle">تنبيه الخطأ</h3>
   <label class="settings-field"><span>متى أُنبَّه؟</span><select id="recitationMistakeLevel">${options(sounds.SENSITIVITY,prefs.mistake)}</select></label>
   <label class="settings-field"><span>صوت الخطأ</span><select id="recitationMistakeSound">${options(sounds.MISTAKE_SOUNDS,prefs.mistakeSound)}</select></label>
   <div class="settings-previews">${preview('mistake','سماع صوت الخطأ')}</div>
   ${check('recitationVibrate',prefs.vibrate,'الاهتزاز مع التنبيه','على الهواتف التي تدعمه: عند الخطأ وبدء الميكروفون وإتمام المقطع.')}
   <p class="settings-note">«متوازن» ينبّه عند قراءة كلمة مختلفة أو الانتقال إلى آية متشابهة (المتشابهات)، ولا ينبّه عند كلمة لم تلتقطها خدمة الصوت. «حساس» ينبّه أيضًا عند الالتقاط غير المؤكد بالأصفر.</p>
  </section>
  <section class="settings-group" aria-labelledby="settingsOtherSoundsTitle">
   <h3 id="settingsOtherSoundsTitle">تنبيهات أخرى</h3>
   ${check('recitationCompleteCue',prefs.complete,'صوت إتمام المقطع','عند الوصول إلى آخر المقطع المفتوح.')}
   ${check('recitationConnectionCue',prefs.connection,'صوت انقطاع الاتصال','عند انقطاع الشبكة أو توقف خدمة الصوت.')}
   ${check('recitationTapCue',prefs.taps,'صوت لمس الأزرار','نقرة خفيفة عند الضغط على أزرار القارئ.')}
   <div class="settings-previews">${preview('complete','الإتمام')}${preview('connection','الانقطاع')}${preview('tap','اللمس')}</div>
  </section>`;
 }

 function tajweedSection(t){
  const rows=Object.entries(t.rules).map(([k,r])=>`<li><span class="tj-swatch tj-${k}" aria-hidden="true"></span><b>${esc(r.label)}</b><small>${esc(r.hint)}</small></li>`).join('');
  return `<section class="settings-group" aria-labelledby="settingsTajweedTitle"><h3 id="settingsTajweedTitle">ألوان التجويد</h3><label class="settings-switch"><input type="checkbox" id="recitationTajweed"${t.enabled?' checked':''}><span class="settings-switch-track" aria-hidden="true"></span><span class="settings-switch-copy"><b>تلوين أحكام التجويد (${esc(t.riwaya||'رواية ورش')})</b><small>يُستخرج الحكم من ضبط المصحف، ولا يتغير النص.</small></span></label><details class="tj-legend-wrap"><summary>دليل الألوان</summary><ul class="tj-legend">${rows}</ul></details></section>`;
 }
 function riwayaSection(){
  const R=root.ATHMAN_RIWAYA;if(!R)return '';
  const facts=R.id==='hafs'?'مصحف المدينة · العدّ الكوفي · الحزب أربعة أرباع':'المصحف المغربي · العدّ المدني الأول · الحزب ثمانية أثمان';
  return `<section class="settings-group settings-riwaya" aria-labelledby="settingsRiwayaTitle"><h3 id="settingsRiwayaTitle">الرواية</h3><div class="settings-riwaya-row"><div class="settings-riwaya-name"><b>${esc(R.full)}</b><small>${esc(facts)}</small></div><button type="button" class="settings-riwaya-change" data-riwaya-open>تغيير الرواية</button></div><p class="settings-note">تغيير الرواية يعيد فتح المصحف بنصها وخطها وترقيمها وتقسيمها، ويحفظ تقدّم كل رواية على حدة.</p></section>`;
 }
 const SHORT={recitationQuickMode:['تسميع حر','مراجعة المقطع','قراءة'],recitationMode:['تسميع حر','مراجعة المقطع','قراءة'],recitationStartMode:['من موضعي','تلقائيًا'],recitationReveal:['كلمة بكلمة','بعد الآية'],recitationTheme:['تلقائي','فاتح','داكن'],recitationSilence:['قصير','متوسط','طويل'],recitationSensitivity:['خافت','عادي','ضجيج'],recitationLocale:['المغرب','السعودية'],recitationEngine:['خدمة المتصفح','محرك خارجي'],recitationMistakeLevel:['متوازن','حساس','محافظ','بلا تنبيه']};
 // Short choices become segmented buttons; the original <select> stays the
 // source of truth (hidden), so every existing change handler keeps working.
 function segment(select){
  if(!select||select.dataset.segmented)return;select.dataset.segmented='1';
  const options=[...select.options],labels=SHORT[select.id]||options.map(o=>o.textContent.split(/ — | \(/)[0]);
  const group=document.createElement('div');group.className='settings-segment';group.setAttribute('role','radiogroup');
  const name=select.closest('label')?.querySelector('span,b')?.textContent||select.getAttribute('aria-label')||'';if(name)group.setAttribute('aria-label',name.trim());
  options.forEach((o,i)=>{const b=document.createElement('button');b.type='button';b.setAttribute('role','radio');b.dataset.segmentValue=o.value;b.textContent=labels[i]||o.textContent;b.title=o.textContent;group.append(b)});
  group.addEventListener('click',event=>{const b=event.target.closest('[data-segment-value]');if(!b||select.value===b.dataset.segmentValue&&!select.disabled)return paintSegment(select,group);if(select.disabled)return;select.value=b.dataset.segmentValue;select.dispatchEvent(new Event('change',{bubbles:true}));paintSegment(select,group)});
  group.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight'].includes(event.key))return;event.preventDefault();const bs=[...group.children],i=bs.findIndex(b=>b.dataset.segmentValue===select.value),n=bs.length,next=bs[(i+(event.key==='ArrowLeft'?1:-1)+n)%n];next.click();next.focus()});
  select.addEventListener('change',()=>paintSegment(select,group));
  select.classList.add('settings-select-hidden');select.after(group);paintSegment(select,group);
 }
 function paintSegment(select,group){for(const b of group.children){const on=b.dataset.segmentValue===select.value;b.setAttribute('aria-checked',String(on));b.tabIndex=on?0:-1;b.disabled=select.disabled}}
 function sync(panel){for(const select of panel?.querySelectorAll?.('select[data-segmented]')||[]){const group=select.nextElementSibling;if(group?.classList.contains('settings-segment'))paintSegment(select,group)}}
 function speedSection(on){
  const Rec=root.SpeechRecognition||root.webkitSpeechRecognition,supported=typeof Rec?.available==='function';
  return `<section class="settings-group" aria-labelledby="settingsSpeedTitle"><h3 id="settingsSpeedTitle">سرعة الاستجابة</h3><label class="settings-switch"><input type="checkbox" id="recitationOnDevice"${on?' checked':''}${supported?'':' disabled'}><span class="settings-switch-track" aria-hidden="true"></span><span class="settings-switch-copy"><b>التعرف على الصوت داخل الجهاز</b><small>أسرع في إظهار الكلمات، ويعمل دون إنترنت، إن أتاح متصفحك حزمة العربية.</small></span></label><p class="settings-note" id="recitationOnDeviceStatus" aria-live="polite">${supported?(on?'مفعّل.':'متوقف: تُعالج خدمة المتصفح الصوت عبر الإنترنت.'):'متصفحك لا يتيح هذه الميزة بعد (تحتاج إصدارًا حديثًا من Chrome أو Edge).'}</p></section>`;
 }
 function organize(panel,{sounds=root.ATHMAN_SOUNDS,soundPrefs=sounds?.load(),tajweed=null,ondevice=false}={}){
  if(!panel||panel.dataset.organized)return;panel.dataset.organized='1';
  panel.classList.add('settings-tabbed');
  const heading=panel.querySelector('.recitation-settings-heading');
  const take=el=>el&&el.parentNode?el:null;
  const row=id=>panel.querySelector('#'+id)?.closest('.recitation-settings-row');
  const label=id=>panel.querySelector('#'+id)?.closest('label');
  const legend=panel.querySelector('.recitation-legend');
  const disclosures=[...panel.children].filter(el=>el.matches('p.recitation-disclosure')&&!el.id&&el!==legend);
  const status=panel.querySelector('#recitationSettingsStatus');
  const groups={
   recite:[panel.querySelector('.recitation-scope-bar'),row('recitationMode'),row('recitationReveal'),label('recitationAutoHide'),panel.querySelector('.recitation-settings-actions')],
   alerts:[legend,legend?.nextElementSibling?.matches('p.recitation-disclosure')?legend.nextElementSibling:null],
   display:[label('recitationTheme'),label('recitationShowNumbers'),row('recitationSmaller'),label('recitationKeepAwake'),...disclosures.filter(p=>status&&(p.compareDocumentPosition(status)&Node.DOCUMENT_POSITION_PRECEDING))],
   service:[panel.querySelector('.recitation-audio-options'),...disclosures.filter(p=>p.nextElementSibling?.querySelector?.('#recitationLocale')),row('recitationLocale'),...disclosures.filter(p=>p.previousElementSibling?.querySelector?.('#recitationLocale')),panel.querySelector('#recitationEngineOptions')],
   advanced:[panel.querySelector('.recitation-response'),panel.querySelector('#recitationVersion'),panel.querySelector('#recitationReload'),status]
  };
  // The old master sound checkbox becomes part of the new sound section.
  const oldSound=label('recitationSound');
  const tablist=document.createElement('div');tablist.className='settings-tabs';tablist.setAttribute('role','tablist');tablist.setAttribute('aria-label','أقسام الإعدادات');
  const body=document.createElement('div');body.className='settings-body';
  const panels={};
  for(const tab of TABS){
   const button=document.createElement('button');button.type='button';button.className='settings-tab';button.id='settingsTab-'+tab.id;button.setAttribute('role','tab');button.dataset.settingsTab=tab.id;button.setAttribute('aria-controls','settingsPanel-'+tab.id);
   button.innerHTML=svg(tab.icon)+`<span>${tab.label}</span>`;tablist.append(button);
   const section=document.createElement('div');section.className='settings-panel';section.id='settingsPanel-'+tab.id;section.setAttribute('role','tabpanel');section.setAttribute('aria-labelledby',button.id);section.tabIndex=-1;
   panels[tab.id]=section;body.append(section);
  }
  {const wrap=document.createElement('div');wrap.innerHTML=riwayaSection();panels.display.append(...wrap.children)}
  if(root.ATHMAN_AYAH)panels.listen.append(root.ATHMAN_AYAH.settingsNodes());else{panels.listen.remove();tablist.querySelector('#settingsTab-listen')?.remove()}
  {const wrap=document.createElement('div');wrap.innerHTML=speedSection(ondevice);panels.service.append(...wrap.children)}
  if(tajweed){const wrap=document.createElement('div');wrap.innerHTML=tajweedSection(tajweed);panels.display.append(...wrap.children)}
  if(sounds&&soundPrefs){const wrap=document.createElement('div');wrap.innerHTML=soundSection(sounds,soundPrefs);panels.alerts.append(...wrap.children);oldSound?.remove()}
  const moved=new Set();
  for(const [tab,list] of Object.entries(groups))for(const el of list){if(!take(el)||moved.has(el))continue;moved.add(el);panels[tab].append(el)}
  // Rows whose labels were distributed to several tabs are now empty.
  for(const el of [...panel.children])if(el.matches('.recitation-settings-row')&&!el.querySelector('input,select,button'))el.remove();
  // Anything not mapped stays reachable under «التسميع».
  for(const el of [...panel.children])if(el!==heading)panels.recite.append(el);
  heading.after(tablist,body);
  tablist.addEventListener('click',event=>{const b=event.target.closest('[data-settings-tab]');if(b)show(panel,b.dataset.settingsTab,{focus:false})});
  tablist.addEventListener('keydown',event=>{
   if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();
   const tabs=[...tablist.children],i=tabs.indexOf(document.activeElement),n=tabs.length;
   const next=event.key==='Home'?0:event.key==='End'?n-1:(i+(event.key==='ArrowLeft'?1:-1)+n)%n;
   show(panel,tabs[next].dataset.settingsTab);tabs[next].focus();
  });
  let initial='recite';try{const saved=root.localStorage.getItem(STORE);if(TABS.some(t=>t.id===saved))initial=saved}catch{}
  for(const id of Object.keys(SHORT))segment(panel.querySelector('#'+id));
  show(panel,initial,{focus:false,persist:false});
 }
 function show(panel,id,{focus=false,persist=true}={}){
  if(!panel?.dataset.organized)return;
  for(const tab of panel.querySelectorAll('.settings-tab')){const on=tab.dataset.settingsTab===id;tab.setAttribute('aria-selected',String(on));tab.tabIndex=on?0:-1}
  for(const section of panel.querySelectorAll('.settings-panel'))section.hidden=section.id!=='settingsPanel-'+id;
  panel.querySelector('.settings-body')?.scrollTo?.(0,0);
  if(persist)try{root.localStorage.setItem(STORE,id)}catch{}
  if(focus)panel.querySelector('#settingsTab-'+id)?.focus();
 }
 return {version:37,TABS,organize,show,sync,segment};
});
