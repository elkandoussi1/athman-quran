'use strict';
// Regression: a word dropped by the speech service right before a repeated
// refrain (Ar-Rahman "فبأي آلاء ربكما تكذبان") must not freeze the follower.
const assert=require('node:assert/strict');
const {Corpus,Follower,SpeechInput}=require('./dist/assets/recitation.js');
const q=require('./dist/assets/quran.json');
const corpus=new Corpus(q.map(([sura,aya,text])=>({sura,aya,text})));
const at=(s,a,w=0)=>corpus.position(s,a,w);
const result=(t,fin)=>Object.assign([{transcript:t,confidence:.9}],{isFinal:fin});
for(const interim of [false,true]){
 const f=new Follower(corpus,{start:at(55,1),end:at(56,1)});f.seek(55,52,0);const stream=new SpeechInput(f),finals=[];
 // The service dropped «دان» (last word of 55:53) before the refrain 55:54.
 const chunks=['فباي الاي ربكما تكذبان','متكين عليا فرش بطاينها من استبرق وجنا','الجنتين فباي الاي','ربكما تكذبان فيهن قاصرات الطرف لم','يطمثهن انس قبلهم جان'];
 for(const c of chunks){const words=c.split(' ');
  if(interim)for(let k=1;k<=words.length;k++)stream.update([...finals,result(words.slice(0,k).join(' '),false)]);
  finals.push(result(c,true));stream.update([...finals]);}
 assert.equal(f.pos,at(55,56),'follower must reach 55:56 after the refrain, not stay on the dropped word');
}
// Control: an intentional repetition of the previous refrain still counts as a repetition, with no forward jump.
{const f=new Follower(corpus,{start:at(55,1),end:at(56,1)});f.seek(55,54,0);const stream=new SpeechInput(f);
 stream.update([result('فيهن قاصرات الطرف لم يطمثهن انس قبلهم ولا جان',true)]);const after=f.pos;
 stream.update([result('فيهن قاصرات الطرف لم يطمثهن انس قبلهم ولا جان',true),result('فباي الاي ربكما تكذبان',true)]);
 assert(f.pos>=after&&f.pos<=at(55,57),'a normal in-order refrain is still followed');}
console.log('PASS: dropped word before a repeated refrain recovers forward (final-only and live interim); normal refrain following unchanged.');
