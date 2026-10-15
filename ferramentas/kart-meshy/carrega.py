# Passo 1: lê o GLB do Meshy (uma malha só, ~2,6 milhões de triângulos) e separa posições, uvs, normais, índices
# e as 3 texturas (cor, metal/rugosidade, normal). Uso: python carrega.py <kart-do-meshy.glb>
import sys
import json,struct,numpy as np,io
from PIL import Image
f=open(sys.argv[1],'rb').read()
L=struct.unpack('<I',f[12:16])[0]; j=json.loads(f[20:20+L]); off=20+L; BL=struct.unpack('<I',f[off:off+4])[0]; b=f[off+8:off+8+BL]
def acc(i):
    a=j['accessors'][i]; bv=j['bufferViews'][a['bufferView']]; o=bv.get('byteOffset',0)+a.get('byteOffset',0)
    n={'SCALAR':1,'VEC2':2,'VEC3':3}[a['type']]; dt={5126:np.float32,5125:np.uint32}[a['componentType']]
    return np.frombuffer(b,dtype=dt,count=a['count']*n,offset=o).reshape(-1,n) if n>1 else np.frombuffer(b,dtype=dt,count=a['count'],offset=o)
P=acc(0);UV=acc(1);N=acc(2);I=acc(3).reshape(-1,3)
for k,im in enumerate(j['images']):
    bv=j['bufferViews'][im['bufferView']]; d=b[bv.get('byteOffset',0):bv.get('byteOffset',0)+bv['byteLength']]
    img=Image.open(io.BytesIO(d)); print(k,img.size,img.mode); img.save(f'tex{k}.png')
print(j['textures'], j['materials'][0])
np.savez('kart_raw.npz',P=P,UV=UV,N=N,I=I)
