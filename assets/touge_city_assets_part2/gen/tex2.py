import numpy as np, math
from PIL import Image, ImageDraw, ImageFont, ImageFilter
OUT='../textures'; S=512
def noise(w,h,scale,seed=0):
    a=np.random.default_rng(seed).standard_normal((h,w)); ky=np.fft.fftfreq(h)[:,None]; kx=np.fft.fftfreq(w)[None,:]
    b=np.real(np.fft.ifft2(np.fft.fft2(a)*np.exp(-((kx**2+ky**2)*scale**2)))); return (b-b.min())/(b.max()-b.min())
def fbm(w,h,base=40,oct=4,seed=0):
    t=0;amp=1;s=0
    for i in range(oct): t=t+amp*noise(w,h,base/(2**i),seed+i); s+=amp; amp*=.5
    return t/s
def rgb(*c): return np.array(c,float)/255
def col(n,c0,c1): return n[...,None]*(rgb(*c1)-rgb(*c0))+rgb(*c0)
def save(a,name,mode=None):
    a=(np.clip(a,0,1)*255).astype('uint8'); Image.fromarray(a,mode or ('RGBA' if a.shape[-1]==4 else 'RGB')).save(f'{OUT}/{name}.png')
def asphalt(seed,dark=0):
    a=col(fbm(S,S,60,5,seed),(50,52,56),(86,88,92))*(1-dark)+(noise(S,S,1.2,seed+9)[...,None]-.5)*.1
    return a
F='/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
def font(sz):
    try: return ImageFont.truetype(F,sz)
    except Exception: return ImageFont.load_default()
# --- carreteras
def road(wet=False):
    a=asphalt(21,.15 if wet else 0); I=Image.fromarray((np.clip(a,0,1)*255).astype('uint8')); d=ImageDraw.Draw(I)
    d.rectangle([20,0,28,S],fill=(236,236,228)); d.rectangle([484,0,492,S],fill=(236,236,228)); d.rectangle([250,0,262,S],fill=(238,138,30))
    a=np.array(I)/255.; a=a*(.78+.22*fbm(S,S,25,4,11)[...,None])
    if wet:
        p=np.clip((fbm(S,S,40,3,31)-.55)*5,0,1); a=a*(1-.3*p[...,None])+p[...,None]*np.array([.18,.2,.26])*.6
    return a
save(road(),'road_touge_orange'); save(road(True),'road_touge_wet')
def gutter():
    a=col(fbm(S,S,50,4,5),(120,118,112),(172,168,160)); I=Image.fromarray((a*255).astype('uint8')); d=ImageDraw.Draw(I)
    d.rectangle([0,0,S,S],outline=None); d.rectangle([150,0,360,S],fill=(78,76,72)); d.rectangle([160,0,350,S],fill=(98,96,92))
    for y in range(0,S,128): d.rectangle([148,y,362,y+4],fill=(60,58,56))
    for x in range(168,350,26): 
        for y in range(10,S,128): d.rectangle([x,y,x+14,y+90],fill=(60,58,56))
    return np.array(I)/255.
save(gutter(),'gutter_concrete')
def curb():
    a=col(fbm(S,S,45,4,6),(150,148,142),(200,196,186)); a[:,:12]*=.6; a[:,-12:]*=.8
    for y in range(0,S,170): a[y:y+3]*=.55
    return a
save(curb(),'curb_concrete')
def lattice():
    I=Image.new('RGB',(S,S),(60,110,48)); d=ImageDraw.Draw(I); g=fbm(S,S,30,4,8); a=col(g,(40,86,34),(96,142,60)); I=Image.fromarray((a*255).astype('uint8')); d=ImageDraw.Draw(I)
    for k in range(0,S+1,128): d.line([k,0,k,S],fill=(176,172,162),width=22); d.line([0,k,S,k],fill=(176,172,162),width=22)
    return np.array(I)/255.*(.9+.1*fbm(S,S,10,3,9)[...,None])
