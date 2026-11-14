// Pick the pilot whose slowest usable direct link has the lowest tail latency.
export function selectRaceHost(ids,reports){
  const links=(from,to)=>reports.get(from)?.find(link=>link.id===to);
  const candidates=[];
  for(const id of ids){
    let worst=0;
    for(const other of ids){
      if(other===id)continue;
      const outgoing=links(id,other),incoming=links(other,id);
      if([outgoing,incoming].some(link=>!link||!Number.isFinite(link.p95)||link.sent<16||link.received/link.sent<.85)){
        worst=Infinity;
        break;
      }
      worst=Math.max(worst,outgoing.p95,incoming.p95);
    }
    if(Number.isFinite(worst))candidates.push({id,worst});
  }
  return candidates.sort((a,b)=>a.worst-b.worst||a.id.localeCompare(b.id))[0]?.id??null;
}
