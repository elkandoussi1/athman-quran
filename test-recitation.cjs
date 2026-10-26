'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {Session,variants,normalize}=require('./dist/assets/recitation.js');
const q=JSON.parse(fs.readFileSync('dist/assets/quran.json','utf8'));
const unit=v=>({sura:v[0],aya:v[1],text:v[2].replace(new RegExp(String.fromCharCode(0xfbff+v[1])+'$'),'').trim()});
const first=q.slice(0,3).map(unit);
const make=text=>new Session([{sura:2,aya:20,text}]);
assert(variants('اِ۬لْعَٰلَمِينَ').includes(normalize('العالمين')));
assert(variants('اَ۬لسَّمَٰوَٰتِ').includes(normalize('السماوات')));
assert(variants('ذَٰلِكَ').includes(normalize('ذلك')));
assert(variants('اَ۬لصَّلَوٰةَ').includes(normalize('الصلاة')));
assert(variants('ءَامَنُواْ').includes(normalize('آمنوا')));
// Quranic sila letters are reading marks, not obligatory ASR spelling letters.
for(const [source,asr] of [['لَهُۥ','له'],['عَلَيْهِۦ','عليه'],['عَلَيْهِمُۥٓ','عليهم'],['بِهِۦ','به'],['شَئْاٗ','شيئا']])assert(variants(source).includes(normalize(asr)),`${source} / ${asr}`);
// Live hypotheses are useful feedback, never confirmed verses or failed attempts.
let s=new Session(first);
for(let i=0;i<4;i++)assert.equal(s.feed('الحمد لله رب الناس').type,'interim');
assert.equal(s.index,0);assert.equal(s.snapshot().attempts,0);assert.equal(s.outcomes.length,0);
const live=s.feed('الحمد لله رب العالمين');assert.equal(live.previewIndex,1);assert.equal(s.index,0);
assert.equal(s.feed('الحمد لله',{final:true}).type,'progress');assert.equal(s.cursor,2);
assert.equal(s.feed('رب العالمين الرحمن الرحيم',{final:true}).type,'matched');assert.equal(s.index,2);
// Warsh's ملك cannot be silently accepted as the different word مالك.
assert.equal(s.feed('مالك يوم الدين',{final:true}).type,'mismatch');assert.equal(s.index,2);
assert.equal(s.feed('ملك يوم الدين',{final:true}).type,'complete');
// A wrong verse stays concealed; the third distinct attempt reveals its word only.
s=new Session(first);
for(let attempt=1;attempt<=3;attempt++){
 const r=s.feed('الحمد لله رب الناس',{final:true});
 assert.equal(r.type,'mismatch');assert.equal(s.index,0);assert.equal(s.outcomes.length,0);
 assert.equal(r.errorIndex,3);assert.equal(r.attempts,attempt);assert.equal(r.autoHint,attempt===3);
 assert.deepEqual(r.hints,attempt===3?[3]:[]);
}
assert.equal(s.feed('الحمد',{final:true}).type,'progress');
assert.equal(s.feed('لله رب العالمين',{final:true}).type,'matched');assert.equal(s.outcomes[0].assisted,true);
// Retry at the failing word, and reset counters at a new verse.
s=new Session(first);s.feed('الحمد لله رب الناس',{final:true});
assert.equal(s.feed('العالمين',{final:true}).type,'matched');assert.equal(s.snapshot().attempts,0);
// Omission, substitution and reordering never count as a correct verse.
for(const text of ['الحمد رب العالمين','الحمد لله العالمين','رب الحمد لله العالمين']){
 const t=new Session(first);assert.equal(t.feed(text,{final:true}).type,'mismatch');assert.equal(t.index,0);
}
// Clitics and ASR whitespace differences do not remove or invent words.
s=make('يَٰٓأَيُّهَا اُ۬لنَّاسُ');assert.equal(s.feed('يا أيها الناس',{final:true}).type,'complete');
s=make('وَإِذْ قَالَ');s.feed('و',{final:true});assert.equal(s.snapshot().attempts,0);assert.equal(s.feed('إذ قال',{final:true}).type,'complete');
s=make('مِن بَعْدِ');assert.equal(s.feed('منبعد',{final:true}).type,'complete');
// Invocation can span chunks and recur at a surah boundary.
s=new Session(first);s.feed('أعوذ بالله من الشيطان',{final:true});assert.equal(s.index,0);
assert.equal(s.feed('الرجيم بسم الله الرحمن الرحيم الحمد لله رب العالمين',{final:true}).type,'matched');
s=new Session([{sura:1,aya:1,text:'الحمد لله'},{sura:2,aya:1,text:'الم'}]);
assert.equal(s.feed('الحمد لله بسم الله الرحمن الرحيم الم',{final:true}).type,'complete');
s=make('بسم الله');assert.equal(s.feed('بسم الله',{final:true}).type,'complete');
// Disconnected letters are spoken by name and may arrive in separate chunks.
s=new Session([{sura:2,aya:1,text:'أَلَٓمِّٓۖ ذَٰلِكَ اُ۬لْكِتَٰبُ'}]);
s.feed('ألف لام',{final:true});assert.equal(s.snapshot().attempts,0);
assert.equal(s.feed('ميم ذلك الكتاب',{final:true}).type,'complete');
s=new Session([{sura:19,aya:1,text:'كهيعص'}]);
assert.equal(s.feed('كاف هاء ياء عين صاد',{final:true}).type,'complete');
// Hints and full-verse help do not advance or certify a verse.
s=new Session(first);s.hint();s.peek();assert.equal(s.index,0);assert.equal(s.outcomes.length,0);
s.skip();assert.equal(s.index,1);assert.equal(s.outcomes[0].assisted,true);
// Every official verse can be tokenised and matched back without changing text.
for(const v of q){const u=unit(v),t=new Session([u]);const original=t.units[0].text;const r=t.feed(t.units[0].words.map(w=>w.forms[0]).join(' '),{final:true});assert.equal(r.type,'complete',`${v[0]}:${v[1]}`);assert.equal(t.units[0].text,original)}
console.log('PASS: real Warsh verses; strict ordered matching; interim safety; retries; third-attempt word hints; assisted reveal; invocation and ASR word splitting.');
require('./test-tracking.cjs');
require('./test-live-tracking.cjs');
require('./test-study.cjs');
