/* Shared code-drawn pictograms for vector and classic maps. */
(function(root){
 const shapes={
 lock:['#e84a28','<path d="M11 10v20M29 10v20M12 14l8 5 8-5M12 26l8-5 8 5"/>'],
 port:['#007cdb','<circle cx="20" cy="11" r="3"/><path d="M20 14v18M13 19h14M9 24c0 10 22 10 22 0M9 24l-2 5M31 24l2 5"/>'],
 halt:['#12a350','<path d="M10 11h20M10 29h20M15 11v18M25 11v18M15 20h10"/>'],
 bridge:['#ac32cc','<path d="M7 17h26M9 17V9M16 17V9M24 17V9M31 17V9M7 31V17M33 31V17M12 31v-5a8 8 0 0 1 16 0v5"/>'],
 dam:['#df7d00','<path d="M11 10h18l4 16H7zM7 31q4-4 8 0t8 0 10 0M15 10v16M25 10v16"/>'],
 weir:['#009ca6','<path d="M7 12q4-4 8 0t8 0 10 0M7 21h10v7h16M7 32q4-4 8 0t8 0 10 0"/>'],
 tunnel:['#5361d8','<path d="M8 32V19a12 12 0 0 1 24 0v13M13 32V20a7 7 0 0 1 14 0v12M17 32l2-8M23 32l-2-8"/>'],
 slipway:['#d53783','<path d="M7 13l25 16M10 12h15l-3 7H14zM7 32q4-4 8 0t8 0 10 0"/>'],
 group:['#285b7b','<rect x="9" y="9" width="15" height="15" rx="2"/><rect x="16" y="16" width="15" height="15" rx="2"/>']};
 function svg(type){const [color,path]=shapes[type]||shapes.group;return `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 40 40"><rect x="1.5" y="1.5" width="37" height="37" rx="10" fill="${color}" stroke="white" stroke-width="2.5"/><g fill="none" stroke="white" stroke-width="2.3" stroke-linejoin="round" stroke-linecap="round">${path}</g></svg>`;}
 const stops=[[6,12],[10,14],[14,18],[18,22]];
 function at(zoom){for(let i=1;i<stops.length;i++){if(zoom<=stops[i][0]){const [a,x]=stops[i-1],[b,y]=stops[i];return x+(y-x)*Math.max(0,(zoom-a)/(b-a));}}return 18;}
 function size(zoom,percent=120){return Math.round(Math.max(8,Math.min(36,at(zoom)*Math.max(.4,Math.min(1.7,percent/120)))));}
 function expression(percent=120){return ['interpolate',['linear'],['zoom'],...stops.flatMap(([zoom])=>[zoom,size(zoom,percent)/40])];}

 async function install(map,valid=()=>true){await Promise.all(Object.keys(shapes).map(type=>new Promise(resolve=>{const img=new Image();img.onload=()=>{if(valid()&&!map.hasImage('nautic-'+type))map.addImage('nautic-'+type,img,{pixelRatio:2});resolve();};img.onerror=resolve;img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg(type));})));}
 const api={svg,size,expression,install,types:Object.keys(shapes)};root.NauticWorkIcons=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
