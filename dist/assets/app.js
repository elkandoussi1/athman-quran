/* Athman — self-contained Quran index. All Quran passages are loaded locally. */
'use strict';
const D=window.QURAN_DATA;
const DIV=window.ATHMAN_DIVISIONS;
const PARTS={
 half:{list:D.halves,mode:'halves',type:'n',label:'النصف',plural:'الأنصاف',noun:'نصفًا',icon:'half',query:'half',size:4},
 quarter:{list:D.quarters,mode:'quarters',type:'q',label:'الربع',plural:'الأرباع',noun:'ربعًا',icon:'quarter',query:'quarter',size:2},
 eighth:{list:D.eighths,mode:'eighths',type:'e',label:'الثمن',plural:'الأثمان',noun:'ثمنًا',icon:'layers',query:'thumn',size:1}
};
const KIND_BY_TYPE={n:'half',q:'quarter',e:'eighth'};
const TYPE_BY_MODE={hizbs:'h',halves:'n',quarters:'q',eighths:'e',surahs:'s'};
const BOOKMARK_DATA={h:D.hizbs,n:D.halves,q:D.quarters,e:D.eighths,s:D.surahs};
const getPart=(kind,id)=>PARTS[kind]?.list[id-1];
const $=(s,el=document)=>el.querySelector(s);
const $$=(s,el=document)=>[...el.querySelectorAll(s)];
const icon=(name,cls='')=>`<svg class="icon ${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const latin=s=>String(s).replace(/[٠-٩]/g,c=>'٠١٢٣٤٥٦٧٨٩'.indexOf(c)).replace(/[۰-۹]/g,c=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(c));
const displayNumber=latin;
// Keep the Arabic ornaments RTL while the Latin digits retain their LTR order.
const verseNumberText=n=>'\u2067﴿\u2066'+displayNumber(n)+'\u2069﴾\u2069';
const norm=s=>latin(String(s)).normalize('NFKD').replace(/ۦ/g,'ي').replace(/ۥ/g,'و').replace(/\p{M}/gu,'').replace(/[ٱأإآ]/g,'ا').replace(/[ےى]/g,'ي').replace(/[ؤ]/g,'و').replace(/ئ/g,'ي').replace(/يي/g,'ي').replace(/ـ/g,'').replace(/[^\p{L}\p{N}\s]/gu,'').replace(/\s+/g,' ').trim().toLowerCase();
const ordinal=n=>{
 const units=['','الأول','الثاني','الثالث','الرابع','الخامس','السادس','السابع','الثامن','التاسع','العاشر','الحادي عشر','الثاني عشر','الثالث عشر','الرابع عشر','الخامس عشر','السادس عشر','السابع عشر','الثامن عشر','التاسع عشر'];
 const tens={20:'العشرون',30:'الثلاثون',40:'الأربعون',50:'الخمسون',60:'الستون'};
 if(n<20)return units[n];if(n%10===0)return tens[n];return (n%10===1?'الحادي':units[n%10])+' و'+tens[Math.floor(n/10)*10];
};
const sura=n=>D.surahs[n-1]?.name||'';
const ayahCount=n=>displayNumber(n)+' '+(n>=3&&n<=10?'آيات':'آية');
const readStore=(key,fallback)=>{try{const v=JSON.parse(localStorage.getItem('athman-'+key));return v===null?fallback:v}catch{return fallback}};
const savedData=readStore('saved',[]),completedData=readStore('completed',[]);
let saved=new Set((Array.isArray(savedData)?savedData:[]).filter(x=>typeof x==='string'&&/^[hnqes]:\d+$/.test(x)));
let completed=new Set((Array.isArray(completedData)?completedData:[]).filter(x=>Number.isInteger(x)&&x>0&&x<=480));
let last=readStore('last',null),fontSize=Number(readStore('font',30));
if(!Number.isFinite(fontSize)||fontSize<22||fontSize>46)fontSize=30;
if(last&&!last.kind&&Number.isInteger(last.eighth))last={...last,kind:'eighth',id:last.eighth};
if(!last||!Number.isInteger(last.id)||!getPart(last.kind,last.id))last=null;
let mode='hizbs',query='',juz='',range=0,limit=12,view=readStore('view','grid');
let detailKind='eighth';
let detailId=null,readerKind=null,readerId=null,returnHash=null,readerSequence=0,quranPromise=null,toastTimeout;
let recitationController=null,recitationCorpus=null;
const main=$('#main'),reader=$('#readerDialog');
const store=(key,value)=>{try{localStorage.setItem('athman-'+key,JSON.stringify(value))}catch{toast('تعذّر الحفظ في هذا المتصفح. يمكنك متابعة التصفح.')}};
const seal=n=>`<span class="number-seal" aria-hidden="true"><span>${displayNumber(n)}</span></span>`;
const saveButton=(key,label)=>`<button class="save-button ${saved.has(key)?'is-saved':''}" data-save="${key}" aria-label="${saved.has(key)?'إزالة':'حفظ'} ${label}" aria-pressed="${saved.has(key)}">${icon('bookmark')}</button>`;
function toast(message){clearTimeout(toastTimeout);$('#toast').textContent=message;$('#toast').classList.add('visible');toastTimeout=setTimeout(()=>$('#toast').classList.remove('visible'),2600)}
function updateSavedDot(){$('#savedDot').hidden=saved.size===0}
function updateResume(){const b=$('#resumeSide');b.innerHTML=last?`متابعة موضعك الأخير ${icon('arrow')}`:`ابدأ رحلتك ${icon('arrow')}`}
function setTheme(theme){document.documentElement.dataset.theme=theme;$('#themeButton').innerHTML=icon(theme==='dark'?'sun':'moon');$('#themeButton').setAttribute('aria-label',theme==='dark'?'تفعيل الوضع النهاري':'تفعيل الوضع الليلي')}
setTheme(readStore('theme','light'));updateSavedDot();updateResume();

const heroArt=`<div class="hero-art" aria-hidden="true"><svg viewBox="0 0 128 128" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="m64 7 17 17h23v23l17 17-17 17v23H81l-17 17-17-17H24V81L7 64l17-17V24h23Z" stroke="currentColor" stroke-width="1"/><path d="m64 17 14 14h19v19l14 14-14 14v19H78l-14 14-14-14H31V78L17 64l14-14V31h19Z" stroke="currentColor" stroke-width=".7" opacity=".5"/><path d="M64 49c-9-5-19-6-27-2v34c8-4 18-3 27 2 9-5 19-6 27-2V47c-8-4-18-3-27 2Zm0 0v34M43 55c5-1 10 0 15 2m-15 5c5-1 10 0 15 2m12-7c5-2 10-3 15-2m-15 9c5-2 10-3 15-2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></div>`;
function renderHero(){return `<section class="hero" aria-labelledby="heroTitle"><div class="hero-copy"><div class="eyebrow">${icon('spark')} رفيق الحفظ والمراجعة · رواية ورش</div><h1 id="heroTitle">دليلُك إلى كتابِ الله</h1><p class="hero-description">الأحزاب وأنصافها وأرباعها وأثمانها، والسور؛ في فهرس واحد.</p></div>${heroArt}</section>`}
function browseNav(){return `<nav class="browse-sections" aria-label="تقسيمات القرآن"><a class="selected" href="#/">${icon('grid')}<span>الأحزاب</span><b>60</b></a><a href="#/halves">${icon('half')}<span>الأنصاف</span><b>120</b></a><a href="#/quarters">${icon('quarter')}<span>الأرباع</span><b>240</b></a><a href="#/eighths">${icon('layers')}<span>الأثمان</span><b>480</b></a><a href="#/surahs">${icon('book')}<span>السور</span><b>114</b></a></nav>`}
function searchControls(placeholder,withJuz=true){return `<div class="search-panel"><label class="search-box">${icon('search')}<input id="searchInput" type="search" autocomplete="off" placeholder="${placeholder}" aria-label="${placeholder}" value="${esc(query)}"><button type="button" class="search-clear ${query?'visible':''}" id="clearSearch" aria-label="مسح البحث">${icon('close')}</button><kbd class="search-shortcut" aria-hidden="true">/</kbd></label>${withJuz?`<select class="juz-select" id="juzSelect" aria-label="تصفية حسب الجزء"><option value="">جميع الأجزاء</option>${Array.from({length:30},(_,i)=>`<option value="${i+1}" ${+juz===i+1?'selected':''}>الجزء ${displayNumber(i+1)}</option>`).join('')}</select>`:''}</div>`}
function viewToggle(){return `<div class="view-toggle" role="group" aria-label="طريقة العرض"><button data-view="grid" class="${view==='grid'?'selected':''}" aria-label="عرض البطاقات" aria-pressed="${view==='grid'}">${icon('grid')}</button><button data-view="list" class="${view==='list'?'selected':''}" aria-label="عرض القائمة" aria-pressed="${view==='list'}">${icon('list')}</button></div>`}
function rangeFilters(){return `<div class="filters" aria-label="تصفية حسب أرقام الأحزاب"><button class="filter-chip ${range===0?'active':''}" data-range="0" aria-pressed="${range===0}">الكل</button>${Array.from({length:6},(_,i)=>`<button class="filter-chip ${range===i+1?'active':''}" data-range="${i+1}" aria-pressed="${range===i+1}">${displayNumber(i*10+1)} – ${displayNumber((i+1)*10)}</button>`).join('')}<span class="result-count" id="resultCount"></span></div>`}

