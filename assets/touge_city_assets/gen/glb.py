import numpy as np, json, struct, math
class M:
    def __init__(s): s.prims={}; s.mats={}
    def mat(s,name,color=(.8,.8,.8,1),tex=None,emis=None,metal=0.0,rough=.9,double=False): s.mats[name]=dict(color=color,tex=tex,emis=emis,metal=metal,rough=rough,double=double)
    def _add(s,mat,P,N,U,I):
        g=s.prims.setdefault(mat,[[],[],[],[]]); o=sum(len(x) for x in g[0]); g[0].append(P);g[1].append(N);g[2].append(U);g[3].append(np.array(I)+o)
    def quad(s,mat,a,b,c,d,uv=((0,0),(1,0),(1,1),(0,1))):
        a,b,c,d=[np.array(v,float) for v in (a,b,c,d)]; n=np.cross(b-a,c-a); n/= (np.linalg.norm(n) or 1)
        s._add(mat,np.array([a,b,c,d]),np.array([n]*4),np.array(uv,float),[[0,1,2],[0,2,3]])
    def box(s,mat,c,sz,uvs=(1,1),faces='all'):
        cx,cy,cz=c; x,y,z=[v/2 for v in sz]; u,v=uvs
        P=lambda i,j,k:(cx+i*x,cy+j*y,cz+k*z)
        s.quad(mat,P(-1,-1,1),P(1,-1,1),P(1,1,1),P(-1,1,1),((0,0),(u,0),(u,v),(0,v)))
        s.quad(mat,P(1,-1,-1),P(-1,-1,-1),P(-1,1,-1),P(1,1,-1),((0,0),(u,0),(u,v),(0,v)))
        s.quad(mat,P(1,-1,1),P(1,-1,-1),P(1,1,-1),P(1,1,1),((0,0),(u,0),(u,v),(0,v)))
        s.quad(mat,P(-1,-1,-1),P(-1,-1,1),P(-1,1,1),P(-1,1,-1),((0,0),(u,0),(u,v),(0,v)))
        s.quad(mat,P(-1,1,1),P(1,1,1),P(1,1,-1),P(-1,1,-1))
        s.quad(mat,P(-1,-1,-1),P(1,-1,-1),P(1,-1,1),P(-1,-1,1))
    def cyl(s,mat,c,r,h,seg=8,r2=None):
        r2=r if r2 is None else r2; cx,cy,cz=c; P=[];N=[];U=[];I=[]
        for i in range(seg+1):
            a=i/seg*2*math.pi; ca,sa=math.cos(a),math.sin(a)
            for (rr,y,v) in ((r,cy-h/2,0),(r2,cy+h/2,1)):
                P.append((cx+ca*rr,y,cz+sa*rr)); N.append((ca,(r-r2)/max(h,1e-6),sa)); U.append((i/seg,v))
        for i in range(seg): 
            a=2*i; I+= [[a,a+1,a+3],[a,a+3,a+2]]
        # winding fix: outward
        I=[[t[0],t[2],t[1]] for t in I]
        s._add(mat,np.array(P),np.array(N)/np.linalg.norm(np.array(N),axis=1)[:,None],np.array(U),I)
        if r2>0:
            top=[(cx+math.cos(i/seg*2*math.pi)*r2,cy+h/2,cz+math.sin(i/seg*2*math.pi)*r2) for i in range(seg)]
            P2=[(cx,cy+h/2,cz)]+top; I2=[[0,1+(i+1)%seg,1+i] for i in range(seg)]
            s._add(mat,np.array(P2),np.array([(0,1,0)]*len(P2)),np.zeros((len(P2),2)),I2)
    def sphere(s,mat,c,r,seg=8,rings=5):
        P=[];N=[];U=[];I=[]
        for j in range(rings+1):
            t=j/rings*math.pi
            for i in range(seg+1):
                a=i/seg*2*math.pi; n=(math.sin(t)*math.cos(a),math.cos(t),math.sin(t)*math.sin(a))
                P.append((c[0]+n[0]*r,c[1]+n[1]*r,c[2]+n[2]*r)); N.append(n); U.append((i/seg,j/rings))
        for j in range(rings):
            for i in range(seg):
                a=j*(seg+1)+i; b=a+seg+1; I+=[[a,a+1,b],[a+1,b+1,b]]
        s._add(mat,np.array(P),np.array(N),np.array(U),I)
    def save(s,path,texdir='../textures/'):
        buf=bytearray(); views=[];acc=[];prims=[];mats=[];tex=[];imgs=[];mi={};ti={}
        def addbuf(arr,target):
            b=arr.tobytes(); 
            while len(buf)%4: buf.append(0)
            views.append(dict(buffer=0,byteOffset=len(buf),byteLength=len(b),target=target)); buf.extend(b); return len(views)-1
        for name,m in s.mats.items():
            pm=dict(baseColorFactor=list(m['color']),metallicFactor=m['metal'],roughnessFactor=m['rough'])
            if m['tex']:
                if m['tex'] not in ti: imgs.append(dict(uri=texdir+m['tex'])); tex.append(dict(source=len(imgs)-1,sampler=0)); ti[m['tex']]=len(tex)-1
                pm['baseColorTexture']=dict(index=ti[m['tex']])
            e=dict(name=name,pbrMetallicRoughness=pm,doubleSided=m['double'])
            if m['emis']: e['emissiveFactor']=list(m['emis'])
            if m['color'][3]<1 or (m['tex'] and m['tex'].startswith(('sprite','sign_curve','sign_speed','skyline','mountains','neon'))): e['alphaMode']='MASK' if m['tex'] else 'BLEND'; e['alphaCutoff']=.4
            mats.append(e); mi[name]=len(mats)-1
        for name,(P,N,U,I) in s.prims.items():
            P=np.concatenate(P).astype('float32');N=np.concatenate(N).astype('float32');U=np.concatenate(U).astype('float32');I=np.concatenate(I).astype('uint32').ravel()
            ap=len(acc); acc.append(dict(bufferView=addbuf(P,34962),componentType=5126,count=len(P),type='VEC3',min=P.min(0).tolist(),max=P.max(0).tolist()))
            an=len(acc); acc.append(dict(bufferView=addbuf(N,34962),componentType=5126,count=len(N),type='VEC3'))
            au=len(acc); acc.append(dict(bufferView=addbuf(U,34962),componentType=5126,count=len(U),type='VEC2'))
            ai=len(acc); acc.append(dict(bufferView=addbuf(I,34963),componentType=5125,count=len(I),type='SCALAR'))
            prims.append(dict(attributes=dict(POSITION=ap,NORMAL=an,TEXCOORD_0=au),indices=ai,material=mi[name]))
        # materiales sin primitivas se omiten por nombre unico
        j=dict(asset=dict(version='2.0',generator='touge-assets'),scene=0,scenes=[dict(nodes=[0])],nodes=[dict(mesh=0,name=path.split('/')[-1][:-4])],meshes=[dict(primitives=prims)],
               materials=mats,accessors=acc,bufferViews=views,buffers=[dict(byteLength=len(buf))],samplers=[dict(magFilter=9729,minFilter=9987,wrapS=10497,wrapT=10497)])
        if tex: j['textures']=tex; j['images']=imgs
        js=json.dumps(j).encode(); js+=b' '*((4-len(js)%4)%4)
        while len(buf)%4: buf.append(0)
        out=struct.pack('<III',0x46546C67,2,12+8+len(js)+8+len(buf))+struct.pack('<II',len(js),0x4E4F534A)+js+struct.pack('<II',len(buf),0x004E4942)+bytes(buf)
        open(path,'wb').write(out)
