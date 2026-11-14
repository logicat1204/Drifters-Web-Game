const modernCars=new Set(['alfa4c','exige','gt3rs','r8','civic','ferrari488','grsupra','a110','cayman','gt86']);
const entryCars=new Set(['ae86','rx7','r32','180sx']);

export const carEra=car=>modernCars.has(car.id)?'mf-ghost':'initial-d';

export function shopCar(car){
  const tier=car.competitionTier||1;
  const base=[0,1100,3100,5800][tier];
  const multiplier=carEra(car)==='mf-ghost'?1.4:1;
  const price=entryCars.has(car.id)?car.price:Math.round((base+car.price*(tier===3?1.3:1))*multiplier/100)*100;
  return {...car,price,era:carEra(car),kind:'car'};
}
