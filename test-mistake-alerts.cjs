'use strict';
// v34: mutashabih confusion is flagged and alerts; ASR word drops stay silent.
const assert=require('node:assert/strict');
const {Corpus,Follower}=require('./dist/assets/recitation.js');
const sounds=require('./dist/assets/athman-sounds.js');
const q=require('./dist/assets/quran.json');
const corpus=new Corpus(q.map(([sura,aya,text])=>({sura,aya,text})));
const opt={final:true,speech:true,confidence:.9},u=corpus.byReference.get('2:122');
// Warsh 2:122 «ولا يقبل منها عدل ولا تنفعها شفاعة» read with the ending of 2:47.
let f=new Follower(corpus);f.seek(2,122);
f.feed('واتقوا يوما لا تجزي نفس عن نفس شيئا',opt);
let r=f.feed('ولا يقبل منها شفاعة ولا يؤخذ منها عدل',opt);
assert.equal(r.confusion,true);assert.equal(r.mistake,true);
assert.deepEqual([...f.state(u).errors.keys()].filter(w=>w>=11&&w<=13),[11,12,13],'skipped words are mistakes, not unverified');
for(const level of ['balanced','sensitive','confirmed'])assert.equal(sounds.shouldAlert(r,level),true,level);
assert.equal(sounds.shouldAlert(r,'off'),false);
f.feed('ولا هم ينصرون',opt);assert.equal(f.state(u).errors.size,3,'later correct words do not erase the confusion');
// The same confusion in one final result.
f=new Follower(corpus);f.seek(2,122);
r=f.feed('واتقوا يوما لا تجزي نفس عن نفس شيئا ولا يقبل منها شفاعة ولا يؤخذ منها عدل ولا هم ينصرون',opt);
assert.equal(r.confusion,true);assert.equal(f.state(u).errors.size,3);
// Correct recitation: no flags, no alert at any level.
f=new Follower(corpus);f.seek(2,122);
r=f.feed('واتقوا يوما لا تجزي نفس عن نفس شيئا ولا يقبل منها عدل ولا تنفعها شفاعة ولا هم ينصرون',opt);
assert.equal(r.mistake,false);for(const level of ['balanced','sensitive','confirmed'])assert.equal(sounds.shouldAlert(r,level),false);
// The service dropping words (no other words said) is not a mistake.
f=new Follower(corpus);f.seek(2,122);
r=f.feed('واتقوا يوما لا تجزي نفس عن نفس شيئا ولا يقبل منها شفاعة ولا هم ينصرون',opt);
assert.equal(r.confusion,false);assert.equal(r.mistake,false);assert.equal(f.state(u).errors.size,0);
// A clearly different word is a balanced alert; a near-letter mishearing is not.
f=new Follower(corpus);f.seek(2,122);
r=f.feed('واتقوا يوما لا تجزي نفس عن نفس شيئا ولا يقبل منها مال ولا تنفعها شفاعة',opt);
assert.equal(sounds.shouldAlert(r,'balanced'),true,'different word');
f=new Follower(corpus);f.seek(2,122);
r=f.feed('واتقوا يوما لا تجزي نفس عن نفس شيئا ولا يقبل منها عدد ولا تنفعها شفاعة',opt);
assert.equal(sounds.shouldAlert(r,'balanced'),false,'near mishearing stays quiet in balanced');
assert.equal(sounds.shouldAlert(r,'sensitive'),true,'but alerts in sensitive');
// Preferences load defensively.
const store=new Map([[sounds.KEY,JSON.stringify({enabled:false,volume:5,mistake:'bogus',mistakeSound:'bell',taps:true})]]);
const prefs=sounds.load({getItem:k=>store.get(k)});
assert.deepEqual({e:prefs.enabled,v:prefs.volume,m:prefs.mistake,s:prefs.mistakeSound,t:prefs.taps},{e:false,v:1,m:'balanced',s:'bell',t:true});
console.log('PASS: mutashabih confusion flagged and alerted; clean and dropped-word recitations silent; sensitivity levels; defensive sound prefs.');
