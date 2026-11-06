/* Local processing of OSM waterway geometry. Shared by both map engines. */
(function(root){
 const rad=x=>x*Math.PI/180,R=6371000;
 const distance=(a,b)=>{const x=rad(b.lon-a.lon)*Math.cos(rad((a.lat+b.lat)/2)),y=rad(b.lat-a.lat);return R*Math.hypot(x,y);};
 function project(p,a,b){const k=Math.cos(rad(p.lat)),x=(b.lon-a.lon)*k,y=b.lat-a.lat,t=Math.max(0,Math.min(1,((p.lon-a.lon)*k*x+(p.lat-a.lat)*y)/(x*x+y*y||1)));const q={lat:a.lat+t*y,lon:a.lon+t*(b.lon-a.lon)};return {...q,t,d:distance(p,q)};}
 function parse(elements){
  const edges=[],nodes=new Map(),items=[];
  const point=g=>({lat:g.lat,lon:g.lon});
  for(const e of elements){const t=e.tags||{};if(e.type==='way'&&/^(canal|river|fairway)$/.test(t.waterway||'')&&e.geometry){for(let i=1;i<e.geometry.length;i++){const a=point(e.geometry[i-1]),b=point(e.geometry[i]),from=String(e.nodes?.[i-1]??`${a.lat},${a.lon}`),to=String(e.nodes?.[i]??`${b.lat},${b.lon}`);nodes.set(from,a);nodes.set(to,b);edges.push({from,to,a,b,length:distance(a,b)});}}
  }
  for(const e of elements){const t=e.tags||{};let type=t.waterway==='lock_gate'||t.lock==='yes'?'Écluse':t.waterway==='dam'?'Barrage':t.waterway==='weir'?'Seuil':t.bridge&&t.bridge!=='no'?'Pont':t.tunnel&&t.waterway?'Tunnel':null;if(!type)continue;
   const g=e.geometry||[],p=e.lat!==undefined?point(e):e.center?point(e.center):g.length?point(g[Math.floor(g.length/2)]):null;if(!p)continue;
   let candidate=p;if(type==='Pont'&&g.length){let best=null;for(const vertex of g){for(const edge of edges){const q=project(vertex,edge.a,edge.b);if(!best||q.d<best.d)best=q;}}// Long bridges often cross the channel halfway along a segment.
    for(let i=1;i<g.length;i++){const a=g[i-1],b=g[i];for(const edge of edges){const c=edge.a,d=edge.b,den=(b.lon-a.lon)*(d.lat-c.lat)-(b.lat-a.lat)*(d.lon-c.lon);if(Math.abs(den)<1e-16)continue;const u=((c.lon-a.lon)*(d.lat-c.lat)-(c.lat-a.lat)*(d.lon-c.lon))/den,v=((c.lon-a.lon)*(b.lat-a.lat)-(c.lat-a.lat)*(b.lon-a.lon))/den;if(u>=0&&u<=1&&v>=0&&v<=1){best={lat:a.lat+u*(b.lat-a.lat),lon:a.lon+u*(b.lon-a.lon),d:0};break;}}}
    if(!best||best.d>65)continue;candidate=best;
   }
   let near=null;for(let i=0;i<edges.length;i++){const q=project(candidate,edges[i].a,edges[i].b);if(!near||q.d<near.d)near={...q,edge:i};}
   if(type==='Pont'&&(!near||near.d>65))continue;
   const name=t.name||t['ref:vnf']||t.ref||type;
   // Gate pairs form one lock; do not display one entry per door.
   if(type==='Écluse'&&items.some(x=>x.type===type&&distance(x,candidate)<70&&(x.name===name||x.name===type||name===type)))continue;
   items.push({id:e.type+'/'+e.id,type,name,lat:candidate.lat,lon:candidate.lon,near:near&&near.d<120?near:null,clearance:t.maxheight||null,length:t.maxlength||null,width:t.maxwidth||null,opening:t.opening_hours||null});
  }
  return {edges,nodes,items};
 }
 function nearby(data,p,radius,heading){
  const {edges}=data;let start=null;edges.forEach((e,i)=>{let q=project(p,e.a,e.b);if(!start||q.d<start.d)start={...q,edge:i};});
  const costs=new Map(),adj=new Map();const add=(a,b,l)=>{if(!adj.has(a))adj.set(a,[]);adj.get(a).push([b,l]);};for(let i=0;i<edges.length;i++){if(start&&start.d<150&&i===start.edge)continue;const e=edges[i];add(e.from,e.to,e.length);add(e.to,e.from,e.length);}
  let route=start&&start.d<150;
  const bearing=(a,b)=>Math.atan2((b.lon-a.lon)*Math.cos(rad(a.lat)),b.lat-a.lat)*180/Math.PI;
  const ahead=q=>heading==null||Math.abs(((bearing(start,q)-heading+540)%360)-180)<=105;
  const queue=[];if(route){const e=edges[start.edge];if(ahead(e.a)){costs.set(e.from,start.t*e.length);queue.push(e.from);}if(ahead(e.b)){costs.set(e.to,(1-start.t)*e.length);queue.push(e.to);}}
  const done=new Set();while(queue.length){let best=0;for(let i=1;i<queue.length;i++)if(costs.get(queue[i])<costs.get(queue[best]))best=i;const id=queue.splice(best,1)[0];if(done.has(id))continue;done.add(id);const d=costs.get(id);if(d>radius)continue;for(const [to,l] of adj.get(id)||[]){const n=d+l;if(n<(costs.get(to)??Infinity)&&n<=radius){costs.set(to,n);queue.push(to);}}}
  const out=[];for(const item of data.items){let d=distance(p,item),mode='proximité';if(d>radius)continue;if(route&&item.near){if(item.near.edge===start.edge&&heading!=null&&!ahead(item.near))continue;const e=edges[item.near.edge],q=item.near;let along=Math.min((costs.get(e.from)??Infinity)+q.t*e.length,(costs.get(e.to)??Infinity)+(1-q.t)*e.length);if(item.near.edge===start.edge&&(heading==null||ahead(q)))along=Math.min(along,Math.abs(q.t-start.t)*e.length);if(!Number.isFinite(along)||along>radius)continue;d=along;mode='réseau';}out.push({...item,distance:d,mode});}return out.sort((a,b)=>a.distance-b.distance);
 }
 const api={distance,project,parse,nearby};root.NauticWaterways=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