save(lattice(),'slope_lattice')
def mossy():
    a=col(fbm(S,S,34,5,12),(60,64,58),(128,130,120)); m=np.clip((fbm(S,S,18,4,13)-.5)*3,0,1)[...,None]*np.array([.18,.34,.1]); a=a*(1-m)+m
    for y in range(0,S,64): a[y:y+3]*=.6
    return a
save(mossy(),'wall_mossy')
def roof():
    a=np.zeros((S,S,3)); n=fbm(S,S,20,3,14)
    for j in range(16):
        for i in range(16):
            v=.2+.1*n[j*32,i*32]; a[j*32:(j+1)*32,i*32:(i+1)*32]=np.array([.22,.24,.27])*(.8+v)
            a[j*32+26:(j+1)*32]*=.5
    return a*(.9+.1*noise(S,S,2,15)[...,None])
save(roof(),'roof_tile')
def plaster():
    a=col(fbm(S,S,40,4,16),(206,200,188),(236,232,220)); a[:, :4]*=.9; return a
save(plaster(),'plaster_wall')
def wood():
    n=noise(S,S,1,17); n2=noise(S,S,60,18); stripes=(np.sin(np.arange(S)[None,:]/S*math.pi*2*18)*.5+.5)*np.ones((S,1))
    return col(.5*n2+.3*stripes+.2*n,(60,40,28),(120,86,56))
save(wood(),'wood_planks')
# --- calcomanias (alpha)
def decal(name,fn):
    I=Image.new('RGBA',(S,S),(0,0,0,0)); d=ImageDraw.Draw(I); fn(d,I); I.save(f'{OUT}/{name}.png')
def d30(d,I):
    f=font(260); tw=d.textlength('30',font=f); d.text((256-tw/2,100),'30',font=f,fill=(238,138,30,255))
decal('decal_30',d30)
def d_dia(d,I): d.polygon([(256,30),(480,256),(256,482),(32,256)],outline=(236,236,228,255),width=26)
decal('decal_diamond',d_dia)
def d_arrow(d,I):
    d.polygon([(256,20),(380,200),(300,200),(300,300),(212,300),(212,200),(132,200)],fill=(236,236,228,255)); d.polygon([(212,320),(300,320),(300,480),(212,480)],fill=(236,236,228,255))
decal('decal_arrow',d_arrow)
def d_stop(d,I): d.rectangle([0,200,S,260],fill=(236,236,228,255))
decal('decal_stopline',d_stop)
def d_tyre(d,I):
    for x in (140,200,320,380):
        for k in range(14): d.line([x+np.random.default_rng(k).integers(-3,3),k*38,x+np.random.default_rng(k+1).integers(-3,3),k*38+40],fill=(10,10,12,150),width=16)
    I2=I.filter(ImageFilter.GaussianBlur(3)); I.paste(I2)
decal('decal_tyre_marks',d_tyre)
def d_leaves(d,I):
    r=np.random.default_rng(3); pal=[(214,92,28),(232,140,36),(180,50,26),(240,180,60),(120,70,30)]
    for _ in range(220):
        x,y=r.integers(0,S,2); rr=r.integers(5,11); d.ellipse([x-rr,y-rr*.6,x+rr,y+rr*.6],fill=pal[r.integers(0,5)]+(235,))
decal('decal_leaves',d_leaves)
def d_crack(d,I):
    r=np.random.default_rng(4)
    for _ in range(7):
        x,y=r.integers(40,470,2)
        for k in range(14): nx=x+r.integers(-30,30); ny=y+r.integers(-20,36); d.line([x,y,nx,ny],fill=(14,14,16,220),width=3); x,y=nx,ny
decal('decal_cracks',d_crack)
def d_man(d,I):
    d.ellipse([96,96,416,416],fill=(64,62,60,255),outline=(30,30,30,255),width=10)
    for k in range(-3,4): d.line([256+k*30,130,256+k*30,382],fill=(36,36,36,255),width=8); d.line([130,256+k*30,382,256+k*30],fill=(36,36,36,255),width=8)
