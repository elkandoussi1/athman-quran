/* أثمان — تلوين أحكام التجويد لرواية ورش عن نافع (الإصدار 35).
   يُستخرج الحكم من ضبط المصحف نفسه (السكون، الشدة، علامة المد، الميم الصغيرة،
   الصفر المستدير، همزة الوصل، أشكال التنوين) ومن الكلمة المجاورة. لا يُغيَّر
   أي حرف من النص؛ يُلفّ الحرف بعلاماته في عنصر ملوّن فقط.
   الألوان على نظام مصاحف التجويد المعروف (الأحمر للمدود، والأخضر للغنة،
   والأزرق للتفخيم والقلقلة، والرمادي لما لا يُلفظ) مع ما يخص ورشًا:
   المتصل والمنفصل ست حركات، ومد البدل، واللين المهموز، وتغليظ اللام. */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;else root.ATHMAN_TAJWEED=api;
})(typeof window==='object'?window:globalThis,function(){
 'use strict';
 const RULES={
  lazim:{label:'مد لازم',hint:'6 حركات'},
  muttasil:{label:'مد متصل أو منفصل',hint:'6 حركات عند ورش'},
  badal:{label:'مد البدل واللين المهموز',hint:'2 أو 4 أو 6'},
  arid:{label:'مد عارض للسكون',hint:'عند الوقف'},
  ghunna:{label:'غنة وإخفاء وإدغام بغنة وإقلاب',hint:'حركتان'},
  qalqala:{label:'قلقلة',hint:'ق ط ب ج د الساكنة'},
  tafkhim:{label:'تفخيم',hint:'حروف الاستعلاء والراء المفخمة واللام المغلظة'},
  silent:{label:'لا يُلفظ',hint:'وصلًا'}
 };
 const SUKUN='ْ',SHADDA='ّ',MADDAH='ٓ',DAGGER='ٰ',ZERO='۟',WASL='۬',IQLAB='ۢ',HAMZA_ABOVE='ٔ';
 const FATHA='َ',DAMMA='ُ',KASRA='ِ';
 const TAN_IZHAR=/[ًٌٍ]/u,TAN_HIDDEN=/[ٖٗٞ]/u,TANWEEN=/[ًٌٍٖٗٞ]/u;
 const KASRA_LIKE=/[ٍِٖ]/u,FATHA_LIKE=/[ًَٗ]/u,DAMMA_LIKE=/[ٌُٞ]/u;
 const MARK=/[ً-ٰٟۖ-ۭ]/u;
 const HAMZAS=new Set(['ء','أ','إ','ؤ','ئ']);
 const QALQALA=new Set(['ق','ط','ب','ج','د']);
 const ISTILA=new Set(['خ','ص','ض','غ','ط','ق','ظ']);
 const IKHFA=new Set(['ت','ث','ج','د','ذ','ز','س','ش','ص','ض','ط','ظ','ف','ق','ك']);
 const GHUNNA_IDGHAM=new Set(['ي','ن','م','و']);
 const ALIFS=new Set(['ا','ٱ']);

 // A cluster is one base letter with every mark (and small waw/yeh) after it.
 function clusters(word){
  const out=[];
  for(const ch of String(word)){
   if(out.length&&(MARK.test(ch)||ch==='ۥ'||ch==='ۦ'))out[out.length-1].text+=ch;
   else out.push({text:ch,base:ch});
  }
  for(const c of out){c.marks=c.text.slice(c.base.length);c.letter=/\p{L}/u.test(c.base)&&!/[ۥۦ]/u.test(c.base)}
  return out;
 }
 const has=(c,mark)=>!!c&&c.marks.includes(mark);
 const bare=c=>!!c&&c.letter&&!/[ً-ْٖٗٞ]/u.test(c.marks);
 const isHamza=c=>!!c&&(HAMZAS.has(c.base)||has(c,HAMZA_ABOVE));
 const vowelOf=c=>!c?null:KASRA_LIKE.test(c.marks)?'i':DAMMA_LIKE.test(c.marks)?'u':FATHA_LIKE.test(c.marks)?'a':has(c,SUKUN)?'0':null;
 function silentLetter(c,p=null){
  if(!c||!c.letter)return false;
  if(has(c,ZERO)||ALIFS.has(c.base)&&(has(c,SUKUN)||has(c,WASL)))return true;
  // This Warsh dabt puts the circle on a waw after damma / yeh after kasra that is
  // written but not read (أُوْلَٰٓئِكَ، سَأُوْرِيكُمْ).
  return has(c,SUKUN)&&!!p&&(c.base==='و'&&vowelOf(p)==='u'||(c.base==='ي'||c.base==='ے')&&vowelOf(p)==='i');
 }
 // Madd letter: alif after fatha, waw after damma, yeh after kasra, or a dagger alif.
 function maddLetter(list,i){
  const c=list[i],p=list[i-1];if(!c||!p||!bare(c))return false;
  if(ALIFS.has(c.base)||c.base==='ى')return vowelOf(p)==='a'||has(p,DAGGER)||p.base==='ى';
  if(c.base==='و')return vowelOf(p)==='u';
  if(c.base==='ي'||c.base==='ے')return vowelOf(p)==='i';
  return false;
 }
 function firstLetter(word){return clusters(word||'').find(c=>c.letter&&!silentLetter(c))||null}
 function lastLetter(word){const list=clusters(word||'').filter(c=>c.letter);return list.at(-1)||null}
 function startsWithHamza(word){const list=clusters(word||'').filter(c=>c.letter);const c=list[0];if(!c)return false;return isHamza(c)||ALIFS.has(c.base)&&!has(c,WASL)&&!has(c,SUKUN)&&/[َُِ]/u.test(c.marks)}
 function isMuqattaat(word){const list=clusters(word).filter(c=>c.letter);return list.length>0&&list.length<=5&&list.every(c=>!/[ًَُِ-ٍٖٗٞ]/u.test(c.marks)||has(c,MADDAH))&&list.some(c=>has(c,MADDAH))}

 function analyze(word,{prev='',next='',last=false}={}){
  const list=clusters(word),rules=new Array(list.length).fill(null);
  const letters=list.map((c,i)=>c.letter?i:-1).filter(i=>i>=0);
  const nextLetter=i=>{for(let j=i+1;j<list.length;j++)if(list[j].letter)return list[j];return null};
  const idx=i=>{for(let j=i+1;j<list.length;j++)if(list[j].letter)return j;return -1};
  const set=(i,rule)=>{if(i>=0&&!rules[i])rules[i]=rule};
  const nextWordFirst=firstLetter(next);
  const muqattaat=isMuqattaat(word);
  for(const i of letters){
   const c=list[i],after=nextLetter(i),afterWord=after||nextWordFirst,crossing=!after;
   // 1. Not pronounced in continuous recitation.
   if(silentLetter(c,list[i-1])){set(i,'silent');continue}
   // Idgham: an unmarked consonant followed by a shadda letter (lam shamsiyya,
   // noon/tanween into ل ر, mutaqaribat). Noon into ي ن م و keeps a ghunna.
   if((bare(c)||c.base==='ن'&&has(c,SUKUN))&&!maddLetter(list,i)&&afterWord&&has(afterWord,SHADDA)&&!(crossing&&!next)){
    if(c.base==='ن')set(i,GHUNNA_IDGHAM.has(afterWord.base)?'ghunna':'silent');
    else if(c.base==='م'&&afterWord.base==='م')set(i,'ghunna');
    else if(!['ا','و','ي','ى','ے','ٱ'].includes(c.base))set(i,'silent');
    if(rules[i])continue;
   }
   // 2. Madd marked with the maddah sign.
   if(has(c,MADDAH)){
    // A maddah on a letter that is not a madd letter is a muqatta'a letter (الٓمٓ).
    const maddBearer=['ا','ٱ','و','ي','ى','ے'].includes(c.base)||/[\u0670\u06E5\u06E6]/u.test(c.marks);
    if(muqattaat||!maddBearer){set(i,'lazim');continue}
    if(after){set(i,isHamza(after)?'muttasil':has(after,SHADDA)||has(after,SUKUN)?'lazim':'muttasil');continue}
    set(i,next&&startsWithHamza(next)?'muttasil':last?'arid':'muttasil');continue;
   }
   // 3. Ghunna: mushaddad noon/meem, iqlab, ikhfa, ikhfa shafawi.
   if((c.base==='ن'||c.base==='م')&&has(c,SHADDA)){set(i,'ghunna');continue}
   if(has(c,IQLAB)){set(i,'ghunna');continue}
   if(c.base==='ن'&&bare(c)&&afterWord&&IKHFA.has(afterWord.base)&&!has(afterWord,SHADDA)){set(i,'ghunna');continue}
   if(c.base==='م'&&bare(c)&&afterWord?.base==='ب'){set(i,'ghunna');continue}
   if(TAN_HIDDEN.test(c.marks)&&!last&&nextWordFirst){
    if(IKHFA.has(nextWordFirst.base)||GHUNNA_IDGHAM.has(nextWordFirst.base)&&has(nextWordFirst,SHADDA)){set(i,'ghunna');continue}
   }
   // 4. Warsh madd al-badal (hamza then madd letter) and lin before hamza.
   if(isHamza(c)&&!has(c,SHADDA)){
    const j=idx(i);
    if(has(c,DAGGER))set(i,'badal');
    else if(j>=0&&maddLetter(list,j)&&!has(list[j],MADDAH)&&!(last&&j===letters.at(-1)))set(j,'badal');
   }
   if((c.base==='و'||c.base==='ي')&&has(c,SUKUN)&&vowelOf(list[i-1])==='a'&&after&&isHamza(after)){set(i,'badal');continue}
   // 5. Qalqala: sakin letters, and the last letter when stopping.
   if(QALQALA.has(c.base)&&(has(c,SUKUN)||last&&i===letters.at(-1)&&!has(c,SHADDA))){set(i,'qalqala');continue}
   // 6. Tafkhim: isti'la letters, Warsh taghlidh of lam, lafz al-jalala, ra.
   if(ISTILA.has(c.base)){set(i,'tafkhim');continue}
   if(c.base==='ل'&&has(c,FATHA)){
    const p=list.slice(0,i).reverse().find(x=>x.letter);
    if(p&&['ص','ط','ظ'].includes(p.base)&&(vowelOf(p)==='a'||vowelOf(p)==='0')){set(i,'tafkhim');continue}
   }
   if(c.base==='ل'&&has(c,SHADDA)&&list[idx(i)]?.base==='ه'&&list.slice(0,i).some(x=>x.base==='ل')){
    const before=list.slice(0,i).filter(x=>x.letter&&!silentLetter(x)&&!(x.base==='ل'&&bare(x))&&!(ALIFS.has(x.base)&&bare(x)));
    let v=before.length?vowelOf(before.at(-1)):null;
    if(!before.length){const pl=lastLetter(prev);v=pl?(has(pl,SUKUN)||KASRA_LIKE.test(pl.marks)||pl.base==='ي'||pl.base==='ے'?'i':vowelOf(pl)||'a'):'a'}
    if(v!=='i'){set(i,'tafkhim');continue}
   }
   if(c.base==='ر'&&!KASRA_LIKE.test(c.marks)){
    // Warsh: ra is thinned after a kasra (directly or across one sakin) or a sakin yeh.
    const p=list.slice(0,i).reverse().filter(x=>x.letter&&!silentLetter(x));
    const p1=p[0],p2=p[1];let thin=false;
    if(p1){
     if(vowelOf(p1)==='i'||(p1.base==='ي'&&(has(p1,SUKUN)||bare(p1))))thin=true;
     else if(vowelOf(p1)==='0'&&!ISTILA.has(p1.base)&&p2&&vowelOf(p2)==='i')thin=true;
    }
    if(has(c,SUKUN)&&after&&ISTILA.has(after.base))thin=false;
    if(!thin){set(i,'tafkhim');continue}
   }
  }
  // 7. Madd 'arid when stopping at the end of the verse.
  if(last&&letters.length>=2){
   const L=letters.at(-1),j=letters.at(-2),c=list[j];
   if(!TANWEEN.test(list[L].marks)||!ALIFS.has(list[L].base)){
    if(maddLetter(list,j)||has(c,DAGGER)&&!has(c,MADDAH)||(c.base==='و'||c.base==='ي')&&has(c,SUKUN)&&vowelOf(list[j-1])==='a')rules[j]=rules[j]==='badal'?'badal':rules[j]||'arid';
    if(has(list[L],DAGGER))set(L,'arid');
   }
  }
  return list.map((c,i)=>({text:c.text,rule:rules[i]}));
 }
 const esc=s=>String(s).replace(/[&<>]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;'})[ch]);
 function markup(word,context){
  const parts=analyze(word,context);let html='',run='',rule=null;
  const flush=()=>{if(!run)return;html+=rule?`<span class="tj tj-${rule}">${esc(run)}</span>`:esc(run);run=''};
  for(const p of parts){if(p.rule!==rule){flush();rule=p.rule}run+=p.text}
  flush();return html;
 }
 return {version:35,RULES,clusters,analyze,markup};
});
