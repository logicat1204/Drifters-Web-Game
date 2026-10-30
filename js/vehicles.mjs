// Extra purchasable machines; all physics remain within the arcade's three profiles.
const rows=[
 ['180sx','NISSAN','180SX TYPE II','RPS13','1989','#eeeae0','power','silvia',900],
 ['s14','NISSAN',"SILVIA Q’S",'S14','1993','#d87835','power','silvia',1100],
 ['evo3','MITSUBISHI','LANCER EVOLUTION III GSR','CE9A','1995','#252a30','balanced','r32',1600],
 ['sileighty','NISSAN','SILEIGHTY','RPS13','1994','#3776bc','agile','silvia',1400],
 ['r34','NISSAN','SKYLINE GT-R V-SPEC II','BNR34','2000','#3f79a8','power','r32',2300],
 ['ae86coupe','TOYOTA','SPRINTER TRUENO 2-DOOR','AE86 2D','1983','#e7e7dd','agile','ae86',1200],
 ['ae86carbon','TOYOTA','TRUENO PROJECT D · CARBON','AE86 D','1983','#e5e5dc','balanced','ae86',2200],
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
export const EXTRA_CARS=rows.map(([id,brand,name,code,year,color,profile,mesh,price])=>{
 const stats={agile:{accel:14.0,max:62,grip:1.18,weight:'1120',power:'220'},balanced:{accel:15.2,max:68,grip:1.11,weight:'1280',power:'280'},power:{accel:16.2,max:72,grip:1.04,weight:'1410',power:'320'}}[profile];
 return {id,brand,name,code,year,color,profile,mesh,price,drive:['r8','r34','evo3'].includes(id)?'4WD':id==='civic'?'FF':['alfa4c','a110','cayman','exige'].includes(id)?'MR':'FR',...stats,label:'EDICIÓN DE CAMPAÑA',stats:[Math.round(stats.accel/17*100),Math.round(stats.grip/1.2*100),Math.round(stats.max/75*100)]};
});
