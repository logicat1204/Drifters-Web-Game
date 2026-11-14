import {worldAt} from './sim.mjs';

export const RACE_INTRO_SECONDS=3.4;
export function raceIntroCamera(race,seconds){
  const progress=Math.max(0,Math.min(1,seconds/RACE_INTRO_SECONDS));
  const fade=progress*progress*(3-2*progress),center=worldAt(race.track,17,0);
  const angle=center.heading+Math.PI*(.49+fade*.32),radius=19-fade*4;
  return {
    eye:[center.x+Math.sin(angle)*radius,center.y+12-fade*6,center.z+Math.cos(angle)*radius],
    target:[center.x,center.y+.7,center.z],fov:54
  };
}
