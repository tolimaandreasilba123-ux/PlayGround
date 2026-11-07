import * as THREE from 'three';

const $ = (id) => document.getElementById(id);
const canvas = $('world');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x81908e);
scene.fog = new THREE.FogExp2(0x81908e, 0.0072);
const camera = new THREE.PerspectiveCamera(54, innerWidth / innerHeight, 0.1, 260);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.16;
renderer.physicallyCorrectLights = true;
scene.add(new THREE.HemisphereLight(0xc8d1d0, 0x35312b, 1.05));
const sun = new THREE.DirectionalLight(0xffd5a0, 3.2);
sun.position.set(-38, 55, -22); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048); sun.shadow.camera.left = -38; sun.shadow.camera.right = 38; sun.shadow.camera.top = 38; sun.shadow.camera.bottom = -38;
sun.shadow.bias = -0.00015; sun.shadow.normalBias = 0.025; sun.shadow.radius = 3;
scene.add(sun);
const fill = new THREE.DirectionalLight(0x9caeb2, 1.2); fill.position.set(45, 20, 32); scene.add(fill);
const clock = new THREE.Clock();
const WORLD = 180, keys = {}, touchKeys = {};
const state = { started:false, dead:false, won:false, health:100, stamina:100, essence:0, flasks:3, shrine:false, attack:0, attackHit:false, dodge:0, heal:0, yaw:0, pitch:0.18, moving:false, sprinting:false, hurt:0, toastTimer:0, respawn:{x:0,z:13}, bossNear:false };
function makeSurfaceMaps(base, scale=256, detail=700){
 const colorCanvas=document.createElement('canvas'), bumpCanvas=document.createElement('canvas');
 colorCanvas.width=colorCanvas.height=bumpCanvas.width=bumpCanvas.height=scale;
 const c=colorCanvas.getContext('2d'), b=bumpCanvas.getContext('2d');
 c.fillStyle=base;c.fillRect(0,0,scale,scale);b.fillStyle='#888';b.fillRect(0,0,scale,scale);
 let seed=base.split('').reduce((n,ch)=>n+ch.charCodeAt(0),11);const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
 for(let i=0;i<detail;i++){
  const x=rand()*scale,y=rand()*scale,r=.5+rand()*3.8,v=Math.floor(rand()*70);
  c.fillStyle=`rgba(${rand()>.5?220:12},${rand()>.5?205:17},${rand()>.5?180:15},${.025+rand()*.1})`;c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fill();
  const h=Math.floor(80+rand()*100);b.fillStyle=`rgb(${h},${h},${h})`;b.beginPath();b.arc(x,y,r*1.25,0,Math.PI*2);b.fill();
 }
 const color=new THREE.CanvasTexture(colorCanvas), bump=new THREE.CanvasTexture(bumpCanvas);
 color.colorSpace=THREE.SRGBColorSpace;color.wrapS=color.wrapT=bump.wrapS=bump.wrapT=THREE.RepeatWrapping;
 color.anisotropy=bump.anisotropy=4;return {color,bump};
}
const groundMaps=makeSurfaceMaps('#55544a',256,1300), stoneMaps=makeSurfaceMaps('#77766d',256,950), barkMaps=makeSurfaceMaps('#433b32',256,700), clothMaps=makeSurfaceMaps('#555451',256,900);
groundMaps.color.repeat.set(18,18);groundMaps.bump.repeat.set(18,18);
stoneMaps.color.repeat.set(2,2);stoneMaps.bump.repeat.set(2,2);
barkMaps.color.repeat.set(1,3);barkMaps.bump.repeat.set(1,3);
clothMaps.color.repeat.set(2,2);clothMaps.bump.repeat.set(2,2);
const mats = {
 ground:new THREE.MeshStandardMaterial({color:0xaaa69a,map:groundMaps.color,bumpMap:groundMaps.bump,bumpScale:.22,roughness:1}), darkGround:new THREE.MeshStandardMaterial({color:0x55554e,roughness:1}), stone:new THREE.MeshStandardMaterial({color:0xaaa99f,map:stoneMaps.color,bumpMap:stoneMaps.bump,bumpScale:.12,roughness:.93}), stoneDark:new THREE.MeshStandardMaterial({color:0x65665f,map:stoneMaps.color,bumpMap:stoneMaps.bump,bumpScale:.15,roughness:.98}), wood:new THREE.MeshStandardMaterial({color:0x62584a,map:barkMaps.color,bumpMap:barkMaps.bump,bumpScale:.09,roughness:.95}), bark:new THREE.MeshStandardMaterial({color:0x51463b,map:barkMaps.color,bumpMap:barkMaps.bump,bumpScale:.17,roughness:1}), cloth:new THREE.MeshStandardMaterial({color:0x73716a,map:clothMaps.color,bumpMap:clothMaps.bump,bumpScale:.09,roughness:.96}), armor:new THREE.MeshStandardMaterial({color:0x85877f,metalness:.72,roughness:.36}), rust:new THREE.MeshStandardMaterial({color:0x75483a,metalness:.65,roughness:.48}), bone:new THREE.MeshStandardMaterial({color:0xaaa18b,roughness:.8}), gold:new THREE.MeshStandardMaterial({color:0xb89c67,metalness:.72,roughness:.3}), glow:new THREE.MeshBasicMaterial({color:0xffb95e})
};
const groundY = (x,z) => 0.25*Math.sin(x*.09)+0.22*Math.cos(z*.105)+0.12*Math.sin((x+z)*.17) + 0.035*Math.sin(x*.43)*Math.cos(z*.35);
function addMesh(geo, mat, parent=scene, x=0,y=0,z=0, sx=1,sy=1,sz=1, rot=0){const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.rotation.y=rot;m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
function makeSky(){
 const canvas=document.createElement('canvas');canvas.width=2;canvas.height=256;const ctx=canvas.getContext('2d');
 const gradient=ctx.createLinearGradient(0,0,0,256);gradient.addColorStop(0,'#263941');gradient.addColorStop(.52,'#657978');gradient.addColorStop(.77,'#aaa08a');gradient.addColorStop(1,'#c7a984');ctx.fillStyle=gradient;ctx.fillRect(0,0,2,256);
 const sky=new THREE.Mesh(new THREE.SphereGeometry(230,32,20),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(canvas),side:THREE.BackSide,depthWrite:false}));scene.add(sky);
}
makeSky();
function makeTerrain(){
 const size=220, seg=150, geo=new THREE.PlaneGeometry(size,size,seg,seg);geo.rotateX(-Math.PI/2);
 const p=geo.attributes.position; for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i);p.setY(i,groundY(x,z));} geo.computeVertexNormals();
 const ground=new THREE.Mesh(geo,mats.ground);ground.receiveShadow=true;scene.add(ground);
 // Soft-edged, worn dirt track following the pilgrims' route.
 const points=[]; for(let i=0;i<=36;i++){const z=22-i*3.1;const x=Math.sin(i*.19)*7;points.push(new THREE.Vector3(x,groundY(x,z)+.035,z));}
 const trailGeo=new THREE.BufferGeometry().setFromPoints(points);const trail=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),160,2.35,8,false),mats.darkGround);trail.scale.y=.015;trail.position.y=-.005;trail.receiveShadow=true;scene.add(trail);
 for(let i=0;i<38;i++){const z=16-i*2.55,x=Math.sin(i*.19)*7+(Math.random()-.5)*2.8;const rock=addMesh(new THREE.DodecahedronGeometry(.35+Math.random()*.55,1),i%3?mats.stoneDark:mats.stone,scene,x,groundY(x,z)+.06,z,.9,.22,.72,Math.random()*3);rock.castShadow=false;}
}
function makeTree(x,z,s=1){
 const y=groundY(x,z),g=new THREE.Group();g.position.set(x,y,z);g.rotation.y=Math.random()*Math.PI*2;scene.add(g);
 const stem=(a,b,r1,r2)=>{const dir=new THREE.Vector3().subVectors(b,a),mesh=addMesh(new THREE.CylinderGeometry(r2,r1,dir.length(),7),mats.bark,g,(a.x+b.x)/2,(a.y+b.y)/2,(a.z+b.z)/2);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),dir.normalize());return mesh;};
 stem(new THREE.Vector3(0,0,0),new THREE.Vector3(.08*s,4.7*s,0),.34*s,.055*s);
 for(let level=0;level<3;level++){
  const h=(1.65+level*.9)*s;
  for(let j=0;j<2;j++){
   const a=j*Math.PI+level*1.35+(Math.random()-.5)*.35,len=(1.35+Math.random()*.65)*s;
   const start=new THREE.Vector3(.02*s,h,0),end=new THREE.Vector3(Math.cos(a)*len,(h+.6*s+Math.random()*.3*s),Math.sin(a)*len);
   stem(start,end,.14*s,.035*s);
   if(level===2){const twigEnd=end.clone().add(new THREE.Vector3(Math.cos(a+.6)*.52*s,.55*s,Math.sin(a+.6)*.52*s));stem(end,twigEnd,.05*s,.012*s);}
  }
 }
 // exposed roots anchor the dead trunk into the uneven soil
 for(let j=0;j<3;j++){const a=j*Math.PI*2/3;stem(new THREE.Vector3(0,.15*s,0),new THREE.Vector3(Math.cos(a)*.78*s,.015,Math.sin(a)*.78*s),.16*s,.055*s);}
}
function makeRock(x,z,s){const m=addMesh(new THREE.DodecahedronGeometry(s,1),Math.random()>.5?mats.stone:mats.stoneDark,scene,x,groundY(x,z)+s*.45,z,1.25,.78,.9,Math.random()*3);m.castShadow=true;}
function makeRuin(x,z,s=1){
 const y=groundY(x,z); addMesh(new THREE.BoxGeometry(1.3*s,5*s,1.2*s),mats.stoneDark,scene,x,y+2.5*s,z,1,1,1,.08);
 addMesh(new THREE.BoxGeometry(1.8*s,.4*s,1.7*s),mats.stone,scene,x,y+5*s,z,1,1,1,.08);
 addMesh(new THREE.BoxGeometry(1.3*s,2.4*s,1.2*s),mats.stoneDark,scene,x+4*s,y+1.2*s,z+1*s,1,1,1,-.12);
 addMesh(new THREE.BoxGeometry(5*s,.45*s,1.4*s),mats.stone,scene,x+2*s,y+4.4*s,z,1,1,1,-.1);
}
function makeShrine(x,z){
 const y=groundY(x,z),g=new THREE.Group();g.position.set(x,y,z);scene.add(g);
 addMesh(new THREE.CylinderGeometry(2.4,2.7,.45,8),mats.stone,g,0,.2,0);
 addMesh(new THREE.CylinderGeometry(1.55,1.8,.4,8),mats.stoneDark,g,0,.58,0);
 addMesh(new THREE.BoxGeometry(.8,2.15,.8),mats.stone,g,0,1.8,0);
 addMesh(new THREE.TorusGeometry(.85,.095,8,24),mats.gold,g,0,2.95,0,1,1,1,.1);
 addMesh(new THREE.SphereGeometry(.3,12,10),mats.glow,g,0,2.9,0);
 const flame=new THREE.PointLight(0xffa64a,3.3,17);flame.position.set(0,3.1,0);g.add(flame);g.userData.flame=flame;
 for(let i=0;i<4;i++){const a=i*Math.PI/2;addMesh(new THREE.BoxGeometry(.28,.65,.3),mats.stoneDark,g,Math.cos(a)*2,.35,Math.sin(a)*2,1,1,1,a);}
 return g;
}
makeTerrain();
// Scenic ring: dead trees, leaning ruins, grave stones, and broken monoliths.
for(let i=0;i<52;i++){let a=Math.random()*Math.PI*2,r=25+Math.random()*75,x=Math.cos(a)*r,z=Math.sin(a)*r;if(Math.hypot(x,z)<19)continue;if(Math.random()<.57)makeTree(x,z,.65+Math.random()*1.4);else makeRock(x,z,.6+Math.random()*2.2);}
for(const [x,z,s] of [[-22,-12,1],[-32,14,.9],[28,-9,1.2],[37,25,.75],[-49,-40,1.5],[46,-57,1.3],[6,-73,1.1]])makeRuin(x,z,s);
const shrine=makeShrine(0,-62);
// distant watchtower silhouette
for(let i=0;i<4;i++){const a=i*Math.PI/2,x=72+Math.cos(a)*3,z=-78+Math.sin(a)*3;addMesh(new THREE.BoxGeometry(.8,13,.8),mats.stoneDark,scene,x,6.5,z);}
addMesh(new THREE.CylinderGeometry(4,4,1,8),mats.stone,scene,72,13,-78,1,1,1,.2);

