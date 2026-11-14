// Course sheets are the source for landmarks and sector lengths. Heights
// are estimated from the terrain shown in the supplied roadside photographs.
export const COURSE_REFERENCE_ROOT='assets/Assets nuevos y campañas y trayectos nuevos/Intiial D';
const refs=[
  ['myogi','Myogi','myogimap.jpg','ref1_Peak_of_Myogi.jpg','Myogi','妙義','GUNMA','forest',355,[1856,1920,1528,1764],[40,396],[482,251],'shingo-myogi',[[.16,'Cumbre de Myogi'],[.61,'Barranco de Myogi']]],
  ['momiji','Momiji Line','momiji_map.jpg','ref3_momiji_curva.jpg','Momiji Line','もみじライン','TOCHIGI','forest',435,[1542,1498,1562,1574],[522,154],[230,611],'toru-momiji',[[.12,'Cumbre de Momiji'],[.67,'Curvas del bosque']]],
  ['nanamagari','Nanamagari','Nanamagari_map.jpg','ref1_Old_Tokaido_Bridge.jpg','Nanamagari','七曲り','KANAGAWA','forest',320,[1468,1468,1468,1466],[610,197],[69,427],'ikeda-nanamagari',[[.31,'Siete curvas'],[.72,'Puente del antiguo Tōkaidō']]],
  ['nagao','Nagao','Nagao_map.jpg','ref2_Base_of_Nagao.jpg','Nagao','長尾','SHIZUOKA','forest',340,[1628,1656,1594,1680],[426,33],[464,642],'hideo-nagao',[[.35,'Canaletas de Nagao'],[.84,'Base de Nagao']]],
  ['happogahara','Hapogahara','Happogahara_map.jpg','ref2_Inside_the_Yuhi_Tunnel.jpg','Happogahara','八方ヶ原','TOCHIGI','forest',465,[1320,1410,1428,1320],[132,57],[486,627],'daiki-happogahara',[[.36,'Bosque de Happogahara'],[.69,'Túnel Yūhi']]],
  ['sadamine','Sadamine','Sadamine_map.jpg','ref1_Sadamine%27s_Second_Tight_Hairpin.jpg','Sadamine','定峰','SAITAMA','forest',365,[1730,1680,1704,1698],[460,159],[496,631],'nobuhiko-sadamine',[[.26,'Horquillas de Sadamine'],[.79,'Descenso de Saitama']]],
  ['turnpike','Turnpike','Toyo_Tires_Turnpike_map.jpg','ref2_Odawara_Toll_Gate.jpg','Hakone Turnpike','箱根ターンパイク','KANAGAWA','forest',690,[2748,2678,2648,2690],[642,102],[81,535],'rin-turnpike',[[.27,'Cambio de rasante'],[.95,'Peaje de Odawara']]],
  ['enna','Enna_Skyline_TodoSchool','Enna_Skyline_map1.jpg','ref1_Enna_Skyline_Downhill_Starting_Point.jpg','Enna Skyline','塩那','TOCHIGI','forest',365,[1390,1330,1450,1340],[291,21],[88,92],'tachi-enna',[[.10,'Salida de Enna'],[.59,'Enlazadas del Todo School']]],
  ['tsuchisaka','Tsuchisaka','10tsuchisaka_map.jpg','ref2.jpg','Tsuchisaka','土坂','SAITAMA','forest',405,[1696,1680,1756,1580],[47,45],[637,623],'aikawa-tsuchisaka',[[.10,'Túnel de Tsuchisaka'],[.72,'Paso de montaña']]],
  ['yabitsu','Yabitsu','yabitsu_map.jpg','Yabitsu7.jpg','Yabitsu','ヤビツ','KANAGAWA','forest',365,[1215,1461,1765,1645],[398,33],[565,261],'kobayakawa-yabitsu',[[.30,'Mirador de Yabitsu'],[.71,'Horquillas de Yabitsu']]]
];

export const EXPANSION_TRACKS=refs.map(([id,folder,map,cover,title,jp,region,theme,elevation,sectionLengths,start,end,rival,markers],i)=>({
  id,folder,title,name:title.toUpperCase(),jp,region,theme,elevation,length:sectionLengths.reduce((sum,m)=>sum+m,0),
  difficulty:i<3?'DIFÍCIL':'TÉCNICO',subtitle:markers.map(mark=>mark[1]).join(' · '),seed:101+i*7,rival,
  landmarks:markers.map(([at,name])=>({at,name})),geometryStep:4,width:10.6,visualBank:id==='turnpike'?.065:.045,
  referenceSheet:`${COURSE_REFERENCE_ROOT}/${folder}/${map}`,referenceCover:`${COURSE_REFERENCE_ROOT}/${folder}/${cover}`,
  sectionLengths,start,end
}));