function renderListing(){
 detailId=null;
 const titles={hizbs:['فهرس الأحزاب','ستون حزبًا، مرتّبة حسب المصحف'],halves:['فهرس الأنصاف','120 نصفًا · لكل حزب نصفان، ولكل نصف أربعة أثمان'],quarters:['فهرس الأرباع','240 ربعًا · لكل حزب أربعة أرباع، ولكل ربع ثمنان'],eighths:['فهرس الأثمان','بدايات الأثمان الـ480، في مكان واحد'],surahs:['سور القرآن الكريم','من الفاتحة إلى الناس، 114 سورة'],saved:['مواضعي المحفوظة','أحزابك وأنصافك وأرباعك وأثمانك وسورك المحفوظة']};
 const [title,subtitle]=titles[mode],isDivision=['hizbs','halves','quarters','eighths'].includes(mode);
 const placeholders={hizbs:'ابحث ببداية الحزب، أو رقمه، أو اسم السورة...',halves:'ابحث ببداية النصف، أو رقم الحزب، أو السورة...',quarters:'ابحث ببداية الربع، أو رقم الحزب، أو السورة...',eighths:'ابحث ببداية الثمن، أو رقم الحزب، أو السورة...',surahs:'ابحث باسم السورة أو رقمها...',saved:'ابحث في مواضعك المحفوظة...'};
 main.innerHTML=(mode==='hizbs'?renderHero()+browseNav():`<div class="secondary-page-top"><div class="page-icon">${icon({halves:'half',quarters:'quarter',eighths:'layers',surahs:'book',saved:'bookmark'}[mode])}</div><div><h1>${title}</h1><p>${subtitle}</p></div></div>`)+(mode==='hizbs'?`<div class="section-heading"><div><div class="section-title"><span class="section-ornament" aria-hidden="true">۞</span><h2>${title}</h2></div><div class="section-caption">${subtitle}</div></div><div class="section-tools">${viewToggle()}</div></div>`:`<div class="section-heading"><span class="section-caption">${mode==='saved'?'إشاراتك محفوظة في هذا المتصفح':'اختر موضعًا لبدء القراءة'}</span>${viewToggle()}</div>`)+searchControls(placeholders[mode],isDivision)+(isDivision?rangeFilters():'')+`<div id="cardsGrid" class="cards-grid ${view==='list'?'list-view':''}" aria-live="polite" aria-label="${title}"></div><div id="loadMoreRow" class="load-more-row"></div><p class="listing-note">${icon('info')} ${mode==='saved'?'مواضعك وإشاراتك تُحفظ تلقائيًا على جهازك.':'وفق التقسيم المغربي للأثمان · أرقام الآيات برواية ورش عن نافع'}</p>`;
 renderResults();bindListingControls();
}
function hizbCard(h){const key=`h:${h.id}`;return `<article class="hizb-card"><a class="card-main" href="#/hizb/${h.id}" aria-label="الحزب ${ordinal(h.id)}، ${esc(norm(h.title))}">${seal(h.id)}<div class="card-content"><div class="card-eyebrow">الحزب ${ordinal(h.id)} <span>الجزء ${displayNumber(h.juz)}</span></div><h3 class="hizb-title">${esc(h.title)}</h3><div class="card-meta">${h.id===1?'الفاتحة والبقرة':sura(h.sura)}${h.sura!==h.endSura&&h.id!==1?' — '+sura(h.endSura):''} <span aria-hidden="true">·</span> ${h.id===1?'يشمل سورة الفاتحة':'الآية '+displayNumber(h.aya)}</div></div></a><div class="card-footer"><span class="eighth-hint">${icon('layers')} 8 أثمان</span><div class="card-footer-right"><a href="#/hizb/${h.id}" class="card-open">تصفّح الحزب ${icon('arrow')}</a>${saveButton(key,'الحزب '+ordinal(h.id))}</div></div></article>`}
function surahCard(s){return `<article class="hizb-card surah-card"><button class="card-main" data-read-surah="${s.id}" aria-label="قراءة سورة ${s.name}" style="width:100%;text-align:right">${seal(s.id)}<div class="card-content"><div class="card-eyebrow">${s.revelation} <span>${ayahCount(s.ayahs)}</span></div><h3 class="hizb-title">سورة ${s.name}</h3><div class="card-meta">تبدأ في الحزب ${displayNumber(Math.ceil(s.firstEighth/8))}</div></div></button><div class="card-footer"><span class="eighth-hint">${icon('book')} رواية ورش</span><div class="card-footer-right"><button class="card-open" data-read-surah="${s.id}">قراءة السورة ${icon('arrow')}</button>${saveButton('s:'+s.id,'سورة '+s.name)}</div></div></article>`}

