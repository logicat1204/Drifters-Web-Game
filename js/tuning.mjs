// Shared catalog and deterministic preparation. Purchases are authorized by Store.
export const UPGRADES={
 engine:{name:'Motor',description:'Salida de curva y velocidad en rectas.',prices:[220,480,850],acceleration:[1,1.04,1.08,1.12],speed:[1,1.02,1.04,1.06]},
 chassis:{name:'Chasis y neumáticos',description:'Más agarre sin perder el carácter del auto.',prices:[200,440,780],grip:[1,1.04,1.08,1.12]},
 brakes:{name:'Frenos',description:'Frenada más eficaz para preparar las curvas.',prices:[160,340,600],braking:[1,1.06,1.12,1.18]}
};
export const VEHICLE_PARTS=[
 {id:'paint',slot:'paint',value:'custom',name:'Pintura libre',price:140,description:'Desbloquea todos los colores; repinta gratis después de comprarla.'},
 {id:'vinyl-twin',slot:'vinyl',value:'twin',name:'Franjas Racing',price:180,description:'Doble franja sobre techo y capó.'},
 {id:'vinyl-apex',slot:'vinyl',value:'apex',name:'Apex Line',price:220,description:'Gráfica lateral de montaña en blanco y azul.'},
 {id:'hood-carbon',slot:'hood',value:'carbon',name:'Capó oscuro',price:200,description:'Acabado visual inspirado en fibra de carbono.'},
 {id:'spoiler-gt',slot:'spoiler',value:'gt',name:'Alerón GT',price:320,description:'Alerón alto de pista; no modifica el agarre.'},
 {id:'wheels-gold',slot:'wheels',value:'gold',name:'Llantas doradas',price:160,description:'Acabado dorado para tus llantas.'},
 {id:'wheels-black',slot:'wheels',value:'black',name:'Llantas negras',price:160,description:'Acabado negro satinado.'}
];
export const PAINTS=['#e5e5dc','#151c25','#c63843','#e9bd42','#3975a2','#619b82','#9874b5','#d77839'];
export const stockBuild=()=>({engine:0,chassis:0,brakes:0,color:null,vinyl:'none',hood:'stock',spoiler:'stock',wheels:'stock'});
export function validateBuild(value={}){
 const b={...stockBuild(),...value};
 for(const key of Object.keys(UPGRADES))if(!Number.isInteger(b[key])||b[key]<0||b[key]>3)throw Error('Nivel de mejora inválido.');
 if(b.color!==null&&(typeof b.color!=='string'||!/^#[a-f\d]{6}$/i.test(b.color)))throw Error('Color inválido.');
 for(const [slot,values]of Object.entries({vinyl:['none','twin','apex'],hood:['stock','carbon'],spoiler:['stock','gt'],wheels:['stock','gold','black']}))if(!values.includes(b[slot]))throw Error('Pieza visual inválida.');
 return {engine:b.engine,chassis:b.chassis,brakes:b.brakes,color:b.color?.toLowerCase()||null,vinyl:b.vinyl,hood:b.hood,spoiler:b.spoiler,wheels:b.wheels};
}
export const buildKey=b=>{const x=validateBuild(b);return `M${x.engine}-C${x.chassis}-F${x.brakes}`;};
export const buildLabel=b=>{const x=validateBuild(b);return x.engine+x.chassis+x.brakes===0?'DE SERIE':buildKey(x);};
export function applyBuild(base,value={}){
 const b=validateBuild(value),original=base.baseStats||{accel:base.accel,max:base.max,grip:base.grip,brakePower:base.brakePower||1,color:base.color,power:base.power};
 const accel=original.accel*UPGRADES.engine.acceleration[b.engine],max=original.max*UPGRADES.engine.speed[b.engine],grip=original.grip*UPGRADES.chassis.grip[b.chassis];
 return {...base,baseStats:original,build:b,buildKey:buildKey(b),color:b.color||original.color,accel,max,grip,brakePower:original.brakePower*UPGRADES.brakes.braking[b.brakes],power:String(Math.round(Number(original.power)*UPGRADES.engine.acceleration[b.engine])),stats:[Math.round(accel/17*100),Math.round(grip/1.2*100),Math.round(max/75*100)]};
}
export const appearanceKey=car=>JSON.stringify([car.color,car.build?.vinyl||'none',car.build?.hood||'stock',car.build?.spoiler||'stock',car.build?.wheels||'stock']);
