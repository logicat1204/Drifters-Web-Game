import {EXPANSION_CARS} from './expansion-vehicles.mjs';
// Original visual assets are selected by the exact car ID, never physics profile.
export const VEHICLE_FILES=Object.freeze(Object.fromEntries([
 ['ae86','ae86'],['ae86carbon','ae86'],['ae86coupe','ae86'],
 ...['rx7','rx7amemiya','r32','r34','mr2','s2000','silvia','180sx','sileighty','s14','supra','evo3','alfa4c','exige','gt3rs','r8','civic','ferrari488','grsupra','a110','cayman','gt86',...EXPANSION_CARS.map(car=>car.id)].map(id=>[id,id])
]));
export const AE86_RIG=Object.freeze({track:.722,wheelY:.298,radius:.294,front:1.17,rear:-1.23,popupAngle:.65});