decal('decal_manhole',d_man)
# --- señales
def sign_rock():
    I=Image.new('RGBA',(256,256),(0,0,0,0)); d=ImageDraw.Draw(I); d.polygon([(128,8),(248,128),(128,248),(8,128)],fill=(250,214,40,255),outline=(20,20,24,255)); d.line([128,8,248,128,128,248,8,128,128,8],fill=(20,20,24,255),width=8)
    d.polygon([(90,170),(120,100),(150,128),(176,90),(190,170)],fill=(20,20,24,255)); d.ellipse([170,60,200,90],fill=(20,20,24,255)); I.save(f'{OUT}/sign_falling_rocks.png')
sign_rock()
def sign_slip():
    I=Image.new('RGBA',(256,256),(0,0,0,0)); d=ImageDraw.Draw(I); d.polygon([(128,8),(248,128),(128,248),(8,128)],fill=(250,214,40,255),outline=(20,20,24,255)); d.line([128,8,248,128,128,248,8,128,128,8],fill=(20,20,24,255),width=8)
    d.rectangle([84,120,172,150],fill=(20,20,24,255)); d.line([70,190,110,160,150,190,190,160],fill=(20,20,24,255),width=8); I.save(f'{OUT}/sign_slippery.png')
sign_slip()
def mirror():
    I=Image.new('RGBA',(256,256),(0,0,0,0)); d=ImageDraw.Draw(I); d.ellipse([4,4,252,252],fill=(238,120,24,255)); d.ellipse([24,24,232,232],fill=(150,190,205,255))
    for r in range(100,0,-10): d.ellipse([128-r,128-r,128+r,128+r],outline=(170+r//2,210,225,255),width=2)
    d.ellipse([60,50,110,90],fill=(235,248,250,200)); d.line([160,200,200,170],fill=(60,70,80,255),width=6); I.save(f'{OUT}/curve_mirror.png')
mirror()
def kmpost():
    I=Image.new('RGBA',(128,256),(0,0,0,0)); d=ImageDraw.Draw(I); d.rounded_rectangle([4,4,124,252],radius=14,fill=(250,250,250,255),outline=(30,90,60,255),width=8)
    f=font(70); d.text((64-d.textlength('12',font=f)/2,60),'12',font=f,fill=(30,90,60,255)); d.text((64-d.textlength('km',font=font(40))/2,170),'km',font=font(40),fill=(30,90,60,255)); I.save(f'{OUT}/sign_km_post.png')
kmpost()
# --- sprites
def spr_bamboo():
    I=Image.new('RGBA',(256,512),(0,0,0,0)); d=ImageDraw.Draw(I); r=np.random.default_rng(2)
    for k in range(7):
        x=40+k*28+r.integers(-6,6); d.rectangle([x,40,x+9,512],fill=(90,140,60,255))
        for y in range(70,512,70): d.line([x-1,y,x+10,y],fill=(60,100,40,255),width=3)
        for _ in range(9):
            y=r.integers(40,250); dx=r.choice([-1,1])*r.integers(14,48); d.polygon([(x+4,y),(x+4+dx,y-8),(x+4+dx*1.2,y+6)],fill=(110,170,70,255))
    I.filter(ImageFilter.GaussianBlur(.6)).save(f'{OUT}/sprite_bamboo.png')
spr_bamboo()
def spr_blob(name,pal,trunk=True,w=256,h=512,cy=190,spread=52,n=70,rad=(22,44)):
    I=Image.new('RGBA',(w,h),(0,0,0,0)); d=ImageDraw.Draw(I); r=np.random.default_rng(8)
    if trunk: d.polygon([(w//2-14,h),(w//2-8,h-190),(w//2+8,h-190),(w//2+14,h)],fill=(66,46,34,255)); d.line([w//2,h-170,w//2-50,cy+40],fill=(66,46,34,255),width=8); d.line([w//2,h-150,w//2+54,cy+50],fill=(66,46,34,255),width=8)
    for _ in range(n):
        x=w/2+r.normal(0,spread); y=cy+r.normal(0,60); rr=r.integers(*rad); d.ellipse([x-rr,y-rr,x+rr,y+rr],fill=pal[r.integers(0,len(pal))]+(255,))
    I.filter(ImageFilter.GaussianBlur(.8)).save(f'{OUT}/{name}.png')
spr_blob('sprite_maple_red',[(200,40,30),(226,80,30),(160,30,28),(240,120,40)])
spr_blob('sprite_ginkgo',[(240,200,40),(250,220,80),(220,170,30)])
spr_blob('sprite_sakura',[(250,200,214),(244,170,196),(255,226,234)])
def spr_susuki():
    I=Image.new('RGBA',(256,256),(0,0,0,0)); d=ImageDraw.Draw(I); r=np.random.default_rng(5)
    for _ in range(46):
        x=r.integers(20,236); h=r.integers(120,230); t=r.integers(-30,30); d.line([x,256,x+t//2,256-h*.6,x+t,256-h],fill=(150,150,70,255),width=3)
        d.ellipse([x+t-5,256-h-8,x+t+5,256-h+26],fill=(226,214,170,255))
    I.filter(ImageFilter.GaussianBlur(.5)).save(f'{OUT}/sprite_susuki.png')
spr_susuki()
def spr_fern():
    I=Image.new('RGBA',(256,256),(0,0,0,0)); d=ImageDraw.Draw(I); r=np.random.default_rng(6)
    for k in range(16):
        a=math.pi*(.1+.8*k/15); L=r.integers(90,150)
        for t in np.linspace(.1,1,14): x=128+math.cos(a)*L*t; y=250-math.sin(a)*L*t; d.ellipse([x-10*(1.1-t),y-5,x+10*(1.1-t),y+5],fill=(50+int(60*t),130+int(40*t),50,255))
    I.save(f'{OUT}/sprite_fern.png')
spr_fern()
def spr_hydrangea():
    I=Image.new('RGBA',(256,256),(0,0,0,0)); d=ImageDraw.Draw(I); r=np.random.default_rng(7)
    for _ in range(40): x=128+r.normal(0,60); y=180+r.normal(0,36); rr=r.integers(18,30); d.ellipse([x-rr,y-rr,x+rr,y+rr],fill=(48,110,50,255))
    for _ in range(28): x=128+r.normal(0,56); y=150+r.normal(0,30); rr=r.integers(10,18); d.ellipse([x-rr,y-rr,x+rr,y+rr],fill=[(120,130,230,255),(190,120,220,255),(230,140,190,255)][r.integers(0,3)])
    I.filter(ImageFilter.GaussianBlur(.6)).save(f'{OUT}/sprite_hydrangea.png')
spr_hydrangea()
def fog():
    a=np.zeros((256,64,4)); y=np.linspace(0,1,256)[:,None]; al=np.sin(y*math.pi)**1.5*.85; a[...,:3]=np.array([.82,.86,.92]); a[...,3]=al*np.ones((1,64)); save(a,'fog_gradient','RGBA')
fog()
def palette():
    cols=[(86,130,58),(62,104,48),(110,150,66),(150,160,80),(190,120,40),(176,70,34),(120,110,100),(150,146,138),(180,176,170),(238,238,244),(70,90,120),(96,120,150),(140,160,190),(52,70,60),(30,40,36),(220,200,150)]
    a=np.zeros((4,16,3)); 
    for i,c in enumerate(cols): a[:,i]=np.array(c)/255
    save(a,'lowpoly_palette')
palette()
import os; print(len(os.listdir(OUT)),sorted(os.listdir(OUT)))
