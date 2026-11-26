/* Layout is present in HTML before scripts; live data updates in place. */
(()=>{
 const ready=()=>{window.nauticArrangeDashboard?.();window.nauticNumberDashboard?.();requestAnimationFrame(()=>{window.nauticDashboardResume?.();window.nauticWater?.start();});};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready,{once:true});else ready();
})();
