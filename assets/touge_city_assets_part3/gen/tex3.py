import numpy as np
from PIL import Image, ImageDraw, ImageFont
OUT='../textures'; F='/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
def font(s):
    try: return ImageFont.truetype(F,s)
    except Exception: return ImageFont.load_default()
def centered(d,txt,cx,cy,f,fill):
    w=d.textlength(txt,font=f); d.text((cx-w/2,cy-f.size*.6),txt,font=f,fill=fill)
I=Image.new('RGB',(512,128),(250,250,250)); d=ImageDraw.Draw(I)
for i in range(0,512,32):
    for j in range(0,128,32):
        if (i//32+j//32)%2==0: d.rectangle([i,j,i+31,j+31],fill=(20,20,20))
I.save(f'{OUT}/banner_checker.png')
I=Image.new('RGB',(512,128),(230,40,50)); d=ImageDraw.Draw(I); d.polygon([(0,0),(150,0),(90,128),(0,128)],fill=(250,250,250)); d.polygon([(150,0),(210,0),(150,128),(90,128)],fill=(30,70,200)); centered(d,'TOUGE CUP',350,64,font(54),(255,255,255)); d.rectangle([0,0,511,127],outline=(20,20,24),width=6); I.save(f'{OUT}/banner_stripes.png')
I=Image.new('RGB',(256,256),(250,250,250)); d=ImageDraw.Draw(I)
for i in range(0,256,32):
    for j in range(0,256,32):
        if (i//32+j//32)%2==0: d.rectangle([i,j,i+31,j+31],fill=(15,15,15))
I.save(f'{OUT}/flag_checker.png')
I=Image.new('RGB',(512,256),(20,90,170)); d=ImageDraw.Draw(I); d.rectangle([6,6,505,249],outline=(255,255,255),width=8)
d.polygon([(70,128),(150,70),(150,108),(260,108),(260,148),(150,148),(150,186)],fill=(255,255,255)); centered(d,'TOUGE',380,100,font(60),(255,255,255)); centered(d,'12 km',380,170,font(46),(255,255,255)); I.save(f'{OUT}/sign_blue_direction.png')
I=Image.new('RGB',(512,128),(250,250,250)); d=ImageDraw.Draw(I); d.rectangle([0,0,511,34],fill=(30,150,70)); d.rectangle([0,34,511,56],fill=(238,120,30)); d.rectangle([0,56,511,70],fill=(30,150,70)); centered(d,'MINI MART',256,100,font(46),(30,100,50)); I.save(f'{OUT}/konbini_sign.png')
I=Image.new('RGB',(256,128),(170,24,28)); d=ImageDraw.Draw(I)
for x in (64,128,192): d.line([x,0,x,128],fill=(120,16,20),width=3)
centered(d,'RAMEN',128,64,font(44),(250,240,230)); d.rectangle([0,118,255,127],fill=(40,20,20)); I.save(f'{OUT}/noren_red.png')
print('ok')
