/* Optional serverless gateway. Model inference runs on the configured upstream. */
export function createGateway(fetcher=fetch){
 return {async fetch(request,env){
  const allowed=env.ASR_ALLOWED_ORIGIN||'https://elkandoussi1.github.io',origin=request.headers.get('Origin');
  const headers={'Access-Control-Allow-Origin':allowed,'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Authorization, Content-Type','Cache-Control':'no-store','Vary':'Origin','X-Content-Type-Options':'nosniff'};
  const respond=(status,detail)=>new Response(JSON.stringify({detail}),{status,headers:{...headers,'Content-Type':'application/json'}});
  if(origin!==allowed)return respond(403,'Origin is not allowed');
  if(new URL(request.url).pathname!=='/v1/transcribe')return respond(404,'Not found');
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(request.method!=='POST')return respond(405,'POST is required');
  const token=request.headers.get('Authorization')||'';if(!token.startsWith('Bearer ')||token.length>2200)return respond(401,'An access token is required');
  let upstream;try{upstream=new URL(env.ASR_UPSTREAM);if(upstream.protocol!=='https:'||upstream.username||upstream.password||upstream.search||upstream.hash)throw Error()}catch{return respond(503,'The operator has not configured the ASR upstream')}
  const parts=[];let size=0;const reader=request.body?.getReader();if(!reader)return respond(400,'Audio is required');
  while(true){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>800000){await reader.cancel();return respond(413,'Audio request is too large')}parts.push(part.value)}
  const body=new Uint8Array(size);let offset=0;for(const part of parts){body.set(part,offset);offset+=part.length}
  try{
   const response=await fetcher(upstream.href,{method:'POST',redirect:'error',headers:{'Content-Type':'application/json','Authorization':token,'Origin':allowed},body,signal:AbortSignal.timeout(45000)});
   const data=await response.arrayBuffer();if(data.byteLength>20000)return respond(502,'Invalid upstream response');
   return new Response(data,{status:response.status,headers:{...headers,'Content-Type':'application/json'}});
  }catch{return respond(502,'The inference service is unavailable')}
 }};
}
export default createGateway();
