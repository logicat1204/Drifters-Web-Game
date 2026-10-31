import {BOSS_TRAITS} from './bosses.mjs';
// Canonical order and roster transcribed from assets/lista_de_pilotos_y_autos.md.
// Presentation asset paths live in the generated campaign-media.json manifest.
export const CAMPAIGN_LEVELS=['Fácil','Medio','Difícil','Profesional','Leyenda'];
export const DRIVER_STYLES={
  Grip:{label:'Grip',description:'Potencia y velocidad punta; necesita frenar antes de las curvas.',profile:'power',grip:1.00,max:76,accel:19.0,brakePower:1.30},
  Skiller:{label:'Skiller',description:'Ligero y preciso. Menor punta, gran velocidad de paso por curva.',profile:'agile',grip:1.32,max:64,accel:15.4,brakePower:1.08},
  Complete:{label:'Complete',description:'Equilibrio entre peso, aceleración y agarre.',profile:'balanced',grip:1.16,max:70,accel:17.1,brakePower:1.16}
};
export const CAMPAIGN_CHAPTERS=[
  {id:'akina',name:'Akina',folder:'1 akina',track:'akina',tag:'INITIAL D / GUNMA'},
  {id:'akagi',name:'Akagi',folder:'2 akagi',track:'akagi',tag:'INITIAL D / REDSUNS'},
  {id:'iroha',name:'Irohazaka',folder:'3 Irohazaka',track:'iroha',tag:'INITIAL D / TOCHIGI'},
  {id:'usui',name:'Usui',folder:'4 Usui',track:'usui',tag:'INITIAL D / IMPACT BLUE'},
  {id:'tsukuba',name:'Tsukuba',folder:'5 Tsukuba',track:'tsukuba',tag:'INITIAL D / PURPLE SHADOW'},
  {id:'tsubaki',name:'Tsubaki Line',folder:'6 Tsubaki line',track:'tsubaki',tag:'INITIAL D / PROJECT D'},
  {id:'odawara',name:'Odawara Pikes Peak',folder:'7 Odawara Pines Peak',track:'odawara',tag:'MF GHOST / PRIMERA RONDA'},
  {id:'ashinoko',name:'Lake Ashinoko GT',folder:'8 Lake ashinoko GT',track:'ashinoko',tag:'MF GHOST / LLUVIA Y NIEBLA',wet:true,fog:true},
  {id:'manazuru',name:'Peninsula Manazuru',folder:'9 Peninsula Manazuru',track:'manazuru',tag:'MF GHOST / FINAL'}
];
const rows=[
  ['akina','kenji','Kenji','180sx','#eeeae0',1,'Grip','Kenji'],
  ['akina','iketani-akina','Koichiro Iketani','silvia','#a0bb92',2,'Grip','Iketani'],
  ['akina','takumi-initial','Takumi Fujiwara (Inicial)','ae86','#e5e5dc',3,'Skiller','Takumi','balance'],
  ['akagi','kenta','Kenta Nakamura','s14','#d87835',2,'Grip','kenta'],
  ['akagi','keisuke-initial','Keisuke Takahashi','rx7','#e7b948',3,'Complete','keisuke','time'],
  ['iroha','kyoichi','Kyoichi Sudo','evo3','#252a30',3,'Complete','kyoichi'],
  ['iroha','kai-campaign','Kai Kogashiwa','mr2','#3268a6',3,'Complete','Kai','drift'],
  ['usui','iketani-usui','Koichiro Iketani','silvia','#a0bb92',2,'Skiller','iketani'],
  ['usui','mako-campaign','Mako Sato & Sayuki','sileighty','#3776bc',3,'Skiller','mako_sayuki'],
  ['tsukuba','godfoot','Kozo Hoshino · God Foot','r34','#3f79a8',4,'Grip','Kozo Hoshino'],
  ['tsukuba','godhand-campaign','Toshiya Joshima · God Hand','s2000','#3975a2',4,'Complete','Toshiya Yoshima'],
  ['tsubaki','shinji-campaign','Shinji Inui','ae86coupe','#e7e7dd',4,'Skiller','Shinji'],
  ['tsubaki','takumi-project','Takumi Fujiwara · Project D','ae86carbon','#e5e5dc',5,'Skiller','Takumi'],
  ['tsubaki','keisuke-project','Keisuke Takahashi · Project D','rx7amemiya','#e7b948',5,'Complete','keisuke D'],
  ['odawara','nozomi','Nozomi Kitahara','alfa4c','#bc3437',2,'Skiller','nozomi'],
  ['odawara','kakeru','Kakeru Yashio','exige','#e7e5dd',2,'Grip','kakeru'],
  ['odawara','jackson','Jackson Taylor','gt3rs','#71a7c7',3,'Complete','jackson'],
  ['ashinoko','sakamoto','Motoki Sakamoto','r8','#eeeae4',3,'Complete','sakamoto'],
  ['ashinoko','maezono','Kazuhiro Maezono','civic','#eeeae4',3,'Grip','maezono'],
  ['ashinoko','akaba','Kaito Akaba','ferrari488','#c62d35',4,'Grip','akaba'],
  ['manazuru','moroboshi','Sena Moroboshi','grsupra','#e8bd42',4,'Complete','moroboshi'],
  ['manazuru','sawatari','Daigo Sawatari','a110','#3f85b5',4,'Complete','sawatari'],
  ['manazuru','beckenbauer','Michael Beckenbauer','cayman','#eeeae4',5,'Complete','beckenbauer'],
  ['manazuru','kanata-final','Kanata Rivington (Fujiwara)','gt86','#ca493f',5,'Complete','kanata']
];
const bodyStyles=['Liftback / Coupé','Coupé','Liftback / Hatchback','Coupé','Coupé','Sedán','Targa / Motor central','Coupé','Liftback','Coupé','Roadster','Sedán 2 puertas','Liftback / Capó de carbono','Coupé / RE Amemiya','Coupé','Coupé','Coupé','Coupé','Hatchback','Coupé','Coupé','Coupé','Coupé','Coupé'];
const colorNames=['Blanco','Verde lima / Perla','Blanco y negro Panda','Naranja metalizado','Amarillo Competition','Negro Pyrenees','Azul Victoria','Verde lima / Perla','Azul Impact Blue','Azul Bayside / Jade','Azul Long Beach','Blanco','Panda / Capó de carbono','Amarillo','Rojo','Blanco','Azul / Blanco','Blanco','Blanco Championship','Rojo Rosso Corsa','Amarillo','Azul Alpine','Blanco','Rojo Lightning'];
export const CAMPAIGN_STAGES=rows.map(([chapter,id,name,car,color,level,style,folder,unlock],index)=>({chapter,id,name,car,color,boss:BOSS_TRAITS[id]?id:null,signature:BOSS_TRAITS[id]||null,colorName:colorNames[index],body:bodyStyles[index],level,style,folder,unlock,index,track:CAMPAIGN_CHAPTERS.find(c=>c.id===chapter).track,short:name.split(' · ')[0].replace(' (Inicial)',''),code:'',team:CAMPAIGN_CHAPTERS.find(c=>c.id===chapter).name,quote:DRIVER_STYLES[style].description}));
export const campaignStage=id=>CAMPAIGN_STAGES.find(stage=>stage.id===id);
export function stageAvailable(stage,cleared){return stage.index===0||cleared.includes(CAMPAIGN_STAGES[stage.index-1].id);}
export function focusUnlocks(cleared){return CAMPAIGN_STAGES.filter(s=>s.unlock&&cleared.includes(s.id)).map(s=>s.unlock);}
export function campaignReward(stage,points){return 220+stage.level*80+Math.floor(stage.index/3)*25+Math.min(160,Math.floor(Math.max(0,points)/150));}
export function campaignReplayReward(stage,points){return 35+stage.level*5+Math.min(25,Math.floor(Math.max(0,points)/600));}

