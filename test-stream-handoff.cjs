'use strict';
const assert=require('node:assert/strict');
const {Corpus,Follower,SpeechInput}=require('./dist/assets/recitation.js');
const q=require('./dist/assets/quran.json'),c=new Corpus(q.map(([sura,aya,text])=>({sura,aya,text})));
const at=(s,a,w=0)=>c.position(s,a,w),result=(text,isFinal=false)=>Object.assign([{transcript:text,confidence:.92}],{isFinal});
const words=c.words.slice(at(29,46),at(29,46)+120).map(w=>w.forms[0]);
const make=()=>{const f=new Follower(c);f.seek(29,46);return [f,new SpeechInput(f)]};
// Regression: an interim slot is a rolling 3-word window, not an ever-growing
// sentence. The old follower stalled while the microphone continued normally.
{
 const [f,input]=make();let batch;
 for(let n=3;n<=words.length;n++){
  batch=input.update([result(words.slice(n-3,n).join(' '))],{resultIndex:0});
  assert.equal(batch.preview.endPos,at(29,46)+n,`lost rolling window at ${n}`);
  assert.equal(f.states.size,0,'interim handoff must not certify discarded words');
 }
 assert.equal(f.provisional.size,117);assert.equal(f.snapshot().errorCount,0);
 input.update([result(words.slice(-3).join(' '),true)],{resultIndex:0});
 assert.equal(f.pos,at(29,46)+120);
 assert.equal([...f.states.values()].reduce((n,s)=>n+s.read.size,0),3,'only the actual final window earns read credit');
 assert.equal(f.provisional.size,117);
}
// A cumulative final can certify the whole actually returned utterance even
// though its initial words fell out of the rolling interim window long ago.
{
 const [f,input]=make();
 for(let n=3;n<=words.length;n++)input.update([result(words.slice(n-3,n).join(' '))],{resultIndex:0});
 input.update([result(words.join(' '),true)],{resultIndex:0});
 assert.equal(f.pos,at(29,46)+120);assert.equal(f.provisional.size,0);
 assert.equal([...f.states.values()].reduce((n,s)=>n+s.read.size,0),120);
}
// Ordinary interim extensions/revisions/withdrawals remain reversible.
{
 const [f,input]=make();input.update([result(words.slice(0,5).join(' '))]);
 let b=input.update([result(words.slice(0,3).join(' '))]);
 assert.equal(f.pos,at(29,46));assert.equal(f.provisional.size,0);assert.equal(b.preview.endPos,at(29,46,3));
 b=input.update([]);assert.equal(b.preview,null);f.endUtterance();assert.equal(f.pos,at(29,46));
}
// A single repeated token, an unrelated phrase, or a non-matching discarded
// prefix cannot cause a handoff or invent a new Quran location.
{
 const [f,input]=make();input.update([result(words.slice(0,3).join(' '))]);
 input.update([result('أهل كلمات غير واضحة')]);assert.equal(f.pos,at(29,46));assert.equal(f.provisional.size,0);
 input.update([result('قل هو الله أحد')]);assert.equal(f.pos,at(29,46));assert.equal(f.provisional.size,0);
}
// Resetting an already-final slot must not discard its replacement merely
// because the event also contains an additional interim slot.
{
 const [f,input]=make();input.update([result(words.slice(0,3).join(' '),true)],{resultIndex:0});
 const b=input.update([result(words.slice(3,6).join(' '),true),result(words.slice(6,9).join(' '))],{resultIndex:0});
 assert.equal(f.pos,at(29,46,6));assert.equal(b.preview.endPos,at(29,46,9));
}
// Explicitly changed final slots get checked for duplication; immutable slots
// BEFORE resultIndex still must not be touched (even with a nonzero reset).
{
 const [f,input]=make();input.update([result(words.slice(0,2).join(' '),true),result(words.slice(2,4).join(' '),true)]);
 const event={length:2,get 0(){throw Error('untouched final prefix was read')},1:result(words.slice(4,6).join(' '),true)};
 input.update(event,{resultIndex:1});assert.equal(f.pos,at(29,46,6));
}
// Identical replayed final snapshots previously produced a false red after
// two events. Independent finals in genuinely new slots still count as retries.
{
 const [f,input]=make();f.seek(29,46,3);const item=result('شيء',true);
 input.update([item],{resultIndex:0});for(let n=0;n<5;n++)assert.equal(input.update([item],{resultIndex:0}).changed,false);
 assert.equal(f.snapshot().attempts,1);assert.equal(f.snapshot().errorSeverity,'partial');
 const confidenceOnly=Object.assign([{transcript:'شيء',confidence:.96}],{isFinal:true});input.update([confidenceOnly],{resultIndex:0});assert.equal(f.snapshot().attempts,1);
 input.update([item,result('',false)],{resultIndex:0});assert.equal(f.snapshot().attempts,1);
 input.update([item,result('شيء',true)],{resultIndex:1});assert.equal(f.snapshot().attempts,2);assert.equal(f.snapshot().errorSeverity,'error');
}
// A duplicate settled prefix may also WITHDRAW the entire live suffix.
{
 const [f,input]=make(),final=result(words.slice(0,2).join(' '),true);
 input.update([final]);input.update([final,result(words.slice(2,5).join(' '))]);
 const b=input.update([final],{resultIndex:0});assert.equal(b.changed,true);assert.equal(b.preview,null);assert.equal(f.live,null);
}
// The retained prefix and final window cannot cross practice scope limits.
{
 const f=new Follower(c,{start:at(29,46),end:at(29,46,12)});f.seek(29,46);const input=new SpeechInput(f);
 for(let n=3;n<=20;n++)input.update([result(words.slice(n-3,n).join(' '))],{resultIndex:0});
 input.update([result(words.slice(17,20).join(' '),true)],{resultIndex:0});
 assert(f.pos<=at(29,46,12));assert([...f.provisional].every(p=>p<at(29,46,12)));
 assert.equal([...f.states.values()].reduce((n,s)=>n+s.read.size,0),0);
}
console.log('PASS: rolling interim windows stay synchronized; handoff is provisional only; final credit uses actual supplied words; ordinary revisions retract; explicit list resets preserve new text and immutable prefixes; duplicate snapshots never manufacture retries; practice boundaries hold.');
