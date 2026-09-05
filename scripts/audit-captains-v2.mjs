import fs from 'node:fs';
import assert from 'node:assert/strict';
// Run against the local Vite server and an isolated headless Chrome profile.
// All Supabase traffic is intercepted; this script never mutates the real backend.
const origin=process.env.CAPTAINS_V2_ORIGIN || 'http://127.0.0.1:5185';
const debuggerOrigin=process.env.CAPTAINS_V2_CDP || 'http://127.0.0.1:9237';
const eventSlug=process.env.CAPTAINS_V2_SLUG || 'demo-capitanes-v2';
const experienceVersion=process.env.CAPTAINS_EXPERIENCE_VERSION || 'v2';
const firstChallengeStatus=process.env.CAPTAINS_FIRST_CHALLENGE_PENDING==='1'?'pending':'ready';
const eventId='de100000-0000-4000-8000-000000000001';
const titles=['Brindis de mesa','Pregunta de pareja','Mensaje secreto','Aliados de otra mesa','Coreografía exprés'];
const event={id:eventId,name:'Capitanes · Revelao',slug:eventSlug,status:'active',experience_version:experienceVersion,start_time:'2026-01-01T00:00:00Z',end_time:'2099-12-31T00:00:00Z'};
const tables=['Jorge','Marta','Laura','Dani',null].map((name,i)=>({id:`db100000-0000-4000-8000-00000000000${i+1}`,event_id:eventId,table_name:`Mesa ${i+1}`,table_number:i+1,captain_name:name,captain_photo_url:i===0?`${origin}/favicon.png`:null,total_points:0,completed_challenges:0,failed_challenges:0,session_token:`test-session-${i}`}));
const challenges=titles.map((title,i)=>({id:`dc100000-0000-4000-8000-00000000000${i+1}`,event_id:eventId,title,description:['Haced una foto de toda la mesa brindando por los novios.','¿Dónde fue la primera cita de la pareja?','Grabad un vídeo corto dedicando un mensaje sorpresa a los novios.','Haced una foto con alguien de otra mesa.','Grabad una coreografía con vuestra mesa.'][i],evidence_type:['photo','question','video','photo','video'][i],points:[20,15,25,15,20][i],has_time_limit:false,time_limit_seconds:null,question_options:i===1?['En un restaurante','En la playa','En un concierto','En casa de amigos']:null,question_correct_option:i===1?'En un restaurante':null,order_index:i+1}));
const rows=tables.flatMap((t,ti)=>challenges.map((c,i)=>({id:`dd100000-0000-4000-8000-0000000000${ti}${i}`,event_id:eventId,table_id:t.id,challenge_id:c.id,randomized_order_index:i+1,status:i===0?firstChallengeStatus:'pending',points_awarded:0,started_at:null})));
const evidence=[];const uploads=[];let rejectUpload=false;const exceptions=[];
const target=await fetch(`${debuggerOrigin}/json/new?about:blank`,{method:'PUT'}).then(r=>r.json());
const socket=new WebSocket(target.webSocketDebuggerUrl);await new Promise(r=>socket.addEventListener('open',r,{once:true}));
let id=0;const pending=new Map();
const send=(method,params={})=>new Promise((resolve,reject)=>{pending.set(++id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
const mock=async params=>{
 const {request,requestId}=params;const url=new URL(request.url);let result={};let status=200;
 if(request.method==='OPTIONS'){result={};}
 else if(url.pathname.includes('/rest/v1/')){
  const table=url.pathname.split('/').at(-1); const all={captains_events:[event],captains_tables:tables,captains_event_challenges:challenges,captains_table_challenges:rows,captains_evidence:evidence,captains_table_accesses:[]}[table]??[];
  let matching=all.filter(item=>[...url.searchParams].every(([k,v])=>!v.startsWith('eq.')&&!v.startsWith('neq.')||(v.startsWith('eq.')?String(item[k])===v.slice(3):String(item[k])!==v.slice(4))));
  if(request.method==='PATCH'){const payload=JSON.parse(request.postData);matching.forEach(item=>Object.assign(item,payload));}
  if(request.method==='POST'){const payload=JSON.parse(request.postData);all.push(payload);matching=[payload];}
  if(url.searchParams.get('select')?.includes('captains_event_challenges('))matching=matching.map(item=>({...item,captains_event_challenges:challenges.find(c=>c.id===item.challenge_id)}));
  result=Object.entries(request.headers).some(([key,value])=>key.toLowerCase()==='accept'&&value.includes('vnd.pgrst.object'))?(matching[0]??null):matching;
 }else if(url.pathname.includes('/storage/v1/object/sign/')){result={signedURL:`/object/public/captains-evidence/fixture.png`};}
 else if(url.pathname.includes('/storage/v1/object/public/')){await send('Fetch.fulfillRequest',{requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:'image/png'}],body:'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII='});return;}
 else if(url.pathname.includes('/storage/v1/object/')){
  if(rejectUpload){status=503;result={message:'Conexión interrumpida',error:'ServiceUnavailable',statusCode:'503'};rejectUpload=false;}
  else{uploads.push(url.pathname);result={Key:url.pathname,Id:'upload-id'};}
 }
 await send('Fetch.fulfillRequest',{requestId,responseCode:status,responseHeaders:[{name:'Content-Type',value:'application/json'},{name:'Access-Control-Allow-Origin',value:'*'},{name:'Access-Control-Allow-Headers',value:'*'},{name:'Access-Control-Allow-Methods',value:'GET,POST,PATCH,OPTIONS'}],body:Buffer.from(JSON.stringify(result)).toString('base64')});
};
socket.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p?.reject(m.error):p?.resolve(m.result);}if(m.method==='Fetch.requestPaused')mock(m.params).catch(error=>{console.error(error);process.exitCode=1;});if(m.method==='Runtime.exceptionThrown')exceptions.push(m.params.exceptionDetails.text);});
const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.text);return r.result.value;};
const wait=async test=>{for(let i=0;i<80;i++){if(await evaluate(test))return;await new Promise(r=>setTimeout(r,100));}throw Error(`Timeout: ${test}: ${await evaluate("document.body.innerText")}`);};
const click=async selector=>{await evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);await new Promise(r=>setTimeout(r,150));};
const screenshot=async name=>{const img=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(`/tmp/captains-revelao-${name}.png`,Buffer.from(img.data,'base64'));};
await send('Page.enable');await send('Runtime.enable');await send('Fetch.enable',{patterns:[{urlPattern:'*supabase.co/*'}]});
await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
await send('Page.navigate',{url:`${origin}/capitanes/${eventSlug}`});
if(experienceVersion==='legacy'){
 await wait(`!!document.querySelector('.captains-public')`);
 assert.equal(await evaluate(`!!document.querySelector('.cv2')`),false);
 await send('Page.close');socket.close();
 console.log('PASS: a legacy event keeps the original Capitanes experience.');
 process.exit(0);
}
await wait(`!!document.querySelector('.cv2-welcome')`);assert.equal(await evaluate(`document.querySelector('.cv2-join-bar button').textContent.trim()`),'Empezar');
assert.equal(await evaluate(`getComputedStyle(document.querySelector('.cv2-header')).position`),'fixed');
assert.equal(await evaluate(`getComputedStyle(document.querySelector('.cv2-join-bar')).position`),'fixed');
assert.equal(await evaluate(`document.querySelectorAll('.cv2-armband path').length>=5`),true);
await screenshot('welcome');await click('.cv2-join-bar button');await wait(`!!document.querySelector('.cv2-pick') || !!document.querySelector('.cv2-player-strip')`);if(await evaluate(`!!document.querySelector('.cv2-player-strip')`))await click('.cv2-session-footer button');
assert.equal(await evaluate(`/demo|simula/i.test(document.body.innerText)`),false);
assert.equal(await evaluate(`document.querySelector('.cv2-join-bar button').disabled`),true);
assert.equal(await evaluate(`document.querySelector('.cv2-join-bar button').textContent.trim()`),'Continuar');
assert.equal(await evaluate(`!!document.querySelector('.cv2-join-bar p')`),false);
assert.equal(await evaluate(`document.body.textContent.includes('AQUÍ EMPIEZA VUESTRA HISTORIA')`),false);
assert.equal(await evaluate(`document.querySelector('.cv2-photo-head img').getAttribute('src')`),`${origin}/favicon.png`);
for(const width of [320,390,430]){
 await send('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:true});
 assert.equal(await evaluate(`Array.from(document.querySelectorAll('.cv2-pick')).every(card=>card.querySelector('.cv2-pick-label').getBoundingClientRect().top>card.querySelector('.cv2-captain').getBoundingClientRect().bottom)`),true);
}
await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
await screenshot('identity');assert.equal(await evaluate(`document.querySelector('.cv2-pick:nth-child(5) .cv2-pick-label strong').textContent.trim()`),'Sin nombre');await click('.cv2-pick:nth-child(5)');assert.equal(await evaluate(`!!document.querySelector('.cv2-name-label')`),false);await click('.cv2-pick:nth-child(2)');await click('.cv2-join-bar button');await wait(`!!document.querySelector('.cv2-active-quest')`);
assert.equal(await evaluate(`document.querySelector('.cv2-bottom-nav').textContent.includes('Recuerdos')`),false);
assert.equal(await evaluate(`document.querySelector('.cv2-active-quest .cv2-primary').querySelector('svg')===null`),true);
assert.equal(await evaluate(`document.body.innerText.includes('Hasta 20')`),false);
await screenshot('first');
const attach=async kind=>{
 await evaluate(`(async()=>{
 const canvas=document.createElement('canvas');canvas.width=120;canvas.height=120;const ctx=canvas.getContext('2d');ctx.fillStyle='#f06a5f';ctx.fillRect(0,0,120,120);
 let blob;
 if(${JSON.stringify(kind)}==='photo')blob=await new Promise(r=>canvas.toBlob(r,'image/png'));
 else{const stream=canvas.captureStream(10);const recorder=new MediaRecorder(stream,{mimeType:'video/webm'});const chunks=[];blob=await new Promise(r=>{recorder.ondataavailable=e=>chunks.push(e.data);recorder.onstop=()=>r(new Blob(chunks,{type:'video/webm'}));recorder.start();setTimeout(()=>{ctx.fillStyle='white';ctx.fillRect(0,0,30,30);},100);setTimeout(()=>recorder.stop(),600);});stream.getTracks().forEach(t=>t.stop());}
 const input=document.querySelector('.cv2-capture input');const dt=new DataTransfer();dt.items.add(new File([blob],${JSON.stringify(kind)}==='photo'?'brindis.png':'mensaje.webm',{type:blob.type}));input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));
 })()`);
 await wait(`!!document.querySelector('.cv2-capture-preview') && !document.querySelector('.cv2-mobile-dialog .cv2-primary').disabled`);
};
for(let i=0;i<5;i++){
 await click('.cv2-active-quest .cv2-primary');await wait(`!!document.querySelector('.cv2-mobile-dialog .cv2-primary')`);
 assert.equal(await evaluate(`document.querySelector('.cv2-mobile-dialog .cv2-primary').disabled`),true);
 if(i===1){assert.equal(await evaluate(`document.querySelectorAll('.cv2-answer-options button').length`),4);await click('.cv2-answer-options button:first-child');assert.equal(await evaluate(`document.querySelector('.cv2-mobile-dialog .cv2-primary').textContent.trim()`),'Continuar');}else await attach(challenges[i].evidence_type);
 if(i===0){await screenshot('photo');rejectUpload=true;await click('.cv2-mobile-dialog .cv2-primary');await wait(`!!document.querySelector('.cv2-mobile-dialog .cv2-error')`);assert.equal(rows.filter(r=>r.table_id===tables[1].id&&r.status==='completed').length,0);}
 await click('.cv2-mobile-dialog .cv2-primary');await wait(`!!document.querySelector('.cv2-celebration-points')`);
 await click('.cv2-mobile-dialog .cv2-primary');await wait(`!document.querySelector('[role=dialog]')`);
 assert.equal(await evaluate(`(()=>{const items=[...document.querySelectorAll('.cv2-mission-path > div')];const done=items.findIndex(el=>el.classList.contains('cv2-done-quest'));return done<0||items.slice(done).every(el=>el.classList.contains('cv2-done-quest'));})()`),true);
 assert.equal(rows.filter(r=>r.table_id===tables[1].id&&r.status==='completed').length,i+1);
}
assert.equal(tables[1].total_points,95);assert.equal(evidence.length,4);assert.equal(uploads.length,4);
assert.equal(await evaluate(`document.querySelector('.cv2-bottom-nav').textContent.includes('Resultados')`),true);
assert.equal(await evaluate(`document.querySelector('.cv2-bottom-nav').textContent.includes('Mesas')`),false);
await click('.cv2-bottom-nav button:nth-child(3)');await wait(`document.querySelectorAll('.cv2-memory').length===5`);
assert.equal(await evaluate(`document.querySelector('.cv2-gallery-filter select').value`),'mine');
assert.equal(await evaluate(`Array.from(document.querySelectorAll('.cv2-gallery-filter option')).some(option=>option.textContent==='Todas las mesas')`),false);
await click('.cv2-memory-caption button');await wait(`!!document.querySelector('.cv2-media-dialog')`);await screenshot('gallery-modal');
await click('.cv2-media-dialog > button');await wait(`!document.querySelector('.cv2-media-dialog')`);await screenshot('gallery');
await send('Page.reload');await wait(`!!document.querySelector('.cv2-welcome')`);await click('.cv2-join-bar button');await wait(`document.querySelector('.cv2-player-points strong')?.textContent==='95'`);
await click('.cv2-session-footer button');await click('.cv2-pick:nth-child(3)');await click('.cv2-join-bar button');await wait(`document.querySelector('.cv2-player-strip h1')?.textContent==='Mesa 3'`);
assert.equal(await evaluate(`document.querySelector('.cv2-bottom-nav').textContent.includes('Resultados')`),false);
await click('.cv2-bottom-nav button:nth-child(2)');assert.match(await evaluate(`document.querySelector('.cv2-mobile-ranks').textContent`),/Mesa 2.*95/);
for(const width of [320,390,430,1440]){await send('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:width<500});for(let tab=1;tab<=2;tab++){await click(`.cv2-bottom-nav button:nth-child(${tab})`);assert.equal(await evaluate(`document.documentElement.scrollWidth>innerWidth`),false);}}
// A wrong answer is only revealed after submission and never adds points.
await click('.cv2-bottom-nav button:first-child');
await click('.cv2-active-quest .cv2-primary');await wait(`!!document.querySelector('.cv2-capture')`);await attach('photo');
await click('.cv2-mobile-dialog .cv2-primary');await wait(`!!document.querySelector('.cv2-celebration-points')`);await click('.cv2-mobile-dialog .cv2-primary');
await click('.cv2-active-quest .cv2-primary');await wait(`!!document.querySelector('.cv2-answer-options')`);
await click('.cv2-answer-options button:nth-child(2)');
assert.equal(await evaluate(`document.querySelector('.cv2-dialog-title').textContent`),'Pregunta de pareja');
assert.equal(await evaluate(`document.querySelector('.cv2-mobile-dialog .cv2-primary').disabled`),false);
await click('.cv2-mobile-dialog .cv2-primary');await wait(`!!document.querySelector('.cv2-celebration-points')`);
assert.equal(await evaluate(`document.querySelector('.cv2-dialog-title').textContent`),'Respuesta incorrecta');
assert.equal(tables[2].total_points,20);
assert.equal(rows.find(row=>row.table_id===tables[2].id&&row.challenge_id===challenges[1].id).status,'failed');
await screenshot('wrong-answer');
await click('.cv2-mobile-dialog .cv2-primary');await wait(`!document.querySelector('[role=dialog]')`);
// Rejecting requires confirmation, awards zero and unlocks the following challenge.
await click('.cv2-reject-button');await wait(`!!document.querySelector('.cv2-confirm-dialog')`);
assert.equal(rows.find(row=>row.table_id===tables[2].id&&row.challenge_id===challenges[2].id).status,'ready');
await click('.cv2-confirm-dialog .cv2-primary');await wait(`!document.querySelector('.cv2-confirm-dialog')`);
assert.equal(rows.find(row=>row.table_id===tables[2].id&&row.challenge_id===challenges[2].id).status,'failed');
assert.equal(tables[2].total_points,20);
for(const kind of ['photo','video']){
 await click('.cv2-active-quest .cv2-primary');await wait(`!!document.querySelector('.cv2-capture')`);await attach(kind);
 await click('.cv2-mobile-dialog .cv2-primary');await wait(`!!document.querySelector('.cv2-celebration-points')`);await click('.cv2-mobile-dialog .cv2-primary');await wait(`!document.querySelector('[role=dialog]')`);
}
assert.equal(await evaluate(`document.querySelector('.cv2-bottom-nav').textContent.includes('Resultados')`),true);
await click('.cv2-bottom-nav button:nth-child(3)');await wait(`document.querySelectorAll('.cv2-result-card').length===4`);
assert.equal(await evaluate(`document.body.innerText.includes('Mensaje secreto')`),false);
assert.deepEqual(exceptions,[]);console.log('PASS with mocked backend: identity, real image/video file decoding and preview, upload failure/retry, sequential completion, server score, reload persistence, shared table ranking, gallery only after finish, no demo text, 320–1440px, no JS exceptions.');socket.close();
