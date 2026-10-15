// RCL Motos · RCL-Trânsito · K1: desenho PROVISÓRIO dos karts (three.js), feito de caixas e cilindros (sem asset), até a
// Carrocerias mandar o kart 3D com piloto. Um InstancedMesh por peça para todos os karts: chassi, carenagem (na cor do piloto),
// bico, para-choque, banco, rodas (giram pelo caminho andado; as da frente esterçam) e piloto (macacão e capacete na cor).
import * as T from 'three';
export class KartView{
 constructor(scene,{capacity=12}={}){
  this.group=new T.Group();this.group.name='RCL-Transito:karts';scene.add(this.group);this.cap=capacity;
  const box=(w,h,d)=>new T.BoxGeometry(w,h,d),mat=(c,o={})=>new T.MeshStandardMaterial({color:c,roughness:.6,metalness:.2,...o}),white=0xffffff;
  const wheel=(r,w)=>{const g=new T.CylinderGeometry(r,r,w,14);g.rotateZ(Math.PI/2);return g;};
  const paint=mat(white,{roughness:.45,metalness:.25}),dark=mat(0x26282b),tire=mat(0x111111,{roughness:.95,metalness:0}),seat=mat(0x161616,{roughness:.8});
  // peças: [geometria, material, posições locais (x à esquerda +, y, z à frente +), pintada?, roda?]
  this.parts=[
   {g:box(1.05,.05,1.55),m:dark,at:[[0,.1,0]]},
   {g:box(.32,.2,.95),m:paint,at:[[.58,.2,-.05],[-.58,.2,-.05]],paint:true},
   {g:box(.95,.16,.42),m:paint,at:[[0,.2,.78]],paint:true},
   {g:box(.5,.28,.12),m:paint,at:[[0,.32,.42]],paint:true},
   {g:box(1.3,.12,.14),m:dark,at:[[0,.18,-.88]]},
   {g:box(.42,.42,.36),m:seat,at:[[0,.32,-.32]]},
   {g:new T.CapsuleGeometry(.19,.32,4,10),m:paint,at:[[0,.66,-.24]],paint:true},
   {g:new T.SphereGeometry(.15,14,10),m:paint,at:[[0,1.0,-.2]],paint:true},
   {g:new T.CylinderGeometry(.13,.13,.04,14),m:dark,at:[[0,.55,.12]],rot:[-1.1,0,0]},
   {g:wheel(.13,.17),m:tire,at:[[.6,.13,.55],[-.6,.13,.55]],roda:'frente'},
   {g:wheel(.14,.22),m:tire,at:[[.63,.14,-.55],[-.63,.14,-.55]],roda:'tras'}];
  for(const P of this.parts){const n=capacity*P.at.length,m=new T.InstancedMesh(P.g,P.m,n);m.name='RCL-Transito:kart';m.instanceMatrix.setUsage(T.DynamicDrawUsage);m.frustumCulled=false;m.count=0;m.castShadow=true;
   if(P.paint){m.setColorAt(0,new T.Color(1,1,1));m.instanceColor.setUsage(T.DynamicDrawUsage);}P.mesh=m;this.group.add(m);
   P.local=P.at.map(([x,y,z])=>{const M=new T.Matrix4().makeTranslation(x,y,z);if(P.rot)M.multiply(new T.Matrix4().makeRotationFromEuler(new T.Euler(...P.rot)));return M;});}
  this._m=new T.Matrix4();this._w=new T.Matrix4();this._r=new T.Matrix4();this._q=new T.Quaternion();this._p=new T.Vector3();this._s=new T.Vector3(1,1,1);this._y=new T.Vector3(0,1,0);this._c=new T.Color();
 }
 // karts: os da corrida (x, y, z globais, yaw, delta, odo, dr.cor); origin: origem flutuante do mundo
 sync(karts,origin){
  const n=Math.min(karts.length,this.cap),m=this._m,w=this._w;
  for(let i=0;i<n;i++){const k=karts[i];this._p.set(k.x-origin.x,k.y||0,k.z-origin.z);this._q.setFromAxisAngle(this._y,k.yaw);m.compose(this._p,this._q,this._s);
   for(const P of this.parts){for(let j=0;j<P.at.length;j++){w.multiplyMatrices(m,P.local[j]);
     if(P.roda){if(P.roda==='frente')w.multiply(this._r.makeRotationY(k.delta||0));w.multiply(this._r.makeRotationX((k.odo||0)/(P.roda==='frente'?.13:.14)));}
     P.mesh.setMatrixAt(i*P.at.length+j,w);if(P.paint)P.mesh.setColorAt(i*P.at.length+j,this._c.setHex(P===this.parts[6]||P===this.parts[7]?(k.dr.capacete??k.dr.cor):k.dr.cor));}}}
  for(const P of this.parts){P.mesh.count=n*P.at.length;P.mesh.instanceMatrix.needsUpdate=true;if(P.mesh.instanceColor)P.mesh.instanceColor.needsUpdate=true;}
  this.group.visible=n>0;
 }
 hide(){this.group.visible=false;}
 drawCalls(){return this.group.visible?this.parts.length:0;}
 dispose(){this.group.parent?.remove(this.group);for(const P of this.parts){P.mesh.dispose();P.g.dispose();}}
}
