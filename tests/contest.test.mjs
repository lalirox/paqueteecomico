import test from 'node:test';
import assert from 'node:assert/strict';
import {makeAttempt,publicAttempt,grade,rank,DURATION_MS} from '../lib/contest.mjs';
import {QUESTIONS} from '../lib/questions.mjs';

test('Las preguntas públicas no incluyen la clave; el orden aleatorio conserva la calificación',()=>{
  const a=makeAttempt('token','Ana López',1000,'edicion');
  const view=publicAttempt(a);
  assert.equal(view.questions.length,10);
  assert.equal(new Set(view.questions.map(q=>q.id)).size,10);
  assert.ok(view.questions.every(q=>!('correct' in q)&&q.options.length===4));
  const correct=a.order.map(id=>a.options[id].indexOf(QUESTIONS.find(q=>q.id===id).correct));
  assert.equal(grade(a,correct,3000).score,10);
  assert.equal(grade(a,correct.map(i=>(i+1)%4),3000).score,0);
  assert.equal(grade(a,Array(10).fill(null),3000).score,0);
  assert.throws(()=>grade(a,Array(10).fill(99),3000));
  assert.throws(()=>grade(a,correct.slice(0,9),3000));
  assert.equal(a.expiresAt,1000+DURATION_MS);
});
test('El ganador se decide por aciertos, luego por tiempo; un empate exacto no se oculta',()=>{
  const r=rank([{name:'Ana',score:9,elapsedMs:5000,submittedAt:1},{name:'Luis',score:10,elapsedMs:15000,submittedAt:2},{name:'Eva',score:10,elapsedMs:10000,submittedAt:3},{name:'José',score:10,elapsedMs:10000,submittedAt:4}]);
  assert.deepEqual(r.map(x=>x.name),['Eva','José','Luis','Ana']);
  assert.deepEqual(r.map(x=>x.rank),[1,1,3,4]);
});
test('Los tres casos numéricos se resuelven con los supuestos expresos de cada pregunta',()=>{
  assert.equal((1000000-Math.min(1000000*.5,1000000))*.3,150000);
  assert.equal(Math.round((100000*.07-(100000*.16-4000))*100)/100,-5000);
  assert.equal(Math.round((100000*.07-(100000*.16-12000))*100)/100,3000);
  assert.equal(QUESTIONS.find(q=>q.id==='perdidas').options[1],'$150,000.');
  assert.equal(QUESTIONS.find(q=>q.id==='iva-a').correct,1);
  assert.equal(QUESTIONS.find(q=>q.id==='iva-b').correct,0);
});
