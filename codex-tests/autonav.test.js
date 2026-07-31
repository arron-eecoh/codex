/* Auto-navigation: up-next highlight + scroll-to-next across all three cases */
module.exports = async function(C){
  C.s=baseState(); global.__CONFIRM=true;
  await C.forgeStart('Leg A'); C.renderForgeSession();
  const html=()=>(global.__els['forge-session']||{}).innerHTML||'';
  const check=(bi,ei,si)=>C.forgeOnClick({target:{closest:q=>q==='[data-fgset]'?{dataset:{fgset:bi+':'+ei+':'+si}}:null}});
  const nextAnchorOf=h=>{ const m=h.match(/fg-ex up-next" data-fgexanchor="(\d+:\d+)"/); return m?m[1]:null; };

  // capture scroll targets
  let scrolled=[]; const origQS=global.document.querySelector;
  global.document.querySelector=(sel)=>{ const m=String(sel).match(/data-fgexanchor="(\d+:\d+)"/); if(m){ scrolled.push(m[1]); return {scrollIntoView:()=>{}}; } return origQS?origQS(sel):null; };
  const flush=()=>new Promise(r=>setTimeout(r,80));

  // fresh session: up-next = block 0, exercise 0
  ok('up-next starts on the first exercise', nextAnchorOf(html())==='0:0');

  // CASE 1: exercise 1 → exercise 2 within the round
  check(0,0,0); await flush();
  ok('check ex1 set1 → highlight moves to ex2 (same round)', nextAnchorOf(html())==='0:1');
  ok('…and the view scrolled to ex2', scrolled[scrolled.length-1]==='0:1');

  // CASE 2: last exercise of the round → wraps back UP to the first (set 2)
  check(0,1,0); await flush();
  scrolled=[];
  check(0,2,0); await flush();     // completes round 1 (also auto-starts rest)
  ok('check last ex of the round → highlight wraps to ex1 set 2', nextAnchorOf(html())==='0:0');
  ok('…scrolled back up to ex1', scrolled[scrolled.length-1]==='0:0');
  ok('…and the round-complete rest timer still auto-started', C.fgTimer && C.fgTimer.running===true);

  // CASE 3: finishing the whole block → jumps to the next block
  const b0=C.fgState().active.blocks[0];
  b0.exercises.forEach(e=>e.sets.forEach(st=>{ st.done=true; }));
  b0.exercises[2].sets[2].done=false;         // leave exactly one set
  C.renderForgeSession(); scrolled=[];
  check(0,2,2); await flush();
  ok('checking the block’s final set → highlight jumps to Block 2', nextAnchorOf(html())==='1:0');
  ok('…scrolled to Block 2’s first exercise', scrolled[scrolled.length-1]==='1:0');

  // UNCHECK never scrolls
  scrolled=[];
  check(1,0,0); await flush(); scrolled=[];
  check(1,0,0); await flush();                // toggles it back OFF
  ok('unchecking never scrolls', scrolled.length===0);

  // voice "did" and "log the block" also navigate
  scrolled=[];
  C.vxExec(C.vxParse('did rfess at 40 for 8')); await flush();
  ok('voice “did …” scrolls to the next target', scrolled.length>0);
  scrolled=[];
  C.vxExec(C.vxParse('log the block')); await flush();
  ok('voice “log the block” scrolls to the next block', scrolled.length>0);

  // everything done → no highlight, no scroll, no throw
  const f=C.fgState(); f.active.blocks.forEach(b=>b.exercises.forEach(e=>e.sets.forEach(st=>{ st.done=true; })));
  C.renderForgeSession(); scrolled=[];
  ok('all done → no up-next highlight', nextAnchorOf(html())===null);
  C.fgScrollNext(); await flush();
  ok('scroll helper is a no-op when nothing is left', scrolled.length===0);

  // ---- finish flow: last check of the whole workout ----
  C.s=baseState(); await C.forgeStart('Leg A'); C.renderForgeSession();
  const A=C.fgState().active;
  A.blocks.forEach(b=>b.exercises.forEach(e=>e.sets.forEach(st=>{ st.done=true; })));
  const last=A.blocks[2].exercises[2].sets[2]; last.done=false;
  C.renderForgeSession();
  // give the rating/complete anchors capture spies
  let hits=[];
  global.__els['fgRateRow']={scrollIntoView:()=>hits.push('rate')};
  global.__els['fgComplete']={scrollIntoView:()=>hits.push('complete')};
  // simulate a running rest timer left over from the previous round
  C.vxExec(C.vxParse('rest for one minute'));
  ok('(setup) timer running before the final check', C.fgTimer && C.fgTimer.running===true);
  check(2,2,2); await flush();
  ok('final check does NOT start a rest timer — it closes the leftover one', C.fgTimer===null);
  ok('…and navigates to the feel sliders', hits[hits.length-1]==='rate');
  // sliding a feel slider navigates on to Complete Session
  hits=[];
  C.forgeOnInput({target:{dataset:{fgfeel:'phys'},value:'4'}});
  ok('body slider records physical effort', C.fgState().active.feelPhys===4);
  C.forgeOnChange({target:{dataset:{fgfeel:'phys'},value:'4'}});
  await flush();
  ok('…and slider release navigates to the Complete Session button', hits[hits.length-1]==='complete');
  // tap-in-place (no drag) commits the slider's current value via the click path
  C.forgeOnClick({target:{closest:q=>q==='[data-fgfeel]'?{dataset:{fgfeel:'mind'},value:'2'}:null}});
  ok('tapping a slider without dragging still commits its value', C.fgState().active.feelMind===2);
  // completing stores both feels + mirrors rating=physical for old clients/history
  await C.forgeComplete();
  const rec=C.fgState().sessions[C.fgState().sessions.length-1];
  ok('completed session stores feelPhys/feelMind and legacy rating mirror', rec.feelPhys===4 && rec.feelMind===2 && rec.rating===4);
  // mid-session rating never scrolls
  C.s=baseState(); await C.forgeStart('Leg A'); C.renderForgeSession();
  hits=[]; global.__els['fgRateRow']={scrollIntoView:()=>hits.push('rate')}; global.__els['fgComplete']={scrollIntoView:()=>hits.push('complete')};
  C.forgeOnInput({target:{dataset:{fgfeel:'mind'},value:'3'}});
  C.forgeOnChange({target:{dataset:{fgfeel:'mind'},value:'3'}});
  await flush();
  ok('rating mid-workout does not yank the view', hits.length===0);
  // voice: "log the block" on the FINAL block ends the workout, no timer
  const A2=C.fgState().active;
  A2.blocks[0].exercises.forEach(e=>e.sets.forEach(st=>{ st.done=true; }));
  A2.blocks[1].exercises.forEach(e=>e.sets.forEach(st=>{ st.done=true; }));
  C.fgTimerClose&&C.fgTimerClose();
  const sayF=C.vxExec(C.vxParse('log the block'));
  ok('voice-finishing the last block: no rest timer, invites the rating', C.fgTimer===null && /whole session/.test(sayF) && /how it felt/.test(sayF));

  // ---- collapsible blocks ----
  C.s=baseState(); await C.forgeStart('Leg A'); C.renderForgeSession();
  const B=C.fgState().active.blocks;
  const tapBlock=(bi)=>C.forgeOnClick({target:{closest:q=>q==='[data-fgblocktoggle]'?{dataset:{fgblocktoggle:String(bi)}}:null}});
  ok('all blocks start expanded (exercises rendered)', /data-fgexanchor="0:0"/.test(html()) && /data-fgexanchor="2:0"/.test(html()));
  // complete block 1 → auto-collapses with ✓ done badge
  B[0].exercises.forEach(e=>e.sets.forEach(st=>{ st.done=true; }));
  C.renderForgeSession();
  ok('completed block auto-collapses (exercises hidden, ▸ + ✓ done shown)', !/data-fgexanchor="0:0"/.test(html()) && /fg-block-donebadge/.test(html()) && /▸/.test(html()));
  ok('other blocks stay expanded', /data-fgexanchor="1:0"/.test(html()));
  // manual toggle: reopen the done block
  tapBlock(0);
  ok('tapping a collapsed block header expands it', /data-fgexanchor="0:0"/.test(html()));
  tapBlock(0);
  ok('tapping again re-collapses', !/data-fgexanchor="0:0"/.test(html()));
  // manual collapse of an ACTIVE block
  tapBlock(1);
  ok('any block can be collapsed anytime, done or not', !/data-fgexanchor="1:0"/.test(html()));
  // scroll auto-expands a manually collapsed target block
  scrolled=[];
  C.fgScrollNext(); await flush();
  ok('navigating to a target inside a collapsed block reopens it', /data-fgexanchor="1:0"/.test(html()) && scrolled[scrolled.length-1]==='1:0');
  // overrides reset when the session ends
  C.fgState().active.blocks.forEach(b=>b.exercises.forEach(e=>e.sets.forEach(st=>{ st.done=true; })));
  await C.forgeComplete();
  await C.forgeStart('Leg A'); C.renderForgeSession();
  ok('fresh session starts with clean collapse state', /data-fgexanchor="0:0"/.test(html()));

  // ---- resume position + tightened card (source-level) ----
  const src=require('fs').readFileSync(global.__APPFILE,'utf8');
  ok('returning to the training TAB mid-session scrolls to the live exercise', /dataset\.tab==='training'[\s\S]{0,200}fgScrollNext\(\)/.test(src));
  ok('switching trainSub back to Forge mid-session scrolls too', /trainview==='forge'[\s\S]{0,120}fgScrollNext\(\)/.test(src));
  ok('ⓘ + note live in a vertical block BESIDE Fill (inside the ctl row)', /fg-ex-subcol">'\+_sub\+'<\/div><button class="fg-fill fg-fill-in/.test(src));
  ok('standalone sub line only when no ctl row exists (single-set)', /_sub&&e\.sets\.length<=1/.test(src));
  ok('long notes ellipsize to a single line', /fg-ex-note-in\{[^}]*text-overflow:ellipsis/.test(src));
  ok('full coaching cue preserved inside the ⓘ expansion', /fg-ex-info-note/.test(src) && /esc\(EX_INFO\[e\.ex\]\)\+\(e\.note/.test(src));
  ok('standalone note row removed from lift cards (circuit keeps its own)', !/if\(e\.note\) h\+='<div class="fg-ex-note">'/.test(src));
  ok('base card padding tightened (9px/11px, 6px gap)', /\.fg-ex\{[^}]*padding:9px 11px;margin-bottom:6px\}/.test(src));

  // ---- occlusion-aware centering: bottom stack subtracted from the viewport ----
  const scrolls=[];
  global.window=Object.assign(global.window||{},{innerHeight:800, scrollY:1000, scrollTo:(o)=>scrolls.push(o.top)});
  const rects={'.tabbar':{top:734,height:66},'#subDock':{top:688,height:46},'.fg-timer-bar':{top:620,height:60},'#dockPill':{top:9999,height:0}};
  const el={getBoundingClientRect:()=>({top:300,height:80}),scrollIntoView:()=>{}};
  const oQ2=global.document.querySelector;
  global.document.querySelector=(sel)=>{ if(rects[sel]) return {getBoundingClientRect:()=>rects[sel]}; if(/fgexanchor/.test(String(sel))) return el; return null; };
  C.s=baseState(); global.__CONFIRM=true; await C.forgeStart('Leg A'); C.renderForgeSession();
  C.fgScrollNext(); await new Promise(r=>setTimeout(r,90));
  // occlusion = 800-620 = 180 → visible 620 → y = 1000+300-310+40 = 1030
  ok('scroll centers in the VISIBLE band above the bottom stack (y=1030, not viewport-center 940)', scrolls.length===1 && Math.round(scrolls[0])===1030);
  // without window metrics (harness default) the old scrollIntoView fallback still works — earlier suites prove it
  delete global.window.scrollTo; delete global.window.innerHeight;
  global.document.querySelector=oQ2;
  global.document.querySelector=origQS;
};
