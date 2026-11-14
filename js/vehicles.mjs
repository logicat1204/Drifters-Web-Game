import {EXPANSION_CARS} from './expansion-vehicles.mjs';
// Original arcade preparations, not real-world homologation specifications.
// Model identity survives driver style: no two machines share a generic setup.
const rows=[
 ['180sx','NISSAN','180SX TYPE II','RPS13','1989','#eeeae0','power','silvia',900],
 ['s14','NISSAN',"SILVIA Q’S",'S14','1993','#d87835','power','silvia',1100],
 ['evo3','MITSUBISHI','LANCER EVOLUTION III GSR','CE9A','1995','#252a30','balanced','r32',1600],
 ['sileighty','NISSAN','SILEIGHTY','RPS13','1994','#3776bc','agile','silvia',1400],
 ['r34','NISSAN','SKYLINE GT-R V-SPEC II','BNR34','2000','#3f79a8','power','r32',2300],
 ['ae86coupe','TOYOTA','SPRINTER TRUENO 2-DOOR','AE86 2D','1983','#e7e7dd','agile','ae86',1200],
 ['ae86carbon','TOYOTA','TRUENO PROJECT D · CARBON','AE86 D','1983','#e5e5dc','agile','ae86',2200],
 ['rx7amemiya','MAZDA','RX-7 RE AMEMIYA SPEC','FD3S D','1991','#e7b948','balanced','rx7',2500],
 ['alfa4c','ALFA ROMEO','4C LAUNCH EDITION','4C','2013','#bc3437','agile','mr2',2400],
 ['exige','LOTUS','EXIGE S SERIES 3','EXIGE S','2012','#e7e5dd','power','mr2',2600],
 ['gt3rs','PORSCHE','911 GT3 RS','991','2015','#71a7c7','balanced','supra',3600],
 ['r8','AUDI','R8 V10 PLUS','4S','2015','#eeeae4','balanced','supra',3400],
 ['civic','HONDA','CIVIC TYPE R','FK8','2017','#eeeae4','power','silvia',2000],
 ['ferrari488','FERRARI','488 GTB','488','2015','#c62d35','power','rx7',3900],
 ['grsupra','TOYOTA','GR SUPRA','DB42','2019','#e8bd42','balanced','supra',3100],
 ['a110','ALPINE','A110S','A110S','2019','#3f85b5','agile','mr2',2900],
 ['cayman','PORSCHE','718 CAYMAN GTS / GT4','718','2019','#eeeae4','balanced','mr2',3700],
 ['gt86','TOYOTA','86 GT','ZN6','2012','#ca493f','balanced','rx7',1900]
];
// Competition tier describes preparation, never the model's manufacture year.
// Tier 3 gives NG+ a choice of classic builds and advanced modern machines.
const preparations={
 '180sx':     {competitionTier:1,accel:15.90,max:70.6,grip:1.045,brakePower:1.00},
 s14:        {competitionTier:1,accel:16.35,max:72.0,grip:1.050,brakePower:1.01},
 evo3:       {competitionTier:2,accel:15.70,max:69.0,grip:1.140,brakePower:1.04},
 sileighty:  {competitionTier:2,accel:14.60,max:64.0,grip:1.215,brakePower:1.02},
 r34:        {competitionTier:3,accel:18.00,max:76.5,grip:1.105,brakePower:1.08},
 ae86coupe:  {competitionTier:1,accel:13.90,max:61.8,grip:1.185,brakePower:1.00},
 ae86carbon: {competitionTier:3,accel:15.45,max:66.0,grip:1.275,brakePower:1.07},
 rx7amemiya: {competitionTier:3,accel:16.90,max:73.4,grip:1.180,brakePower:1.08},
 alfa4c:     {competitionTier:3,accel:15.30,max:66.0,grip:1.270,brakePower:1.08},
 exige:      {competitionTier:3,accel:18.15,max:77.0,grip:1.110,brakePower:1.09},
 gt3rs:      {competitionTier:3,accel:17.20,max:73.8,grip:1.200,brakePower:1.10},
 r8:         {competitionTier:3,accel:17.00,max:74.0,grip:1.180,brakePower:1.08},
 civic:      {competitionTier:2,accel:16.80,max:73.3,grip:1.070,brakePower:1.03},
 ferrari488: {competitionTier:3,accel:18.40,max:78.0,grip:1.100,brakePower:1.10},
 grsupra:    {competitionTier:3,accel:16.80,max:73.0,grip:1.190,brakePower:1.07},
 a110:       {competitionTier:3,accel:15.60,max:66.5,grip:1.280,brakePower:1.08},
 cayman:     {competitionTier:3,accel:17.05,max:73.2,grip:1.205,brakePower:1.10},
 gt86:       {competitionTier:2,accel:15.65,max:69.4,grip:1.140,brakePower:1.03}
};
export const EXTRA_CARS=[...rows.map(([id,brand,name,code,year,color,profile,mesh,price])=>{
 const labels={agile:{weight:'1120',power:'220'},balanced:{weight:'1280',power:'280'},power:{weight:'1410',power:'320'}}[profile],setup=preparations[id];
 return {id,brand,name,code,year,color,profile,mesh,price,drive:['r8','r34','evo3'].includes(id)?'4WD':id==='civic'?'FF':['alfa4c','a110','cayman','exige'].includes(id)?'MR':'FR',...labels,...setup,label:setup.competitionTier===3?'PREPARACIÓN DE COMPETICIÓN':setup.competitionTier===2?'EDICIÓN DE CAMPAÑA':'CLÁSICO TOUGE',stats:[Math.round(setup.accel/17*100),Math.round(setup.grip/1.2*100),Math.round(setup.max/75*100)]};
}),...EXPANSION_CARS];
