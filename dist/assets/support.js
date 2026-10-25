/* Sharing and optional support are always initiated by the visitor. */
(function(){
 'use strict';
 const $=id=>document.getElementById(id);
 const dialog=$('bankDialog'),status=$('status'),bankStatus=$('bankStatus'),shareButton=$('shareProject');
 const projectURL=$('projectLink').value;
 const shareData={title:'أثمان — رفيق الحفظ والمراجعة',text:'تطبيق مجاني ومفتوح المصدر لتصفّح أحزاب القرآن الكريم وأنصافها وأرباعها وأثمانها والسور، برواية ورش عن نافع.',url:projectURL};
 let timeout;
 function notify(message){clearTimeout(timeout);[status,bankStatus].forEach(el=>{el.textContent='';el.classList.remove('visible')});const target=dialog.open?bankStatus:status;target.textContent=message;target.classList.add('visible');timeout=setTimeout(()=>{target.classList.remove('visible');target.textContent=''},3500)}
 async function copyValue(target){
  const text=target.tagName==='INPUT'?target.value:target.textContent.trim();
  try{
   if(!navigator.clipboard?.writeText)throw new Error('Clipboard unavailable');
   await navigator.clipboard.writeText(text);notify('نُسخ إلى الحافظة');
  }catch{
   if(target.tagName==='INPUT'){target.focus();target.select()}
   else{const selection=window.getSelection(),range=document.createRange();range.selectNodeContents(target);selection.removeAllRanges();selection.addRange(range)}
   notify('حُدّد النص؛ استخدم خيار النسخ من قائمة التحديد');
  }
 }
 document.querySelectorAll('[data-copy-target]').forEach(button=>button.addEventListener('click',()=>copyValue($(button.dataset.copyTarget))));
 shareButton.addEventListener('click',async()=>{
  if(shareButton.disabled)return;
  if(navigator.share){
   shareButton.disabled=true;
   try{await navigator.share(shareData)}
   catch(error){if(error.name!=='AbortError')await copyValue($('projectLink'))}
   finally{shareButton.disabled=false}
  }else await copyValue($('projectLink'));
 });
 $('openBank').addEventListener('click',()=>{dialog.showModal();document.body.style.overflow='hidden';dialog.scrollTop=0});
 function closeBank(){dialog.close()}
 $('closeBank').addEventListener('click',closeBank);$('bankDone').addEventListener('click',closeBank);
 dialog.addEventListener('close',()=>{document.body.style.overflow=''});
 dialog.addEventListener('click',event=>{
  if(event.target!==dialog)return;const bounds=dialog.getBoundingClientRect();
  if(event.clientX<bounds.left||event.clientX>bounds.right||event.clientY<bounds.top||event.clientY>bounds.bottom)closeBank();
 });
 if('serviceWorker' in navigator&&/^https?:$/.test(location.protocol))navigator.serviceWorker.register('sw.js').catch(()=>{});
})();
