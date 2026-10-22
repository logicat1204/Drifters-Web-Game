// Authored arcade interpretations. Distances follow Sega AS8, Atami is one MFG lap.
// Each pair is relative sector length and signed heading change in degrees.
export const COURSE_LAYOUTS = {
  akina: [[3,0],[3,38],[2,-65],[3,45],[2,-60],[3,85],[2,-80],[3,30],[2,80],[2,-65],[3,25],[2,-55],[3,70],[2,-60],[2,145],[1,0],[2,-150],[1,0],[2,150],[1,0],[2,-150],[1,0],[2,148],[3,-48],[3,55],[2,-40],[3,0]],
  akagi: [[3,0],[3,-50],[2,75],[3,-40],[2,95],[3,-100],[2,60],[3,-90],[2,120],[3,-70],[2,80],[3,-115],[2,145],[3,-120],[2,85],[3,-60],[3,30],[3,0]],
  iroha: [[3,0],[2,152],[1,0],[2,-154],[1,0],[2,150],[1,0],[2,-150],[1,0],[2,145],[1,0],[2,-155],[2,35],[2,150],[1,0],[2,-150],[1,0],[2,150],[1,0],[2,-150],[2,75],[2,-75],[2,145],[1,0],[2,-140],[3,0]],
  usui: [[3,0],[3,65],[3,-70],[2,85],[3,-50],[3,110],[3,-100],[4,140],[2,-45],[3,-90],[3,85],[3,-65],[3,45],[3,0]],
  tsukuba: [[3,0],[2,65],[2,-70],[3,55],[2,-95],[3,75],[2,-90],[3,50],[2,125],[2,-115],[3,80],[3,-65],[3,95],[2,-105],[3,65],[2,-50],[3,20],[3,0]],
  tsubaki: [[3,0],[2,55],[2,-75],[2,60],[2,-100],[3,90],[2,-60],[2,100],[2,-115],[3,75],[2,-95],[2,130],[2,-115],[3,85],[2,-70],[3,95],[2,-110],[2,70],[3,-40],[3,0]],
  atami: [[4,0],[3,40],[2,-90],[3,85],[3,-35],[4,15],[2,100],[3,-80],[2,125],[2,-135],[3,90],[3,-70],[4,20],[3,65],[3,-45],[4,0],[2,-100],[3,85],[2,-60],[3,45],[4,0]]
};
export const RIVALS = {
  takumi:{id:'takumi',name:'TAKUMI FUJIWARA',short:'TAKUMI',jp:'藤原 拓海',car:'ae86',code:'TRUENO / AE86',color:'#e5e5dc',team:'AKINA SPEED STARS',pace:163,style:'gutter',quote:'Conozco cada curva de esta montaña.'},
  keisuke:{id:'keisuke',name:'KEISUKE TAKAHASHI',short:'KEISUKE',jp:'高橋 啓介',car:'rx7',code:'RX-7 / FD3S',color:'#e7b948',team:'AKAGI REDSUNS',pace:126.5,style:'power',quote:'Intenta seguir el ritmo del rotativo.'},
  kai:{id:'kai',name:'KAI KOGASHIWA',short:'KOGASHIWA',jp:'小柏 カイ',car:'mr2',code:'MR2 G-LIMITED / SW20',color:'#e8e8df',team:'IROHAZAKA',pace:137,style:'midship',quote:'El vértice está más cerca de lo que crees.'},
  mako:{id:'mako',name:'MAKO & SAYUKI',short:'MAKO',jp:'佐藤 真子 / 沙雪',car:'sileighty',code:'SILEIGHTY / RPS13',color:'#3776bc',team:'IMPACT BLUE',pace:89,style:'flow',quote:'Sayuki, vamos a por la C-121.'},
  godhand:{id:'godhand',name:'TOSHIYA JOSHIMA',short:'GOD HAND',jp:'城島 俊也',car:'s2000',code:'S2000 / AP1',color:'#3975a2',team:'PURPLE SHADOW',pace:137.5,style:'precision',quote:'La velocidad empieza con un movimiento suave.'},
  shinji:{id:'shinji',name:'SHINJI INUI',short:'SHINJI',jp:'乾 信司',car:'ae86coupe',code:'TRUENO 2DOOR / AE86',color:'#e2e2d6',team:'SIDEWINDER',pace:152,style:'instinct',quote:'Esta carretera es el camino de vuelta a casa.'},
  kanata:{id:'kanata',name:'KANATA KATAGIRI',short:'KANATA',jp:'片桐 夏向',car:'gt86',code:'TOYOTA 86 GT / ZN6',color:'#ca493f',team:'MFG / ESPECIAL',pace:243,style:'grip',quote:'La trazada todavía tiene algo que enseñarnos.'}
};
export const TRACKS = [
  {id:'akina',name:'AKINA',jp:'秋名',subtitle:'Las cinco horquillas de Takumi',length:7552,difficulty:'TÉCNICO',seed:1,turns:24,elevation:510,rival:'takumi',theme:'forest',region:'GUNMA',landmarks:[{at:.64,name:'FIVE HAIRPINS'},{at:.87,name:'LAST DOWNHILL'}]},
  {id:'akagi',name:'AKAGI',jp:'赤城',subtitle:'El territorio de los RedSuns',length:5804,difficulty:'RÁPIDO',seed:3,turns:17,elevation:420,rival:'keisuke',theme:'forest',region:'GUNMA',landmarks:[{at:.38,name:'RED SUNS SECTOR'},{at:.68,name:'HIGH SPEED S-BENDS'}]},
  {id:'iroha',name:'IROHAZAKA',jp:'いろは坂',subtitle:'Horquillas y frenadas de motor central',length:5116,difficulty:'EXPERTO',seed:7,turns:24,elevation:530,rival:'kai',theme:'autumn',region:'TOCHIGI',landmarks:[{at:.27,name:'SWITCHBACKS'},{at:.58,name:'MIDSHIP SECTION'}]},
  {id:'usui',name:'USUI',jp:'碓氷',subtitle:'Impact Blue y la legendaria C-121',length:3972,difficulty:'FLUIDO',seed:11,turns:13,elevation:280,rival:'mako',theme:'bridge',region:'GUNMA / NAGANO',landmarks:[{at:.28,name:'MEGANE BRIDGE'},{at:.51,name:'C-121'}]},
  {id:'tsukuba',name:'TSUKUBA',jp:'筑波',subtitle:'Fruits Line · la precisión de God Hand',length:6808,difficulty:'EXPERTO',seed:17,turns:17,elevation:310,rival:'godhand',theme:'orchard',region:'IBARAKI',landmarks:[{at:.25,name:'FRUITS LINE'},{at:.57,name:'PURPLE SHADOW'}]},
  {id:'tsubaki',name:'TSUBAKI LINE',jp:'椿ライン',subtitle:'El último descenso de Sidewinder',length:7312,difficulty:'LEYENDA',seed:23,turns:19,elevation:590,rival:'shinji',theme:'coast',region:'KANAGAWA',landmarks:[{at:.25,name:'SKYLINE SECTION'},{at:.70,name:'SIDEWINDER FINAL'}]},
  {id:'atami',name:'ATAMI GHOST',jp:'熱海',subtitle:'Especial Kanata · costa, ciudad y montaña',length:13700,difficulty:'ESPECIAL',seed:31,turns:20,elevation:360,rival:'kanata',theme:'city',region:'SHIZUOKA',landmarks:[{at:.17,name:'ATAMI CITY'},{at:.39,name:'UME LINE'},{at:.70,name:'SEASIDE STRAIGHT'}]}
];