function partIndexCard(kind,e){
 const cfg=PARTS[kind],label=cfg.label;
 return `<article class="hizb-card"><button class="card-main" data-open-kind="${kind}" data-part-id="${e.id}" style="width:100%;text-align:right" aria-label="قراءة ${label} ${ordinal(e.pos)} من الحزب ${displayNumber(e.hizb)}">${seal(e.hizb)}<div class="card-content"><div class="card-eyebrow">الحزب ${displayNumber(e.hizb)} · ${label} ${ordinal(e.pos)} <span>الجزء ${displayNumber(e.juz)}</span></div><h3 class="hizb-title">${esc(e.title)}</h3><div class="card-meta">${(e.firstEighth||e.id)===1?'الفاتحة ثم البقرة':'سورة '+sura(e.sura)+' · الآية '+displayNumber(e.aya)}${e.partial?' · من داخل الآية':''}</div></div></button><div class="card-footer"><a href="#/hizb/${e.hizb}?view=${kind}" class="eighth-hint">${icon(cfg.icon)} ${kind==='half'?'4 أثمان':kind==='quarter'?'ثمنان':'عرض الحزب'}</a><div class="card-footer-right"><button class="card-open" data-open-kind="${kind}" data-part-id="${e.id}">قراءة ${label} ${icon('arrow')}</button>${saveButton(cfg.type+':'+e.id,label+' '+ordinal(e.pos))}</div></div></article>`;
}

