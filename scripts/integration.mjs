import assert from 'node:assert/strict';
const env=process.env;
for(const key of ['CORE_API_KEY','INSIGHT_API_KEY','ORGANIZATION_ID'])if(!env[key])throw Error(key+' is required');
const core=env.CORE_URL||'http://localhost:3000';
const insight=env.INSIGHT_URL||'http://localhost:8000';
async function request(base,key,route,method='GET',body){
 const res=await fetch(base+route,{method,signal:AbortSignal.timeout(15000),headers:{Authorization:'Bearer '+key,'X-Organization-ID':env.ORGANIZATION_ID,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
 assert.ok(res.ok,'HTTP '+res.status+' '+route);return res.json();
}
const operation=await request(core,env.CORE_API_KEY,'/v1/operations','POST',{title:'Prueba integrada ficticia',sector:'services',amount_cents:12345});
await request(core,env.CORE_API_KEY,'/v1/operations/'+operation.id,'PATCH',{status:'in_progress',expected_revision:1});
await request(core,env.CORE_API_KEY,'/v1/operations/'+operation.id,'PATCH',{status:'completed',expected_revision:2});
let cursor='0';const all=[];
while(true){const batch=await request(core,env.CORE_API_KEY,'/v1/events?after='+cursor);all.push(...batch.items);if(!batch.items.length||batch.items.length<100)break;assert.notEqual(cursor,batch.next_cursor);cursor=batch.next_cursor;}
for(let offset=0;offset<all.length;offset+=100)await request(insight,env.INSIGHT_API_KEY,'/v1/events','POST',all.slice(offset,offset+100));
const before=await request(insight,env.INSIGHT_API_KEY,'/v1/metrics');
const own=all.filter(e=>e.data.id===operation.id);
assert.equal(own.length,3);
const replay=await request(insight,env.INSIGHT_API_KEY,'/v1/events','POST',own);
assert.equal(replay.duplicate_events,3);
const after=await request(insight,env.INSIGHT_API_KEY,'/v1/metrics');
assert.deepEqual(after,before);
let found;for(let offset=0;;offset+=1000){const rows=await request(insight,env.INSIGHT_API_KEY,'/v1/operations?limit=1000&offset='+offset);found=rows.find(r=>r.id===operation.id);if(found||rows.length<1000)break;}
assert.equal(found?.revision,3);assert.equal(found?.status,'completed');assert.equal(found?.amount_cents,12345);
console.log(JSON.stringify({result:'passed',operation_id:operation.id,metrics:after}));
