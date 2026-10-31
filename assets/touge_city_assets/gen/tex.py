import numpy as np, os, math
from PIL import Image, ImageDraw, ImageFont, ImageFilter
OUT='../textures'
rng=np.random.default_rng(7)
def noise(w,h,scale,seed=0):
    r=np.random.default_rng(seed); a=r.standard_normal((h,w))
    ky=np.fft.fftfreq(h)[:,None]; kx=np.fft.fftfreq(w)[None,:]
    f=np.exp(-((kx**2+ky**2)*(scale**2)))
    b=np.real(np.fft.ifft2(np.fft.fft2(a)*f)); b=(b-b.min())/(b.max()-b.min()); return b
def fbm(w,h,base=40,oct=4,seed=0):
    t=0;amp=1;s=0
    for i in range(oct): t=t+amp*noise(w,h,base/(2**i),seed+i); s+=amp; amp*=.5
    return t/s
def save(arr,name,mode='RGB'):
    arr=np.clip(arr,0,1); a=(arr*255).astype('uint8'); Image.fromarray(a,mode).save(f'{OUT}/{name}.png')
def rgb(r,g,b): return np.array([r,g,b],float)/255
def colorize(n,c0,c1): return n[...,None]*(rgb(*c1)-rgb(*c0))+rgb(*c0)
S=512
def asphalt(w=S,h=S,seed=1):
    n=fbm(w,h,60,5,seed); sp=noise(w,h,1.2,seed+9)
    img=colorize(n,(52,54,58),(86,88,92))
    img+=((sp-.5)*.12)[...,None]
    pe=rng.random((h,w))>.996; img[pe]+=.18
    return img
save(asphalt(),'asphalt')
def road(kind):
    img=asphalt(S,S,3); im=(np.clip(img,0,1)*255).astype('uint8'); I=Image.fromarray(im); d=ImageDraw.Draw(I)
    W=(236,236,228)
    if kind=='mountain':
        d.rectangle([22,0,30,S],fill=W); d.rectangle([482,0,490,S],fill=W)
        for y in range(0,S,128): d.rectangle([252,y,260,y+64],fill=W)
    elif kind=='city':
        d.rectangle([14,0,22,S],fill=W); d.rectangle([490,0,498,S],fill=W)
        for y in range(0,S,128): d.rectangle([164,y,170,y+64],fill=W); d.rectangle([342,y,348,y+64],fill=W)
        d.rectangle([250,0,254,S],fill=(232,190,40)); d.rectangle([258,0,262,S],fill=(232,190,40))
    a=np.array(I).astype(float)/255
    wear=fbm(S,S,25,4,11); a=a*(0.78+0.22*wear[...,None])+ (noise(S,S,2,5)[...,None]-.5)*.05
    # tyre marks
    for cx in ((120,150) if kind=='mountain' else (90,120)):
        pass
    return a
save(road('mountain'),'road_mountain'); save(road('city'),'road_city')
# crosswalk
a=asphalt(S,S,4); 
I=Image.fromarray((np.clip(a,0,1)*255).astype('uint8')); d=ImageDraw.Draw(I)
for x in range(16,S,64): d.rectangle([x,0,x+34,S],fill=(232,232,226))
a=np.array(I)/255*(0.8+0.2*fbm(S,S,20,3,2)[...,None]); save(a,'crosswalk')
# concrete stone wall (ishigaki)
def stonewall():
    I=Image.new('RGB',(S,S),(90,90,86)); d=ImageDraw.Draw(I); r=np.random.default_rng(3)
    y=0
    while y<S:
        h=int(r.integers(52,76)); h=min(h,S-y) if S-y<76 else h
        if S-y<52: h=S-y
        x=-int(r.integers(0,60))
        while x<S:
            w=int(r.integers(70,130)); w2=min(w,S-x) if x+w>S else w
            c=int(r.integers(96,142)); tone=(c,c-3,c-8)
            d.rounded_rectangle([x+3,y+3,x+w-3,y+h-3],radius=8,fill=tone)
            x+=w
        y+=h
    # wrap seams: simple approach -> blend with offset copy
    a=np.array(I).astype(float)/255
    a*= (0.82+0.3*fbm(S,S,30,5,5)[...,None]); 
    moss=np.clip((fbm(S,S,14,4,8)-.58)*4,0,1)[...,None]*np.array([.1,.22,.05])
    a=a*(1-moss*1.2)+moss
    return a
