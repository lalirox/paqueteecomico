import { randomInt } from 'node:crypto';
import { QUESTIONS } from './questions.mjs';
export const DURATION_MS = 10 * 60 * 1000;
export const RETENTION_SECONDS = 30 * 24 * 60 * 60;
export function shuffle(values) {
  const a=[...values]; for(let i=a.length-1;i>0;i--){const j=randomInt(i+1);[a[i],a[j]]=[a[j],a[i]];} return a;
}
export function makeAttempt(token,name,now,contestId) {
  return {token,name,contestId,startedAt:now,expiresAt:now+DURATION_MS,
    order:shuffle(QUESTIONS.map(q=>q.id)), options:Object.fromEntries(QUESTIONS.map(q=>[q.id,shuffle([0,1,2,3])]))};
}
export function publicAttempt(a) {
  return {name:a.name,contestId:a.contestId,startedAt:a.startedAt,expiresAt:a.expiresAt,
    questions:a.order.map(id=>{const q=QUESTIONS.find(q=>q.id===id);return{id,text:q.text,options:a.options[id].map(i=>q.options[i])};})};
}
export function grade(a,answers,now) {
  if(!Array.isArray(answers)||answers.length!==QUESTIONS.length||answers.some(x=>x!==null&&(!Number.isInteger(x)||x<0||x>3))) throw new Error('INVALID_ANSWERS');
  const score=a.order.reduce((n,id,i)=>n+(answers[i]!==null && a.options[id][answers[i]]===QUESTIONS.find(q=>q.id===id).correct ? 1:0),0);
  return {name:a.name,score,total:QUESTIONS.length,elapsedMs:Math.min(DURATION_MS,Math.max(0,now-a.startedAt)),submittedAt:now};
}
export function rank(entries) {
  const rows=[...entries].sort((a,b)=>b.score-a.score||a.elapsedMs-b.elapsedMs||a.submittedAt-b.submittedAt);
  return rows.map((r,i)=>({...r,rank:i>0&&r.score===rows[i-1].score&&r.elapsedMs===rows[i-1].elapsedMs?rows.findIndex(x=>x.score===r.score&&x.elapsedMs===r.elapsedMs)+1:i+1}));
}