function matchesQuery(item,type){
 if(!query.trim())return true;const q=norm(query),bare=q.replace(/^(الحزب|حزب|السورة|سورة|الثمن|ثمن|النصف|نصف|الربع|ربع)\s*/,'');
 const id=type==='s'||type==='h'?item.id:item.hizb;
 if(/^\d+$/.test(bare))return id===Number(bare);
 const cfg=PARTS[KIND_BY_TYPE[type]],names=type==='s'?'':D.surahs.slice(item.sura-1,item.endSura||item.sura).map(s=>s.name).join(' ');
 const words=type==='s'?`${item.name} سورة ${item.name} ${item.revelation}`:`${item.title} ${names} الحزب ${ordinal(id)} ${id} ${cfg?cfg.label+' '+ordinal(item.pos):''}`;
 const text=norm(words);return q.split(' ').filter(Boolean).every(t=>text.includes(t));
}
function filteredItems(){
 const listType=TYPE_BY_MODE[mode];
 const items=listType?BOOKMARK_DATA[listType].map(item=>({type:listType,item})):[...saved].map(k=>{const [type,id]=k.split(':');return {type,item:BOOKMARK_DATA[type]?.[+id-1]}}).filter(x=>x.item);
 return items.filter(({type,item})=>matchesQuery(item,type)&&(!juz||+item.juz===+juz)&&(!range||((type==='h'?item.id:item.hizb)>=(range-1)*10+1&&(type==='h'?item.id:item.hizb)<=range*10)));
}
function renderResults(){
 const results=filteredItems(),shown=results.slice(0,limit);const grid=$('#cardsGrid');
 if($('#resultCount')){
  const n=results.length,units={hizbs:['حزبان','أحزاب','حزبًا'],halves:['نصفان','أنصاف','نصفًا'],quarters:['ربعان','أرباع','ربعًا'],eighths:['ثمنان','أثمان','ثمنًا']}[mode]||['موضعان','مواضع','موضعًا'];
  $('#resultCount').textContent=n===0?'لا نتائج':n===1?'نتيجة واحدة':n===2?units[0]:`${displayNumber(n)} ${n<=10?units[1]:units[2]}`;
 }
 if(!results.length){const noSaved=mode==='saved'&&saved.size===0;grid.innerHTML=`<div class="empty-state">${icon(noSaved?'bookmark':'search')}<h3>${noSaved?'مواضع تستحقّ العودة.':'لم نعثر على نتائج'}</h3><p>${noSaved?'احفظ أي حزب أو نصف أو ربع أو ثمن أو سورة لتجدها هنا.':'جرّب بداية أخرى أو امسح عوامل التصفية.'}</p><button class="primary-button" ${noSaved?'data-go-home':'data-reset-filters'}>${noSaved?'تصفّح الأحزاب':'عرض الكل'} ${icon('arrow')}</button></div>`}else grid.innerHTML=shown.map(({type,item})=>type==='h'?hizbCard(item):KIND_BY_TYPE[type]?partIndexCard(KIND_BY_TYPE[type],item):surahCard(item)).join('');
 $('#loadMoreRow').innerHTML=results.length>limit?`<button class="load-more" id="loadMore">عرض المزيد <span>(${displayNumber(results.length-limit)})</span> ${icon('down')}</button>`:'';
 $('#clearSearch').classList.toggle('visible',!!query);bindCardActions(grid);
 $('#loadMore')?.addEventListener('click',()=>{limit+=mode==='eighths'?24:12;renderResults()});
 $('[data-reset-filters]')?.addEventListener('click',()=>{query='';juz='';range=0;limit=12;renderListing();$('#searchInput').focus()});
 $('[data-go-home]')?.addEventListener('click',()=>location.hash='#/');
}
function bindListingControls(){
 $('#searchInput').addEventListener('input',e=>{query=e.target.value;limit=mode==='eighths'?24:12;renderResults()});
 $('#clearSearch').addEventListener('click',()=>{query='';$('#searchInput').value='';renderResults();$('#searchInput').focus()});
 $('#juzSelect')?.addEventListener('change',e=>{juz=e.target.value;limit=12;renderResults()});
 $$('[data-range]').forEach(b=>b.addEventListener('click',()=>{range=+b.dataset.range;limit=12;$$('[data-range]').forEach(x=>{x.classList.toggle('active',+x.dataset.range===range);x.setAttribute('aria-pressed',String(+x.dataset.range===range))});renderResults()}));
 $$('[data-view]').forEach(b=>b.addEventListener('click',()=>{view=b.dataset.view;store('view',view);$('#cardsGrid').classList.toggle('list-view',view==='list');$$('[data-view]').forEach(x=>{x.classList.toggle('selected',x.dataset.view===view);x.setAttribute('aria-pressed',String(x.dataset.view===view))})}));
}
function bindCardActions(el=document){
 $$('[data-save]',el).forEach(b=>b.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();toggleSaved(b.dataset.save)}));
 $$('[data-open-kind]',el).forEach(b=>b.addEventListener('click',()=>openPart(b.dataset.openKind,+b.dataset.partId)));
 $$('[data-read-surah]',el).forEach(b=>b.addEventListener('click',()=>openSurah(+b.dataset.readSurah)));
}
function toggleSaved(key){
 if(saved.has(key)){saved.delete(key);toast('أُزيل الموضع من المحفوظات')}else{saved.add(key);toast('حُفظ الموضع للعودة إليه')}
 store('saved',[...saved]);updateSavedDot();
 $$('[data-save]').filter(b=>b.dataset.save===key).forEach(b=>{b.classList.toggle('is-saved',saved.has(key));b.setAttribute('aria-pressed',String(saved.has(key)));b.setAttribute('aria-label',(saved.has(key)?'إزالة الموضع من المحفوظات':'حفظ الموضع'))});
 if(mode==='saved'&&!detailId&&$('#cardsGrid'))renderResults();
}
const fraction=p=>({1:'بداية الحزب',2:'ثمن الحزب',3:'ربع الحزب',4:'ثلاثة أثمان',5:'نصف الحزب',6:'خمسة أثمان',7:'ثلاثة أرباع',8:'الثمن الأخير'}[p]);

