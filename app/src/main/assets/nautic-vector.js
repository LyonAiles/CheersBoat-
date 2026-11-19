/* Optional vector map, with explicit and automatic return to the original Leaflet map. */
(()=>{
 const $=id=>document.getElementById(id),native=window.NauticAndroid,W=window.NauticWaterways,I=window.NauticWorkIcons;
 const read=()=>{try{return JSON.parse(native?.readSetting('nautic-extensions')||localStorage.getItem('nautic-extensions')||'{}');}catch(_){return {};}};
 let options=read(),vector=null,loading=null,failed=false,active=false,request=0,cache=null,data=null,lastQuery=0,busy=false,lastList=[],lastRender='',lastCamera=null,lastWorksCompute=0;
 let selectedWorkPoint=null,localTileEntries=new Map(),workRegions=[],workMoveTimer=null;
 function viewportWorks(){
  if(!window.nauticMapFreePan)return;
  clearTimeout(workMoveTimer);workMoveTimer=setTimeout(()=>{
   const c=(active&&vector?vector:map)?.getCenter();if(!c)return;
   selectedWorkPoint={lat:c.lat,lon:c.lng};lastWorksCompute=0;lastRender='';
   if(data){lastList=visibleWorks(workArea());renderWorks();}
   updateWorks();
  },650);
 }
 map?.on('moveend',viewportWorks);
 const wrap=$('mapWrap'),host=document.createElement('div');host.id='nauticVectorMap';host.style.cssText='position:absolute;inset:0;z-index:1;display:none';wrap.appendChild(host);
 const status=document.createElement('button');status.id='nauticWaterwayStatus';status.type='button';status.title='Ouvrages fluviaux · touche la carte pour rechercher ailleurs';status.style.cssText='position:absolute;z-index:740;left:8px;bottom:88px;max-width:65%;font-size:11px;padding:5px 8px';wrap.appendChild(status);
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
   vector.addSource('nautic-accessible',{type:'geojson',data:accessData});
   vector.addLayer({id:'nautic-accessible',type:'line',source:'nautic-accessible',
    paint:{'line-color':['match',['get','status'],'insufficient','#ef4742','compatible','#3be577','#697788'],
     'line-width':['match',['get','status'],'unknown',3,5],
     'line-opacity':['match',['get','status'],'compatible',.65,.85]}});
   vector.addSource('nautic-trip', {type:'geojson', data:tripData()});
   vector.addLayer({id:'nautic-trip-line',type:'line',source:'nautic-trip',
    filter:['==','$type','LineString'],paint:{'line-color':['get','color'],'line-width':4}});
   vector.addLayer({id:'nautic-trip-end',type:'circle',source:'nautic-trip',filter:['all',['==','$type','Point'],['!has','vigilance']],paint:{'circle-radius':6,'circle-color':['get','color'],'circle-stroke-width':2,'circle-stroke-color':'#092f43'}});
   vector.on('click', e => {
    if (!selection || e.originalEvent?.target?.closest('.maplibregl-ctrl')) return;
    selectDestination(e.lngLat);
    e.preventDefault();
   });
   await I.install(vector,()=>generation===request&&!!vector);if(generation!==request||!vector)return;
   const iconScale=I.expression(Number(options.waterwayIconSize)||120);
   vector.addSource('nautic-works',{type:'geojson',data:worksData(),cluster:true,clusterRadius:64,clusterMaxZoom:22,maxzoom:24});
   vector.addLayer({id:'nautic-work-backings',type:'circle',source:'nautic-works',filter:['!', ['has','point_count']],paint:{'circle-radius':4,'circle-color':'#17608c','circle-stroke-color':'white','circle-stroke-width':1}});
   vector.addLayer({id:'nautic-works',type:'symbol',source:'nautic-works',filter:['!', ['has','point_count']],layout:{'icon-image':['get','icon'],'icon-size':iconScale,'icon-allow-overlap':false,'icon-ignore-placement':false,'icon-rotation-alignment':'viewport','icon-pitch-alignment':'viewport'}});
   vector.addLayer({id:'nautic-work-clusters',type:'circle',source:'nautic-works',filter:['has','point_count'],paint:{'circle-radius':12,'circle-color':'#285b7b','circle-stroke-color':'white','circle-stroke-width':2}});
   vector.addLayer({id:'nautic-work-counts',type:'symbol',source:'nautic-works',filter:['has','point_count'],layout:{'text-field':['get','point_count_abbreviated'],'text-size':11,'text-allow-overlap':true,'text-rotation-alignment':'viewport'},paint:{'text-color':'white','text-halo-color':'#285b7b','text-halo-width':1}});
   vector.on('click','nautic-work-backings',e=>{if(!e.defaultPrevented)showItem(e.features?.[0]?.properties?.id);});
   vector.on('click','nautic-work-clusters',async e=>{
    if(e.defaultPrevented)return;
    try{const leaves=await vector.getSource('nautic-works').getClusterLeaves(e.features[0].properties.cluster_id,200,0);
     const ids=new Set(leaves.map(f=>f.properties.id));showList(mapWorks().filter(p=>ids.has(p.id)));
    }catch(_){showList(mapWorks());}
   });
   vector.on('click','nautic-works',e=>{if(!e.defaultPrevented)showItem(e.features?.[0]?.properties?.id);});
   vector.on('click',e=>{
    if(e.defaultPrevented||e.originalEvent?.target?.closest('.maplibregl-marker,.maplibregl-ctrl'))return;
    const marker=vector.queryRenderedFeatures(e.point,{layers:['nautic-trip-vigilance']})[0];
    if(marker&&showVigilance(marker.properties))return;
    const layers=['nautic-works','nautic-work-backings','nautic-work-clusters'];
    if(vector.queryRenderedFeatures(e.point,{layers}).length)return;
    const {x,y}=e.point;
    const red=vector.queryRenderedFeatures([[x-7,y-7],[x+7,y+7]],{layers:['nautic-accessible']})
     .find(feature=>feature.properties.status==='insufficient');
    if(red&&showAccessLimit(red.properties.section))return;
    selectWorkPoint(e.lngLat);
   });
   vector.addLayer({id:'nautic-trip-vigilance',type:'symbol',source:'nautic-trip',
    filter:['all',['==','$type','Point'],['has','vigilance']],
    layout:{'icon-image':['concat','nautic-',['get','vigilance']],'icon-size':0.6,
     'icon-allow-overlap':true,'icon-ignore-placement':true,'icon-rotation-alignment':'viewport','icon-pitch-alignment':'viewport'}});
   sync();
  });
  vector.on('error',e=>{if(!loaded)notice('Chargement vectoriel…');});
  vector.getCanvas().addEventListener('webglcontextlost',e=>{e.preventDefault();fallback('Ressources graphiques insuffisantes');});
  vector.on('moveend',viewportWorks);
  vector.on('dragstart',()=>{window.nauticMapFreePan=true;});vector.on('move',()=>{if(window.nauticMapFreePan)positionBoat();});
  vector.on('rotate',()=>{if(window.nauticMapInteracting){userMapRotation=(heading??0)-vector.getBearing();manualRotationUntil=Date.now()+8000;}});
  vector.on('rotateend',e=>{if(e.originalEvent||window.nauticMapInteracting){userMapRotation=(heading??0)-vector.getBearing();manualRotationUntil=Date.now()+8000;}});
  vector.on('zoomend',e=>{if(e.originalEvent||window.nauticMapInteracting){if(map)map.setZoom(vector.getZoom());}});
 }catch(e){if(generation===request)fallback('Carte vectorielle non disponible');}}
 const destinationButton = document.createElement('button');
 destinationButton.type = 'button';
 destinationButton.id = 'nauticDestination';
 let destinationInfoDismissed=false;
 const destinationStatus = document.createElement('button');
 destinationStatus.type='button';
 destinationStatus.id = 'nauticDestinationStatus';
 destinationStatus.title='Masquer les informations du trajet';
 const tripProgress=document.createElement('progress');
 tripProgress.id='nauticTripProgress';tripProgress.hidden=true;
 tripProgress.setAttribute('aria-label','Calcul du trajet fluvial en cours');
 const signButton=document.createElement('button');
 signButton.type='button';signButton.id='nauticSignButton';signButton.textContent='Panneaux';
 signButton.hidden=options.waterwayTypes?.notice===false;
 wrap.append(destinationButton,tripProgress,destinationStatus,signButton);
 const refreshWorks=document.createElement('button');refreshWorks.type='button';refreshWorks.id='nauticRefreshWorks';
 refreshWorks.textContent='↻';refreshWorks.title='586 · Actualiser les ouvrages et panneaux de la zone affichée';
 refreshWorks.style.cssText='position:absolute;z-index:800;left:8px;bottom:48px;min-width:32px;min-height:32px;padding:3px 7px';
 wrap.append(refreshWorks);
 const dataCounter=document.createElement('button');dataCounter.id='nauticDataCounter';dataCounter.type='button';
 dataCounter.textContent='Mémoire locale · comptage…';
 dataCounter.style.cssText='position:absolute;z-index:740;left:8px;bottom:132px;max-width:65%;font-size:10px;padding:4px 7px';
 wrap.append(dataCounter);let storedStats=null;
 function updateDataCounter(){native?.navigationDataStats?.();}
 window.nauticNavigationStats=raw=>{
  try{storedStats=JSON.parse(raw);}catch(_){storedStats=null;}
  dataCounter.textContent=storedStats&&Number.isFinite(storedStats.lots)?
   `Mémoire · ${storedStats.lots} lots · ${storedStats.objects} objets · ${(storedStats.bytes/1048576).toLocaleString('fr-FR',{maximumFractionDigits:1})} Mo`:'Mémoire locale · compteur indisponible';
 };
 dataCounter.onclick=()=>{
  const s=storedStats||{},date=n=>n?new Date(n).toLocaleString('fr-FR'):'aucune';
  modal('Données enregistrées',`<p>${s.lots??'—'} lots · ${s.objects??'—'} objets OSM uniques (ouvrages, panneaux et géométrie des voies d’eau).</p><p>${s.partialLots||0} lots partiels à compléter. Un lot partiel ne garantit pas la couverture de toute sa zone.</p>`+
   `<p>Volume des données : ${((s.bytes||0)/1048576).toLocaleString('fr-FR',{maximumFractionDigits:2})} Mo. Les fichiers et index de la base occupent un peu plus.</p>`+
   (s.importError?'<p>Import local : '+esc(s.importError)+'</p>':'')+
   `<p>Lot le plus ancien : ${date(s.oldest)}<br>Lot le plus récent : ${date(s.newest)}</p>`+
   '<p>Selon disponibilité : noms, types, GPS, géométrie, téléphones, VHF, sites, adresses, dimensions déclarées, horaires et codes de panneaux.</p>'+
   '<p>Les tarifs disponibles sont conservés avec les lots. Les avis VNF sont mémorisés séparément avec leur date de vérification. La météo, les images caméra et le fond de carte ne font pas partie de ce compteur.</p>');
 };
 updateDataCounter();
 refreshWorks.onclick=async()=>{
  if(refreshWorks.disabled)return;
  const c=(active&&vector?vector:map)?.getCenter();if(!c)return;
  selectedWorkPoint={lat:c.lat,lon:c.lng};lastQuery=0;lastWorksCompute=0;
  if(cache)cache={...cache,time:0};
  refreshWorks.disabled=true;refreshWorks.textContent='…';
  try{await updateWorks(true);if(!native?.syncNavigationTile)await updateSigns(true);}
  finally{refreshWorks.disabled=false;refreshWorks.textContent='↻';}
 };

 const tripKey='nautic-last-trip-v1', networkKey='nautic-trip-network-v1';
 const calc=window.NauticTrip, notices=window.NauticNotices;
 const archiveKey='nautic-saved-trips-v1';
 let archive={trips:[],selected:[]}, displayed=[],noticeStatus='';
 try{
  const saved=JSON.parse(native?.readSetting(archiveKey)||localStorage.getItem(archiveKey)||'null');
  if(Array.isArray(saved?.trips))archive={
   trips:saved.trips.filter(item=>typeof item?.name==='string'&&item.trip?.coordinates?.length>1),
   selected:Array.isArray(saved.selected)?saved.selected:[]
  };
 }catch(_){}
 function storeArchive(next){
  try{
   const json=JSON.stringify(next);
   if(native?.writeSetting){if(!native.writeSetting(archiveKey,json))return false;}
   else localStorage.setItem(archiveKey,json);
   archive=next;return true;
  }catch(_){return false;}
 }
 const liveNotices={};
 const noticeMemoryKey='nautic-vnf-notice-memory';
 let noticeVerifiedAt=0,noticeFromMemory=false;
 let noticePending=false,lastNoticeCheck=0,noticeDay=notices.dateInFrance();
 try{
  const memory=JSON.parse(native?.readSetting(noticeMemoryKey)||localStorage.getItem(noticeMemoryKey)||'null');
  if(memory&&Number.isFinite(memory.checkedAt)&&memory.checkedAt>0&&memory.checkedAt<=Date.now()){
   Object.assign(liveNotices,notices.verifyResponse(memory.items));noticeVerifiedAt=memory.checkedAt;
   lastNoticeCheck=memory.checkedAt;noticeFromMemory=true;
  }
 }catch(_){}
 const validPoint=p=>p&&Number.isFinite(p.lat)&&Number.isFinite(p.lon)&&Math.abs(p.lat)<=90&&Math.abs(p.lon)<=180;
 let routeState=restoreTrip(), selection=null, tripRequest=null, lastSave=0;
 const formatKm=new Intl.NumberFormat('fr-FR',{minimumFractionDigits:1,maximumFractionDigits:1});
 const formatPk=new Intl.NumberFormat('fr-FR',{maximumFractionDigits:3});
 const formatDate=new Intl.DateTimeFormat('fr-FR',{dateStyle:'medium'});
 const km=value=>formatKm.format(value)+' km';

 function restoreTrip(){
  try{
   const saved=JSON.parse(native?.readSetting(tripKey)||localStorage.getItem(tripKey)||'null');
   if(!saved||!validPoint(saved.start)||!validPoint(saved.end)||!Number.isFinite(saved.covered)||saved.covered<0)return null;
   if(saved.trip?.approximate||!Array.isArray(saved.trip?.coordinates)||!saved.trip.coordinates.length||
    !saved.trip.coordinates.every(validPoint)||!Number.isFinite(saved.trip.total)||saved.trip.total<0){
    saved.trip=null;saved.note='Impossible de calculer le trajet fluvial';
   }
   delete saved.via;
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

 const arrivalLimit=5000;
 const fairways=window.NauticEuris?.network(window.NauticEurisRows||[])||[];
 delete window.NauticEurisRows;
 const euris=window.NauticEuris;
 const fairwayCatalog=euris?.catalog(fairways);
 let impactSnapshot=window.NauticEurisSeed||{},impacts=[],impactPending=false,checkedScopes='',impactCheckedAt=0,eurisStatus='';
 const accessible=window.NauticAccessible;
 const france=fairways.filter(section=>section.scope.startsWith('FR'));
 const accessKey='nautic-accessible-waterways';
 let accessProfile={enabled:false,draught:150,air:345,width:430};
 try{
  const saved=JSON.parse(native?.readSetting(accessKey)||localStorage.getItem(accessKey)||'null');
  if(saved&&['draught','air','width'].every(key=>Number.isFinite(saved[key])&&saved[key]>0))accessProfile={enabled:!!saved.enabled,draught:saved.draught,air:saved.air,width:saved.width};
 }catch(_){}
 let accessData={type:'FeatureCollection',features:[]};
 const accessStatus=document.createElement('button');
 accessStatus.type='button';
 accessStatus.id='nauticAccessibleStatus';accessStatus.hidden=true;accessStatus.title='Masquer le bilan des gabarits';
 accessStatus.onclick=()=>{accessStatus.hidden=true;};
 wrap.append(accessStatus);
 const fairwayNames=new Map(france.map(section=>[section.sourceId,section.tags.name]));
 function showAccessLimit(section){
  if(selection||$('dialog').open)return false;
  const limits=accessible.exceeded(window.NauticClearances?.[section],accessProfile);
  if(!limits.length)return false;
  const labels={draught:'Tirant d’eau',air:'Tirant d’air',width:'Largeur'};
  const metres=cm=>(cm/100).toLocaleString('fr-FR',{maximumFractionDigits:2})+' m';
  modal('Hors gabarit',
   '<p><strong>'+esc(fairwayNames.get(section)||section)+'</strong><br><small>Section EuRIS '+esc(section)+'</small></p><ul>'+
   limits.map(({key,value,limit})=>{
    const source=window.NauticClearanceSources?.[section]?.[key];
    const origin=source?'Ouvrage associé : '+esc(source[0])+' · '+esc(source[1]):'Limite de la section EuRIS';
    return '<li><strong>'+labels[key]+'</strong> · bateau '+metres(value)+
     ' · limite '+metres(limit)+' · '+(value===limit?'aucune marge':'dépassement de '+metres(value-limit))+
     '<br><small>'+origin+'</small></li>';
   }).join('')+
   '</ul><small>Gabarit de référence EuRIS</small>'+
   (limits.some(item=>window.NauticClearanceSources?.[section]?.[item.key]?.[1]==='FRXXXVE128BRGA100012')
    ?'<p>Pont levant de Frontignan : la VNF indique 0,95 m en position normale et 4,75 m en position haute. Le passage peut nécessiter une levée.</p>':''));

  return true;
 }
 const legacyAccessible=map?L.geoJSON(null,{
  style:feature=>{
   const status=feature.properties.status;
   return {color:status==='insufficient'?'#ef4742':status==='unknown'?'#697788':'#3be577',
    weight:status==='unknown'?3:5,opacity:status==='compatible'?.65:.85,interactive:status==='insufficient'};
  },
  onEachFeature:(feature,layer)=>{
   if(feature.properties.status!=='insufficient')return;
   layer.on('click',event=>{
    if(showAccessLimit(feature.properties.section))L.DomEvent.stopPropagation(event);
   });
  }
 }).addTo(map):null;
 function updateAccessible(){
  const result=accessProfile.enabled
   ?accessible.compatibleSections(france,window.NauticClearances||{},accessProfile)
   :{features:[],unverified:[],insufficient:[]};
  accessStatus.textContent=result.features.length+' tronçons compatibles en France'+
   (result.unverified.length?' · '+result.unverified.length+' à vérifier (gris)':'')+
   (result.insufficient.length?' · '+result.insufficient.length+' hors gabarit (rouge)':'');
  accessStatus.hidden=!accessProfile.enabled;
  accessData={type:'FeatureCollection',features:[...result.unverified,...result.features,...result.insufficient]};
  legacyAccessible?.clearLayers();legacyAccessible?.addData(accessData);
  vector?.getSource('nautic-accessible')?.setData(accessData);
 }
 function saveAccessProfile(){
  const saved=JSON.stringify(accessProfile);
  try{localStorage.setItem(accessKey,saved);}catch(_){}
  try{native?.writeSetting(accessKey,saved);}catch(_){}
 }
 function accessSettings(){
  modal('Voies accessibles','<form id="nauticAccessForm">'+
   '<label class="nautic-access-choice"><input type="checkbox" id="nauticAccessEnabled"> Afficher les voies compatibles en France</label>'+
   '<div class="nautic-access-fields">'+
   '<label>Tirant d’eau (m)<input id="nauticAccessDraught" type="number" min="0.01" max="50" step="0.01" required></label>'+
   '<label>Tirant d’air (m)<input id="nauticAccessAir" type="number" min="0.01" max="50" step="0.01" required></label>'+
   '<label>Largeur (m)<input id="nauticAccessWidth" type="number" min="0.01" max="100" step="0.01" required></label></div>'+
   '<p>Vert : gabarit compatible selon les données disponibles. Gris : gabarit à vérifier. Rouge : touche le tronçon pour consulter ses limites. Les fermetures figurent dans les avis du trajet.</p>'+
   '<button type="submit">Appliquer</button></form>');
  const fields={draught:$('nauticAccessDraught'),air:$('nauticAccessAir'),width:$('nauticAccessWidth')};
  const enabled=$('nauticAccessEnabled');
  enabled.checked=accessProfile.enabled;
  for(const [key,input] of Object.entries(fields))input.value=accessProfile[key]/100;
  $('nauticAccessForm').onsubmit=event=>{
   event.preventDefault();
   accessProfile={enabled:enabled.checked};
   for(const [key,input] of Object.entries(fields))accessProfile[key]=Math.round(input.valueAsNumber*100);
   saveAccessProfile();
   $('dialog').close();updateAccessible();renderTrip();
  };
 }
 const impactCacheKey='nautic-euris-route-impacts';
 const impactMetaKey=impactCacheKey+'-verification';
 let impactVerifiedAt=0,impactFromMemory=false;
 try{
  const snapshot=JSON.parse(native?.readSetting(impactCacheKey)||'null');
  if(euris&&snapshot){
   impactSnapshot=euris.merge(impactSnapshot,snapshot);
   eurisStatus='Derniers avis EuRIS mémorisés';impactFromMemory=true;
   const meta=JSON.parse(native?.readSetting(impactMetaKey)||localStorage.getItem(impactMetaKey)||'null');
   if(meta&&Number.isFinite(meta.checkedAt)&&meta.checkedAt<=Date.now()){
    impactVerifiedAt=meta.checkedAt;impactCheckedAt=meta.checkedAt;checkedScopes=typeof meta.scopes==='string'?meta.scopes:'';
   }
  }
 }catch(_){}
 if(euris)impacts=euris.compile(impactSnapshot,fairwayCatalog,calc);
 function routeImpacts(trip){
  return euris?.matching(trip,impacts,fairwayCatalog,calc)||[];
 }
 function verifiedEdges(trip,legacy=applicableNotices(trip)){
  return [...notices.closedEdges(trip,legacy),...routeImpacts(trip)
   .filter(item=>item.active&&item.closure).flatMap(item=>item.indices)];
 }
 function checkRouteImpacts(force=false){
  if(!native?.checkRouteImpacts||impactPending||!fairwayCatalog)return;
  const trips=displayed.length?displayed:[routeState];
  const scopes=[...new Set(trips.flatMap(item=>(item?.trip?.wayIds||[])
   .map(id=>fairwayCatalog.sections.get(id)).filter(id=>/^(FR|BE)/.test(id))))].sort();
  if(!scopes.length)return;
  const key=scopes.join(',');
  if(!force&&key===checkedScopes&&Date.now()-impactCheckedAt<20*60*1000)return;
  checkedScopes=key;impactPending=true;impactCheckedAt=Date.now();
  eurisStatus='Actualisation EuRIS…';
  native.checkRouteImpacts(JSON.stringify(scopes));
 }
 window.nauticRouteImpacts=raw=>{
  impactPending=false;
  try{
   const feed=JSON.parse(raw);
   if(!Array.isArray(feed.scopes))throw Error('EuRIS incomplet');
   impactSnapshot=euris.merge(impactSnapshot,feed);
   impacts=euris.compile(impactSnapshot,fairwayCatalog,calc);
   native?.writeSetting(impactCacheKey,JSON.stringify(impactSnapshot));
   impactVerifiedAt=Date.now();impactFromMemory=false;
   const meta=JSON.stringify({checkedAt:impactVerifiedAt,scopes:Array.isArray(feed.scopes)?[...feed.scopes].sort().join(','):checkedScopes});
   try{native?.writeSetting(impactMetaKey,meta);localStorage.setItem(impactMetaKey,meta);}catch(_){}
   eurisStatus='Avis EuRIS consultés';
  }catch(_){eurisStatus=impacts.length?'EuRIS indisponible · derniers avis mémorisés':'EuRIS indisponible';}
  renderTrip();
  if($('dialog').open&&$('nauticRefreshNotices'))showNavigationNotices();
 };
 function cachedRoute(start,end){
  let local;
  try{local=JSON.parse(localStorage.getItem(networkKey)||'null');}catch(_){}
  const bundled=window.NauticLocalWaterways||[], regional=window.NauticRegionalWaterways||[];
  const sources=[
   [fairways,'Réseau embarqué · EuRIS / Rijkswaterstaat'],
   [bundled,'Voie d’eau embarquée · OpenStreetMap'],
   [regional,'Voie d’eau embarquée · OpenStreetMap'],
   [[...(cache?.elements||[]),...(Array.isArray(local)?local:[])],'Réseau en cache']
  ];
  for(const [elements,note] of sources){
   if(!elements.length)continue;
   try{
    const trip=calc.fromNetwork(elements,start,end,arrivalLimit);
    if(trip)return {trip,note};
   }catch(_){}
  }
  return null;
 }
 function sectionColor(state){
  return state==='closed'?'#ff4a42':state==='open'?'#42d67a':'#a4b0bc';
 }
 function currentClosures(closures){
  return closures.filter(closure=>!closure.date||closure.date>noticeDay);
 }
 function applicableNotices(trip=routeState?.trip){
  return notices.relevant(trip,liveNotices,noticeDay);
 }
 function checkNavigationNotices(force=false){
  if(window.nauticDataUpdating)return;
  checkRouteImpacts(force);
  const trips=displayed.length?displayed:[routeState];
  if(!native?.checkNavigationNotices||noticePending||(!force&&Date.now()-lastNoticeCheck<20*60*1000)||
    !trips.some(item=>notices.mapped(item?.trip).length))return;
  lastNoticeCheck=Date.now();noticePending=true;noticeStatus='Vérification des avis VNF…';
  native.checkNavigationNotices();
 }
 window.nauticNavigationNotices=raw=>{
  noticePending=false;
  try{
   const items=JSON.parse(raw).items;
   if(!Array.isArray(items))throw Error("réponse invalide");
   const updates=notices.verifyResponse(items);
   Object.assign(liveNotices,updates);
   noticeVerifiedAt=Date.now();noticeFromMemory=false;
   const memory=JSON.stringify({checkedAt:noticeVerifiedAt,items});
   try{native?.writeSetting(noticeMemoryKey,memory);localStorage.setItem(noticeMemoryKey,memory);}catch(_){}
   noticeStatus=Object.keys(updates).length?'Avis VNF consultés':'Aucun avis associé confirmé par EuRIS';
  }catch(_){noticeStatus='EuRIS indisponible · avis connus affichés';}
  renderTrip();
  if($('dialog').open&&$('nauticRefreshNotices'))showNavigationNotices();
 };
 function tripData(){
  const items=displayed.length?displayed:routeState?[routeState]:[];
  const rank={unknown:0,open:1,vigilance:2,closed:3};
  const features=items.flatMap(tripFeatures).sort((a,b)=>rank[a.properties.state]-rank[b.properties.state]);
  return {type:'FeatureCollection',features};
 }
 function tripFeatures(item){
  const {trip,closures,end}=item;
  if(!trip)return [{type:'Feature',properties:{color:'#bdc5d2',state:'unknown'},
   geometry:{type:'Point',coordinates:[end.lon,end.lat]}}];
  const xy=p=>[p.lon,p.lat];
  const limiting=new Set((trip.wayIds||[]).filter(section=>
   accessible.vigilanceLimits(window.NauticClearances?.[section],accessProfile).length));
  const segments=calc.sections(trip,currentClosures(closures),verifiedEdges(trip),item.departure?.offset,limiting);
  const properties=state=>({color:state==='vigilance'?'#ffb020':sectionColor(state),state});
  const features=segments.map(segment=>({type:'Feature',
   properties:properties(segment.vigilance!==undefined&&segment.state!=='closed'?'vigilance':segment.state),
   geometry:{type:'LineString',coordinates:segment.coordinates.map(xy)}}));
  const marker=(section,position,vigilance,objectNumber)=>({
   type:'Feature',properties:{...properties('vigilance'),section,vigilance,objectNumber},
   geometry:{type:'Point',coordinates:xy(position)}
  });
  for(let i=0;i<segments.length;i++){
   const segment=segments[i],section=segment.vigilance;
   if(section===undefined)continue;
   if(segments[i-1]?.vigilance!==section)features.push(marker(section,segment.coordinates[0],'vigilanceStart',581));
   if(segments[i+1]&&segments[i+1].vigilance===undefined)features.push(marker(section,segment.coordinates.at(-1),'vigilanceEnd',582));
  }
  features.push({type:'Feature',properties:properties(segments.at(-1)?.state||'unknown'),
   geometry:{type:'Point',coordinates:xy(trip.coordinates.at(-1))}});
  return features;
 }
 function showVigilance({section,vigilance,objectNumber}){
  if(selection||$('dialog').open)return false;
  const limits=accessible.vigilanceLimits(window.NauticClearances?.[section],accessProfile);
  if(!limits.length)return false;
  const names={draught:'Tirant d’eau',air:'Tirant d’air',width:'Largeur'};
  const metres=cm=>(cm/100).toLocaleString('fr-FR',{maximumFractionDigits:2})+' m';
  const label=vigilance==='vigilanceEnd'?'Fin de vigilance de gabarit':'Vigilance de gabarit';
  modal(label,
   '<p><strong>'+esc(fairwayNames.get(section)||section)+'</strong></p><ul>'+
   limits.map(({key,limit,value})=>{
    const gap=limit-value;
    const origin=window.NauticClearanceSources?.[section]?.[key]?.[0];
    const detail=gap<0?'dépassement de '+metres(-gap):gap===0?'aucune marge':metres(gap)+' de marge théorique';
    return '<li>'+names[key]+' · bateau '+metres(value)+' · référence '+metres(limit)+' · '+detail+
     (origin?'<br><small>'+esc(origin)+'</small>':'')+'</li>';
   }).join('')+'</ul><p class="muted">Références EuRIS de la section. Le niveau d’eau et la position des ouvrages peuvent modifier le passage.</p>'+
   (options.objectNumbers!==false?'<small>Objet '+objectNumber+'</small>':''));
  return true;
 }
 const legacyTrip=map?L.geoJSON(null,{
  style:feature=>({color:feature.properties.color,weight:4,interactive:false}),
  pointToLayer:(feature,position)=>{
   const kind=feature.properties.vigilance;
   if(kind){
    const icon=L.divIcon({className:'nautic-work-marker',html:I.svg(kind),iconSize:[24,24],iconAnchor:[12,12]});
    return L.marker(position,{icon,title:kind==='vigilanceEnd'?'Fin de vigilance de gabarit':'Vigilance de gabarit',
     bubblingMouseEvents:false}).on('click',()=>showVigilance(feature.properties));
   }
   return L.circleMarker(position,{radius:6,color:'#092f43',fillColor:feature.properties.color,fillOpacity:1,interactive:false});
  }
 }).addTo(map):null;
 function renderTrip(){
  const data=tripData();
  legacyTrip?.clearLayers();
  legacyTrip?.addData(data);
  vector?.getSource('nautic-trip')?.setData(data);
  renderTripCounters();
  showDestination(selection?selectionPrompt(selection.type):tripSummary());
  checkNavigationNotices();
 }
 function renderTripCounters(){
  for(const [id,label,value] of [
   ['tripCovered','Distance parcourue',(routeState?.covered||0)/1000],
   ['tripRemaining','Distance restante',routeState?.trip?calc.remaining(routeState.departure?.total??routeState.trip.total,routeState.covered):0]
  ]){
   const element=$(id),text=routeState?.trip&&!routeState.awaitingGps?km(value):'—';
   if(element.textContent===text)continue;
   element.textContent=text;
   element.setAttribute('aria-label',label+' : '+(routeState?.trip?text:'indisponible'));
  }
 }
 function dayAfter(value){
  const day=new Date(value+'T12:00:00Z');
  day.setUTCDate(day.getUTCDate()+1);
  return day.toISOString().slice(0,10);
 }
 const reopeningClock=new Intl.DateTimeFormat('fr-FR',{
  timeZone:'Europe/Paris',hour:'2-digit',minute:'2-digit'
 });
 function reopeningLabel(value){
  const [date,time]=value.split('T');
  return noticeDate(date)+(time?' à '+time.replace(':',' h '):'');
 }
 function departureText(item){
  const {trip,closures,departure}=item;
  const official=applicableNotices(trip);
  const live=routeImpacts(trip);
  const restrictions=currentClosures(closures).map(closure=>({...closure,date:closure.date||null}));
  for(const notice of official.filter(item=>item.active)){
   restrictions.push({indices:notices.closedEdges(trip,[notice]),date:dayAfter(notice.tentative||notice.end),
    tentative:!!notice.tentative,title:notice.title});
  }
  for(const notice of live.filter(item=>item.active&&item.closure&&item.indices.length)){
   const tentative=notices.tentativeEnd(notice.reference);
   const day=notices.dateInFrance(new Date(notice.end));
   const nearMidnight=notices.dateInFrance(new Date(notice.end+60000))!==day;
   restrictions.push({indices:notice.indices,
    date:tentative&&tentative>day?dayAfter(tentative):nearMidnight?dayAfter(day):
     day+'T'+reopeningClock.format(new Date(notice.end)),
    tentative:!!tentative&&tentative>day,title:notice.title});
  }
  restrictions.push({indices:trip.closedEdges||[],date:null});
  const plan=calc.departurePlan(trip,restrictions,departure?.offset);
  const uncertain=live.some(item=>item.active&&item.closure&&!item.indices.length);
  const stages=plan.progressive?' · Réouvertures successives depuis le départ : '+
    plan.stages.map(stage=>reopeningLabel(stage.date)+(stage.tentative?' (à confirmer)':'')).join(' → '):'';
  if(plan.unknown||uncertain)return 'Départ complet : date inconnue'+stages;
  if(!plan.date)return live.some(item=>item.closure&&!item.active)||official.some(item=>!item.active)?
   'Départ : fermeture annoncée sur le trajet':'Départ : aucune date confirmée';
  const tentative=plan.stages.some(stage=>stage.tentative);
  const main='Départ pour tout le trajet : dès le '+reopeningLabel(plan.date)+(tentative?' · à confirmer':' · selon les avis');
  if(stages)return main+stages;
  if(plan.firstOffset>100)return main+' · Premier blocage à '+km(plan.firstOffset/1000);
  return main;
 }
 function showDestination(message=''){
  destinationButton.textContent=selection?'Annuler le choix':'Destination';
  destinationButton.setAttribute('aria-pressed',String(!!selection));
  wrap.classList.toggle('nautic-select-destination',!!selection);
  destinationStatus.textContent=message;
  if(!selection){
   for(const item of (displayed.length?displayed:routeState?[routeState]:[])){
    if(!item.trip)continue;
    const line=document.createElement('small');
    line.className='nautic-departure-date';
    line.textContent=(displayed.length&&item.name?item.name+' · ':'')+departureText(item);
    destinationStatus.append(line);
   }
  }
  destinationStatus.hidden=(!selection&&destinationInfoDismissed)||(!message&&!destinationStatus.childElementCount);
  tripProgress.hidden=!tripRequest;
  const blocked=routeState?.trip&&(currentClosures(routeState.closures).length>0||routeState.trip.restricted||
   applicableNotices().some(notice=>notice.active)||
   routeImpacts(routeState.trip).some(item=>item.active&&item.closure&&item.indices.length));
  destinationStatus.style.borderLeft=routeState?.trip?'3px solid '+sectionColor(blocked?'closed':'unknown'):'';
 }
 function tripSummary(){
  if(displayed.length)return [displayed.length+' trajets affichés',
   eurisStatus||(displayed.some(item=>notices.mapped(item.trip).length)?noticeStatus:'État VNF inconnu')].filter(Boolean).join(' · ');
  if(!routeState)return '';
  const {trip,closures,note}=routeState;
  if(!trip)return tripRequest?'Calcul du trajet fluvial…':note||'Impossible de calculer le trajet fluvial';
  const distance=(trip.estimated||routeState.departure?.offset>0?'≈ ':'')+km(routeState.departure?.total??trip.total);
  const parts=[];
  const activeClosures=currentClosures(closures);
  if(activeClosures.length){
   parts.push(activeClosures.length===1?'Un tronçon fermé':activeClosures.length+' tronçons fermés');
   const dates=[...new Set(activeClosures.map(closureDate))];
   parts.push(dates.length===1?dates[0]:'Dates dans Destination');
  }
  if(trip.restricted)parts.push(trip.closedEdges?'Restriction OpenStreetMap':'Restriction à localiser');
  const verified=applicableNotices();
  if(verified.length){
   const dates=[...new Set(verified.map(notice=>notice.active?'Fermeture VNF en cours':'Fermeture VNF dès le '+noticeDate(notice.start)))];
   parts.push(...dates);
  }
  const incoming=routeImpacts(trip);
  if(incoming.some(item=>item.closure&&item.active&&item.indices.length))parts.push('Fermeture EuRIS localisée');
  else if(incoming.some(item=>item.closure&&item.active))parts.push('Avis à localiser · voir Destination');
  if(calc.sections(trip,activeClosures,verifiedEdges(trip,verified)).some(part=>part.state==='unknown'))parts.push('Gris · état inconnu');
  if(routeState.awaitingGps)parts.push(routeState.gpsMessage||'Départ en attente du GPS');
  if(note)parts.push(note);
  if(trip.arrivalOffset>150)parts.push('Arrivée sur l’eau à '+km(trip.arrivalOffset/1000)+' du point choisi');
  if(trip.pk!=null)parts.push('Arrivée PK '+formatPk.format(trip.pk));
  if(!routeState.awaitingGps)parts.push(distance);
  return parts.join(' · ');
 }
 function noticeDate(value){
  return formatDate.format(new Date(value+'T12:00:00'));
 }
 function showNavigationNotices(){
  const online=displayed.length?displayed.flatMap(item=>routeImpacts(item.trip)):routeImpacts(routeState?.trip);
  const uniqueOnline=[...new Map(online.map(item=>[item.reference+' '+item.title,item])).values()];
  const onlineEntries=uniqueOnline.map(item=>'<li>'+esc(item.title)+' · '+esc(item.reference)+' · '+
   (item.closure?(item.active?'Fermeture en cours':'Fermeture annoncée'):'Avis de navigation')+
   ' · du '+formatDate.format(item.start)+' au '+formatDate.format(item.end)+
   (item.indices.length?'':' · tronçon exact à vérifier')+'</li>').join('');
  const relevant=displayed.length?displayed.flatMap(item=>applicableNotices(item.trip)):applicableNotices();
  const entries=[...new Map(relevant.map(item=>[item.number,item])).values()].map(notice=>'<p><strong>'+notice.title+'</strong><br>'+notice.reference+' · '+
   (notice.active?'Fermeture en cours':'Fermeture annoncée')+' du '+noticeDate(notice.start)+' au '+
   noticeDate(notice.end)+' inclus.<br>'+
   (notice.tentative&&notice.tentative>notice.end?'Prolongation probable jusqu’au '+noticeDate(notice.tentative)+' · à confirmer.<br>':'')+
   (notice.live?(noticeFromMemory?'Avis EuRIS mémorisé':'Vérifié via EuRIS'):'Avis embarqué')+'</p>').join('');
  const dates=[...new Map(relevant.map(item=>[item.number,item])).values()].map(item=>({
   date:item.end,title:item.title,detail:'Fin de fermeture annoncée le '+noticeDate(item.end)+' inclus'+
    (item.tentative&&item.tentative>item.end?' · prolongation probable jusqu’au '+noticeDate(item.tentative):'')
  }));
  for(const item of uniqueOnline){
   if(item.closure&&item.indices.length)dates.push({date:notices.dateInFrance(new Date(item.end)),
    title:item.title,detail:'Fin de fermeture annoncée le '+formatDate.format(item.end)});
  }
  for(const item of (displayed.length?displayed:routeState?[routeState]:[])){
   item.closures.forEach((closure,index)=>{
    if(closure.date>noticeDay)dates.push({date:closure.date,
     title:(item.name?item.name+' · ':'')+(closure.from?'Tronçon '+(index+1):'Parcours entier'),
     detail:closureDate(closure)});
   });
  }
  dates.sort((a,b)=>a.date.localeCompare(b.date));
  const reopenings=dates.length?'<h3>Réouvertures annoncées</h3><ul>'+
   dates.map(item=>'<li>'+esc(item.title)+' · '+esc(item.detail)+'</li>').join('')+'</ul>':'';
  const checkedDate=n=>n?new Date(n).toLocaleString('fr-FR'):'date inconnue';
  modal('Avis de navigation',
   '<p>Vérification des avis VNF : '+checkedDate(noticeVerifiedAt)+'<br>Vérification EuRIS du parcours : '+checkedDate(impactVerifiedAt)+
   '. Les informations mémorisées peuvent avoir changé.</p><p class="muted">'+esc(noticeStatus)+' · '+esc(eurisStatus)+'</p><button type="button" id="nauticRefreshNotices">↻ Rafraîchir les avis</button>'+reopenings+
   (onlineEntries?'<h3>Avis EuRIS sur le parcours</h3><ul>'+onlineEntries+'</ul>':'')+entries+
   (!onlineEntries&&!entries?'<p>Aucun avis VNF associé aux tronçons de ce trajet.</p>':'')+
   '<p>Vert · navigation indiquée sur la carte. Gris · état inconnu. Rouge · fermeture ou restriction en cours. Orange · vigilance de gabarit.</p>'+
   '<p>Actualisation automatique des avis associés aux tronçons répertoriés.</p>'+
   '<p><a href="https://avisbat.vnf.fr/">Consulter les avis officiels VNF</a></p>'+
   '<small>API/Service Notices to Skippers incorporated from EuRIS (eurisportal.eu). '+
   'Réseau adapté du jeu de données de Baart et Turpijn, <a href="https://doi.org/10.5281/zenodo.20793663">CC BY 4.0</a>. '+
   'Data provided by EuRIS (www.eurisportal.eu) and Rijkswaterstaat.</small>');
  $('nauticRefreshNotices').disabled=impactPending||noticePending;
  if(impactPending||noticePending)$('nauticRefreshNotices').textContent='Vérification en cours…';
  $('nauticRefreshNotices').onclick=()=>{
   if(window.nauticDataUpdating){$('nauticRefreshNotices').textContent='Mise à jour locale en cours · réessayer ensuite';return;}
   checkNavigationNotices(true);$('nauticRefreshNotices').textContent=impactPending||noticePending?'Vérification en cours…':'Aucune source interrogeable pour ce trajet';$('nauticRefreshNotices').disabled=impactPending||noticePending;
  };
 }
 function showTripBottlenecks(){
  const items=displayed.length?displayed:routeState?.trip?[routeState]:[];
  const metres=cm=>(cm/100).toLocaleString('fr-FR',{maximumFractionDigits:2})+' m';
  const labels={draught:'Tirant d’eau maximal',air:'Hauteur libre'};
  const content=items.map(item=>{
   const minima=accessible.routeBottlenecks(item.trip,window.NauticClearances||{},W.distance,item.departure?.offset);
   const rows=Object.entries(minima).map(([dimension,{minimum,unknown}])=>{
    let detail='Minimum indisponible';
    if(minimum){
     const gap=minimum.limit-accessProfile[dimension];
     const location=fairwayNames.get(minimum.section)||minimum.section;
     const source=window.NauticClearanceSources?.[minimum.section]?.[dimension]?.[0];
     const difference=gap===0?'aucune marge à la valeur de référence':
      (gap>0?metres(gap)+' de marge théorique':'limite inférieure de '+metres(-gap));
     detail=metres(minimum.limit)+' · bateau '+metres(accessProfile[dimension])+' · '+difference+
      '<br>'+esc(location)+(source?' · '+esc(source):'')+' · à environ '+km(minimum.offset/1000)+' du départ';
    }
    return '<li><strong>'+labels[dimension]+'</strong><br>'+detail+
     (unknown?'<br><small>'+unknown+' tronçons sans valeur · minimum réel du trajet non établi</small>':'')+'</li>';
   }).join('');
   return (item.name?'<h3>'+esc(item.name)+'</h3>':'')+'<ul>'+rows+'</ul>';
  }).join('');
  modal('Points de gabarit limitants',content+
   '<p class="muted">Valeurs de référence EuRIS. Le niveau d’eau, la passe sous une voûte et la position d’un pont mobile peuvent modifier la marge.</p>');
 }
 function closureDate(closure){
  const date=closure.date?new Date(closure.date+'T12:00:00'):null;
  return date&&Number.isFinite(+date)?'Réouverture prévue '+formatDate.format(date):'Réouverture inconnue';
 }
 function selectionPrompt(type){
  if(type==='start'||type==='startToCity')return 'Touche le point de départ';
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

  modal('Destination',
   '<div class="destination-menu"><button type="button" id="tripChange">Nouvelle destination</button> '+
   '<button type="button" id="tripCity">Rechercher une ville</button> '+
   '<button type="button" id="tripArchive">Trajets enregistrés</button> '+
   (displayed.length||routeState?.trip?'<button type="button" id="tripBottlenecks">Points de gabarit limitants</button> ':'')+
   '<button type="button" id="tripAccessible">Voies accessibles</button> '+
   (accessProfile.enabled?'<button type="button" id="tripClearAccessible">Effacer les tracés verts</button> ':'')+
   (displayed.length?'<button type="button" id="tripHideGroup">Masquer les trajets sélectionnés</button> '+
    '<button type="button" id="tripGroupNotices">Avis de navigation</button> ':'')+
   (routeState?
    '<button type="button" id="tripFit">Voir le parcours</button> '+
    '<button type="button" id="tripChooseStart">Choisir le départ sur la carte</button> '+
    (!routeState.trip?'<button type="button" id="tripRetry">Relancer le calcul</button> ':
     '<button type="button" id="tripNotices">Avis de navigation</button> '+
     '<button type="button" id="tripSave">Mémoriser ce trajet</button> '+
     '<button type="button" id="tripClosure">Signaler un tronçon fermé</button> ')+
    routeState.closures.map((closure,i)=>'<button type="button" data-trip-closure="'+i+'">'+
     (closure.from?'Tronçon '+(i+1):'Parcours entier')+' · '+closureDate(closure)+'</button> ').join('')+
    '<button type="button" id="tripClear">Effacer le trajet</button>':'')+'</div>');
  if($('tripBottlenecks'))$('tripBottlenecks').onclick=()=>{$('dialog').close();showTripBottlenecks();};
  $('tripAccessible').onclick=()=>{$('dialog').close();accessSettings();};
  if($('tripClearAccessible'))$('tripClearAccessible').onclick=()=>{
   accessProfile.enabled=false;
   saveAccessProfile();
   $('dialog').close();updateAccessible();
  };
  $('tripCity').onclick=()=>{$('dialog').close();searchCity();};
  $('tripArchive').onclick=()=>{$('dialog').close();showArchive();};
  if($('tripHideGroup'))$('tripHideGroup').onclick=()=>{$('dialog').close();displayed=[];renderTrip();};
  if($('tripGroupNotices'))$('tripGroupNotices').onclick=()=>{$('dialog').close();showNavigationNotices();};
  if($('tripFit'))$('tripFit').onclick=()=>{$('dialog').close();displayed=[];renderTrip();fitTrip();};
  if($('tripSave'))$('tripSave').onclick=()=>{$('dialog').close();saveToArchive();};
  $('tripChange').onclick=()=>{$('dialog').close();displayed=[];renderTrip();choose(stableFix?'end':'start');};
  if($('tripChooseStart'))$('tripChooseStart').onclick=()=>{$('dialog').close();displayed=[];renderTrip();choose('start');};
  if($('tripRetry'))$('tripRetry').onclick=()=>{$('dialog').close();calculateTrip(routeState.start,routeState.end,true);};
  if($('tripNotices'))$('tripNotices').onclick=()=>{$('dialog').close();showNavigationNotices();};
  if($('tripClosure'))$('tripClosure').onclick=()=>{$('dialog').close();displayed=[];renderTrip();choose('closureStart');};
  $('dialog').querySelectorAll('[data-trip-closure]').forEach(button=>{
   button.onclick=()=>editClosure(routeState.closures[Number(button.dataset.tripClosure)],Number(button.dataset.tripClosure));
  });
  if($('tripClear'))$('tripClear').onclick=()=>{
   $('dialog').close();
   tripRequest=null;
   routeState=null;saveTrip();renderTrip();
  };
 };
 destinationStatus.onclick=()=>{destinationInfoDismissed=true;destinationStatus.hidden=true;};
 function fitTrip(){
  fitPoints(tripFeatures(routeState).flatMap(feature=>feature.geometry.type==='LineString'?
   feature.geometry.coordinates.map(([lon,lat])=>({lat,lon})):[]).concat(routeState.end));
 }
 function fitPoints(points){
  window.nauticMapFreePan=true;
  if(active&&vector){
   const bounds=new maplibregl.LngLatBounds();
   for(const point of points)bounds.extend([point.lon,point.lat]);
   vector.fitBounds(bounds,{padding:32,maxZoom:16,duration:0});
  }else if(map){
   map.fitBounds(points.map(p=>[p.lat,p.lon]),{padding:[24,24],maxZoom:16,animate:false});
  }
 }
 function saveToArchive(){
  const item=routeState;
  if(!item?.trip||item.trip.coordinates.length<2)return;
  modal('Mémoriser le trajet','<form id="saveRouteForm"><label>Nom <input id="savedRouteName" required maxlength="100"></label> '+
   '<button type="submit">Enregistrer</button><p id="saveRouteError" role="status"></p></form>');
  $('savedRouteName').value=archive.trips.find(saved=>saved.id===item.savedId)?.name||'Trajet '+(archive.trips.length+1);
  $('saveRouteForm').onsubmit=event=>{
   event.preventDefault();
   const name=$('savedRouteName').value.trim();
   if(!name)return;
   const id=item.savedId||String(Date.now());
   const saved={id,name,start:item.start,end:item.end,trip:item.trip,closures:item.closures};
   if(!storeArchive({...archive,trips:[...archive.trips.filter(other=>other.id!==id),saved]})){
    $('saveRouteError').textContent='Impossible d’enregistrer le trajet';return;
   }
   item.savedId=id;saveTrip();$('dialog').close();showArchive();
  };
 }
 function currentDeparture(){
  return latest&&Date.now()-latest.t<30000&&latest.acc<=35?latest:null;
 }
 function attachDeparture(){
  if(!routeState?.awaitingGps)return false;
  const gps=currentDeparture();
  const departure=gps&&calc.resume(routeState.trip,gps);
  if(!departure){
   const message=gps?'GPS hors du tracé enregistré · rejoins la voie d’eau':'Départ en attente du GPS';
   if(routeState.gpsMessage===message)return false;
   routeState.gpsMessage=message;return true;
  }
  routeState.awaitingGps=false;
  routeState.departure={...departure,gps:{lat:gps.lat,lon:gps.lon}};
  routeState.covered=0;saveTrip();return true;
 }
 function reopenTrip(saved){
  destinationInfoDismissed=false;
  tripRequest=null;selection=null;displayed=[];
  routeState={...saved,closures:[...saved.closures],savedId:saved.id,covered:0,awaitingGps:true};
  attachDeparture();saveTrip();checkNavigationNotices(true);renderTrip();fitTrip();
 }
 function showArchive(){
  modal('Trajets enregistrés','<div id="savedRoutesList"></div><p id="savedRoutesStatus" role="status"></p>'+
   (archive.trips.length?'<div class="saved-route-footer"><button type="button" id="showSavedRoutes">Afficher les trajets cochés</button></div>':''));
  const list=$('savedRoutesList'), checked=new Set(archive.selected);
  if(!archive.trips.length)list.textContent='Aucun trajet enregistré.';
  for(const item of archive.trips){
   const row=document.createElement('div'), label=document.createElement('label'), check=document.createElement('input');
   const details=document.createElement('span'),name=document.createElement('strong'),distance=document.createElement('small');
   const actions=document.createElement('div');
   row.className='saved-route';label.className='saved-route-choice';actions.className='saved-route-actions';
   const open=document.createElement('button'), remove=document.createElement('button');
   check.type='checkbox';check.checked=checked.has(item.id);
   check.onchange=()=>{
    if(check.checked)checked.add(item.id);else checked.delete(item.id);
   };
   name.textContent=item.name;distance.textContent=km(item.trip.total);
   details.append(name,distance);label.append(check,details);
   open.type='button';open.textContent='Rouvrir';
   open.onclick=()=>{$('dialog').close();reopenTrip(item);};
   remove.type='button';remove.textContent='Supprimer';
   remove.onclick=()=>{
    if(!window.confirm('Supprimer le trajet « '+item.name+' » ?'))return;
    const selected=[...checked].filter(id=>id!==item.id);
    if(!storeArchive({trips:archive.trips.filter(other=>other.id!==item.id),selected})){
     $('savedRoutesStatus').textContent='Impossible de supprimer le trajet';return;
    }
    displayed=displayed.filter(other=>other.id!==item.id);renderTrip();
    $('dialog').close();showArchive();
   };
   actions.append(open,remove);row.append(label,actions);list.append(row);
  }
  if($('showSavedRoutes'))$('showSavedRoutes').onclick=()=>{
   const items=archive.trips.filter(item=>checked.has(item.id));
   if(!items.length){$('savedRoutesStatus').textContent='Coche au moins un trajet.';return;}
   if(!storeArchive({...archive,selected:[...checked]})){
    $('savedRoutesStatus').textContent='Impossible de mémoriser la sélection';return;
   }
   destinationInfoDismissed=false;
   displayed=items;selection=null;$('dialog').close();
   checkNavigationNotices(true);renderTrip();fitPoints(items.flatMap(item=>item.trip.coordinates));
  };
 }
 let cityRequest=0;
 function searchCity(){
  modal('Rechercher une ville','<form id="cityForm"><label>Commune française <input id="cityName" required minlength="2" maxlength="100" type="search"></label> '+
   '<button type="submit">Rechercher</button></form><p id="cityStatus" role="status"></p><div id="cityResults"></div>');
  $('cityForm').onsubmit=event=>{
   event.preventDefault();
   const name=$('cityName').value.trim();
   if(name.length<2)return;
   const request=++cityRequest;
   $('cityResults').replaceChildren();
   $('cityStatus').textContent='Recherche en cours…';
   if(native?.searchMapCity)native.searchMapCity(name,request);
   else $('cityStatus').textContent='Recherche indisponible sur cet appareil';
  };
 }
 window.nauticCitySearchResult=raw=>{
  const data=JSON.parse(raw), target=$('cityResults');
  if(data.request!==cityRequest||!target||!$('dialog').open)return;
  let count=0;
  for(const city of data.cities||[]){
   const [lon,lat]=(city?.mairie||city?.centre)?.coordinates||[];
   if(!validPoint({lat,lon})||typeof city.nom!=='string')continue;
   const result=document.createElement('button');
   result.type='button';result.textContent=city.nom+' ('+city.codeDepartement+')';
   result.onclick=()=>{
    $('dialog').close();window.nauticMapFreePan=true;
    if(map){map.setView([lat,lon],13,{animate:false});rotateMap();}
    if(active&&vector)vector.jumpTo({center:[lon,lat],zoom:13,padding:{top:0,bottom:0,left:0,right:0}});
   };
   const plan=document.createElement('button');
   plan.type='button';plan.textContent='Tracer vers '+city.nom;
   plan.onclick=()=>{
    $('dialog').close();
    const gps=currentDeparture()||stableFix;
    if(gps){selection=null;calculateTrip({lat:gps.lat,lon:gps.lon},{lat,lon});}
    else choose('startToCity',{lat,lon});
   };
   const row=document.createElement('p');row.append(result,' ',plan);target.append(row);count++;
  }
  $('cityStatus').textContent=data.failed?'Recherche de ville indisponible':count?'':'Aucune commune trouvée';
 };
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
  if(next.type==='startToCity')return calculateTrip(chosen,next.start);
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
  const departure=next.start||stableFix;
  if(!departure){choose('start');return;}
  return calculateTrip({lat:departure.lat,lon:departure.lon},chosen);
 }

 function calculateTrip(start,end,keepExisting=false){
  destinationInfoDismissed=false;
  if(accessProfile.enabled)accessStatus.hidden=false;
  displayed=[];
  const request={};
  tripRequest=request;
  if(!keepExisting)routeState={start,end,trip:null,closures:[],covered:0};
  renderTrip();
  setTimeout(()=>{
   if(tripRequest!==request)return;
   const cached=cachedRoute(start,end);
   if(cached)Object.assign(routeState,cached);
   else if(!routeState.trip)routeState.note='Aucune liaison trouvée dans le réseau fluvial embarqué';
   tripRequest=null;
   saveTrip();renderTrip();
  },0);
 }

 window.nauticTripGpsLeg=metres=>{
  if(!routeState?.trip||routeState.awaitingGps)return;
  routeState.covered+=metres;
  renderTripCounters();
  if(Date.now()-lastSave>15000)saveTrip();
 };
 window.addEventListener('pagehide',()=>{if(routeState)saveTrip()});
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&routeState)saveTrip()});
 renderTrip();
 updateAccessible();
 function routeData(){return {type:'FeatureCollection',features:points.length>1?[{type:'Feature',geometry:{type:'LineString',coordinates:points.map(p=>[p.lon,p.lat])},properties:{}}]:[]};}
 const pendingSignIcons=new WeakMap();
 function signIconCode(item){
  return item.category==='notice'&&item.notice.find(code=>Object.hasOwn(window.NauticSignImages||{},code));
 }
 function prepareVectorSignIcon(engine,code,id){
  if(!engine)return;
  let attempted=pendingSignIcons.get(engine);
  if(!attempted){attempted=new Set();pendingSignIcons.set(engine,attempted);}
  if(attempted.has(code))return;
  attempted.add(code);
  const image=new Image();
  image.crossOrigin='anonymous';
  image.onload=()=>{
   if(vector!==engine||!engine.getSource('nautic-works'))return;
   try{
    const canvas=document.createElement('canvas');canvas.width=canvas.height=80;
    const context=canvas.getContext('2d');
    const scale=76/Math.max(image.naturalWidth,image.naturalHeight);
    const w=image.naturalWidth*scale,h=image.naturalHeight*scale;
    context.drawImage(image,(80-w)/2,(80-h)/2,w,h);
    engine.addImage(id,context.getImageData(0,0,80,80),{pixelRatio:2});
    engine.getSource('nautic-works').setData(worksData());
   }catch(_){/* Keep the generic marker if the image cannot be read. */}
  };
  image.src=window.NauticSignImages[code];
 }
 function worksData(){
  return {type:'FeatureCollection',features:mapWorks().map(p=>{
   const category=p.category||W.categoryOf(p.type),code=signIconCode(p);
   let icon='nautic-'+category;
   if(code){
    const id='nautic-cevni-'+code;
    if(vector?.hasImage(id))icon=id;
    else prepareVectorSignIcon(vector,code,id);
   }
   return {type:'Feature',geometry:{type:'Point',coordinates:[p.lon,p.lat]},properties:{id:p.id,icon}};
  })};
 }
 function positionBoat(){const boat=$('mapBoat'),p=stableFix||latest;if(!boat||!p)return;if(!window.nauticMapFreePan){boat.style.setProperty('left','50%','important');boat.style.setProperty('top','66.666667%','important');return;}let q;if(active&&vector)q=vector.project([p.lon,p.lat]);else if(map){q=map.latLngToContainerPoint([p.lat,p.lon]);const r=$('map').getBoundingClientRect(),w=wrap.getBoundingClientRect();q={x:q.x+r.left-w.left,y:q.y+r.top-w.top};}if(q){const angle=active&&vector?(heading??0)-vector.getBearing():(heading??0);boat.style.transform=`translate(-50%,-50%) rotate(${angle}deg)`;boat.style.setProperty('left',q.x+'px','important');boat.style.setProperty('top',q.y+'px','important');}}
 window.nauticPositionBoat=positionBoat;window.addEventListener('nauticmapfollow',()=>{selectedWorkPoint=null;lastWorksCompute=0;lastCamera=null;sync();updateWorks();});
 window.nauticPreviewWorkSize=percent=>{options={...options,waterwayIconSize:percent};if(active&&vector?.getLayer('nautic-works'))vector.setLayoutProperty('nautic-works','icon-size',I.expression(percent));lastRender='';renderWorks();};
 let lastLegacyZoom=null;function sync(){positionBoat();if(window.nauticMapFreePan||window.nauticMapInteracting||!active||!vector||vector.isMoving?.())return;const c=smoothCenter||stableFix||latest;if(!c)return;const z=map?.getZoom(),bearing=(heading??0)-userMapRotation,h=wrap.clientHeight,zoomChanged=z!==lastLegacyZoom;const changed=!lastCamera||W.distance(c,lastCamera)>.8||Math.abs(((bearing-lastCamera.bearing+540)%360)-180)>.5||Math.abs(mapPitch-lastCamera.pitch)>.1||h!==lastCamera.h||zoomChanged;
 if(!changed)return;lastLegacyZoom=z;lastCamera={lat:c.lat,lon:c.lon,bearing,pitch:mapPitch,h};vector.jumpTo({...(zoomChanged&&z!=null?{zoom:z}:{}),center:[c.lon,c.lat],bearing,pitch:mapPitch,padding:{top:h/3,bottom:0,left:0,right:0}});$('compass').style.transform=`rotate(${bearing}deg)`;
 }

 function settings(next){options=next||read();lastQuery=0;signButton.hidden=options.waterwayTypes?.notice===false;if((options.mapEngine||'vector')==='legacy'){request++;failed=false;active=false;host.style.display='none';$('map').style.visibility='visible';if(vector){vector.remove();vector=null;}window.nauticRestoreLegacy?.();}else if(!vector){failed=false;start();}if(active&&vector?.getLayer('nautic-works')){const sizes=I.expression(Number(options.waterwayIconSize)||120);vector.setLayoutProperty('nautic-works','icon-size',sizes);}lastRender='';renderWorks();}
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
 window.nauticEvery(()=>{
  const today=notices.dateInFrance();
  if(today!==noticeDay){noticeDay=today;renderTrip();}
  else if(impacts.length)renderTrip();
  else checkNavigationNotices();
 },60000,true);
 window.nauticEvery(()=>{if(attachDeparture())renderTrip();},1500,true);
 window.nauticEvery(sync,350,true);let routeCount=-1;window.nauticEvery(()=>{if(active&&vector&&points.length!==routeCount){routeCount=points.length;vector.getSource('nautic-route')?.setData(routeData());}updateWorks();updateSigns();},3000,true);
 new ResizeObserver(()=>{vector?.resize();sync();}).observe(wrap);
 function selectedSignature(){return W.categories.filter(([key])=>key!=='notice'&&options.waterwayTypes?.[key]!==false).map(([key])=>key).join(',');}
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
  return items.filter(item=>item.category!=='notice'&&options.waterwayTypes?.[item.category||W.categoryOf(item.type)]!==false);
 }
 function query(p,r,all=false){
  const area=`(around:${r},${p.lat},${p.lon})`,local=`(around:${Math.min(r,11500)},${p.lat},${p.lon})`,chosen=new Set(all?W.categories.map(([key])=>key):selectedSignature().split(',')),parts=[];
  if(all)parts.push(`nwr[\"seamark:type\"=notice]${area};nwr[\"seamark:notice:category\"]${area};`);
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
 let worksTask=null,workRequestSequence=0,workNoticeUntil=0;
 const workRequests=new Map();
 window.nauticMapWorksResult=raw=>{
  let result;try{result=JSON.parse(raw);}catch(_){return;}
  const pending=workRequests.get(result.request);if(!pending)return;
  workRequests.delete(result.request);clearTimeout(pending.timer);
  if(result.error)pending.reject(Error(result.error));else pending.resolve({elements:result.elements});
 };
 async function fetchWorks(queryText){
  if(native?.searchMapWorks)return new Promise((resolve,reject)=>{
   const request=++workRequestSequence;
   const timer=setTimeout(()=>{workRequests.delete(request);reject(Error('délai dépassé'));},65000);
   workRequests.set(request,{resolve,reject,timer});
   try{native.searchMapWorks(request,queryText);}catch(error){clearTimeout(timer);workRequests.delete(request);reject(error);}
  });
  const errors=[];
  for(const endpoint of ['https://overpass-api.de/api/interpreter','https://overpass.private.coffee/api/interpreter']){
   const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),25000);
   try{
    const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:'data='+encodeURIComponent(queryText),signal:controller.signal});
    if(!response.ok)throw Error('HTTP '+response.status);
    const result=await response.json();if(!Array.isArray(result.elements)||result.remark)throw Error('réponse incomplète');return result;
   }catch(error){errors.push(error.name==='AbortError'?'délai dépassé':error.message);}
   finally{clearTimeout(timer);}
  }
  throw Error(errors.join(' / '));
 }
 const tileRequests=new Map();let tileSequence=0;
 window.nauticNavigationTileResult=raw=>{
  let result;try{result=JSON.parse(raw);}catch(_){return;}
  const pending=tileRequests.get(result.request);if(!pending)return;
  tileRequests.delete(result.request);clearTimeout(pending.timer);
  if(result.error){const error=Error(result.error);error.retryAt=result.retryAt;pending.reject(error);}else pending.resolve(result);
 };
 function fetchTile(tile,force){return new Promise((resolve,reject)=>{
  const request=++tileSequence,timer=setTimeout(()=>{tileRequests.delete(request);reject(Error('mise à jour interrompue · reprise au prochain essai'));},95000);
  tileRequests.set(request,{resolve,reject,timer});
  try{native.syncNavigationTile(request,tile.id,query(tile,tile.radius,true).replace('[timeout:45]','[timeout:18]'),force);}
  catch(error){clearTimeout(timer);tileRequests.delete(request);reject(error);}
 });}
 async function updateLocalWorks(area,force){
  const D=window.NauticLocalData,plan=D.tiles(area.p,Math.min(area.radius,8000));
  const pendingKey='nautic-local-data-pending';
  // Re-read the full area on resume: completed lots remain visible and are skipped by sync.
  const savePending=rows=>{const raw=JSON.stringify(rows);try{native?.writeSetting(pendingKey,raw);}catch(_){}try{localStorage.setItem(pendingKey,raw);}catch(_){}};
  savePending(plan);
  let remaining=[...plan];const collected=localTileEntries;
  // Render every saved lot first, even if it now needs an update.
  const read=id=>{try{return JSON.parse(native.readNavigationTile(id)||'null');}catch(_){return null;}};
  function install(entry){
   if(!entry||!Array.isArray(entry.elements))return;
   collected.delete(entry.id);collected.set(entry.id,entry);
   while(collected.size>32)collected.delete(collected.keys().next().value);
   data=W.parse([...collected.values()].flatMap(row=>row.elements));
   const dates=new Map();for(const saved of collected.values())for(const e of saved.elements){const key=e.type+'/'+e.id;dates.set(key,Math.max(dates.get(key)||0,saved.updated||0));}
   for(const item of data.items)item.updated=dates.get(item.id)||0;
   lastList=visibleWorks(workArea());lastRender='';renderWorks();
   const bounds=signArea();if(bounds&&!signButton.hidden){displaySigns({items:data.items.filter(p=>p.category==='notice')},bounds);signButton.textContent='Panneaux locaux · '+signs.length;}
  }
  for(const tile of plan)install(read(tile.id));
  window.nauticSetDataUpdating?.(true);
  try{
   await D.sync({plan,force,read,fetch:fetchTile,
    checkpoint:id=>{remaining=remaining.filter(tile=>tile.id!==id);savePending(remaining);updateDataCounter();},
    progress:step=>{if(step.entry)install(step.entry);notice(`Base locale · ${step.done}/${step.total} · ${step.source} · aperçus caméra suspendus`);},
    delay:()=>new Promise(resolve=>setTimeout(resolve,5500))});
   cache={center:area.p,radius:Math.min(area.radius,8000),signature:selectedSignature(),time:Date.now(),elements:[...collected.values()].flatMap(row=>row.elements)};
   notice(`Base locale actualisée · ${lastList.length} ouvrages · zone limitée à ${plan.length} lots`);
   return true;
  }catch(error){
   workNoticeUntil=Math.max(Date.now()+120000,Number(error.retryAt)||0);
   notice('Mise à jour en attente · '+error.message+' · lots validés conservés');
   return false;
  }finally{updateDataCounter();window.nauticSetDataUpdating?.(false);}
 }
 async function updateWorks(force=false){
  if(busy){if(force){await worksTask;return updateWorks(true);}return;}
  if(!force&&Date.now()<workNoticeUntil)return;
  if(options.waterwayWorks===false){status.hidden=true;lastList=[];renderWorks();return;}
  status.hidden=false;const area=workArea(),{p,radius}=area;
  if(!p){notice('Ouvrages · attente GPS');return;}
  if(data&&(force||Date.now()-lastWorksCompute>7000)){lastWorksCompute=Date.now();lastList=visibleWorks(area);lastRender='';renderWorks();}
  const signature=selectedSignature();
  if(!signature){lastList=[];renderWorks();notice('Aucun type d’ouvrage sélectionné');return;}
  const now=Date.now(),usable=cache&&cache.signature===signature&&W.distance(cache.center,p)+radius<=cache.radius+1000;
  if(!force&&usable&&now-cache.time<86400000){notice(`Ouvrages · ${lastList.length} · ${radius/1000} km · cache`);return;}
  if(!force&&now-lastQuery<(selectedWorkPoint?15000:120000))return;
  if(native?.syncNavigationTile&&window.NauticLocalData){
   busy=true;lastQuery=now;
   worksTask=updateLocalWorks(area,force).finally(()=>{busy=false;});return worksTask;
  }
  busy=true;lastQuery=now;notice('Actualisation des ouvrages… · données précédentes conservées');
  worksTask=(async()=>{
   try{
    const json=await fetchWorks(query(p,radius+1500).replace('[timeout:45]','[timeout:18]'));
    if(!Array.isArray(json.elements)||json.remark)throw Error('réponse incomplète');
    cache={center:{lat:p.lat,lon:p.lon},radius,signature,time:Date.now(),elements:json.elements};
    workRegions=[cache,...workRegions.filter(row=>W.distance(row.center,cache.center)>500)].slice(0,6);
    data=W.parse(workRegions.flatMap(row=>row.elements));
    try{localStorage.setItem('nautic-work-regions',JSON.stringify(workRegions));localStorage.setItem('nautic-waterways-cache',JSON.stringify(cache));}catch(_){}
    lastList=visibleWorks(workArea());lastRender='';renderWorks();
    notice('Ouvrages · '+lastList.length+' · actualisés à '+new Date().toLocaleTimeString('fr-FR'));
   }catch(error){workNoticeUntil=Date.now()+20000;notice('Actualisation impossible · '+error.message+(data?' · cache conservé':''));}
   finally{busy=false;}
  })();
  return worksTask;
 }
 const signCacheKey='nautic-sign-cache-v2';
 let signCache=[],signs=[],signRequest=null,lastSignAttempt=null,signStatus='idle',signError='';
 const regionalSigns=window.NauticSignsIdf;
 const regionEntry=regionalSigns?{items:W.parse(regionalSigns.elements).items}:null;
 function isIdfView(area){
  if(!regionalSigns)return false;
  const x=(area.west+area.east)/2,y=(area.south+area.north)/2;
  return regionalSigns.rings.reduce((inside,ring)=>{
   for(let i=0,j=ring.length-1;i<ring.length;j=i++){
    const [ax,ay]=ring[i],[bx,by]=ring[j];
    if((ay>y)!==(by>y)&&x<(bx-ax)*(y-ay)/(by-ay)+ax)inside=!inside;
   }
   return inside;
  },false);
 }

 try{
  const cached=JSON.parse(localStorage.getItem(signCacheKey)||'null');
  if(Array.isArray(cached))signCache=cached.filter(entry=>entry?.bounds&&Array.isArray(entry.items));
 }catch(_){}
 function mapWorks(){
  return [...(options.waterwayWorks===false?[]:lastList),...(signButton.hidden?[]:signs)];
 }
 function signArea(){
  const bounds=(active&&vector?vector:map)?.getBounds();
  if(!bounds)return null;
  const area={south:bounds.getSouth(),west:bounds.getWest(),north:bounds.getNorth(),east:bounds.getEast()};
  return Object.values(area).every(Number.isFinite)?area:null;
 }
 function containsSignArea(outer,inner){
  return outer.south<=inner.south&&outer.west<=inner.west&&outer.north>=inner.north&&outer.east>=inner.east;
 }
 function displaySigns(entry,area){
  const center={lat:(area.south+area.north)/2,lon:(area.west+area.east)/2};
  signs=(entry?.items||[]).filter(item=>containsSignArea(area,{
   south:item.lat,north:item.lat,west:item.lon,east:item.lon
  })).map(item=>({...item,distance:W.distance(center,item)})).sort((a,b)=>a.distance-b.distance);
  renderWorks();
 }
 let nativeSigns=null,nativeSignSequence=0;
 window.nauticMapSignsResult=raw=>{
  if(!nativeSigns)return;
  const result=JSON.parse(raw);
  if(result.request!==nativeSigns.request)return;
  const pending=nativeSigns;
  nativeSigns=null;
  if(result.error)pending.reject(Error(result.error));
  else pending.resolve(result.elements);
 };
 async function fetchSigns(bounds){
  if(native?.searchMapSigns){
   const elements=await new Promise((resolve,reject)=>{
    const request=++nativeSignSequence;
    nativeSigns={request,resolve,reject};
    try{native.searchMapSigns(request,bounds.south,bounds.west,bounds.north,bounds.east);}
    catch(error){nativeSigns=null;reject(error);}
   });
   return W.parse(elements).items.filter(item=>item.category==='notice');
  }

  const area=`(${bounds.south},${bounds.west},${bounds.north},${bounds.east})`;
  const query=`[out:json][timeout:15];(nwr["seamark:type"="notice"]${area};nwr["seamark:notice:category"]${area};);out center;`;
  const errors=[];
  for(const service of ['https://overpass-api.de/api/interpreter','https://overpass.private.coffee/api/interpreter']){
   const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),18000);
   try{
    const response=await fetch(service+'?data='+encodeURIComponent(query),{signal:controller.signal});
    if(!response.ok)throw Error('HTTP '+response.status);
    const data=await response.json();
    if(!Array.isArray(data.elements)||data.remark)throw Error('réponse incomplète');
    return W.parse(data.elements).items.filter(item=>item.category==='notice');
   }catch(error){
    errors.push(error.name==='AbortError'?'délai dépassé':error instanceof TypeError?'connexion réseau':error.message);
   }finally{clearTimeout(timer);}
  }
  throw Error([...new Set(errors)].join(' / '));
 }
 function updateSigns(force=false){
  if(window.nauticDataUpdating)return;
  const area=signArea();
  if(signButton.hidden||!area)return;
  if(isIdfView(area)){
   displaySigns(regionEntry,area);
   signStatus='idf';signButton.textContent='Panneaux IDF · '+signs.length;return;
  }
  const entry=signCache.find(row=>containsSignArea(row.bounds,area));
  if(area.north-area.south>1||area.east-area.west>1.5){
   displaySigns(null,area);signStatus='zoom';signButton.textContent='Panneaux · zoomer';return;
  }
  displaySigns(entry,area);
  const now=Date.now();
  if(entry&&now-entry.time<86400000&&!force){
   signStatus='ready';signButton.textContent='Panneaux · '+signs.length;return;
  }
  if(signRequest){
   signStatus='loading';signButton.textContent='Panneaux · recherche…';return signRequest;
  }
  if(!force&&lastSignAttempt&&now-lastSignAttempt.time<60000&&containsSignArea(lastSignAttempt.bounds,area)){
   signStatus='error';signButton.textContent=entry?'Panneaux · cache':'Panneaux · indisponibles';return;
  }
  const latPad=(area.north-area.south)*.2,lonPad=(area.east-area.west)*.2;
  const bounds={south:Math.max(-90,area.south-latPad),north:Math.min(90,area.north+latPad),
   west:Math.max(-180,area.west-lonPad),east:Math.min(180,area.east+lonPad)};
  signStatus='loading';signButton.textContent='Panneaux · recherche…';
  signRequest=fetchSigns(bounds).then(items=>{
   signCache=[{bounds,time:Date.now(),items},...signCache.filter(row=>!containsSignArea(bounds,row.bounds))].slice(0,12);
   try{localStorage.setItem(signCacheKey,JSON.stringify(signCache));}catch(_){}
   lastSignAttempt=null;
  },error=>{
   lastSignAttempt={bounds,time:Date.now()};
   signError=error.message;
  }).finally(()=>{
   signRequest=null;
   const current=signArea();
   if(current&&(containsSignArea(bounds,current)||!lastSignAttempt))updateSigns();
  });
  return signRequest;
 }
 signButton.onclick=async()=>{
  if(!signArea())return;
  await updateSigns(signStatus==='error');
  if($('dialog').open)return;
  const locations=signs.slice(0,100).map(item=>'<button type="button" data-sign="'+esc(item.id)+'">'+
   signImage(item.notice.find(code=>window.NauticSignImages?.[code]))+
   esc(signDescription(item))+' · '+km(item.distance/1000)+' du centre</button>').join(' ');
  const message=signStatus==='idf'?'Aucun panneau recensé dans cette zone dans l’extrait Île-de-France.':signStatus==='zoom'?'Zoome sur le secteur à consulter.':signStatus==='loading'?
   'Recherche des panneaux en cours.':signStatus==='error'?
   'Recherche OpenStreetMap impossible ('+signError+'). Touche Panneaux pour réessayer.':
   'Aucun panneau recensé dans cette zone par OpenStreetMap.';
  const attribution=signStatus==='idf'?
   '<p class="muted">Île-de-France · extrait Geofabrik '+esc(regionalSigns.date)+
   ' · <a href="https://www.openstreetmap.org/copyright">© contributeurs OpenStreetMap (ODbL)</a></p>':'';
  const grouped=signs.length>100?'<p>100 panneaux les plus proches du centre sur '+signs.length+'. Zoome pour affiner.</p>':'';
  modal('Panneaux de navigation',attribution+grouped+(locations||'<p>'+esc(message)+'</p>'));
  $('dialogContent').querySelectorAll('[data-sign]').forEach(button=>button.onclick=()=>{
   $('dialog').close();
   showItem(button.dataset.sign);
  });
 };
 let legacyLayer=null;
 function classicMarkers(){const groups=new Map(),bounds=map.getBounds();for(const p of mapWorks()){if(!bounds.contains([p.lat,p.lon]))continue;const pixel=map.project([p.lat,p.lon],map.getZoom()),key=Math.floor(pixel.x/45)+','+Math.floor(pixel.y/45);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(p);}
  return [...groups.values()].map(group=>{const lat=group.reduce((s,p)=>s+p.lat,0)/group.length,lon=group.reduce((s,p)=>s+p.lon,0)/group.length,size=I.size(map.getZoom(),Number(options.waterwayIconSize)||120),type=group.length>1?'group':group[0].category||W.categoryOf(group[0].type);const code=group.length===1&&signIconCode(group[0]);const illustration=code?'<img class="nautic-work-sign" src="'+esc(window.NauticSignImages[code])+'" alt="" referrerpolicy="no-referrer" onload="this.previousElementSibling.hidden=true" onerror="this.hidden=true">':'';const icon=L.divIcon({className:'nautic-work-marker',html:I.svg(type)+illustration+(group.length>1?'<span>'+group.length+'</span>':''),iconSize:[size,size],iconAnchor:[size/2,size/2]});return L.marker([lat,lon],{icon}).on('click',()=>{if(group.length===1)showItem(group[0].id);else showList(group);});});
 }
 function renderWorks(){const key=JSON.stringify([active,options.waterwayWorks,options.waterwayIconSize,!active&&map?map.getBounds().toBBoxString():'',mapWorks().map(x=>x.id).sort()]);if(key===lastRender)return;lastRender=key;vector?.getSource('nautic-works')?.setData(worksData());if(legacyLayer&&map){map.removeLayer(legacyLayer);legacyLayer=null;}if(!active&&window.L&&map&&mapWorks().length)legacyLayer=L.layerGroup(classicMarkers()).addTo(map);}

 const esc=s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
 function info(p){return `<b>${esc(p.name)}</b> · ${esc(p.type)}<br>${(p.distance/1000).toFixed(2)} km · ${p.mode==='réseau'?'par le réseau d’eau (branche à confirmer)':'à vol d’oiseau'}${p.clearance?'<br>Hauteur déclarée OSM : '+esc(p.clearance):''}${p.width?'<br>Largeur déclarée : '+esc(p.width):''}${p.length?'<br>Longueur déclarée : '+esc(p.length):''}${p.opening?'<br>Horaires déclarés : '+esc(p.opening):''}`;}
 function signImage(code){
  const image=code&&Object.hasOwn(window.NauticSignImages||{},code)&&window.NauticSignImages[code];
  return image?'<img class="nautic-sign-pictogram" src="'+esc(image)+
   '" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.hidden=true">':'';
 }
 function signDescription(item){
  const code=item.notice[0];
  return item.name!=='Panneau'?item.name:W.noticeDefinitions[code]||code||item.name;
 }
 function workMemoryTools(p){return '<p class="muted">Données mémorisées · dernière collecte : '+
  (p.updated?new Date(p.updated).toLocaleString('fr-FR'):'date non renseignée')+
  '. Tarifs, horaires et accès à confirmer.</p><button type="button" id="nauticRefreshWork">↻ Rafraîchir cette fiche</button>';}
 function bindWorkRefresh(p){
  const content=$('dialogContent');content.dataset.workMemory=p.id;
  const button=$('nauticRefreshWork');if(!button)return;
  button.onclick=async()=>{
   button.disabled=true;button.textContent='Actualisation de la zone…';
   if(busy)await worksTask;
   let updated=true;
   if(native?.syncNavigationTile){busy=true;worksTask=updateLocalWorks({p:{lat:p.lat,lon:p.lon},radius:1000,selected:true},true).finally(()=>{busy=false;});updated=await worksTask;}
   else{selectedWorkPoint={lat:p.lat,lon:p.lon};await updateWorks(true);}
   if(updated===false){button.disabled=false;button.textContent='Réessayer · échec réseau, fiche conservée';return;}
   if($('dialog').open&&content.dataset.workMemory===p.id){
    const fresh=data?.items.find(item=>item.id===p.id)||p;
    // Keep the selected fiche available even when it lies outside the current map filter.
    showItem(p.id,fresh);
   }
  };
 }
 function showItem(id,override){const p=override||mapWorks().find(x=>x.id===id);if(!p)return;
  if(p.category==='notice'){
   const details=p.notice.map(mark=>'<li>'+signImage(mark)+esc(W.noticeDefinitions[mark]||('Code OSM : '+mark))+'</li>').join('');
   modal('Panneau de navigation',workMemoryTools(p)+'<p><strong>'+esc(p.name)+'</strong></p>'+
    (details?'<ul>'+details+'</ul>':'<p>Signification non renseignée dans OpenStreetMap.</p>')+
    (p.noticeText?'<p>'+esc(p.noticeText)+'</p>':'')+
    (p.notice.some(code=>Object.hasOwn(window.NauticSignImages||{},code))?
     '<p class="muted">Illustrations de référence · <a href="https://wiki.openstreetmap.org/wiki/Seamarks/CEVNI_Notice_Marks">Catalogue CEVNI</a></p>':'')+
    '<small>Source : © contributeurs OpenStreetMap'+(options.objectNumbers!==false?' · Objet 583':'')+'</small>');
   bindWorkRefresh(p);return;
  }
  const number=String(p.phone||'').split(';')[0].trim();
  const safePhone=/^[+0-9(). \-]{3,40}$/.test(number)?number:'';
  const website=/^https?:\/\//i.test(p.website||'')?p.website:'';
  const rates=['port','halt'].includes(p.category)?
   '<h4>Tarifs de séjour</h4><p>Bateau : 13,40 × 4,30 m. Application du tarif à ce gabarit à confirmer auprès du gestionnaire.</p>'+
   '<table><tbody>'+[['Nuitée','night'],['Semaine','week'],['Mois','month']].map(([label,key])=>
    '<tr><td>'+label+'</td><td>'+esc(p.tariffs?.[key]||'Non renseigné')+'</td></tr>').join('')+'</tbody></table>'+
   (p.charge?'<p>Tarification déclarée : '+esc(p.charge)+'</p>':'')+
   (p.fee?'<p>Accès payant déclaré : '+esc(p.fee)+'</p>':'')+
   '<p class="muted">Données OSM déclaratives ; période, services, électricité et eau à vérifier. Aucun prix estimé sans grille du gestionnaire.</p>':'';
  modal('Ouvrage fluvial',workMemoryTools(p)+info(p)+
   '<p>GPS (WGS84) : '+Number(p.lat).toFixed(6)+', '+Number(p.lon).toFixed(6)+'</p>'+
   (p.address?'<p>'+esc(p.address)+'</p>':'')+
   (p.category==='lock'?'<p><strong>VHF : '+esc(p.vhf?'canal '+p.vhf:'canal non renseigné')+'</strong></p>':p.vhf?'<p>VHF : canal '+esc(p.vhf)+'</p>':'')+
   (safePhone?'<button type="button" id="waterwayCall" data-object-number="584">☎ Appeler '+esc(safePhone)+'</button>':'<p>Téléphone non renseigné.</p>')+
   (website?'<p><a id="waterwayWebsite" data-object-number="585" href="'+esc(website)+'">Site du gestionnaire / tarifs</a></p>':'')+rates+
   '<p class="muted">Source : © contributeurs OpenStreetMap. Couverture et caractéristiques à vérifier auprès du gestionnaire. Les hauteurs ne tiennent pas compte du niveau d’eau du jour.</p>');
  bindWorkRefresh(p);
  const call=$('waterwayCall');if(call)call.onclick=()=>{if(window.NauticAndroid?.call)window.NauticAndroid.call(safePhone);else location.href='tel:'+encodeURIComponent(safePhone);};
 }
 function showList(list=lastList){modal(selectedWorkPoint?'Ouvrages autour du point choisi':'Ouvrages autour du bateau', (options.waterwayTypes?.sondeurAlert === false ? '' : '<button type="button" id="waterwaySondeurAlerts">Points d’alerte du sondeur</button>')+`<p class="muted">Périmètre : ${(Number(options.waterwayRadius)||5000)/1000} km. Réseau d’eau calculé quand raccordé ; bifurcations à confirmer. Source : © contributeurs OpenStreetMap, cache ${cache?new Date(cache.time).toLocaleString('fr-FR'):'absent'}.</p>`+(list.length?list.slice(0,200).map(p=>`<button type="button" data-work="${esc(p.id)}" style="display:block;width:100%;margin:6px 0;text-align:left">${info(p)}</button>`).join(''):'<p>Aucun ouvrage disponible dans ce périmètre.</p>'));const alertsButton=$('waterwaySondeurAlerts');if(alertsButton)alertsButton.onclick=()=>{$('dialog').close();$('sondeurAlertList')?.click();};$('dialogContent').querySelectorAll('[data-work]').forEach(b=>b.onclick=()=>showItem(b.dataset.work));}status.onclick=()=>showList();
 try{cache=JSON.parse(localStorage.getItem('nautic-waterways-cache')||'null');if(cache&&Array.isArray(cache.elements)){try{workRegions=JSON.parse(localStorage.getItem('nautic-work-regions')||'[]').filter(row=>row?.center&&Array.isArray(row.elements)).slice(0,6);}catch(_){workRegions=[];}if(!workRegions.length)workRegions=[cache];data=W.parse(workRegions.flatMap(row=>row.elements));}else cache=null;}catch(_){cache=null;}
 try{if(workRegions.length)native?.importNavigationMemory?.(JSON.stringify(workRegions));}catch(_){}
 if(routeState&&(!routeState.trip?.closedEdges||routeState.trip.restrictionVersion!==3)){
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
