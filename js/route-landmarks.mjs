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

// Select standalone scenery. Prebuilt roadway sections are kept as authoring references.
const additions={
  akagi:[[2,'akagi/akagi_stone_lantern_row',.12,2.8,6.6,3],[3,'akagi/akagi_info_board',.39,1.9,.55,3.2]],
  akina:[[2,'akina/akina_tofu_roadhouse',.064,4.2,4.3,4.8],[3,'akina/akina_sign_hairpin5',.39,2,1,4.5]],
  enna:[[2,'ennaskyline/enna_gazebo_hex',.20,3.5,3,4],[3,'ennaskyline/enna_flag_poles',.55,3.7,.2,7]],
  happogahara:[[2,'happogahara/happogahara_snow_poles',.31,9.5,2.8,4],[3,'happogahara/happogahara_snowman',.69,1.4,.9,3.1]],
  iroha:[[2,'irohazaka/irohazaka_monkey_warning',.17,4.6,1.1,3],[3,'irohazaka/irohazaka_stone_marker',.69,.4,.4,2]],
  momiji:[[2,'momiji/momiji_tea_house',.35,4.1,2.5,4],[3,'momiji/momiji_bench_leaves',.77,1.5,1.2,1.2]],
  myogi:[[2,'myogi/myogi_shrine_stairs',.14,2.6,6.8,6.2],[3,'myogi/myogi_boulder_pile',.51,3.2,2.4,2.4]],
  nagao:[[2,'nagao/nagao_farm_shed',.17,3.4,1.6,3.5],[3,'nagao/nagao_mikan_stand',.73,1.9,2.3,3]],
  nanamagari:[[2,'nanamagari/nanamagari_bus_stop',.18,4.5,1,3.2],[3,'nanamagari/nanamagari_cone_barrier_set',.73,4.3,1.4,1]],
  sadamine:[[2,'sadamine/sadamine_power_pylon',.34,6.8,3.7,43],[3,'sadamine/sadamine_small_turbine',.73,7.1,1.5,21]],
  tsubaki:[[2,'tsubaki/tsubaki_wooden_gate',.17,4.3,.55,5.5],[3,'tsubaki/tsubaki_camellia_tree',.58,2.1,2.1,5.4]],
  tsuchisaka:[[3,'tsuchisaka/tsuchisaka_signal_light',.063,.4,.4,5.1]],
  tsukuba:[[2,'tsukuba/tsukuba_gama_frog_statue',.44,1.6,1.9,3],[3,'tsukuba/tsukuba_souvenir_stall',.83,1.8,1.2,3]],
  turnpike:[[2,'turnpike/turnpike_sign_gantry',.20,9.6,.55,7.7],[3,'turnpike/turnpike_service_sign',.56,1.2,.2,3.7]],
  usui:[[3,'usui/usui_gas_lamp',.32,.4,.4,4.4]],
  yabitsu:[[2,'yabitsu/yabitsu_mountain_hut',.35,3.9,2.9,4.9],[3,'yabitsu/yabitsu_log_pile',.65,2.4,1.6,2.5]]
};

export const landmarkUrl=(file,pack=1)=>new URL(`../assets/routes_part${pack}/${file}.glb`,import.meta.url);
export const TURBINE_ROTOR='sadamine/sadamine_turbine_rotor';

function overlaps(a,b){
  for(const polygon of [a,b])for(let i=0;i<polygon.length;i++){
    const [x,,z]=polygon[i],[x2,,z2]=polygon[(i+1)%polygon.length],dx=z2-z,dz=x-x2;
    if(!dx&&!dz)continue;
    const ap=a.map(p=>p[0]*dx+p[2]*dz),bp=b.map(p=>p[0]*dx+p[2]*dz);
    if(Math.max(...ap)<Math.min(...bp)||Math.max(...bp)<Math.min(...ap))return false;
  }
  return true;
}

export function wallClear(footprint,base,height,blockers){
  return !blockers.some(({vertices,min,max})=>base<=max[1]&&base+height>=min[1]&&overlaps(footprint,vertices));
}

export function planRouteLandmarks(track,roadIndex,ground,tunnels,blockers=[]){
  const original=routes[track.id];
  if(!original||!ground)return [];
  const placements=[],groups=[original,...(additions[track.id]||[]).map(([pack,file,at,w,d,h])=>({pack,file,at:[at],size:[w,d,h]}))];
  if(track.id==='tsuchisaka'&&tunnels.length){
    groups.shift();
    placements.push(...tunnels.flatMap(tunnel=>[tunnel.start-1.4,tunnel.end+track.step+1.4].map((s,index)=>{
      const p=sample(track,s);
      return {...p,s,y:p.y-.17,angle:p.heading+(index?0:Math.PI),file:original.file,pack:1,detail:1,scale:[2.12,1,.32],radius:17,height:11,portal:true,exit:!!index};
    })));
  }
  const heightAt=(x,z)=>ground.groundAt(x,z)??ground.heightAt(x,z);
  const buckets=new Map();
  for(const obstacle of blockers)for(let x=Math.floor(obstacle.min[0]/32);x<=Math.floor(obstacle.max[0]/32);x++)for(let z=Math.floor(obstacle.min[2]/32);z<=Math.floor(obstacle.max[2]/32);z++){
    const key=x+','+z;
    if(!buckets.has(key))buckets.set(key,[]);
    buckets.get(key).push(obstacle);
  }
  for(const config of groups)for(const fraction of config.at){
    const scale=config.scale??1,[width,depth,height]=config.size.map(n=>n*scale);
    const radius=Math.hypot(width,depth),reach=config.align?width:depth;
    let best=null;
    for(const offset of [0,18,-18,38,-38,62,-62,95,-95,140,-140,195,-195,260,-260]){
      const s=track.length*fraction+offset;
      if(s<22||s>track.length-22||tunnels.some(t=>s>t.start-35&&s<t.end+35))continue;
      for(const gap of [1.6,4,8,14,24,36])for(const side of [1,-1]){
        const baseScore=gap*.4+Math.abs(offset)*.06+(config.side&&config.side!==side?22:0);
        if(best&&baseScore>=best.score)continue;
        const p=worldAt(track,s,side*(5.7+reach+gap));
        if(track.id==='usui'&&!roadIndex.clear(p.x,p.z,radius))continue;
        if(placements.some(spot=>Math.hypot(p.x-spot.x,p.z-spot.z)<radius+spot.radius+4))continue;
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
        const score=baseScore+rise*3+Math.abs(y-p.y)*.5;
        if(best&&score>=best.score)continue;
        const flatBase=config.burial??.18;
        const nearby=[];
        for(let x=Math.floor((p.x-radius-1)/32);x<=Math.floor((p.x+radius+1)/32);x++)for(let z=Math.floor((p.z-radius-1)/32);z<=Math.floor((p.z+radius+1)/32);z++)nearby.push(...buckets.get(x+','+z)||[]);
        if(!wallClear(corners,low-flatBase,height,nearby))continue;
        best={...p,s,y:low-flatBase,angle,file:config.file,pack:config.pack??1,detail:config.pack?2:1,scale:[scale,scale,scale],radius,height,footprint:corners,rotor:config.rotor,score};
      }
    }
    if(best)placements.push(best);
  }
  return placements;
}
