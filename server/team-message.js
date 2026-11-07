const TTL=60*60*1000,COOLDOWN=60*1000;
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
function parseMessages(payload){if(payload.status&&payload.status!=='completed')throw new Error('incomplete');const text=payload.output_text||payload.output?.flatMap(item=>item.type==='message'?item.content||[]:[]).filter(item=>item.type==='output_text').map(item=>item.text).join('');const parsed=JSON.parse(text);if(!Array.isArray(parsed.messages)||parsed.messages.length<6||parsed.messages.length>12)throw new Error('format');const result=parsed.messages.map(s=>{if(typeof s!=='string')throw new Error('format');const message=s.replace(/[\u0000-\u001f]/g,' ').trim();if(message.length<8||message.length>100)throw new Error('length');return message});if(new Set(result).size!==result.length)throw new Error('duplicates');return result;}
export function createTeamMessageHandler({fetchImpl=fetch,now=Date.now}={}){
 const cache=new Map(),inflight=new Map(),failedUntil=new Map();
 return async function handle(request,env){
  if(request.method!=='GET')return json({code:'METHOD_NOT_ALLOWED'},405);
  const authorization=request.headers.get('Authorization');if(!authorization?.startsWith('Bearer '))return json({code:'LOGIN_REQUIRED'},401);
  const url=(env.SUPABASE_URL||env.VITE_SUPABASE_URL||'').replace(/\/$/,''),anon=env.SUPABASE_ANON_KEY||env.VITE_SUPABASE_ANON_KEY;
  if(!url||!anon)return json({code:'AUTH_NOT_CONFIGURED'},503);
  let role;
  try{
   const headers={apikey:anon,Authorization:authorization};const userResult=await fetchImpl(`${url}/auth/v1/user`,{headers,signal:AbortSignal.timeout(5000)});if(!userResult.ok)return json({code:'LOGIN_REQUIRED'},401);const user=await userResult.json();if(typeof user.id!=='string'||!/^[0-9a-f-]{36}$/i.test(user.id))return json({code:'LOGIN_REQUIRED'},401);
   const query=new URLSearchParams({id:`eq.${user.id}`,select:'role,status'});const profileResult=await fetchImpl(`${url}/rest/v1/profiles?${query}`,{headers,signal:AbortSignal.timeout(5000)});if(!profileResult.ok)return json({code:'ACCESS_DENIED'},403);const profiles=await profileResult.json();const p=profiles[0];if(p?.status!=='active'||!['admin','cs','advertiser'].includes(p.role))return json({code:'ACCESS_DENIED'},403);role=p.role;
  }catch{return json({code:'AUTH_UNAVAILABLE'},503)}
  if(!env.OPENAI_API_KEY)return json({code:'AI_NOT_CONFIGURED'},503);
  const model=env.OPENAI_MODEL||'gpt-4.1-mini',key=`${role}:${model}`,cached=cache.get(key);if(cached&&cached.expiresAt>now())return json({...cached,cached:true});
  if((failedUntil.get(key)||0)>now())return json({code:'AI_TEMPORARILY_UNAVAILABLE'},503);
  if(!inflight.has(key)){
   const job=(async()=>{
    const result=await fetchImpl('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${env.OPENAI_API_KEY}`,'Content-Type':'application/json'},signal:AbortSignal.timeout(15000),body:JSON.stringify({model,store:false,max_output_tokens:650,instructions:'Tulis 8 pesan penyemangat singkat dalam bahasa Indonesia untuk Adsy Team. Setiap pesan maksimal 65 karakter, hangat, natural, bervariasi, tanpa kutipan tokoh, markdown, emoji, klaim angka, janji hasil, atau menyalahkan tim. Jangan meminta atau menyebut informasi pribadi. Fokus kerja sama, proses, belajar, layanan pelanggan, dan konsistensi.',input:`Peran pembaca: ${role}. Buat kumpulan pesan baru untuk dashboard tim.`,text:{format:{type:'json_schema',name:'team_encouragement',strict:true,schema:{type:'object',properties:{messages:{type:'array',items:{type:'string'},minItems:8,maxItems:8}},required:['messages'],additionalProperties:false}}}})});
    if(!result.ok)throw new Error('upstream');const messages=parseMessages(await result.json()),generatedAt=now();const data={messages,source:'openai',generatedAt,expiresAt:generatedAt+TTL};cache.set(key,data);failedUntil.delete(key);return data;
   })().catch(error=>{failedUntil.set(key,now()+COOLDOWN);throw error}).finally(()=>inflight.delete(key));inflight.set(key,job);
  }
  try{return json({...await inflight.get(key),cached:false})}catch{return json({code:'AI_TEMPORARILY_UNAVAILABLE'},503)}
 };
}
