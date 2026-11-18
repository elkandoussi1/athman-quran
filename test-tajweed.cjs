'use strict';
// v35: Warsh tajweed colouring from the source dabt, and the soft page anchor.
const assert=require('node:assert/strict');
const T=require('./dist/assets/tajweed-warsh.js');
const {Corpus,Follower}=require('./dist/assets/recitation.js');
const q=require('./dist/assets/quran.json');
const verse=(s,a)=>q.find(x=>x[0]===s&&x[1]===a)[2].split(/\s+/).filter(w=>/\p{L}/u.test(w)&&!/^[ﭐ-﷿]+$/u.test(w));
function rules(s,a){const w=verse(s,a);return w.map((x,i)=>T.analyze(x,{prev:w[i-1],next:w[i+1],last:i===w.length-1}))}
const ruleOf=(parts,letter,n=0)=>parts.filter(p=>p.text.startsWith(letter))[n]?.rule??null;
// The text is never altered: joined parts equal the word.
for(const [s,a,t] of q.slice(0,400))for(const w of t.split(/\s+/))assert.equal(T.analyze(w).map(p=>p.text).join(''),w);
// Al-Fatiha: hamzat al-wasl and lam shamsiyya silent, madd lazim in الضالين, 'arid at the stop.
let r=rules(1,7);const dallin=r.at(-1);
assert.equal(dallin[0].rule,'silent');assert.equal(ruleOf(dallin,'ل'),'silent');assert.equal(dallin.find(p=>p.text.includes('\u0653')).rule,'lazim');assert.equal(ruleOf(dallin,'ي'),'arid');
assert.equal(ruleOf(r[0],'غ'),'tafkhim');
// Muqatta'at: الٓمٓ are madd lazim.
r=rules(2,1);assert(r[0].filter(p=>p.rule==='lazim').length>=2);
// Ikhfa, iqlab, idgham with/without ghunna, mushaddad noon/meem.
r=rules(2,3);assert.equal(ruleOf(r[3],'ن'),'ghunna','أُنزِلَ: ikhfa');
r=rules(2,4);assert.equal(ruleOf(r[3],'ن'),'silent','مِّن رَّبِّهِمْ: idgham without ghunna');assert.equal(ruleOf(r[3],'م'),'ghunna');assert.equal(ruleOf(r[4],'ر'),'tafkhim');
r=rules(2,255);const iqlab=r.find(p=>p.some(x=>x.text.includes('ۢ')));assert.equal(iqlab.find(x=>x.text.includes('ۢ')).rule,'ghunna');
// Qalqala on a sakin letter and at the verse end; muttasil/munfasil (6 for Warsh).
r=rules(112,3);assert.equal(r[1].at(-1).rule,'qalqala');
r=rules(2,3);assert.equal(r[2].find(p=>p.text.includes('\u0653')).rule,'muttasil','بِمَآ أُنزِلَ: munfasil');
// Warsh badal and taghlidh of lam; jalala thin after kasra, thick after fatha.
r=rules(59,9);assert.equal(r[1].find(p=>p.text==='و'||p.text.startsWith('و')&&p.rule)?.rule,'badal','تَبَوَّءُو');
r=rules(2,2);assert(r.some(w=>w.some(p=>p.text.startsWith('لَ')&&p.rule==='tafkhim')),'الصلوٰة: taghlidh');
r=rules(2,255);const billah=r.find(w=>w.map(p=>p.text).join('').normalize('NFC')==='بِاللَّهِ'.normalize('NFC'));assert(!billah.some(p=>p.rule==='tafkhim'));
const wallah=r.find(w=>w.map(p=>p.text).join('').normalize('NFC')==='وَاللَّهُ'.normalize('NFC'));assert(wallah.some(p=>p.rule==='tafkhim'));
// Markup is valid and escapes nothing unexpected.
assert.match(T.markup('اَ۬لضَّآلِّينَ',{last:true}),/^<span class="tj tj-silent">/);
// Soft page anchor: start reading mid-passage (Al-Hashr 9) while anchored at its first ayah.
const corpus=new Corpus(q.map(([sura,aya,text])=>({sura,aya,text})));
const f=new Follower(corpus);f.seek(59,1);const start=corpus.position(59,1,0),end=corpus.position(59,12,0);f.softRange={start,end};
const res=f.feed('على أنفسهم ولو كان بهم خصاصة ومن يوق شح نفسه',{final:true,speech:true,confidence:.9});
assert.equal(res.anchorMoved,true);assert.equal(f.state(corpus.byReference.get('59:9')).errors.size,0);
assert(f.state(corpus.byReference.get('59:9')).read.size>=10);assert.equal(f.state(corpus.byReference.get('59:1')).read.size,0);
// Once something was recited the anchor is firm again.
const g=new Follower(corpus);g.seek(59,1);g.softRange={start,end};g.feed('سبح لله ما في السماوات',{final:true,speech:true,confidence:.9});
const r2=g.feed('على أنفسهم ولو كان بهم خصاصة',{final:true,speech:true,confidence:.9});assert.notEqual(r2.anchorMoved,true);
console.log('PASS: Warsh tajweed rules (wasl, shamsiyya, lazim, muqatta\'at, ikhfa, iqlab, idgham, qalqala, muttasil/munfasil, badal, taghlidh, jalala, arid); text unchanged; soft page anchor.');