save(stonewall(),'concrete_wall')
def rock():
    n=fbm(S,S,90,2,20); strata=np.sin((np.arange(S)[:,None]/S*18+n*6)*math.pi)*.5+.5
    m=fbm(S,S,10,5,22)
    a=colorize(0.55*m+0.25*strata,(46,40,36),(140,126,110))
    crack=np.clip(1-np.abs(noise(S,S,6,30)-.5)*40,0,1)
    a*= (1-crack[...,None]*.5); return a
save(rock(),'rock_cliff')
def grass():
    n=fbm(S,S,40,5,40); a=colorize(n,(34,64,24),(96,140,52))
    blades=np.zeros((S,S)); r=np.random.default_rng(9)
    for _ in range(9000):
        x=r.integers(0,S);y=r.integers(0,S);l=r.integers(3,9); blades[y:y+l,x]=1; 
    blades=np.array(Image.fromarray((blades*255).astype('uint8')).filter(ImageFilter.GaussianBlur(.6)))/255
    a=a*(1-.15*blades[...,None])+blades[...,None]*.08; return a
save(grass(),'grass')
def gravel():
    n=fbm(S,S,8,3,50); s=noise(S,S,.8,51); a=colorize(.6*n+.4*s,(88,80,70),(170,160,146)); return a
save(gravel(),'gravel')
def dirt():
    n=fbm(S,S,50,5,60); return colorize(n,(70,52,36),(130,104,76))
save(dirt(),'dirt')
# guardrail (galvanized corrugated)
def guardrail():
    w,h=512,128; I=np.zeros((h,w,3))
    y=np.arange(h)[:,None]/h; prof=np.sin(y*math.pi*2*1.5+.4)*.5+.5
    base=.62+.22*prof; I[:]=base[...,None]*np.array([.92,.95,1.0])
    I+= (fbm(w,h,20,3,70)[...,None]-.5)*.1
    for x in range(40,w,128): I[48:80,x:x+22]=np.array([1,.6,.1]) if False else I[48:80,x:x+22]*.7
    return I
