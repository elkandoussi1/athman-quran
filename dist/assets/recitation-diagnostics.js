/* Detailed text logging is opt-in, bounded and memory-only. Never uploads. */
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./recitation-matcher.js'):root.ATHMAN_MATCHER);if(typeof module==='object'&&module.exports)module.exports=api;else root.ATHMAN_DIAGNOSTICS=api})(typeof window==='object'?window:globalThis,function(matcher){
 'use strict';
 class Journal{
  constructor({limit=100,now=()=>Date.now()}={}){this.limit=Math.max(1,Math.min(200,limit));this.now=now;this.enabled=false;this.records=[];this.dropped=0}
  setEnabled(enabled){this.enabled=!!enabled;if(!enabled)this.clear()}
  clear(){this.records=[];this.dropped=0}
  record({transcript,expected=[],reference=null,kind='interim',confidence=null,engine='browser',stage='tracking',choices=[],tracker=null}={}){
   if(!this.enabled||!String(transcript||'').trim())return null;
   const heard=String(transcript).trim().split(/\s+/u).slice(-32),source=expected.slice(0,36),alignment=matcher.alignWindow(source,0,heard,{windowSize:36,maxHeard:32});
   const differences=alignment.ops.filter(op=>op.type!=='match').map(op=>({type:op.type,similarity:op.kind||null,score:op.score,heardWord:op.h,expectedWord:op.e,heard:op.h===null?null:heard[op.h],expected:op.e===null?null:source[op.e]?.raw||source[op.e],characters:op.e!==null&&op.h!==null?matcher.characterEdits(source[op.e]?.raw||source[op.e],heard[op.h]):[]}));
   const item={time:this.now(),engine,kind:kind==='final'?'final':'interim',confidence:typeof confidence==='number'&&Number.isFinite(confidence)&&confidence>0?confidence:null,stage,reference,transcript:heard.join(' ').slice(-800),expectedText:source.map(word=>word.raw||word).join(' ').slice(0,1500),differences,choices:choices.slice(0,4),interpretation:stage==='locating'?'location-not-established':differences.length?'needs-comparison-with-spoken-audio':'text-aligned',diacritics:{evaluated:false,reason:'A transcript cannot establish pronunciation or tajwid.'}};
   if(tracker)item.tracker={before:tracker.before,after:tracker.after,previewEnd:tracker.previewEnd,result:tracker.result,strict:!!tracker.strict,scope:tracker.scope};
   this.records.push(item);if(this.records.length>this.limit){this.records.shift();this.dropped++}return item;
  }
  export(metadata={}){return {version:31,containsTranscripts:true,audioIncluded:false,storage:'memory-only',...metadata,dropped:this.dropped,records:this.records.map(record=>({...record}))}}
 }
 return {version:31,Journal};
});
