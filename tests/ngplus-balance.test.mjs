import assert from 'node:assert/strict';
import { test } from 'node:test';
import { campaignConditions, campaignStages } from '../js/campaign.mjs';
import { activateFocus } from '../js/focus.mjs';
import { ALL_CARS, ALL_TRACKS, createRace, makeTrack, updateRace } from '../js/sim.mjs';
import { driverInput, kanataLateInput } from './helpers/reference-driver.mjs';

const stages = campaignStages('ngplus');
const tracks = new Map(ALL_TRACKS.map(config => [config.id, makeTrack(config)]));
const fullBuild = { engine: 3, chassis: 3, brakes: 3 };

function driveDuel(stage, carId, { line = -2.3, gripUse = .94 } = {}) {
  const car = ALL_CARS.find(entry => entry.id === carId);
  const race = createRace(car, tracks.get(stage.track), {
    ...campaignConditions(stage),
    rival: stage,
    mode: 'campaign',
    campaignStage: stage.id,
    build: fullBuild,
    focusEnabled: true,
    focusType: 'time'
  });
  race.countdown = 0;

  const finalDuel = stage.baseId === 'kanata-final';
  let railImpacts = 0;
  for (let tick = 0; tick < 108000 && !race.finished; tick++) {
    const attacking = !finalDuel || race.track.length - race.s < 220;
    if (attacking && race.focus.charge >= 60) activateFocus(race);
    const input = finalDuel
      ? kanataLateInput(race, { line, followGap: 10, gripUse })
      : driverInput(race, { line, gripUse });
    const previousWallCooldown = race.wallCooldown;
    updateRace(race, input, 1 / 120);
    if (race.wallCooldown > previousWallCooldown + .1) railImpacts++;
  }

  const gap = Math.round(race.s - race.rivalS);
  assert.ok(race.finished && race.won, `${stage.id}, ${carId}, gap ${gap} m`);
  return railImpacts;
}

test('one fully upgraded R34 can win all 24 NG+ duels with a practiced line and focus', () => {
  const strategies = {
    godfoot: { gripUse: .95 },
    'takumi-project': { line: 2.3 },
    nozomi: { line: 2.3 },
    jackson: { line: -1.7, gripUse: .93 },
    beckenbauer: { line: 1.7, gripUse: .93 },
    'kanata-final': { line: 2.3 }
  };
  assert.equal(stages.length, 24);
  for (const stage of stages) driveDuel(stage, 'r34', strategies[stage.baseId]);
});

test('agile and balanced Tier 3 cars have clean winning lines against NG+ elites', () => {
  const keisuke = stages.find(stage => stage.baseId === 'keisuke-project');
  const beckenbauer = stages.find(stage => stage.baseId === 'beckenbauer');
  assert.equal(driveDuel(keisuke, 'ae86carbon'), 0, 'AE86 Project D kept clear of the rails');
  assert.equal(driveDuel(beckenbauer, 'gt3rs', { line: 1.7, gripUse: .93 }), 0, 'GT3 RS kept clear of the rails');
});
