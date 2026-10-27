'use strict';
const assert=require('node:assert/strict');
const {Corpus,Follower,SpeechInput}=require('./dist/assets/recitation.js');
const q=require('./dist/assets/quran.json'),c=new Corpus(q.map(([sura,aya,text])=>({sura,aya,text})));
const at=(s,a,w=0)=>c.position(s,a,w),idx=(s,a)=>c.byReference.get(`${s}:${a}`),words=(s,a)=>c.units[idx(s,a)].words.map(w=>w.forms[0]);
const final={speech:true,final:true,confidence:.92},live={speech:true},text=words(29,46),next=words(29,47);
let f=new Follower(c);f.seek(29,46);f.feed(text.join(' '),final);const frontier=f.pos;
let r=f.feed(text.slice(0,3).join(' '),live);
assert.equal(r.preview.repetition.positions.length,3);assert.equal(r.preview.operations.length,0);assert.equal(f.pos,frontier);assert.equal(f.outcomes.length,1);
r=f.feed(text.slice(0,2).join(' '),live);assert.equal(r.preview.repetition.positions.length,2,'A revised repeat stays reversible');
r=f.feed('ضجيج',live);assert.equal(r.preview.repetition,null);assert.equal(f.snapshot().errorCount,0);
// Long previous ayahs (>24 words) and word-at-a-time finals get a dedicated
// repeat cursor, without rewinding progress, duplicate credit, flags or seeks.
f=new Follower(c);f.seek(29,46);f.feed(text.join(' '),final);
const locate=c.locate;c.locate=()=>{throw Error('No global search during repetition')};
for(const token of text){r=f.feed(token,final);assert.equal(r.type,'repeated');assert(r.repetition.positions.length);assert.equal(r.events.length,0);assert.equal(f.pos,frontier);assert.equal(r.errorCount,0)}
assert.equal(f.replay,null);assert.equal(f.outcomes.length,1);assert.equal(f.state(idx(29,46)).read.size,text.length);
r=f.feed(next.slice(0,4).join(' '),final);assert.equal(r.repetition,null);assert.equal(f.pos,frontier+4);assert.equal(r.errorCount,0);
c.locate=locate;
// Regression: a service-dropped word inside an established repeat used to
// flag word 0 of the NEXT ayah. Recovery stays inside previously traversed text.
f=new Follower(c);f.seek(29,46);f.feed(text.join(' '),final);f.feed(text.slice(0,3).join(' '),final);
r=f.feed(text.slice(4,8).join(' '),final);assert.equal(r.type,'repeated');assert.equal(r.errorCount,0);assert.equal(r.events.length,0);assert.equal(f.pos,frontier);
assert.deepEqual(r.repetition.positions,Array.from({length:4},(_,n)=>at(29,46,4+n)));assert.equal(f.replay.pos,at(29,46,8));
// A specific wrong/extra ASR token is not credited or replayed as old noise.
r=f.feed(['ضجيج',...text.slice(9,12)].join(' '),final);assert.equal(r.errorCount,0);assert.equal(f.pos,frontier);assert(!r.repetition.positions.includes(at(29,46,8)));assert.equal(r.events.length,0);
const replayPos=f.replay.pos;r=f.feed('كلام بعيد غير واضح',final);assert.equal(r.type,'unclear');assert.equal(r.errorCount,0);assert.equal(f.pos,frontier);assert.equal(f.replay.pos,replayPos);assert.equal(f.pending.length,0);assert.equal(f.speechTail.length,0);
r=f.feed(text.slice(12,15).join(' '),final);assert.equal(r.type,'repeated');assert.equal(r.errorCount,0);
r=f.feed(next.slice(0,3).join(' '),final);assert.equal(f.pos,frontier+3);assert.equal(f.replay,null);assert.equal(r.repetition,null);assert.equal(r.errorCount,0);
// A strong repeat prefix with a noisy trailing token waits in the repeat,
// instead of assigning that token to the next ayah's first word.
f=new Follower(c);f.seek(29,46);f.feed(text.join(' '),final);
r=f.feed([...text.slice(0,3),'ضجيج'].join(' '),final);assert.equal(r.type,'repeated');assert.equal(r.errorCount,0);assert.equal(f.replay.pos,at(29,46,3));assert.equal(f.pending.length,0);
// Recoverable live gaps remain provisional over a service interruption.
f=new Follower(c);f.seek(29,46);f.feed(text.join(' '),final);f.feed(text.slice(0,3).join(' '),final);
r=f.feed(text.slice(4,8).join(' '),live);assert.equal(r.preview.repetition.positions.length,4);assert.equal(f.replay.pos,at(29,46,3));f.endUtterance();assert.equal(f.pos,frontier);assert.equal(f.replay.pos,at(29,46,8));
r=f.feed(text.slice(8,10).join(' '),final);assert.equal(r.type,'repeated');assert.equal(r.events.length,0);assert.equal(r.errorCount,0);
// A gap in a repeat cannot turn an unverified first-pass word into read credit.
f=new Follower(c);f.seek(29,46);f.feed(text.filter((_,i)=>i!==3).join(' '),final);f.feed(text.slice(0,3).join(' '),final);f.feed(text.slice(4,8).join(' '),final);
assert.equal(f.state(idx(29,46)).read.has(3),false);assert.equal(f.state(idx(29,47)).read.size,0);assert.equal(f.snapshot().errorCount,0);
// An interim-only natural service restart keeps the independent repeat cursor.
f=new Follower(c);f.seek(29,46);f.feed(text.join(' '),final);f.feed(text.slice(0,3).join(' '),live);f.endUtterance();
assert.equal(f.pos,frontier);r=f.feed(text.slice(3,6).join(' '),final);assert.equal(r.type,'repeated');assert.equal(r.repetition.positions[0],at(29,46,3));assert.equal(r.errorCount,0);
// Repeating the beginning of the current ayah may continue beyond the old
// frontier in the same result; only genuinely new words receive read events.
f=new Follower(c);f.seek(29,46);f.feed(text.slice(0,8).join(' '),final);
r=f.feed(text.slice(0,10).join(' '),final);assert.equal(f.pos,at(29,46,10));assert.equal(r.repetition,null);assert.equal(r.events.length,2);assert.equal(r.errorCount,0);
// Repetition can also occur inside one cumulative native hypothesis.
f=new Follower(c);f.seek(29,46);r=f.feed([...text,...text,...next.slice(0,4)].join(' '),final);
assert.equal(f.pos,at(29,47,4));assert.equal(r.repetition,null);assert.equal(r.events.length,text.length+4);assert.equal(r.errorCount,0);
// A normal forward phrase wins ties; only strong local evidence can distinguish
// two ayahs that start alike. Unrecited earlier ayahs are never called repeats.
const small=new Corpus([{sura:1,aya:1,text:'قل هو الله أحد'},{sura:1,aya:2,text:'قل أعوذ برب الفلق'},{sura:2,aya:1,text:'قل هو الله أحد'}]);
f=new Follower(small);f.feed('قل هو الله أحد',final);r=f.feed('قل',live);assert.equal(r.preview.repetition,null);
r=f.feed('قل هو الله',live);assert.equal(r.preview.repetition.positions.length,3);assert.equal(f.pos,4);
r=f.feed('قل أعوذ برب الفلق',final);assert.equal(r.repetition,null);assert.equal(f.pos,8);
f=new Follower(c);f.seek(29,47);r=f.feed(text.join(' '),live);assert.equal(r.preview.repetition,null);
// Two locally identical starts wait for distinguishing words without flags.
const twins=new Corpus([{sura:1,aya:1,text:'الحمد لله رب الأولين'},{sura:1,aya:2,text:'الحمد لله رب الآخرين'},{sura:1,aya:3,text:'قل هو الله أحد'}]);
f=new Follower(twins);f.feed('الحمد لله رب الأولين الحمد لله رب',final);const twinPos=f.pos;
r=f.feed('الحمد لله',final);assert.equal(r.type,'unclear');assert.equal(r.errorCount,0);assert.equal(f.pos,twinPos);
r=f.feed('رب الأولين',final);assert.equal(r.type,'repeated');assert.equal(r.repetition.positions.length,4);assert.equal(r.errorCount,0);
// Practice scope never highlights/replays an earlier out-of-scope verse.
f=new Follower(c,{start:at(29,47),end:at(29,49)});f.feed(next.slice(0,4).join(' '),final);r=f.feed(text.join(' '),live);assert.equal(r.preview.repetition,null);
// Repeated matching is feedback only: it cannot certify a previously missed
// source word or erase an existing red/yellow review flag.
f=new Follower(c);f.seek(29,46);f.feed(text.filter((_,i)=>i!==3).join(' '),final);assert(!f.state(idx(29,46)).read.has(3));
r=f.feed(text.join(' '),final);assert.equal(r.type,'repeated');assert(!f.state(idx(29,46)).read.has(3));assert.equal(r.events.length,0);
// Native result slots commit once. The new slot is a new repetition; replaying
// an identical snapshot cannot generate another attempt or duplicate progress.
const result=(text,isFinal=false)=>Object.assign([{transcript:text,confidence:.92}],{isFinal});
f=new Follower(c);f.seek(29,46);let stream=new SpeechInput(f),a=result(text.join(' '),true);stream.update([a]);
let batch=stream.update([a,result(text.slice(0,3).join(' '))]);assert(batch.preview.repetition);
batch=stream.update([a,result(text.slice(0,3).join(' '),true)]);assert.equal(batch.commits[0].type,'repeated');
assert.equal(stream.update([a,result(text.slice(0,3).join(' '),true)]).commits.length,0);assert.equal(f.pos,frontier);
// Unchanged interim alternatives reuse their read-only choice. Final prefixes
// are skipped without even reading their old result objects on later events.
f=new Follower(c);f.seek(29,46);stream=new SpeechInput(f);let choices=0;const choose=stream.choose.bind(stream);stream.choose=(...args)=>{choices++;return choose(...args)};
const three=Object.assign([{transcript:text.slice(0,3).join(' '),confidence:.92},{transcript:'نص غير مطابق',confidence:.88},{transcript:'نص آخر',confidence:.85}],{isFinal:false});
let feeds=0;const feed=f.feed.bind(f);f.feed=(...args)=>{feeds++;return feed(...args)};
stream.update([three]);stream.update([three]);assert.equal(choices,1);assert.equal(feeds,1,'An exact top alternative needs one live alignment, not three probes plus alignment');assert.equal(f.states.size,0);
stream.update([a]);const guarded={length:2,get 0(){throw Error('Immutable final prefix was re-read')},1:result(next.slice(0,3).join(' '))};
batch=stream.update(guarded);assert(batch.preview);assert.equal(stream.finalCursor,1);
// Empty final slots are settled once without speech credit. Later updates
// must not read that immutable prefix again, including after withdrawing live text.
f=new Follower(c);f.seek(29,46);stream=new SpeechInput(f);const empty=result('',true);
stream.update([result(text.slice(0,3).join(' '))]);batch=stream.update([empty]);assert.equal(batch.changed,true);assert.equal(batch.preview,null);assert.equal(batch.commits.length,0);assert.equal(f.live,null);assert.equal(f.states.size,0);assert.equal(stream.finalCursor,1);
const afterEmpty={length:2,get 0(){throw Error('Empty settled final prefix was re-read')},1:result(text.slice(0,3).join(' '))};
batch=stream.update(afterEmpty);assert.equal(batch.preview.operations.length,3);assert.equal(f.snapshot().errorCount,0);
console.log('PASS: immediate local ayah repetition; long/split/cumulative repeats; independent restart cursor; monotonic progress; no duplicate credit or remote jumps; reversible feedback; scope/Warsh authority; cached alternatives, skipped empty/immutable finals, and bounded noisy-repeat recovery.');
