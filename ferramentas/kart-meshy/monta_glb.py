# Monta o GLB do contrato (mensagem 007) a partir do kart do Meshy dizimado e separado em partes.
# Quadro do RCL: metros, +X frente, +Y cima, +Z direita, origem no chão no meio dos eixos.
import numpy as np, io, sys, json
from PIL import Image
from glbw import Glb, normais
D=np.load('rotulos.npz',allow_pickle=True); lab=D['lab'];P=D['P'];UV=D['UV'];I=D['I'];orig=D['orig']
saida=sys.argv[1]; debug='--debug' in sys.argv
MX=0.0528; GY=-0.3147    # meio dos eixos (x bruto) e chão (y bruto)
def rcl(p): p=np.atleast_2d(p); return np.c_[-(p[:,0]-MX), p[:,1]-GY, -p[:,2]]
def rcl_dir(n): n=np.atleast_2d(n); return np.c_[-n[:,0], n[:,1], -n[:,2]]
N=normais(P,I,orig)
Pr=rcl(P); Nr=rcl_dir(N)
g=Glb(quant=True)
def jpg(img,q=86,tam=2048):
    b=io.BytesIO(); img.convert('RGB').resize((tam,tam),Image.LANCZOS).save(b,'JPEG',quality=q,optimize=True); return b.getvalue()
t0=Image.open('tex0.png'); t1=Image.open('tex1.png'); t2=Image.open('tex2.png')
if debug:
    CORES={'chassi':[.25,.25,.27,1],'carenagem':[.9,.9,.9,1],'banco':[.1,.1,.6,1],'motor':[.9,.6,.1,1],'volante':[.1,.8,.2,1],
           'roda_dianteira_E':[.8,.1,.8,1],'roda_dianteira_D':[.1,.8,.8,1],'roda_traseira_E':[.8,.8,.1,1],'roda_traseira_D':[.8,.2,.2,1]}
    mats={k:g.material('kart_pintura' if k=='carenagem' else k,cor=v,metal=0,rugo=.7,dupla=True) for k,v in CORES.items()}
