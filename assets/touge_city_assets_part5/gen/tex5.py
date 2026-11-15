import numpy as np, math, os
from PIL import Image, ImageDraw, ImageFont, ImageFilter
OUT='../textures'; S=512
def noise(w,h,scale,seed=0):
    a=np.random.default_rng(seed).standard_normal((h,w)); ky=np.fft.fftfreq(h)[:,None]; kx=np.fft.fftfreq(w)[None,:]
    b=np.real(np.fft.ifft2(np.fft.fft2(a)*np.exp(-((kx**2+ky**2)*scale**2)))); return (b-b.min())/(b.max()-b.min())
def fbm(w,h,base=40,oct=4,seed=0):
    t=0;amp=1;s=0
    for i in range(oct): t=t+amp*noise(w,h,base/(2**i),seed+i); s+=amp; amp*=.5
    return t/s
F='/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
def font(sz):
    try: return ImageFont.truetype(F,sz)
    except Exception: return ImageFont.load_default()
def sv(a,name):
    a=(np.clip(a,0,1)*255).astype('uint8'); Image.fromarray(a).save(f'{OUT}/{name}.png')
def rgba(I,name): I.save(f'{OUT}/{name}.png')
# ---- mascara de charcos (tileable) + asfalto mojado
pud=np.clip((fbm(S,S,70,3,41)-.52)*7,0,1); sv(pud,'puddle_mask')
rng=np.random.default_rng(5)
def tile(a): return a
# ---------- huellas de neumatico (decals) ----------
def track_strip(w,h,seed,wid=.7,fade=True):
    """una huella vertical: bloques de dibujo + ruido. devuelve alpha HxW"""
    n=fbm(w,h,12,4,seed); x=(np.arange(w)[None,:]-w/2)/(w/2)
    edge=np.clip(1-np.abs(x)**3,0,1)**.7; core=np.clip((n-.25)*2.2,0,1)
    tread=0.75+0.25*np.sin(np.arange(h)[:,None]*0.9+x*3)
    a=edge*core*tread
    if fade:
        t=np.linspace(0,1,h)[:,None]; a*=np.clip(t/.12,0,1)**1.5*np.clip((1-t)/.35,0,1)
    return np.clip(a,0,1)
def save_decal(a,col,name,w=256):
    h,ww=a.shape; I=np.zeros((h,ww,4)); I[...,:3]=np.array(col)[None,None,:]*(.8+.2*noise(ww,h,6,9)[...,None]); I[...,3]=a
    sv(I,name)
def two_tracks(seed,col,name,op=.85,gap=.42):
    w,h=256,512; A=np.zeros((h,w))
    for k,cx in enumerate((.5-gap/2,.5+gap/2)):
        t=track_strip(80,h,seed+k); x0=int(cx*w)-40; A[:,max(0,x0):x0+80]=np.maximum(A[:,max(0,x0):x0+80],t[:,:min(80,w-max(0,x0))] if x0>=0 else t[:,-x0:])
    save_decal(A*op,col,name)
two_tracks(10,(.02,.02,.025),'decal_skid_dry_a',.9); two_tracks(20,(.03,.03,.035),'decal_skid_dry_b',.75,.5)
two_tracks(30,(.05,.06,.07),'decal_skid_wet',.45); two_tracks(40,(.22,.14,.08),'decal_skid_dirt',.8); two_tracks(50,(.55,.6,.68),'decal_skid_snow',.7)
def curve(seed,name,col):
    w,h=512,512; A=np.zeros((h,w)); base=track_strip(64,h,seed)
    for k,off in enumerate((-.12,.12)):
        for y in range(h):
            t=y/h; cx=.25+.5*t**1.6+off*(0.4+t*.6); x0=int(cx*w)-32
            if 0<=x0<w-64: A[y,x0:x0+64]=np.maximum(A[y,x0:x0+64],base[y])
    save_decal(A*.88,col,name)
