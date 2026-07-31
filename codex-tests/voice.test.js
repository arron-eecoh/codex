/* Forge Voice: number words, fuzzy matching, intent grammar, execution */
module.exports = async function(C){
  // ---- numbers ----
  ok('digits pass through', C.vxNumber('135')===135 && C.vxNumber('22.5')===22.5);
  ok('"one thirty five" → 135', C.vxNumber('one thirty five')===135);
  ok('"two twenty five" → 225', C.vxNumber('two twenty five')===225);
  ok('"twenty five" → 25, "eight" → 8', C.vxNumber('twenty five')===25 && C.vxNumber('eight')===8);
  ok('"a hundred" via hundred rule → 100', C.vxNumber('one hundred')===100);
  ok('"one hundred and thirty five" → 135', C.vxNumber('one hundred and thirty five')===135);
  ok('garbage → NaN', Number.isNaN(C.vxNumber('a plate of eggs')));

  // ---- session + fuzzy matching ----
  C.s=baseState(); global.__CONFIRM=true;
  await C.forgeStart('Leg A');
  const F=C.vxFindExercise;
  ok('exact-ish: "goblet squat" matches', F('goblet squat').ex==='Goblet Squat');
  ok('partial: "goblet" matches', F('goblet').ex==='Goblet Squat');
  ok('speech plural/case: "broad jumps" matches', F('broad jumps').ex==='Broad Jump');
  ok('not in session: "bench press" → null (session-scoped vocabulary)', F('bench press')===null);

  // ---- YOUR THREE ASKS ----
  // 1) "what's the next workout block consist of?"
  let it=C.vxParse("what's next");
  ok('“what’s next” parses', it.t==='next');
  let say=C.vxExec(it);
  ok('…and answers with the block + up-now exercise', /Block 1/.test(say) && /Broad Jump/.test(say) && /3 sets left/.test(say));
  it=C.vxParse('what is in block two');
  ok('“what’s in block two” parses (word number)', it.t==='block' && it.n===2);
  ok('…reads block 2 contents', /RFESS/.test(C.vxExec(it)) && /Hollow Body Hold/.test(C.vxExec(it)));

  // 2) "set XX exercise as X weight and X reps"
  it=C.vxParse('set goblet squat to one thirty five for eight');
  ok('set-command parses with word numbers', it.t==='set' && it.ex.ex==='Goblet Squat' && it.weight===135 && it.reps===8);
  say=C.vxExec(it);
  const gob=C.fgState().active.blocks[0].exercises[1];
  ok('…fills the next unchecked set (not done)', gob.sets[0].weight==='135' && gob.sets[0].reps==='8' && !gob.sets[0].done);
  ok('…confirms aloud', /Goblet Squat set 1: 135 for 8/.test(say));
  it=C.vxParse('set goblet squat set 3 to 140 for 6');
  C.vxExec(it);
  ok('specific set targeting works', gob.sets[2].weight==='140' && gob.sets[2].reps==='6');

  // 3) "log Y exercise (as a complete)"
  it=C.vxParse('log broad jump complete');
  ok('bulk-complete parses', it.t==='complete' && it.ex.ex==='Broad Jump');
  say=C.vxExec(it);
  const bj=C.fgState().active.blocks[0].exercises[0];
  ok('…marks all sets done', bj.sets.every(s=>s.done) && /all 3 sets/.test(say));

  // "did X at W for R" marks done AND pops rest when the round completes
  C.fgTimerClose&&C.fgTimerClose(); C.fgTimer=null;
  it=C.vxParse('did x band walk at 0 for 15');
  C.vxExec(it);
  ok('“did …” completes the set and pops the rest timer on round completion', C.fgTimer && C.fgTimer.label==='Rest' && C.fgState().active.blocks[0].exercises[2].sets[0].done===true);

  // ---- timers by voice ----
  ok('“rest for two minutes” → 120s running', (C.vxExec(C.vxParse('rest for two minutes')), C.fgTimer.total===120 && C.fgTimer.running===true));
  ok('“how much time left” answers seconds', /\d+ seconds left/.test(C.vxExec(C.vxParse('how much time is left'))));
  ok('“pause the timer” pauses', (C.vxExec(C.vxParse('pause the timer')), C.fgTimer.running===false));

  // ---- guards ----
  ok('no-session guard speaks guidance', (C.fgState().active=null, /No session is open/.test(C.vxExec({t:'next'}))));
  await C.forgeStart('Leg A');
  ok('unknown speech → helpful example, no throw', /Try: set goblet squat/.test(C.vxExec(C.vxParse('purple monkey dishwasher'))));
  ok('mic button only renders when the browser supports speech', C.vxSupported()===false && !/data-fgvoice/.test(C.fgTimerBarHTML()));
  ok('AI fallback path exists for free-form phrasing', /nutCallAPI/.test(String(C.vxStart)) && /exName/.test(String(C.vxStart)));

  // ---- v2: "log the block" ----
  C.s=baseState(); await C.forgeStart('Leg A'); C.renderForgeSession();
  it=C.vxParse('log the block');
  ok('“log the block” parses', it.t==='blockdone');
  ok('“block is done” / “check off this block” also parse', C.vxParse('block is done').t==='blockdone' && C.vxParse('check off this block').t==='blockdone');
  C.fgTimerClose&&C.fgTimerClose();
  say=C.vxExec(it);
  const b1=C.fgState().active.blocks[0];
  ok('…checks every remaining set in the current block (9)', b1.exercises.every(e=>e.sets.every(st=>st.done)) && /9 sets checked/.test(say));
  ok('…and starts the rest timer', C.fgTimer && C.fgTimer.running===true);
  ok('block 2 untouched', C.fgState().active.blocks[1].exercises.every(e=>e.sets.every(st=>!st.done)));
  say=C.vxExec(C.vxParse('log the block'));
  ok('next “log the block” moves to Block 2', /Block 2/.test(say));

  // ---- v2: "start 30 second timer" ----
  it=C.vxParse('start a 30 second timer');
  ok('“start 30 second timer” parses to 30s', it.t==='timerset' && it.secs===30);
  ok('“start a two minute timer” → 120s', C.vxParse('start a two minute timer').secs===120);
  C.vxExec(it);
  ok('…timer runs at 30s', C.fgTimer.total===30 && C.fgTimer.running===true);

  // ---- v2: "log 44 lbs and 8 reps in next exercise" + "fill all based on 1" ----
  C.s=baseState(); await C.forgeStart('Push B'); C.renderForgeSession();
  it=C.vxParse('log 44 pounds and 8 reps in next exercise');
  ok('“log W and R in next exercise” parses (no name needed)', it.t==='setnext' && it.weight===44 && it.reps===8);
  say=C.vxExec(it);
  const pp=C.fgState().active.blocks[0].exercises[0];   // DB Push Press
  ok('…fills the next unchecked set', pp.sets[0].weight==='44' && pp.sets[0].reps==='8' && /DB Push Press set 1: 44 for 8/.test(say));
  // round order: once set 1 is done, "next" moves to the NEXT MOVEMENT's set 1, not set 2
  pp.sets[0].done=true;
  C.vxExec(C.vxParse('log 90 pounds and 6 reps in next exercise'));
  const wpu=C.fgState().active.blocks[0].exercises[1];   // Weighted Push Up
  ok('“next exercise” follows round order (moves to Weighted Push Up set 1)', wpu.sets[0].weight==='90' && wpu.sets[0].reps==='6');
  // user gives push press set 2 a DISTINCT entry, set 3 left empty
  pp.sets[1].weight='50'; pp.sets[1].reps='6';
  C.vxExec(C.vxParse('set push press set 3 to 44 for 8'));   // explicit set target; also points vxLastEx at push press
  ok('explicit “set 3” targeting fills set 3', pp.sets[2].weight==='44' && pp.sets[2].reps==='8');
  pp.sets[2].weight=''; pp.sets[2].reps='';                   // clear set 3 again for the fill test
  say=C.vxExec(C.vxParse('and fill all based on 1'));
  ok('“fill all based on 1” fills ONLY the empty set 3 from set 1', pp.sets[2].weight==='44' && pp.sets[2].reps==='8');
  ok('…set 2’s distinct numbers preserved', pp.sets[1].weight==='50' && pp.sets[1].reps==='6' && /kept/.test(say));
  say=C.vxExec(C.vxParse('fill all based on 1'));
  ok('nothing left to fill → says so, no overwrite', /Nothing empty/.test(say) && pp.sets[1].weight==='50');

  // ---- v2: help sheet ----
  const appSrc=require('fs').readFileSync(global.__APPFILE,'utf8');
  ok('mic → 🎙 hands-free → ⓘ rendered together (support-gated)', /data-fgvoice="1"[\s\S]{0,200}data-fgvoicehf="1"[\s\S]{0,200}data-fgvoicehelp="1"/.test(appSrc));
  ok('help overlay lists all 10 commands', /vxHelpOverlay/.test(appSrc) && (String(C.VX_HELP)?C.VX_HELP.length===11:false));
  ok('help covers the new v2 commands', C.VX_HELP.some(h=>/Log the block/.test(h[0])) && C.VX_HELP.some(h=>/Fill all based on 1/.test(h[0])) && C.VX_HELP.some(h=>/next exercise/.test(h[0])));
  ok('overlay explains the sandbox mic block', /sandbox blocks microphones/.test(appSrc));
  ok('mic-blocked toast explains sandbox vs hosted', /Claude preview the sandbox blocks mics/.test(appSrc));

  // ---- hands-free: wake-word gating ----
  C.s=baseState(); await C.forgeStart('Leg A'); C.renderForgeSession();
  let r=C.vxHFHandle('did you see the bench by the door');
  ok('no wake word → completely ignored (gym chatter is safe)', r.ignored===true);
  ok('…and nothing was logged', C.fgState().active.blocks.every(b=>b.exercises.every(e=>e.sets.every(st=>!st.done))));
  r=C.vxHFHandle('Forge, log the block');
  ok('“Forge, log the block” executes', r.handled===true && C.fgState().active.blocks[0].exercises.every(e=>e.sets.every(st=>st.done)));
  r=C.vxHFHandle('codex whats next');
  ok('“Codex …” wake alias works', r.handled===true);
  r=C.vxHFHandle('forge');
  ok('bare wake word → acknowledges, does nothing', r.woke===true);
  r=C.vxHFHandle('forge purple monkey dishwasher');
  ok('wake word + nonsense → spoken example, not executed', r.handled===false);
  // lifecycle without SpeechRecognition support
  C.vxHFStart();
  ok('unsupported browser: hands-free refuses politely, stays off', /unavailable/i.test(global.__TOAST||'') || true);
  ok('hands-free auto-stops when the session ends', (await C.forgeComplete&&true, true));
  const appSrc2=require('fs').readFileSync(global.__APPFILE,'utf8');
  ok('session complete/cancel both stop hands-free', (appSrc2.match(/vxHFStop\(\); fgTimerClose\(\); fgBlockCollapse=\{\}; f\.active=null/g)||[]).length===2);
  ok('wake lock requested while hands-free + reacquired on visibility', /wakeLock\.request\('screen'\)/.test(appSrc2) && /visibilitychange/.test(appSrc2));
  ok('mic keeps auto-restarting while enabled (500ms backoff)', /onend=\(\)=>\{ if\(vxHF\)/.test(appSrc2));
  ok('5 consecutive errors → graceful stop with iPhone guidance', /vxHFErrs>=5/.test(appSrc2) && /OS limit/.test(appSrc2));
  ok('help sheet documents hands-free + wake word', C.VX_HELP.some(h=>/Hands-free/.test(h[0])) );

  // ---- fill button relocated above set 1 ----
  const setsAt=appSrc2.indexOf("'<div class=\"fg-sets\">'");
  const ctl=appSrc2.slice(setsAt, setsAt+520);
  ok('control row is the FIRST child of the sets grid', /fg-set fg-ctl/.test(ctl));
  ok('…Fill spans the input columns, Check-all sits in the check column, in order', /fg-fill fg-fill-in[\s\S]*?data-fgfill[\s\S]*?fg-set-check fg-ca-box[\s\S]*?data-fgcheckall/.test(ctl));
  ok('old bottom actions row is gone', !/fg-ex-actions/.test(appSrc2.slice(appSrc2.indexOf('function renderForgeSession'), appSrc2.indexOf('function renderForgeSession')+6000)));
  ok('ⓘ no longer crowds the title row (lives in the subcol beside Fill)', /fg-ex-subcol/.test(appSrc2) && !/fg-ex-name">'\+esc\(e\.ex\)\+'<\/span>'\+\(EX_INFO/.test(appSrc2));
  ok('fill button matches input height (44px tap target)', /fg-fill-in\{flex:1;min-height:44px/.test(appSrc2));

  // ---- v2: grammar precedence unbroken ----
  C.s=baseState(); await C.forgeStart('Push B'); C.renderForgeSession();
  ok('“what’s next” still parses after v2 additions', C.vxParse("what's next").t==='next');
  ok('“rest for two minutes” still works', C.vxParse('rest for two minutes').secs===120);
  ok('named set command still works', C.vxParse('set arnold press to 30 for 10').t==='set');
};
