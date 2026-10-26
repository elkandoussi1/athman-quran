/* Word matching for memorisation practice; not a pronunciation/tajwid assessor. */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.ATHMAN_RECITATION=api;
})(typeof window!=='undefined'?window:globalThis,function(){
 'use strict';
 function normalize(text){
  return String(text).normalize('NFKD').replace(/ۦ/g,'ي').replace(/ۥ/g,'و')
   .replace(/\p{M}/gu,'').replace(/[ٱأإآ]/g,'ا').replace(/[ىے]/g,'ي')
   .replace(/ؤ/g,'و').replace(/ئ/g,'ي').replace(/[ءـ]/g,'')
   .replace(/[^\p{L}\p{N}]/gu,'').replace(/ة/g,'ه');
 }
 function variants(raw){
  // Dagger alifs are orthographic: e.g. سَمَٰوَٰت / سماوات, ذَٰلِكَ / ذلك.
  let forms=[''];
  for(const c of String(raw)){
   if(c==='ٰ')forms=[...new Set(forms.flatMap(s=>[s,s+'ا']))].slice(0,16);
   else forms=forms.map(s=>s+c);
  }
  const result=new Set();
  for(const form of forms){
   let word=normalize(form);
   // Explicit Quranic spellings, without changing the displayed source text.
   word=word.replace(/صلوه$/,'صلاه').replace(/زكوه$/,'زكاه').replace(/حيوه$/,'حياه');
   if(word)result.add(word);
  }
  return [...result];
 }
 const heardWords=text=>String(text).split(/\s+/u).map(normalize).filter(Boolean);
 const sourceWords=text=>String(text).split(/\s+/u).map(s=>s.replace(/[^\p{L}\p{M}ـ]/gu,'')).filter(s=>normalize(s));
 const matches=(word,heard)=>word.forms.includes(heard);
 const joins=(a,b,heard)=>a.forms.some(x=>b.forms.some(y=>x+y===heard));
 const openings=new Set([2,3,7,10,11,12,13,14,15,19,20,26,27,28,29,30,31,32,36,38,40,41,42,43,44,45,46,50,68]);
 const spelled=new Set(['الم','الر','المر','المص','كهيعص','طه','طس','طسم','يس','ص','حم','عسق','ق','ن']);
 const letterNames={ا:['الف'],ل:['لام'],م:['ميم'],ر:['را'],ك:['كاف'],ه:['ها','هاء'],ي:['يا','ياء'],ع:['عين'],ص:['صاد'],ط:['طا','طاء'],س:['سين'],ح:['حا','حاء'],ق:['قاف'],ن:['نون']};
 function wordInfo(raw,unit,index){
  const forms=variants(raw),key=normalize(raw);
  const opening=index<2&&openings.has(unit.sura)&&(unit.aya===1||(unit.sura===42&&unit.aya===2))&&spelled.has(key);
  if(opening){let names=[''];for(const c of key)names=names.flatMap(prefix=>letterNames[c].map(name=>prefix+normalize(name)));forms.push(...names)}
  return {raw,forms:[...new Set(forms)],letterNames:opening};
 }
 const introductions=['أعوذ بالله من الشيطان الرجيم','بسم الله الرحمن الرحيم'].map(heardWords);
 class Session{
  constructor(units){
   this.units=units.map(u=>({...u,words:sourceWords(u.text).map((raw,i)=>wordInfo(raw,u,i))})).filter(u=>u.words.length);
   this.index=0;this.cursor=0;this.pending=[];this.errorIndex=null;
   this.failures=new Map();this.hints=new Map();this.peeked=new Set();this.outcomes=[];
  }
  get complete(){return this.index>=this.units.length}
  snapshot(){
   const unit=this.units[this.index];
   return {index:this.index,total:this.units.length,cursor:this.cursor,complete:this.complete,
    unit,wordCount:unit?.words.length||0,errorIndex:this.errorIndex,
    attempts:this.failures.get(this.index+':'+this.errorIndex)||0,
    hints:[...(this.hints.get(this.index)||[])].sort((a,b)=>a-b),peeked:this.peeked.has(this.index),
    outcomes:this.outcomes.slice()};
  }
  feed(transcript,{final=false}={}){
   if(this.complete)return {type:'complete',...this.snapshot()};
   let heard=[...this.pending,...heardWords(transcript)];
   if(!heard.length)return {type:'empty',...this.snapshot()};
   let index=this.index,cursor=this.cursor,at=0,pending=[],error=null;
   const finished=[];
   const unit=this.units[index];
   // A new utterance may resume at the current word or repeat the whole verse.
   if(heard.length&&cursor>0&&!matches(unit.words[cursor],heard[0])&&matches(unit.words[0],heard[0]))cursor=0;
   while(at<heard.length&&index<this.units.length){
    const current=this.units[index],words=current.words,word=words[cursor];
    // Invocation is optional, including a new surah in the same speech result.
    // An incomplete invocation waits for more speech and never fails by silence.
    if(cursor===0&&(index===0||(current.aya===1&&current.sura!==this.units[index-1]?.sura))&&!matches(word,heard[at])){
     const remaining=heard.length-at;
     const intro=introductions.find(intro=>intro.slice(0,Math.min(intro.length,remaining)).every((w,i)=>w===heard[at+i]));
     if(intro){if(remaining<intro.length){pending=heard.slice(at);break}at+=intro.length;continue}
    }
    let take=0,advance=0;
    let joined='';
    for(let n=1;n<=Math.min(5,heard.length-at);n++){joined+=heard[at+n-1];if(matches(word,joined)){take=n;advance=1;break}}
    if(!take&&cursor+1<words.length&&joins(word,words[cursor+1],heard[at])){take=1;advance=2}
    if(!take){
     const tail=heard.slice(at),joinedTail=tail.join('');
     if((word.letterNames||tail.length===1&&['و','ف','ب','ل','ك','ال','يا'].includes(tail[0]))&&word.forms.some(w=>w.startsWith(joinedTail))){pending=tail;break}
     error={index,word:cursor};break;
    }
    at+=take;cursor+=advance;
    if(cursor===words.length){finished.push(index);index++;cursor=0}
   }
   if(!final)return {type:'interim',previewIndex:index,previewCursor:cursor,previewError:!!error,...this.snapshot()};
   for(const i of finished)this.outcomes.push({index:i,assisted:this.peeked.has(i)||(this.hints.get(i)?.size||0)>0});
   this.index=index;this.cursor=cursor;this.pending=pending;this.errorIndex=null;
   let autoHint=false;
   if(error){
    this.errorIndex=error.word;
    const key=index+':'+error.word,count=Math.min(3,(this.failures.get(key)||0)+1);
    this.failures.set(key,count);
    if(count===3){const hints=this.hints.get(index)||new Set();autoHint=!hints.has(error.word);hints.add(error.word);this.hints.set(index,hints)}
   }
   return {type:error?'mismatch':this.complete?'complete':finished.length?'matched':'progress',autoHint,finished,...this.snapshot()};
  }
  hint(){
   if(this.complete)return this.snapshot();
   const hints=this.hints.get(this.index)||new Set(),words=this.units[this.index].words;
   let i=this.errorIndex??this.cursor;while(i<words.length&&hints.has(i))i++;
   if(i<words.length)hints.add(i);this.hints.set(this.index,hints);return this.snapshot();
  }
  peek(){if(!this.complete)this.peeked.has(this.index)?this.peeked.delete(this.index):this.peeked.add(this.index);return this.snapshot()}
  skip(){
   if(!this.complete){this.outcomes.push({index:this.index,assisted:true});this.index++;this.cursor=0;this.pending=[];this.errorIndex=null}
   return this.snapshot();
  }
 }
 return {normalize,variants,heardWords,sourceWords,Session};
});
