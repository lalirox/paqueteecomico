import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { makeAttempt, publicAttempt, grade, rank, DURATION_MS, RETENTION_SECONDS } from '../lib/contest.mjs';

const PREFIX='stratega:curso2027:v1';
const CURRENT=PREFIX+':current';
const key=(id,type)=>`${PREFIX}:${id}:${type}`;
const hash=s=>createHash('sha256').update(s).digest('hex');
const parse=s=>s?JSON.parse(s):null;
const fail=(status,message)=>Object.assign(new Error(message),{status});
const tokenOK=t=>typeof t==='string'&&/^[a-f0-9-]{36}$/.test(t);
const cleanName=s=>typeof s==='string'?s.normalize('NFC').trim().replace(/\s+/g,' '):'';

// Estas operaciones son atómicas: dos teléfonos no pueden consumir el mismo código,
// un envío repetido no cambia el resultado y el cierre no admite nuevos envíos.
export const START_SCRIPT=`
local cfg=redis.call('GET',KEYS[1])
if not cfg then return 'NO_CONTEST' end
local c=cjson.decode(cfg)
if c.id~=ARGV[1] or c.state~='open' then return 'CLOSED' end
local code=redis.call('HGET',KEYS[2],ARGV[2])
if not code then return 'BAD_CODE' end
if code~='available' and code~=ARGV[3] then return 'USED_CODE' end
local existing=redis.call('HGET',KEYS[3],ARGV[3])
if existing then return existing end
redis.call('HSET',KEYS[2],ARGV[2],ARGV[3])
redis.call('HSET',KEYS[3],ARGV[3],ARGV[4])
redis.call('EXPIRE',KEYS[2],ARGV[5]); redis.call('EXPIRE',KEYS[3],ARGV[5])
return ARGV[4]`;

export const SUBMIT_SCRIPT=`
local old=redis.call('HGET',KEYS[3],ARGV[2])
if old then return old end
local cfg=redis.call('GET',KEYS[1])
if not cfg then return 'CLOSED' end
local c=cjson.decode(cfg)
if c.id~=ARGV[1] or c.state~='open' then return 'CLOSED' end
local raw=redis.call('HGET',KEYS[2],ARGV[2])
if not raw then return 'NO_ATTEMPT' end
local a=cjson.decode(raw)
if tonumber(ARGV[3])>a.expiresAt+10000 then return 'EXPIRED' end
redis.call('HSET',KEYS[3],ARGV[2],ARGV[4]);redis.call('EXPIRE',KEYS[3],ARGV[5])
return ARGV[4]`;

const STATE_SCRIPT=`
local raw=redis.call('GET',KEYS[1]); if not raw then return 'NO_CONTEST' end
local c=cjson.decode(raw)
if c.id~=ARGV[1] then return 'CHANGED' end
if ARGV[2]=='open' and c.state~='pending' then return 'BAD_STATE' end
if ARGV[2]=='closed' and c.state~='open' then return 'BAD_STATE' end
c.state=ARGV[2];c.updatedAt=tonumber(ARGV[3]);redis.call('SET',KEYS[1],cjson.encode(c),'EX',ARGV[4]);return cjson.encode(c)`;

const CREATE_SCRIPT=`
local raw=redis.call('GET',KEYS[1]);if raw then local c=cjson.decode(raw);if c.state~='closed' then return 'ACTIVE' end end
redis.call('SET',KEYS[1],ARGV[1],'EX',ARGV[2]);return ARGV[1]`;

const CODES_SCRIPT=`
local raw=redis.call('GET',KEYS[1]);if not raw then return 'NO_CONTEST' end
local c=cjson.decode(raw);if c.id~=ARGV[1] or c.state=='closed' then return 'CLOSED' end
if redis.call('HLEN',KEYS[2])+tonumber(ARGV[2])>2000 then return 'LIMIT' end
for i=4,#ARGV do redis.call('HSETNX',KEYS[2],ARGV[i],'available') end
redis.call('EXPIRE',KEYS[2],ARGV[3]);return 'OK'`;

