import {worldAt,clamp} from './sim.mjs';

const opponentColors=['#ffba70','#d69cff','#7fedd2'];
export function minimapView(track,race,width,height){
  const origin=worldAt(track,race.s,race.lateral),heading=origin.heading;
  const ahead=clamp(180+race.speed*1.8,200,330),scale=height*.7/ahead;
  const project=point=>{
    const x=point.x-origin.x,z=point.z-origin.z;
    // The forward-facing 3D camera sees -X on its right when heading is zero.
    return {x:width*.5+(z*Math.sin(heading)-x*Math.cos(heading))*scale,
      y:height*.77-(x*Math.sin(heading)+z*Math.cos(heading))*scale};
  };
  const finish=race.finishDistance||track.length;
  const behind=height*.3/scale,start=Math.max(0,race.s-behind),end=Math.min(finish,race.s+ahead+40),points=[];
  for(let s=start;s<end;s+=5)points.push({...project(worldAt(track,s)),s});
  points.push({...project(worldAt(track,end)),s:end});
  const opponents=race.netOpponents||(race.mode!=='time'&&race.eventKind!=='trial'?[{id:race.rival.id,s:race.rivalS,lateral:race.rivalLateral}]:[]);
  const positions=[{id:'player',s:race.s},...opponents].sort((a,b)=>b.s-a.s);
  const radius=Math.max(5,Math.min(width,height)*.033),margin=radius+5;
  const player={...project(worldAt(track,race.s,race.lateral)),player:true,rotation:-(race.yaw||0),rank:positions.findIndex(p=>p.id==='player')+1};
  const drivers=[player];
  for(const [i,opponent] of opponents.entries()){
    const anchor=project(worldAt(track,clamp(opponent.s,0,finish),opponent.lateral));
    const distant=opponent.s>race.s+ahead||opponent.s<start;
    let x=clamp(anchor.x,margin,width-margin),y=distant?(opponent.s>race.s?margin:height-margin):clamp(anchor.y,margin,height-margin);
    const baseX=x,baseY=y;
    // Separate close opponents with small leader lines so side-by-side cars remain readable.
    for(let attempt=0;attempt<6&&drivers.some(p=>Math.hypot(p.x-x,p.y-y)<radius*2.8);attempt++){
      x=clamp(baseX+(attempt%2?1:-1)*(radius*3+Math.floor(attempt/2)*radius*2),margin,width-margin);
      y=clamp(baseY-Math.floor(attempt/4)*radius*3,margin,height-margin);
    }
    drivers.push({id:opponent.id,x,y,anchorX:clamp(anchor.x,2,width-2),anchorY:clamp(anchor.y,2,height-2),
      color:opponentColors[i%opponentColors.length],rank:positions.findIndex(p=>p.id===opponent.id)+1,
      distant});
  }
  return {points,drivers,scale,radius,heading,project,end:finish<=end?project(worldAt(track,finish)):null};
}

export function drawNavigation(canvas,track,race){
  const width=canvas.clientWidth||170,height=canvas.clientHeight||180,dpr=Math.min(globalThis.devicePixelRatio||1,2);
  const pixelWidth=Math.round(width*dpr),pixelHeight=Math.round(height*dpr);
  if(canvas.width!==pixelWidth||canvas.height!==pixelHeight){canvas.width=pixelWidth;canvas.height=pixelHeight;}
  const ctx=canvas.getContext('2d'),view=minimapView(track,race,width,height);
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,width,height);
  ctx.save();ctx.beginPath();ctx.rect(0,0,width,height);ctx.clip();
  ctx.fillStyle='#08121bdd';ctx.fillRect(0,0,width,height);
  const path=points=>{ctx.beginPath();for(const [i,p]of points.entries())if(i===0)ctx.moveTo(p.x,p.y);else ctx.lineTo(p.x,p.y);};
  ctx.lineCap='round';ctx.lineJoin='round';
  path(view.points);ctx.lineWidth=9;ctx.strokeStyle='#000b';ctx.stroke();
  ctx.lineWidth=5;ctx.strokeStyle='#8ca0ac55';ctx.stroke();
  path(view.points.filter(p=>p.s>=race.s));ctx.lineWidth=2.6;ctx.strokeStyle='#f0f3ea';ctx.stroke();
  if(view.end){ctx.fillStyle='#fff';ctx.fillRect(view.end.x-5,view.end.y-3,10,6);}
  for(const driver of view.drivers.slice(1)){
    ctx.globalAlpha=driver.distant ? .65 : 1;
    if(!driver.distant){ctx.beginPath();ctx.moveTo(driver.anchorX,driver.anchorY);ctx.lineTo(driver.x,driver.y);ctx.lineWidth=1;ctx.strokeStyle=driver.color;ctx.stroke();}
    ctx.beginPath();ctx.arc(driver.x,driver.y,view.radius+1.8,0,Math.PI*2);ctx.fillStyle='#050b12';ctx.fill();
    ctx.beginPath();ctx.arc(driver.x,driver.y,view.radius,0,Math.PI*2);ctx.fillStyle=driver.color;ctx.fill();
    ctx.font='bold '+Math.max(8,view.radius*1.45)+'px monospace';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#07101a';ctx.fillText(String(driver.rank),driver.x,driver.y+.4);
  }
  ctx.globalAlpha=1;
  const player=view.drivers[0],r=view.radius+2;
  ctx.save();ctx.translate(player.x,player.y);ctx.rotate(player.rotation);
  ctx.beginPath();ctx.moveTo(0,-r*1.25);ctx.lineTo(r*.85,r);ctx.lineTo(0,r*.5);ctx.lineTo(-r*.85,r);ctx.closePath();
  ctx.lineWidth=4;ctx.strokeStyle='#050b12';ctx.stroke();ctx.fillStyle='#79c6ff';ctx.fill();ctx.lineWidth=1.3;ctx.strokeStyle='#fff';ctx.stroke();ctx.restore();
  ctx.font='bold 8px monospace';ctx.textAlign='center';ctx.textBaseline='top';ctx.fillStyle='#c9eaff';ctx.fillText('TÚ',player.x,player.y+r+4);
  ctx.font='8px monospace';ctx.textAlign='left';ctx.fillStyle='#b8c6cf';ctx.fillText('PRÓXIMOS '+Math.round(height*.7/view.scale)+' m',6,6);
  ctx.restore();
}