curve(60,'decal_skid_drift_curve',(.02,.02,.025))
def burnout():
    w,h=512,512; A=np.zeros((h,w)); yy,xx=np.mgrid[0:h,0:w]; r=np.hypot(xx-w/2,yy-h/2); th=np.arctan2(yy-h/2,xx-w/2); n=fbm(w,h,10,4,70)
    for R in (120,150,185,210):
        A=np.maximum(A,np.clip(1-np.abs(r-R-18*np.sin(th*2+R))/10,0,1)*np.clip((n-.2)*2.5,0,1))
    save_decal(A*np.clip(1-r/260,0,1)**.3*.9,(.02,.02,.025),'decal_skid_burnout')
burnout()
# tira de huella unica (tileable en V) para skidmarks.js
a=track_strip(64,256,80,fade=False); a=np.pad(a,((0,0),(0,0))); save_decal(a*.9,(.02,.02,.025),'decal_skid_strip')
# ---------- sprites VFX ----------
def puff(seed,s=128):
    yy,xx=np.mgrid[0:s,0:s]; r=np.hypot(xx-s/2,yy-s/2)/(s/2); n=fbm(s,s,6,4,seed); a=np.clip(1-r,0,1)**1.3*np.clip(n*1.6-.15,0,1); return np.clip(a*1.4,0,1)
I=np.zeros((512,512,4)); I[...,:3]=.92
for k in range(16):
    j,i=divmod(k,4); p=puff(100+k*3); sc=.55+.45*(k/15)  # crece con el frame
    q=np.zeros((128,128)); sz=int(128*sc); 
    img=Image.fromarray((p*255).astype('uint8')).resize((sz,sz)); qq=np.array(img)/255.; o=(128-sz)//2; q[o:o+sz,o:o+sz]=qq*(1-.5*k/15)
    I[j*128:(j+1)*128,i*128:(i+1)*128,3]=q
sv(I,'smoke_atlas')
def spark():
    s=64; yy,xx=np.mgrid[0:s,0:s]; r=np.hypot(xx-s/2,yy-s/2)/(s/2); a=np.clip(1-r,0,1)**2.2; I=np.zeros((s,s,4)); I[...,0]=1;I[...,1]=.75-.3*r;I[...,2]=.25;I[...,3]=a; sv(I,'spark_sprite')
