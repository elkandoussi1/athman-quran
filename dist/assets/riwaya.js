/* أثمان — اختيار الرواية (الإصدار 36).
   يُحمَّل متزامنًا في رأس الصفحة قبل كل السكربتات المؤجلة: يحدد الرواية المختارة
   (ورش عن نافع أو حفص عن عاصم)، ويُدرج ملف بياناتها في موضعه من ترتيب السكربتات،
   ويفصل المحفوظات والتقدم لكل رواية لأن أرقام الآيات والتقسيمات تختلف بينهما. */
(function(){
 'use strict';
 var KEY='athman-riwaya',SEEN='athman-riwaya-chosen';
 var ALL={
  warsh:{id:'warsh',label:'ورش',full:'رواية ورش عن نافع',base:'assets/',font:'warsh.ttf',count:'العدّ المدني الأول',unit:'الثمن',units:'الأثمان',perHizb:8,
   basmala:'بِسْمِ اِ۬للَّهِ اِ۬لرَّحْمَٰنِ اِ۬لرَّحِيمِ',source:'خط ونص مجمع الملك فهد لطباعة المصحف الشريف · رواية ورش عن نافع',description:'المصحف المغربي: الحزب ثمانية أثمان.'},
  hafs:{id:'hafs',label:'حفص',full:'رواية حفص عن عاصم',base:'assets/hafs/',font:'hafs/hafs.ttf',count:'العدّ الكوفي',unit:'الربع',units:'الأرباع',perHizb:4,
   basmala:'بِسۡمِ ٱللَّهِ ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ',source:'خط ونص مجمع الملك فهد لطباعة المصحف الشريف · رواية حفص عن عاصم',description:'مصحف المدينة: الحزب أربعة أرباع.'}
 };
 var id=null,chosen=false,storage=null;
 try{storage=window.localStorage}catch(e){}
 try{
  var asked=new URLSearchParams(location.search).get('riwaya');
  if(asked&&ALL[asked]){id=asked;storage&&storage.setItem(KEY,asked);storage&&storage.setItem(SEEN,'1')}
  else if(storage)id=storage.getItem(KEY);
  chosen=!!(storage&&storage.getItem(SEEN));
 }catch(e){}
 if(!ALL[id])id='warsh';
 var current=ALL[id];
 // Progress, bookmarks, marks and journals refer to riwaya-specific numbering.
 var SCOPED={'athman-completed':1,'athman-last':1,'athman-saved':1,'athman-recitation-marks':1,'athman-study-v1':1};
 if(id!=='warsh'&&storage&&window.Storage){
  var proto=Storage.prototype,get=proto.getItem,set=proto.setItem,remove=proto.removeItem;
  var scoped=function(target,key){return target===storage&&SCOPED[key]?'athman-'+id+':'+String(key).slice(7):key};
  proto.getItem=function(key){return get.call(this,scoped(this,key))};
  proto.setItem=function(key,value){return set.call(this,scoped(this,key),value)};
  proto.removeItem=function(key){return remove.call(this,scoped(this,key))};
 }
 window.ATHMAN_RIWAYA={
  id:id,label:current.label,full:current.full,count:current.count,unit:current.unit,units:current.units,perHizb:current.perHizb,
  basmala:current.basmala,source:current.source,description:current.description,
  quran:current.base+'quran.json',all:ALL,chosen:chosen,
  set:function(next){
   if(!ALL[next])return false;
   try{storage.setItem(KEY,next);storage.setItem(SEEN,'1')}catch(e){}
   if(next===id)return false;
   var url=new URL(location.href);url.searchParams.delete('riwaya');url.hash='#/';
   try{history.replaceState(null,'',url.toString())}catch(e){}
   location.reload();return true;
  },
  markChosen:function(){try{storage.setItem(SEEN,'1')}catch(e){}window.ATHMAN_RIWAYA.chosen=true}
 };
 document.documentElement.dataset.riwaya=id;
 document.write('<link rel="preload" href="'+current.base+'quran.json" as="fetch" crossorigin>'+
  '<link rel="preload" href="assets/'+current.font+'" as="font" type="font/ttf" crossorigin>'+
  '<script src="'+current.base+'data.js?v=36" defer><\/script>');
})();
