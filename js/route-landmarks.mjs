import {sample,worldAt} from './sim.mjs';

const SHORE = Math.PI / 2;
// Target fractions, half extents (x, z), height, and model scale in metres.
const routes = {
  akagi:{file:'akagi/akagi_shrine_bridge',at:[.24],size:[5.9,1.9,2.9]},
  akina:{file:'akina/akina_gutter_drain',at:[.18,.46,.76],size:[4.25,7,1],scale:.66,align:true},
  enna:{file:'ennaskyline/enna_viewpoint_deck',at:[.29,.65],size:[4.6,2.6,3]},
  happogahara:{file:'happogahara/happogahara_chairlift',at:[.19],size:[7.6,2,7.8]},
  iroha:{file:'irohazaka/irohazaka_hairpin_signs',at:[.32,.48,.64],size:[6.2,.9,3.1],scale:.8},
  momiji:{file:'momiji/momiji_maple_grove',at:[.22,.64],size:[7.4,5,6.6]},
  myogi:{file:'myogi/myogi_crag_cluster',at:[.31],size:[14.7,14.5,31],scale:.8,burial:1.2},
  nagao:{file:'nagao/nagao_citrus_terrace',at:[.26,.58],size:[7.1,2.4,4.7]},
  nanamagari:{file:'nanamagari/nanamagari_chevron_run',at:[.31,.55],size:[11.2,3,3.2],scale:.76},
  sadamine:{file:'sadamine/sadamine_turbine_tower',at:[.18,.48],size:[1.6,3.3,32],rotor:true},
  tsubaki:{file:'tsubaki/tsubaki_camellia_hedge',at:[.24,.71],size:[8.3,1.1,2.4]},
  tsuchisaka:{file:'tsuchisaka/tsuchisaka_tunnel_portal',at:[.11],size:[7.8,9,10.5]},
  tsukuba:{file:'tsukuba/tsukuba_ropeway_gondola',at:[.24],size:[8.3,1.1,12]},
  turnpike:{file:'turnpike/turnpike_toll_plaza',at:[.065],size:[7.8,11,8.1],align:true},
  usui:{file:'usui/usui_megane_bridge',at:[.27],size:[14.4,2,12.1],burial:.45,side:1},
  yabitsu:{file:'yabitsu/yabitsu_rockfall_fence',at:[.22,.48,.73],size:[7.9,1.9,4.7],scale:.94}
};

export const landmarkUrl=file=>new URL(`../assets/routes_part1/${file}.glb`,import.meta.url);
export const TURBINE_ROTOR='sadamine/sadamine_turbine_rotor';

export function planRouteLandmarks(track,roadIndex,ground,tunnels){
  const config=routes[track.id];
  if(!config||!ground)return [];
  if(track.id==='tsuchisaka'&&tunnels.length){
    return tunnels.flatMap(tunnel=>[tunnel.start-1.4,tunnel.end+track.step+1.4].map((s,index)=>{
      const p=sample(track,s);
      return {...p,s,y:p.y-.17,angle:p.heading+(index?0:Math.PI),file:config.file,scale:[2.12,1,.32],radius:17,height:11,portal:true};
    }));
  }
  const scale=config.scale??1,[width,depth,height]=config.size.map(n=>n*scale);
  const radius=Math.hypot(width,depth),reach=config.align?width:depth;
  const heightAt=(x,z)=>ground.groundAt(x,z)??ground.heightAt(x,z);
  const placements=[];
  for(const fraction of config.at){
    let best=null;
    for(const offset of [0,18,-18,38,-38,62,-62,95,-95,140,-140,195,-195,260,-260]){
      const s=track.length*fraction+offset;
      if(s<22||s>track.length-22||tunnels.some(t=>s>t.start-35&&s<t.end+35))continue;
      for(const gap of [1.6,4,8,14,24,36])for(const side of [1,-1]){
        const p=worldAt(track,s,side*(5.7+reach+gap));
        if(track.id==='usui'&&!roadIndex.clear(p.x,p.z,radius))continue;
        if(placements.some(spot=>Math.hypot(p.x-spot.x,p.z-spot.z)<radius*2+15))continue;
        const angle=p.heading+(config.align?(side>0?0:Math.PI):-side*SHORE);
        const c=Math.cos(angle),k=Math.sin(angle);
        const corners=[[-width,-depth],[width,-depth],[width,depth],[-width,depth]]
          .map(([x,z])=>[p.x+x*c+z*k,0,p.z-x*k+z*c]);
        if(!roadIndex.polygonClear(corners,.5))continue;
        const levels=corners.map(([x,,z])=>heightAt(x,z));
        const y=heightAt(p.x,p.z),low=Math.min(y,...levels),high=Math.max(y,...levels);
        if(low<(ground.waterHeight??-Infinity)+.2||Math.abs(y-p.y)>height+5)continue;
        const rise=high-low;
        if(rise>Math.max(1.6,Math.min(6,height*.6)))continue;
        const score=rise*3+gap*.4+Math.abs(offset)*.06+Math.abs(y-p.y)*.5+(config.side&&config.side!==side?22:0);
        if(best&&score>=best.score)continue;
        const flatBase=config.burial??.18;
        best={...p,s,y:low-flatBase,angle,file:config.file,scale:[scale,scale,scale],radius,height,rotor:config.rotor,score};
      }
    }
    if(best)placements.push(best);
  }
  return placements;
}
