'use strict';
const assert=require('node:assert/strict');
const {Corpus,Follower,SpeechInput,normalize,variants}=require('./dist/assets/recitation.js');
const q=require('./dist/assets/quran.json');
const corpus=new Corpus(q.map(([sura,aya,text])=>({sura,aya,text})));
const at=(s,a,w=0)=>corpus.position(s,a,w),idx=(s,a)=>corpus.byReference.get(`${s}:${a}`);
const options={final:true,speech:true,confidence:.93};
const text='ولا تجادلوا أهل الكتاب إلا بالتي هي أحسن إلا الذين ظلموا منهم وقولوا آمنا بالذي أنزل إلينا وأنزل إليكم وإلهنا وإلهكم واحد ونحن له مسلمون وكذلك أنزلنا إليك الكتاب فالذين آتيناهم الكتاب يؤمنون به ومن هؤلاء من يؤمن به وما يجحد بآياتنا إلا الكافرون وما كنت تتلو من قبله من كتاب ولا تخطه بيمينك إذا لارتاب المبطلون';
// Reproduce the photographed passage using ordinary Arabic ASR spelling.
let f=new Follower(corpus);f.seek(29,46);let r=f.feed(text,options);
assert.equal(f.pos,at(29,49));assert.equal(r.errorCount,0,'Unpronounced rasm alif is not a recitation mistake');
assert.equal(f.outcomes.length,3);assert(f.outcomes.every(o=>!o.assisted&&!o.hasErrors));
assert(variants('تَتْلُواْ').includes(normalize('تتلو')));
assert(!variants('دَعَوَا').includes(normalize('دعو')),'Do not remove a pronounced final alif');
assert(!variants('مَلِك').includes(normalize('مالك')));
// Mobile services may overlap the last words across final result boundaries.
f=new Follower(corpus);f.seek(29,46);
f.feed('ولا تجادلوا أهل الكتاب إلا بالتي',options);
r=f.feed('إلا بالتي هي أحسن إلا الذين ظلموا منهم',options);
assert.equal(f.pos,at(29,46,12));assert.equal(r.errorCount,0);
const before=f.pos;r=f.feed('إلا الذين ظلموا منهم',options);
assert.equal(f.pos,before);assert.equal(r.errorCount,0,'A repeated final suffix must not create extra-word flags');
r=f.feed('منهم',options);assert.equal(f.pos,before);assert.equal(r.errorCount,0,'A single repeated final word is a retry, not an error on the next word');
f=new Follower(corpus);f.seek(29,46);r=f.feed('ولا تجادلوا أهل أهل الكتاب إلا بالتي هي أحسن',options);
assert.equal(f.pos,at(29,46,8));assert.equal(r.errorCount,0,'An inserted duplicate has no expected word to flag');
// Split clitics and final-only words can still match without accumulating noise.
f=new Follower(corpus);f.seek(29,46,17);f.feed('و',options);
r=f.feed('أنزل إليكم وإلهنا وإلهكم واحد ونحن له مسلمون',options);
assert.equal(f.pos,at(29,47));assert.equal(r.errorCount,0);
// Test the actual result-list adapter independently of microphone/network.
assert.equal(typeof SpeechInput,'function');
const result=(alternatives,final=false)=>Object.assign(alternatives.map(a=>typeof a==='string'?{transcript:a,confidence:.9}:a),{isFinal:final});
f=new Follower(corpus);f.seek(29,46);let stream=new SpeechInput(f);
let batch=stream.update([result(['ولا تجادلوا أهل الكتاب'])]);
assert.equal(batch.commits.length,0);assert.equal(batch.preview.focusPos,at(29,46,3));assert.equal(f.states.size,0);
batch=stream.update([result(['ولا تجادلوا أهل الكتاب'],true),result(['إلا بالتي'])]);
assert.equal(batch.commits.length,1);assert.equal(batch.preview.focusPos,at(29,46,5));
batch=stream.update([result(['ولا تجادلوا أهل الكتاب'],true),result(['إلا بالتي']),result(['هي أحسن'])]);
assert.equal(batch.commits.length,0);assert.equal(batch.preview.focusPos,at(29,46,7));
batch=stream.update([result(['ولا تجادلوا أهل الكتاب'],true),result(['إلا بالتي'])]);
assert.equal(batch.preview.focusPos,at(29,46,5),'A withdrawn interim suffix retracts without credit or flags');
batch=stream.update([result(['ولا تجادلوا أهل الكتاب'],true),result(['إلا بالتي'],true)]);
assert.equal(batch.commits.length,1);assert.equal(f.pos,at(29,46,6));
assert.equal(stream.update([result(['ولا تجادلوا أهل الكتاب'],true),result(['إلا بالتي'],true)]).commits.length,0);
batch=stream.update([result(['ولا تجادلوا أهل الكتاب'],true),result(['إلا بالتي'],true),result(['هي أحسن'])]);
assert(batch.preview);batch=stream.update([result(['ولا تجادلوا أهل الكتاب'],true),result(['إلا بالتي'],true)]);
assert.equal(batch.changed,true);assert.equal(batch.preview,null);f.endUtterance();assert.equal(f.pos,at(29,46,6),'Withdrawn speech cannot advance a later restart');
// Choose a supplied credible alternative, never fabricate a correction.
f=new Follower(corpus);f.seek(29,46);stream=new SpeechInput(f);
batch=stream.update([result([{transcript:'ولا تجادلوا أهل الكتا',confidence:.91},{transcript:'ولا تجادلوا أهل الكتاب',confidence:.88}],true)]);
assert.equal(f.pos,at(29,46,4));assert.equal(f.snapshot().errorCount,0);
f=new Follower(corpus);f.seek(29,46);stream=new SpeechInput(f);
batch=stream.update([result([{transcript:'ولا تجادلوا أهل الناس',confidence:.96},{transcript:'ولا تجادلوا أهل الكتاب',confidence:.12}],true)]);
assert.equal(f.state(idx(29,46)).read.has(3),false,'An implausible lower candidate cannot manufacture correctness');
// One service mismatch is provisional; repeated independent confident results
// can mark a clear mismatch red. Low confidence never adds attempts or a beep.
f=new Follower(corpus);f.seek(29,46,3);
r=f.feed('شيء',options);assert.equal(r.errorSeverity,'partial');assert.equal(r.definiteErrors,false);assert.equal(r.attempts,1);
r=f.feed('شيء',options);assert.equal(r.errorSeverity,'error');assert.equal(r.definiteErrors,true);assert.equal(r.attempts,2);
r=f.feed('الكتاب إلا بالتي',options);assert.equal(r.errorIndex,null);assert.equal(r.errorCount,0);
assert.equal(f.pending.length,0,'Rejected speech tails are not prepended to later utterances');
f=new Follower(corpus);f.seek(29,46,3);r=f.feed('ضجيج غير واضح',{...options,confidence:.2});
assert.equal(r.errorCount,0);assert.equal(r.attempts,0);assert.equal(r.definiteErrors,false);assert.equal(f.pos,at(29,46,3));
f=new Follower(corpus);f.seek(29,46,3);f.feed('شيء',{...options,confidence:null});
r=f.feed('شيء',options);assert.equal(r.errorSeverity,'partial','Red needs two confident results, not one unknown result and one confident result');
r=f.feed('شيء',options);assert.equal(r.errorSeverity,'error');
f=new Follower(corpus);f.seek(29,46,3);for(let n=0;n<3;n++)r=f.feed('شيء',options);
assert.equal(r.autoHint,true);assert.deepEqual(r.hints,[3]);assert.equal(f.state(idx(29,46)).read.has(3),false);
f=new Follower(corpus);f.seek(1,3);stream=new SpeechInput(f);
stream.update([result([{transcript:'مالك يوم الدين',confidence:.95}],true)]);
assert.equal(f.state(idx(1,3)).read.has(0),false,'Acoustic alternatives and conservative colors never certify another riwaya word');
// An ASR dropped word is uncredited; it must not become a definite omission.
f=new Follower(corpus);f.seek(29,46);r=f.feed('ولا تجادلوا أهل الكتاب إلا هي أحسن إلا الذين ظلموا منهم',options);
assert.equal(f.state(idx(29,46)).read.has(5),false);assert.equal(r.definiteErrors,false);assert.equal(f.pos,at(29,46,12));
// Expanded local recovery can recover a noisy tail without a remote search.
f=new Follower(corpus);f.seek(29,46,3);let searches=0;const locate=corpus.locate;
corpus.locate=()=>{searches++;throw Error('No global search after lock')};
r=f.feed('ضجيج أول ثاني ثالث رابع خامس سادس إلا بالتي هي أحسن إلا الذين ظلموا منهم',options);
assert.equal(f.pos,at(29,46,12));assert.equal(searches,0);assert.equal(r.definiteErrors,false);
r=f.feed('قل هو الله أحد الله الصمد',options);assert.equal(f.pos,at(29,46,12));assert.equal(searches,0);
corpus.locate=locate;
// Interim-only service interruptions retain position and provisional reveal,
// without certifying words in the session journal.
f=new Follower(corpus);f.seek(29,46);f.feed('ولا تجادلوا أهل الكتاب',{speech:true});f.endUtterance();
assert.equal(f.pos,at(29,46,4));assert.equal(f.states.size,0);assert(f.provisional.has(at(29,46,3)));
r=f.feed('إلا بالتي هي أحسن',options);assert.equal(f.pos,at(29,46,8));assert.equal(f.state(idx(29,46)).read.has(0),false);
// Strict mode and passage boundaries still forbid arbitrary recovery.
f=new Follower(corpus,{index:idx(29,46),strict:true});r=f.feed('ولا تجادلوا أهل شيء إلا بالتي هي أحسن',options);
assert.equal(f.pos,at(29,46,3));assert.equal(f.state(idx(29,46)).read.has(3),false);
f=new Follower(corpus,{start:at(29,46),end:at(29,47)});f.seek(29,46);f.feed(text,options);assert.equal(f.pos,at(29,47));assert.equal(f.state(idx(29,47)).read.size,0);
console.log('PASS: ordinary Warsh spelling; overlap/repetition recovery; split fragments; complete result snapshots; reversible live revisions; credible alternatives; conservative acoustic evidence; local-only recovery; provisional interruption resume; strict/scoped safety.');
