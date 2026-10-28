'use strict';
const assert=require('node:assert/strict');
(async()=>{
 const {createGateway}=await import('./server/gateway/worker.mjs');let calls=0;
 const gateway=createGateway(async(url,options)=>{calls++;assert.equal(url,'https://inference.example/v1/transcribe');assert.equal(options.redirect,'error');assert.equal(options.headers.Authorization,'Bearer test-only');return new Response(JSON.stringify({text:'الحمد لله',sequence:0,confidence:null}))});
 const env={ASR_UPSTREAM:'https://inference.example/v1/transcribe'},headers={Origin:'https://elkandoussi1.github.io',Authorization:'Bearer test-only','Content-Type':'application/json'};
 const request=(method='POST',body='{}',h=headers)=>new Request('https://gateway.example/v1/transcribe',{method,headers:h,...(method==='POST'?{body}:{})});
 assert.equal((await gateway.fetch(request(),{})).status,503);assert.equal(calls,0);
 assert.equal((await gateway.fetch(request('POST','{}',{...headers,Origin:'https://other.example'}),env)).status,403);
 assert.equal((await gateway.fetch(request('POST','{}',{Origin:headers.Origin}),env)).status,401);
 assert.equal((await gateway.fetch(request('OPTIONS'),env)).status,204);
 assert.equal((await gateway.fetch(request('POST','x'.repeat(800001)),env)).status,413);
 const response=await gateway.fetch(request(),env);assert.equal(response.status,200);assert.equal(response.headers.get('Access-Control-Allow-Origin'),headers.Origin);assert.equal((await response.json()).text,'الحمد لله');assert.equal(calls,1);
 console.log('PASS: serverless gateway; explicit upstream; origin/auth/body limits; no redirects or model weights in the function.');
})().catch(error=>{console.error(error);process.exitCode=1});