function makeFighter(isBoss=false){
 const root=new THREE.Group(), torso=new THREE.Group();root.add(torso);
 const bodyMat=isBoss?mats.rust:mats.cloth, armorMat=isBoss?mats.rust:mats.armor;
 addMesh(new THREE.CylinderGeometry(.32,.43,.85,8),bodyMat,torso,0,1.15,0);
 addMesh(new THREE.SphereGeometry(.29,12,10),armorMat,torso,0,1.82,0,1,.95,.9);
 addMesh(new THREE.ConeGeometry(.2,.48,6),mats.stoneDark,torso,0,2.18,0,1,1,1,Math.PI);
 addMesh(new THREE.BoxGeometry(.78,.16,.48),armorMat,torso,0,1.53,0);
 const armL=new THREE.Group(),armR=new THREE.Group();armL.position.set(-.42,1.46,0);armR.position.set(.42,1.46,0);torso.add(armL,armR);
 addMesh(new THREE.CylinderGeometry(.1,.14,.62,7),armorMat,armL,0,-.28,0,1,1,1,-.12);
 addMesh(new THREE.CylinderGeometry(.1,.14,.62,7),armorMat,armR,0,-.28,0,1,1,1,.12);
 const sword=new THREE.Group();sword.position.set(0,-.52,.04);armR.add(sword);
 addMesh(new THREE.BoxGeometry(.085,.12,.17),mats.wood,sword,0,0,0);
 addMesh(new THREE.BoxGeometry(.09,.08,.56),mats.gold,sword,0,-.05,.32);
 addMesh(new THREE.BoxGeometry(.09,.055,1.12),mats.armor,sword,0,-.04,.87,1,1,1,-.055);
 addMesh(new THREE.ConeGeometry(.065,.25,4),mats.armor,sword,0,-.04,1.55,1,1,1,Math.PI/2);
 addMesh(new THREE.CylinderGeometry(.03,.03,.45,6),mats.wood,sword,0,-.05,-.13,1,1,1,Math.PI/2);
 const legL=addMesh(new THREE.CylinderGeometry(.14,.18,.72,7),mats.stoneDark,torso,-.2,.42,0);
 const legR=addMesh(new THREE.CylinderGeometry(.14,.18,.72,7),mats.stoneDark,torso,.2,.42,0);
 scene.add(root);
 return {root,torso,armR,armL,sword,legL,legR,isBoss,hp:isBoss?360:100,maxHp:isBoss?360:100,alive:true,attackCooldown:Math.random()+.4,hitFlash:0,walk:0,baseY:0};
}
const hero=makeFighter(false);hero.root.position.set(0,groundY(0,13),13);hero.baseY=hero.root.position.y;
function makeEnemy(x,z,boss=false){const e=makeFighter(boss);e.root.position.set(x,groundY(x,z),z);e.baseY=e.root.position.y;e.hp=e.maxHp; e.root.scale.setScalar(boss?1.55:1);e.attackCooldown=1+Math.random()*1.5;enemies.push(e);return e;}
const enemies=[];
makeEnemy(-12,-12);makeEnemy(14,-27);makeEnemy(-27,-43);makeEnemy(23,-51);makeEnemy(72,-64,true);
// Tomb markers and amber fireflies along the pilgrim's path.
for(let i=0;i<17;i++){const z=10-i*5.2,x=Math.sin(i*.19)*7+(Math.random()-.5)*8,y=groundY(x,z);addMesh(new THREE.BoxGeometry(.75,.95,.32),mats.stoneDark,scene,x,y+.48,z,1,1,1,(Math.random()-.5)*.24);addMesh(new THREE.BoxGeometry(.12,.22,.35),mats.stone,scene,x,y+1,z);}
const motes=[];
for(let i=0;i<75;i++){const m=addMesh(new THREE.SphereGeometry(.045+Math.random()*.045,6,6),mats.glow,scene,(Math.random()-.5)*80,.8+Math.random()*8,-Math.random()*100);m.castShadow=false;m.userData={phase:Math.random()*6,speed:.3+Math.random()*.7,homeY:m.position.y};motes.push(m);}

