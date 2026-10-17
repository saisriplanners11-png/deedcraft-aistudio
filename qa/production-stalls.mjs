import assert from 'node:assert/strict';
import {createServer,request} from 'node:http';
import {createProxyHandler} from '../proxy.mjs';
const originalFetch=globalThis.fetch;let mode='hang';let started;
globalThis.fetch=(url,options)=>String(url).includes('generativelanguage.googleapis.com') ? mode==='ok' ? Promise.resolve(new Response(JSON.stringify({candidates:[{content:{parts:[{text:'ok'}]}}]}))) : new Promise((resolve,reject)=>{started?.();options.signal.addEventListener('abort',()=>reject(new Error('Upstream timed out')),{once:true});}) : originalFetch(url,options);
const handler=createProxyHandler(()=>({extractionProvider:'gemini',geminiApiKey:'test',draftModel:'draft'}),{maxConcurrent:1,timeoutMs:150});
const server=createServer((q,r)=>handler(q,r));await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}/api/anthropic/v1/messages`;
const send=()=>originalFetch(base,{method:'POST',body:JSON.stringify({model:'gemini',messages:[]})});
try{
 const entered=new Promise(r=>started=r);const pending=send();await entered;assert.equal((await send()).status,429);assert.equal((await pending).status,502);
 mode='ok';assert.equal((await send()).status,200);
 const big=await new Promise((resolve,reject)=>{const q=request(base,{method:'POST',headers:{'content-length':17*1024*1024}},r=>{r.resume();resolve(r.statusCode);});q.on('error',reject);q.end();});assert.equal(big,413);
 assert.equal((await send()).status,200);
 assert.equal((await originalFetch(base,{method:'POST',body:'bad json'})).status,400);
 assert.equal((await send()).status,200);
 console.log('PASS: bounded parallel requests, oversized upload rejection, upstream timeout, and slot recovery.');
}finally{globalThis.fetch=originalFetch;server.closeAllConnections();await new Promise(r=>server.close(r));}
