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
 // A shared, local index of the official text. Positions are full-verse word offsets.
 function consume(words,pos,heard,at){
  const word=words[pos];if(!word)return null;
  let joined='';
  for(let n=1;n<=Math.min(5,heard.length-at);n++){joined+=heard[at+n-1];if(matches(word,joined))return {take:n,advance:1}}
  if(words[pos+1]&&joins(word,words[pos+1],heard[at]))return {take:1,advance:2};
  return null;
 }
 function scan(words,pos,heard,at,limit=24,end=words.length){
  const start=pos,from=at,pairs=[];
  while(at<heard.length&&pos<end&&pos-start<limit){
   const step=consume(words,pos,heard,at);if(!step)break;
   if(pos+step.advance>end)break;
   pairs.push(at+':'+pos);at+=step.take;pos+=step.advance;
  }
  return {pos,at,count:pos-start,take:at-from,chars:heard.slice(from,at).join('').length,pairs};
 }
 class Corpus{
  constructor(units){
   const cache=new Map();
   this.units=units.map(u=>{
    const marker=String.fromCharCode(0xfbff+u.aya),text=u.text.endsWith(marker)?u.text.slice(0,-1).trimEnd():u.text;
    return {...u,text,words:sourceWords(text).map((raw,i)=>{
     const opening=i<2&&openings.has(u.sura)&&(u.aya===1||u.sura===42&&u.aya===2),key=(opening?'opening:':'word:')+raw;
     if(!cache.has(key))cache.set(key,wordInfo(raw,u,i));return {...cache.get(key)};
    })};
   }).filter(u=>u.words.length);
   this.words=[];this.starts=[];this.byReference=new Map();this.byForm=new Map();
   this.units.forEach((u,index)=>{
    this.starts.push(this.words.length);this.byReference.set(u.sura+':'+u.aya,index);
    u.words.forEach((w,word)=>{
     w.index=index;w.word=word;w.pos=this.words.length;this.words.push(w);
     for(const form of w.forms){const positions=this.byForm.get(form)||[];positions.push(w.pos);this.byForm.set(form,positions)}
    });
   });
   this.starts.push(this.words.length);
  }
  position(sura,aya,word=0){const index=this.byReference.get(sura+':'+aya);return index===undefined?null:this.starts[index]+Math.min(Math.max(0,word),this.units[index].words.length-1)}
  reference(pos){const word=this.words[Math.min(pos,this.words.length-1)];return word?{index:word.index,word:word.word,sura:this.units[word.index].sura,aya:this.units[word.index].aya}:null}
  seeds(heard,at){
   const result=new Set();let joined='';
   for(let n=1;n<=Math.min(5,heard.length-at);n++){joined+=heard[at+n-1];for(const p of this.byForm.get(joined)||[])result.add(p)}
   const token=heard[at];
   for(let split=1;split<token.length;split++)for(const p of this.byForm.get(token.slice(0,split))||[])if(this.words[p+1]?.forms.includes(token.slice(split)))result.add(p);
   return result;
  }
  locate(heard,{start=0,end=this.words.length}={}){
   const candidates=[];let from=0;
   const scoped=start>0||end<this.words.length;
   while(!scoped&&from<heard.length){
    const remaining=heard.length-from,intro=introductions.find(intro=>intro.slice(0,Math.min(intro.length,remaining)).every((w,i)=>w===heard[from+i]));
    if(!intro)break;if(remaining<intro.length)return {status:'waiting'};from+=intro.length;
   }
   // Short/repeated formulas are not enough to choose a Quran location.
   for(let at=from;at<heard.length-(scoped?0:1);at++){
    for(const pos of this.seeds(heard,at)){
     if(pos<start||pos>=end)continue;
     const match=scan(this.words,pos,heard,at,128,end);
     if(scoped){if(match.count<1||match.chars<2||match.at!==heard.length&&match.pos!==end)continue}
     else if(match.count<3||match.chars<12&&!(match.count>=4&&match.chars>=10))continue;
     if(heard.length-match.at>4)continue;
     candidates.push({pos,heardStart:at,...match,endPos:match.pos,startPos:pos});
    }
   }
   if(!candidates.length)return {status:'waiting'};
   candidates.sort((a,b)=>b.chars-a.chars||b.count-a.count||a.heardStart-b.heardStart);
   const best=candidates[0],pairs=new Set(best.pairs);
   const alternatives=candidates.filter(c=>!c.pairs.some(p=>pairs.has(p))&&c.chars===best.chars);
   if(alternatives.length)return {status:'ambiguous',alternatives:alternatives.length+1};
   return {status:'found',pos:best.startPos,heardStart:best.heardStart,matched:best.count,endPos:best.endPos,reference:this.reference(best.startPos)};
  }
  search(text,{limit=40}={}){
   const value=String(text).replace(/[٠-٩]/g,c=>'٠١٢٣٤٥٦٧٨٩'.indexOf(c)).replace(/[۰-۹]/g,c=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(c)).trim(),reference=value.match(/^(\d{1,3})\s*[:：]\s*(\d{1,3})$/);
   if(reference){const pos=this.position(+reference[1],+reference[2]);return pos===null?[]:[{pos,...this.reference(pos)}]}
   const heard=heardWords(value);if(!heard.length)return [];
   const results=[],seen=new Set();
   for(const pos of this.seeds(heard,0)){
    if(scan(this.words,pos,heard,0,128).at!==heard.length)continue;
    const ref=this.reference(pos);if(seen.has(ref.index))continue;seen.add(ref.index);results.push({pos,...ref});
    if(results.length>=limit)break;
   }
   return results.sort((a,b)=>a.pos-b.pos);
  }
 }
 function anchor(words,pos,heard,at,end=words.length){
  const candidates=[];
  for(let skip=0;skip<=8&&pos+skip<end;skip++)for(let extra=0;extra<=4&&at+extra<heard.length;extra++){
   if(!skip&&!extra)continue;
   const found=scan(words,pos+skip,heard,at+extra,8,end);
   if(found.count<2||found.chars<8)continue;
   candidates.push({skip,extra,...found,cost:skip+extra});
  }
  candidates.sort((a,b)=>a.cost-b.cost||b.chars-a.chars||a.skip-b.skip);
  return candidates[0]||null;
 }
 function align(corpus,start,heard,{end=corpus.words.length,strict=false}={}){
  const words=corpus.words,operations=[];let pos=start,at=0,pending=[],error=null,autoIntro=false;
  while(at<heard.length&&pos<end){
   const word=words[pos],step=consume(words,pos,heard,at);
   if(step&&pos+step.advance<=end){for(let n=0;n<step.advance;n++)operations.push({type:'read',pos:pos+n});pos+=step.advance;at+=step.take;continue}
   if(word.word===0&&(pos===start||corpus.units[word.index].aya===1)){
    const remaining=heard.length-at,intro=introductions.find(intro=>intro.slice(0,Math.min(intro.length,remaining)).every((w,i)=>w===heard[at+i]));
    if(intro){if(remaining<intro.length){pending=heard.slice(at);autoIntro=true;break}at+=intro.length;continue}
   }
   const tail=heard.slice(at),joinedTail=tail.join('');
   if((word.letterNames||tail.length===1&&['و','ف','ب','ل','ك','ال','يا'].includes(tail[0]))&&word.forms.some(w=>w.startsWith(joinedTail))){pending=tail;break}
   const next=strict?null:anchor(words,pos,heard,at,end);
   if(!next){error=pos;pending=tail.slice(-24);break}
   // Resume only at an exact later anchor; skipped words remain explicit errors.
   if(next.skip)for(let n=0;n<next.skip;n++)operations.push({type:'error',pos:pos+n,kind:next.extra?'substitution':'omission'});
   else operations.push({type:'error',pos,kind:'extra'});
   pos+=next.skip;at+=next.extra;
  }
  return {pos,operations,error,pending,autoIntro};
 }
 class Follower{
  constructor(corpus,{index=0,word=0,start=0,end=corpus.words.length,strict=false}={}){
   this.corpus=corpus;this.units=corpus.units;this.pos=(corpus.starts[index]||0)+word;this.focusPos=this.pos;
   this.locating=false;this.locateBuffer=[];this.pending=[];this.errorIndex=null;this.errorPos=null;
   this.failures=new Map();this.hints=new Map();this.peeked=new Set();this.states=new Map();this.outcomes=[];this.changed=[];
   this.strict=strict;this.setRange(start,end);
  }
  get complete(){return this.pos>=this.end}
  get index(){return this.pos>=this.corpus.words.length?this.units.length:this.corpus.words[this.pos].index}
  get cursor(){return this.pos>=this.corpus.words.length?0:this.corpus.words[this.pos].word}
  state(index){return this.states.get(index)||{read:new Set(),errors:new Map(),ignored:new Set(),complete:false,partial:false}}
  editable(index){if(!this.states.has(index))this.states.set(index,{read:new Set(),errors:new Map(),ignored:new Set(),complete:false,partial:false});return this.states.get(index)}
  setRange(start,end){this.start=Math.max(0,Math.min(this.corpus.words.length-1,Number.isInteger(start)?start:0));this.end=Math.max(this.start+1,Math.min(this.corpus.words.length,Number.isInteger(end)?end:this.corpus.words.length));if(this.pos<this.start||this.pos>=this.end){this.pos=this.start;this.focusPos=this.pos}this.pending=[];return this}
  seek(sura,aya,word=0){const pos=this.corpus.position(sura,aya,word);if(pos===null||pos<this.start||pos>=this.end)return false;this.pos=pos;this.focusPos=pos;this.pending=[];this.locating=false;this.errorIndex=null;this.errorPos=null;this.changed=[];return true}
  ignoreWord(index,word){
   const state=this.editable(index);state.errors.delete(word);state.ignored.add(word);
   const pos=this.corpus.starts[index]+word;if(this.errorPos===pos){this.pos=Math.min(this.end,this.pos+1);this.errorPos=null;this.errorIndex=null;this.pending=[]}
   const outcome=this.outcomes.find(o=>o.index===index);if(outcome){outcome.hasErrors=state.errors.size>0;outcome.assisted=true}
   this.changed=[index];return this.snapshot();
  }
  snapshot(){
   const index=this.index,unit=this.units[index];
   const pendingError=this.errorPos!==null&&!this.states.get(index)?.errors.has(this.errorIndex)?1:0;
   return {index,total:this.units.length,cursor:this.cursor,complete:this.complete,unit,wordCount:unit?.words.length||0,
    focusPos:this.focusPos,locating:this.locating,errorIndex:this.errorIndex,attempts:this.failures.get(this.errorPos)||0,
    hints:[...(this.hints.get(index)||[])],peeked:this.peeked.has(index),outcomes:this.outcomes.slice(),changed:this.changed.slice(),
    errorCount:pendingError+[...this.states.values()].reduce((sum,s)=>sum+s.errors.size,0)};
  }
  beginSearch(){if(this.complete)this.pos=this.start;this.locating=true;this.locateBuffer=[];this.pending=[];this.errorIndex=null;this.errorPos=null;this.changed=[];return this.snapshot()}
  feed(transcript,{final=false}={}){
   const incoming=heardWords(transcript);if(!incoming.length)return {type:'empty',...this.snapshot()};
   let start=this.pos,heard=incoming,location=null;
   if(this.locating){
    const buffer=[...this.locateBuffer,...incoming].slice(-64),found=this.corpus.locate(buffer,{start:this.start,end:this.end});
    if(found.status!=='found'){
     if(final)this.locateBuffer=buffer;
     return {type:'locating',ambiguous:found.status==='ambiguous',...this.snapshot()};
    }
    if(!final)return {type:'interim',candidate:found,previewIndex:found.reference.index,previewCursor:found.reference.word,...this.snapshot()};
    start=found.pos;heard=buffer.slice(found.heardStart);location=found.reference;this.locating=false;this.locateBuffer=[];
   }else{
    if(this.complete)return {type:'complete',...this.snapshot()};
    const first=Math.max(this.start,this.corpus.starts[this.index]);
    // A retry may begin at the failing word or at the start of its verse.
    if(this.cursor>0&&!consume(this.corpus.words,start,incoming,0)&&consume(this.corpus.words,first,incoming,0))start=first;
    else if(this.pending.length&&!consume(this.corpus.words,start,incoming,0))heard=[...this.pending,...incoming];
   }
   let result=align(this.corpus,start,heard,{end:this.end,strict:this.strict});
   if(result.error!==null&&!location&&!this.strict){
    const found=this.corpus.locate(heard,{start:this.start,end:this.end});
    if(found.status==='found'&&found.matched>=4&&Math.abs(found.pos-start)>24){
     if(!final)return {type:'interim',candidate:found,previewIndex:found.reference.index,previewCursor:found.reference.word,...this.snapshot()};
     start=found.pos;heard=heard.slice(found.heardStart);location=found.reference;result=align(this.corpus,start,heard,{end:this.end});
    }
   }
   if(!final){const ref=this.corpus.reference(result.pos);return {type:'interim',previewIndex:result.pos===this.corpus.words.length?this.units.length:ref.index,previewCursor:ref?.word||0,previewError:result.error!==null,...this.snapshot()}}
   this.pos=result.pos;this.pending=result.pending;this.errorIndex=null;this.errorPos=null;const changed=new Set(),newErrors=new Set();
   for(const op of result.operations){
    const w=this.corpus.words[op.pos],state=this.editable(w.index);changed.add(w.index);this.focusPos=op.pos;
    state.ignored.delete(w.word);
    if(op.type==='error'){state.errors.set(w.word,{kind:op.kind});newErrors.add(op.pos)}
    else{state.read.add(w.word);if(!newErrors.has(op.pos))state.errors.delete(w.word)}
   }
   if(location&&!result.operations.length)this.focusPos=start;
   let autoHint=false;
   if(result.error!==null){
    const w=this.corpus.words[result.error];this.errorPos=result.error;this.errorIndex=w.word;changed.add(w.index);this.focusPos=result.error;
    const count=Math.min(3,(this.failures.get(result.error)||0)+1);this.failures.set(result.error,count);
    if(count===3){const hints=this.hints.get(w.index)||new Set();autoHint=!hints.has(w.word);hints.add(w.word);this.hints.set(w.index,hints)}
   }
   const finished=[];
   for(const i of changed){
    const state=this.editable(i),end=this.corpus.starts[i+1];
    if(this.pos>=end&&(state.read.has(this.units[i].words.length-1)||state.errors.has(this.units[i].words.length-1))){
     state.complete=true;state.partial=new Set([...state.read,...state.errors.keys()]).size<this.units[i].words.length;
     let outcome=this.outcomes.find(o=>o.index===i);
     if(!outcome){outcome={index:i};this.outcomes.push(outcome);finished.push(i)}
     Object.assign(outcome,{hasErrors:state.errors.size>0,partial:state.partial,assisted:this.peeked.has(i)||(this.hints.get(i)?.size||0)>0||state.errors.size>0||state.partial});
    }
   }
   this.changed=[...changed];
   const events=[...new Set(result.operations.map(op=>op.pos))].map(pos=>({type:newErrors.has(pos)?'error':'read',...this.corpus.reference(pos)}));
   if(result.error!==null)events.push({type:'uncertain',...this.corpus.reference(result.error)});
   return {type:result.error!==null?'mismatch':this.complete?'complete':newErrors.size?'continued':finished.length?'matched':'progress',events,location,finished,continued:newErrors.size>0,autoHint,...this.snapshot()};
  }
  hint(){if(!this.complete){const hints=this.hints.get(this.index)||new Set();let i=this.errorIndex??this.cursor;while(i<this.units[this.index].words.length&&hints.has(i))i++;if(i<this.units[this.index].words.length)hints.add(i);this.hints.set(this.index,hints)}return this.snapshot()}
  peek(){if(!this.complete)this.peeked.has(this.index)?this.peeked.delete(this.index):this.peeked.add(this.index);return this.snapshot()}
  skip(){if(!this.complete){const i=this.index,outcome=this.outcomes.find(o=>o.index===i);if(outcome)outcome.assisted=true;else this.outcomes.push({index:i,assisted:true,partial:true});this.pos=Math.min(this.end,this.corpus.starts[i+1]);this.focusPos=Math.min(this.pos,this.end-1);this.pending=[];this.errorIndex=null;this.errorPos=null;this.changed=[i]}return this.snapshot()}
 }

 return {normalize,variants,heardWords,sourceWords,Session,Corpus,Follower};
});