function showToast(text,duration=2300){const el=$('toast');el.textContent=text;el.classList.add('show');state.toastTimer=duration;}
function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
function updateHud(){
 $('health-fill').style.width=`${state.health}%`; $('health-text').textContent=Math.ceil(state.health);
 $('stamina-fill').style.width=`${state.stamina}%`; $('stamina-text').textContent=Math.ceil(state.stamina);
 $('souls-count').textContent=state.essence; $('flask-count').textContent=state.flasks;
 const boss=enemies.find(e=>e.isBoss);if(boss){$('boss-fill').style.width=`${Math.max(0,boss.hp/boss.maxHp*100)}%`;}
}
function playTone(freq=180,duration=.11,type='sine',volume=.035){if(!soundEnabled)return;try{const ctx=audioCtx||(audioCtx=new AudioContext());const o=ctx.createOscillator(),g=ctx.createGain();o.type=type;o.frequency.value=freq;g.gain.setValueAtTime(volume,ctx.currentTime);g.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+duration);o.connect(g);g.connect(ctx.destination);o.start();o.stop(ctx.currentTime+duration);}catch{}}
let soundEnabled=false,audioCtx=null;
function interact(){
 const d=hero.root.position.distanceTo(shrine.position);
 if(d<5){if(!state.shrine){state.shrine=true;state.respawn={x:shrine.position.x,z:shrine.position.z+5};showToast('LA BRASA HA SIDO DESPERTADA');$('quest-state').textContent='BRASA ENCENDIDA · CAZA AL CABALLERO';$('quest-state').style.color='#d0b77e';shrine.userData.flame.intensity=5;playTone(420,.5,'triangle',.06);}else{state.health=100;state.stamina=100;state.flasks=3;showToast('LA LLAMA TE DEVUELVE LAS FUERZAS');playTone(320,.28,'sine',.04);}updateHud();return;}
 const target=enemies.filter(e=>e.alive).sort((a,b)=>a.root.position.distanceTo(hero.root.position)-b.root.position.distanceTo(hero.root.position))[0];
 if(target&&target.root.position.distanceTo(hero.root.position)<4){showToast(target.isBoss?'EL CABALLERO HUECO · NO HABRÁ DESCANSO':'UN NO-MUERTO TE ACECHA');return;}
 showToast('NO HAY NADA QUE RESPONDA');
}
function attack(){if(!state.started||state.dead||state.won||state.attack>0||state.dodge>0||state.stamina<17)return;state.attack=.48;state.attackHit=false;state.stamina-=17;playTone(130,.13,'sawtooth',.045);}
function dodge(){if(!state.started||state.dead||state.won||state.dodge>0||state.stamina<27)return;state.dodge=.43;state.stamina-=27;playTone(95,.16,'triangle',.04);}
function heal(){if(state.dead||state.won)return;if(state.flasks<1||state.health>=100){showToast(state.flasks<1?'NO QUEDAN FRASCOS':'YA ESTÁS EN PLENAS FUERZAS');return;}state.flasks--;state.health=Math.min(100,state.health+42);state.heal=.5;playTone(520,.4,'sine',.05);showToast('LA ESENCIA CIERRA TUS HERIDAS');updateHud();}
function damageHero(amount){if(state.dodge>0||state.dead)return;state.health=Math.max(0,state.health-amount);hero.hitFlash=.22;state.hurt=.2;$('hurt').classList.add('on');playTone(68,.2,'sawtooth',.07);updateHud();if(state.health<=0){state.dead=true;state.sprinting=false;document.body.classList.remove('playing');$('death-screen').classList.remove('hidden');document.exitPointerLock?.();}}
function damageEnemy(e,amount){if(!e.alive)return;e.hp=Math.max(0,e.hp-amount);e.hitFlash=.2;playTone(e.isBoss?90:115,.12,'square',.04);if(e.hp<=0){e.alive=false;scene.remove(e.root);state.essence+=e.isBoss?120:35;updateHud();showToast(e.isBoss?'EL CABALLERO HUECO HA CAÍDO':'EL ESPÍRITU SE DISUELVE');if(e.isBoss){state.won=true;state.sprinting=false;document.body.classList.remove('playing');$('victory-screen').classList.remove('hidden');document.exitPointerLock?.();}else if(enemies.filter(x=>!x.isBoss&&x.alive).length===0){$('quest-state').textContent='CAMINO DESPEJADO · HALLA AL CABALLERO';}}else updateHud();}
function doRespawn(){state.dead=false;state.health=100;state.stamina=100;state.flasks=3;state.hurt=0;$('hurt').classList.remove('on');document.body.classList.add('playing');hero.root.position.set(state.respawn.x,groundY(state.respawn.x,state.respawn.z),state.respawn.z);hero.root.rotation.y=0;state.yaw=0;$('death-screen').classList.add('hidden');updateHud();showToast('HAS VUELTO A LA BRASA');}
function beginGame(){state.started=true;document.body.classList.add('playing');$('start-screen').classList.add('hidden');canvas.requestPointerLock?.();showToast('ENCUENTRA EL SANTUARIO AL NORTE');}