// Original arcade interpretations, not surveyed reproductions of the real MFG routes.
export const CAMPAIGN_TRACKS=[
  {id:'odawara',name:'ODAWARA PIKES PEAK',jp:'小田原',subtitle:'MFG · la primera clasificación',length:9400,difficulty:'MFG',seed:43,elevation:460,rival:'kanata',theme:'coast',region:'KANAGAWA',landmarks:[{at:.28,name:'MFG QUALIFYING'},{at:.70,name:'MOUNTAIN GATE'}],layout:[[3,0],[3,35],[2,-65],[3,75],[3,-90],[3,55],[3,-60],[3,100],[3,-95],[3,70],[2,-85],[3,65],[3,-50],[3,20],[3,0]]},
  {id:'ashinoko',name:'LAKE ASHINOKO GT',jp:'芦ノ湖',subtitle:'MFG · lluvia y niebla sobre el lago',length:8200,difficulty:'LLUVIA',seed:47,elevation:280,rival:'kanata',theme:'forest',region:'HAKONE',landmarks:[{at:.30,name:'LAKE FOG'},{at:.65,name:'WET SECTOR'}],layout:[[3,0],[3,-45],[3,70],[3,-80],[2,90],[3,-65],[3,95],[3,-100],[3,65],[3,-70],[3,80],[3,-60],[3,30],[3,0]]},
  {id:'manazuru',name:'PENINSULA MANAZURU',jp:'真鶴',subtitle:'MFG · el último desafío de Kanata',length:10600,difficulty:'LEYENDA',seed:53,elevation:390,rival:'kanata',theme:'coast',region:'KANAGAWA',landmarks:[{at:.25,name:'PENINSULA SPRINT'},{at:.73,name:'MFG FINAL'}],layout:[[4,0],[3,45],[3,-60],[3,75],[3,-90],[3,55],[2,-110],[3,90],[3,-70],[3,85],[3,-95],[3,65],[3,-55],[4,30],[4,0]]}
];
// Short linked bends break up the long MFG sectors and require real braking.
CAMPAIGN_TRACKS[0].layout.splice(7,0,[1,100],[1,-100]);
CAMPAIGN_TRACKS[1].layout.splice(5,0,[1,-110],[1,110]);
CAMPAIGN_TRACKS[2].layout.splice(7,0,[1,120],[1,-120]);
