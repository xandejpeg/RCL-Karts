# Passo 2: espalha 4 milhões de pontos na superfície (pelo tamanho de cada triângulo) com a cor da textura.
# Serve para medir (rodas, volante, banco, pedais) e achar o para-choque e as faces dos pontões. Uso: python amostra.py
import numpy as np
from PIL import Image
d=np.load('kart_raw.npz'); P=d['P'].astype(np.float64);UV=d['UV'];I=d['I']
tex=np.asarray(Image.open('tex0.png'))
a=P[I[:,0]];b=P[I[:,1]];c=P[I[:,2]]
area=0.5*np.linalg.norm(np.cross(b-a,c-a),axis=1)
print('área total',area.sum(),'tri área p50/p99/max',np.percentile(area,[50,99]),area.max())
rng=np.random.default_rng(1); N=4_000_000
f=rng.choice(len(I),N,p=area/area.sum())
r1=np.sqrt(rng.random(N));r2=rng.random(N)
w0=1-r1;w1=r1*(1-r2);w2=r1*r2
pts=a[f]*w0[:,None]+b[f]*w1[:,None]+c[f]*w2[:,None]
uv=UV[I[f,0]]*w0[:,None]+UV[I[f,1]]*w1[:,None]+UV[I[f,2]]*w2[:,None]
u=(uv[:,0]*2047).round().astype(int).clip(0,2047); v=(uv[:,1]*2047).round().astype(int).clip(0,2047)
np.savez('amostra.npz',p=pts.astype(np.float32),c=tex[v,u],f=f)