$('begin-button').addEventListener('click',beginGame);
$('retry-button').addEventListener('click',doRespawn);
$('continue-button').addEventListener('click',()=>{$('victory-screen').classList.add('hidden');state.won=false;document.body.classList.add('playing');showToast('LA LLAMA PERDURA. SIGUE EXPLORANDO.');});
$('sound-toggle').addEventListener('click',()=>{soundEnabled=!soundEnabled;$('sound-toggle').textContent=soundEnabled?'♫':'♪';if(soundEnabled){playTone(360,.2,'sine',.04);showToast('EL SONIDO ESTÁ ACTIVADO');}else showToast('EL SONIDO ESTÁ SILENCIADO');});
document.addEventListener('keydown',e=>{const k=e.key.toLowerCase();keys[k]=true;if([' ','arrowup','arrowdown','arrowleft','arrowright'].includes(k))e.preventDefault();if(e.repeat)return;if(k===' ')dodge();if(k==='e')interact();if(k==='r')heal();});
document.addEventListener('keyup',e=>{keys[e.key.toLowerCase()]=false;});
document.addEventListener('mousemove',e=>{if(document.pointerLockElement===canvas){state.yaw-=e.movementX*.0024;state.pitch=clamp(state.pitch+e.movementY*.0018,-.25,.68);}});
canvas.addEventListener('click',()=>{if(state.started&&document.pointerLockElement!==canvas)canvas.requestPointerLock?.();else attack();});
document.addEventListener('pointerlockchange',()=>{});
for(const button of document.querySelectorAll('[data-move]')){const dir=button.dataset.move;button.addEventListener('pointerdown',e=>{e.preventDefault();touchKeys[dir]=true;button.setPointerCapture(e.pointerId);});for(const ev of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(ev,()=>{touchKeys[dir]=false;});}
for(const button of document.querySelectorAll('[data-action]')){button.addEventListener('pointerdown',e=>{e.preventDefault();const a=button.dataset.action;if(a==='attack')attack();if(a==='dodge')dodge();if(a==='heal')heal();});}
$('interact-prompt').addEventListener('click',interact);
window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,1.65));});
function isDown(...names){return names.some(n=>keys[n]||touchKeys[n]);}
function updateHero(dt,time){
 if(!state.started||state.dead)return;
 let dx=0,dz=0;const forward=isDown('w','arrowup','forward')-isDown('s','arrowdown','back');
 const side=isDown('d','arrowright','right')-isDown('a','arrowleft','left');
 dx+=-Math.sin(state.yaw)*forward+Math.cos(state.yaw)*side;dz+=-Math.cos(state.yaw)*forward-Math.sin(state.yaw)*side;
 const len=Math.hypot(dx,dz);state.moving=len>.01;
 if(len>0){dx/=len;dz/=len;}
 state.sprinting=state.moving&&isDown('shift')&&state.stamina>2&&state.attack<=0&&state.dodge<=0;
 if(state.dodge>0){state.dodge=Math.max(0,state.dodge-dt);const speed=13;hero.root.position.x+=(-Math.sin(state.yaw))*speed*dt;hero.root.position.z+=(-Math.cos(state.yaw))*speed*dt;}
 else if(state.moving){const speed=state.attack>0?2.45:state.sprinting?8.2:5.5;hero.root.position.x+=dx*speed*dt;hero.root.position.z+=dz*speed*dt;}
 hero.root.position.x=clamp(hero.root.position.x,-100,100);hero.root.position.z=clamp(hero.root.position.z,-101,100);
 hero.root.position.y=groundY(hero.root.position.x,hero.root.position.z);hero.root.rotation.y=state.yaw;
 hero.walk+=dt*(state.moving?(state.sprinting?13:9):2);
 const gait=state.sprinting ? 0.72 : 0.55;
 hero.legL.rotation.x=state.moving?Math.sin(hero.walk)*gait:0;hero.legR.rotation.x=state.moving?-Math.sin(hero.walk)*gait:0;
 hero.torso.position.y=state.moving?Math.abs(Math.sin(hero.walk))*(state.sprinting?-.085:-.055):0;
 hero.torso.rotation.z=state.sprinting?Math.sin(hero.walk)*.035:0;
 if(state.attack>0){state.attack=Math.max(0,state.attack-dt);const t=1-state.attack/.48;hero.armR.rotation.x=-1.65*Math.sin(Math.min(1,t)*Math.PI);hero.armR.rotation.z=-.8*Math.sin(Math.min(1,t)*Math.PI);if(t>.28&&!state.attackHit){state.attackHit=true;const fwd=new THREE.Vector3(-Math.sin(state.yaw),0,-Math.cos(state.yaw));for(const e of enemies){if(!e.alive)continue;const delta=e.root.position.clone().sub(hero.root.position);const d=delta.length();delta.y=0;delta.normalize();if(d<(e.isBoss?4.7:3.4)&&fwd.dot(delta)>.05)damageEnemy(e,e.isBoss?72:62);}}if(state.attack===0){hero.armR.rotation.set(0,0,0);}}
 else hero.armR.rotation.z=0;
 if(state.heal>0){state.heal-=dt;hero.root.scale.setScalar(1+Math.sin(time*28)*.025);}else hero.root.scale.setScalar(1);
 if(state.sprinting)state.stamina=Math.max(0,state.stamina-dt*24);
 else state.stamina=Math.min(100,state.stamina+dt*(state.attack>0||state.dodge>0?4:16));
 const dShrine=hero.root.position.distanceTo(shrine.position);$('interact-prompt').classList.toggle('show',dShrine<5.2);
 const boss=enemies.find(e=>e.isBoss);state.bossNear=!!boss?.alive&&boss.root.position.distanceTo(hero.root.position)<25;$('boss-bar').classList.toggle('show',state.bossNear);
 const z=hero.root.position.z;const region=z < -50?'EL SANTUARIO CAÍDO':z < -25?'LAS TUMBAS HUNDIDAS':'LAS TIERRAS DE LA CENIZA';$('region-name').textContent=region;$('compass-label').textContent=z > -55?'— EL SANTUARIO —':'— EL UMBRAL —';
}
function updateEnemies(dt,time){
 if(!state.started||state.dead)return;
 for(const e of enemies){if(!e.alive)continue;
  e.attackCooldown-=dt;e.hitFlash=Math.max(0,e.hitFlash-dt);
  const pos=e.root.position, delta=hero.root.position.clone().sub(pos);delta.y=0;const dist=delta.length();
  if(dist<50){const dir=delta.normalize();e.root.rotation.y=Math.atan2(-dir.x,-dir.z);
   if(dist>2.05){const speed=e.isBoss?2.45:2.05;pos.x+=dir.x*speed*dt;pos.z+=dir.z*speed*dt;e.walk+=dt*7;e.legL.rotation.x=Math.sin(e.walk)*.42;e.legR.rotation.x=-Math.sin(e.walk)*.42;}
   if(dist<2.8&&e.attackCooldown<=0){e.attackCooldown=e.isBoss?1.8:2.3;e.armR.rotation.x=-1.35;setTimeout(()=>{if(e.alive){e.armR.rotation.x=0;if(hero.root.position.distanceTo(e.root.position)<3.35)damageHero(e.isBoss?24:12);}},360);}
  }
  pos.y=groundY(pos.x,pos.z);e.root.scale.setScalar((e.isBoss?1.55:1)*(e.hitFlash>0?1.04:1));
 }
}
const cameraTarget=new THREE.Vector3();
function updateCamera(dt){
 const p=hero.root.position, distance=9.2, desired=new THREE.Vector3(p.x+Math.sin(state.yaw)*distance,p.y+3.45+state.pitch*4.5,p.z+Math.cos(state.yaw)*distance);
 camera.position.lerp(desired,1-Math.exp(-dt*5.5));cameraTarget.set(p.x,p.y+1.25,p.z);camera.lookAt(cameraTarget);
}
function frame(){requestAnimationFrame(frame);const dt=Math.min(clock.getDelta(),.045),time=clock.elapsedTime;
 updateHero(dt,time);updateEnemies(dt,time);updateCamera(dt);
 if(state.toastTimer>0){state.toastTimer-=dt*1000;if(state.toastTimer<=0)$('toast').classList.remove('show');}
 if(state.hurt>0){state.hurt=Math.max(0,state.hurt-dt);if(state.hurt===0)$('hurt').classList.remove('on');}
 for(const m of motes){m.position.y=m.userData.homeY+Math.sin(time*m.userData.speed+m.userData.phase)*.32;m.position.x+=Math.sin(time*.4+m.userData.phase)*dt*.12;}
 if(shrine.userData.flame){shrine.userData.flame.intensity=(state.shrine?4.8:2.7)+Math.sin(time*8)*.45;}
 renderer.render(scene,camera);
}
updateHud();
$('loading').classList.add('done');
frame();
