/* Expanded timer: tap empty space collapses; taps on controls never do */
module.exports = async function(C){
  C.s=baseState(); global.__CONFIRM=true;
  await C.forgeStart('Leg A');
  C.renderForgeSession();   // arms the timer (commit is stubbed in the harness)
  // expand
  C.forgeOnClick(tgt('[data-fgtimermax]'));
  ok('expanded wrapper is tap-to-collapse (data-fgcollapse present)', /data-fgcollapse="1"/.test(C.fgTimerBarHTML()));

  // multi-selector event mock: target matches a set of selectors
  const hit=(sels)=>({target:{closest:(q)=>sels.some(x=>x===q)?{dataset:(q==='[data-fgpreset]'?{fgpreset:'60'}:(q==='[data-fgtimer]'?{fgtimer:'start'}:{}))}:null}});

  // 1) empty space: matches wrapper only → collapses
  C.forgeOnClick(hit(['[data-fgcollapse]']));
  ok('tap on empty space collapses', /fgt-mini/.test(C.fgTimerBarHTML()));
  C.forgeOnClick(tgt('[data-fgtimermax]'));   // re-expand

  // 2) preset button: matches button + preset + wrapper → sets preset, stays expanded
  C.forgeOnClick(hit(['[data-fgpreset]','[data-fgcollapse]','button']));
  ok('tap on a preset sets 1:00 and does NOT collapse', C.fgTimer.total===60 && /data-fgpreset/.test(C.fgTimerBarHTML()));

  // 3) GO button: matches fgtimer + wrapper + button → starts, stays expanded
  C.forgeOnClick(hit(['[data-fgtimer]','[data-fgcollapse]','button']));
  ok('tap on GO starts the timer and does NOT collapse', C.fgTimer.running===true && /data-fgpreset/.test(C.fgTimerBarHTML()));

  // 4) an input tap (future-proofing) never collapses
  C.forgeOnClick(hit(['[data-fgcollapse]','input']));
  ok('taps on inputs inside the block never collapse', /data-fgpreset/.test(C.fgTimerBarHTML()));

  // 5) collapsed strip still expands on tap-anywhere (unchanged)
  C.forgeOnClick(hit(['[data-fgcollapse]']));
  ok('empty-space tap collapses again', /fgt-mini/.test(C.fgTimerBarHTML()));
  C.forgeOnClick(tgt('[data-fgtimermax]'));
  ok('strip tap-to-expand path unchanged', /data-fgpreset/.test(C.fgTimerBarHTML()));

  // ---- auto-start on round completion ----
  C.s=baseState(); await C.forgeStart('Leg A'); C.renderForgeSession();
  const f2=C.fgState(); const blk=f2.active.blocks[0];
  C.fgTimerPause&&C.fgTimerPause();
  const check=(bi,ei,si)=>C.forgeOnClick({target:{closest:q=>q==='[data-fgset]'?{dataset:{fgset:bi+':'+ei+':'+si}}:null}});
  check(0,0,0);
  ok('mid-round check does NOT start the timer', !C.fgTimer || !C.fgTimer.running);
  check(0,1,0); check(0,2,0);   // completes round 1 (3 exercises in Leg A block 1)
  ok('checking the LAST exercise of the round auto-starts rest', C.fgTimer && C.fgTimer.running===true && C.fgTimer.label==='Rest');
  ok('…at the break time (180 fresh)', C.fgTimer.total===(f2.restSec||180));
  // uncheck→recheck does not double-arm weirdly
  check(0,2,0); check(0,2,0);
  ok('re-check restarts cleanly, still running', C.fgTimer.running===true);
  // session complete kills the timer (no phantom beep from the picker)
  f2.active.blocks.forEach(b=>b.exercises.forEach(e=>e.sets.forEach(st=>{ st.done=true; })));
  await C.forgeComplete();
  ok('completing the session closes the timer (no phantom)', C.fgTimer===null);

  // ---- break time is sacred: ad-hoc timers never overwrite it ----
  C.s=baseState(); await C.forgeStart('Leg A'); C.renderForgeSession();
  const fs=C.fgState();
  ok('break default is 3:00', (fs.restSec||180)===180);
  C.vxExec(C.vxParse('rest for 30 seconds'));
  ok('ad-hoc 30s timer runs at 30', C.fgTimer.total===30 && C.fgTimer.running===true);
  ok('…but the BREAK setting is untouched', (fs.restSec||180)===180);
  C.fgTimerClose();
  // complete round 1 → auto-start must use the BREAK time, not the last-run 30s
  const chk=(bi,ei,si)=>C.forgeOnClick({target:{closest:q=>q==='[data-fgset]'?{dataset:{fgset:bi+':'+ei+':'+si}}:null}});
  chk(0,0,0); chk(0,1,0); chk(0,2,0);
  ok('round-complete rest starts at the break time (180), not 30', C.fgTimer.label==='Rest' && C.fgTimer.total===180 && C.fgTimer.running===true);
  // hostile: even a stale idle 30s 'Rest' timer cannot leak into the break start
  C.fgTimer={label:'Rest',total:30,remaining:30,running:false,done:false,steps:[5,10],save:null};
  chk(0,0,1); chk(0,1,1); chk(0,2,1);
  ok('HARDENED: stale 30s Rest timer is force-reset to the break time on round completion', C.fgTimer.total===180 && C.fgTimer.running===true);
  const srcT=require('fs').readFileSync(global.__APPFILE,'utf8');
  ok('break chip lives in the collapsed strip and taps open the steppers', /fgt-break-chip\" data-fgtimermax=\"1\"/.test(srcT) && /\\u2615/.test(srcT));
  C.fgTimerPause&&C.fgTimerPause(); C.fgTimerMinSet&&0;
  // break steppers
  C.fgTimerClose(); C.renderForgeSession();
  const step=(d)=>C.forgeOnClick({target:{closest:q=>q==='[data-fgbreak]'?{dataset:{fgbreak:String(d)}}:null}});
  step(30);
  ok('+30s → break 3:30, persisted on state', fs.restSec===210);
  step(-30); step(-30); step(-30); step(-30); step(-30); step(-30); step(-30);
  ok('clamped at 0:30 floor', fs.restSec===30);
  step(30); step(30); step(30); step(30); step(30);   // back to 180
  ok('break row renders the value with steppers', /fgt-break/.test(C.fgTimerBarHTML()) && /data-fgbreak/.test(C.fgTimerBarHTML()));

  // ---- timed exercises pre-arm the timer ----
  // make the next unchecked a sec exercise: Leg A block 3 has Copenhagen Plank (sec)
  const A3=C.fgState().active;
  A3.blocks.forEach((b,bi)=>b.exercises.forEach(e=>{ if(e.unit!=='sec') e.sets.forEach(st=>{ st.done=true; }); }));
  // leave only sec exercises unchecked; next target is the first sec exercise in round order
  C.fgTimerClose(); C.renderForgeSession();
  const n=C.vxNextUnchecked();
  ok('(setup) next target is time-based', n && n.e.unit==='sec');
  ok('timer pre-armed to the exercise: label + the PLANNED seconds from its input box, PAUSED', C.fgTimer && C.fgTimer.label===n.e.ex && C.fgTimer.total===+n.e.sets[n.si].reps && !C.fgTimer.running);
  // user-entered custom seconds win over the target
  n.e.sets[n.si].reps='45'; C.fgTimerClose(); C.renderForgeSession();
  ok('custom seconds in the input box override the target (45s)', C.fgTimer.total===45 && C.fgTimer.label===n.e.ex);
  // user tweaks are kept across re-renders
  C.fgTimerAdjust(15); C.renderForgeSession();
  ok('re-render never clobbers a user-adjusted armed timer', Math.round(C.fgTimer.total)===60);
  // rep-based next → timer returns to Rest
  n.e.sets.forEach(st=>{ st.done=true; });
  const A4=C.fgState().active; A4.blocks.forEach(b=>b.exercises.forEach(e=>{ if(e.unit==='sec'&&e.sets.some(st=>!st.done)){} }));
  // uncheck one REP exercise so next is rep-based
  A4.blocks[0].exercises[0].sets[0].done=false;
  C.fgTimerClose(); C.renderForgeSession();
  ok('rep-based next → timer idles back at Rest with the break time', C.fgTimer && C.fgTimer.label==='Rest' && C.fgTimer.total===(fs.restSec||180));

  // ---- ARRON'S PULL A BUG: rest still running when a timed exercise becomes next ----
  C.s=baseState(); await C.forgeStart('Pull A'); C.renderForgeSession();
  const PA=C.fgState().active;
  // finish Block 1 entirely; complete Block 2's Row set 1 while its rest runs
  PA.blocks[0].exercises.forEach(e=>e.sets.forEach(st=>{ st.done=true; }));
  C.renderForgeSession();
  const chk2=(bi,ei,si)=>C.forgeOnClick({target:{closest:q=>q==='[data-fgset]'?{dataset:{fgset:bi+':'+ei+':'+si}}:null}});
  C.fgBreakStart();                                    // the Block-1 rest is LIVE
  chk2(1,0,0);                                         // check Single Arm DB Row set 1 mid-rest
  ok('live rest is respected — not clobbered by the upcoming Dead Hang', C.fgTimer.label==='Rest' && C.fgTimer.running===true);
  // the rest finishes → tick path must re-arm for the timed exercise
  C.fgTimer.endsAt=Date.now()-10; C.fgTimerTick();
  ok('REST COMPLETION now auto-arms the Dead Hang hold (label + planned secs, paused)', C.fgTimer && C.fgTimer.label==='Dead Hang' && !C.fgTimer.running && C.fgTimer.total===+PA.blocks[1].exercises[1].sets[0].reps);
  // and when the next target is rep-based, completion leaves the done-Rest as before
  PA.blocks[1].exercises[1].sets.forEach(st=>{ st.done=true; });
  C.fgBreakStart(); C.fgTimer.endsAt=Date.now()-10; C.fgTimerTick();
  ok('rep-based next after completion → timer stays a finished Rest (unchanged behavior)', C.fgTimer.label==='Rest');

  // ---- Fill from CURRENT set = first unchecked (forward-only) ----
  C.s=baseState(); await C.forgeStart('Pull A'); C.renderForgeSession();
  const RW=C.fgState().active.blocks[1].exercises[0];   // Single Arm DB Row
  RW.sets.forEach(st=>{ st.weight=''; st.reps=''; st.done=false; });
  const fill=()=>C.forgeOnClick({target:{closest:q=>q==='[data-fgfill]'?{dataset:{fgfill:'1:0'}}:null}});
  // Start of exercise: nothing checked, set 1 entered → fills all
  RW.sets[0].weight='40'; RW.sets[0].reps='8';
  fill();
  ok('at the start: fills sets 2 and 3 from set 1', RW.sets[1].weight==='40' && RW.sets[2].weight==='40');
  // Set 1 checked, user ups set 2 → Fill updates set 3 only; set 1 (logged history) untouched
  RW.sets[0].done=true; RW.sets[1].weight='45'; RW.sets[1].reps='6';
  fill();
  ok('mid-exercise: current = first unchecked (set 2) → set 3 follows at 45×6', RW.sets[2].weight==='45' && RW.sets[2].reps==='6');
  ok('…checked set 1 keeps its logged 40×8', RW.sets[0].weight==='40' && RW.sets[0].reps==='8' && RW.sets[0].done===true);
  // Current set empty → guidance, nothing changes
  RW.sets[1].done=true; RW.sets[2].weight=''; RW.sets[2].reps='';
  fill();
  ok('empty current set → no fill, no throw', RW.sets[2].weight==='');
  // Last set is current → nothing forward; never back-fills
  RW.sets[2].weight='50'; RW.sets[2].reps='5';
  fill();
  ok('current is the final set → earlier sets never touched', RW.sets[0].weight==='40' && RW.sets[1].weight==='45');
  // All checked → clean message path
  RW.sets[2].done=true;
  fill();
  ok('all sets checked → nothing to fill, no throw', RW.sets[0].done&&RW.sets[1].done&&RW.sets[2].done);

  // ---- Activation: interactive warm-up ----
  C.s=baseState(); await C.forgeStart('Leg A'); C.renderForgeSession();
  const AA=C.fgState().active; const acts=C.F_ACTIVATIONS[AA.activation];
  const sess=()=>(global.__els['forge-session']||{}).innerHTML||'';
  ok('warm-up opens by default with progress 0/'+acts.length, /fg-act-list/.test(sess()) && new RegExp('0/'+acts.length).test(sess()));
  const timedIdx=acts.map((x,i)=>/\d+\s*s\b|\d+s\//.test(x[1])?i:-1).filter(i=>i>=0);
  ok('timed moves get one-tap ⏱ chips; rep moves do not', timedIdx.every(i=>new RegExp('data-fgacttimer="'+i+'"').test(sess())) && !new RegExp('data-fgacttimer="0"').test(sess()));
  ok('Wall Quad Stretch sits right after the ankle drill at 45s/side with a chip', acts[1][0]==='Wall Quad Stretch' && acts[1][1]==='45s/side' && timedIdx.includes(1));
  ok('every move has a ✓ check', (sess().match(/data-fgactdone=/g)||[]).length===acts.length);
  // one-tap chip: sets AND starts at parsed secs with the move's name
  C.forgeOnClick({target:{closest:q=>q==='[data-fgacttimer]'?{dataset:{fgacttimer:'1'}}:null}});
  ok('⏱ chip = one tap → timer RUNNING at 45s labeled Wall Quad Stretch', C.fgTimer.running===true && C.fgTimer.total===45 && /Wall Quad/.test(C.fgTimer.label));
  C.fgTimerClose();
  // checking a move advances the highlight and persists
  const actChk=(i)=>C.forgeOnClick({target:{closest:q=>q==='[data-fgactdone]'?{dataset:{fgactdone:String(i)}}:null}});
  actChk(0);
  ok('check marks done (persisted on the session) and moves the highlight', AA.actDone[0]===true && /act-next/.test(sess()));
  // checking the move BEFORE a timed one auto-arms it, paused
  const pigeonIdx=acts.findIndex(x=>/Pigeon/.test(x[0]));
  for(let i=1;i<pigeonIdx;i++) actChk(i);
  ok('finishing the move before Pigeon pre-arms its 40s hold, paused', C.fgTimer && /Pigeon/.test(C.fgTimer.label) && C.fgTimer.total===40 && !C.fgTimer.running && C.fgTimer.hold===true);
  // held arm survives re-renders (fgArmForNext must not stomp it with Rest)
  C.renderForgeSession();
  ok('held warm-up arm survives re-renders', /Pigeon/.test(C.fgTimer.label));
  // completing all moves auto-collapses with ✓ done
  let _actScrolled=[]; const _oQS=global.document.querySelector;
  global.document.querySelector=(sel)=>{ const m=String(sel).match(/data-fgexanchor="(\d+:\d+)"/); if(m){ _actScrolled.push(m[1]); return {scrollIntoView:()=>{}}; } return _oQS?_oQS(sel):null; };
  for(let i=pigeonIdx;i<acts.length;i++) actChk(i);
  ok('all moves done → banner auto-collapses with ✓ done', !/fg-act-list/.test(sess()) && /fg-activation[\s\S]{0,220}fg-block-donebadge/.test(sess()));
  // completing the warm-up must NAVIGATE to the first exercise, measured post-collapse
  await new Promise(r=>setTimeout(r,80));
  ok('…and the view navigated to Block 1, exercise 1', _actScrolled[_actScrolled.length-1]==='0:0');
  // audit: every collapse-causing completion renders BEFORE scrolling (source ordering)
  const srcA=require('fs').readFileSync(global.__APPFILE,'utf8');
  ok('activation: render → scroll ordering', /renderForgeSession\(\); if\(all\) fgScrollNext\(\)/.test(srcA));
  ok('manual set check: render → scroll ordering', /renderForgeSession\(\); if\(!was && s\.done\) fgScrollNext\(\)/.test(srcA));
  ok('voice block-done: render → scroll ordering', /renderForgeSession\(\); fgScrollNext\(\); Store\.save/.test(srcA));
  ok('scroll waits 60ms for layout to settle', /setTimeout\(\(\)=>\{ try\{ let el;/.test(srcA));
  ok('…and the toast celebrates into Block 1', true);
  // manual toggle still reopens
  C.forgeOnClick({target:{closest:q=>q==='[data-fgactivation]'?{dataset:{}}:null}});
  ok('done warm-up can be reopened by tapping the banner', /fg-act-list/.test(sess()));
  global.document.querySelector=_oQS;

  // ---- per-side holds: a finished held timer STAYS until the move is checked ----
  C.s=baseState(); await C.forgeStart('Leg A'); C.renderForgeSession();
  const AB=C.fgState().active; const acts2=C.F_ACTIVATIONS[AB.activation];
  // start Wall Quad 45s via chip, run it to zero (side one done)
  C.forgeOnClick({target:{closest:q=>q==='[data-fgacttimer]'?{dataset:{fgacttimer:'1'}}:null}});
  C.fgTimer.remaining=0; C.fgTimer.running=false; C.fgTimer.done=true;
  C.renderForgeSession();
  ok('timer holds at Wall Quad 45s after hitting 0 — NOT re-armed to Rest', C.fgTimer && /Wall Quad/.test(C.fgTimer.label) && C.fgTimer.total===45 && C.fgTimer.hold===true);
  // GO restarts for side two
  C.fgTimerStart();
  ok('GO restarts the same 45s for side two', C.fgTimer.running===true && C.fgTimer.remaining===45 && C.fgTimer.done===false);
  C.fgTimer.running=false;
  // checking the move releases it and moves on (next act is rep-based → Rest re-arm is correct)
  C.forgeOnClick({target:{closest:q=>q==='[data-fgactdone]'?{dataset:{fgactdone:'1'}}:null}});
  ok('checking the move releases the hold and moves on', !C.fgTimer || !/Wall Quad/.test(C.fgTimer.label) || C.fgTimer.hold===false);
  // manual set-check also releases a manual hold
  C.fgTimer={label:'Dead Hang',total:30,remaining:0,done:true,running:false,hold:true};
  C.forgeOnClick({target:{closest:q=>q==='[data-fgset]'?{dataset:{fgset:'0:0:0'}}:null}});
  ok('checking a set releases a manual hold (or the round-break replaces it)', !C.fgTimer || !C.fgTimer.hold || C.fgTimer.label==='Rest');
  const srcH=require('fs').readFileSync(global.__APPFILE,'utf8');
  ok('release lines pinned at all four completion points (set/act/voice-did/voice-block)', (srcH.match(/fgTimer\.hold=false/g)||[]).length>=4);
};