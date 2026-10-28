/* Explicit microphone capture for the optional remote engine and mic test. */
(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;else root.ATHMAN_CAPTURE=api})(typeof window==='object'?window:globalThis,function(root){
 'use strict';
 const workletURL=root.document?.currentScript?new URL('recitation-worklet.js?v=31',root.document.currentScript.src).href:'assets/recitation-worklet.js?v=31';
 const rms=samples=>Math.sqrt(samples.reduce((sum,value)=>sum+value*value,0)/Math.max(1,samples.length));
 function resample(samples,rate,target=16000){
  if(rate===target)return Float32Array.from(samples);if(!(rate>0&&target>0))throw Error('Invalid sample rate');
  const output=new Float32Array(Math.floor(samples.length*target/rate)),ratio=rate/target;
  // Average source samples for downsampling; avoid alias-prone nearest samples.
  for(let i=0;i<output.length;i++){const from=i*ratio,to=Math.min(samples.length,(i+1)*ratio);let sum=0,weight=0;for(let j=Math.floor(from);j<Math.ceil(to);j++){const overlap=Math.min(to,j+1)-Math.max(from,j);if(overlap>0){sum+=samples[j]*overlap;weight+=overlap}}output[i]=weight?sum/weight:0}
  return output;
 }
 function wav(samples,rate){
  const pcm=resample(samples,rate),buffer=new ArrayBuffer(44+pcm.length*2),v=new DataView(buffer),write=(at,text)=>{for(let i=0;i<text.length;i++)v.setUint8(at+i,text.charCodeAt(i))};
  write(0,'RIFF');v.setUint32(4,36+pcm.length*2,true);write(8,'WAVE');write(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,16000,true);v.setUint32(28,32000,true);v.setUint16(32,2,true);v.setUint16(34,16,true);write(36,'data');v.setUint32(40,pcm.length*2,true);
  for(let i=0;i<pcm.length;i++)v.setInt16(44+i*2,Math.round(Math.max(-1,Math.min(1,pcm[i]))*(pcm[i]<0?32768:32767)),true);return buffer;
 }
 class Capture{
  constructor({mediaDevices=root.navigator?.mediaDevices,Context=root.AudioContext||root.webkitAudioContext,Worklet=root.AudioWorkletNode,onFrame=()=>{},onError=()=>{}}={}){Object.assign(this,{mediaDevices,Context,Worklet,onFrame,onError});this.active=false;this.generation=0;this.stream=null;this.context=null;this.node=null;this.source=null}
  async start(){
   this.stop();this.active=true;const generation=this.generation;
   try{
    if(!this.mediaDevices?.getUserMedia||!this.Context)throw Object.assign(Error('Microphone unavailable'),{name:'NotSupportedError'});
    const stream=await this.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false});
    if(!this.active||generation!==this.generation){for(const track of stream.getTracks())track.stop();return false}
    this.stream=stream;let context;try{context=new this.Context({sampleRate:16000,latencyHint:'interactive'})}catch{context=new this.Context()}
    this.context=context;await context.resume();if(!this.active||generation!==this.generation)return false;
    const source=context.createMediaStreamSource(stream);this.source=source;
    if(context.audioWorklet&&this.Worklet){
     await context.audioWorklet.addModule(workletURL);if(!this.active||generation!==this.generation)return false;
     this.node=new this.Worklet(context,'athman-pcm',{numberOfInputs:1,numberOfOutputs:1,outputChannelCount:[1]});
     this.node.port.onmessage=event=>{if(this.active&&generation===this.generation)this.onFrame(Float32Array.from(event.data),context.sampleRate)};
    }else{
     this.node=context.createScriptProcessor(4096,1,1);this.node.onaudioprocess=event=>{event.outputBuffer.getChannelData(0).fill(0);if(this.active&&generation===this.generation)this.onFrame(Float32Array.from(event.inputBuffer.getChannelData(0)),context.sampleRate)};
    }
    for(const track of stream.getAudioTracks())track.onended=()=>{if(this.active){this.stop();this.onError('audio-capture')}};
    source.connect(this.node);this.node.connect(context.destination);return true;
   }catch(error){if(this.active&&generation===this.generation){this.stop();this.onError(['NotAllowedError','SecurityError'].includes(error?.name)?'not-allowed':error?.name==='NotSupportedError'?'service-not-allowed':'audio-capture')}return false}
  }
  stop(){
   this.active=false;this.generation++;
   if(this.node){if(this.node.port)this.node.port.onmessage=null;this.node.onaudioprocess=null;try{this.node.disconnect()}catch{}}
   try{this.source?.disconnect()}catch{}
   if(this.stream)for(const track of this.stream.getTracks()){track.onended=null;track.stop()}
   if(this.context)Promise.resolve(this.context.close()).catch(()=>{});
   this.stream=this.context=this.node=this.source=null;
  }
 }
 return {version:31,Capture,rms,resample,wav};
});