save(guardrail(),'guardrail_metal')
def tunnel():
    w,h=S,S; a=np.ones((h,w,3))*np.array([.78,.78,.74])
    a*= (0.9+.1*fbm(w,h,30,4,80)[...,None])
    for x in range(0,w,128): a[:,x:x+3]*=.55
    a[h*3//4:h*3//4+18]=np.array([.95,.55,.12]); a[h*3//4+18:]*=.82
    a[:h//8]*=.75
    return a
save(tunnel(),'tunnel_wall')
# facades
def facade(kind,night):
    I=Image.new('RGB',(S,S)); d=ImageDraw.Draw(I); r=np.random.default_rng(100+len(kind)+night)
    if kind=='office':
        d.rectangle([0,0,S,S],fill=(120,124,130)); cols,rows=8,16
        cw,rh=S//cols,S//rows
        for j in range(rows):
            for i in range(cols):
                lit=night and r.random()<.45
                c=(255,224,150) if lit else ((38,52,74) if night else (110,150,190)); 
                d.rectangle([i*cw+4,j*rh+5,(i+1)*cw-4,(j+1)*rh-5],fill=c)
        for j in range(rows): d.line([0,j*rh,S,j*rh],fill=(90,94,100),width=2)
    elif kind=='apartment':
        d.rectangle([0,0,S,S],fill=(206,196,176)); cols,rows=4,8; cw,rh=S//cols,S//rows
        for j in range(rows):
            for i in range(cols):
                lit=night and r.random()<.5
                x0=i*cw+18;y0=j*rh+14
                d.rectangle([x0,y0,x0+cw-60,y0+rh-52],fill=(255,222,140) if lit else ((34,44,60) if night else (96,126,150)))
                d.rectangle([i*cw+10,j*rh+rh-28,(i+1)*cw-10,j*rh+rh-14],fill=(150,146,136))
                d.line([i*cw+10,j*rh+rh-28,(i+1)*cw-10,j*rh+rh-28],fill=(90,88,80),width=3)
    else: # shop
        d.rectangle([0,0,S,S],fill=(176,150,120))
        d.rectangle([0,0,S,150],fill=(86,70,60))
        for i in range(4):
            lit=night and r.random()<.7
            d.rectangle([20+i*122,34,120+i*122,120],fill=(255,222,140) if lit else ((34,44,60) if night else (96,126,150)))
        d.rectangle([0,170,S,200],fill=(200,40,40)); d.rectangle([0,400,S,S],fill=(110,110,112))
        for x in range(0,S,16): d.line([x,400,x,S],fill=(90,90,92),width=2)
        d.rectangle([40,210,470,390],fill=(255,236,170) if night else (150,170,180))
    a=np.array(I).astype(float)/255*(0.9+0.1*fbm(S,S,25,4,120)[...,None]); return a
for k in ('office','apartment','shop'):
    save(facade(k,0),f'facade_{k}'); save(facade(k,1),f'facade_{k}_night')
# signs
F='/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
def font(sz):
    try: return ImageFont.truetype(F,sz)
    except Exception: return ImageFont.load_default()
def chevron():
    I=Image.new('RGB',(512,256),(20,20,24)); d=ImageDraw.Draw(I)
    for i in range(2):
        x=90+i*170
        d.polygon([(x,30),(x+90,128),(x,226),(x+50,226),(x+140,128),(x+50,30)],fill=(250,214,40))
    d.rectangle([4,4,508,252],outline=(250,250,250),width=8); return np.array(I)/255
save(chevron(),'sign_chevron')
def curve_warn():
    I=Image.new('RGBA',(256,256),(0,0,0,0)); d=ImageDraw.Draw(I)
    d.polygon([(128,8),(248,128),(128,248),(8,128)],fill=(250,214,40,255),outline=(20,20,24,255)); d.line([128,8,248,128,128,248,8,128,128,8],fill=(20,20,24,255),width=8)
    d.line([96,210,100,150,130,120,160,90,160,54],fill=(20,20,24,255),width=14,joint='curve')
    d.polygon([(160,36),(140,64),(180,64)],fill=(20,20,24,255)); I.save(f'{OUT}/sign_curve_warning.png')
curve_warn()
def speed(n):
    I=Image.new('RGBA',(256,256),(0,0,0,0)); d=ImageDraw.Draw(I)
    d.ellipse([6,6,250,250],fill=(210,30,36,255)); d.ellipse([34,34,222,222],fill=(250,250,250,255))
    f=font(96); tw=d.textlength(str(n),font=f); d.text((128-tw/2,76),str(n),font=f,fill=(20,20,24,255)); I.save(f'{OUT}/sign_speed_{n}.png')
speed(40); speed(60)
def neon():
    I=Image.new('RGBA',(1024,512),(8,8,14,255)); words=[('RAMEN',(255,60,80)),('BAR',(70,200,255)),('HOTEL',(255,120,230)),('GAME',(120,255,140))]
    glow=Image.new('RGBA',I.size,(0,0,0,0)); d=ImageDraw.Draw(glow); 
    for k,(t,c) in enumerate(words):
        x=(k%2)*512; y=(k//2)*256; f=font(110); tw=d.textlength(t,font=f); d.text((x+256-tw/2,y+70),t,font=f,fill=c+(255,))
    g2=glow.filter(ImageFilter.GaussianBlur(10)); I=Image.alpha_composite(I,g2); I=Image.alpha_composite(I,g2); I=Image.alpha_composite(I,glow); I.save(f'{OUT}/neon_signs.png')
neon()
def billboard():
    I=Image.new('RGB',(512,256),(240,240,244)); d=ImageDraw.Draw(I)
    d.polygon([(0,0),(200,0),(120,256),(0,256)],fill=(30,70,200)); d.polygon([(200,0),(260,0),(180,256),(120,256)],fill=(230,30,40))
    d.text((270,100),'SPEED',font=font(52),fill=(20,20,24)); d.rectangle([2,2,509,253],outline=(60,60,66),width=6); I.save(f'{OUT}/billboard_generic.png')
billboard()
# sprites
def tex_tree(kind):
    W,H=256,512; I=Image.new('RGBA',(W,H),(0,0,0,0)); d=ImageDraw.Draw(I); r=np.random.default_rng(5)
    d.rectangle([W//2-12,H-170,W//2+12,H],fill=(70,48,34))
    if kind=='cedar':
        for k in range(6):
            y=H-150-k*55; w=120-k*16
            d.polygon([(W//2,y-90),(W//2-w,y+30),(W//2+w,y+30)],fill=(22+k*4,70+k*6,40+k*3,255))
    else:
        pal={'autumn':[(214,92,28),(232,140,36),(180,50,26),(240,180,60)],'pine':[(30,84,44),(40,104,56),(24,66,38)],'green':[(60,120,44),(80,150,56),(44,98,36)]}[kind]
        for _ in range(60):
            x=W//2+r.normal(0,48); y=170+r.normal(0,70) if kind!='pine' else 150+r.normal(0,70); rad=r.integers(24,46)
            d.ellipse([x-rad,y-rad,x+rad,y+rad],fill=pal[r.integers(0,len(pal))]+(255,))
    I=I.filter(ImageFilter.GaussianBlur(.8)); I.save(f'{OUT}/sprite_tree_{kind}.png')
for k in ('cedar','autumn','pine','green'): tex_tree(k)
# mountains layers (tileable horizontally)
def mountain(name,col,amp,freq,seed):
    W,H=1024,256; x=np.arange(W)/W*2*math.pi; r=np.random.default_rng(seed)
    y=np.zeros(W)
    for k in range(1,8): y+=r.random()/k**1.1*np.sin(k*freq*x+r.random()*6.28)
    y=(y-y.min())/(y.max()-y.min()); top=(H-30-y*amp).astype(int)
    a=np.zeros((H,W,4)); 
    for i in range(W): 
        a[top[i]:,i,:3]=np.array(col)/255; a[top[i]:,i,3]=1
    g=np.linspace(1,.78,H)[:,None]; a[...,:3]*=g[...,None]; 
    I=Image.fromarray((a*255).astype('uint8'),'RGBA').filter(ImageFilter.GaussianBlur(.7)); I.save(f'{OUT}/{name}.png')
mountain('mountains_far',(120,142,172),150,1,1); mountain('mountains_mid',(78,104,98),130,2,2); mountain('mountains_near',(38,66,52),110,3,3)
def sky(kind):
    W,H=1024,512; y=np.linspace(0,1,H)[:,None]*np.ones((1,W))
    if kind=='day': top,hor=rgb(60,120,220),rgb(200,225,245)
    elif kind=='sunset': top,hor=rgb(40,50,110),rgb(255,150,70)
    else: top,hor=rgb(4,6,24),rgb(34,40,86)
    a=top+(hor-top)*(y**1.4)[...,None]
    c=fbm(W,H,200,4,9); cl=np.clip((c-.5)*3,0,1)*(1-y)**.6
    cc={'day':rgb(255,255,255),'sunset':rgb(255,190,140),'night':rgb(60,66,100)}[kind]
    a=a*(1-cl[...,None]*.8)+cc*cl[...,None]*.8
    if kind=='night':
        r=np.random.default_rng(4)
        for _ in range(350):
            xx=r.integers(0,W);yy=int(r.integers(0,H*.7)); a[yy,xx]=1
        yy,xx=np.mgrid[0:H,0:W]; m=np.exp(-(((xx-760)**2+(yy-120)**2)/(2*40**2))); a+= m[...,None]*np.array([.5,.5,.45])
    save(a,f'sky_{kind}')
for k in ('day','sunset','night'): sky(k)
def skyline():
    W,H=1024,256; I=Image.new('RGBA',(W,H),(0,0,0,0)); d=ImageDraw.Draw(I); r=np.random.default_rng(12); x=0
    while x<W:
        w=int(r.integers(30,80)); h=int(r.integers(60,210)); d.rectangle([x,H-h,x+w,H],fill=(14,16,28,255))
        for yy in range(H-h+8,H-6,12):
            for xx in range(x+5,x+w-6,10):
                if r.random()<.4: d.rectangle([xx,yy,xx+4,yy+5],fill=(255,222,140,255))
        x+=w
    I.save(f'{OUT}/skyline_night.png')
skyline()
print(sorted(os.listdir(OUT)))
