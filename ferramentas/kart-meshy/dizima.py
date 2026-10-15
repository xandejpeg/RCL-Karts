# Passo 3: dizima o kart inteiro de uma vez (colapso de arestas com textura, pymeshlab), antes de separar as partes,
# para as partes continuarem coladas sem fresta. Uso: python dizima.py 45000  → diz45000.obj
import numpy as np, pymeshlab, time, sys
alvo=int(sys.argv[1]) if len(sys.argv)>1 else 60000
d=np.load('kart_raw.npz'); P=d['P'].astype(np.float64);UV=d['UV'].astype(np.float64);I=d['I'].astype(np.int64)
q=np.round(P/1e-5).astype(np.int64)
uq,first,inv=np.unique(q,axis=0,return_index=True,return_inverse=True); inv=inv.ravel()
V=P[first]; F=inv[I]
# remove faces degeneradas
ok=(F[:,0]!=F[:,1])&(F[:,1]!=F[:,2])&(F[:,0]!=F[:,2]); F=F[ok]; Iw=I[ok]
import os
t=time.time()
if not os.path.exists('fundido.obj'):
 with open('fundido.obj','w') as f:
     f.write('mtllib fundido.mtl\nusemtl m\n')
     np.savetxt(f,V,fmt='v %.6f %.6f %.6f')
     np.savetxt(f,UV,fmt='vt %.6f %.6f')
     a=np.c_[F[:,0]+1,Iw[:,0]+1,F[:,1]+1,Iw[:,1]+1,F[:,2]+1,Iw[:,2]+1]
     np.savetxt(f,a,fmt='f %d/%d %d/%d %d/%d')
open('fundido.mtl','w').write('newmtl m\nmap_Kd tex0.png\n')
print('obj',time.time()-t)
ms=pymeshlab.MeshSet(); t=time.time(); ms.load_new_mesh('fundido.obj'); print('carregou',time.time()-t, ms.current_mesh().face_number())
t=time.time()
ms.meshing_decimation_quadric_edge_collapse_with_texture(targetfacenum=alvo, qualitythr=0.4, extratcoordw=1.0, preserveboundary=True, boundaryweight=1.5, optimalplacement=True, preservenormal=True, planarquadric=True)
print('dizimou',time.time()-t, ms.current_mesh().face_number())
ms.save_current_mesh(f'diz{alvo}.obj', save_wedge_texcoord=True, save_vertex_normal=False)