function doneButton(e,kind='eighth'){
 const done=DIV.isReviewed(e,completed);
 return `<button class="done-button ${done?'is-done':''}" data-review="${kind}:${e.id}" aria-pressed="${done}"><span class="done-box">${icon('check')}</span> تمت المراجعة</button>`;
}
function partDetailCard(kind,e){
 const cfg=PARTS[kind],label=cfg.label,first=e.firstEighth||e.id,lastEighth=e.lastEighth||e.id;
 const withinFirst=(first-1)%8+1,withinLast=(lastEighth-1)%8+1;
 const hint=kind==='half'?`الأثمان ${displayNumber(withinFirst)} — ${displayNumber(withinLast)}`:kind==='quarter'?`الثمنان ${displayNumber(withinFirst)} و${displayNumber(withinLast)}`:fraction(e.pos);
 return `<article class="eighth-card" id="${kind}-${e.id}"><button class="eighth-main" data-open-kind="${kind}" data-part-id="${e.id}" aria-label="قراءة ${label} ${ordinal(e.pos)}، ${esc(norm(e.title))}"><span class="eighth-order">${displayNumber(e.pos)}</span><div class="eighth-body"><div class="eighth-label">${label} ${ordinal(e.pos)} <span class="fraction-tag">${hint}</span></div><h3 class="eighth-title">${esc(e.title)}</h3><div class="eighth-meta">${first===1?'الفاتحة ثم البقرة · بداية المصحف':'سورة '+sura(e.sura)+' · الآية '+displayNumber(e.aya)}</div>${e.partial?'<div class="partial-label">تبدأ من داخل الآية</div>':''}</div></button><div class="eighth-bottom"><button class="read-action" data-open-kind="${kind}" data-part-id="${e.id}">${icon('book')} قراءة ${label} ${icon('arrow')}</button><div class="eighth-bottom-right">${doneButton(e,kind)}${saveButton(cfg.type+':'+e.id,label+' '+ordinal(e.pos))}</div></div></article>`;
}
function renderDetail(id,kind='eighth'){
 const h=D.hizbs[id-1];if(!h){location.hash='#/';return}detailId=id;detailKind=PARTS[kind]?kind:'eighth';mode='hizbs';
 main.innerHTML=`<div class="breadcrumb"><a href="#/">فهرس الأحزاب</a>${icon('chevron')}<span>الحزب ${ordinal(id)}</span></div><section class="detail-hero"><div class="detail-number" aria-hidden="true">${displayNumber(id)}</div><div><div class="detail-kicker">الحزب ${ordinal(id)} · الجزء ${displayNumber(h.juz)}</div><h1 class="detail-title">${esc(h.title)}</h1><div class="detail-meta"><span>${id===1?'الفاتحة والبقرة':'سورة '+sura(h.sura)+(h.endSura!==h.sura?' — '+sura(h.endSura):'')}</span><span>نصفان · 4 أرباع · 8 أثمان</span></div></div><div class="detail-actions">${saveButton('h:'+id,'الحزب '+ordinal(id))}</div></section><div class="detail-pager"><button class="pager-button prev" id="prevHizb" ${id===1?'disabled':''}>${icon('arrow')} الحزب السابق</button><span>${displayNumber(id)} من 60</span><button class="pager-button" id="nextHizb" ${id===60?'disabled':''}>الحزب التالي ${icon('arrow')}</button></div><div class="division-toolbar"><div class="division-switch" role="group" aria-label="طريقة تقسيم الحزب"><button data-detail-kind="half" aria-pressed="false">${icon('half')} الأنصاف <small>2</small></button><button data-detail-kind="quarter" aria-pressed="false">${icon('quarter')} الأرباع <small>4</small></button><button data-detail-kind="eighth" aria-pressed="false">${icon('layers')} الأثمان <small>8</small></button></div><p>كل نصفٍ ربعان، وكل ربعٍ ثمنان.</p></div><div class="eighths-heading"><h2 id="partsHeading"></h2><span id="partsHint"></span></div><div id="detailParts" class="eighths-list" aria-live="polite" aria-labelledby="partsHeading"></div><div class="progress-card" id="progressCard"></div><p class="listing-note">${icon('info')} أرقام الآيات حسب العدّ المدني لرواية ورش. ${id===1?'يشمل أول تقسيم سورة الفاتحة.':''}</p>`;
 $('#prevHizb').addEventListener('click',()=>location.hash='#/hizb/'+(id-1)+'?view='+detailKind);$('#nextHizb').addEventListener('click',()=>location.hash='#/hizb/'+(id+1)+'?view='+detailKind);
 bindCardActions($('.detail-hero'));
 $$('[data-detail-kind]').forEach(b=>b.addEventListener('click',()=>{detailKind=b.dataset.detailKind;history.replaceState(null,'',`#/hizb/${id}?view=${detailKind}`);renderDetailParts()}));
 renderDetailParts();renderProgress();
}
function renderDetailParts(){
 const cfg=PARTS[detailKind],parts=cfg.list.filter(e=>e.hizb===detailId);
 $('#partsHeading').textContent={half:'نصفا الحزب',quarter:'أرباع الحزب الأربعة',eighth:'أثمان الحزب الثمانية'}[detailKind];
 $('#partsHint').textContent=`اختر ${cfg.label} لقراءة آياته`;
 $$('[data-detail-kind]').forEach(b=>{const selected=b.dataset.detailKind===detailKind;b.classList.toggle('selected',selected);b.setAttribute('aria-pressed',String(selected))});
 $('#detailParts').innerHTML=parts.map(e=>partDetailCard(detailKind,e)).join('');
 bindCardActions($('#detailParts'));bindDone($('#detailParts'));
}
function renderProgress(){if(!detailId||!$('#progressCard'))return;const count=D.eighths.slice((detailId-1)*8,detailId*8).filter(e=>completed.has(e.id)).length;$('#progressCard').innerHTML=`<span>مراجعة الحزب</span><div class="progress-track" role="progressbar" aria-label="تقدّم مراجعة الحزب" aria-valuenow="${count}" aria-valuemin="0" aria-valuemax="8"><span style="width:${count*12.5}%"></span></div><span>${displayNumber(count)} / 8 أثمان</span>`}
function toggleReviewed(kind,id){
 const part=getPart(kind,id);if(!part)return;
 const reviewed=!DIV.isReviewed(part,completed);DIV.setReviewed(part,completed,reviewed);store('completed',[...completed]);
 $$('[data-review]').forEach(b=>{const [k,i]=b.dataset.review.split(':'),p=getPart(k,+i);if(!p)return;const done=DIV.isReviewed(p,completed);b.classList.toggle('is-done',done);b.setAttribute('aria-pressed',String(done))});
 renderProgress();toast(reviewed?'سُجّلت مراجعة هذا '+PARTS[kind].label:'أُلغي تسجيل المراجعة');
}
function bindDone(el){$$('[data-review]',el).forEach(b=>b.addEventListener('click',()=>{const [kind,id]=b.dataset.review.split(':');toggleReviewed(kind,+id)}))}
function loadQuran(){if(!quranPromise)quranPromise=fetch('assets/quran.json').then(r=>{if(!r.ok)throw Error('data');return r.json()}).catch(e=>{quranPromise=null;throw e});return quranPromise}

