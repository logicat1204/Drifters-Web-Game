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
def wet_albedo(seed):
    n=fbm(S,S,60,5,seed); a=n[...,None]*np.array([.1,.11,.14])+np.array([.07,.075,.09]); a=a*(1-.35*pud[...,None]); return a
def mr(rough_base,lines=None):
    r=rough_base*(.8+.4*fbm(S,S,25,4,50)); r=r*(1-pud)+.04*pud
    if lines is not None: r=np.where(lines>0,.6,r)
    out=np.zeros((S,S,3)); out[...,0]=1; out[...,1]=np.clip(r,0,1); return out
sv(wet_albedo(1),'asphalt_wet_night'); sv(mr(.38),'asphalt_wet_night_mr')
def city_lines():
    I=Image.new('L',(S,S),0); d=ImageDraw.Draw(I); W=255
    d.rectangle([14,0,22,S],fill=W); d.rectangle([490,0,498,S],fill=W)
    for y in range(0,S,128): d.rectangle([164,y,170,y+64],fill=W); d.rectangle([342,y,348,y+64],fill=W)
    d.rectangle([250,0,254,S],fill=W); d.rectangle([258,0,262,S],fill=W); return np.array(I)/255.
L=city_lines(); a=wet_albedo(2); col=np.zeros((S,S,3)); col[...]=a
paint=(L>0)[...,None]; yel=np.zeros((S,S,1),bool); yel[:,248:264]=True
line_col=np.where(yel,np.array([.62,.5,.1]),np.array([.62,.62,.6])); col=np.where(paint,line_col*(.55+.3*fbm(S,S,20,3,3)[...,None]),col)
sv(col,'road_city_wet'); sv(mr(.38,L),'road_city_wet_mr')
def xwalk():
    I=Image.new('L',(S,S),0); d=ImageDraw.Draw(I)
    for x in range(16,S,64): d.rectangle([x,0,x+34,S],fill=255)
    return np.array(I)/255.
X=xwalk(); a=np.where((X>0)[...,None],np.array([.6,.6,.58])*(.6+.3*fbm(S,S,20,3,4)[...,None]),wet_albedo(5)); sv(a,'crosswalk_wet'); sv(mr(.38,X),'crosswalk_wet_mr')
# ---- decals (alpha)
def blob(seed,size=512,rough=.28):
    n=fbm(size,size,60,4,seed); yy,xx=np.mgrid[0:size,0:size]; r=np.sqrt(((xx-size/2)/(size*.46))**2+((yy-size/2)/(size*.34))**2)
    m=np.clip((1-r*(1+.35*(n-.5)*2))*5,0,1); return m
for k,sd in (('a',61),('b',62),('c',63)):
    m=blob(sd); a=np.zeros((S,S,4)); a[...,:3]=np.array([.05,.07,.1])+ (fbm(S,S,30,3,sd+5)[...,None]*.06); a[...,3]=m*.82; sv(a,f'decal_puddle_{k}')
m=blob(70); n=fbm(S,S,14,4,71); a=np.zeros((S,S,4)); h=n*6.28
a[...,0]=.35+.35*np.sin(h);a[...,1]=.35+.35*np.sin(h+2.1);a[...,2]=.45+.35*np.sin(h+4.2); a[...,3]=m*.55*(.4+.6*n); sv(a,'decal_oil_stain')
def streak(c,name):
    W,H=256,512; y=np.linspace(0,1,H)[:,None]; x=np.linspace(-1,1,W)[None,:]
    prof=np.exp(-(x/(.18+.35*y))**2)*np.exp(-y*2.2)*(.65+.35*np.sin(y*40)**2*.4); a=np.zeros((H,W,4)); a[...,:3]=np.array(c)/255; a[...,3]=prof*.9; sv(a,name)