async function redis(command) {
  const url=process.env.UPSTASH_REDIS_REST_URL||process.env.KV_REST_API_URL;
  const token=process.env.UPSTASH_REDIS_REST_TOKEN||process.env.KV_REST_API_TOKEN;
  if(!url||!token)throw fail(503,'El concurso todavía no está disponible. El organizador está preparando la sesión.');
  const response=await fetch(url.replace(/\/$/,''),{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(command),signal:AbortSignal.timeout(8000)});
  if(!response.ok)throw fail(503,'No pudimos conectar con el concurso. Intenta nuevamente.');
  const body=await response.json();if(body.error)throw fail(503,'No pudimos guardar la información. Intenta nuevamente.');return body.result;
}

function requireAdmin(req) {
  const expected=process.env.CONTEST_ADMIN_TOKEN;
  if(!expected||expected.length<24)throw fail(503,'Configura CONTEST_ADMIN_TOKEN con al menos 24 caracteres en Vercel.');
  const supplied=(req.headers.authorization||'').replace(/^Bearer /,'');
  const a=Buffer.from(supplied),b=Buffer.from(expected);
  if(a.length!==b.length||!timingSafeEqual(a,b))throw fail(401,'La clave del organizador no es válida.');
}

async function payload(req) {
  if(!String(req.headers['content-type']||'').includes('application/json'))throw fail(415,'La solicitud debe ser JSON.');
  let raw=req.body;
  if(raw===undefined){let s='';for await(const part of req){s+=part;if(s.length>16384)throw fail(413,'Solicitud demasiado grande.');}raw=s;}
  if(typeof raw==='string'){if(raw.length>16384)throw fail(413,'Solicitud demasiado grande.');try{raw=JSON.parse(raw);}catch{throw fail(400,'Solicitud no válida.');}}
  if(!raw||typeof raw!=='object'||Array.isArray(raw)||JSON.stringify(raw).length>16384)throw fail(400,'Solicitud no válida.');return raw;
}

async function overview(admin=false) {
  const cfg=parse(await redis(['GET',CURRENT]));
  if(!cfg)return{contest:null,rows:[],winners:[],serverNow:Date.now()};
  const raw=await redis(['HVALS',key(cfg.id,'results')]);
  const rows=rank((raw||[]).map(parse));
  const result={contest:cfg,rows:admin?rows:rows.slice(0,10),total:rows.length,winners:cfg.state==='closed'?rows.filter(r=>r.rank===1):[],serverNow:Date.now()};
  if(admin){result.started=Number(await redis(['HLEN',key(cfg.id,'attempts')]));result.issued=Number(await redis(['HLEN',key(cfg.id,'codes')]))};return result;
}

