/* Installation UI: the browser handles installation; no external service is used. */
(function(){
 'use strict';
 const dialog=document.querySelector('#installDialog');
 const triggers=[...document.querySelectorAll('[data-install-open]')];
 const native=document.querySelector('#installNative');
 const confirm=document.querySelector('#installConfirm');
 const installedMedia=window.matchMedia('(display-mode: standalone)');
 let pendingPrompt=null;
 const isInstalled=()=>installedMedia.matches||window.navigator.standalone===true;
 function sync(){triggers.forEach(button=>{button.hidden=isInstalled()});native.hidden=!pendingPrompt}
 function notify(message){if(typeof toast==='function')toast(message)}
 function platformInstructions(){
  const ua=navigator.userAgent;
  const ios=/iP(hone|ad|od)/.test(ua)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  const platform=ios?'ios':/Android/i.test(ua)?'android':'desktop';
  document.querySelectorAll('[data-install-platform]').forEach(el=>{el.hidden=el.dataset.installPlatform!==platform});
 }
 window.addEventListener('beforeinstallprompt',event=>{
  event.preventDefault();pendingPrompt=event;sync();
 });
 window.addEventListener('appinstalled',()=>{
  pendingPrompt=null;triggers.forEach(button=>{button.hidden=true});
  if(dialog.open)dialog.close();notify('ثُبّت تطبيق أثمان بنجاح');
 });
 triggers.forEach(button=>button.addEventListener('click',()=>{
  if(isInstalled())return;
  if(typeof closeMenu==='function')closeMenu();
  platformInstructions();sync();dialog.showModal();
 }));
 document.querySelector('#installClose').addEventListener('click',()=>dialog.close());
 dialog.addEventListener('click',event=>{
  if(event.target!==dialog)return;const bounds=dialog.getBoundingClientRect();
  if(event.clientX<bounds.left||event.clientX>bounds.right||event.clientY<bounds.top||event.clientY>bounds.bottom)dialog.close();
 });
 confirm.addEventListener('click',async()=>{
  if(!pendingPrompt)return;
  const prompt=pendingPrompt;confirm.disabled=true;
  try{
   await prompt.prompt();const choice=await prompt.userChoice;
   pendingPrompt=null;sync();
   if(choice.outcome==='accepted'){dialog.close();notify('تابع التثبيت من نافذة المتصفح')}
  }catch{pendingPrompt=null;sync();notify('يمكنك التثبيت من قائمة المتصفح')}
  finally{confirm.disabled=false}
 });
 installedMedia.addEventListener?.('change',sync);
 sync();
})();