for n,c in (('red',(255,50,70)),('blue',(60,150,255)),('pink',(255,80,200)),('green',(80,255,150)),('orange',(255,150,40))): streak(c,f'decal_neon_reflect_{n}')
# ---- fachadas: albedo apagado + emisivo
def fac(kind,seed):
    r=np.random.default_rng(seed); I=Image.new('RGB',(S,S)); E=Image.new('RGB',(S,S),(0,0,0)); d=ImageDraw.Draw(I); e=ImageDraw.Draw(E)
    warm=[(255,220,150),(255,200,120),(210,235,255),(255,240,200)]
    def win(x0,y0,x1,y1,lit_p):
        d.rectangle([x0,y0,x1,y1],fill=(18,24,34))
        if r.random()<lit_p: e.rectangle([x0,y0,x1,y1],fill=warm[r.integers(0,4)])
    if kind=='office':
        d.rectangle([0,0,S,S],fill=(46,50,58)); cw,rh=S//8,S//16
        for j in range(16):
            for i in range(8): win(i*cw+4,j*rh+5,(i+1)*cw-4,(j+1)*rh-5,.5)
    elif kind=='apartment':
        d.rectangle([0,0,S,S],fill=(78,74,70)); cw,rh=S//4,S//8
        for j in range(8):
            for i in range(4):
                win(i*cw+18,j*rh+14,i*cw+cw-42,j*rh+rh-38,.55); d.rectangle([i*cw+10,j*rh+rh-28,(i+1)*cw-10,j*rh+rh-14],fill=(50,48,44))
    else:
        d.rectangle([0,0,S,S],fill=(60,52,46)); d.rectangle([0,0,S,150],fill=(34,28,26))
        for i in range(4): win(20+i*122,34,120+i*122,120,.8)
        d.rectangle([0,170,S,200],fill=(110,20,24)); e.rectangle([0,170,S,200],fill=(120,20,26)); d.rectangle([0,400,S,S],fill=(50,50,54))
        d.rectangle([40,210,470,390],fill=(30,30,34)); e.rectangle([40,210,470,390],fill=(255,226,170))
    A=np.array(I)/255.*(.85+.15*fbm(S,S,25,4,seed)[...,None]); return A,np.array(E)/255.
for k,sd in (('office',301),('apartment',302),('shop',303)):
    A,E=fac(k,sd); sv(A,f'facade_{k}_wet'); sv(E,f'facade_{k}_emissive')