export default async function handler(req,res) {
  res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('X-Content-Type-Options','nosniff');
  const send=(status,obj)=>{res.statusCode=status;res.end(JSON.stringify(obj));};
  try{
    const url=new URL(req.url,'https://local.invalid');const action=url.searchParams.get('action')||'status';
    if(req.method==='GET'&&action==='status')return send(200,await overview());
    if(req.method!=='POST'){res.setHeader('Allow','GET, POST');throw fail(405,'Método no permitido.');}
    const body=await payload(req);
    if(action.startsWith('admin-')) {
      requireAdmin(req);
      if(action==='admin-status')return send(200,await overview(true));
      if(action==='admin-create'){
        const prize=cleanName(body.prize)||'Tarjeta de regalo';if(prize.length>100)throw fail(400,'Describe el premio en hasta 100 caracteres.');
        const cfg={id:randomBytes(12).toString('hex'),state:'pending',prize,createdAt:Date.now(),durationMs:DURATION_MS,totalQuestions:10};
        const result=await redis(['EVAL',CREATE_SCRIPT,'1',CURRENT,JSON.stringify(cfg),String(RETENTION_SECONDS)]);
        if(result==='ACTIVE')throw fail(409,'Cierra el concurso actual antes de crear otra edición.');return send(200,{contest:parse(result)});
      }
      const cfg=parse(await redis(['GET',CURRENT]));if(!cfg)throw fail(409,'Primero crea el concurso.');
      if(body.contestId!==cfg.id)throw fail(409,'La edición cambió. Actualiza el panel.');
      if(action==='admin-codes'){
        const count=Number(body.count);if(!Number.isInteger(count)||count<1||count>200)throw fail(400,'Genera entre 1 y 200 códigos por lote.');
        const codes=Array.from({length:count},()=>'S'+randomBytes(5).toString('hex').slice(0,9).toUpperCase());
        const r=await redis(['EVAL',CODES_SCRIPT,'2',CURRENT,key(cfg.id,'codes'),cfg.id,String(count),String(RETENTION_SECONDS),...codes.map(hash)]);
        if(r!=='OK')throw fail(409,r==='LIMIT'?'Se alcanzó el máximo de 2,000 códigos por edición.':'El concurso ya no permite emitir códigos.');
        return send(200,{codes});
      }
      if(action==='admin-open'||action==='admin-close'){
        const r=await redis(['EVAL',STATE_SCRIPT,'1',CURRENT,cfg.id,action==='admin-open'?'open':'closed',String(Date.now()),String(RETENTION_SECONDS)]);
        if(!String(r).startsWith('{'))throw fail(409,'La edición ya cambió de estado. Actualiza el panel.');return send(200,await overview(true));
      }
      throw fail(404,'Acción no disponible.');
    }
    if(!tokenOK(body.token))throw fail(400,'El identificador del intento no es válido.');
    const cfg=parse(await redis(['GET',CURRENT]));if(!cfg)throw fail(409,'El organizador aún no ha creado el concurso.');
    if(body.contestId!==cfg.id)throw fail(409,'El concurso cambió. Actualiza la página para participar en la nueva edición.');
    if(action==='start') {
      const name=cleanName(body.name);const code=typeof body.code==='string'?body.code.trim().toUpperCase():'';
      if(name.length<3||name.length>60||/[<>\u0000-\u001f]/.test(name))throw fail(400,'Escribe tu nombre y apellido, entre 3 y 60 caracteres.');
      if(!/^S[A-F0-9]{9}$/.test(code))throw fail(400,'Escribe el código de 10 caracteres que te entregó el organizador.');
      if(body.acceptRules!==true)throw fail(400,'Acepta las reglas antes de comenzar.');
      const a=makeAttempt(body.token,name,Date.now(),cfg.id);
      const r=await redis(['EVAL',START_SCRIPT,'3',CURRENT,key(cfg.id,'codes'),key(cfg.id,'attempts'),cfg.id,hash(code),body.token,JSON.stringify(a),String(RETENTION_SECONDS)]);
      const errors={CLOSED:'El concurso no está abierto.',BAD_CODE:'El código no es válido para esta edición.',USED_CODE:'Este código ya fue utilizado. Continúa desde el dispositivo donde comenzaste.',NO_CONTEST:'El concurso todavía no está disponible.'};
      if(errors[r])throw fail(409,errors[r]);
      return send(200,{attempt:publicAttempt(parse(r)),serverNow:Date.now()});
    }
    const existing=parse(await redis(['HGET',key(cfg.id,'results'),body.token]));
    if(existing)return send(200,{result:existing,serverNow:Date.now()});
    const a=parse(await redis(['HGET',key(cfg.id,'attempts'),body.token]));if(!a)throw fail(404,'No encontramos este intento.');
    if(action==='resume')return send(200,{attempt:publicAttempt(a),state:cfg.state,serverNow:Date.now()});
    if(action==='submit'){
      let result;try{result=grade(a,body.answers,Date.now());}catch{throw fail(400,'Las respuestas no son válidas.');}
      const r=await redis(['EVAL',SUBMIT_SCRIPT,'3',CURRENT,key(cfg.id,'attempts'),key(cfg.id,'results'),cfg.id,body.token,String(Date.now()),JSON.stringify(result),String(RETENTION_SECONDS)]);
      if(r==='EXPIRED')throw fail(410,'El tiempo terminó y el envío llegó fuera del plazo. El intento no participa en la clasificación.');
      if(r==='CLOSED')throw fail(409,'El organizador cerró el concurso. Ya no se reciben respuestas.');
      if(r==='NO_ATTEMPT')throw fail(404,'No encontramos este intento.');
      return send(200,{result:parse(r),serverNow:Date.now()});
    }
    throw fail(404,'Acción no disponible.');
  }catch(error){send(error.status||503,{error:error.status?error.message:'El servicio no está disponible temporalmente. Intenta nuevamente.'});}
}
