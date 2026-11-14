// Distinct arcade setups. Mesh names select the closest procedural body
// family. Dimensions and fascia details further distinguish each variant.
const variants=[
  ['eg6','HONDA','CIVIC SiR-II','EG6','1991','#bc3437','balanced','silvia','FF',1450,2,15.2,65,1.25,1.07,1.69,.91,'hatch'],
  ['r32v2','NISSAN','SKYLINE GT-R V-SPEC II','BNR32 V·SPEC II','1994','#2b3138','power','r32','4WD',2300,3,17.1,74,1.11,1.12,1.78,1.07,'skyline'],
  ['na6ce','EUNOS','ROADSTER','NA6CE','1989','#bd4449','agile','s2000','FR',1400,2,14.05,61.5,1.25,1.06,1.67,.92,'roadster'],
  ['er34','NISSAN','SKYLINE 25GT TURBO','ER34','1998','#d8dbe0','power','r32','FR',1950,2,16.75,72,1.09,1.06,1.75,1.08,'skyline'],
  ['z33','NISSAN','FAIRLADY Z VERSION S','Z33','2002','#898b90','balanced','supra','FR',1950,2,16.1,71.1,1.15,1.10,1.82,1.02,'fastback'],
  ['s15','NISSAN','SILVIA SPEC-R','S15','1999','#567fbd','balanced','silvia','FR',1900,2,16,70,1.18,1.07,1.70,1.05,'fastback'],
  ['zzw30','TOYOTA','MR-S S-EDITION','ZZW30','1999','#bcbec2','balanced','s2000','MR',1750,2,15,65.6,1.23,1.09,1.70,.93,'roadster'],
  ['ek9','HONDA','CIVIC TYPE R','EK9','1997','#deddd5','agile','silvia','FF',1750,2,15.15,65.4,1.24,1.09,1.69,.95,'hatch'],
  ['dc2','HONDA','INTEGRA TYPE R','DC2','1998','#deddd5','power','silvia','FF',1800,2,16.1,69.8,1.10,1.14,1.71,1.02,'integra'],
  ['sxe10','TOYOTA','ALTEZZA RS200 Z EDITION','SXE10','1998','#e1e0d9','power','r32','FR',1750,2,16,69.5,1.09,1.09,1.72,1.02,'sedan'],
  ['fc3s','MAZDA','RX-7 SAVANNA · PREPARADO','FC3S','1990','#e9e8e2','balanced','rx7','FR',2450,3,16.65,71.5,1.20,1.13,1.74,1.02,'fc'],
  ['ek9spoon','HONDA','SPOON CIVIC TYPE R · TODO SCHOOL','EK9 SPOON','1997','#e5ce46','balanced','silvia','FF',2400,3,16,69,1.22,1.14,1.71,.95,'hatch'],
  ['evo5','MITSUBISHI','LANCER EVOLUTION V GSR','CP9A V','1998','#e2ded2','power','r32','4WD',2200,3,17.3,74,1.09,1.13,1.78,1.02,'evo'],
  ['evo6','MITSUBISHI','LANCER EVOLUTION VI · TOMMI MÄKINEN','CP9A TME','2000','#d14343','balanced','r32','4WD',2500,3,17.25,73,1.19,1.14,1.77,1.04,'evo'],
  ['evo7','MITSUBISHI','LANCER EVOLUTION VII GSR','CT9A','2001','#d8b547','power','r32','4WD',2400,3,17.55,74.3,1.11,1.15,1.79,1.05,'evo'],
  ['nb8c','MAZDA','ROADSTER RS','NB8C','1998','#3d74ab','agile','s2000','FR',1650,2,14.9,64,1.24,1.09,1.68,.94,'roadster'],
  ['m6f13','BMW','M6 COUPÉ','F13','2012','#b56840','power','supra','FR',3800,3,17.85,75.5,1.14,1.12,1.93,1.13,'gt'],
  ['gt3','PORSCHE','911 GT3','991 GT3','2013','#dfdada','balanced','supra','RR',3450,3,17,72.8,1.19,1.10,1.84,1.01,'fastback'],
  ['amggtr','MERCEDES-AMG','GT R','C190','2017','#426586','balanced','supra','FR',3700,3,17.2,74,1.18,1.12,1.90,1.08,'gt']
];
export const EXPANSION_CARS=variants.map(([id,brand,name,code,year,color,profile,mesh,drive,price,competitionTier,accel,max,grip,brakePower,width,lengthScale,body],i)=>{
  const power=Math.round(110+(accel-13)*49);
  return {id,brand,name,code,year,color,profile,mesh,drive,price,competitionTier,accel,max,grip,brakePower,width,lengthScale,body,
    power:String(power),weight:String(Math.round((1040+i*6+(profile==='power'?235:0))/5)*5),
    label:competitionTier===3?'PREPARACIÓN DE COMPETICIÓN':'EDICIÓN DE CAMPAÑA',
    stats:[Math.round(accel/17*100),Math.round(grip/1.2*100),Math.round(max/75*100)]};
});