# ---- lluvia
def rain():
    W,H=256,512; I=Image.new('RGBA',(W,H),(0,0,0,0)); d=ImageDraw.Draw(I); r=np.random.default_rng(8)
    for _ in range(140):
        x=int(r.integers(0,W)); y=int(r.integers(0,H)); l=int(r.integers(30,90)); al=int(r.integers(70,200))
        for k in range(l): d.point((x+k//12,(y+k)%H),fill=(220,230,255,int(al*(1-k/l))))
    rgba(I,'rain_streaks')
rain()
def atlas(kind):
    I=Image.new('RGBA',(512,128),(0,0,0,0)); d=ImageDraw.Draw(I)
    for f in range(4):
        cx=64+f*128; t=(f+1)/4
        if kind=='ripple':
            for k in range(2): rr=14+t*44-k*14; 
            for k in range(2):
                rr=12+t*44-k*16
                if rr>2: d.ellipse([cx-rr,64-rr*.45,cx+rr,64+rr*.45],outline=(220,235,255,int(230*(1-t)**.7)),width=2)
        else:
            r=np.random.default_rng(f)
            for _ in range(9):
                ang=r.uniform(.3,math.pi-.3); L=10+t*34*r.uniform(.5,1); x=cx+math.cos(ang)*L*1.2; y=110-math.sin(ang)*L*1.6
                d.line([cx+(x-cx)*.3,110,x,y],fill=(230,240,255,int(220*(1-t*.6))),width=2); d.ellipse([x-2,y-2,x+2,y+2],fill=(240,248,255,230))
    rgba(I,f'{kind}_atlas')
atlas('ripple'); atlas('splash')
def glow():
    y,x=np.mgrid[-64:64,-64:64]; r=np.sqrt(x*x+y*y)/64; a=np.zeros((128,128,4)); a[...,:3]=1; a[...,3]=np.clip(1-r,0,1)**2.2; sv(a,'glow_sprite')
glow()
def cone():
    H,W=256,128; y=np.linspace(0,1,H)[:,None]; x=np.linspace(-1,1,W)[None,:]; a=np.zeros((H,W,4)); a[...,:3]=np.array([1,.93,.75]); a[...,3]=np.clip(1-np.abs(x)/(.05+.95*y),0,1)**1.6*(1-y)**.7*.55; sv(a,'light_cone')
cone()
# ---- neones
def neon(txt,c,name,sz=120):
    I=Image.new('RGBA',(512,256),(0,0,0,0)); g=Image.new('RGBA',I.size,(0,0,0,0)); d=ImageDraw.Draw(g); f=font(sz); 
    while d.textlength(txt,font=f)>440: sz-=6; f=font(sz)
    w=d.textlength(txt,font=f); d.text((256-w/2,128-sz*.62),txt,font=f,fill=c+(255,)); d.rounded_rectangle([14,14,498,242],radius=40,outline=c+(255,),width=7)
    b1=g.filter(ImageFilter.GaussianBlur(9)); b2=g.filter(ImageFilter.GaussianBlur(3)); I=Image.alpha_composite(I,b1); I=Image.alpha_composite(I,b1); I=Image.alpha_composite(I,b2)
    core=Image.new('RGBA',I.size,(0,0,0,0)); d=ImageDraw.Draw(core); d.text((256-w/2,128-sz*.62),txt,font=f,fill=(255,245,240,255)); d.rounded_rectangle([14,14,498,242],radius=40,outline=(255,245,240,255),width=2); I=Image.alpha_composite(I,core); rgba(I,name)
neon('RAMEN',(255,60,80),'neon_ramen'); neon('BAR',(70,200,255),'neon_bar'); neon('HOTEL',(255,100,220),'neon_hotel'); neon('ARCADE',(100,255,150),'neon_arcade'); neon('IZAKAYA',(255,150,40),'neon_izakaya')
def chochin():
    I=Image.new('RGBA',(256,256),(0,0,0,0)); d=ImageDraw.Draw(I); d.rectangle([0,0,255,255],fill=(200,26,30,255))
    for y in range(20,256,48): d.line([0,y,255,y],fill=(120,10,14,255),width=3)
    f=font(60); w=d.textlength('RACE',font=f); d.text((128-w/2,100),'RACE',font=f,fill=(250,240,230,255)); I.save(f'{OUT}/chochin_lantern.png')
chochin()
# ---- banners / carteles
def banner(name,bg,fg,txt,sub=None):
    I=Image.new('RGB',(512,192),bg); d=ImageDraw.Draw(I); f=font(70); w=d.textlength(txt,font=f)
    while w>470: f=font(f.size-4); w=d.textlength(txt,font=f)
    d.text((256-w/2,96-f.size*.62),txt,font=f,fill=fg); d.rectangle([4,4,507,187],outline=fg,width=5); I.save(f'{OUT}/{name}.png')
banner('banner_race_angels',(20,20,28),(255,120,200),'RACE ANGELS'); banner('banner_mf_race',(20,50,130),(255,255,255),'MF RACE'); banner('banner_fans_a',(250,210,40),(30,30,30),'GO GO GO!'); banner('banner_fans_b',(230,40,60),(255,255,255),'TOUGE CUP')
for n in ('01','02'):
    I=Image.new('RGB',(256,384),(250,250,250)); d=ImageDraw.Draw(I); f=font(190); w=d.textlength(n,font=f); d.text((128-w/2,70),n,font=f,fill=(20,20,24)); d.rectangle([4,4,251,379],outline=(230,40,60),width=10); I.save(f'{OUT}/number_board_{n}.png')
print(len(os.listdir(OUT)))
