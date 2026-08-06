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
  ok('build stamp present and shown in Settings', /const BUILD='2026\.08\.06-r460'/.test(srcB) && /id="buildStamp"/.test(srcB));

  // ---- camera fast-path: snap buttons open the camera, 🖼 buttons open the gallery ----
  ok('meal + menu each have a capture input AND a gallery input',
    /capture="environment" id="fuelPhotoCam"/.test(srcB) && /accept="image\/\*" id="fuelPhoto"/.test(srcB)
    && /capture="environment" id="fuelMenuCam"/.test(srcB) && /accept="image\/\*" id="fuelMenu"/.test(srcB));
  ok('snap buttons trigger the camera inputs, upload buttons the gallery inputs',
    /#fuelPhotoBtn'\)\)\{ if\(fuelLoading\) return; document\.getElementById\('fuelPhotoCam'\)\.click/.test(srcB)
    && /#fuelPhotoUpBtn'\)\)\{ if\(fuelLoading\) return; document\.getElementById\('fuelPhoto'\)\.click/.test(srcB)
    && /#fuelMenuBtn'\)\)\{ if\(fuelLoading\) return; document\.getElementById\('fuelMenuCam'\)\.click/.test(srcB)
    && /#fuelMenuUpBtn'\)\)\{ if\(fuelLoading\) return; document\.getElementById\('fuelMenu'\)\.click/.test(srcB));
  ok('all four inputs feed the photo/menu handlers', /\['fuelPhoto','fuelPhotoCam'\]/.test(srcB) && /\['fuelMenu','fuelMenuCam'\]/.test(srcB));

  // ---- update nudge: build.json must always match BUILD (deploy gate keeps them in sync) ----
  const bj=JSON.parse(require('fs').readFileSync(require('path').join(require('path').dirname(global.__APPFILE),'build.json'),'utf8'));
  ok('build.json matches the BUILD stamp', new RegExp("const BUILD='"+bj.build.replace(/\./g,'\\.')+"'").test(srcB));
  ok('stale pages poll build.json and offer a tap-to-refresh', /fetch\('\/build\.json/.test(srcB) && /location\.reload\(\)/.test(srcB) && /visibilitychange',\(\)=>\{ if\(document\.visibilityState==='visible'\) checkForUpdate/.test(srcB));
  ok('nudge is throttled and dismissible', /lastBuildCheck<5\*60\*1000/.test(srcB) && /un-x/.test(srcB));

  // ---- photo & menu AI pipelines stay wired end-to-end ----
  ok('plate photo flow: button → hidden input → onFuelPhoto → nutEstImage',
    /id="fuelPhotoBtn"/.test(srcB) && /id="fuelPhoto"/.test(srcB) && /onFuelPhoto\(f\)/.test(srcB) && /nutEstImage\(b64/.test(srcB));
  ok('menu scan flow: button → hidden input → onFuelMenu → nutScanMenu',
    /id="fuelMenuBtn"/.test(srcB) && /id="fuelMenu"/.test(srcB) && /onFuelMenu\(f\)/.test(srcB) && /nutScanMenu\(b64/.test(srcB));
  ok('menu curation sees remaining budget, targets AND training day',
    /nutScanMenu\(b64,\{remaining,targets:tt,training:trainingDayContext\(\)\}/.test(srcB) && /TRAINING TODAY: \$\{JSON\.stringify\(ctx\.training/.test(srcB));
  ok('images upload at the model vision cap (1568px), not over-downscaled', /const max=1568/.test(srcB));

  // ---- fuel AI errors are actionable, not the stale "runs inside Claude" catch-all ----
  ok('web search tool is the current 4.6-generation version', /web_search_20260209/.test(srcB) && !/web_search_20250305/.test(srcB));
  ok('no catch-all blames "inside Claude" anymore', !/needs to run inside Claude|runs inside Claude/.test(srcB));
  ok('aiFailMsg surfaces sign-in and proxy errors', typeof C.aiFailMsg==='function'
    && /Sign in/.test(C.aiFailMsg(new Error('AI proxy: sign in to use the coach')))
    && /rate limited/.test(C.aiFailMsg(new Error('AI proxy: rate limited')))
    && /reach the AI/.test(C.aiFailMsg(new Error('Failed to fetch'))));
};
