/* Output silence; only an explicit capture session receives PCM frames. */
'use strict';
class AthmanPCM extends AudioWorkletProcessor{
 constructor(){super();this.buffer=new Float32Array(2048);this.offset=0}
 process(inputs,outputs){
  for(const channel of outputs[0]||[])channel.fill(0);
  const channel=inputs[0]?.[0];if(!channel)return true;
  for(const value of channel){this.buffer[this.offset++]=value;if(this.offset===this.buffer.length){this.port.postMessage(this.buffer);this.offset=0}}
  return true;
 }
}
registerProcessor('athman-pcm',AthmanPCM);
