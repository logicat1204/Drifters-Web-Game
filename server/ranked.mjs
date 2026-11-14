import {gzipSync} from 'node:zlib';

export const SEASON_LENGTH=30*24*60*60*1000;
export const RANKED_EPOCH=Date.UTC(2026,0,1);
export const seasonAt=now=>Math.max(0,Math.floor((now-RANKED_EPOCH)/SEASON_LENGTH));
export const settledBefore=now=>seasonAt(now-120000);
export const seasonBounds=id=>({id,startsAt:RANKED_EPOCH+id*SEASON_LENGTH,endsAt:RANKED_EPOCH+(id+1)*SEASON_LENGTH});
export const rankedAward=(place,points)=>place?{rating:[100,64,42,30][place-1],coins:[720,430,300,240][place-1]+Math.round(Math.min(1,Math.max(0,points)/12000)*[43,26,18,14][place-1])}:{rating:0,coins:0};
export const compressEvidence=evidence=>gzipSync(JSON.stringify(evidence),{level:1});

export function standings(matches){
  const totals=new Map();
  for(const match of matches)for(const result of match.results){
    const row=totals.get(result.userId)||{userId:result.userId,displayName:'',rating:0,races:0,wins:0,firstAt:match.finishedAt,lastAt:0};
    row.rating+=result.rating;
    row.races++;
    row.wins+=Number(result.place===1);
    row.firstAt=Math.min(row.firstAt,match.finishedAt);
    if(match.finishedAt>=row.lastAt){row.displayName=result.name;row.lastAt=match.finishedAt;}
    totals.set(result.userId,row);
  }
  return [...totals.values()].filter(row=>row.rating>0).sort((a,b)=>b.rating-a.rating||b.wins-a.wins||a.firstAt-b.firstAt||a.userId.localeCompare(b.userId))
    .map(({firstAt,lastAt,...row},i)=>({...row,rank:i+1}));
}
export function seasonAward(rank,count){
  const top=Math.max(1,Math.floor(count*.3)),middle=Math.min(count,top+Math.floor(count*.5));
  return rank<=top?{keys:2,coins:0}:rank<=middle?{keys:0,coins:3000}:{keys:0,coins:1000};
}
