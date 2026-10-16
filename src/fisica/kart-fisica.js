// RCL-Karts · física própria (fork do traffic-kart.js do RCL-Trânsito, cópia de rcl-motos/dist no commit 492733c).
// O que muda em relação ao original (o resto é igual, para a IA continuar pilotando do mesmo jeito):
// - relevo: o traçado traz a altura de cada ponto do eixo (json.relevo.h). O kart sente a rampa (g × inclinação na direção
//   em que anda, para a frente e de lado), o perfil de velocidade da IA também (sobe mais devagar, desce mais rápido, freia
//   melhor subindo) e cada kart ganha k.y (altura do chão), k.arfagem (+ = bico para cima) e k.rolagem (+ = lado esquerdo
//   mais alto), em rad.
// - bordas: o traçado traz, por ponto e por lado, a zebra (largura e tipo: 1 fina com relevo, 2 larga pintada) e a faixa
//   azul pintada depois dela (json.bordas). O piso fica: asfalto, zebra, zebraLarga, azul e grama (até o muro).
// - grama: quase sem aderência, e a traseira solta antes da frente: quem põe as rodas na grama roda.
// O vendor/rcl-transito/ continua congelado; o RCL-Karts usa este arquivo.
// RCL Motos · RCL-Trânsito · K1–K3: karts no kartódromo (lugar 74, traçado 101) — JS puro (sem three).
// Camadas, como nos jogos de corrida (ver TRANSITO.txt · KARTS): (1) linha de corrida de menor curvatura dentro da pista,
// calculada uma vez; (2) perfil de velocidade (curva pelo atrito, freada e aceleração pela física); (3) física simples de kart
// (modelo de bicicleta com pneu que satura, tração atrás, freio nos dois eixos, arrasto); (4) piloto: segue a linha (pure pursuit) e a
// velocidade do perfil dele, com o nível de cada um (aderência que ousa usar, ponto de freada, precisão da linha, constância).
// K1: dez pilotos de nível parecido dando volta, cada um no seu ritmo; desviam dos karts parados do cenário e da moto do jogador.
// K2: corrida entre eles — vácuo (menos arrasto colado atrás); linhas por dentro e por fora com velocidade própria; planejador
// de faixa na ordem da corrida (cada um prevê 2,5 s de algumas faixas e escolhe a que anda mais sem entrar no espaço previsto
// dos que vão na frente; quem está emparelhado tem o espaço dele); briga (colado atrás, decide uma vez por curva: arrisca mais
// e vai para o lado; mergulho por dentro antes de freada forte); defesa (um movimento por reta, antes de o outro emparelhar);
// retardatário abre caminho; kart encosta em kart (cápsulas: empurra e troca velocidade, nunca atravessa); em fila perto dos
// karts parados do cenário; largada lançada em duas colunas. O kart do jogador (K4) entra na mesma corrida como mais um.
// K3: o piso (zebra; fora dela o chão do mundo — grama junto da pista no mapa exportado — ou a areia do gerador) muda a
// aderência e o rolamento; muros de pneus e o Jersey do traçado (contato e limite de lado); erros de piloto, uma chance por curva
// (mais nos de nível menor, sob pressão e brigando): freada passada, saída larga, travada; rodada (gira no lugar para o sentido
// da pista e espera brecha), susto depois de toque forte e o fiscal que tira de lado quem enroscou o bico num parado ou num muro.
// Coordenadas da web (x leste, z sul); lado: d > 0 = à direita de quem anda (−tz, tx), como no trânsito.

