import {readFile,writeFile,rename} from 'node:fs/promises';
import path from 'node:path';
const env=process.env;
for(const name of ['CORE_API_KEY','INSIGHT_API_KEY','ORGANIZATION_ID'])if(!env[name])throw Error(name+' is required');
const source=env.CORE_URL||'http://localhost:3000';
const target=env.INSIGHT_URL||'http://localhost:8000';
const org=env.ORGANIZATION_ID;
const checkpoint=path.resolve(env.CHECKPOINT_FILE||'.sync-checkpoint.json');
let cursor='0';
try{const saved=JSON.parse(await readFile(checkpoint,'utf8'));if(saved.source!==source||saved.target!==target||saved.organization_id!==org)throw Error('Checkpoint belongs to a different source, target or organization');cursor=saved.cursor;}catch(e){if(e.code!=='ENOENT')throw e;}
async function request(url,key,options={}){
 for(let attempt=0;attempt<3;attempt++){
  try{const res=await fetch(url,{...options,signal:AbortSignal.timeout(15000),headers:{'Content-Type':'application/json',Authorization:'Bearer '+key,'X-Organization-ID':org}});
   if(!res.ok){const error=new Error('HTTP '+res.status+' from '+new URL(url).origin);if(res.status<500&&res.status!==429)error.permanent=true;throw error;}
   return await res.json();
  }catch(e){if(e.permanent||attempt===2)throw e;await new Promise(r=>setTimeout(r,250*2**attempt));}
 }
}
let total=0;
for(let page=0;page<10000;page++){
 const batch=await request(source+'/v1/events?after='+encodeURIComponent(cursor),env.CORE_API_KEY);
 if(!Array.isArray(batch.items)||!/^\d+$/.test(batch.next_cursor))throw Error('Invalid source response');
 if(!batch.items.length)break;
 if(BigInt(batch.next_cursor)<=BigInt(cursor))throw Error('Source cursor did not advance');
 await request(target+'/v1/events',env.INSIGHT_API_KEY,{method:'POST',body:JSON.stringify(batch.items)});
 // Persist only after the target transaction succeeds. A crash before this write causes safe replay.
 cursor=batch.next_cursor;
 await writeFile(checkpoint+'.tmp',JSON.stringify({source,target,organization_id:org,cursor}));
 await rename(checkpoint+'.tmp',checkpoint);
 total+=batch.items.length;
 if(batch.items.length<100)break;
}
console.log(JSON.stringify({delivered:total,cursor}));
