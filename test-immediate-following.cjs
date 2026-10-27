'use strict';
const assert=require('node:assert/strict');
const {Corpus,Follower,SpeechInput}=require('./dist/assets/recitation.js');
const q=require('./dist/assets/quran.json'),c=new Corpus(q.map(([sura,aya,text])=>({sura,aya,text})));
const at=(s,a,w=0)=>c.position(s,a,w),idx=(s,a)=>c.byReference.get(`${s}:${a}`),options={speech:true,final:true,confidence:.92};
// Reproduce a desktop service that drops الكتاب and emits each next word in
// a separate result. The old two-word gate stalled on every following word.
let f=new Follower(c);f.seek(29,46,3);
for(const [text,word] of [['إلا',5],['بالتي',6],['هي',7],['أحسن',8]]){
 const r=f.feed(text,options);assert.equal(f.pos,at(29,46,word));assert.equal(r.errorCount,0);
}
assert.equal(f.state(idx(29,46)).read.has(3),false);assert(f.state(idx(29,46)).unverified.has(3));
f=new Follower(c);f.seek(29,46,3);let r=f.feed('إلا',{speech:true});
assert(r.preview.operations.some(op=>op.pos===at(29,46,4)&&op.type==='read'));assert.equal(f.states.size,0);assert.equal(f.pos,at(29,46,3));
// Ambiguous/short split finals need genuine ordered evidence, not repeating
// an already heard word. The buffer contains exact local candidates only.
const local=new Corpus([{sura:1,aya:1,text:'الحمد لله من فضل من رب العالمين'},{sura:2,aya:1,text:'قل هو الله أحد'}]);
f=new Follower(local);f.seek(1,1,1);r=f.feed('من',options);
// The immediate next exact word is unique in the two-word recovery window.
assert.equal(f.pos,3);assert.equal(r.errorCount,0);
const ambiguous=new Corpus([{sura:1,aya:1,text:'الحمد لله من من رب العالمين'}]);
f=new Follower(ambiguous);f.seek(1,1,1);r=f.feed('من',options);
assert.equal(f.pos,1);assert.equal(r.errorCount,0);assert.deepEqual(f.speechTail,['من']);
r=f.feed('رب العالمين',options);assert.equal(f.pos,6);assert.equal(f.state(0).read.has(3),true);assert.equal(f.speechTail.length,0);
// A retained, genuinely heard word is credited only when the next live
// hypothesis disambiguates it; no final result is needed for its preview.
f=new Follower(ambiguous);f.seek(1,1,1);f.feed('من',options);r=f.feed('رب العالمين',{speech:true});
assert(r.preview.operations.some(op=>op.type==='read'&&op.pos===3));assert.equal(f.state(0).read.size,0);
// Unrelated noise never enters a replay buffer or triggers Quran-wide search.
f=new Follower(c);f.seek(29,46,3);r=f.feed('ضجيج بعيد غير واضح',options);assert.equal(f.speechTail.length,0);assert.equal(f.pos,at(29,46,3));
// No guessing when two adjacent source words could match the same token.
f=new Follower(ambiguous);f.seek(1,1,1);r=f.feed('من',{speech:true});assert.equal(r.preview.endPos,1);
// Strict stops, range ends and distinct Warsh words remain authoritative.
f=new Follower(c,{index:idx(29,46),word:3,strict:true});r=f.feed('إلا',options);assert.equal(f.pos,at(29,46,3));assert.equal(f.speechTail.length,0);
f=new Follower(c,{start:at(29,46,3),end:at(29,46,4)});r=f.feed('إلا',options);assert.equal(f.pos,at(29,46,3));
f=new Follower(c);f.seek(1,3);f.feed('مالك',options);assert.equal(f.state(idx(1,3)).read.has(0),false);
// The actual native-results adapter must show progress for isolated interim
// tokens and then accept each final once, with no duplicate attempts.
f=new Follower(c);f.seek(29,46,3);const input=new SpeechInput(f),finals=[];
const result=(text,final)=>Object.assign([{transcript:text,confidence:.92}],{isFinal:final});
for(const text of ['إلا','بالتي','هي','أحسن']){
 const batch=input.update([...finals,result(text,false)]);assert(batch.preview.operations.some(op=>op.type==='read'));
 finals.push(result(text,true));input.update(finals);
}
assert.equal(f.pos,at(29,46,8));assert.equal(f.snapshot().errorCount,0);
console.log('PASS: immediate single-word local recovery; isolated desktop finals; bounded exact-tail assembly; live disambiguation; no replayed noise; strict/range/Warsh safety; native result-list adapter.');
