const ns='http://www.w3.org/2000/svg';
function svgElement(name,attributes={}){
  const element=document.createElementNS(ns,name);
  for(const [key,value] of Object.entries(attributes))element.setAttribute(key,value);
  return element;
}

const layouts={
  3:[[13,73],[44,48],[78,28]],
  4:[[13,73],[39,59],[74,68],[81,26]],
  5:[[12,71],[36,53],[64,67],[84,44],[63,21]]
};
const alternativeLayouts={
  akagi:[[15,28],[48,45],[78,68]],
  iroha:[[12,66],[47,37],[81,61]],
  usui:[[13,29],[52,64],[78,31]],
  tsukuba:[[12,70],[46,48],[75,29]],
  tsubaki:[[14,71],[36,30],[64,62],[84,26]],
  odawara:[[14,71],[46,60],[79,28]],
  ashinoko:[[15,29],[46,51],[79,69]]
};
const chestLocations={akina:[89,50],akagi:[43,19],iroha:[48,74],usui:[52,22],tsukuba:[47,79],tsubaki:[72,82],odawara:[72,80],ashinoko:[48,82],manazuru:[86,75]};
const icons={
  trial:'<circle cx="12" cy="13" r="7"/><path d="M9 3h6m-3 3V3m4 4 2-2m-6 4v4l3 2"/>',
  duel:'<path d="m4 4 4 1 12 12-3 3L5 8ZM4 20l7-7m2-2 6-6 1-1-1 4-4 4m-8 5 3 3m4-6 4-4"/>',
  grid:'<path d="M5 20V5m0 0c4-3 8 3 14 0v9c-6 3-10-3-14 0m4-9v8m5-7v8m-9-5c4-3 8 3 14 0"/>',
  chest:'<path d="M4 12V8l3-3h10l3 3v11H4zm0 0h16m-10 0v3h4v-3m-10 4h4m8 0h4"/>'
};
export function campaignNodeIcon(kind){
  const svg=svgElement('svg',{viewBox:'0 0 24 24','aria-hidden':'true'});
  svg.innerHTML=icons[kind];
  return svg;
}

function terrain(chapter){
  const layer=svgElement('g',{'class':'region-terrain'});
  const coast=['odawara','ashinoko','manazuru','usui'].includes(chapter.id);
  const seed=Array.from(chapter.id).reduce((sum,letter)=>sum+letter.charCodeAt(0),0);
  if(coast){
    layer.append(svgElement('path',{d:chapter.id==='ashinoko'?
      'M-30 392C150 402 241 317 370 321S527 393 668 362 850 263 1030 293V460H-30Z':
      'M785-20C765 62 918 88 878 180S763 285 819 363 969 383 1010 459H1030V-20Z',class:'region-water'}));
  }
  for(let band=0;band<13;band++){
    const y=band*36+(seed%18),wiggle=25+(seed+band*13)%46;
    layer.append(svgElement('path',{d:`M-28 ${y+38}Q99 ${y-wiggle} 214 ${y+12}T433 ${y+9}T660 ${y-38}T1020 ${y-7}`,class:'region-contour'}));
  }
  for(let i=0;i<118;i++){
    const x=(i*173+seed*13)%986+7,y=(i*113+seed*7)%396+22;
    const inGrove=Math.sin(x*.014+seed)*Math.cos(y*.031-seed)>.17;
    const onWater=coast&&(chapter.id==='ashinoko'?y>334:x>860);
    if(inGrove&&!onWater)layer.append(svgElement('path',{d:`M${x} ${y}l4-9 4 9h-3v3h-2v-3z`,class:'region-tree'}));
  }
  return layer;
}

export function renderRegionPaths(map,chapter,events,chest){
  const layout=alternativeLayouts[chapter.id]||layouts[events.length]||
    events.map((_,i)=>[12+76*i/Math.max(1,events.length-1),i%2===0?40:67]);
  const coordinates=new Map(events.map((event,index)=>[event.id,layout[index]]));
  if(chest)coordinates.set(chest.id,chestLocations[chapter.id]||[50,85]);
  const backdrop=svgElement('svg',{viewBox:'0 0 1000 440',preserveAspectRatio:'none','aria-hidden':'true',class:'region-drawing'});
  if(chapter.media.eventMap){
    const artwork=document.createElement('img');artwork.src=chapter.media.eventMap;artwork.alt='';artwork.className='region-art';
    map.prepend(artwork);
  }else backdrop.append(terrain(chapter));
  const buttons=[...map.querySelectorAll('[data-stage]')];
  const isLocked=id=>buttons.find(button=>button.dataset.stage===id)?.classList.contains('locked');
  const link=(from,to,branch=false)=>{
    const [x1,y1]=coordinates.get(from).map((n,i)=>n*(i?4.4:10)),[x2,y2]=coordinates.get(to).map((n,i)=>n*(i?4.4:10));
    const middle=x1+(x2-x1)*.53;
    const d=branch?`M${x1} ${y1}C${x1} ${y2} ${x2} ${y2} ${x2} ${y2}`:
      `M${x1} ${y1}C${middle} ${y1} ${middle} ${y2} ${x2} ${y2}`;
    backdrop.append(svgElement('path',{d,class:'region-road-shadow'}),svgElement('path',{d,class:'region-road'}),
      svgElement('path',{d,class:'region-road-mark'+(branch?' branch':'')+(isLocked(to)?' locked':'')}));
  };
  for(let i=1;i<events.length;i++)link(events[i-1].id,events[i].id);
  if(chest)link(events.find(event=>event.baseId===chest.requires).id,chest.id,true);
  map.prepend(backdrop);
  for(const button of buttons){
    const [x,y]=coordinates.get(button.dataset.stage);
    button.style.setProperty('--node-x',x+'%');button.style.setProperty('--node-y',y+'%');
  }
  map.onkeydown=event=>{
    const direction={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[event.key];
    const current=event.target.closest('[data-stage]');
    if(!direction||!current)return;
    event.preventDefault();
    const [x,y]=coordinates.get(current.dataset.stage);
    const candidates=buttons.filter(button=>button!==current).map(button=>{
      const [nx,ny]=coordinates.get(button.dataset.stage),dx=nx-x,dy=(ny-y)*.75;
      return {button,along:dx*direction[0]+dy*direction[1],score:Math.hypot(dx,dy)+Math.abs(dx*direction[1]-dy*direction[0])*1.5};
    });
    candidates.filter(c=>c.along>0).sort((a,b)=>a.score-b.score)[0]?.button.focus({preventScroll:true});
  };
}
