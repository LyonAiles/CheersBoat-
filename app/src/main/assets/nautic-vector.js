/* Optional vector map, with explicit and automatic return to the original Leaflet map. */
(()=>{
 const $=id=>document.getElementById(id),native=window.NauticAndroid,W=window.NauticWaterways,I=window.NauticWorkIcons;
 const read=()=>{try{return JSON.parse(native?.readSetting('nautic-extensions')||localStorage.getItem('nautic-extensions')||'{}');}catch(_){return {};}};
 let options=read(),vector=null,loading=null,failed=false,active=false,request=0,cache=null,data=null,lastQuery=0,busy=false,lastList=[],lastRender='',lastCamera=null,lastWorksCompute=0;
 let selectedWorkPoint=null;
 const wrap=$('mapWrap'),host=document.createElement('div');host.id='nauticVectorMap';host.style.cssText='position:absolute;inset:0;z-index:1;display:none';wrap.appendChild(host);
 const status=document.createElement('button');status.id='nauticWaterwayStatus';status.type='button';status.title='Ouvrages fluviaux · touche la carte pour rechercher ailleurs';status.style.cssText='position:absolute;z-index:740;left:8px;top:8px;max-width:65%;font-size:11px;padding:5px 8px;background:#092f43e8';wrap.appendChild(status);
 function notice(text){status.textContent=text;}
 function fallback(message){request++;active=false;failed=true;host.style.display='none';$('map').style.visibility='visible';if(vector){vector.remove();vector=null;}window.nauticRestoreLegacy?.();lastRender='';renderWorks();if(message)notice(message+' · retour carte classique');}
 function library(){if(window.maplibregl)return Promise.resolve();if(loading)return loading;loading=new Promise((resolve,reject)=>{const css=document.createElement('link');css.rel='stylesheet';css.href='https://unpkg.com/maplibre-gl@5.6.1/dist/maplibre-gl.css';document.head.appendChild(css);const script=document.createElement('script');script.src='https://unpkg.com/maplibre-gl@5.6.1/dist/maplibre-gl.js';const timeout=setTimeout(()=>reject(Error('chargement trop long')),20000);script.onload=()=>{clearTimeout(timeout);resolve();};script.onerror=()=>{clearTimeout(timeout);reject(Error('bibliothèque indisponible'));};document.head.appendChild(script);}).finally(()=>{loading=null;});return loading;}
 async function start(){const generation=++request;try{await library();if(generation!==request||(options.mapEngine||'vector')!=='vector')return;host.style.display='block';
  const c=map?.getCenter()||{lat:47.5911,lng:2.7521};lastCamera=null;vector=new maplibregl.Map({container:host,style:'https://tiles.openfreemap.org/styles/liberty',center:[c.lng,c.lat],zoom:map?.getZoom()||14,attributionControl:{compact:true},dragPan:true,pitchWithRotate:false,pitch:mapPitch,maxPitch:MAX_VECTOR_PITCH});
  vector.touchZoomRotate?.enableRotation();vector.dragRotate?.enable();
  vector.addControl(new maplibregl.NavigationControl({showCompass:false}),'bottom-right');let loaded=false;
  const timeout=setTimeout(()=>{if(!loaded&&generation===request)fallback('Fond vectoriel indisponible');},25000);
  vector.on('load',async()=>{if(generation!==request)return;
   const attribution=host.querySelector('details.maplibregl-ctrl-attrib');
   attribution?.classList.remove('maplibregl-compact-show');
   attribution?.removeAttribute('open');clearTimeout(timeout);loaded=true;active=true;failed=false;$('map').style.visibility='hidden';map?.eachLayer(l=>{if(window.L&&l instanceof L.TileLayer)map.removeLayer(l);});
   for(const layer of vector.getStyle().layers||[])if(layer.type==='symbol'&&layer.layout?.['text-field']){vector.setLayoutProperty(layer.id,'text-rotation-alignment','viewport');vector.setLayoutProperty(layer.id,'text-pitch-alignment','viewport');vector.setLayoutProperty(layer.id,'symbol-placement','point');vector.setLayoutProperty(layer.id,'text-rotate',0);}
   vector.addSource('nautic-route',{type:'geojson',data:routeData()});vector.addLayer({id:'nautic-route',type:'line',source:'nautic-route',paint:{'line-color':'#20bce9','line-width':4}});
   vector.addSource('nautic-trip', {type:'geojson', data:tripData()});
   const tripLines={type:'line',source:'nautic-trip',paint:{'line-color':['get','color'],'line-width':4}};
   vector.addLayer({...tripLines,id:'nautic-trip-line',filter:['all',['==','$type','LineString'],['==','dash',false]]});
   vector.addLayer({...tripLines,id:'nautic-trip-estimate',filter:['all',['==','$type','LineString'],['==','dash',true]],
    paint:{...tripLines.paint,'line-dasharray':[2,2]}});
   vector.addLayer({id:'nautic-trip-end',type:'circle',source:'nautic-trip',filter:['==','$type','Point'],paint:{'circle-radius':6,'circle-color':['get','color'],'circle-stroke-width':2,'circle-stroke-color':'#092f43'}});
   vector.on('click', e => {
    if (!selection || e.originalEvent?.target?.closest('.maplibregl-ctrl')) return;
    selectDestination(e.lngLat);
    e.preventDefault();
   });
   await I.install(vector,()=>generation===request&&!!vector);if(generation!==request||!vector)return;
   const iconScale=I.expression(Number(options.waterwayIconSize)||120);
   vector.addSource('nautic-works',{type:'geojson',data:worksData(),cluster:true,clusterRadius:48,clusterMaxZoom:13});
   vector.addLayer({id:'nautic-work-backings',type:'circle',source:'nautic-works',filter:['!', ['has','point_count']],paint:{'circle-radius':4,'circle-color':'#17608c','circle-stroke-color':'white','circle-stroke-width':1}});
   vector.addLayer({id:'nautic-works',type:'symbol',source:'nautic-works',filter:['!', ['has','point_count']],layout:{'icon-image':['concat','nautic-',['get','category']],'icon-size':iconScale,'icon-allow-overlap':true,'icon-ignore-placement':true,'icon-rotation-alignment':'viewport','icon-pitch-alignment':'viewport'}});
   vector.addLayer({id:'nautic-work-clusters',type:'circle',source:'nautic-works',filter:['has','point_count'],paint:{'circle-radius':12,'circle-color':'#285b7b','circle-stroke-color':'white','circle-stroke-width':2}});
   vector.addLayer({id:'nautic-work-counts',type:'symbol',source:'nautic-works',filter:['has','point_count'],layout:{'text-field':['get','point_count_abbreviated'],'text-size':11,'text-allow-overlap':true,'text-rotation-alignment':'viewport'},paint:{'text-color':'white','text-halo-color':'#285b7b','text-halo-width':1}});
   vector.on('click','nautic-work-backings',e=>{if(!e.defaultPrevented)showItem(e.features?.[0]?.properties?.id);});
   vector.on('click','nautic-work-clusters',e=>{if(!e.defaultPrevented)showList();});
   vector.on('click','nautic-works',e=>{if(!e.defaultPrevented)showItem(e.features?.[0]?.properties?.id);});
   vector.on('click',e=>{
    if(e.defaultPrevented||e.originalEvent?.target?.closest('.maplibregl-marker,.maplibregl-ctrl'))return;
    const layers=['nautic-works','nautic-work-backings','nautic-work-clusters'];
    if(!vector.queryRenderedFeatures(e.point,{layers}).length)selectWorkPoint(e.lngLat);
   });
   sync();
  });
  vector.on('error',e=>{if(!loaded)notice('Chargement vectoriel…');});
  vector.getCanvas().addEventListener('webglcontextlost',e=>{e.preventDefault();fallback('Ressources graphiques insuffisantes');});
  vector.on('dragstart',()=>{window.nauticMapFreePan=true;});vector.on('move',()=>{if(window.nauticMapFreePan)positionBoat();});
  vector.on('rotate',()=>{if(window.nauticMapInteracting){userMapRotation=(heading??0)-vector.getBearing();manualRotationUntil=Date.now()+8000;}});
  vector.on('rotateend',e=>{if(e.originalEvent||window.nauticMapInteracting){userMapRotation=(heading??0)-vector.getBearing();manualRotationUntil=Date.now()+8000;}});
  vector.on('zoomend',e=>{if(e.originalEvent||window.nauticMapInteracting){if(map)map.setZoom(vector.getZoom());}});
 }catch(e){if(generation===request)fallback('Carte vectorielle non disponible');}}
 const destinationButton = document.createElement('button');
 destinationButton.type = 'button';
 destinationButton.id = 'nauticDestination';
 const destinationStatus = document.createElement('span');
 destinationStatus.id = 'nauticDestinationStatus';
 destinationStatus.setAttribute('role', 'status');
 wrap.append(destinationButton, destinationStatus);
 const tripKey='nautic-last-trip-v1', networkKey='nautic-trip-network-v1';
 const calc=window.NauticTrip;
 const validPoint=p=>p&&Number.isFinite(p.lat)&&Number.isFinite(p.lon)&&Math.abs(p.lat)<=90&&Math.abs(p.lon)<=180;
 let routeState=restoreTrip(), selection=null, tripRequest=null, lastSave=0;
 const formatKm=new Intl.NumberFormat('fr-FR',{minimumFractionDigits:1,maximumFractionDigits:1});
 const formatPk=new Intl.NumberFormat('fr-FR',{maximumFractionDigits:3});
 const formatDate=new Intl.DateTimeFormat('fr-FR',{dateStyle:'medium'});
 const km=value=>formatKm.format(value)+' km';

 function restoreTrip(){
  try{
   const saved=JSON.parse(native?.readSetting(tripKey)||localStorage.getItem(tripKey)||'null');
   if(!saved||!validPoint(saved.start)||!validPoint(saved.end)||!Array.isArray(saved.via)||!saved.via.every(validPoint)||
    !Array.isArray(saved.trip?.coordinates)||!saved.trip.coordinates.length||!saved.trip.coordinates.every(validPoint)||
    !Number.isFinite(saved.trip.total)||saved.trip.total<0||!Number.isFinite(saved.covered)||saved.covered<0)return null;
   saved.closures=Array.isArray(saved.closures)?saved.closures.filter(c=>c&&((!c.from&&!c.to)||(validPoint(c.from)&&validPoint(c.to)))):saved.closure?[saved.closure]:[];
   delete saved.closure;
   return saved;
  }catch(_){return null;}
 }
 function saveTrip(){
  const json=JSON.stringify(routeState);
  try{localStorage.setItem(tripKey,json);}catch(_){}
  try{native?.writeSetting(tripKey,json);}catch(_){}
  lastSave=Date.now();
 }

 function cachedRoute(start,end){
  let local;
  try{local=JSON.parse(localStorage.getItem(networkKey)||'null');}catch(_){}
  const bundled=window.NauticLocalWaterways||[];
  const downloaded=[...(cache?.elements||[]),...(Array.isArray(local)?local:[])];
  for(const [elements,note,limit] of [
   [downloaded,'Réseau en cache',undefined],
   [bundled,'Voie d’eau embarquée · OpenStreetMap',1000],
   [[...bundled,...downloaded],'Tracé OpenStreetMap en cache',undefined]
  ]){
   if(!elements.length)continue;
   try{
    const trip=calc.fromNetwork(elements,start,end,limit);
    if(trip)return {trip,note};
   }catch(_){}
  }
  return null;
 }
 function sectionColor(closed){
  return closed?'#ff715e':routeState.trip.approximate?'#bdc5d2':'#f6dc76';
 }
 function tripData(){
  if(!routeState)return {type:'FeatureCollection',features:[]};
  const {trip,closures}=routeState;
  const xy=p=>[p.lon,p.lat];
  const segments=calc.sections(trip,closures);
  const properties=closed=>({color:sectionColor(closed),dash:!!trip.approximate});
  const features=segments.map(segment=>({type:'Feature',properties:properties(segment.closed),
   geometry:{type:'LineString',coordinates:segment.coordinates.map(xy)}}));
  features.push({type:'Feature',properties:properties(!!segments.at(-1)?.closed),
   geometry:{type:'Point',coordinates:xy(trip.coordinates.at(-1))}});
  return {type:'FeatureCollection',features};
 }
 const legacyTrip=map?L.geoJSON(null,{
  style:feature=>({color:feature.properties.color,weight:4,dashArray:feature.properties.dash?'8 8':null,interactive:false}),
  pointToLayer:(feature,position)=>L.circleMarker(position,{
   radius:6,color:'#092f43',fillColor:feature.properties.color,fillOpacity:1,interactive:false
  })
 }).addTo(map):null;
 function renderTrip(){
  const data=tripData();
  legacyTrip?.clearLayers();
  legacyTrip?.addData(data);
  vector?.getSource('nautic-trip')?.setData(data);
  renderTripCounters();
  showDestination(selection?selectionPrompt(selection.type):tripSummary());
 }
 function renderTripCounters(){
  for(const [id,label,value] of [
   ['tripCovered','Distance parcourue',(routeState?.covered||0)/1000],
   ['tripRemaining','Distance restante',routeState?calc.remaining(routeState.trip.total,routeState.covered):0]
  ]){
   const element=$(id),text=routeState?km(value):'—';
   if(element.textContent===text)continue;
   element.textContent=text;
   element.setAttribute('aria-label',label+' : '+(routeState?text:'indisponible'));
  }
 }
 function showDestination(message=''){
  destinationButton.textContent=selection?'Annuler le choix':'Destination';
  destinationButton.setAttribute('aria-pressed',String(!!selection));
  wrap.classList.toggle('nautic-select-destination',!!selection);
  destinationStatus.textContent=message;
  destinationStatus.hidden=!message;
  destinationStatus.style.borderLeft=routeState?'3px solid '+sectionColor(routeState.closures.length>0||routeState.trip.restricted):'';
 }
 function tripSummary(){
  if(!routeState)return '';
  const {trip,closures,note}=routeState;
  const distance=(trip.estimated?'≈ ':'')+km(trip.total);
  const parts=[];
  if(closures.length){
   parts.push(closures.length===1?'Un tronçon fermé':closures.length+' tronçons fermés');
   const dates=[...new Set(closures.map(closureDate))];
   parts.push(dates.length===1?dates[0]:'Dates dans Destination');
  }
  if(trip.restricted)parts.push(trip.closedEdges?'Restriction OpenStreetMap':'Restriction à localiser');
  if(trip.approximate)parts.push('Tracé indicatif');
  if(note)parts.push(note);
  if(trip.pk!=null)parts.push('Arrivée PK '+formatPk.format(trip.pk));
  parts.push(distance);
  return parts.join(' · ');
 }
 function closureDate(closure){
  const date=closure.date?new Date(closure.date+'T12:00:00'):null;
  return date&&Number.isFinite(+date)?'Réouverture prévue '+formatDate.format(date):'Réouverture inconnue';
 }
 function selectionPrompt(type){
  if(type==='start')return 'Touche le point de départ';
  if(type==='via')return 'Touche un point avant l’arrivée';
  if(type==='closureStart')return 'Touche le début du tronçon fermé sur le tracé';
  if(type==='closureEnd')return 'Touche la fin du tronçon fermé sur le tracé';
  return 'Touche la destination';
 }
 function choose(type,start=null){
  selection={type,start};
  showDestination(selectionPrompt(type));
 }

 destinationButton.onclick=()=>{
  if(selection){selection=null;showDestination(tripSummary());return;}
  if(!routeState){choose(stableFix?'end':'start');return;}
  modal('Destination',
   '<button type="button" id="tripFit">Voir le parcours</button> '+
   '<button type="button" id="tripChange">Nouvelle destination</button> '+
   '<button type="button" id="tripChooseStart">Choisir le départ sur la carte</button> '+
   (routeState.trip.approximate?'<button type="button" id="tripVia">Ajouter un point au tracé indicatif</button> ':'')+
   '<button type="button" id="tripClosure">Signaler un tronçon fermé</button> '+
   routeState.closures.map((closure,i)=>'<button type="button" data-trip-closure="'+i+'">'+
    (closure.from?'Tronçon '+(i+1):'Parcours entier')+' · '+closureDate(closure)+'</button> ').join('')+
   '<button type="button" id="tripClear">Effacer le trajet</button>');
  $('tripFit').onclick=()=>{$('dialog').close();fitTrip();};
  $('tripChange').onclick=()=>{$('dialog').close();choose(stableFix?'end':'start');};
  $('tripChooseStart').onclick=()=>{$('dialog').close();choose('start');};
  if($('tripVia'))$('tripVia').onclick=()=>{$('dialog').close();choose('via');};
  $('tripClosure').onclick=()=>{$('dialog').close();choose('closureStart');};
  $('dialog').querySelectorAll('[data-trip-closure]').forEach(button=>{
   button.onclick=()=>editClosure(routeState.closures[Number(button.dataset.tripClosure)],Number(button.dataset.tripClosure));
  });
  $('tripClear').onclick=()=>{
   $('dialog').close();
   tripRequest?.abort();tripRequest=null;
   routeState=null;saveTrip();renderTrip();
  };
 };
 function fitTrip(){
  const points=routeState.trip.coordinates;
  window.nauticMapFreePan=true;
  if(active&&vector){
   const bounds=new maplibregl.LngLatBounds();
   for(const point of points)bounds.extend([point.lon,point.lat]);
   vector.fitBounds(bounds,{padding:32,maxZoom:16,duration:0});
  }else if(map){
   map.fitBounds(points.map(p=>[p.lat,p.lon]),{padding:[24,24],maxZoom:16,animate:false});
  }
 }
 function editClosure(closure,index=null){
  modal('Fermeture du tronçon','<p>Reporte la date annoncée dans l’avis de navigation si elle est connue.</p>'+
   '<p><a href="https://avisbat.vnf.fr/" target="_blank" rel="noopener">Consulter Avisbat (VNF)</a></p>'+
   '<label>Réouverture prévue <input id="tripReopenDate" type="date"></label> '+
   '<button type="button" id="tripSaveClosure">Enregistrer la fermeture</button> '+
   (index===null?'':'<button type="button" id="tripClearClosure">Retirer cette fermeture</button>'));
  $('tripReopenDate').value=closure.date||'';
  $('tripSaveClosure').onclick=()=>{
   const saved={...closure,date:$('tripReopenDate').value};
   if(index===null)routeState.closures.push(saved);
   else routeState.closures[index]=saved;
   $('dialog').close();saveTrip();renderTrip();
  };
  if($('tripClearClosure'))$('tripClearClosure').onclick=()=>{
   routeState.closures.splice(index,1);$('dialog').close();saveTrip();renderTrip();
  };
 }

 async function selectDestination(position){
  const next=selection;
  if(!next)return;
  selection=null;
  const chosen={lat:position.lat,lon:position.lng};
  if(next.type==='start'){choose('end',chosen);return;}
  if(next.type==='closureStart'||next.type==='closureEnd'){
   const coordinates=routeState.trip.coordinates;
   const hit=calc.locate(coordinates,chosen);
   if(!hit||hit.distance>300){
    selection=next;showDestination('Point trop éloigné du tracé · '+selectionPrompt(next.type));return;
   }
   if(next.type==='closureStart'){choose('closureEnd',hit.point);return;}
   const start=calc.locate(coordinates,next.start);
   if(!start||Math.abs(hit.offset-start.offset)<1){
    selection=next;showDestination('Choisis une fin distincte sur le tracé');return;
   }
   showDestination(tripSummary());
   editClosure({from:start.point,to:hit.point,date:''});return;
  }
  if(next.type==='via'&&routeState){
   tripRequest?.abort();tripRequest=null;
   routeState.via.push(chosen);
   routeState.trip=calc.approximate(routeState.start,routeState.end,routeState.via);
   saveTrip();renderTrip();return;
  }
  const departure=next.start||stableFix;
  if(!departure){choose('start');return;}
  tripRequest?.abort();
  const controller=new AbortController();
  tripRequest=controller;
  const start={lat:departure.lat,lon:departure.lon},end=chosen;
  const cached=cachedRoute(start,end);
  routeState={start,end,via:[],trip:cached?.trip||calc.approximate(start,end),closures:[],covered:0,
   note:cached?.note||'Réseau fluvial indisponible'};
  saveTrip();renderTrip();
  const timeout=setTimeout(()=>controller.abort(),50000);
  try{
   const distance=W.distance(start,end);
   const margin=Math.max(.025,distance/111000*.35);
   const lonMargin=margin/Math.max(.15,Math.cos((start.lat+end.lat)*Math.PI/360));
   const area=[Math.min(start.lat,end.lat)-margin,Math.min(start.lon,end.lon)-lonMargin,
    Math.max(start.lat,end.lat)+margin,Math.max(start.lon,end.lon)+lonMargin].map(n=>n.toFixed(5)).join(',');
   const query='[out:json][timeout:40];(way[waterway~"^(canal|river|fairway)$"]('+area+
    ');node["seamark:distance_mark:distance"]('+area+'););out geom;';
   const response=await fetch('https://overpass-api.de/api/interpreter',{
    method:'POST',body:new URLSearchParams({data:query}),signal:controller.signal
   });
   if(!response.ok)throw Error('Overpass '+response.status);
   const result=await response.json();
   if(tripRequest!==controller)return;
   if(result.remark||!Array.isArray(result.elements))throw Error('Réseau incomplet');
   const planned=calc.fromNetwork(result.elements,start,end);
   if(planned){
    routeState.trip=planned;routeState.note='';
    try{const json=JSON.stringify(result.elements);if(json.length<1800000)localStorage.setItem(networkKey,json);}catch(_){}
   }else routeState.note=cached?.note||'Réseau fluvial non raccordé';
   saveTrip();renderTrip();
  }catch(_){
   // Keep the immediately available estimate or cached route, including manual closures.
  }finally{
   clearTimeout(timeout);
   if(tripRequest===controller)tripRequest=null;
  }
 }

 window.nauticTripGpsLeg=metres=>{
  if(!routeState)return;
  routeState.covered+=metres;
  renderTripCounters();
  if(Date.now()-lastSave>15000)saveTrip();
 };
 window.addEventListener('pagehide',()=>{if(routeState)saveTrip()});
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&routeState)saveTrip()});
 renderTrip();
 function routeData(){return {type:'FeatureCollection',features:points.length>1?[{type:'Feature',geometry:{type:'LineString',coordinates:points.map(p=>[p.lon,p.lat])},properties:{}}]:[]};}
 function worksData(){return {type:'FeatureCollection',features:(options.waterwayWorks===false?[]:lastList).map(p=>({type:'Feature',geometry:{type:'Point',coordinates:[p.lon,p.lat]},properties:{id:p.id,category:p.category||W.categoryOf(p.type)}}))};}
 function positionBoat(){const boat=$('mapBoat'),p=stableFix||latest;if(!boat||!p)return;if(!window.nauticMapFreePan){boat.style.setProperty('left','50%','important');boat.style.setProperty('top','66.666667%','important');return;}let q;if(active&&vector)q=vector.project([p.lon,p.lat]);else if(map){q=map.latLngToContainerPoint([p.lat,p.lon]);const r=$('map').getBoundingClientRect(),w=wrap.getBoundingClientRect();q={x:q.x+r.left-w.left,y:q.y+r.top-w.top};}if(q){const angle=active&&vector?(heading??0)-vector.getBearing():(heading??0);boat.style.transform=`translate(-50%,-50%) rotate(${angle}deg)`;boat.style.setProperty('left',q.x+'px','important');boat.style.setProperty('top',q.y+'px','important');}}
 window.nauticPositionBoat=positionBoat;window.addEventListener('nauticmapfollow',()=>{selectedWorkPoint=null;lastWorksCompute=0;lastCamera=null;sync();updateWorks();});
 window.nauticPreviewWorkSize=percent=>{options={...options,waterwayIconSize:percent};if(active&&vector?.getLayer('nautic-works'))vector.setLayoutProperty('nautic-works','icon-size',I.expression(percent));lastRender='';renderWorks();};
 let lastLegacyZoom=null;function sync(){positionBoat();if(window.nauticMapFreePan||window.nauticMapInteracting||!active||!vector||vector.isMoving?.())return;const c=smoothCenter||stableFix||latest;if(!c)return;const z=map?.getZoom(),bearing=(heading??0)-userMapRotation,h=wrap.clientHeight,zoomChanged=z!==lastLegacyZoom;const changed=!lastCamera||W.distance(c,lastCamera)>.8||Math.abs(((bearing-lastCamera.bearing+540)%360)-180)>.5||Math.abs(mapPitch-lastCamera.pitch)>.1||h!==lastCamera.h||zoomChanged;
 if(!changed)return;lastLegacyZoom=z;lastCamera={lat:c.lat,lon:c.lon,bearing,pitch:mapPitch,h};vector.jumpTo({...(zoomChanged&&z!=null?{zoom:z}:{}),center:[c.lon,c.lat],bearing,pitch:mapPitch,padding:{top:h/3,bottom:0,left:0,right:0}});$('compass').style.transform=`rotate(${bearing}deg)`;
 }

 function settings(next){options=next||read();lastQuery=0;if((options.mapEngine||'vector')==='legacy'){request++;failed=false;active=false;host.style.display='none';$('map').style.visibility='visible';if(vector){vector.remove();vector=null;}window.nauticRestoreLegacy?.();}else if(!vector){failed=false;start();}if(active&&vector?.getLayer('nautic-works')){const sizes=I.expression(Number(options.waterwayIconSize)||120);vector.setLayoutProperty('nautic-works','icon-size',sizes);}lastRender='';renderWorks();}
 window.nauticApplyNavigation=settings;
 window.nauticApplyMapPitch=()=>{
  if(!vector)return;
  vector.setPitch(mapPitch);
  lastCamera=null;
 };
 window.addEventListener('nauticvisibility', () => {
  if (!destinationButton.classList.contains('nautic-hidden')) return;
  selection=null;
  showDestination(tripSummary());
 });
 window.addEventListener('nauticmapidle',()=>{sync();setTimeout(updateWorks,1200);});
 window.nauticEvery(sync,350,true);let routeCount=-1;window.nauticEvery(()=>{if(active&&vector&&points.length!==routeCount){routeCount=points.length;vector.getSource('nautic-route')?.setData(routeData());}updateWorks();},3000,true);
 new ResizeObserver(()=>{vector?.resize();sync();}).observe(wrap);
 function selectedSignature(){return W.categories.filter(([key])=>options.waterwayTypes?.[key]!==false).map(([key])=>key).join(',');}
 function selectWorkPoint(point){
  if(options.waterwayWorks===false)return;
  selectedWorkPoint={lat:point.lat,lon:point.lng};
  lastWorksCompute=0;
  updateWorks();
 }
 map?.on('click', e => {
  if (active) return;
  if (selection) selectDestination(e.latlng);
  else selectWorkPoint(e.latlng);
 });
 function workArea(){
  const radius=Math.max(1000,Math.min(100000,Number(options.waterwayRadius)||5000));
  return {p:selectedWorkPoint||stableFix||latest,radius,selected:!!selectedWorkPoint};
 }
 function visibleWorks({p,radius,selected}){
  if(!data||!p)return [];
  const items=selected?data.items.map(item=>({...item,distance:W.distance(p,item),mode:'proximité'}))
   .filter(item=>item.distance<=radius).sort((a,b)=>a.distance-b.distance):W.nearby(data,p,radius,null,true);
  return items.filter(item=>options.waterwayTypes?.[item.category||W.categoryOf(item.type)]!==false);
 }
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
 async function updateWorks(){if(options.waterwayWorks===false){status.hidden=true;lastList=[];renderWorks();return;}status.hidden=false;const area=workArea(),{p,radius}=area;if(!p){notice('Ouvrages · attente GPS');return;}
  if(data&&(!window.nauticQuietMode||!lastList.length)&&Date.now()-lastWorksCompute>7000){lastWorksCompute=Date.now();lastList=visibleWorks(area);renderWorks();}
  const signature=selectedSignature();if(!signature){lastList=[];renderWorks();notice('Aucun type d’ouvrage sélectionné');return;}const now=Date.now(),usable=cache&&cache.signature===signature&&W.distance(cache.center,p)+radius<=cache.radius+1000;
  if(usable&&now-cache.time<86400000){notice(`Ouvrages · ${lastList.length} · ${radius/1000+' km'+(selectedWorkPoint?' · point choisi':'')}${now-cache.time>600000?' · cache':''}`);return;}
  if(busy||now-lastQuery<(selectedWorkPoint?15000:120000))return;busy=true;lastQuery=now;notice('Recherche des ouvrages…');
  try{const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),55000);let response;try{response=await fetch('https://overpass-api.de/api/interpreter',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:'data='+encodeURIComponent(query(p,radius+1500)),signal:controller.signal});}finally{clearTimeout(timeout);}if(!response.ok)throw Error('HTTP '+response.status);await window.nauticMapIdle?.();const json=await response.json();await window.nauticMapIdle?.();if(!Array.isArray(json.elements)||json.remark)throw Error('Réponse incomplète');cache={center:{lat:p.lat,lon:p.lon},radius,signature,time:Date.now(),elements:json.elements};data=W.parse(cache.elements);try{localStorage.setItem('nautic-waterways-cache',JSON.stringify(cache));}catch(_){}lastList=visibleWorks(workArea());lastRender='';renderWorks();notice('Ouvrages · '+lastList.length);
  }catch(e){notice(data?'Ouvrages · cache · réseau indisponible':'Ouvrages indisponibles · réessai automatique');}finally{busy=false;}}
 let legacyLayer=null;
 function classicMarkers(){const groups=new Map(),bounds=map.getBounds();for(const p of lastList){if(!bounds.contains([p.lat,p.lon]))continue;const pixel=map.project([p.lat,p.lon],map.getZoom()),key=Math.floor(pixel.x/45)+','+Math.floor(pixel.y/45);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(p);}
  return [...groups.values()].map(group=>{const lat=group.reduce((s,p)=>s+p.lat,0)/group.length,lon=group.reduce((s,p)=>s+p.lon,0)/group.length,size=I.size(map.getZoom(),Number(options.waterwayIconSize)||120),type=group.length>1?'group':group[0].category||W.categoryOf(group[0].type);const icon=L.divIcon({className:'nautic-work-marker',html:I.svg(type)+(group.length>1?'<span>'+group.length+'</span>':''),iconSize:[size,size],iconAnchor:[size/2,size/2]});return L.marker([lat,lon],{icon}).on('click',()=>{if(group.length===1)showItem(group[0].id);else showList(group);});});
 }
 function renderWorks(){const key=JSON.stringify([active,options.waterwayWorks,options.waterwayIconSize,!active&&map?map.getBounds().toBBoxString():'',lastList.map(x=>x.id).sort()]);if(key===lastRender)return;lastRender=key;vector?.getSource('nautic-works')?.setData(worksData());if(legacyLayer&&map){map.removeLayer(legacyLayer);legacyLayer=null;}if(!active&&window.L&&map&&options.waterwayWorks!==false)legacyLayer=L.layerGroup(classicMarkers()).addTo(map);}

 const esc=s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
 function info(p){return `<b>${esc(p.name)}</b> · ${esc(p.type)}<br>${(p.distance/1000).toFixed(2)} km · ${p.mode==='réseau'?'par le réseau d’eau (branche à confirmer)':'à vol d’oiseau'}${p.clearance?'<br>Hauteur déclarée OSM : '+esc(p.clearance):''}${p.width?'<br>Largeur déclarée : '+esc(p.width):''}${p.length?'<br>Longueur déclarée : '+esc(p.length):''}${p.opening?'<br>Horaires déclarés : '+esc(p.opening):''}`;}
 function showItem(id){const p=lastList.find(x=>x.id===id);if(!p)return;modal('Ouvrage fluvial',info(p)+'<p class="muted">Source : © contributeurs OpenStreetMap. Couverture et caractéristiques à vérifier auprès du gestionnaire. Les hauteurs ne tiennent pas compte du niveau d’eau du jour.</p>');}
 function showList(list=lastList){modal(selectedWorkPoint?'Ouvrages autour du point choisi':'Ouvrages autour du bateau', (options.waterwayTypes?.sondeurAlert === false ? '' : '<button type="button" id="waterwaySondeurAlerts">Points d’alerte du sondeur</button>')+`<p class="muted">Périmètre : ${(Number(options.waterwayRadius)||5000)/1000} km. Réseau d’eau calculé quand raccordé ; bifurcations à confirmer. Source : © contributeurs OpenStreetMap, cache ${cache?new Date(cache.time).toLocaleString('fr-FR'):'absent'}.</p>`+(list.length?list.slice(0,200).map(p=>`<button type="button" data-work="${esc(p.id)}" style="display:block;width:100%;margin:6px 0;text-align:left">${info(p)}</button>`).join(''):'<p>Aucun ouvrage disponible dans ce périmètre.</p>'));const alertsButton=$('waterwaySondeurAlerts');if(alertsButton)alertsButton.onclick=()=>{$('dialog').close();$('sondeurAlertList')?.click();};$('dialogContent').querySelectorAll('[data-work]').forEach(b=>b.onclick=()=>showItem(b.dataset.work));}status.onclick=()=>showList();
 try{cache=JSON.parse(localStorage.getItem('nautic-waterways-cache')||'null');if(cache&&Array.isArray(cache.elements))data=W.parse(cache.elements);else cache=null;}catch(_){cache=null;}
 if(routeState&&((routeState.trip.approximate&&!routeState.via.length)||(!routeState.trip.approximate&&!routeState.trip.closedEdges))){
  const updated=cachedRoute(routeState.start,routeState.end);
  if(updated){Object.assign(routeState,updated);saveTrip();renderTrip();}
 }
 window.nauticFocusSondeurAlert = ({lat, lon}) => {
  window.nauticMapFreePan = true;
  if (active && vector) vector.easeTo({center:[lon, lat], padding:{top:0,bottom:0,left:0,right:0}});
  else if (map) {
   rotateMap();
   const viewportCenter = map.project([lat, lon]).add(L.point(0, wrap.clientHeight / 6));
   map.panTo(map.unproject(viewportCenter));
  }
  positionBoat();
 };
 window.nauticCaptureSondeurMap = async ({lat, lon}) => {
  if (!(active && vector) && !map) throw Error('Carte indisponible');
  window.nauticMapFreePan = true;
  const radius = 5000;
  const latDelta = radius / 110574;
  const lonDelta = radius / (111320 * Math.cos(lat * Math.PI / 180));
  const south = Math.max(-85, lat - latDelta), north = Math.min(85, lat + latDelta);
  if (active && vector) {
   const camera = vector.cameraForBounds([[lon-lonDelta,south],[lon+lonDelta,north]], {
    padding:{top:32,bottom:32,left:32,right:32}, bearing:0
   });
   vector.jumpTo({center:[lon,lat], zoom:camera.zoom, pitch:0, bearing:0, padding:{top:0,bottom:0,left:0,right:0}});
  } else {
   rotateMap();
   const width = Math.max(1, wrap.clientWidth - 64), height = Math.max(1, wrap.clientHeight - 64);
   const northwest = map.project([north, lon-lonDelta], 0);
   const southeast = map.project([south, lon+lonDelta], 0);
   const zoom = Math.min(map.getMaxZoom(), Math.floor(Math.log2(Math.min(width/(southeast.x-northwest.x),height/(southeast.y-northwest.y)))));
   const center = map.project([lat, lon], zoom).add(L.point(0, wrap.clientHeight / 6));
   map.setView(map.unproject(center, zoom), zoom, {animate:false});
  }
  const pin = document.createElement('span');
  pin.className = 'sondeur-map-alert';
  pin.textContent = '!';
  pin.style.cssText = 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:950;display:grid;place-items:center;pointer-events:none';
  const captureEngine = active ? vector : null;
  const workLayer = 'nautic-works';
  const originalIconSize = captureEngine?.getLayer(workLayer)
   ? captureEngine.getLayoutProperty(workLayer, 'icon-size') : null;
  if (originalIconSize != null) captureEngine.setLayoutProperty(workLayer, 'icon-size', ['*', 0.65, originalIconSize]);
  wrap.classList.add('sondeur-mail-map');
  wrap.append(pin);
  await new Promise(resolve => {
   if (!(active && vector)) { setTimeout(resolve, 1600); return; }
   const engine = vector;
   const timeout = setTimeout(() => { engine.off('idle', ready); resolve(); }, 2500);
   function ready() { clearTimeout(timeout); resolve(); }
   engine.once('idle', ready);
   engine.triggerRepaint();
  });
  return () => {
   pin.remove();
   wrap.classList.remove('sondeur-mail-map');
   if (originalIconSize != null && vector === captureEngine && vector.getLayer(workLayer)) {
    vector.setLayoutProperty(workLayer, 'icon-size', originalIconSize);
   }
  };
 };
 let alertEngine = null;
 let alertMarkers = new Map();
 function syncSondeurAlerts() {
  const engine = active && vector ? vector : map;
  if (engine !== alertEngine) {
   for (const marker of alertMarkers.values()) marker.remove();
   alertMarkers.clear();
   alertEngine = engine;
  }
  if (!engine) return;
  const entries = options.waterwayTypes?.sondeurAlert === false ? [] : (window.nauticSondeurAlertPoints?.() || []);
  const keys = new Set(entries.map(entry => entry.time));
  for (const [key, marker] of alertMarkers) {
   if (!keys.has(key)) { marker.remove(); alertMarkers.delete(key); }
  }
  for (const entry of entries) {
   if (alertMarkers.has(entry.time)) continue;
   const {lat, lon} = entry.gps;
   if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
   const pin = document.createElement('button');
   pin.type = 'button';
   pin.className = 'sondeur-map-alert' + (entry.simulated ? ' simulated' : '');
   pin.textContent = '!';
   pin.title = (entry.simulated ? 'Alerte fictive' : 'Alerte de profondeur') + ' · ' + new Date(entry.time).toLocaleTimeString('fr-FR') + ' · ' + entry.depth.toLocaleString('fr-FR') + ' m';
   pin.setAttribute('aria-label', pin.title);
   pin.onclick = event => { event.stopPropagation(); window.nauticFocusSondeurAlert(entry.gps); };
   const marker = active && vector
    ? new maplibregl.Marker({element:pin}).setLngLat([lon, lat]).addTo(vector)
    : L.marker([lat, lon], {icon:L.divIcon({className:'sondeur-alert-icon',html:pin,iconSize:[24,24]})}).addTo(map);
   alertMarkers.set(entry.time, marker);
  }
 }
 window.nauticEvery(syncSondeurAlerts, 1000, true);
 window.nauticVectorStatus=()=>({active,failed,engine:options.mapEngine||'vector'});
 settings(options);
})();
