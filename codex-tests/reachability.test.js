/* Interaction reachability audit — the class of bug where a handler exists but
   its listener root can never contain the element (the dead-subnav bug).
   Manifest maps every interactive data-attr → the pane(s) it renders into.
   Rule: handler root must be document, a global overlay, or the SAME pane. */
module.exports = async function(C){
  const fs=require('fs'), path=require('path');
  const src=fs.readFileSync(global.__APPFILE,'utf8');

  // ---- carve listener blocks with their roots ----
  const blocks=[];
  const re=/(document|pane|ro|mo|ft|seg)\.addEventListener\('click'/g; let m;
  while((m=re.exec(src))){ blocks.push({root:m[1], at:m.index}); }
  // onDocClick is attached to document
  const docFn=src.indexOf('function onDocClick(e){');
  const docFnEnd=src.indexOf("document.addEventListener('click', onDocClick);");
  const rootOf={};  // attr -> Set(rootLabels)
  function scanRange(a,b,label){ const seg=src.slice(a,b);
    const rr=/closest\((?:'|")([^'"]+)(?:'|")\)/g; let k;
    while((k=rr.exec(seg))){ const attrs=k[1].match(/data-([a-z]+)/g)||[];
      attrs.forEach(x=>{ const nm=x.slice(5); (rootOf[nm]=rootOf[nm]||new Set()).add(label); }); } }
  function fnSpan(name){ const a=src.indexOf('function '+name); if(a<0) return null;
    const b=src.indexOf('\n}',a); return [a,b]; }
  scanRange(docFn,docFnEnd,'document');
  const bounds=[...src.matchAll(/\.addEventListener\(/g)].map(x=>x.index);
  blocks.forEach((b)=>{ const end=bounds.find(x=>x>b.at+30)||src.length;
    let label=b.root;
    if(b.root==='pane'){ const back=src.slice(Math.max(0,b.at-400),b.at); const pm=back.match(/data-pane=\\?"([a-z]+)\\?"/); label=pm?('pane:'+pm[1]):'pane:?'; }
    if(b.root==='document') label='document';
    if(b.root==='ro'||b.root==='mo') label='overlay';
    scanRange(b.at,Math.min(end,b.at+6000),label);
    // delegated helpers: fn calls of the shape if(xxxOnClick(e)) within the block
    const seg=src.slice(b.at,Math.min(end,b.at+6000));
    (seg.match(/([a-zA-Z]+OnClick)\(e\)/g)||[]).forEach(h=>{ const sp=fnSpan(h.replace('(e)','')); if(sp) scanRange(sp[0],sp[1],label); });
  });

  // ---- manifest: attr -> panes where it is emitted (hand-audited) ----
  const PANES={
    // click-interactive attrs only
    subnav:['character','virtues','skills','quests','shop'],
    complete:['character'],hold:['character'],slip:['character'],undo:['character'],edit:['character'],del:['character'],add:['skills','character'],
    qtrack:['quests'],steptoggle:null, qexpand:['quests'],qpin:['quests'],qdel:['quests'],addstep:['quests'],
    qkind:['quests'],qtpl:['quests'],qcount:['quests'],qcountadd:['quests'],qcheckinadd:['quests'],qtick:['quests'],
    fgstart:['training'],fgvariant:['training'],fgfeel:['training'],fgcheckall:['training'],fgfill:['training'],fgexinfo:['training'],fgholdtimer:['training'],
    fgtimer:['training'],fgvoice:['training'],fgvoicehelp:['training'],fgblocktoggle:['training'],fgbreak:['training'],fgactdone:['training'],fgacttimer:['training'],fgactivation:['training'],fgtimermin:['training'],fgtimermax:['training'],fgpreset:['training'],
    prototoggle:['training'],protowater:['training'],protodel:['training'],
    fuelquick:['training'],fueldel:['training'],
    offbuy:['shop'],claimboon:['shop'],setgoaloff:['shop'],desbuy:['shop'],desdel:['shop'],offdel:['shop'],
    suggest:['skills'],
  };

  // ---- Rule A: every manifest attr has a handler somewhere ----
  const handled=Object.keys(rootOf);
  const missingHandlers=Object.keys(PANES).filter(a=>a!=='steptoggle'&&PANES[a]&&!handled.some(h=>h===a||h===a.replace(/-/g,'')));
  ok('every interactive attr has a click handler ('+(missingHandlers.length?('MISSING: '+missingHandlers):'all covered')+')', missingHandlers.length===0);

  // ---- Rule B: pane-scoped handlers only serve their own pane ----
  const violations=[];
  Object.keys(rootOf).forEach(attr=>{
    const roots=[...rootOf[attr]]; const panes=PANES[attr];
    if(!panes) return; // not in manifest (input/change attrs etc.)
    roots.forEach(r=>{
      if(r==='document'||r==='overlay') return;           // global — always reachable
      if(r.startsWith('pane:')){ const p=r.slice(5);
        panes.forEach(pp=>{ if(pp!==p) violations.push(attr+' emitted in '+pp+' but handled only in '+r); }); }
    });
  });
  ok('no pane-scoped handler serves an element outside its pane'+(violations.length?(' — VIOLATIONS: '+violations.join('; ')):''), violations.length===0);

  // ---- Rule C: subnav specifically is document-level now ----
  ok('data-subnav handled at document level', rootOf.subnav && rootOf.subnav.has('document'));
  ok('training listener no longer claims subnav', !(rootOf.subnav||new Set()).has('pane:training'));

  // ---- runtime: chip taps actually flip the segment via the real doc handler ----
  C.s=baseState(); C.renderSubnavs();
  const mk=(p,id)=>({target:{closest:(q)=>q==='[data-subnav]'?{dataset:{subnav:p+':'+id}}:null}});
  C.onDocClick(mk('shop','desires'));
  ok('tap Shop→Desires flips the segment', C.subCur('shop')==='desires');
  ok('chips re-render with the new selection marked', /class="on" data-subnav="shop:desires"/.test((global.__els['subnav-shop']||{}).innerHTML));
  C.onDocClick(mk('quests','new'));
  ok('tap Quests→＋New flips', C.subCur('quests')==='new');
  ok('other panes unaffected (character still hero)', C.subCur('character')==='hero');
  // unknown pane tap does not throw
  let threw=false; try{ C.onDocClick(mk('nosuchpane','x')); C.renderSubnavs(); }catch(e){ threw=true; }
  ok('junk subnav tap never throws', !threw);
  // restore defaults so later suites see a fresh subnav state
  C.onDocClick(mk('shop','rewards')); C.onDocClick(mk('quests','active'));
};
