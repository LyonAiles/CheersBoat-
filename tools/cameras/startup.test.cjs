const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('app/src/main/assets/index.html','utf8');
for(const id of ['gpsCard','boatCard','fuelCard','logCard','nauticCallsSlot','notesCard','trematageCard','speedCard','weatherCard','cam1Card','cam2Card','cam3Card']){
 assert.equal((html.match(new RegExp('id="'+id+'"','g'))||[]).length,1,'Exactly one static placeholder for '+id);
}
assert(!html.includes('visibility:hidden'));assert(!html.includes('nautic-starting'));
let arranged=0,numbered=0,resumed=0,frame;
vm.runInNewContext(fs.readFileSync('app/src/main/assets/nautic-startup.js','utf8'),{document:{readyState:'complete'},window:{nauticArrangeDashboard:()=>arranged++,nauticNumberDashboard:()=>numbered++,nauticDashboardResume:()=>resumed++},requestAnimationFrame:fn=>frame=fn});
assert.equal(arranged,1);assert.equal(numbered,1);frame();assert.equal(resumed,1);
console.log('PASS: final placeholders are unique and visible from HTML; updates resume without a startup cover.');
