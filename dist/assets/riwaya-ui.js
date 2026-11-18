/* أثمان — واجهة اختيار الرواية (الإصدار 36).
   زر الرواية في الشريط العلوي والقائمة الجانبية، ونافذة اختيار بين ورش وحفص
   تُعرض مرة واحدة في أول زيارة بعد التحديث، ويمكن فتحها من إعدادات القارئ. */
(function(root){
 'use strict';
 const R=root.ATHMAN_RIWAYA;if(!R||!root.document)return;
 const doc=root.document;
 const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c]);
 const FACTS={
  warsh:['المصحف المحمدي المغربي بخط مجمع الملك فهد','الحزب ثمانية أثمان: 480 ثمنًا','العدّ المدني الأول','ألوان التجويد على أصول ورش: المتصل والمنفصل 6، والبدل، وتغليظ اللام'],
  hafs:['مصحف المدينة النبوية بخط مجمع الملك فهد','الحزب أربعة أرباع: 240 ربعًا','العدّ الكوفي','ألوان التجويد على أصول حفص: المتصل والمنفصل 4–5']
 };
 let dialog=null,selected=R.id;
 function build(){
  dialog=doc.createElement('dialog');dialog.className='riwaya-dialog';dialog.id='riwayaDialog';dialog.setAttribute('aria-labelledby','riwayaTitle');
  const card=r=>`<button type="button" class="riwaya-option" role="radio" data-riwaya-option="${r.id}" aria-checked="${r.id===R.id}">
    <span class="riwaya-option-head"><b>${esc(r.full)}</b>${r.id===R.id?'<span class="riwaya-current">الحالية</span>':''}<span class="riwaya-radio" aria-hidden="true"></span></span>
    <span class="riwaya-sample riwaya-sample--${r.id}" aria-hidden="true">${esc(r.basmala)}</span>
    <span class="riwaya-facts">${FACTS[r.id].map(f=>`<span>${esc(f)}</span>`).join('')}</span>
   </button>`;
  dialog.innerHTML=`<div class="riwaya-sheet">
   <button class="icon-button dialog-close" data-riwaya-close aria-label="إغلاق"><svg class="icon"><use href="#i-close"/></svg></button>
   <div class="riwaya-kicker">المصحف والتسميع</div>
   <h2 id="riwayaTitle">اختر الرواية التي تقرأ بها</h2>
   <p class="riwaya-lead">يتغيّر النص والخط وترقيم الآيات وتقسيم الأحزاب وألوان التجويد ومطابقة التسميع معًا. تقدّمك ومحفوظاتك تُحفظ لكل رواية على حدة.</p>
   <div class="riwaya-options" role="radiogroup" aria-labelledby="riwayaTitle">${Object.values(R.all).map(card).join('')}</div>
   <div class="riwaya-actions"><button type="button" class="riwaya-confirm" data-riwaya-confirm></button><button type="button" class="riwaya-later" data-riwaya-close>إغلاق</button></div>
  </div>`;
  doc.body.append(dialog);
  dialog.addEventListener('click',event=>{
   const option=event.target.closest('[data-riwaya-option]');
   if(option){selected=option.dataset.riwayaOption;paint();return}
   if(event.target.closest('[data-riwaya-confirm]')){
    R.markChosen();if(selected!==R.id){dialog.querySelector('[data-riwaya-confirm]').textContent='جارٍ فتح المصحف…';R.set(selected)}else dialog.close();return;
   }
   if(event.target.closest('[data-riwaya-close]')||event.target===dialog){R.markChosen();dialog.close()}
  });
  dialog.addEventListener('keydown',event=>{
   if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;
   const ids=Object.keys(R.all),i=ids.indexOf(selected);selected=ids[(i+1)%ids.length];paint();
   dialog.querySelector(`[data-riwaya-option="${selected}"]`).focus();event.preventDefault();
  });
  dialog.addEventListener('close',()=>R.markChosen());
 }
 function paint(){
  for(const b of dialog.querySelectorAll('[data-riwaya-option]')){const on=b.dataset.riwayaOption===selected;b.setAttribute('aria-checked',String(on));b.tabIndex=on?0:-1}
  const target=R.all[selected];
  dialog.querySelector('[data-riwaya-confirm]').textContent=selected===R.id?`متابعة ب${target.full}`:`اعتمِد ${target.full}`;
 }
 function open(){
  if(!dialog)build();selected=R.id;paint();
  if(!dialog.open){try{dialog.showModal()}catch{dialog.setAttribute('open','')}}
  dialog.querySelector(`[data-riwaya-option="${selected}"]`)?.focus();
 }
 function chip(){
  const b=doc.createElement('button');b.type='button';b.className='riwaya-chip';b.dataset.riwayaOpen='';
  b.setAttribute('aria-label',`الرواية: ${R.full}. تغيير الرواية`);
  b.innerHTML=`<span class="riwaya-chip-dot" aria-hidden="true"></span><span class="riwaya-chip-label">${esc(R.label)}</span><svg class="icon" aria-hidden="true"><use href="#i-chevron"/></svg>`;
  return b;
 }
 function decorate(){
  const edition=doc.querySelector('.topbar .edition');
  if(edition&&!doc.querySelector('.topbar .riwaya-chip'))edition.replaceWith(chip());
  else if(!doc.querySelector('.topbar .riwaya-chip'))doc.querySelector('.topbar-actions')?.prepend(chip());
  const side=doc.querySelector('.sidebar-bottom .riwaya');
  if(side&&side.tagName!=='BUTTON'){
   const b=doc.createElement('button');b.type='button';b.className='riwaya riwaya-side';b.dataset.riwayaOpen='';
   b.innerHTML=`<span></span> ${esc(R.full)} <small>تغيير</small>`;side.replaceWith(b);
  }
  doc.addEventListener('click',event=>{if(event.target.closest('[data-riwaya-open]')){event.preventDefault();open()}});
  if(!R.chosen)setTimeout(()=>{if(!doc.querySelector('dialog[open]'))open()},700);
 }
 root.ATHMAN_RIWAYA_UI={open};
 if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',decorate);else decorate();
})(typeof window==='object'?window:globalThis);
