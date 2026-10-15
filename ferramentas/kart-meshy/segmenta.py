# Separa o kart dizimado em partes do contrato (quadro bruto do Meshy: frente em -x, motor em -z = direita).
import numpy as np, sys
from PIL import Image
from glbw import le_obj, desdobra
arq=sys.argv[1]
V,VT,F=le_obj(arq); P,UV,I,orig=desdobra(V,VT,F)
tex=np.asarray(Image.open('tex0.png')).astype(np.float32)/255
def cor(uv):
    u=(uv[:,0]*2047).round().astype(int).clip(0,2047); v=(uv[:,1]*2047).round().astype(int).clip(0,2047); return tex[v,u]
# cor da face: média de centro e 3 pontos a meio caminho
cF=(cor(UV[I].mean(1))*2+sum(cor((UV[I[:,k]]+UV[I].mean(1))/2) for k in range(3)))/5
Cn=P[I].mean(1); x,y,z=Cn.T
r,g,b=cF.T; lum=cF.mean(1)
vermelho=(r>0.30)&(r>1.8*g)&(r>1.8*b)
escuro=(lum<0.22)
lab=np.full(len(I),'chassi',dtype=object)
# para-choque: o anel mais de fora em cada ângulo (visto de cima), na altura do para-choque
amo=np.load('amostra.npz'); AP=amo['p'].astype(np.float64)
KC=np.array([0.06,0.0]); NB=1440
def ang_r(px,pz): a=np.arctan2(pz-KC[1],px-KC[0]); return ((a+np.pi)/(2*np.pi)*NB).astype(int)%NB, np.hypot(px-KC[0],pz-KC[1])
mb=(AP[:,1]>-0.27)&(AP[:,1]<-0.09); ab,rb=ang_r(AP[mb,0],AP[mb,2])
rmax=np.zeros(NB); np.maximum.at(rmax,ab,rb)
fa,fr=ang_r(x,z); parachoque=(y>-0.27)&(y<-0.09)&(fr>rmax[fa]-0.035)

# rodas: cilindros em z
RODAS={'roda_dianteira_E':(-0.5693,0.455,(0.37,0.55)),'roda_dianteira_D':(-0.5693,-0.455,(0.37,0.55)),
       'roda_traseira_E':(0.6748,0.44,(0.32,0.55)),'roda_traseira_D':(0.6748,-0.44,(0.32,0.55))}
CY=-0.162; R=0.152
for nome,(cx,cz,(z0,z1)) in RODAS.items():
    m=(np.hypot(x-cx,y-CY)<R+0.012)&(np.abs(z)>z0)&(np.abs(z)<z1)&(np.sign(z)==np.sign(cz))
    lab[m&~parachoque]=nome
# volante
vc=np.array([-0.150,0.197,0.0]); vn=np.array([0.711,0.703,0.0]); vn/=np.linalg.norm(vn)
dd=Cn-vc; h=dd@vn; rr=np.linalg.norm(dd-np.outer(h,vn),axis=1)
lab[(h>-0.05)&(h<0.035)&(rr<0.17)]='volante'
# banco: escuro na concha do assento
m=(lab=='chassi')&~parachoque&escuro&(x>-0.14)&(x<0.37)&(np.abs(z)<0.235)&(y>-0.17)&(y<0.21)
lab[m]='banco'
# motor: caixa atrás do banco, lado direito (z<0) e centro
m=(lab=='chassi')&~parachoque&~((np.abs(z)>0.265)&(np.abs(z)<0.53)&(x<0.48)&(y<0.0)&vermelho)&(x>0.30)&(x<0.96)&(y>-0.135)&(z>-0.40)&(z<0.16)&~((x<0.37)&escuro)
lab[m]='motor'
# carenagem: vermelho liso do bico, painel da frente e laterais (pontões)
bico=(x<-0.27)&(np.abs(z)<0.27)&((y>-0.135)|((x<-0.55)&(y>-0.212)))
pontao=(np.abs(z)>0.265)&(np.abs(z)<0.53)&(x>-0.42)&(x<0.48)&(y>-0.178)&(y<0.0)
m=(lab=='chassi')&~parachoque&vermelho&(bico|pontao)
lab[m]='carenagem'
# suaviza a carenagem pela vizinhança (3 passadas de voto)
from scipy.sparse import coo_matrix
nf=len(I); ek=np.r_[I[:,[0,1]],I[:,[1,2]],I[:,[2,0]]]; ek=np.sort(orig[ek],axis=1)
fid=np.r_[np.arange(nf),np.arange(nf),np.arange(nf)]
key=ek[:,0]*(orig.max()+1)+ek[:,1]; o=np.argsort(key); ks=key[o]; fs=fid[o]
same=ks[1:]==ks[:-1]; a=fs[:-1][same]; bb=fs[1:][same]
A=coo_matrix((np.ones(len(a)*2),(np.r_[a,bb],np.r_[bb,a])),shape=(nf,nf)).tocsr()
regiao=(bico|pontao)&np.isin(lab,['chassi','carenagem'])
for it in range(3):
    c=(lab=='carenagem').astype(float); viz=A@c; tot=A@np.ones(nf)
    lab[regiao&(viz>tot*0.6)]='carenagem'
    lab[regiao&(lab=='carenagem')&(viz<tot*0.25)]='chassi'
for k in np.unique(lab): print(k,(lab==k).sum())
np.savez('rotulos.npz',lab=lab.astype(str),P=P,UV=UV,I=I,orig=orig)