export const KART_CONFIG=Object.freeze({
 // kart de aluguel com piloto (hipóteses: 160 kg, ~6 kW, pneu de borracha dura)
 massa:160,entreEixos:1.05,cgFrente:.6,altCG:.28,inercia:45,largura:1.4,comprimento:1.85,altura:1.05,
 mu:1.1,rigidezFrente:13000,rigidezTras:24000,potencia:6000,tracaoMax:1150,freioMax:1150,freioFrente:.55,cdA:.75,rolamento:.02,
 volanteMax:.36,volanteVel:2.6,g:9.81,dt:1/120,
 giro:.2,   // quanto o piloto corrige a guinada (contra-esterço quando a traseira sai)
 linha:{margem:1.05,iter:6000,relax:1.9},   // m do centro do kart à borda do asfalto na linha de corrida
 perfil:{atrito:.88,freio:.9},      // o perfil de referência usa 88% do atrito e 90% da freada máxima
 // segue quem está no caminho que vai fazer (corredor de 2D): perto, a folga + tempo × velocidade; freando, a distância que dá
 // para parar atrás dele (como o da frente freia pelo mesmo ponto, colado é possível: vácuo)
 seguir:{olha:32,folga:.3,tempo:.04,minimo:.35,freada:6,ganho:.8,corredor:.35},
 desvio:{olha:32,lado:2.05,depois:7},
 // K2: linhas deslocadas da de corrida (m; + = direita), presas a lim do eixo e suavizadas; o kart anda entre elas
 linhas:{desloc:[-2.4,-1.2,0,1.2,2.4],lim:3.15,suaviza:40},
 lateral:{vel:2.2,ataque:3},            // m/s · quão rápido o piloto muda de linha (tática; atacando, mais rápido)
 vacuo:{max:.5,dist:20,lado:1.3},       // colado atrás: até 50% menos arrasto; nada a 20 m nem a 1,3 m de lado
 lado:{sep:2.15,olha:6},                // m · centro a centro lado a lado (1,4 m de kart + 0,75 de folga: na curva o kart vai de lado)
 // briga: colado (a menos de 3,5 m) e preso atrás há 1 s, ou antes de freada forte (queda de 5 m/s ou mais); decide uma vez
 // por curva (chance .45 + .5 × agressivo); brigando arrisca mais: anda 8–14% acima do normal dele na curva e na freada (o
 // normal é ~85% do pneu); desiste se a faixa do lado deixa de valer, se fica longe ou depois de 10 s
 ataque:{colado:3.5,mergulho:28,forte:5,preso:1,passou:.3,esfria:2,max:10,tarde:.08,chance:.45},
 // planejador: horizonte e passo (s), folgas (m) longitudinal e de lado, troca de faixa (m), freada prevista (m/s²), custos (m
 // de caminho por m de troca, por m fora da linha, por passo em espaço alheio), "perto" (m), folga atrás de parado (m) e zona
 // de cuidado antes de parado (m)
 plano:{horizonte:2.5,passo:.1,folgaS:.6,folgaD:.6,faixa:1.6,freada:6,troca:.15,fora:.35,ruim:40,perto:25,paradoS:2.5,cuidado:28},
 defesa:{desloc:1.8,curva:75,chance:.1},   // decide uma vez por curva (chance .1 + .3 × defesa), antes de o outro sair da fila
 contato:{seg:.25,raio:.68,restituicao:.25,atrito:.3},   // cápsula do kart (±0,25 m, raio 0,68: 1,86 × 1,36 m)
 lancada:{fila:6.5,coluna:1.05,vel:.55},  // largada lançada: duas colunas, uma fila a cada 6,5 m, a 55% do ritmo
 // K3: piso (aderência e rolamento a mais) e muros (restituição, atrito). Fora do asfalto e da zebra vale o chão do mundo
 // (no jogo, o mesmo surfaceAt que dá a altura do kart): Grama e Areia têm aderência 0,52 em mundo.json (superficies); sem
 // mundo (testes), o que o gerador diz — areia de área de escape
 piso:{asfalto:{grip:1,roll:0},zebra:{grip:.92,roll:.015},zebraLarga:{grip:.96,roll:.004},azul:{grip:.88,roll:.008},grama:{grip:.32,roll:.07,tras:.7},areia:{grip:.52,roll:.2}},
 muro:{restituicao:.2,atrito:.6},
 // K3: erros — chance por curva (base no nível 0,45 → metade no 0,55), mais sob pressão (alguém colado atrás) e brigando;
 // freada passada (mira 20–40% mais rápido até a tangência: entra rápido demais, sai de frente), saída larga (gravidade 0–1:
 // pé embaixo 0,6–1,4 s sem segurar a traseira, abrindo 1,2–4,2 m para fora — zebra, às vezes areia), travada (dianteira
 // travada 0,4–0,9 s na tomada da curva: o kart vai reto)
 erro:{base:.03,pressao:.8,briga:1.5,tipos:{freada:.5,saida:.3,travou:.2},freada:[.2,.4],saida:[0,1],travou:[.4,.9]},
 // K3: rodada (de lado ou de costas para a pista, devagar): gira no lugar, espera brecha atrás e volta; susto depois de toque;
 // enroscado 2,5 s no parado ou no muro: o fiscal empurra de lado (0,8 m/s) e endireita
 rodada:{angulo:1.3,parado:2.5,gira:1.8,brecha:30,susto:1.5,sustoT:.5,empurraT:2.5,empurra:.8},
 forma:{sigma:.008,tempo:25},           // ritmo do dia: ±0,8% (desvio, × 1,5 − nível), muda a cada ~25 s
 pilotos:10
});
const clamp=(v,a,b)=>v<a?a:v>b?b:v,smooth=t=>t*t*(3-2*t);
function gauss(r){let u=0,v=0;while(!u)u=r();while(!v)v=r();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v);}
export function rngK(seed){let a=seed>>>0;return()=>{a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

// ---------------------------------------------------------------- pista
export class KartTrack{
 constructor(json){
  const E=json.eixo.slice(0,-1);this.json=json;this.n=E.length;this.x=new Float64Array(this.n);this.z=new Float64Array(this.n);
  for(let i=0;i<this.n;i++){this.x[i]=E[i][0];this.z[i]=E[i][1];}
  this.s=new Float64Array(this.n+1);for(let i=1;i<=this.n;i++){const j=i%this.n;this.s[i]=this.s[i-1]+Math.hypot(this.x[j]-this.x[i-1],this.z[j]-this.z[i-1]);}
  this.L=this.s[this.n];this.hw=json.largura/2;this.zebra=json.zebra;
  this.tx=new Float64Array(this.n);this.tz=new Float64Array(this.n);
  for(let i=0;i<this.n;i++){const a=(i-1+this.n)%this.n,b=(i+1)%this.n,dx=this.x[b]-this.x[a],dz=this.z[b]-this.z[a],l=Math.hypot(dx,dz)||1;this.tx[i]=dx/l;this.tz[i]=dz/l;}
  let x0=1e9,x1=-1e9,z0=1e9,z1=-1e9;for(let i=0;i<this.n;i++){x0=Math.min(x0,this.x[i]);x1=Math.max(x1,this.x[i]);z0=Math.min(z0,this.z[i]);z1=Math.max(z1,this.z[i]);}
  this.box=[x0,z0,x1,z1];this.center={x:(x0+x1)/2,z:(z0+z1)/2};
  // K3: zebras (por trecho, de cada lado) e muros (pneus e Jersey) do gerador; fora do asfalto e da zebra, areia
  const zb=json.zebras||{};this.zL=Uint8Array.from(zb.esquerda||[]);this.zR=Uint8Array.from(zb.direita||[]);
  // relevo (altura do chão em cada ponto do eixo, m) e a rampa dh/ds (média dos dois lados de cada ponto)
  this.h=new Float64Array(this.n);const rh=json.relevo?.h;if(rh)for(let i=0;i<this.n;i++)this.h[i]=rh[i]??0;
  this.dh=new Float64Array(this.n);for(let i=0;i<this.n;i++){const a=(i-1+this.n)%this.n,b=(i+1)%this.n,ds=(this.s[i+1]-this.s[i])+(this.s[i]-(i?this.s[i-1]:this.s[this.n-1]-this.L));this.dh[i]=(this.h[b]-this.h[a])/(ds||1);}
  // bordas por ponto e lado: zebra (m), tipo (1 fina, 2 larga) e faixa azul (m); sem bordas, a zebra antiga do gerador
  const bd=json.bordas;this.borda={L:{z:new Float64Array(this.n),t:new Uint8Array(this.n),a:new Float64Array(this.n)},R:{z:new Float64Array(this.n),t:new Uint8Array(this.n),a:new Float64Array(this.n)}};
  for(const [lado,nome,zz] of [['L','esquerda',this.zL],['R','direita',this.zR]])for(let i=0;i<this.n;i++){const B=this.borda[lado],q=bd?.[nome]?.[i];
   if(q){B.z[i]=q[0];B.t[i]=q[1];B.a[i]=q[2];}else if(!bd&&zz[i]){B.z[i]=this.zebra||0;B.t[i]=1;}}
  this.walls=[];this.wallAt=Array.from({length:this.n},()=>[]);
  for(const m of json.muros||[])for(let i=0;i+1<m.pontos.length;i++){const [ax,az]=m.pontos[i],[bx,bz]=m.pontos[i+1];if(Math.hypot(bx-ax,bz-az)>6&&m.tipo==='pneus')continue;   // (buraco entre trechos)
   const w={ax,az,bx,bz,r:m.raio,tipo:m.tipo},n=Math.max(1,Math.ceil(Math.hypot(bx-ax,bz-az)/2));this.walls.push(w);
   for(let k=0;k<=n;k++){const q=this.project(ax+(bx-ax)*k/n,az+(bz-az)*k/n);for(let o=-4;o<=4;o++){const L0=this.wallAt[(q.i+o+this.n)%this.n];if(!L0.includes(w))L0.push(w);}}}
  // muro perto ou dentro da pista (o Jersey da reta corta o asfalto do lado esquerdo no fim da curva 10): limite de lado para
  // o centro do kart em cada ponto (muro + meio kart + folga), para as linhas e o caminho não passarem nele
  this.limL=new Float64Array(this.n).fill(-99);this.limR=new Float64Array(this.n).fill(99);const fol=.68+.3;
  for(const w of this.walls){const L=Math.hypot(w.bx-w.ax,w.bz-w.az),n=Math.max(1,Math.ceil(L));
   for(let k=0;k<=n;k++){const q=this.project(w.ax+(w.bx-w.ax)*k/n,w.az+(w.bz-w.az)*k/n);if(Math.abs(q.d)>this.hw+2.5)continue;
    for(let o=-2;o<=2;o++){const i=(q.i+o+this.n)%this.n;if(q.d<0)this.limL[i]=Math.max(this.limL[i],q.d+w.r+fol);else this.limR[i]=Math.min(this.limR[i],q.d-w.r-fol);}}}
 }
 // piso no ponto (s, d): asfalto, zebra (só onde o gerador pôs) ou areia
 surface(s,d,i=this.idx(s)){const a=Math.abs(d);if(a<=this.hw)return 'asfalto';const B=d<0?this.borda.L:this.borda.R,z=B.z[i];
  if(a<=this.hw+z)return B.t[i]===2?'zebraLarga':'zebra';if(a<=this.hw+z+B.a[i])return 'azul';return this.json.bordas?'grama':'areia';}
 // altura do chão no ponto (s, d) e a rampa dh/ds no s (interpolando entre os pontos do eixo)
 altura(s){s=this.wrap(s);const i=this.idx(s),j=(i+1)%this.n,t=(s-this.s[i])/((this.s[i+1]-this.s[i])||1);return this.h[i]+(this.h[j]-this.h[i])*t;}
 rampa(s){s=this.wrap(s);const i=this.idx(s),j=(i+1)%this.n,t=(s-this.s[i])/((this.s[i+1]-this.s[i])||1);return this.dh[i]+(this.dh[j]-this.dh[i])*t;}
 wrap(s){s%=this.L;return s<0?s+this.L:s;}
 idx(s){s=this.wrap(s);let lo=0,hi=this.n-1;while(lo<hi){const m=(lo+hi+1)>>1;if(this.s[m]>s)hi=m-1;else lo=m;}return lo;}
 // ponto em (s, d): centro + d à direita; com o rumo
 point(s,d=0,out={}){s=this.wrap(s);const i=this.idx(s),j=(i+1)%this.n,t=(s-this.s[i])/((this.s[i+1]-this.s[i])||1);
  const x=this.x[i]+(this.x[j]-this.x[i])*t,z=this.z[i]+(this.z[j]-this.z[i])*t;let tx=this.tx[i]+(this.tx[j]-this.tx[i])*t,tz=this.tz[i]+(this.tz[j]-this.tz[i])*t;const l=Math.hypot(tx,tz)||1;tx/=l;tz/=l;
  out.x=x-tz*d;out.z=z+tx*d;out.tx=tx;out.tz=tz;out.s=s;return out;}
 // projeção: s e d (à direita); hint = índice perto (procura ±40 pontos) ou null (todos)
 project(x,z,hint=null){let best=null;const n=this.n,lo=hint==null?0:hint-40,hi=hint==null?n-1:hint+40;
  for(let k=lo;k<=hi;k++){const i=((k%n)+n)%n,j=(i+1)%n,dx=this.x[j]-this.x[i],dz=this.z[j]-this.z[i],l2=dx*dx+dz*dz,t=l2>0?clamp(((x-this.x[i])*dx+(z-this.z[i])*dz)/l2,0,1):0,qx=this.x[i]+dx*t,qz=this.z[i]+dz*t,dd=Math.hypot(x-qx,z-qz);
   if(!best||dd<best.dist){const l=Math.sqrt(l2)||1,side=(dx*(z-this.z[i])-dz*(x-this.x[i]))>0?1:-1;best={dist:dd,i,s:this.s[i]+(this.s[i+1]-this.s[i])*t,d:side*dd,tx:dx/l,tz:dz/l};}}
  return best;}
}

// ---------------------------------------------------------------- linha de corrida (menor curvatura dentro da pista)
// Gauss-Seidel do bi-laplaciano (P_i = (−P_{i−2} + 4P_{i−1} + 4P_{i+1} − P_{i+2}) / 6), projetado na normal de cada ponto e
// limitado à largura útil: a linha "estica" pelas curvas (por fora, tangencia por dentro, sai por fora).
// RCL-Karts: sobrerrelaxação (relax 1,9). Sem ela, 3000 passadas paravam a linha a até 3 m da de curvatura mínima (a
// linha não chegava à borda na maioria das curvas e as curvas ficavam mais fechadas do que são).
export function racingLine(track,{margem=KART_CONFIG.linha.margem,iter=KART_CONFIG.linha.iter,relax=KART_CONFIG.linha.relax??1}={}){
 const n=track.n,lim=track.hw-margem,d=new Float64Array(n),X=new Float64Array(n),Z=new Float64Array(n);
 for(let i=0;i<n;i++){X[i]=track.x[i];Z[i]=track.z[i];}
 for(let it=0;it<iter;it++)for(let i=0;i<n;i++){
  const a=(i-2+n)%n,b=(i-1+n)%n,c=(i+1)%n,e=(i+2)%n,px=(-X[a]+4*X[b]+4*X[c]-X[e])/6,pz=(-Z[a]+4*Z[b]+4*Z[c]-Z[e])/6;
  const rx=-track.tz[i],rz=track.tx[i],alvo=(px-track.x[i])*rx+(pz-track.z[i])*rz;
  const dd=clamp(d[i]+relax*(alvo-d[i]),Math.max(-lim,track.limL?.[i]??-lim),Math.min(lim,track.limR?.[i]??lim));d[i]=dd;X[i]=track.x[i]+rx*dd;Z[i]=track.z[i]+rz*dd;}
 return lineFromD(track,d,lim);
}
// a linha a partir do afastamento d de cada ponto: pontos, curvatura (círculo por i−2, i, i+2) e comprimento de cada trecho
export function lineFromD(track,d,lim){
 const n=track.n,X=new Float64Array(n),Z=new Float64Array(n),k=new Float64Array(n),ds=new Float64Array(n);
 for(let i=0;i<n;i++){X[i]=track.x[i]-track.tz[i]*d[i];Z[i]=track.z[i]+track.tx[i]*d[i];}
 for(let i=0;i<n;i++){const a=(i-2+n)%n,c=(i+2)%n,ax=X[a]-X[i],az=Z[a]-Z[i],cx=X[c]-X[i],cz=Z[c]-Z[i],cr=ax*cz-az*cx,la=Math.hypot(ax,az),lc=Math.hypot(cx,cz),lac=Math.hypot(X[c]-X[a],Z[c]-Z[a]);
  k[i]=la&&lc&&lac?2*cr/(la*lc*lac):0;const j=(i+1)%n;ds[i]=Math.hypot(X[j]-X[i],Z[j]-Z[i]);}
 let len=0;for(let i=0;i<n;i++)len+=ds[i];
 return {d,x:X,z:Z,k,ds,len,lim};
}
// K2: a linha de corrida deslocada o m para um lado (presa à pista e suavizada onde encosta na borda): por dentro / por fora
export function offsetLine(track,line,o,{lim=KART_CONFIG.linhas.lim,suaviza=KART_CONFIG.linhas.suaviza}={}){
 const n=track.n,lo=i=>Math.max(-lim,track.limL?.[i]??-lim),hi=i=>Math.min(lim,track.limR?.[i]??lim);let d=new Float64Array(n);for(let i=0;i<n;i++)d[i]=clamp(line.d[i]+o,lo(i),hi(i));
 for(let it=0;it<suaviza;it++){const e=new Float64Array(n);for(let i=0;i<n;i++)e[i]=clamp((d[(i-1+n)%n]+2*d[i]+d[(i+1)%n])/4,lo(i),hi(i));d=e;}
 return lineFromD(track,d,lim);
}
// K2: as curvas da volta (mínimos do perfil): onde começa a freada, o ápice e o lado de dentro (+1 direita, −1 esquerda)
export function findCorners(track,line,v){
 const n=track.n,out=[];
 for(let i=0;i<n;i++){const a=v[(i-1+n)%n],b=v[(i+1)%n];if(!(v[i]<=a&&v[i]<b))continue;
  let j=i,mx=v[i];for(let k=1;k<200;k++){const q=(i-k+n)%n;if(v[q]>=mx){mx=v[q];j=q;}else if(v[q]<mx-.3)break;}
  if(mx-v[i]<1.5)continue;let km=0,ki=i;for(let k=-10;k<=10;k++){const q=(i+k+n)%n;if(Math.abs(line.k[q])>km){km=Math.abs(line.k[q]);ki=q;}}
  out.push({apex:i,sApex:track.s[i],sBrake:track.s[j],vmin:v[i],vAntes:mx,side:line.k[ki]<0?1:-1,raio:1/Math.max(km,1e-4)});}
 return out;
}

// ---------------------------------------------------------------- perfil de velocidade (curva, freada, aceleração)
export function speedProfile(track,line,{atrito=1,freio=1,cfg=KART_CONFIG}={}){
 const n=track.n,v=new Float64Array(n),g=cfg.g,mu=cfg.mu*cfg.perfil.atrito*atrito,vmax=40;
 for(let i=0;i<n;i++)v[i]=Math.min(vmax,Math.sqrt(mu*g/Math.max(Math.abs(line.k[i]),1e-4)));
 const gr=i=>g*(track.dh?.[i]??0);   // (subindo, g × rampa freia; descendo, empurra)
 const acc=(vv,i)=>Math.max(0,(Math.min(cfg.tracaoMax,cfg.potencia/Math.max(vv,1))-.5*1.2*cfg.cdA*vv*vv-cfg.rolamento*cfg.massa*g)/cfg.massa-gr(i));
 const dec=(vv,i)=>Math.max(.5,cfg.freioMax*cfg.perfil.freio*freio/cfg.massa+(.5*1.2*cfg.cdA*vv*vv)/cfg.massa+gr(i));
 for(let pass=0;pass<3;pass++){
  // (círculo de atrito: o que a curva já usa de lado sobra menos para frear e acelerar)
  const rest=(vv,i)=>Math.sqrt(Math.max(.08,1-Math.pow(vv*vv*Math.abs(line.k[i])/(mu*g),2)));
  for(let k=2*n;k>0;k--){const i=k%n,j=(i+1)%n;v[i]=Math.min(v[i],Math.sqrt(v[j]*v[j]+2*dec(v[j],i)*rest(v[j],j)*line.ds[i]));}      // freada (de trás para a frente)
  for(let k=0;k<2*n;k++){const i=k%n,j=(i+1)%n;v[j]=Math.min(v[j],Math.sqrt(Math.max(0,v[i]*v[i]+2*acc(v[i],i)*rest(v[i],i)*line.ds[i])));}}     // aceleração
 // vb: só curva e freada (sem o limite da aceleração) — acima de v e abaixo de vb, pé embaixo (reta, saída, vácuo)
 const vb=new Float64Array(n);for(let i=0;i<n;i++)vb[i]=Math.min(vmax,Math.sqrt(mu*g/Math.max(Math.abs(line.k[i]),1e-4)));
 for(let pass=0;pass<3;pass++){const rest=(vv,i)=>Math.sqrt(Math.max(.08,1-Math.pow(vv*vv*Math.abs(line.k[i])/(mu*g),2)));
  for(let k=2*n;k>0;k--){const i=k%n,j=(i+1)%n;vb[i]=Math.min(vb[i],Math.sqrt(vb[j]*vb[j]+2*dec(vb[j],i)*rest(vb[j],j)*line.ds[i]));}}
 let t=0;for(let i=0;i<n;i++)t+=line.ds[i]/Math.max(.5,(v[i]+v[(i+1)%n])/2);
 return {v,vb,lapTime:t};
}

// ---------------------------------------------------------------- física do kart (bicicleta, esquerda positiva)
// estado: x, z, yaw (frente = (sen yaw, cos yaw)); vx (à frente), vy (à esquerda), r (yaw por s, + = vira à esquerda);
// k.draft (K2): fração do arrasto que o vácuo tira (0 sozinho)
export function kartStep(k,inp,dt,cfg=KART_CONFIG){
 const m=cfg.massa,g=cfg.g,a=cfg.cgFrente,b=cfg.entreEixos-cfg.cgFrente,L=cfg.entreEixos;
 // volante com velocidade limitada
 const want=clamp(inp.volante,-cfg.volanteMax,cfg.volanteMax);k.delta+=clamp(want-k.delta,-cfg.volanteVel*dt,cfg.volanteVel*dt);
 const vx=k.vx,vy=k.vy,r=k.r,mu=cfg.mu*(k.grip??1),muT=mu*(k.gripTras??1);
 const sy=Math.sin(k.yaw),cy=Math.cos(k.yaw),gf=-g*((k.gx||0)*sy+(k.gz||0)*cy),gl=-g*((k.gx||0)*cy-(k.gz||0)*sy);   // rampa: para a frente e para a esquerda
 // carga por eixo com transferência longitudinal
 const ax=k.ax||0,Fzf=Math.max(50,m*g*b/L-m*ax*cfg.altCG/L),Fzr=Math.max(50,m*g*a/L+m*ax*cfg.altCG/L);
 // força longitudinal atrás (motor ou freio), limitada pelo círculo de atrito
 const drive=inp.acel*Math.min(cfg.tracaoMax,cfg.potencia/Math.max(vx,1)),brake=inp.freio*cfg.freioMax*(vx>.05?1:0);
 const ff=cfg.freioFrente;let Fx=drive-brake*(1-ff),Fxf=-brake*ff;   // freio nos dois eixos; motor atrás
 if(vx<.5){   // devagar: modelo cinemático (sem ângulo de deriva)
  const drag=(cfg.rolamento+(k.roll||0))*m*g*(vx>0?1:0);const axx=(Fx+Fxf-drag)/m+(vx>0||gf>0?gf:0);k.vx=Math.max(0,vx+axx*dt);k.vy=0;k.r=k.vx*Math.tan(k.delta)/L;k.ax=axx;
 }else{
  const af=k.delta-Math.atan2(vy+a*r,vx),ar=-Math.atan2(vy-b*r,vx);
  const satur=(C,al,Fz)=>{const F=mu*Fz;return F*Math.tanh(C*al/F);};
  let Fyf=satur(cfg.rigidezFrente,af,Fzf),Fyr=satur(cfg.rigidezTras,ar,Fzr*(muT/mu));
  const lim=muT*Fzr,tot=Math.hypot(Fx,Fyr);if(tot>lim){Fx*=lim/tot;Fyr*=lim/tot;}   // círculo de atrito em cada eixo
  const limf=mu*Fzf,totf=Math.hypot(Fxf,Fyf);if(totf>limf){Fxf*=limf/totf;Fyf*=limf/totf;}
  if(k.trava){Fxf=-.6*limf;Fyf*=.15;}   // (K3: dianteira travada: escorrega reto, quase sem força de lado)
  const drag=.5*1.2*cfg.cdA*(1-(k.draft||0))*vx*Math.abs(vx)+(cfg.rolamento+(k.roll||0))*m*g,cd=Math.cos(k.delta),sd=Math.sin(k.delta);
  const dvx=(Fx+Fxf*cd-Fyf*sd-drag)/m+vy*r+gf,dvy=(Fyr+Fyf*cd+Fxf*sd)/m-vx*r+gl,dr=(a*(Fyf*cd+Fxf*sd)-b*Fyr)/cfg.inercia;
  k.vx=Math.max(0,vx+dvx*dt);k.vy=vy+dvy*dt;k.r=r+dr*dt;k.ax=dvx-vy*r;k.slipR=ar;k.slipF=af;
  if(k.vx<.5){k.vy*=.5;k.r*=.5;}
 }
 // posição
 const s=Math.sin(k.yaw),c=Math.cos(k.yaw);   // frente (s, c); esquerda (c, −s)
 k.x+=(s*k.vx+c*k.vy)*dt;k.z+=(c*k.vx-s*k.vy)*dt;k.yaw+=k.r*dt;k.odo=(k.odo||0)+Math.hypot(k.vx,k.vy)*dt;
}

// ---------------------------------------------------------------- pilotos
// nível: tudo perto (faixa estreita, como os 0,4–0,6 do Pure), cada um com o seu jeito
export function makeDrivers(n=KART_CONFIG.pilotos,seed=74){
 const r=rngK(seed),out=[],cores=[0xc8202a,0x1f4fbf,0xf2c419,0x2e8b3a,0xff7a1a,0x7b2fbf,0x18a7b5,0xe8e8e8,0x202020,0xd94f9a];
 for(let i=0;i<n;i++){const nivel=.45+.1*r();   // 0,45–0,55
  const u=(nivel-.45)/.1;   // 0–1 dentro da faixa
  out.push({id:i+1,numero:i+1,cor:cores[i%cores.length],nivel,
   atrito:.955+.03*u+.008*(r()-.5),        // quanto do atrito do perfil ousa usar na curva
   freio:.9+.07*u+.02*(r()-.5),             // quanto da freada usa (freia mais cedo ou mais tarde)
   linha:.3-.15*u,                          // m · quanto a linha dele varia (desvio padrão)
   constancia:.012-.006*u,                  // variação do ritmo (desvio padrão, fração da velocidade)
   olhar:3+.25*r(),                         // m · olhar à frente (pure pursuit) mínimo
   agressivo:.3+.4*r(),defesa:.3+.4*r()});}   // (K2)
 return out;
}

// RCL-Karts: põe o kart parado no chão do relevo (altura, bico e lado pela rampa no s dele); a corrida faz o mesmo a cada
// passo, mas o grid e a volta à pista colocam o kart antes do primeiro passo.
export function assentaNoChao(track,k){if(!track.altura){k.y=0;k.arfagem=0;k.rolagem=0;return k;}
 const dh=track.rampa(k.s),q=track.point(k.s,0,{}),gx=dh*q.tx,gz=dh*q.tz;k.y=track.altura(k.s);
 k.arfagem=Math.atan(gx*Math.sin(k.yaw)+gz*Math.cos(k.yaw));k.rolagem=Math.atan(gx*Math.cos(k.yaw)-gz*Math.sin(k.yaw));return k;}

// ---------------------------------------------------------------- corrida
export class KartRace{
 constructor(trackJson,{seed=74,pilotos=KART_CONFIG.pilotos,cfg=KART_CONFIG,start='espalhado'}={}){
  this.cfg=cfg;this.track=new KartTrack(trackJson);this.line=racingLine(this.track,cfg.linha);this.rnd=rngK(seed^0x7a11);this.time=0;this.acc=0;
  // K2: linhas deslocadas (por dentro e por fora) e as curvas da volta
  this.offs=[...cfg.linhas.desloc];this.lines=this.offs.map(o=>o===0?this.line:offsetLine(this.track,this.line,o,cfg.linhas));this.mid=this.offs.indexOf(0);
  const ref=speedProfile(this.track,this.line,{cfg});this.corners=findCorners(this.track,this.line,ref.v);this.refLap=ref.lapTime;
  this.nextCorner=new Int16Array(this.track.n);{const C=this.corners,T=this.track;for(let i=0;i<T.n;i++){let best=-1,bd=1e9;for(let c=0;c<C.length;c++){const d=T.wrap(C[c].sApex-T.s[i]);if(d<bd){bd=d;best=c;}}this.nextCorner[i]=best;}}
  this.drivers=makeDrivers(pilotos,seed);this.obstacles=[];
  // parados do cenário (enquanto estiverem no mundo): obstáculos fixos
  for(const p of trackJson.parados||[]){const q=this.track.project(p.x,p.z);this.obstacles.push({x:p.x,z:p.z,fx:p.fx,fz:p.fz,s:q.s,d:q.d,fixo:true,length:cfg.comprimento,width:cfg.largura});}
  {const lim=this.track.hw-.8;for(const o of this.obstacles){const Ld=this.lineD(o.s),l=o.d-cfg.desvio.lado,r=o.d+cfg.desvio.lado,okL=l>=-lim,okR=r<=lim;o.pass=okL&&(!okR||Math.abs(Ld-l)<=Math.abs(Ld-r))?-1:1;}}   // (parado: todos passam pelo lado mais perto da linha de corrida)
  const T=this.track,pack=start==='lancada'?this.packSpot(Math.ceil(pilotos/2)):null;
  this.karts=this.drivers.map((dr,i)=>{
   let s0,d0=null;
   if(start==='grid')s0=T.L-6-i*5;
   else if(pack!=null){s0=T.wrap(pack-Math.floor(i/2)*cfg.lancada.fila);d0=(i%2?1:-1)*cfg.lancada.coluna;}
   else{s0=T.wrap(T.L*i/pilotos+5);for(let t=0;t<6&&this.obstacles.some(o=>Math.abs(T.wrap(o.s-s0+T.L/2)-T.L/2)<12);t++)s0=T.wrap(s0+8);}   // (não nasce em cima de kart parado)
   if(d0==null)d0=this.lineD(s0);
   const k={id:dr.id,dr,x:0,z:0,y:0,yaw:0,vx:0,vy:0,r:0,delta:0,ax:0,s:s0,d:d0,hint:T.idx(s0),
    lap:0,lapStart:null,laps:[],best:null,dist:0,lineOff:0,lineOffT:0,paceVar:0,avoid:0,inp:{volante:0,acel:0,freio:0},
    off:0,offT:0,ov:null,cool:0,held:0,draft:0,defS:null,defOff:0,blue:0,late:0,passes:0,aborts:0,defs:0,
    length:cfg.comprimento,width:cfg.largura,height:cfg.altura,tx:1,tz:0,v:0,kind:'kart',offTrack:0};
   this.setDriver(k,dr);
   const P=T.point(s0,d0),Q=T.point(s0+1,pack!=null?d0:this.lineD(s0+1));
   const v0=start==='grid'?0:(pack!=null?cfg.lancada.vel:.6)*this.profAt(k.prof.v,s0);   // (solto andando, abaixo do ritmo)
   k.x=P.x;k.z=P.z;k.yaw=Math.atan2(Q.x-P.x,Q.z-P.z);k.vx=k.v=v0;k.tx=P.tx;k.tz=P.tz;assentaNoChao(T,k);
   if(pack!=null){k.off=k.offT=0;}
   return k;});
  if(pack!=null)for(const k of this.karts)k.dist=this.rel({s:pack},k);   // (quem está na frente da fila larga na frente)
 }
 // perfis do piloto em cada linha (o jeito dele: aderência e freada)
 setDriver(k,dr){k.dr=dr;k.profs=this.lines.map(L=>speedProfile(this.track,L,{atrito:dr.atrito,freio:dr.freio,cfg:this.cfg}));k.prof=k.profs[this.mid];}
 // trecho reto sem kart parado para a largada lançada (a fila de trás para a frente)
 packSpot(rows){const T=this.track,len=rows*this.cfg.lancada.fila;let best=null;
  for(let s=0;s<T.L;s+=2){let ok=true,ahead=999;for(const o of this.obstacles){const e=T.wrap(o.s-s);if(T.wrap(s-o.s)<len+12){ok=false;break;}ahead=Math.min(ahead,e);}if(!ok)continue;
   let kmax=0;for(let x=-len;x<=6;x+=2){const i=T.idx(s+x);kmax=Math.max(kmax,Math.abs(this.line.k[i]));}if(kmax>.02)continue;
   const c=this.corners[this.nextCorner[T.idx(s)]],dc=c?T.wrap(c.sBrake-s):99;if(dc<25)continue;
   const score=Math.min(ahead,250)+Math.min(dc,80)*.5;   // (longe do próximo parado; com reta até a freada)
   if(!best||score>best.score)best={s,score};}
  return best?best.s:T.L-6;}
 rel(k,o){let ds=this.track.wrap(o.s-k.s);if(ds>this.track.L/2)ds-=this.track.L;return ds;}   // + = o à frente de k
 _at(s){const T=this.track,i=T.idx(s),j=(i+1)%T.n;return [i,j,(T.wrap(s)-T.s[i])/((T.s[i+1]-T.s[i])||1)];}
 lineD(s){const [i,j,t]=this._at(s);return this.line.d[i]+(this.line.d[j]-this.line.d[i])*t;}
 profAt(v,s){const [i,j,t]=this._at(s);return v[i]+(v[j]-v[i])*t;}
 // K2: afastamento da linha deslocada o (entre as linhas calculadas) e a velocidade do piloto nela
 _br(o){const O=this.offs;o=clamp(o,O[0],O[O.length-1]);let m=0;while(m<O.length-2&&o>O[m+1])m++;return [m,(o-O[m])/(O[m+1]-O[m])];}
 dOff(o,s){const [m,u]=this._br(o),[i,j,t]=this._at(s),A=this.lines[m].d,B=this.lines[m+1].d,a=A[i]+(A[j]-A[i])*t,b=B[i]+(B[j]-B[i])*t;return a+(b-a)*u;}
 vOff(k,o,s,key){const [m,u]=this._br(o),[i,j,t]=this._at(s),A=k.profs[m][key],B=k.profs[m+1][key],a=A[i]+(A[j]-A[i])*t,b=B[i]+(B[j]-B[i])*t;return a+(b-a)*u;}
 // a próxima curva: lado de dentro, quanto falta para a freada e para o ápice (freada negativa = já freando)
 cornerAt(s){const c=this.corners[this.nextCorner[this.track.idx(s)]];if(!c)return {side:1,dApex:999,dBrake:999,sApex:s,queda:0};const dA=this.track.wrap(c.sApex-s);return {side:c.side,dApex:dA,dBrake:dA-this.track.wrap(c.sApex-c.sBrake),sApex:c.sApex,queda:c.vAntes-c.vmin};}
 setObstacles(list){this.dyn=list||[];}
 log(tipo,k,det){this.events=this.events||[];this.events.push({t:+this.time.toFixed(1),tipo,id:k.id,s:+k.s.toFixed(0),...(det?{det}:{})});if(this.events.length>300)this.events.shift();}   // obstáculos que mudam (a moto do jogador): [{x, z, length, width}]

 // K2: tática — planejador de faixa (cada kart a cada 0,1 s, em rodízio na ordem da corrida). Para cada kart: algumas faixas
 // candidatas (afastamentos da linha de corrida: a dele, a linha, um lado e o outro, por dentro e por fora da próxima curva);
 // prevê 2,5 s de cada uma (troca de faixa limitada, mais devagar na curva; velocidade do perfil dele naquela faixa, acelerando
 // e freando) e escolhe a que anda mais. Os que vão na frente na corrida já planejaram: o plano deles é obstáculo (segue atrás
 // ou vai para o lado); quem está emparelhado comigo agora tem o espaço dele (não entro nele); parado do cenário e a moto
 // também. Colado atrás de alguém (preso, ou antes de uma freada forte) decide uma vez por curva se briga: brigando, arrisca
 // mais (usa mais da aderência) — e aí a faixa do lado passa a valer a pena. Defesa: um movimento por reta para o lado de
 // dentro, antes de o outro emparelhar. Retardatário abre caminho. Perto de kart parado do cenário: ninguém briga, em fila.
 accelAt(v,k){const c=this.cfg;return Math.max(0,(Math.min(c.tracaoMax,c.potencia/Math.max(v,1))-.5*1.2*c.cdA*(1-(k.draft||0))*v*v-c.rolamento*c.massa*c.g)/c.massa);}
 plan(k){
  const T=this.track,c=this.cfg,P=c.plano,A=c.ataque,D=c.defesa,L=T.L,C=this.cornerAt(k.s),lim=c.linhas.desloc[c.linhas.desloc.length-1];
  const n=Math.round(P.horizonte/P.passo),dt=P.passo,half=k.length,Lmin=half+P.folgaS,W=k.width+P.folgaD,ci=this.nextCorner[T.idx(k.s)];
  k.cool=Math.max(0,k.cool-dt);k.blue=Math.max(0,k.blue-dt);
  // quem conta: os de prioridade maior (já planejaram) e quem está emparelhado comigo agora (espaço dele)
  const others=[];let behind=null,bGap=1e9;
  for(const o of this.karts){if(o===k)continue;const ds=this.rel(k,o);if(ds<-12||ds>55)continue;
   const hi=o.prio<k.prio,beside=ds>-(half+.4)&&ds<half+.4;
   if(hi&&o.plan)others.push({o,hi,ds,S:o.plan.S,D:o.plan.D});else if(beside||hi)others.push({o,hi,ds,cv:true});
   if(ds<=0&&ds>-16){const g=-ds-half;if(g<bGap){bGap=g;behind=o;}}}
  // quem rodou ou está bem mais lento logo à frente (mesmo com prioridade menor): a faixa dele não serve
  for(const o of this.karts){if(o===k||o.prio<k.prio)continue;const ds=this.rel(k,o);if(ds>0&&ds<45&&(o.rec||o.v<k.v-4)&&!others.some(x=>x.o===o))others.push({o,hi:false,ds,cv:true,slow:true});}
  // parados do cenário e a moto do jogador: obstáculo fixo (a faixa que passa neles não serve)
  for(const o of [...this.obstacles,...(this.dynProj||[])]){let ds=T.wrap(o.s-k.s);if(ds>L/2)ds-=L;if(ds<-4||ds>45)continue;others.push({o:{...o,v:0},hi:true,ds,cv:true,stat:true,w:(k.width+(o.width||1.4))/2+P.folgaD});}
  // o da frente na minha faixa, perto: é quem eu atacaria
  let lead=null,lg=1e9;for(const x of others){const o=x.o,g=x.ds-half;if(x.ds>half&&g<7&&Math.abs(o.d-k.d)<1.7&&g<lg){lg=g;lead=o;}}
  if(k.ov){const ds=this.rel(k,k.ov.o);if(ds>-(half+2)&&ds<12){lead=k.ov.o;lg=ds-half;}}   // (atacando: continua sendo ele)
  const lapping=lead&&(k.dist-lead.dist)>L*.5;
  // briga? (uma decisão por curva: chance .45 + .5 × agressivo) — preso atrás há um tempo, ou colado antes de freada forte
  const chance=lead&&(lapping||lg<A.colado&&(k.held>A.preso||C.queda>A.forte&&C.dBrake>2&&C.dBrake<A.mergulho));   // (colado: preso atrás, ou antes de freada forte)
  if(chance&&!k.ov&&k.cool<=0&&k.atkRoll!==ci){k.atkRoll=ci;k.atkGo=lapping||this.rnd()<A.chance+.5*k.dr.agressivo?ci:-1;}
  // K3: erro nesta curva? (uma decisão por curva, perto da freada) — mais nos de nível menor, sob pressão e brigando
  if(c.erro.base>0&&k.errRoll!==ci&&C.dBrake<20&&C.dBrake>4&&!k.rec){k.errRoll=ci;
   const E0=c.erro,niv=clamp((k.dr.nivel-.45)/.1,0,1),press=behind&&bGap<2?E0.pressao:0,brig=k.ov?E0.briga:0,p=E0.base*(1-.5*niv)*(1+press+brig)*(C.queda>A.forte?1.3:.7);
   if(this.rnd()<p){const r=this.rnd(),tp=r<E0.tipos.freada?'freada':r<E0.tipos.freada+E0.tipos.saida?'saida':'travou',rg=E0[tp],sev=Array.isArray(rg)?rg[0]+(rg[1]-rg[0])*this.rnd():0;
    k.err={tipo:tp,sApex:C.sApex,side:C.side,sev,t:0,depois:tp==='saida'?30:6};k.errs=(k.errs||0)+1;this.log('erro',k,tp);}}
  // zona de cuidado: kart parado do cenário logo à frente — ninguém briga, todos em fila pelo lado de passagem dele
  let caution=null;for(const o of this.obstacles){let ds=T.wrap(o.s-k.s);if(ds>L/2)ds-=L;if(ds>-5&&ds<P.cuidado&&(!caution||ds<caution.ds))caution={o,ds};}
  k.caution=caution;
  const fight=!!lead&&!caution&&(k.ov||k.atkGo===ci)&&k.cool<=0;
  // defesa (não atacando): o de trás colado antes de uma freada forte e ainda sem emparelhar → fecha por dentro (às vezes)
  if(k.defS!=null){const e=T.wrap(k.s-k.defS);if(e>2&&e<L/2){k.defS=null;k.defOff=0;}}
  if(behind&&!k.ov){const b=behind,ds=this.rel(k,b),bLapping=(b.dist-k.dist)>L*.5,kLapping=(k.dist-b.dist)>L*.5;
   if(bLapping&&bGap<10)k.blue=1.5;
   else if(k.defS==null&&!kLapping){const threat=bGap<A.colado+.5&&b.v-k.v<1&&Math.abs(b.d-k.d)<.8,bOverlap=-ds<half+.4;
    if(threat&&!bOverlap&&C.queda>A.forte&&C.dBrake>8&&C.dBrake<A.mergulho+15&&k.defRoll!==ci){k.defRoll=ci;if(this.rnd()<D.chance+.3*k.dr.defesa){k.defS=C.sApex;k.defOff=C.side*D.desloc;k.defs++;}}}}
  // candidatas
  const set=new Map(),add=x=>{x=clamp(Math.round(x*20)/20,-lim,lim);set.set(x.toFixed(2),x);};
  if(caution){const o=caution.o,dP=clamp(o.d+o.pass*(c.desvio.lado+.25),-T.hw+.8,T.hw-.8);add(dP-this.lineD(o.s)-k.lineOff);if(caution.ds<0)add(0);}
  else if(k.defS!=null){add(k.defOff);add(k.off);}
  else if(!others.some(x=>x.ds>-Lmin&&x.ds<P.perto)){add(0);if(Math.abs(k.off)>.05)add(k.off);}   // ninguém perto (nem parado): linha de corrida
  else{add(k.off);add(0);add(k.off-P.faixa);add(k.off+P.faixa);add(C.side*lim);add(-C.side*lim);if(k.blue>0)add(-C.side*1.2);}
  const base=k.d-this.dOff(k.off+k.lineOff,k.s),boostF=(1+(k.form||0))*(1+k.paceVar);
  let best=null;
  for(const cand of set.values()){
   const atk=fight&&Math.abs(this.dOff(cand+k.lineOff,lead.s)-lead.d)>1.4;   // nessa faixa sai de trás dele: briga
   const boost=boostF*(1+(atk&&!lapping?A.tarde*(1+k.dr.agressivo):0)),lv0=atk?c.lateral.ataque:c.lateral.vel;
   let e=k.off,v=k.v,dist=0,bad=0,follow=null,vNext=null;const S=[0],Dd=[k.d];
   for(let i=1;i<=n;i++){
    const sNow=k.s+dist,kc=Math.abs(this.line.k[T.idx(sNow)]),lv=lv0*clamp(1-kc/.06,.25,1);e+=clamp(cand-e,-lv*dt,lv*dt);
    const vl=this.vOff(k,e+k.lineOff,sNow+v*.15,'vb')*boost;
    v=v<vl?Math.min(vl,v+this.accelAt(v,k)*dt):Math.max(vl,v-P.freada*dt);
    const prev=dist;dist+=v*dt;const d=this.dOff(e+k.lineOff,k.s+dist)+base*Math.exp(-i*dt/.4);
    for(const x of others){const o=x.o;let ds,dj,vj;
     if(x.cv){ds=x.ds+o.v*i*dt-dist;dj=o.d;vj=o.v;}else{ds=x.ds+x.S[i]-dist;dj=x.D[i];vj=Math.max(0,(x.S[i]-x.S[i-1])/dt);}
     if(Math.abs(dj-d)>=(x.w||W)||ds<=-Lmin||ds>=Lmin+(x.stat?P.paradoS:0))continue;
     if(x.stat||x.slow){bad+=1;if(ds>0){const cap=dist+ds-Lmin-P.paradoS;if(cap<dist){dist=Math.max(prev,cap);v=Math.min(v,(dist-prev)/dt+.5);}}continue;}   // (parado: desvia; se não der, para bem antes — com espaço para contornar)
     if(x.hi&&ds>0){const cap=dist+ds-Lmin;if(cap<dist){dist=Math.max(prev,cap);v=Math.min(v,vj,(dist-prev)/dt+.5);follow=follow||o;}}   // segue atrás dele
     else bad+=1;}   // espaço de quem tem prioridade (vindo de trás) ou de quem está emparelhado comigo: não
    S.push(dist);Dd.push(d);if(i===3)vNext=v;}
   const score=dist-P.troca*Math.abs(cand-k.off)-P.fora*Math.abs(cand)-P.ruim*bad;
   if(!best||score>best.score)best={cand,score,S,D:Dd,follow,atk,vNext};}
  k.plan={S:best.S,D:best.D};k.offT=best.cand;k.vPlan=best.follow?best.vNext:null;
  // ataque: começa quando a faixa escolhida sai de trás do da frente; termina passando (à frente, com folga) ou desistindo
  if(best.atk&&!k.ov)k.ov={o:lead,side:Math.sign(this.dOff(best.cand+k.lineOff,lead.s)-lead.d)||1,t:0,kind:lapping?'retardatario':'briga'};
  if(k.ov){const o=k.ov.o,ds=this.rel(k,o),h=(o.length+k.length)/2;k.ov.t+=dt;
   if(ds<-(h+A.passou)){k.ov=null;k.cool=1;}
   else if(caution||!best.atk&&ds>-h*.3||ds>10||k.ov.t>A.max){k.ov=null;k.cool=A.esfria*(.7+.6*this.rnd());k.aborts++;k.atkGo=-1;}}
  // brigando (menos com retardatário): arrisca mais — freia mais tarde e contorna mais rápido
  k.late=k.ov&&k.ov.kind!=='retardatario'?A.tarde*(1+k.dr.agressivo):0;
 }

 // piloto: linha (tática + jeito dele + desvio + quem está ao lado), velocidade do perfil dele naquela linha (com quem vai no
 // caminho dele e o vácuo), volante por pure pursuit
 drive(k,dt){
  const T=this.track,c=this.cfg,dr=k.dr,v=Math.hypot(k.vx,k.vy);
  // variação lenta da linha e do ritmo (constância)
  k.lineOffT-=dt;if(k.lineOffT<=0){k.lineOffT=3+4*this.rnd();k.lineTarget=clamp(gauss(this.rnd)*dr.linha,-.5,.5);k.paceTarget=gauss(this.rnd)*dr.constancia;}
  // forma: o ritmo do piloto oscila devagar (voltas boas e ruins; ~25 s), mais nos de nível menor
  k.formT=(k.formT||0)-dt;if(k.formT<=0){k.formT=c.forma.tempo*(.6+.8*this.rnd());k.formTarget=gauss(this.rnd)*c.forma.sigma*(1.5-dr.nivel);}
  k.form=(k.form||0)+((k.formTarget||0)-(k.form||0))*Math.min(1,dt/8);
  k.lineOff+=((k.lineTarget||0)-k.lineOff)*Math.min(1,dt/2);k.paceVar+=(Math.min(.015,k.paceTarget||0)-k.paceVar)*Math.min(1,dt/3);   // (acima do perfil, no máximo +1,5%)
  // K3: rodada — de lado ou de costas para a pista, devagar: gira no lugar para o sentido da corrida, espera brecha atrás, volta
  {const R=c.rodada,ti=T.idx(k.s);let he=k.yaw-Math.atan2(T.tx[ti],T.tz[ti]);he=Math.atan2(Math.sin(he),Math.cos(he));
   if(!k.rec&&Math.abs(he)>R.angulo&&v<R.parado){k.rec={fase:'gira',t:0};k.spins=(k.spins||0)+1;k.err=null;k.trava=false;this.log('rodou',k);}
   if(k.rec){k.rec.t+=dt;k.inp.acel=0;k.inp.freio=1;k.inp.volante=0;k.vx=Math.min(k.vx,.3);k.vy*=.5;k.r=0;k.ov=null;
    if(k.rec.fase==='gira'){k.yaw-=clamp(he,-R.gira*dt,R.gira*dt);const P=k.rec.empurra;
     if(P){k.x+=-T.tz[ti]*P*R.empurra*dt;k.z+=T.tx[ti]*P*R.empurra*dt;}   // (enroscado no parado ou no muro: o fiscal empurra de lado)
     if(Math.abs(he)<.3&&(!P||this.time-(k.lastStat||-9)>.5||k.rec.t>6))k.rec.fase='espera';return;}
    const vem=this.karts.some(o=>o!==k&&!o.rec&&this.rel(k,o)<0&&this.rel(k,o)>-R.brecha&&Math.abs(o.d-k.d)<2.8&&o.v>4);   // (alguém chegando atrás, na minha faixa)
    if(vem&&k.rec.t<12)return;k.rec=null;}}
  // K3: erro em curso (decidido no planejador): freada passada, saída com pé demais, travada
  // (freada: freia pouco até passar a tangência — chega rápido demais e sai de frente; saída: pé embaixo depois da tangência,
  // sem aliviar nem segurar a traseira, deixando o kart abrir até a zebra ou a areia; travou: na tomada da curva trava a
  // dianteira por 0,4–0,9 s e vai reto)
  let em=1,noCut=false,wide=0;const E=k.err;k.trava=false;
  if(E){E.t+=dt;const ds=-this.rel(k,{s:E.sApex});
   if(ds>E.depois||E.t>8)k.err=null;
   else if(E.tipo==='freada'){if(ds<3)em=1+E.sev;}
   else if(E.tipo==='saida'){if(ds>-1){if(E.pe==null){E.pe=.6+.8*E.sev;E.w=1.2+3*E.sev*E.sev;E.p0=k.s;}E.pe-=dt;
     if(E.pe>0)noCut=true;wide=-E.side*E.w*smooth(clamp(T.wrap(k.s-E.p0)/12,0,1))*clamp(1-Math.max(0,-E.pe)/1.5,0,1);if(E.pe<-1.5)k.err=null;}}
   else if(E.tipo==='travou'){if(E.lock==null&&ds>-1.1*v&&ds<-.4*v)E.lock=E.sev;if(E.lock>0){E.lock-=dt;k.trava=E.lock>0;}else if(E.lock!=null&&E.lock<=0)k.err=null;}}
  k.shock=Math.max(0,(k.shock||0)-dt);
  // muda de linha só se a nova linha aguenta a velocidade de agora (numa curva rápida, espera a reta)
  // (na curva, troca de faixa devagar: o kart já está usando o pneu para virar)
  {const kc=Math.max(Math.abs(this.line.k[T.idx(k.s)]),Math.abs(this.line.k[T.idx(k.s+v*.6)])),lv=(k.ov?c.lateral.ataque:c.lateral.vel)*clamp(1-kc/.06,.25,1),st=clamp(k.offT-k.off,-lv*dt,lv*dt);if(st!==0){const no=k.off+st;if(Math.abs(no)<Math.abs(k.off)||this.vOff(k,no+k.lineOff,k.s+v*.3,'vb')*(1+(k.late||0))>=v-.3)k.off=no;}}
  const myO=k.off+k.lineOff,lim=T.hw-.8,cons=[];let obsAhead=null;k.sides=k.sides||new Map();k.ksides=k.ksides||new Map();
  const Ld=(near)=>Math.max(near?2.5:dr.olhar,(near?1.6:2.2)+.32*v);
  // outros karts ao lado (sobreposição, ou quase) ou o que estou atacando: o lado de cada um (fixo enquanto perto) e o espaço
  // dele; quem só vai na frente é fila (seguir, abaixo)
  for(const o of this.karts){if(o===k)continue;const ds=this.rel(k,o),half=(o.length+k.length)/2,lat=o.d-k.d;
   const attacking=k.ov&&k.ov.o===o,inLane=Math.abs(lat)<1.2&&!attacking;
   const diving=o.ov&&o.ov.o===k&&Math.abs(lat)>1.2&&ds>-(half+2.2);   // (mergulhou por dentro com o bico perto da minha traseira: tem espaço)
   const rel=(ds>-(half+.4)||diving)&&(attacking?ds<Ld(false)+c.lado.olha:ds<half+1)&&(!inLane||ds<half);
   if(!rel){k.ksides.delete(o.id);continue;}
   let side=k.ksides.get(o.id);if(side==null){side=attacking?k.ov.side:(lat>0?-1:1);k.ksides.set(o.id,side);}
   if(attacking&&side!==k.ov.side){if(ds>half+.3){side=k.ov.side;k.ksides.set(o.id,side);}else{k.ov=null;k.cool=1;k.aborts++;}}   // (nunca troca de lado através do outro)
   const oO=o.off!=null?o.off+(o.lineOff||0):null,shift=oO!=null?o.d-this.dOff(oO,o.s):0;
   // (conservador: até o outro sair do lugar, conta onde ele está agora; a linha dele só vale se o afastar de mim)
   const bound=ss=>{const p=oO!=null?this.dOff(oO,ss)+shift:o.d;return clamp((side>0?Math.max(o.d,p):Math.min(o.d,p))+side*c.lado.sep,-lim,lim);};
   // (a troca de lado começa onde eu estou: f0 = quanto do afastamento já tenho; o resto em ~1,8 s de caminho; vale até onde
   // ele vai estar, porque ele anda junto)
   const bNow=bound(k.s),baseNow=this.dOff(myO,k.s),needNow=side>0?bNow-baseNow:baseNow-bNow,haveNow=side>0?k.d-baseNow:baseNow-k.d;
   cons.push({kart:true,o,s:o.s,side,e0:-half,e1:Math.max(Ld(false)+4,o.v*1.8),bound,f0:needNow>.05?clamp(haveNow/needNow,0,1):1});}
  // desvio: obstáculo parado (ou a moto) à frente → escolhe o lado (uma vez por aproximação) e a linha passa a pelo menos
  // `lado` m do centro dele, entrando suave antes e voltando depois
  const rampK=Math.max(8,1.8*v);   // (troca de lado em ~1,8 s de caminho: no reto, sem frear à toa)
  const consK=cons.slice(),applyC=(L0,ss,dd)=>{for(const C of L0){let e=T.wrap(ss-C.s);if(e>T.L/2)e-=T.L;const w=e<C.e0?smooth(clamp(1-(C.e0-e)/(C.kart?rampK:18),0,1)):e>C.e1?smooth(clamp(1-(e-C.e1)/(C.kart?rampK:6),0,1)):1;if(w<=0)continue;
    const wr=C.kart?C.f0+(1-C.f0)*smooth(clamp((ss-k.s)/rampK,0,1)):1,ww=Math.min(w,wr),B=C.bound(ss);dd=C.side>0?dd+ww*Math.max(0,B-dd):dd-ww*Math.max(0,dd-B);}return dd;};
  for(const o of [...this.obstacles,...(this.dynProj||[])]){let ds=T.wrap(o.s-k.s);if(ds>T.L/2)ds-=T.L;
   const key=o.key??o;if(ds<-c.desvio.depois||ds>c.desvio.olha){k.sides.delete(key);continue;}
   // (onde vou passar de verdade: a faixa com quem está ao lado; perto, onde estou)
   const myDk=applyC(consK,o.s,this.dOff(myO,o.s)),myD=ds<8?(Math.abs(k.d-o.d)<Math.abs(myDk-o.d)?k.d:myDk):myDk;let side=o.pass??k.sides.get(key);   // (parado: lado fixo, o de mais espaço)
   if(side==null){if(Math.abs(myD-o.d)>c.desvio.lado+.25)continue;   // a linha já passa longe
    // quem vai logo à frente já escolheu um lado: vai pelo mesmo (não ficam lado a lado no desvio)
    for(const q of this.karts){if(q===k)continue;let dq=T.wrap(q.s-k.s);if(dq<25&&q.sides?.has(key)){side=q.sides.get(key);break;}}}
   if(side==null){
    const left=o.d-c.desvio.lado,right=o.d+c.desvio.lado,okL=left>=-lim,okR=right<=lim;
    side=okL&&(!okR||Math.abs(myD-left)<=Math.abs(myD-right))?-1:okR?1:(Math.abs(left+lim)<Math.abs(right-lim)?-1:1);k.sides.set(key,side);}
   const b=clamp(o.d+side*c.desvio.lado,-lim,lim);cons.push({s:o.s,side,e0:-8,e1:4.5,bound:()=>b});if(ds>0&&(!obsAhead||ds<obsAhead.ds))obsAhead={ds,o};}
  if(k.err&&(k.caution||cons.some(C=>!C.kart))){k.err=null;em=1;noCut=false;wide=0;k.trava=false;}   // (K3: perto de parado ninguém erra de propósito)
  if(wide&&cons.some(C=>C.kart&&C.side===-Math.sign(wide)))wide=0;   // (kart do lado de fora: não abre por cima dele)
  k.squeezed=null;for(const C of cons)if(C.kart){const B=C.bound(k.s);if(C.side>0?B>lim-.05:B<-lim+.05){k.squeezed=C;break;}}
  const dAt=ss=>{const i=T.idx(ss);return clamp(applyC(cons,ss,this.dOff(myO,ss)),Math.max(-T.hw+.75,T.limL[i]),Math.min(T.hw-.75,T.limR[i]));};
  // perto de obstáculo ou já quase encostando em quem está ao lado: olha mais curto (corrige já)
  const nearObs=cons.some(C=>!C.kart)||cons.some(C=>{if(!C.kart)return false;let e=T.wrap(k.s-C.s);if(e>T.L/2)e-=T.L;if(e<C.e0-1)return false;const B=C.bound(k.s);return C.side>0?k.d<B+.3:k.d>B-.3;});
  k.avoid=cons.length?dAt(k.s)-this.dOff(myO,k.s):0;
  // o caminho dos próximos ~30 m (um ponto a cada 2 m): para a velocidade fora da linha e para saber quem está nele
  const np=Math.ceil(Math.max(18,v*1.8)/2)+2,path=[];for(let i=0;i<=np;i++){const ss=k.s+i*2;path.push(T.point(ss,dAt(ss)));}
  // alvo à frente (perto de obstáculo, olha mais curto)
  const sT=k.s+Ld(nearObs),iT=T.idx(sT),P=T.point(sT,wide?clamp(dAt(sT)+wide,Math.max(-T.hw-3,T.limL[iT]+.4),Math.min(T.hw+3,T.limR[iT]-.4)):dAt(sT));   // (saída larga: o alvo abre para fora)
  const dx=P.x-k.x,dz=P.z-k.z,dist=Math.hypot(dx,dz)||1;
  const lx=Math.cos(k.yaw),lz=-Math.sin(k.yaw),sa=(dx*lx+dz*lz)/dist;   // + = alvo à esquerda (esquerda = (cos yaw, −sen yaw))
  // pure pursuit + correção da guinada (o piloto segura a traseira: contra-esterço quando ela sai)
  const rDes=2*v*sa/dist,slide=Math.abs(k.slipR||0)>.08,errSaida=k.err&&k.err.tipo==='saida'&&k.err.pe>0;let steer=Math.atan(2*c.entreEixos*sa/dist)+(errSaida?0:slide?c.giro*1.8:c.giro)*(rDes-k.r);   // (traseira saindo: corrige mais — errando na saída, não corrige)
  // velocidade: perfil dele na linha em que está e na que vai estar (empurrado por quem está ao lado), com a constância;
  // freando por dentro emparelhado, um pouco mais tarde
  const sL=k.s+Math.max(0,v*.15),sE=k.s+Math.max(6,v*.6),oE=dAt(sE)-this.lineD(sE),late=(1+(k.late||0))*(1+(k.form||0))*em;
  const vHi=Math.min(this.vOff(k,myO,sL,'vb'),this.vOff(k,oE,sL,'vb'))*(1+k.paceVar)*late,vLo=Math.min(this.vOff(k,myO,sL,'v'),this.vOff(k,oE,sL,'v'))*(1+k.paceVar)*late;
  let vSelf=vLo>vHi-.3?vLo:vHi;
  // fora da linha (atacando, defendendo, ao lado de alguém, desviando): a curva do caminho que vai fazer de verdade manda
  if(cons.length||Math.abs(k.off)>.15||Math.abs(k.d-this.lineD(k.s))>.8)vSelf=Math.min(vSelf,this.pathSpeed(k,path,v,late));
  if((k.grip??1)<1)vSelf*=Math.sqrt(k.grip);   // (zebra, areia: menos aderência)
  const accelZone=vHi-vLo>.3;let vref=vSelf,need=0,vFol=99;
  // quem está no caminho (corredor de 2D, com o deslocamento de lado dele até eu chegar): segue, com folga para frear
  const S=c.seguir,bMe=S.freada;
  for(const o of this.karts){if(o===k)continue;const ds=this.rel(k,o),lat=Math.abs(o.d-k.d),half=(o.length+k.length)/2;
   // lado a lado e perto demais: quem está mais atrás alivia (empate: o de número maior)
   if(Math.abs(ds)<half&&lat<c.lado.sep-.15&&(ds>0||ds===0&&k.id>o.id))vref=Math.min(vref,Math.max(0,o.v-1.2));
   if(ds<=-half*.5||ds>S.olha+half)continue;const ex=o.x-k.x,ez=o.z-k.z;if(ex*ex+ez*ez>(S.olha+3)**2)continue;
   const hit=this.inPath(k,o,path,v);if(!hit)continue;
   const gap=hit.lam-half,gStar=S.folga+S.tempo*v;
   const vf=Math.sqrt(Math.max(0,o.v*o.v+2*bMe*(gap-S.minimo))),vt=o.v+S.ganho*(gap-gStar);vFol=Math.min(vFol,vf,vt);vref=Math.min(vref,vf,Math.max(vt,Math.min(vf,o.v-.5)));
   if(v>vf)need=Math.max(need,(v*v-vf*vf)/(2*Math.max(.3,gap-S.minimo)));}   // (freada que precisa já)
  for(const o of [...this.obstacles,...(this.dynProj||[])]){let ds=T.wrap(o.s-k.s);if(ds>T.L/2)ds-=T.L;if(ds<0||ds>S.olha)continue;
   const q={x:o.x,z:o.z,tx:o.fx??0,tz:o.fz??1,v:0,dv:0,width:o.width||1.4,length:o.length||1.85},hit=this.inPath(k,q,path,v);if(!hit)continue;
   const gap=hit.lam-(k.length+q.length)/2,vf=Math.sqrt(Math.max(0,2*bMe*(gap-S.minimo-.5)));vref=Math.min(vref,vf);if(v>vf)need=Math.max(need,(v*v-vf*vf)/(2*Math.max(.3,gap-S.minimo)));}
  if(k.vPlan!=null){vref=Math.min(vref,k.vPlan+.3);vFol=Math.min(vFol,k.vPlan+.3);}   // (o plano dele: seguindo alguém)
  if(k.caution&&k.caution.ds>0&&k.caution.ds<15)for(const o of this.karts){if(o===k)continue;const ds=this.rel(k,o);if(ds>0&&ds<(o.length+k.length)/2+1.5&&Math.abs(o.d-k.d)>1)vref=Math.min(vref,Math.max(4,o.v-1));}   // (em fila antes do parado: quem está ao lado e mais atrás alivia)
  if(k.squeezed){const o=k.squeezed.o;if(o&&o.v>3&&this.rel(k,o)>-(k.length+o.length)/2*.5)vref=Math.min(vref,Math.max(0,o.v-1));}   // (sem espaço ao lado dele: cai para trás)
  // parado há mais de 1,5 s (enrosco): sai devagar, a não ser que tenha alguém colado bem na frente
  k.stuck=v<1?(k.stuck||0)+dt:0;if(k.stuck>1.5){let blocked=false;for(const o of this.karts){if(o===k)continue;const h=this.inPath(k,o,path,v);if(h&&h.lam<k.length/2+o.length/2+.6&&o.v<1&&(o.stuck||0)<k.stuck)blocked=true;}if(!blocked){vref=Math.max(vref,3);need=0;k.ksides.clear();}}
  if(k.stuck>c.rodada.empurraT&&this.time-(k.lastStat||-9)<.3){let side=0,best=4;for(const o of [...this.obstacles,...(this.dynProj||[])]){const dd=Math.hypot(o.x-k.x,o.z-k.z);if(dd<best){best=dd;side=Math.sign(k.d-o.d)||o.pass||1;}}
   if(!side)side=-Math.sign(k.d)||1;k.rec={fase:'gira',t:0,empurra:side};k.stuck=0;this.log('empurrado',k);}   // K3: enroscado (bico no parado ou no muro): o fiscal tira de lado
  if(obsAhead){const nd=Math.abs(dAt(obsAhead.o.s)-k.d);if(nd>.8&&obsAhead.ds<14)vref=Math.min(vref,Math.max(3,obsAhead.ds*.9));}   // perto e ainda longe do lado: devagar
  if(vFol<vSelf-.4)k.held=Math.min(5,k.held+dt);else k.held=Math.max(0,k.held-dt);   // preso atrás de alguém mais lento
  const e=vref-v;let acel=0,freio=0;
  if(accelZone&&vref===vSelf&&vSelf>=vHi-.05&&e>.15)acel=1;   // reta e saída: pé embaixo (no vácuo passa do ritmo de sozinho)
  else if(e>0)acel=clamp(.35+e*.9,0,1);else if(e<-.15)freio=clamp(-e*.55,0,1);
  if(need>0){acel=0;freio=Math.max(freio,clamp(need/(c.freioMax/c.massa),0,1));}
  // pé e mão do piloto: traseira escorregando alivia o acelerador; pneu no limite alivia o freio
  if(Math.abs(k.d)>T.hw-.6&&v>8)acel=Math.min(acel,.3);   // na beira da pista: alivia
  const sr=Math.abs(k.slipR||0),sf=Math.abs(k.slipF||0);if(v>5&&!noCut){if(sr>.07)acel*=clamp(1-(sr-.07)*12,.15,1);if(sr>.08||sf>.11)freio*=.45;}
  if(noCut&&E&&E.tipo==='saida'){acel=1;freio=0;}
  if(k.shock>0)acel*=.2;   // (susto depois de um toque)
  if(k.trava){freio=Math.max(freio,.5);acel=0;}
  k.inp.volante=steer;k.inp.acel=acel;k.inp.freio=freio;
 }
 // o kart o está no meu caminho? (distância do centro dele — agora e com o deslocamento de lado até eu chegar — aos trechos do
 // caminho; lam = quanto do caminho até lá)
 inPath(k,o,path,v){const lim=(k.width+o.width)/2+this.cfg.seguir.corredor,rx=-o.tz,rz=o.tx;let best=null,lam=0;
  for(let i=1;i<path.length;i++){const a=path[i-1],b=path[i],sx=b.x-a.x,sz=b.z-a.z,l2=sx*sx+sz*sz||1,sl=Math.sqrt(l2);
   const tau=clamp(lam/Math.max(.5,v-o.v),0,1.2),sh=(o.dv||0)*tau;
   for(const [px,pz] of [[o.x,o.z],[o.x+rx*sh,o.z+rz*sh]]){const t=clamp(((px-a.x)*sx+(pz-a.z)*sz)/l2,0,1),qx=a.x+sx*t,qz=a.z+sz*t,dd=Math.hypot(px-qx,pz-qz);
    if(dd<lim&&(!best||lam+t*sl<best.lam))best={lam:lam+t*sl,dd};}
   if(best)break;lam+=sl;}
  return best;}
 // velocidade que cabe no caminho que o piloto vai fazer (curvatura de 3 em 3 pontos; dá para frear até lá)
 pathSpeed(k,path,v,late=1){const c=this.cfg,dr=k.dr,mu=c.mu*c.perfil.atrito*dr.atrito*c.g,dec=c.freioMax*c.perfil.freio*dr.freio/c.massa*.85,n=path.length;
  let cap=99;for(let i=2;i<n-2;i++){const a=path[i-2],b=path[i],e=path[i+2],ax=a.x-b.x,az=a.z-b.z,ex=e.x-b.x,ez=e.z-b.z,cr=Math.abs(ax*ez-az*ex),la=Math.hypot(ax,az),le=Math.hypot(ex,ez),lae=Math.hypot(e.x-a.x,e.z-a.z);
   const kk=la&&le&&lae?2*cr/(la*le*lae):0,vl=Math.sqrt(mu/Math.max(kk,1e-4))*late;cap=Math.min(cap,Math.sqrt(vl*vl+2*dec*Math.max(0,i*2-2)));}
  return cap;}
 // vácuo: quanto do arrasto o kart da frente tira (colado e alinhado)
 draftOf(k){const c=this.cfg.vacuo;let f=0;
  for(const o of this.karts){if(o===k)continue;const ds=this.rel(k,o);if(ds<=0||ds>c.dist+3)continue;const lat=Math.abs(o.d-k.d);if(lat>=c.lado)continue;
   const gap=Math.max(0,ds-(o.length+k.length)/2);if(gap>=c.dist)continue;f=Math.max(f,c.max*(1-gap/c.dist)*(1-lat/c.lado));}
  return f;}
 // passo da corrida (física a 120 Hz)
 update(dt){
  this.acc+=Math.min(dt,.1);const h=this.cfg.dt,T=this.track;
  // a moto do jogador (se estiver na pista) como obstáculo
  this.dynProj=[];(this.dyn||[]).forEach((o,i)=>{const q=T.project(o.x,o.z);if(q&&q.dist<T.hw+2)this.dynProj.push({...o,s:q.s,d:q.d,key:'dyn'+i});});
  while(this.acc>=h){this.acc-=h;this.time+=h;
   for(const k of this.karts)k.draft=this.draftOf(k);
   // planejador em rodízio: cada kart replaneja a cada passo do plano (0,1 s), o custo espalhado pelos quadros
   if(!this.planQ||!this.planQ.length){this.planQ=this.standings();this.planQ.forEach((k,i)=>k.prio=i);this.planEvery=Math.max(1,Math.round(this.cfg.plano.passo/h/this.planQ.length));this.planTick=0;}
   if((this.planTick++%this.planEvery)===0){const k=this.planQ.shift();if(!k.player)this.plan(k);}
   for(const k of this.karts)if(!k.player)this.drive(k,h);
   for(const k of this.karts){k.s0=k.s;kartStep(k,k.inp,h,this.cfg);}
   this.contacts(h);   // K2: kart encosta em kart (e nos parados, e na moto): empurra e troca velocidade, não atravessa
   for(const k of this.karts){const s0=k.s0;
    const q=T.project(k.x,k.z,k.hint),d0=k.d;k.hint=q.i;k.dv=(k.dv||0)*.8+.2*(q.d-d0)/h;let ds=q.s-s0;if(ds<-T.L/2)ds+=T.L;if(ds>T.L/2)ds-=T.L;k.s=q.s;k.d=q.d;k.dist+=ds;
    if(ds>0&&s0>T.L-30&&q.s<30){   // cruzou a linha de largada
     if(k.lapStart!=null){const t=this.time-k.lapStart;k.laps.push(t);if(k.best==null||t<k.best)k.best=t;}
     k.lap++;k.lapStart=this.time;}
    // piso (K3): asfalto e zebra pelo traçado; fora deles, o chão do mundo (k.chao, posto pelo jogo) ou a areia do gerador
    const surf=this.surfaceOf(k,q.i),P0=this.cfg.piso[surf],fora=surf==='areia'||surf==='grama';if(fora&&k.surf!=='areia'&&k.surf!=='grama')k.offs=(k.offs||0)+1;
    k.surf=surf;k.grip=fora&&k.chaoGrip!=null?k.chaoGrip:P0.grip;k.gripTras=P0.tras??1;k.roll=P0.roll;if(fora)k.offTrack+=h;
    // relevo: altura, gradiente (no mundo) e a pose do kart
    {const dh=T.rampa(k.s),txx=Math.sin(k.yaw),tzz=Math.cos(k.yaw),tq=T.point(k.s,0,this._p||(this._p={}));k.y=T.altura(k.s);k.gx=dh*tq.tx;k.gz=dh*tq.tz;
     k.arfagem=Math.atan(k.gx*txx+k.gz*tzz);k.rolagem=Math.atan(k.gx*Math.cos(k.yaw)-k.gz*Math.sin(k.yaw));}
    k.v=Math.hypot(k.vx,k.vy);k.tx=Math.sin(k.yaw);k.tz=Math.cos(k.yaw);k.brake=k.inp.freio>.05;}}
  this.trackPasses();
 }
 // contato: cada kart é uma cápsula (segmento de ±seg m no eixo, raio rc); empurra para fora (posição) e troca impulso (velocidade)
 // no ponto de contato, com restituição e atrito; parados e moto não se mexem
 contacts(h){const c=this.cfg.contato,K=this.karts,ks=this.cfg.massa,I=this.cfg.inercia,T=this.track,R=this.cfg.rodada,MW=this.cfg.muro;
  const seg=(o,fx,fz)=>[o.x-fx*c.seg,o.z-fz*c.seg,o.x+fx*c.seg,o.z+fz*c.seg];
  const caps=k=>seg(k,Math.sin(k.yaw),Math.cos(k.yaw));
  const stat=[...this.obstacles,...(this.dynProj||[])].map(o=>({x:o.x,z:o.z,sg:seg(o,o.fx??o.tx??0,o.fz??o.tz??1),r:(o.width||c.raio*2)/2,tipo:'parado'}));
  // um contato: a (kart) com b (kart, ou null = parado/muro: não se mexe); sb = segmento de b, rb = raio
  const solve=(a,b,sb,rb,tipo)=>{const sa=caps(a),[pax,paz,pbx,pbz]=closestSeg(sa,sb),nx0=pbx-pax,nz0=pbz-paz,dist=Math.hypot(nx0,nz0),pen=c.raio+rb-dist;if(pen<=0||dist<1e-6)return;
   const nx=nx0/dist,nz=nz0/dist,dyn=!!b,wa=dyn?.5:1;
   a.x-=nx*pen*wa;a.z-=nz*pen*wa;if(dyn){b.x+=nx*pen*.5;b.z+=nz*pen*.5;}
   // impulso no ponto de contato (meio do caminho entre as cápsulas)
   const cx=(pax+pbx)/2,cz=(paz+pbz)/2,vel=k=>{const f=[Math.sin(k.yaw),Math.cos(k.yaw)],l=[Math.cos(k.yaw),-Math.sin(k.yaw)],px=cx-k.x,pz=cz-k.z;return [f[0]*k.vx+l[0]*k.vy+k.r*pz,f[1]*k.vx+l[1]*k.vy-k.r*px,px,pz];};
   const [vax,vaz,rax,raz]=vel(a),[vbx,vbz,rbx,rbz]=dyn?vel(b):[0,0,0,0],rvx=vbx-vax,rvz=vbz-vaz,vn=rvx*nx+rvz*nz;
   a.touch=Math.max(a.touch||0,-vn);if(dyn)b.touch=Math.max(b.touch||0,-vn);a.lastTouch=this.time;if(dyn)b.lastTouch=this.time;else a.lastStat=this.time;
   if(vn>=0)return;
   if(-vn>R.susto){a.shock=R.sustoT;if(dyn)b.shock=R.sustoT;}   // (susto: tira o pé)
   if(tipo==='muro'&&-vn>1&&this.time-(a.lastWall||-9)>1){a.walls=(a.walls||0)+1;a.lastWall=this.time;}
   const e=tipo==='muro'?MW.restituicao:c.restituicao,mu=tipo==='muro'?MW.atrito:c.atrito;
   const cra=nx*raz-nz*rax,crb=nx*rbz-nz*rbx,den=1/ks+cra*cra/I+(dyn?1/ks+crb*crb/I:0),jn=-(1+e)*vn/den;
   // atrito na tangente (limitado pelo impulso normal)
   const tx=-nz,tz=nx,vt=rvx*tx+rvz*tz,cta=tx*raz-tz*rax,ctb=tx*rbz-tz*rbx,dent=1/ks+cta*cta/I+(dyn?1/ks+ctb*ctb/I:0),jt=clamp(-vt/dent,-mu*jn,mu*jn);
   const Jx=nx*jn+tx*jt,Jz=nz*jn+tz*jt;
   const apply=(k,sg,px,pz)=>{const f=[Math.sin(k.yaw),Math.cos(k.yaw)],l=[Math.cos(k.yaw),-Math.sin(k.yaw)],dvx=sg*Jx/ks,dvz=sg*Jz/ks;
    k.vx+=dvx*f[0]+dvz*f[1];k.vy+=dvx*l[0]+dvz*l[1];k.r+=sg*(Jx*pz-Jz*px)/I;if(k.vx<0)k.vx=0;};
   apply(a,-1,rax,raz);if(dyn)apply(b,1,rbx,rbz);a.hits=(a.hits||0)+1;if(dyn)b.hits=(b.hits||0)+1;};
  for(let it=0;it<2;it++)
   for(let i=0;i<K.length;i++){const a=K[i];
    for(let j=i+1;j<K.length;j++){const b=K[j],dx=b.x-a.x,dz=b.z-a.z;if(dx*dx+dz*dz<9)solve(a,b,caps(b),c.raio,'kart');}
    for(const o of stat){const dx=o.x-a.x,dz=o.z-a.z;if(dx*dx+dz*dz<9)solve(a,null,o.sg,o.r,'parado');}
    for(const w of T.wallAt[a.hint??T.idx(a.s)])solve(a,null,[w.ax,w.az,w.bx,w.bz],w.r,'muro');}
 }

 // ultrapassagens: dois karts perto trocam de ordem e ficam assim 3 s (sem contar quem leva volta)
 trackPasses(){const K=this.karts,L=this.track.L;this.pairs=this.pairs||new Map();this.passLog=this.passLog||[];
  for(let i=0;i<K.length;i++)for(let j=i+1;j<K.length;j++){const a=K[i],b=K[j],key=a.id*1000+b.id,sg=Math.sign(a.dist-b.dist)||1,P=this.pairs.get(key);
   if(!P){this.pairs.set(key,{sg,pend:null});continue;}
   if(sg===P.sg){P.pend=null;continue;}
   if(!P.pend)P.pend={t:this.time,near:Math.abs(this.rel(a,b))<30&&this.time>5,s:a.s};   // (nos primeiros 5 s, lado a lado na largada: não conta)
   if(this.time-P.pend.t>3){if(P.pend.near&&Math.abs(a.dist-b.dist)<L/2){const w=sg>0?a:b,l=sg>0?b:a;w.passes++;l.lost=(l.lost||0)+1;this.passLog.push({t:+P.pend.t.toFixed(1),quem:w.id,deQuem:l.id,s:+P.pend.s.toFixed(0)});if(this.passLog.length>200)this.passLog.shift();}P.sg=sg;P.pend=null;}}}
 standings(){return [...this.karts].sort((a,b)=>b.dist-a.dist);}
 // piso de um kart: asfalto/zebra pelo traçado; fora disso o chão do mundo (Areia → areia, Asfalto/Concreto → asfalto, o
 // resto — Grama, Terra, Brita… — como grama, com a aderência do mundo), ou a areia do gerador quando não há mundo
 surfaceOf(k,i){const b=this.track.surface(k.s,k.d,i);if(b!=='areia'||!k.chao)return b;const n=k.chao;
  return n==='Areia'?'areia':n==='Asfalto'||n==='Concreto'?'asfalto':'grama';}
 snapshot(){const ev=this.events||[],n=t=>ev.filter(e=>e.tipo===t).length;return {tempo:+this.time.toFixed(1),linha:{comprimento:+this.line.len.toFixed(1)},ultrapassagens:(this.passLog||[]).length,ultimas:(this.passLog||[]).slice(-5),
  erros:n('erro'),rodadas:n('rodou'),empurroes:n('empurrado'),eventos:ev.slice(-6),
  karts:this.standings().map((k,i)=>({pos:i+1,numero:k.dr.numero,nivel:+k.dr.nivel.toFixed(3),volta:k.lap,ultima:k.laps.length?+k.laps[k.laps.length-1].toFixed(2):null,melhor:k.best!=null?+k.best.toFixed(2):null,kmh:+(k.v*3.6).toFixed(0),foraDaPista:+k.offTrack.toFixed(1),ultrapassagens:k.passes,vacuo:+k.draft.toFixed(2),piso:k.surf||'asfalto',erros:k.errs||0,rodadas:k.spins||0,saidas:k.offs||0,muros:k.walls||0,...(k.err?{errando:k.err.tipo}:{}),...(k.rec?{rodado:k.rec.empurra?'fiscal':k.rec.fase}:{})}))};}
}
// pontos mais próximos entre dois segmentos [ax,az,bx,bz] (para o contato das cápsulas)
function closestSeg(A,B){const [p1x,p1z,q1x,q1z]=A,[p2x,p2z,q2x,q2z]=B,d1x=q1x-p1x,d1z=q1z-p1z,d2x=q2x-p2x,d2z=q2z-p2z,rx=p1x-p2x,rz=p1z-p2z;
 const a=d1x*d1x+d1z*d1z,e=d2x*d2x+d2z*d2z,f=d2x*rx+d2z*rz;let s=0,t=0;
 if(a<=1e-9&&e<=1e-9){s=t=0;}else if(a<=1e-9){s=0;t=clamp(f/e,0,1);}else{const cc=d1x*rx+d1z*rz;if(e<=1e-9){t=0;s=clamp(-cc/a,0,1);}else{const b=d1x*d2x+d1z*d2z,den=a*e-b*b;s=den!==0?clamp((b*f-cc*e)/den,0,1):0;t=(b*s+f)/e;if(t<0){t=0;s=clamp(-cc/a,0,1);}else if(t>1){t=1;s=clamp((b-cc)/a,0,1);}}}
 return [p1x+d1x*s,p1z+d1z*s,p2x+d2x*t,p2z+d2z*t];}