function readerBaseHash(){
 const [path,search='']=(location.hash||'#/').split('?'),params=new URLSearchParams(search);
 for(const key of ['thumn','half','quarter','surah'])params.delete(key);
 return path+(params.size?'?'+params.toString():'');
}
function prepareReader(kind,id){
 recitationController?.destroy();recitationController=null;
 if(!reader.open){returnHash=readerBaseHash();reader.showModal();document.body.style.overflow='hidden'}
 readerKind=kind;readerId=id;const cfg=PARTS[kind],e=cfg?getPart(kind,id):null,s=kind==='surah'?D.surahs[id-1]:null;
 const title=e?e.title:'سورة '+s.name,kicker=e?`الحزب ${ordinal(e.hizb)} · ${cfg.label} ${ordinal(e.pos)}`:`${s.revelation} · ${ayahCount(s.ayahs)} · رواية ورش`;
 const key=e?cfg.type+':'+id:'s:'+id;
 $('#readerContent').innerHTML=`<div class="reader-toolbar"><button class="icon-button" data-close-reader aria-label="إغلاق القراءة">${icon('close')}</button><div class="reader-heading"><span>${kicker}</span><h2 id="readerTitle">${esc(title)}</h2></div><div class="reader-tools"><button class="recitation-toggle" id="recitationToggle" type="button" aria-label="تسميع وإخفاء الآيات" aria-pressed="false" disabled>${icon('mic')}تسميع</button><button class="font-button" id="fontSmaller" aria-label="تصغير الخط">أ−</button><button class="font-button" id="fontLarger" aria-label="تكبير الخط">أ+</button><button class="icon-button" id="copyPassage" aria-label="نسخ النص">${icon('copy')}</button>${saveButton(key,'الموضع')}</div></div><div class="reader-reference">${e?`${'سورة '+sura(e.sura)+'، الآية '+displayNumber(e.aya)} — ${sura(e.endSura)}، الآية ${displayNumber(e.endAya)}`:`سورة ${s.name} كاملة`} · ترقيم ورش</div><div id="recitationMount"></div><div class="reader-text" id="readerText" style="--quran-size:${fontSize}px"><div class="reader-loading">جارٍ فتح الآيات…</div></div><p class="reader-source">النص والخط: مجمع الملك فهد لطباعة المصحف الشريف · رواية ورش عن نافع</p><div class="reader-bottom"><button class="pager-button prev" id="readerPrev" ${id===1?'disabled':''}>${icon('arrow')} ${e?cfg.label+' السابق':'السورة السابقة'}</button>${e?doneButton(e,kind):`<a class="primary-button" href="#/hizb/${Math.ceil(s.firstEighth/8)}" data-close-reader>موضع بداية السورة ${icon('layers')}</a>`}<button class="pager-button" id="readerNext" ${id===(e?cfg.list.length:114)?'disabled':''}>${e?cfg.label+' التالي':'السورة التالية'} ${icon('arrow')}</button></div>`;
 $('#readerPrev').addEventListener('click',()=>e?openPart(kind,id-1):openSurah(id-1));$('#readerNext').addEventListener('click',()=>e?openPart(kind,id+1):openSurah(id+1));
 $$('[data-close-reader]',reader).forEach(b=>b.addEventListener('click',()=>closeReader(b.tagName==='A')));
 $('#fontSmaller').addEventListener('click',()=>adjustFont(-2));$('#fontLarger').addEventListener('click',()=>adjustFont(2));
 $('#copyPassage').addEventListener('click',copyPassage);bindCardActions(reader);bindDone(reader);reader.scrollTop=0;
 const hash=e?`#/hizb/${e.hizb}?view=${kind}&${cfg.query}=${id}`:`#/surahs?surah=${id}`;history.replaceState(null,'',hash);
 return ++readerSequence;
}
function mountRecitation(q){
 if(!recitationCorpus)recitationCorpus=new window.ATHMAN_RECITATION.Corpus(q.map(([sura,aya,text])=>({sura,aya,text,label:`سورة ${suraName(sura)}، الآية ${aya}`})));
 recitationController=window.ATHMAN_RECITATION_UI.mount({reader,source:$('#readerText'),host:$('#recitationMount'),toggle:$('#recitationToggle'),fontSize,corpus:recitationCorpus,resolveLocation:ref=>followReaderLocation(ref,q),contextFor:u=>D.eighths.findLast(e=>e.sura<u.sura||e.sura===u.sura&&e.aya<=u.aya)||{}});
 recitationController.open();
}
const suraName=n=>D.surahs[n-1]?.name||'';
function containsReadingWord(part,index,word,q){
 if(index<part.startIndex||index>part.endIndex)return false;
 const count=recitationCorpus.units[index].words.length;
 const start=index===part.startIndex&&part.startOffset?window.ATHMAN_RECITATION.sourceWords(q[index][2].slice(0,part.startOffset)).length:0;
 const end=index===part.endIndex&&part.endOffset!==null?Math.min(count,window.ATHMAN_RECITATION.sourceWords(q[index][2].slice(0,part.endOffset)).length):count;
 return word>=start&&word<end;
}
function followReaderLocation(ref,q){
 if(!reader.open)return false;
 const kind=readerKind==='surah'?'surah':PARTS[readerKind]?readerKind:'eighth';
 const part=kind==='surah'?null:PARTS[kind].list.find(e=>containsReadingWord(e,ref.index,ref.word,q));
 if(kind!=='surah'&&!part)return false;
 const id=part?part.id:ref.sura,cfg=PARTS[kind],s=kind==='surah'?D.surahs[id-1]:null;
 readerKind=kind;readerId=id;
 $('#readerText').innerHTML=part?passageHTML(q.slice(part.startIndex,part.endIndex+1),part):passageHTML(q.filter(v=>v[0]===id));
 $('#readerTitle').textContent=part?part.title:'سورة '+s.name;
 $('.reader-heading>span',reader).textContent=part?`الحزب ${ordinal(part.hizb)} · ${cfg.label} ${ordinal(part.pos)}`:`${s.revelation} · ${ayahCount(s.ayahs)} · رواية ورش`;
 $('.reader-reference',reader).textContent=part?`سورة ${sura(part.sura)}، الآية ${part.aya} — ${sura(part.endSura)}، الآية ${part.endAya} · ترقيم ورش`:`سورة ${s.name} كاملة · ترقيم ورش`;
 const saveHost=document.createElement('div');saveHost.innerHTML=saveButton(part?cfg.type+':'+id:'s:'+id,'الموضع');
 $('.reader-tools .save-button',reader).replaceWith(saveHost.firstElementChild);bindCardActions($('.reader-tools',reader));
 const bottom=$('.reader-bottom',reader);
 bottom.innerHTML=`<button class="pager-button prev" id="readerPrev" ${id===1?'disabled':''}>${icon('arrow')} ${part?cfg.label+' السابق':'السورة السابقة'}</button>${part?doneButton(part,kind):`<a class="primary-button" href="#/hizb/${Math.ceil(s.firstEighth/8)}" data-follow-close>موضع بداية السورة ${icon('layers')}</a>`}<button class="pager-button" id="readerNext" ${id===(part?cfg.list.length:114)?'disabled':''}>${part?cfg.label+' التالي':'السورة التالية'} ${icon('arrow')}</button>`;
 $('#readerPrev').addEventListener('click',()=>part?openPart(kind,id-1):openSurah(id-1));$('#readerNext').addEventListener('click',()=>part?openPart(kind,id+1):openSurah(id+1));
 $('[data-follow-close]',bottom)?.addEventListener('click',()=>closeReader(true));bindDone(bottom);
 if(part){last={kind,id,eighth:part.firstEighth||part.id,time:Date.now()};store('last',last);updateResume()}
 history.replaceState(null,'',part?`#/hizb/${part.hizb}?view=${kind}&${cfg.query}=${id}`:`#/surahs?surah=${id}`);
 return true;
}
function basmala(){return '<div class="basmala">بِسْمِ اِ۬للَّهِ اِ۬لرَّحْمَٰنِ اِ۬لرَّحِيمِ</div>'}
function passageHTML(verses,e=null){
 let html='';const partLabel=e?PARTS[e.kind||'eighth'].label:'الثمن';
 for(const [idx,v] of verses.entries()){
  const [sn,an,raw]=v;let text=raw;
  if(e&&idx===0&&e.startOffset)text=text.slice(e.startOffset);
  if(e&&idx===verses.length-1&&e.endOffset!==null)text=text.slice(0,e.endOffset).replace(/\s*۞\s*$/,'');
  if(an===1){html+=`<div class="surah-banderole">سورة ${sura(sn)}</div>`;if(sn!==9)html+=basmala()}
  if(e&&idx===0&&e.partial)html+='<span class="reader-note">يبدأ هذا '+partLabel+' من داخل الآية '+displayNumber(e.aya)+'، عند الكلمات الآتية:</span>';
  // The source font encodes verse numbers as glyphs. Render only the number
  // in the UI font, after applying the original partial-verse boundaries.
  const marker=String.fromCharCode(0xfbff+an),hasNumber=text.endsWith(marker);
  if(hasNumber)text=text.slice(0,-1).trimEnd();
  const startWord=e&&idx===0&&e.startOffset?window.ATHMAN_RECITATION.sourceWords(raw.slice(0,e.startOffset)).length:0;
  html+=`<span class="verse" data-sura="${sn}" data-aya="${an}" data-start-word="${startWord}" aria-label="سورة ${sura(sn)}، الآية ${displayNumber(an)}">${esc(text)}${hasNumber?` <span class="verse-number" dir="rtl" aria-hidden="true">﴿<bdi dir="ltr">${displayNumber(an)}</bdi>﴾</span>`:''}</span> `;
 }
 if(e&&e.endOffset!==null)html+='<span class="reader-note">ينتهي هذا '+partLabel+' داخل الآية؛ وتبدأ بقيّتها في '+partLabel+' التالي.</span>';
 return html;
}