spark()
# ---------- garaje ----------
S=512
def concrete(seed,oil=True):
    n=fbm(S,S,50,5,seed); base=.28+.18*n; a=np.repeat(base[...,None],3,2)*np.array([1,1,1.04])
    # juntas
    a[S//2-1:S//2+1,:]*=.55; a[:,S//2-1:S//2+1]*=.55
    if oil:
        o=np.clip((fbm(S,S,90,3,seed+9)-.6)*6,0,1); a=a*(1-.6*o[...,None])+o[...,None]*np.array([.03,.03,.04])*.6
    return a,np.clip((fbm(S,S,90,3,seed+9)-.6)*6,0,1)
a,o=concrete(1); sv(a,'concrete_garage_floor'); mrr=np.zeros((S,S,3)); mrr[...,1]=np.clip(.75-.5*o,0,1); sv(mrr,'concrete_garage_floor_mr')
a,_=concrete(7,False); sv(a*1.3,'concrete_wall_plain')
def wall_two():
    I=np.zeros((S,S,3)); n=fbm(S,S,40,4,12)[...,None]; top=np.array([.62,.62,.58])*(.8+.2*n); bot=np.array([.14,.17,.2])*(.8+.2*n)
    I[:]=top; I[S//2:]=bot[S//2:]; I[S//2-3:S//2+3]=np.array([.85,.7,.1]); return I
sv(wall_two(),'garage_wall_painted')
def door():
    I=np.zeros((S,S,3)); n=fbm(S,S,60,3,14)[...,None]
    for y in range(0,S,64): I[y:y+64]=np.array([.62,.64,.68])*(.85+.15*n[y:y+64]); I[y:y+4]*=.45; I[y+60:y+64]*=.6
    sv(I,'garage_door_rollup')
door()
def ceiling():
    I=np.zeros((S,S,3)); I[:]=np.array([.55,.55,.55])*(.85+.15*fbm(S,S,30,3,15)[...,None]);
    for p in (0,256): I[p:p+3]*=.4; I[:,p:p+3]*=.4
    sv(I,'garage_ceiling_panel')
ceiling()
def checker():
    I=np.zeros((S,S,3)); n=fbm(S,S,30,3,16); I[:]=np.array([.55,.57,.6])[None,None,:]*(.8+.2*n[...,None])
    for x in range(8,S,32):
        for y in range(8,S,32):
            I[y:y+14,x:x+4]*=1.25 if (x//32+y//32)%2 else 0.7; I[y:y+4,x:x+14]*=1.2
    sv(np.clip(I,0,1),'metal_diamond_plate')
checker()
def wood():
    I=np.zeros((S,S,3)); n=noise(S,S,2,17); y=np.arange(S)[:,None]; g=.5+.5*np.sin(y*.25+n*30); I[:]=np.array([.45,.3,.17])[None,None,:]*(.7+.3*g[...,None]); sv(I,'workbench_wood')
wood()
def tire_side():
    s=256; I=Image.new('RGB',(s,s),(14,14,16)); d=ImageDraw.Draw(I); c=s//2
    for r,col in ((120,(22,22,25)),(95,(18,18,20)),(60,(24,24,27))): d.ellipse([c-r,c-r,c+r,c+r],fill=col)
    for k in range(40): a=k/40*2*math.pi; d.line([c+math.cos(a)*100,c+math.sin(a)*100,c+math.cos(a)*118,c+math.sin(a)*118],fill=(30,30,34),width=2)
    d.text((c-45,c+66),'TOUGE-GRIP 225',font=font(12),fill=(150,150,150)); I.save(f'{OUT}/tire_sidewall.png')
tire_side()
def tread():
    s=256; I=Image.new('RGB',(s,s),(20,20,22)); d=ImageDraw.Draw(I)
    for x in range(0,s,32): d.rectangle([x,0,x+10,s],fill=(8,8,9))
    for y in range(0,s,16):
        for x in range(0,s,32): d.line([x+10,y,x+30,y+10],fill=(10,10,11),width=3)
    I.save(f'{OUT}/tire_tread.png')
tread()
def rim():
    s=256; I=Image.new('RGBA',(s,s),(0,0,0,0)); d=ImageDraw.Draw(I); c=s//2; d.ellipse([4,4,s-4,s-4],fill=(170,175,185,255)); d.ellipse([30,30,s-30,s-30],fill=(120,125,135,255))
    for k in range(5):
        a=k/5*2*math.pi; d.polygon([(c+math.cos(a-.2)*16,c+math.sin(a-.2)*16),(c+math.cos(a-.28)*95,c+math.sin(a-.28)*95),(c+math.cos(a+.28)*95,c+math.sin(a+.28)*95),(c+math.cos(a+.2)*16,c+math.sin(a+.2)*16)],fill=(215,218,225,255))
    d.ellipse([c-14,c-14,c+14,c+14],fill=(60,60,66,255)); I.convert('RGB').save(f'{OUT}/rim_face.png')
rim()
def pegboard():
    I=Image.new('RGB',(S,S),(150,110,70)); d=ImageDraw.Draw(I)
    for x in range(8,S,24):
        for y in range(8,S,24): d.ellipse([x-2,y-2,x+2,y+2],fill=(60,40,25))
    for k,(x,y) in enumerate(((60,60),(200,70),(340,60),(440,80),(80,260),(220,280),(360,250))):
        d.line([x,y,x,y+120],fill=(30,30,34),width=8); d.rectangle([x-18,y,x+18,y+22],fill=(180,40,30) if k%2 else (40,70,160))
    I.save(f'{OUT}/tool_pegboard.png')
pegboard()
def turntable():
    s=1024; I=Image.new('RGB',(s,s),(18,19,22)); d=ImageDraw.Draw(I); c=s//2
    for r,col,w in ((500,(200,200,205),6),(470,(40,42,48),2),(300,(70,72,80),3),(120,(70,72,80),3)): d.ellipse([c-r,c-r,c+r,c+r],outline=col,width=w)
    for k in range(24): a=k/24*2*math.pi; d.line([c+math.cos(a)*470,c+math.sin(a)*470,c+math.cos(a)*500,c+math.sin(a)*500],fill=(200,200,205),width=4)
    d.polygon([(c,c-420),(c-24,c-380),(c+24,c-380)],fill=(220,40,40)); I.save(f'{OUT}/turntable_top.png')
    E=Image.new('RGB',(s,s),(0,0,0)); d=ImageDraw.Draw(E); d.ellipse([c-500,c-500,c+500,c+500],outline=(60,200,255),width=14); d.ellipse([c-470,c-470,c+470,c+470],outline=(20,90,130),width=6); E.save(f'{OUT}/turntable_glow.png')
turntable()
def backdrop():
    w,h=1024,512; I=np.zeros((h,w,3)); y=np.linspace(0,1,h)[:,None,None]; I[:]=np.array([.05,.06,.09])*(1-y)+np.array([.14,.16,.2])*y
    for k in range(8):
        x0=k*130+20; I[:, x0:x0+70]*=1.0; 
    im=Image.fromarray((np.clip(I,0,1)*255).astype('uint8')); d=ImageDraw.Draw(im)
    for k in range(7): x=60+k*140; d.polygon([(x,0),(x+40,0),(x+110,h),(x+70,h)],fill=(26,30,40))
    im.save(f'{OUT}/showroom_backdrop.png')
backdrop()
def poster(name,t1,t2,c1,c2,seed):
    I=Image.new('RGB',(256,384),c1); d=ImageDraw.Draw(I)
    for k in range(9): d.polygon([(0,50+k*40),(256,k*40-30),(256,k*40-10),(0,70+k*40)],fill=c2)
    d.rectangle([0,0,255,383],outline=(240,240,240),width=6); d.text((16,18),t1,font=font(34),fill=(255,255,255)); d.text((16,340),t2,font=font(20),fill=(255,230,80))
    # coche estilizado
    d.polygon([(40,230),(70,200),(150,190),(200,215),(230,235),(230,260),(40,260)],fill=(235,235,240)); 
    for x in (80,190): d.ellipse([x-18,245,x+18,281],fill=(15,15,18))
    I.save(f'{OUT}/{name}.png')
poster('poster_a','TOUGE','KINGS NIGHT',(30,20,70),(60,40,140),1); poster('poster_b','DRIFT','FINALS',(120,20,25),(180,40,40),2); poster('poster_c','RACE','ANGELS',(20,70,110),(40,130,180),3)
def sign():
    I=Image.new('RGBA',(512,160),(0,0,0,0)); d=ImageDraw.Draw(I); d.rounded_rectangle([4,4,508,156],20,fill=(15,15,18,255),outline=(255,70,60,255),width=8); d.text((60,40),'GARAGE',font=font(80),fill=(255,90,80,255)); I.save(f'{OUT}/sign_garage.png')
sign()
def label(name,t,col):
    I=Image.new('RGB',(256,128),col); d=ImageDraw.Draw(I); d.rectangle([0,0,255,127],outline=(255,255,255),width=5); d.text((14,40),t,font=font(32),fill=(255,255,255)); I.save(f'{OUT}/{name}.png')
label('oil_can_label','OIL 5W-30',(190,30,30)); label('crate_label','PARTS',(40,90,50))
print('ok')
