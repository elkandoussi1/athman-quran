'use strict';
// Regression (field report): after ~5 words nothing more appeared for 40 seconds.
// Some engines restart event.results after each final, reusing index 0.
const assert=require('node:assert/strict');
const {Corpus,Follower,SpeechInput}=require('./dist/assets/recitation.js');
const q=require('./dist/assets/quran.json');
const corpus=new Corpus(q.map(([sura,aya,text])=>({sura,aya,text})));
const at=(s,a,w=0)=>corpus.position(s,a,w);
const result=(t,fin)=>Object.assign([{transcript:t,confidence:.9}],{isFinal:fin});
const words=[];for(let a=1;a<=6;a++)words.push(...corpus.units[corpus.byReference.get('45:'+a)].words.map(w=>w.forms.at(-1)));
const fresh=()=>{const f=new Follower(corpus,{start:at(45,1),end:at(46,1)});f.beginSearch();return [f,new SpeechInput(f)]};
const chunks=[];for(let i=0;i<words.length;i+=5)chunks.push(words.slice(i,i+5));
// 1) list restarts after every final: index 0 is reused by new speech.
{const [f,si]=fresh();
 for(const c of chunks){for(let k=1;k<=c.length;k++)si.update([result(c.slice(0,k).join(' '),false)],{resultIndex:0});si.update([result(c.join(' '),true)],{resultIndex:0});}
 f.endUtterance();assert.equal(f.pos,at(45,7),'restarted result list must keep tracking through ayah 6');}
// 2) ordinary accumulating list behaves exactly as before.
{const [f,si]=fresh(),finals=[];
 for(const c of chunks){for(let k=1;k<=c.length;k++)si.update([...finals,result(c.slice(0,k).join(' '),false)]);finals.push(result(c.join(' '),true));si.update([...finals]);}
 f.endUtterance();assert.equal(f.pos,at(45,7));}
// 3) a repeated identical list is never double-counted.
{const [f,si]=fresh();const fin=result(chunks[0].join(' '),true);si.update([fin]);const p=f.pos;si.update([fin]);si.update([fin]);assert.equal(f.pos,p,'same final seen again is not new speech');}
// 4) engine that never finalises: one interim result growing for the whole recitation.
{const [f,si]=fresh();let batch;for(let k=1;k<=words.length;k++)batch=si.update([result(words.slice(0,k).join(' '),false)]);
 assert(batch.preview,'live preview exists');assert(batch.preview.endPos>=at(45,6),'interim-only stream still tracks to ayah 6, got '+batch.preview.endPos);}
console.log('PASS: restarted result lists keep tracking; accumulating lists unchanged; repeated finals not double-counted; interim-only streams track live.');