async function openPart(kind,id,{listen=false}={}){
 if(!Number.isInteger(id)||id<1)return;const e=getPart(kind,id);if(!e)return;
 last={kind,id,eighth:e.firstEighth||e.id,time:Date.now()};store('last',last);updateResume();
 const seq=prepareReader(kind,id);
 try{const q=await loadQuran();if(seq!==readerSequence||!reader.open)return;$('#readerText').innerHTML=passageHTML(q.slice(e.startIndex,e.endIndex+1),e);mountRecitation(q);if(listen)recitationController.startListening()}catch{if(seq===readerSequence&&reader.open)readerError(()=>openPart(kind,id,{listen}))}
}
async function openSurah(id){
 if(!Number.isInteger(id)||id<1||id>114)return;const seq=prepareReader('surah',id);
 try{const q=await loadQuran();if(seq!==readerSequence||!reader.open)return;$('#readerText').innerHTML=passageHTML(q.filter(v=>v[0]===id));mountRecitation(q)}catch{if(seq===readerSequence&&reader.open)readerError(()=>openSurah(id))}
}
function readerError(retry){$('#readerText').innerHTML='<div class="reader-error">تعذّر تحميل الآيات. تحقق من الاتصال.<br><button class="primary-button" id="retryReader">إعادة المحاولة</button></div>';$('#retryReader').addEventListener('click',retry)}
function adjustFont(amount){fontSize=Math.max(22,Math.min(46,fontSize+amount));$('#readerText').style.setProperty('--quran-size',fontSize+'px');recitationController?.updateFont(fontSize);store('font',fontSize)}
async function copyPassage(){try{const content=$('#readerText');if($('.reader-loading',content)||$('.reader-error',content)){toast('انتظر حتى تظهر الآيات');return}const text=[...content.querySelectorAll('.verse')].map(v=>{const copy=v.cloneNode(true);$('.verse-number',copy)?.remove();return copy.textContent.trim()+' '+verseNumberText(v.dataset.aya)}).join('\n');await navigator.clipboard.writeText(text);toast('نُسخ نص القراءة')}catch{toast('تعذّر النسخ. يمكنك تحديد النص ونسخه.') }}
function closeReader(navigating=false){if(!reader.open)return;recitationController?.destroy();recitationController=null;reader.close();if(!navigating&&returnHash)history.replaceState(null,'',returnHash);returnHash=null;document.body.style.overflow='';readerSequence++}
reader.addEventListener('cancel',event=>{event.preventDefault();closeReader()});
reader.addEventListener('click',event=>{if(event.target===reader){const r=reader.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)closeReader()}});
function setActiveNav(key){$$('[data-nav]').forEach(x=>{x.classList.toggle('active',x.dataset.nav===key);x.toggleAttribute('aria-current',x.dataset.nav===key);if(x.dataset.nav===key)x.setAttribute('aria-current','page')})}
const mobileMedia=matchMedia('(max-width:760px)');
function syncSidebar(){$('#sidebar').inert=mobileMedia.matches&&!$('#sidebar').classList.contains('open')}
mobileMedia.addEventListener('change',syncSidebar);
function closeMenu(){$('#sidebar').classList.remove('open');$('#mobileShade').classList.remove('show');$('#menuButton').setAttribute('aria-expanded','false');syncSidebar()}
function route(){
 if(reader.open)closeReader(true);closeMenu();
 const hash=location.hash||'#/',[path,search='']=hash.split('?'),params=new URLSearchParams(search),match=path.match(/^#\/hizb\/(\d+)$/);
 const previousMode=mode;
 if(match){
  const id=+match[1];if(id<1||id>60){location.hash='#/';return}
  const readKind=Object.keys(PARTS).find(kind=>params.has(PARTS[kind].query));
  renderDetail(id,readKind||params.get('view')||'eighth');setActiveNav('hizbs');document.title=`الحزب ${ordinal(id)} — ${norm(D.hizbs[id-1].title)} | أثمان`;
  if(readKind){const partId=+params.get(PARTS[readKind].query),part=getPart(readKind,partId);if(part?.hizb===id)openPart(readKind,partId)}
 }
 else{
  mode=({'#/':'hizbs','#/halves':'halves','#/quarters':'quarters','#/eighths':'eighths','#/surahs':'surahs','#/saved':'saved'})[path]||'hizbs';
  if(mode!==previousMode){query='';juz='';range=0;limit=mode==='eighths'?24:12}
  renderListing();setActiveNav(mode);document.title='أثمان — دليل أحزاب القرآن الكريم';
  if(mode==='surahs'&&params.has('surah')){const sid=+params.get('surah');if(sid>=1&&sid<=114){returnHash=path;openSurah(sid)}}
 }
 window.scrollTo({top:0,behavior:'instant'});
}
window.addEventListener('hashchange',route);
$('#listenAnywhere').addEventListener('click',()=>openPart(last?.kind||'eighth',last?.id||1,{listen:true}));
$('#themeButton').addEventListener('click',()=>{const theme=document.documentElement.dataset.theme==='dark'?'light':'dark';setTheme(theme);store('theme',theme)});
$('#menuButton').setAttribute('aria-expanded','false');$('#menuButton').setAttribute('aria-controls','sidebar');
$('#menuButton').addEventListener('click',()=>{const open=!$('#sidebar').classList.contains('open');$('#sidebar').classList.toggle('open',open);$('#mobileShade').classList.toggle('show',open);$('#menuButton').setAttribute('aria-expanded',String(open));syncSidebar()});$('#mobileShade').addEventListener('click',closeMenu);
$('#resumeSide').addEventListener('click',()=>{closeMenu();if(last)openPart(last.kind,last.id);else location.hash='#/hizb/1'});
const about=$('#aboutDialog');
['#aboutButton','#aboutSide','#footerAbout'].forEach(s=>$(s).addEventListener('click',()=>{closeMenu();about.showModal()}));
$('#aboutClose').addEventListener('click',()=>about.close());$('#aboutDone').addEventListener('click',()=>{about.close();location.hash='#/'});
about.addEventListener('click',event=>{if(event.target===about){const r=about.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)about.close()}});
document.addEventListener('keydown',event=>{if(event.key==='/'&&!reader.open&&!about.open&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)){const input=$('#searchInput');if(input){event.preventDefault();input.focus()}}if(event.key==='Escape')closeMenu()});
$('.skip-link').addEventListener('click',event=>{event.preventDefault();main.focus();main.scrollIntoView({behavior:'instant'})});
route();
if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));
