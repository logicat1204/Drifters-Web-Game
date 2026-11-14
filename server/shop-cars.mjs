import {ALL_CARS} from '../js/sim.mjs';
import {campaignEvent,eventAvailable} from '../js/campaign-events.mjs';
import {shopCar} from '../js/dealership.mjs';

export const shopCars=ALL_CARS.map(shopCar);
export const mfGhostDealerOpen=cleared=>eventAvailable(campaignEvent('trial-odawara'),cleared);

export function assertShopEra(car,cleared){
  if(car.era==='mf-ghost'&&!mfGhostDealerOpen(cleared))
    throw Object.assign(Error('Desbloquea el mundo MF Ghost en campaña para comprar este auto.'),{status:409});
}
