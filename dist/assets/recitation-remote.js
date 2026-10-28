/* Optional authenticated PCM/WAV ASR. Selected explicitly; no silent fallback. */
(function(root,factory){const api=factory(root,typeof module==='object'&&module.exports?require('./recitation-capture.js'):root.ATHMAN_CAPTURE);if(typeof module==='object'&&module.exports)module.exports=api;else root.ATHMAN_REMOTE=api})(typeof window==='object'?window:globalThis,function(root,audio){
 'use strict';
 function endpointURL(value){const url=new URL(value);if(url.username||url.password||url.hash||url.search)throw Error('Invalid endpoint');if(url.protocol!=='https:'&&!(url.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(url.hostname)))throw Error('HTTPS required');return url.href}
 function base64(buffer){const bytes=new Uint8Array(buffer);let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));return typeof btoa==='function'?btoa(binary):Buffer.from(bytes).toString('base64')}
 class Segmenter{
  constructor({threshold=.015,silenceMs=900,maxSeconds=6,onSegment=()=>{}}={}){this.threshold=Math.min(.08,Math.max(.003,threshold));this.silenceMs=Math.min(1800,Math.max(400,silenceMs));this.maxSeconds=Math.min(8,Math.max(2,maxSeconds));this.onSegment=onSegment;this.parts=[];this.frames=0;this.voiced=0;this.quiet=0;this.preroll=[];this.prerollFrames=0;this.rate=16000}
  push(samples,rate){
   this.rate=rate;const voiced=audio.rms(samples)>=this.threshold;
   if(!this.parts.length&&!voiced){this.preroll.push(samples);this.prerollFrames+=samples.length;while(this.preroll.length>1&&this.prerollFrames>rate*.2)this.prerollFrames-=this.preroll.shift().length;return}
   if(!this.parts.length){this.parts=this.preroll;this.frames=this.prerollFrames;this.preroll=[];this.prerollFrames=0}
   this.parts.push(samples);this.frames+=samples.length;this.voiced+=voiced?samples.length:0;this.quiet=voiced?0:this.quiet+samples.length;
   if(this.frames>=rate*this.maxSeconds||this.quiet>=rate*this.silenceMs/1000)this.flush(this.quiet<rate*this.silenceMs/1000);
  }
  flush(overlap=false){
   if(this.voiced>=this.rate*.25){const joined=new Float32Array(this.frames);let at=0;for(const part of this.parts){joined.set(part,at);at+=part.length}this.onSegment(joined,this.rate);this.preroll=overlap?[joined.slice(-Math.floor(this.rate*.25))]:[];this.prerollFrames=this.preroll.reduce((sum,p)=>sum+p.length,0)}
   this.parts=[];this.frames=this.voiced=this.quiet=0;
  }
 }
 class Recognition{
  constructor({endpoint='',token='',silenceMs=900,threshold=.015,onLevel=()=>{},onPending=()=>{},fetcher=root.fetch?.bind(root),Capture=audio.Capture,schedule=(fn,ms)=>setTimeout(fn,ms),cancel=id=>clearTimeout(id)}={}){Object.assign(this,{endpoint,token,silenceMs,threshold,onLevel,onPending,fetcher,Capture,schedule,cancel});this.active=false;this.results=[];this.queue=[];this.sequence=0;this.generation=0;this.pending=false;this.request=null;this.timeout=null;this.capture=null;this.segmenter=null}
  emit(name,event={}){this['on'+name]?.(event)}
  start(){
   if(this.active)throw Object.assign(Error('Already started'),{name:'InvalidStateError'});
   try{this.endpoint=endpointURL(this.endpoint)}catch{queueMicrotask(()=>this.emit('error',{error:'asr-configuration'}));return}
   this.active=true;const generation=++this.generation;this.results=[];this.queue=[];this.sequence=0;this.pending=false;this.sounding=false;
   this.segmenter=new Segmenter({silenceMs:this.silenceMs,threshold:this.threshold,onSegment:(samples,rate)=>this.enqueue(samples,rate)});
   this.capture=new this.Capture({onFrame:(samples,rate)=>{if(!this.active||generation!==this.generation)return;const level=audio.rms(samples),sounding=level>=this.threshold;this.onLevel(level);if(sounding!==this.sounding){this.sounding=sounding;this.emit(sounding?'soundstart':'soundend')}this.segmenter.push(samples,rate)},onError:error=>this.fail(error)});
   this.capture.start().then(ok=>{if(ok&&this.active&&generation===this.generation){this.emit('start');this.emit('audiostart')}}).catch(()=>this.fail('audio-capture'));
  }
  enqueue(samples,rate){
   if(!this.active)return;
   // Bound memory and latency. A slow backend must stop with a clear status,
   // rather than silently discarding audio or replaying old responses later.
   if(this.queue.length>=2){this.fail('asr-backlog');return}
   this.queue.push({samples,rate,sequence:this.sequence++});this.drain();
  }
  async drain(){
   if(!this.active||this.pending||!this.queue.length)return;this.pending=true;this.onPending(true);const segment=this.queue.shift(),generation=this.generation,controller=new AbortController();this.request=controller;
   const timeout=this.schedule(()=>controller.abort(),45000);this.timeout=timeout;
   try{
    const response=await this.fetcher(this.endpoint,{method:'POST',mode:'cors',cache:'no-store',credentials:'omit',headers:{'Content-Type':'application/json',...(this.token?{Authorization:'Bearer '+this.token}:{})},body:JSON.stringify({audio:base64(audio.wav(segment.samples,segment.rate)),sequence:segment.sequence,sampleRate:16000}),signal:controller.signal});
    if(!response.ok)throw {code:[401,403].includes(response.status)?'asr-access':response.status===429?'asr-busy':'asr-server'};
    if(Number(response.headers?.get('content-length'))>20000)throw {code:'asr-response'};
    let text;if(response.body?.getReader){const reader=response.body.getReader(),parts=[];let size=0;while(true){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>20000){await reader.cancel();throw {code:'asr-response'}}parts.push(part.value)}const bytes=new Uint8Array(size);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.length}text=new TextDecoder().decode(bytes)}else text=await response.text();
    if(text.length>20000)throw {code:'asr-response'};let data;try{data=JSON.parse(text)}catch{throw {code:'asr-response'}}
    if(typeof data.text!=='string'||data.text.length>5000||data.sequence!==segment.sequence)throw {code:'asr-response'};
    if(!this.active||generation!==this.generation)return;
    const transcript=data.text.trim();if(transcript){if(this.results.length>=96)this.results=[];const result=Object.assign([{transcript,confidence:typeof data.confidence==='number'&&data.confidence>0&&data.confidence<=1?data.confidence:0}],{isFinal:true});const resultIndex=this.results.length;this.results.push(result);this.emit('result',{results:this.results.slice(),resultIndex})}
   }catch(error){if(this.active&&generation===this.generation)this.fail(error.code||(error.name==='AbortError'?'asr-timeout':'network'))}
   finally{this.cancel(timeout);if(generation===this.generation){this.pending=false;this.request=null;this.timeout=null;this.onPending(false);if(this.active)this.drain()}}
  }
  fail(error){if(!this.active&&error!=='asr-configuration')return;this.emit('error',{error});this.abort()}
  abort(){this.active=false;this.generation++;this.capture?.stop();this.capture=null;this.request?.abort();this.cancel(this.timeout);this.timeout=null;this.request=null;this.pending=false;this.queue=[];this.segmenter=null;this.onLevel(null);this.onPending(false)}
  stop(){this.abort();this.emit('audioend');this.emit('end')}
 }
 return {version:31,Recognition,Segmenter,endpointURL};
});
