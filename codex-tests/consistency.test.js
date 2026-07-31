/* State-then-render consistency: every surface reflects a change IMMEDIATELY, never one interaction late */
module.exports = async function(C){
  const dock=()=> (global.__els['subDock']||{}).innerHTML||'';
  const pill=()=> (global.__els['dockPill']||{}) ;

  // ---- tab switch updates the sub-dock in the SAME call ----
  C.s=baseState(); C.s.ui={tab:'character'}; C.renderSubnavs();
  C.activateTab('shop');
  ok('switch to Shop → dock shows Shop chips immediately', /data-subnav="shop:rewards"/.test(dock()) && !/data-subnav="character:/.test(dock()));
  C.activateTab('training');
  ok('switch to Training → dock shows Forge/Alchemy/Protocol immediately', /data-tview="forge"/.test(dock()) && /data-tview="protocol"/.test(dock()));
  C.activateTab('quests');
  ok('switch to Quests → dock swaps again, no stale chips', /data-subnav="quests:active"/.test(dock()) && !/data-tview=/.test(dock()));
  C.activateTab('trophies');
  ok('Trophies → dock empties immediately (no leftover chips)', dock()==='');

  // ---- pill visibility flips in the SAME call ----
  global.__CONFIRM=true;
  C.s.ui.tab='character';
  await C.forgeStart('Leg A'); C.renderForgeSession();
  C.renderFgTimer();
  ok('session live off-Training → pill visible', pill().className==='show');
  C.activateTab('training');
  ok('arriving on Training hides the pill in the same call', pill().className!=='show');
  C.activateTab('virtues');
  ok('leaving Training shows it again in the same call', pill().className==='show');

  // ---- dock pill tap: view set BEFORE renders → dock marks Forge active immediately ----
  C.s.training.view='alchemy';
  C.onDocClick({target:{closest:q=>q==='[data-dockpill]'?{dataset:{}}:null}});
  ok('pill tap lands on Training·Forge with the dock already marking Forge active', C.s.ui.tab==='training' && C.s.training.view==='forge' && /class="on" data-tview="forge"/.test(dock()));

  // ---- sub-tab tap marks its chip active in the same call ----
  C.s.ui.tab='shop'; C.renderSubnavs();
  C.onDocClick({target:{closest:q=>q==='[data-subnav]'?{dataset:{subnav:'shop:desires'}}:null}});
  ok('sub-tab tap re-renders the dock with the new chip active', /class="on" data-subnav="shop:desires"/.test(dock()));

  // ---- tview tap same guarantee ----
  C.s.ui.tab='training'; C.renderSubnavs();
  C.onDocClick({target:{closest:q=>q==='[data-tview]'?{dataset:{tview:'protocol'}}:null}});
  ok('training view tap marks Protocol active immediately', C.s.training.view==='protocol' && /class="on" data-tview="protocol"/.test(dock()));

  // ---- handedness + density reflect instantly (no reload needed) ----
  let cls=new Set();
  global.document.documentElement={classList:{toggle:(k,on)=>{ on?cls.add(k):cls.delete(k); }}};
  C.s.handed='left'; C.s.density='compact'; C.applyDensity();
  ok('ergonomics + density apply in one call', cls.has('lefty') && cls.has('compact'));

  // ---- activateTab still persists the tab ----
  ok('tab persisted for next boot', (()=>{ C.activateTab('skills'); return C.s.ui.tab==='skills'; })());
  const srcB=require('fs').readFileSync(global.__APPFILE,'utf8');
  ok('build stamp present and shown in Settings', /const BUILD='2026\.07\.31-r455'/.test(srcB) && /id="buildStamp"/.test(srcB));
};
