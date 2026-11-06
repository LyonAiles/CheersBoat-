/* Optional vector map, with explicit and automatic return to the original Leaflet map. */
(()=>{
 const $=id=>document.getElementById(id),native=window.NauticAndroid,W=window.NauticWaterways,I=window.NauticWorkIcons;
 const read=()=>{try{return JSON.parse(native?.readSetting('nautic-extensions')||localStorage.getItem('nautic-extensions')||'{}');}catch(_){return {};}};
 let options=read(),vector=null,loading=null,failed=false,active=false,request=0,cache=null,data=null,lastQuery=0,busy=false,lastList=[],lastRender='',lastCamera=null,lastWorksCompute=0;
 const wrap=$('mapWrap'),host=document.createElement('div');host.id='nauticVectorMap';host.style.cssText='position:absolute;inset:0;z-index:1;display:none';wrap.appendChild(host);
 const status=document.createElement('button');status.id='nauticWaterwayStatus';status.type='button';status.title='Ouvrages fluviaux à proximité';status.style.cssText='position:absolute;z-index:740;left:8px;top:8px;max-width:65%;font-size:11px;padding:5px 8px;background:#092f43e8';wrap.appendChild(status);
 const quiet=document.createElement('button');quiet.id='nauticMapQuiet';quiet.type='button';quiet.style.cssText='position:absolute;z-index:745;right:10px;top:200px;width:34px;height:34px;padding:3px;font-size:16px;background:#123b4de8';wrap.appendChild(quiet);
 function quietState(){const enabled=!!window.nauticQuietMode;quiet.textContent=enabled?'▶':'Ⅱ';quiet.title=enabled?'Reprendre les caméras et les mises à jour':'Carte prioritaire · figer les caméras';quiet.setAttribute('aria-label',quiet.title);quiet.setAttribute('aria-pressed',String(enabled));quiet.style.borderColor=enabled?'#a5eeaf':'#39718b';}
 quiet.onclick=()=>{window.nauticSetQuietMode?.(!window.nauticQuietMode);quietState();};window.addEventListener('nauticquietchange',quietState);quietState();
 function notice(text){status.textContent=text;}
 function fallback(message){request++;active=false;failed=true;host.style.display='none';$('map').style.visibility='visible';if(vector){vector.remove();vector=null;}window.nauticRestoreLegacy?.();lastRender='';renderWorks();if(message)notice(message+' · retour carte classique');}
 function library(){if(window.maplibregl)return Promise.resolve();if(loading)return loading;loading=new Promise((resolve,reject)=>{const css=document.createElement('link');css.rel='stylesheet';css.href='https://unpkg.com/maplibre-gl@5.6.1/dist/maplibre-gl.css';document.head.appendChild(css);const script=document.createElement('script');script.src='https://unpkg.com/maplibre-gl@5.6.1/dist/maplibre-gl.js';const timeout=setTimeout(()=>reject(Error('chargement trop long')),20000);script.onload=()=>{clearTimeout(timeout);resolve();};script.onerror=()=>{clearTimeout(timeout);reject(Error('bibliothèque indisponible'));};document.head.appendChild(script);}).finally(()=>{loading=null;});return loading;}
 async function start(){const generation=++request;try{await library();if(generation!==request||(options.mapEngine||'vector')!=='vector')return;host.style.display='block';
  const c=map?.getCenter()||{lat:47.5911,lng:2.7521};lastCamera=null;vector=new maplibregl.Map({container:host,style:'https://tiles.openfreemap.org/styles/liberty',center:[c.lng,c.lat],zoom:map?.getZoom()||14,attributionControl:true,dragPan:false,pitchWithRotate:false,maxPitch:45});
  vector.touchZoomRotate?.enableRotation();vector.dragRotate?.enable();
  vector.addControl(new maplibregl.NavigationControl({showCompass:false}),'bottom-right');let loaded=false;
  const timeout=setTimeout(()=>{if(!loaded&&generation===request)fallback('Fond vectoriel indisponible');},25000);
  vector.on('load',async()=>{if(generation!==request)return;clearTimeout(timeout);loaded=true;active=true;failed=false;$('map').style.visibility='hidden';map?.eachLayer(l=>{if(window.L&&l instanceof L.TileLayer)map.removeLayer(l);});
   for(const layer of vector.getStyle().layers||[])if(layer.type==='symbol'&&layer.layout?.['text-field']){vector.setLayoutProperty(layer.id,'text-rotation-alignment','viewport');vector.setLayoutProperty(layer.id,'text-pitch-alignment','viewport');vector.setLayoutProperty(layer.id,'symbol-placement','point');vector.setLayoutProperty(layer.id,'text-rotate',0);}
   vector.addSource('nautic-route',{type:'geojson',data:routeData()});vector.addLayer({id:'nautic-route',type:'line',source:'nautic-route',paint:{'line-color':'#20bce9','line-width':4}});
   await I.install(vector,()=>generation===request&&!!vector);if(generation!==request||!vector)return;
   const iconScale=I.expression(Number(options.waterwayIconSize)||120);
   vector.addSource('nautic-works',{type:'geojson',data:worksData(),cluster:true,clusterRadius:48,clusterMaxZoom:13});
   vector.addLayer({id:'nautic-work-backings',type:'circle',source:'nautic-works',filter:['!', ['has','point_count']],paint:{'circle-radius':4,'circle-color':'#17608c','circle-stroke-color':'white','circle-stroke-width':1}});
   vector.addLayer({id:'nautic-works',type:'symbol',source:'nautic-works',filter:['!', ['has','point_count']],layout:{'icon-image':['concat','nautic-',['get','category']],'icon-size':iconScale,'icon-allow-overlap':true,'icon-ignore-placement':true,'icon-rotation-alignment':'viewport','icon-pitch-alignment':'viewport'}});
   vector.addLayer({id:'nautic-work-clusters',type:'circle',source:'nautic-works',filter:['has','point_count'],paint:{'circle-radius':12,'circle-color':'#285b7b','circle-stroke-color':'white','circle-stroke-width':2}});
   vector.addLayer({id:'nautic-work-counts',type:'symbol',source:'nautic-works',filter:['has','point_count'],layout:{'text-field':['get','point_count_abbreviated'],'text-size':11,'text-allow-overlap':true,'text-rotation-alignment':'viewport'},paint:{'text-color':'white','text-halo-color':'#285b7b','text-halo-width':1}});
   vector.on('click','nautic-work-backings',e=>showItem(e.features?.[0]?.properties?.id));
   vector.on('click','nautic-work-clusters',()=>showList());
   vector.on('click','nautic-works',e=>showItem(e.features?.[0]?.properties?.id));sync();
  });
  vector.on('error',e=>{if(!loaded)notice('Chargement vectoriel…');});
  vector.getCanvas().addEventListener('webglcontextlost',e=>{e.preventDefault();fallback('Ressources graphiques insuffisantes');});
  vector.on('rotate',()=>{if(window.nauticMapInteracting){userMapRotation=(heading??0)-vector.getBearing();manualRotationUntil=Date.now()+8000;}});
  vector.on('rotateend',e=>{if(e.originalEvent||window.nauticMapInteracting){userMapRotation=(heading??0)-vector.getBearing();manualRotationUntil=Date.now()+8000;}});
  vector.on('zoomend',e=>{if((e.originalEvent||window.nauticMapInteracting)&&map)map.setZoom(vector.getZoom());});
 }catch(e){if(generation===request)fallback('Carte vectorielle non disponible');}}
 function routeData(){return {type:'FeatureCollection',features:points.length>1?[{type:'Feature',geometry:{type:'LineString',coordinates:points.map(p=>[p.lon,p.lat])},properties:{}}]:[]};}
 function worksData(){return {type:'FeatureCollection',features:(options.waterwayWorks===false?[]:lastList).map(p=>({type:'Feature',geometry:{type:'Point',coordinates:[p.lon,p.lat]},properties:{id:p.id,category:p.category||W.categoryOf(p.type)}}))};}
 let lastLegacyZoom=null;function sync(){if(window.nauticMapInteracting||!active||!vector||vector.isMoving?.())return;const c=smoothCenter||stableFix||latest;if(!c)return;const z=map?.getZoom(),bearing=(heading??0)-userMapRotation,h=wrap.clientHeight,zoomChanged=z!==lastLegacyZoom;const changed=!lastCamera||W.distance(c,lastCamera)>.8||Math.abs(((bearing-lastCamera.bearing+540)%360)-180)>.5||Math.abs(mapPitch-lastCamera.pitch)>.1||h!==lastCamera.h||zoomChanged;
 if(!changed)return;lastLegacyZoom=z;lastCamera={lat:c.lat,lon:c.lon,bearing,pitch:mapPitch,h};vector.jumpTo({...(zoomChanged&&z!=null?{zoom:z}:{}),center:[c.lon,c.lat],bearing,pitch:mapPitch,padding:{top:h/3,bottom:0,left:0,right:0}});$('compass').style.transform=`rotate(${bearing}deg)`;
 }

 function settings(next){options=next||read();lastQuery=0;if((options.mapEngine||'vector')==='legacy'){request++;failed=false;active=false;host.style.display='none';$('map').style.visibility='visible';if(vector){vector.remove();vector=null;}window.nauticRestoreLegacy?.();}else if(!vector){failed=false;start();}if(active&&vector?.getLayer('nautic-works')){const sizes=I.expression(Number(options.waterwayIconSize)||120);vector.setLayoutProperty('nautic-works','icon-size',sizes);}lastRender='';renderWorks();}
 window.nauticApplyNavigation=settings;
 window.addEventListener('nauticmapidle',()=>{sync();setTimeout(updateWorks,1200);});
 window.nauticEvery(sync,350,true);let routeCount=-1;window.nauticEvery(()=>{if(active&&vector&&points.length!==routeCount){routeCount=points.length;vector.getSource('nautic-route')?.setData(routeData());}updateWorks();},3000,true);
 new ResizeObserver(()=>{vector?.resize();sync();}).observe(wrap);
 function selectedSignature(){return W.categories.filter(([key])=>options.waterwayTypes?.[key]!==false).map(([key])=>key).join(',');}
 function visibleWorks(p,radius){return W.nearby(data,p,radius,null,true).filter(item=>options.waterwayTypes?.[item.category||W.categoryOf(item.type)]!==false);}
 function query(p,r){
  const area=`(around:${r},${p.lat},${p.lon})`,local=`(around:${Math.min(r,11500)},${p.lat},${p.lon})`,chosen=new Set(selectedSignature().split(',')),parts=[];
  if(chosen.has('lock'))parts.push(`nwr[waterway=lock_gate]${area};way[waterway][lock=yes]${area};`);
  if(chosen.has('port'))parts.push(`nwr[leisure=marina]${area};nwr[harbour~"^(yes|marina)$"]${area};nwr[industrial=port]${area};nwr["seamark:type"=harbour]${area};`);
  if(chosen.has('halt'))parts.push(`nwr[mooring][mooring!~"^(no|private)$"]${area};`);
  if(chosen.has('dam'))parts.push(`nwr[waterway=dam]${area};`);
  if(chosen.has('weir'))parts.push(`nwr[waterway=weir]${area};`);
  if(chosen.has('tunnel'))parts.push(`way[waterway][tunnel][tunnel!=no]${area};`);
  if(chosen.has('slipway'))parts.push(`nwr[leisure=slipway]${area};`);
  if(chosen.has('bridge'))parts.push('way(around.water:40)[bridge][bridge!=no][highway];way(around.water:40)[bridge][bridge!=no][railway];');
  // Only point centres cross the network for distant features; detailed geometry stays local.
  return `[out:json][timeout:45];way[waterway~"^(canal|river|fairway)$"]${chosen.has('bridge')?area:local}->.water;way[waterway~"^(canal|river|fairway)$"]${local}->.network;(${parts.join('')})->.poi;.poi out center;(.network;${chosen.has('bridge')?'way(around.network:40)[bridge][bridge!=no][highway];way(around.network:40)[bridge][bridge!=no][railway];':''});out body geom;`;
 }
 async function updateWorks(){if(options.waterwayWorks===false){status.hidden=true;lastList=[];renderWorks();return;}status.hidden=false;const p=stableFix||latest;if(!p){notice('Ouvrages · attente GPS');return;}const radius=Math.max(1000,Math.min(100000,Number(options.waterwayRadius)||5000));
  if(data&&(!window.nauticQuietMode||!lastList.length)&&Date.now()-lastWorksCompute>7000){lastWorksCompute=Date.now();lastList=visibleWorks(p,radius);renderWorks();}
  const signature=selectedSignature();if(!signature){lastList=[];renderWorks();notice('Aucun type d’ouvrage sélectionné');return;}const now=Date.now(),usable=cache&&cache.signature===signature&&cache.radius===radius&&W.distance(cache.center,p)<Math.min(1000,radius/3);
  if(usable&&now-cache.time<86400000){notice(`Ouvrages · ${lastList.length} · ${radius/1000} km${now-cache.time>600000?' · cache':''}`);return;}
  if(busy||now-lastQuery<120000)return;busy=true;lastQuery=now;notice('Recherche des ouvrages…');
  try{const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),55000);let response;try{response=await fetch('https://overpass-api.de/api/interpreter',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:'data='+encodeURIComponent(query(p,radius+1500)),signal:controller.signal});}finally{clearTimeout(timeout);}if(!response.ok)throw Error('HTTP '+response.status);await window.nauticMapIdle?.();const json=await response.json();await window.nauticMapIdle?.();if(!Array.isArray(json.elements)||json.remark)throw Error('Réponse incomplète');cache={center:{lat:p.lat,lon:p.lon},radius,signature,time:Date.now(),elements:json.elements};data=W.parse(cache.elements);try{localStorage.setItem('nautic-waterways-cache',JSON.stringify(cache));}catch(_){}lastList=visibleWorks(p,radius);lastRender='';renderWorks();notice('Ouvrages · '+lastList.length);
  }catch(e){notice(data?'Ouvrages · cache · réseau indisponible':'Ouvrages indisponibles · réessai automatique');}finally{busy=false;}}
 let legacyLayer=null;
 function classicMarkers(){const groups=new Map(),bounds=map.getBounds();for(const p of lastList){if(!bounds.contains([p.lat,p.lon]))continue;const pixel=map.project([p.lat,p.lon],map.getZoom()),key=Math.floor(pixel.x/45)+','+Math.floor(pixel.y/45);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(p);}
  return [...groups.values()].map(group=>{const lat=group.reduce((s,p)=>s+p.lat,0)/group.length,lon=group.reduce((s,p)=>s+p.lon,0)/group.length,size=I.size(map.getZoom(),Number(options.waterwayIconSize)||120),type=group.length>1?'group':group[0].category||W.categoryOf(group[0].type);const icon=L.divIcon({className:'nautic-work-marker',html:I.svg(type)+(group.length>1?'<span>'+group.length+'</span>':''),iconSize:[size,size],iconAnchor:[size/2,size/2]});return L.marker([lat,lon],{icon}).on('click',()=>{if(group.length===1)showItem(group[0].id);else showList(group);});});
 }
 function renderWorks(){const key=JSON.stringify([active,options.waterwayWorks,options.waterwayIconSize,!active&&map?map.getBounds().toBBoxString():'',lastList.map(x=>x.id).sort()]);if(key===lastRender)return;lastRender=key;vector?.getSource('nautic-works')?.setData(worksData());if(legacyLayer&&map){map.removeLayer(legacyLayer);legacyLayer=null;}if(!active&&window.L&&map&&options.waterwayWorks!==false)legacyLayer=L.layerGroup(classicMarkers()).addTo(map);}

 const esc=s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
 function info(p){return `<b>${esc(p.name)}</b> · ${esc(p.type)}<br>${(p.distance/1000).toFixed(2)} km · ${p.mode==='réseau'?'par le réseau d’eau (branche à confirmer)':'à vol d’oiseau'}${p.clearance?'<br>Hauteur déclarée OSM : '+esc(p.clearance):''}${p.width?'<br>Largeur déclarée : '+esc(p.width):''}${p.length?'<br>Longueur déclarée : '+esc(p.length):''}${p.opening?'<br>Horaires déclarés : '+esc(p.opening):''}`;}
 function showItem(id){const p=lastList.find(x=>x.id===id);if(!p)return;modal('Ouvrage fluvial',info(p)+'<p class="muted">Source : © contributeurs OpenStreetMap. Couverture et caractéristiques à vérifier auprès du gestionnaire. Les hauteurs ne tiennent pas compte du niveau d’eau du jour.</p>');}
 function showList(list=lastList){modal('Ouvrages autour du bateau',`<p class="muted">Périmètre : ${(Number(options.waterwayRadius)||5000)/1000} km. Réseau d’eau calculé quand raccordé ; bifurcations à confirmer. Source : © contributeurs OpenStreetMap, cache ${cache?new Date(cache.time).toLocaleString('fr-FR'):'absent'}.</p>`+(list.length?list.slice(0,200).map(p=>`<button type="button" data-work="${esc(p.id)}" style="display:block;width:100%;margin:6px 0;text-align:left">${info(p)}</button>`).join(''):'<p>Aucun ouvrage disponible dans ce périmètre.</p>'));$('dialogContent').querySelectorAll('[data-work]').forEach(b=>b.onclick=()=>showItem(b.dataset.work));}status.onclick=()=>showList();
 try{cache=JSON.parse(localStorage.getItem('nautic-waterways-cache')||'null');if(cache&&Array.isArray(cache.elements))data=W.parse(cache.elements);else cache=null;}catch(_){cache=null;}
 window.nauticVectorStatus=()=>({active,failed,engine:options.mapEngine||'vector'});
 settings(options);
})();
