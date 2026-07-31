/* Pane sub-navigation: segmentation, defaults, switching, protocol view */
module.exports = async function(C){
  const appSrc=require('fs').readFileSync(global.__APPFILE,'utf8');

  // wrappers exist and are balanced per pane
  ok('5 panes carry subnav mounts', ['character','virtues','skills','quests','shop'].every(p=>appSrc.includes('id="subnav-'+p+'"')));
  ok('all 13 segment wrappers present (4+2+2+2+3)', (appSrc.match(/data-sub="[a-z]+:[a-z]+"/g)||[]).length===13);
  ok('training gained a third view: Protocol', /data-trainview="protocol"/.test(appSrc) && /data-trainview-pane="protocol"/.test(appSrc));
  ok('protocol view owns the proto list + editor', /data-trainview-pane="protocol">[\s\S]*?id="protoList"[\s\S]*?id="protoForm"/.test(appSrc));

  // chips render with defaults
  C.s=baseState();
  C.renderSubnavs();
  const nav=p=>(global.__els['subnav-'+p]||{}).innerHTML||'';
  ok('character chips render, Hero default-on', /data-subnav="character:hero"/.test(nav('character')) && /class="on" data-subnav="character:hero"/.test(nav('character')));
  ok('quests defaults to ACTIVE (list first, composer behind ＋ New)', /class="on" data-subnav="quests:active"/.test(nav('quests')));
  ok('shop shows Rewards / Offerings / Desires', ['rewards','offerings','desires'].every(x=>new RegExp('data-subnav="shop:'+x+'"').test(nav('shop'))));

  // switching
  C.forgeOnClick&&0; // subnav handler lives in the doc-level handler; simulate via the same shape
  const handler=(sel,ds)=>{ // emulate the click routing
    C.subSelSet ? null : null;
  };
  // direct: set selection through the exposed fns
  ok('subCur falls back to first segment', C.subCur('virtues')==='bloom');
  // simulate a chip tap through the quest doc handler path: not exposed; drive state via renderSubnavs after manual subSel? subSel not exposed — use the click emulation through forgeOnClick? Different handler. Instead verify the handler wiring exists in source:
  ok('chip taps wired in the doc-level click handler', /closest\('\[data-subnav\]'\)/.test(appSrc) && /subSel\[pp\[0\]\]=pp\[1\]/.test(appSrc));
  ok('render() drives subnavs every cycle', /renderSubnavs\(\);/.test(appSrc.slice(appSrc.indexOf('function render(){'),appSrc.indexOf('function render(){')+2600)));

  // regression: all mount ids still present exactly once
  ['todayLoop','pillars','log','virtueMount','groveMount','skillTrees','skillGroups','quests','shopOfferings','shopDesires','redeemPulse','wishMount','protoList'].forEach(id=>{
    ok('mount #'+id+' intact', (appSrc.match(new RegExp('id="'+id+'"','g'))||[]).length===1);
  });
};
