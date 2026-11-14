import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {Store} from '../server/store.mjs';
import {cardCatalog,cardChest} from '../server/collectibles.mjs';
import {ALL_TRACKS,CARS,createRace,makeTrack} from '../js/sim.mjs';
import {campaignEvent,campaignEvents} from '../js/campaign-events.mjs';
import {mfGhostDealerOpen,shopCars} from '../server/shop-cars.mjs';

test('card chests charge once, return the original draw and restrict favorites to owned cards',async()=>{
  const store=new Store(':memory:');
  try{
    const {id}=await store.register('CardPilot24','Card-test-password');
    const catalog=await cardCatalog(),receipt=randomUUID();
    assert.deepEqual(new Set(catalog.map(card=>card.tier)),new Set(['common','rare','special','legendary']));
    assert.throws(()=>store.buyCardChest(id,receipt,catalog),/suficientes/);
    assert.throws(()=>store.setFavoriteCard(id,catalog[0].id),/colección/);
    store.db.prepare('UPDATE wallets SET balance=? WHERE user_id=?').run(cardChest.price,id);
    const first=store.buyCardChest(id,receipt,catalog);
    const second=store.buyCardChest(id,receipt,[]);
    assert.deepEqual(first.cards,second.cards);
    assert.equal(first.cards.length,cardChest.count);
    assert.equal(first.user.coins,0);
    assert.equal(store.cardInventory(id).owned.reduce((sum,card)=>sum+card.quantity,0),cardChest.count);
    assert.equal(store.setFavoriteCard(id,first.cards[0]).favorite,first.cards[0]);
    assert.equal(store.setFavoriteCard(id,null).favorite,null);
  }finally{store.close();}
});

test('MF Ghost inventory unlocks with its campaign world and verified records pay once',async()=>{
  const store=new Store(':memory:');
  try{
    const {id}=await store.register('DealerPilot24','Dealer-test-password');
    store.updateProfile(id,{complete:true});
    const car=shopCars.find(car=>car.id==='gt86');
    store.db.prepare('UPDATE wallets SET balance=? WHERE user_id=?').run(car.price,id);
    assert.throws(()=>store.buy(id,'car',car.id),/MF Ghost/);
    const events=campaignEvents(),trial=events.indexOf(campaignEvent('trial-odawara'));
    assert.ok(trial>0);
    assert.equal(mfGhostDealerOpen(events.slice(0,trial-1).map(event=>event.id)),false);
    const grant=store.db.prepare('INSERT INTO campaign_progress(user_id,level_id,best_time,best_points,reward_coins,cleared_at) VALUES(?,?,0,0,0,0)');
    for(const event of events.slice(0,trial))grant.run(id,event.id);
    assert.equal(store.buy(id,'car',car.id).user.coins,0);
    const track=makeTrack(ALL_TRACKS[0]),race=createRace(CARS[0],track,{mode:'time'});
    Object.assign(race,{s:track.length,elapsed:20});
    assert.equal(store.addRun('too-short',id,race).reward.coins,0);
    race.elapsed=240;
    const base=store.addRun('clean',id,race).reward.coins;
    race.skill.points=12000;
    const bonus=store.addRun('skilled',id,race).reward.coins;
    assert.ok(base>0&&bonus>base&&bonus<=Math.round(base*1.06));
    assert.equal(store.addRun('skilled',id,race).user.coins,base+bonus);
  }finally{store.close();}
});