else:
    tb=g.imagem(jpg(t0,80,2048),'image/jpeg'); tmr=g.imagem(jpg(t1,85,512),'image/jpeg'); tn=g.imagem(jpg(t2,80,1024),'image/jpeg')
    # pintura: o canal vermelho vira cinza (luz e sombra da tinta), e a cor do piloto multiplica
    # pintura: o canal vermelho vira cinza (luz e sombra da tinta) e a cor do piloto multiplica. O Meshy pintou um
    # xadrez fino na carenagem: borra só dentro do vermelho (borrão normalizado pela máscara, sem puxar o preto vizinho).
    A=np.asarray(t0.convert('RGB')).astype(np.float32)/255; R=A[:,:,0]
    mask=((A[:,:,0]>0.3)&(A[:,:,0]>1.8*A[:,:,1])&(A[:,:,0]>1.8*A[:,:,2])).astype(np.float32)
    from PIL import ImageFilter
    bl=lambda a: np.asarray(Image.fromarray((a*255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(7))).astype(np.float32)/255
    num=bl(R*mask); den=bl(mask)
    Rp=np.where(mask>0, num/np.maximum(den,1e-3), R).clip(0,1)
    G8=(Rp*255).astype(np.uint8)
    tp=g.imagem(jpg(Image.fromarray(np.dstack([G8,G8,G8])),85,512),'image/jpeg')
    base=g.material('kart',base=tb,mr=tmr,normal=tn,dupla=True)
    pint=g.material('kart_pintura',base=tp,cor=[0.75,0.01,0.01,1],metal=0.0,rugo=0.32,dupla=True)   # sem normal map: plástico liso
    mats={k:(pint if k=='carenagem' else base) for k in ['chassi','carenagem','banco','motor','volante','roda_dianteira_E','roda_dianteira_D','roda_traseira_E','roda_traseira_D']}
def parte(nome,piv=None,escala=1.0):
    m=lab==nome; f=I[m]; u,inv=np.unique(f,return_inverse=True); ff=inv.reshape(-1,3)
    p=Pr[u].copy()
    if piv is not None: p=(p-piv)*escala
    return g.malha(nome,p,Nr[u],UV[u],ff,mats[nome])
filhos=[]
for nome in ['chassi','carenagem','banco','motor']:
    filhos.append(g.no({'name':nome,'mesh':parte(nome)}))
# rodas (pivô no centro do pneu)
CY=-0.162; RF=0.152; RT=0.150
centros={'roda_dianteira_E':(-0.5693,0.455),'roda_dianteira_D':(-0.5693,-0.455),'roda_traseira_E':(0.6748,0.44),'roda_traseira_D':(0.6748,-0.44)}
cen={k:rcl([cx,CY,cz])[0] for k,(cx,cz) in centros.items()}
for lado in 'ED':
    nome=f'roda_dianteira_{lado}'; c=cen[nome]
    r=g.no({'name':nome,'mesh':parte(nome,c)})
    filhos.append(g.no({'name':f'esterco_{lado}','translation':c.tolist(),'children':[r]}))
for lado in 'ED':
    nome=f'roda_traseira_{lado}'; c=cen[nome]
    filhos.append(g.no({'name':nome,'translation':c.tolist(),'mesh':parte(nome,c)}))
# volante: pivô no centro do aro
VC=rcl([-0.150,0.197,0.0])[0]; VN=rcl_dir(np.array([0.711,0.703,0.0])/np.hypot(0.711,0.703))[0]
filhos.append(g.no({'name':'volante','translation':VC.tolist(),'mesh':parte('volante',VC)}))
# números: planos no XY do nó, virados para +Z, uv 0–1
def quat_de_base(X,Y,Z):
    M=np.c_[X,Y,Z]; t=np.trace(M)
    if t>0: s=np.sqrt(t+1)*2; return [ (M[2,1]-M[1,2])/s,(M[0,2]-M[2,0])/s,(M[1,0]-M[0,1])/s,0.25*s ]
    i=np.argmax(np.diag(M)); j,k=(i+1)%3,(i+2)%3; s=np.sqrt(1+M[i,i]-M[j,j]-M[k,k])*2
    q=[0,0,0,0]; q[i]=0.25*s; q[j]=(M[j,i]+M[i,j])/s; q[k]=(M[k,i]+M[i,k])/s; q[3]=(M[k,j]-M[j,k])/s; return q
def plano(lx,ly):
    p=np.array([[-lx/2,-ly/2,0],[lx/2,-ly/2,0],[lx/2,ly/2,0],[-lx/2,ly/2,0]]); n=np.tile([0,0,1.0],(4,1)); uv=np.array([[0,0],[1,0],[1,1],[0,1]],float)   # v para cima: o KartGlbView usa CanvasTexture com flipY
    return p,n,uv,np.array([[0,1,2],[0,2,3]])
matn=g.material('numero',cor=[1,1,1,1],metal=0,rugo=0.6)
amo=np.load('amostra.npz'); AP=amo['p'].astype(np.float64); AC=amo['c'].astype(np.float32)/255
verm=(AC[:,0]>0.3)&(AC[:,0]>1.8*AC[:,1])&(AC[:,0]>1.8*AC[:,2])
# frente: no alto do bico, virada para cima e para a frente
pb=np.array([-0.65,0.013,0.0]); nb=np.array([-0.39,0.92,0.0]); nb/=np.linalg.norm(nb)
Z=rcl_dir(nb)[0]; X=np.array([0,0,-1.0]); Y=np.cross(Z,X); Y/=np.linalg.norm(Y); X=np.cross(Y,Z)
pf=rcl(pb+nb*0.004)[0]
p,n,uv,ii=plano(0.15,0.094)
filhos.append(g.no({'name':'numero_frente','translation':pf.tolist(),'rotation':quat_de_base(X,Y,Z),'mesh':g.malha('numero_frente',p,n,uv,ii,matn)}))
# laterais: na face de fora dos pontões
for nome,s in [('numero_E',1),('numero_D',-1)]:
    m=verm&(AP[:,0]>-0.03)&(AP[:,0]<0.11)&(AP[:,1]>-0.15)&(AP[:,1]<-0.085)&(np.sign(AP[:,2])==s)
    zf=np.abs(AP[m,2]).max()+0.004
    c=rcl([0.04,-0.1175,s*zf])[0]
    rot=[0,0,0,1] if nome=='numero_D' else [0,1,0,0]
    p,n,uv,ii=plano(0.12,0.075)
    filhos.append(g.no({'name':nome,'translation':c.tolist(),'rotation':rot,'mesh':g.malha(nome,p,n,uv,ii,matn)}))
# pontos do kart (quadro do RCL)
pontos={'banco':np.round(rcl([0.09,-0.148,0.0])[0],4).tolist(),
        'volante':{'centro':np.round(VC,4).tolist(),'direcao':np.round(VN,4).tolist(),'raio':0.139},
        'pedais':{'acelerador':np.round(rcl([-0.58,-0.12,-0.09])[0],4).tolist(),'freio':np.round(rcl([-0.58,-0.12,0.09])[0],4).tolist()},
        'raioRodas':{'frente':RF,'tras':RT}}
raiz=g.no({'name':'kart','children':filhos,'extras':{'kartPontos':pontos,'origem':'Meshy (Xande, 15/10/2026), convertido no chat RCL-Karts'}})
tam=g.salva(saida,[raiz])
print('bytes',tam,'tris',len(I)); print(json.dumps(pontos))
for k,c in cen.items(): print(k,np.round(c,4))
