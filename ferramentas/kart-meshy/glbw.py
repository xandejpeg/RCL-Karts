# Escritor de GLB mínimo (glTF 2.0): nós, malhas (posição, normal, uv, índices), materiais PBR e texturas embutidas.
import json, struct, numpy as np
class Glb:
    def __init__(s, gerador='RCL-Karts kart-meshy', quant=False):
        s.quant=quant
        s.g={'asset':{'version':'2.0','generator':gerador},'scene':0,'scenes':[{'nodes':[]}],'nodes':[],'meshes':[],'materials':[],
             'textures':[],'images':[],'samplers':[{'magFilter':9729,'minFilter':9987,'wrapS':33071,'wrapT':33071}],'accessors':[],'bufferViews':[],'buffers':[{'byteLength':0}]}
        s.bin=bytearray()
    def _view(s,data,alvo=None):
        while len(s.bin)%4: s.bin+=b'\0'
        o=len(s.bin); s.bin+=data
        v={'buffer':0,'byteOffset':o,'byteLength':len(data)}
        if alvo: v['target']=alvo
        s.g['bufferViews'].append(v); return len(s.g['bufferViews'])-1
    def _acc(s,arr,tipo,alvo,minmax=False):
        arr=np.ascontiguousarray(arr)
        comp={np.dtype('float32'):5126,np.dtype('uint32'):5125,np.dtype('uint16'):5123,np.dtype('int8'):5120}[arr.dtype]
        dados=arr.tobytes(); est=None
        if arr.dtype==np.int8 and tipo=='VEC3':   # cada vértice alinhado em 4 bytes
            q=np.zeros((arr.shape[0],4),np.int8); q[:,:3]=arr; dados=q.tobytes(); est=4
        v=s._view(dados,alvo)
        if est: s.g['bufferViews'][v]['byteStride']=est
        a={'bufferView':v,'componentType':comp,'count':int(arr.shape[0]),'type':tipo}
        if arr.dtype in (np.dtype('int8'),) or (arr.dtype==np.dtype('uint16') and tipo!='SCALAR'): a['normalized']=True
        if minmax: a['min']=arr.min(0).tolist(); a['max']=arr.max(0).tolist()
        s.g['accessors'].append(a); return len(s.g['accessors'])-1
    def imagem(s,dados,mime):
        s.g['images'].append({'bufferView':s._view(dados),'mimeType':mime}); s.g['textures'].append({'sampler':0,'source':len(s.g['images'])-1})
        return len(s.g['textures'])-1
    def material(s,nome,**k):
        m={'name':nome,'pbrMetallicRoughness':{'baseColorFactor':k.get('cor',[1,1,1,1]),'metallicFactor':k.get('metal',1.0),'roughnessFactor':k.get('rugo',1.0)}}
        if 'base' in k: m['pbrMetallicRoughness']['baseColorTexture']={'index':k['base']}
        if 'mr' in k: m['pbrMetallicRoughness']['metallicRoughnessTexture']={'index':k['mr']}
        if 'normal' in k: m['normalTexture']={'index':k['normal'],'scale':k.get('nscale',1.0)}
        if k.get('dupla'): m['doubleSided']=True
        s.g['materials'].append(m); return len(s.g['materials'])-1
    def malha(s,nome,P,N,UV,I,mat):
        n=len(P); idx=I.astype(np.uint16 if n<65536 else np.uint32).ravel()
        if s.quant:   # KHR_mesh_quantization: normal em int8 e uv em uint16, normalizados
            Nq=np.round(np.clip(N,-1,1)*127).astype(np.int8); nacc=s._acc(Nq,'VEC3',34962)
        else: nacc=s._acc(N.astype(np.float32),'VEC3',34962)
        pr={'attributes':{'POSITION':s._acc(P.astype(np.float32),'VEC3',34962,True),'NORMAL':nacc},'indices':s._acc(idx,'SCALAR',34963),'material':mat}
        if UV is not None:
            pr['attributes']['TEXCOORD_0']=s._acc(np.round(np.clip(UV,0,1)*65535).astype(np.uint16),'VEC2',34962) if s.quant else s._acc(UV.astype(np.float32),'VEC2',34962)
        s.g['meshes'].append({'name':nome,'primitives':[pr]}); return len(s.g['meshes'])-1
    def no(s,d):
        s.g['nodes'].append(d); return len(s.g['nodes'])-1
    def salva(s,arq,raizes):
        s.g['scenes'][0]['nodes']=raizes
        if s.quant: s.g['extensionsUsed']=['KHR_mesh_quantization']; s.g['extensionsRequired']=['KHR_mesh_quantization']
        for k in ['textures','images']:
            if not s.g[k]: del s.g[k]
        if 'textures' not in s.g: s.g.pop('samplers',None)
        while len(s.bin)%4: s.bin+=b'\0'
        s.g['buffers'][0]['byteLength']=len(s.bin)
        j=json.dumps(s.g,separators=(',',':')).encode()
        j+=b' '*((4-len(j)%4)%4)
        tot=12+8+len(j)+8+len(s.bin)
        with open(arq,'wb') as f:
            f.write(struct.pack('<III',0x46546C67,2,tot)); f.write(struct.pack('<II',len(j),0x4E4F534A)); f.write(j)
            f.write(struct.pack('<II',len(s.bin),0x004E4942)); f.write(s.bin)
        return tot
def le_obj(arq):
    V=[];VT=[];F=[]
    for l in open(arq):
        if l.startswith('v '): V.append(l.split()[1:4])
        elif l.startswith('vt '): VT.append(l.split()[1:3])
        elif l.startswith('f '):
            F.append([tuple(int(x) for x in t.split('/')[:2]) for t in l.split()[1:4]])
    V=np.array(V,float);VT=np.array(VT,float);F=np.array(F)-1
    return V,VT,F  # F: (n,3,2) [v,vt]
def desdobra(V,VT,F):
    # um vértice por par (v,vt): costuras de UV viram vértices duplicados
    par=F.reshape(-1,2); u,inv=np.unique(par,axis=0,return_inverse=True)
    return V[u[:,0]],VT[u[:,1]],inv.reshape(-1,3),u[:,0]
def normais(P,I,orig=None,angulo=60):
    # normais suaves por vértice-posição (soma ponderada por área), separando por ângulo das faces
    a=P[I[:,0]];b=P[I[:,1]];c=P[I[:,2]]; fn=np.cross(b-a,c-a)
    key=orig if orig is not None else np.arange(len(P))
    acc=np.zeros((key.max()+1,3)); 
    for k in range(3): np.add.at(acc,key[I[:,k]],fn)
    n=acc[key]; n/=np.linalg.norm(n,axis=1,keepdims=True)+1e-12
    return n
