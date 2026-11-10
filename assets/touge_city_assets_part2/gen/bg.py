import math, numpy as np
exec(open('models2.py').read().split('# ================= carretera')[0])   # reutiliza helpers (tri, quado, boulder...)
def pm(m,fall=False):
    cols={'g1':(.30,.48,.22),'g2':(.22,.40,.2),'g3':(.40,.55,.26),'rk':(.46,.44,.42),'rk2':(.36,.35,.35),'sn':(.94,.95,.98),'au':(.72,.4,.16),'dk':(.14,.26,.2)}
    for k,c in cols.items(): m.mat(k,c+(1,),rough=1)
def pick(h,H,rg,fuji=False):
    t=h/H; 
    if fuji and t>.72: return 'sn'
    if t>.78: return 'rk' if rg.random()<.6 else 'rk2'
    if t>.55: return 'dk' if rg.random()<.5 else 'g2'
    if t>.3: return 'au' if rg.random()<.08 else ['g2','g1','g3'][rg.integers(0,3)]
    return ['g1','g3','g1'][rg.integers(0,3)]
def peak(name,R,H,seed,fuji=False,skew=1.0,seg=18,rings=6):
    m=M(); pm(m); rg=np.random.default_rng(seed); ph=rg.uniform(0,6.28,4)
    def h(r,a):
        t=max(0,1-r/R); base=H*t**(1.4 if fuji else 1.0)
        return max(0,base*(1+.18*math.sin(3*a+ph[0])+.1*math.sin(5*a+ph[1]))+ (rg.uniform(-.06,.06)*H*t if r<R else 0))
    P={}
    for j in range(rings+1):
        r=R*j/rings
        for i in range(seg):
            a=i/seg*2*math.pi; hh=h(r,a) if j>0 else H*(1+.0)
            P[(j,i)]=(math.cos(a)*r,hh*(1 if j>0 else 1),math.sin(a)*r*skew)
    # cima unica
    for j in range(rings):
        for i in range(seg):
            a,b,c,d=P[(j,i)],P[(j,(i+1)%seg)],P[(j+1,(i+1)%seg)],P[(j+1,i)]
            hm=(a[1]+b[1]+c[1]+d[1])/4; mat=pick(hm,H,rg,fuji)
            quado(m,mat,a,b,c,d,(0,H*.4,0))
    m.save(O+name+'.glb')
peak('bg_mountain_cone_a',90,70,11); peak('bg_mountain_cone_b',130,110,12,skew=.7); peak('bg_mountain_fuji',260,260,13,fuji=True,seg=24,rings=8)
def ridge(name,L,H,seed):
    m=M(); pm(m); rg=np.random.default_rng(seed); nx,nz=24,5; W=60
    ys=np.zeros((nx+1,nz+1))
    for i in range(nx+1):
        top=H*(.45+.55*abs(math.sin(i*.55+seed))*(1-abs(i/nx*2-1)**1.5))
        for j in range(nz+1): ys[i,j]=max(0,top*(1-(j/nz))**1.1*(1+rg.uniform(-.12,.12)))
    for i in range(nx):
        for j in range(nz):
            p=lambda a,b:(-L/2+L*a/nx,ys[a,b],-W/2+W*b/nz)
            hm=(ys[i,j]+ys[i+1,j]+ys[i+1,j+1]+ys[i,j+1])/4
            quado(m,pick(hm,H,rg),p(i,j),p(i+1,j),p(i+1,j+1),p(i,j+1),(0,H*2,0)) if True else None
            quado(m,pick(hm,H,rg),p(i,j),p(i,j+1),p(i+1,j+1),p(i+1,j),(0,H*2,0)) if False else None
    m.save(O+name+'.glb')
