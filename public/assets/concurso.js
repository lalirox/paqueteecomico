(()=>{
  'use strict';
  const root=document.getElementById('concurso');if(!root)return;
  const $=id=>document.getElementById(id);
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt=ms=>(ms/1000).toFixed(3)+' s';
  const storageKey='stratega-contest-attempt-v1';
  let cfg=null,session=null,attempt=null,current=0,answers=[],offset=0,timer=null,sending=false,visible=false;
  try{session=JSON.parse(localStorage.getItem(storageKey)||'null');}catch{}
  const save=()=>{session={...session,answers,current};try{localStorage.setItem(storageKey,JSON.stringify(session));}catch{}};
  async function api(action,data){
    let response;try{response=await fetch('/api/concurso?action='+action,{method:data?'POST':'GET',headers:data?{'Content-Type':'application/json'}:{},body:data?JSON.stringify(data):undefined,cache:'no-store'});}catch{throw new Error('No hay conexión. Revisa tu internet e intenta nuevamente.');}
    let body;try{body=await response.json();}catch{throw new Error('El concurso todavía no está disponible. El organizador está preparando la sesión.');}
    if(!response.ok)throw new Error(body.error||'No pudimos procesar la solicitud.');return body;
  }
  function renderBoard(data){
    $('contestBoardLabel').textContent=data.contest?.state==='closed'?'Clasificación final':'Clasificación provisional';
    $('contestBoardBody').innerHTML=data.rows?.length?data.rows.map(r=>`<tr><td>${r.rank}</td><td>${esc(r.name)}</td><td>${r.score} / ${r.total}</td><td>${fmt(r.elapsedMs)}</td></tr>`).join(''):'<tr><td colspan="4">Todavía no hay resultados enviados.</td></tr>';
    $('contestBoardNote').textContent=data.total?`${data.total} participantes con resultado · Se muestran los primeros diez.`:'Los resultados aparecerán cuando se envíen las respuestas.';
    const winners=data.winners||[];$('contestWinner').hidden=!winners.length;
    if(winners.length)$('contestWinner').innerHTML=`<span>${winners.length===1?'GANADOR DEL CONCURSO':'EMPATE EN EL PRIMER LUGAR'}</span><strong>${winners.map(w=>esc(w.name)).join(' · ')}</strong><p>${winners.length===1?esc(data.contest.prize)+' · El organizador verificará la participación y entregará el premio.':'El organizador realizará una pregunta adicional para resolver el empate.'}</p>`;
  }
  async function status(resume=false){
    try{
      const d=await api('status');cfg=d.contest;renderBoard(d);
      $('contestPrize').textContent=cfg?.prize||'Tarjeta de regalo';
      $('contestStatus').textContent=!cfg?'El organizador está preparando el concurso.':cfg.state==='open'?'Concurso abierto · Ya puedes participar':cfg.state==='closed'?'Concurso cerrado · Consulta los resultados':'El concurso comenzará cuando lo indique el organizador.';
      if(!attempt){$('contestEntry').hidden=cfg?.state!=='open'||!$('contestResult').hidden;$('contestStart').disabled=cfg?.state!=='open';}
      if(resume&&session?.contestId===cfg?.id&&session?.token){
        const r=await api('resume',{token:session.token,contestId:cfg.id});
        if(r.result){showResult(r.result);return;}
        if(r.attempt&&r.state==='open'){
          answers=Array.isArray(session.answers)&&session.answers.length===10?session.answers:Array(10).fill(null);
          current=Math.min(9,Math.max(0,session.current||0));activate(r);return;
        }
      }
      if(session&&cfg&&session.contestId!==cfg.id){session=null;answers=[];current=0;try{localStorage.removeItem(storageKey);}catch{}}
    }catch(error){$('contestStatus').textContent=error.message;$('contestStart').disabled=true;}
  }
  function activate(data){attempt=data.attempt;offset=data.serverNow-Date.now();$('contestEntry').hidden=true;$('contestResult').hidden=true;$('contestQuiz').hidden=false;renderQuestion();clearInterval(timer);timer=setInterval(tick,500);tick();}
  function renderQuestion(){
    const q=attempt.questions[current];
    $('contestQuestionCount').textContent=`Pregunta ${current+1} de ${attempt.questions.length}`;
    $('contestProgress').style.width=((current+1)/attempt.questions.length*100)+'%';
    $('contestQuestion').innerHTML=`<legend tabindex="-1" id="contestQuestionTitle">${esc(q.text)}</legend>${q.options.map((o,i)=>`<label class="contest-option"><input type="radio" name="contestAnswer" value="${i}" ${answers[current]===i?'checked':''}><span>${esc(o)}</span></label>`).join('')}`;
    $('contestPrevious').disabled=current===0;$('contestNext').textContent=current===9?'Enviar respuestas':'Siguiente';$('contestQuizError').textContent='';
  }
  function tick(){
    if(!attempt)return;const left=Math.max(0,attempt.expiresAt-(Date.now()+offset));
    const seconds=Math.ceil(left/1000);$('contestClock').textContent=String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');
    if(left<=0){clearInterval(timer);$('contestClock').textContent='00:00';submit(true);}
  }
  function showResult(r){clearInterval(timer);attempt=null;$('contestEntry').hidden=true;$('contestQuiz').hidden=true;$('contestResult').hidden=false;$('contestScore').innerHTML=`${r.score}<small> / ${r.total}</small>`;$('contestResultName').textContent=`${r.name}, tus respuestas ya están registradas.`;$('contestResultTime').textContent=`Tiempo registrado: ${fmt(r.elapsedMs)}. El ganador se confirma al cerrar el concurso.`;status();}
  async function submit(expired=false){
    if(sending||!attempt)return;if(!expired&&answers.some(a=>a===null)){current=answers.indexOf(null);renderQuestion();$('contestQuizError').textContent='Responde todas las preguntas antes de enviar.';return;}
    sending=true;$('contestNext').disabled=true;$('contestPrevious').disabled=true;$('contestQuizError').textContent='Guardando tus respuestas…';
    try{const r=await api('submit',{token:session.token,contestId:session.contestId,answers});showResult(r.result);}
    catch(error){$('contestQuizError').textContent=error.message;$('contestNext').textContent='Reintentar envío';$('contestNext').dataset.retry='true';}
    finally{sending=false;$('contestNext').disabled=false;}
  }
  $('contestEntry').addEventListener('submit',async e=>{
    e.preventDefault();if(!cfg)return;$('contestStart').disabled=true;$('contestEntryError').textContent='';
    try{
      const token=session?.contestId===cfg.id?session.token:crypto.randomUUID();
      session={token,contestId:cfg.id};answers=Array(10).fill(null);current=0;save();
      const d=await api('start',{token,contestId:cfg.id,name:$('contestName').value,code:$('contestCode').value,acceptRules:$('contestConsent').checked});activate(d);
    }catch(error){$('contestEntryError').textContent=error.message;}finally{$('contestStart').disabled=false;}
  });
  $('contestQuestion').addEventListener('change',e=>{if(e.target.name==='contestAnswer'){answers[current]=Number(e.target.value);save();}});
  $('contestPrevious').addEventListener('click',()=>{if(current>0){current--;save();renderQuestion();$('contestQuestionTitle').focus();}});
  $('contestNext').addEventListener('click',()=>{if($('contestNext').dataset.retry==='true'){submit(true);return;}if(current===9){submit();return;}if(answers[current]===null){$('contestQuizError').textContent='Elige una respuesta para continuar.';return;}current++;save();renderQuestion();$('contestQuestionTitle').focus();});
  $('contestRefresh').addEventListener('click',()=>status());
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){if(attempt)tick();else if(visible)status();}});
  if('IntersectionObserver'in window){new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(visible)status(!attempt&&$('contestResult').hidden);},{rootMargin:'200px'}).observe(root);}else{visible=true;status(true);}
  setInterval(()=>{if(visible&&!document.hidden&&!attempt)status();},20000);
})();