ridge('bg_ridge_long',400,95,3); ridge('bg_ridge_low',300,45,5)
def ring(name,ri,ro,H,seed,seg=72,rings=5,city=False):
    m=M(); pm(m); rg=np.random.default_rng(seed); ph=rg.uniform(0,6.28,5)
    def h(j,a):
        t=j/rings; prof=math.sin(min(1,t*1.1)*math.pi*.9)**1.2
        var=.6+.25*math.sin(3*a+ph[0])+.2*math.sin(7*a+ph[1])+.12*math.sin(13*a+ph[2])
        return H*prof*var*(1+rg.uniform(-.08,.08))
    P={}
    for j in range(rings+1):
        r=ri+(ro-ri)*j/rings
        for i in range(seg): a=i/seg*2*math.pi; P[(j,i)]=(math.cos(a)*r,h(j,a),math.sin(a)*r)
    for j in range(rings):
        for i in range(seg):
            a,b,c,d=P[(j,i)],P[(j,(i+1)%seg)],P[(j+1,(i+1)%seg)],P[(j+1,i)]
            quado(m,pick((a[1]+b[1]+c[1]+d[1])/4,H*1.05,rg),a,b,c,d,(a[0]*.0,-50,0)) if False else None
            # orientacion hacia arriba
            for (p0,p1,p2) in ((a,b,c),(a,c,d)):
                n=np.cross(np.array(p1)-p0,np.array(p2)-p0); 
                if n[1]<0: p1,p2=p2,p1
                tri(m,pick((a[1]+b[1]+c[1]+d[1])/4,H*1.05,rg),p0,p1,p2)
    m.save(O+name+'.glb')
ring('bg_hills_ring',320,620,90,21); ring('bg_hills_ring_low',300,480,40,22,seg=60,rings=4)
def forest(name,L=40,rows=3,seed=1):
    m=M(); pm(m); m.mat('tr',(.3,.2,.14,1)); rg=np.random.default_rng(seed); m.box('g1',(0,-.1,0),(L,.2,rows*7),)
    for r in range(rows):
        for k in range(int(L/4)):
            x=-L/2+k*4+rg.uniform(-1,1); z=-rows*3.5+r*7+rg.uniform(-1.5,1.5); h=rg.uniform(6,10); mt=['g2','dk','g1'][rg.integers(0,3)]
            m.cyl('tr',(x,1,z),.2,2,5)
            for q in range(3): m.cyl(mt,(x,2.4+q*h*.18,z),(1.8-q*.45)*(h/8),h*.3,6,r2=.0001)
    m.save(O+name+'.glb')
forest('bg_forest_strip',40,3,1); forest('bg_forest_strip_dense',40,5,2)
def cityring(name,R=350,n=90,seed=5):
    m=M(); rg=np.random.default_rng(seed)
    for k,c in enumerate([(.55,.58,.64),(.7,.7,.72),(.4,.44,.52)]): m.mat(f'b{k}',c+(1,),rough=1)
    m.mat('win',(1,.85,.5,1),emis=(.9,.7,.3)); m.mat('rf',(.3,.3,.32,1))
    for i in range(n):
        a=i/n*2*math.pi; r=R+rg.uniform(-30,60); w=rg.uniform(14,30); d=rg.uniform(14,30); h=rg.uniform(30,150)*(1+.6*math.sin(a*3))
        h=max(25,h); cx,cz=math.cos(a)*r,math.sin(a)*r
        m.box(f'b{rg.integers(0,3)}',(cx,h/2,cz),(w,h,d)); m.box('rf',(cx,h+1,cz),(w*.7,2,d*.7))
        for y in np.arange(8,h-4,12): 
            if rg.random()<.6: m.box('win',(cx+math.cos(a)*(-d*.0),y,cz),(w*1.01,1.4,d*1.01))
    m.save(O+name+'.glb')
cityring('bg_city_ring',350,90,5)
def clouds(name,seed=2):
    m=M(); m.mat('c',(1,1,1,.92),rough=1); rg=np.random.default_rng(seed)
    for k in range(7):
        cx=rg.uniform(-400,400); cz=rg.uniform(-400,400); 
        for q in range(5): boulder(m,'c',(cx+rg.uniform(-30,30),160+rg.uniform(-8,8),cz+rg.uniform(-18,18)),rg.uniform(14,30),k*10+q,sq=.55)
    m.save(O+name+'.glb')
clouds('bg_clouds')
def sea(name,seed=3):
    m=M(); m.mat('w',(.18,.4,.55,1),metal=.2,rough=.3); m.mat('w2',(.22,.46,.6,1),metal=.2,rough=.3); rg=np.random.default_rng(seed); n=20; L=1200
    for i in range(n):
        for j in range(n):
            x0,x1=-L/2+L*i/n,-L/2+L*(i+1)/n; z0,z1=-L/2+L*j/n,-L/2+L*(j+1)/n
            y=lambda: rg.uniform(-.5,.5)
            quadup(m,'w' if (i+j)%2 else 'w2',(x0,y(),z0),(x1,y(),z0),(x1,y(),z1),(x0,y(),z1),((0,0),(1,0),(1,1),(0,1)))
    m.save(O+name+'.glb')
sea('bg_sea_plane')
import os,glob; print(sorted(os.path.basename(f) for f in glob.glob(O+'bg_*.glb')))
