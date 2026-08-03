from __future__ import annotations
import ctypes as C, ctypes.util, hashlib, html, pathlib, sys
ROOT=pathlib.Path(__file__).resolve().parents[5]; FONT=ROOT/'brand/artales/wordmark/font-sources/libre-baskerville/LibreBaskerville-Regular.ttf'; OUT=ROOT/'brand/artales/wordmark/candidates/option-a-outline-v0.1/artales-wordmark-option-a-outline.candidate.v0.1.svg'
EXPECTED='b93dfb2ec674ef59fd9a1b47498a8d1db498bb9e64ed22a96f8071082e3d6add'; TEXT='ARTales'; SIZE=1000
if hashlib.sha256(FONT.read_bytes()).hexdigest()!=EXPECTED: raise SystemExit('source font SHA-256 mismatch')
ft=C.CDLL(ctypes.util.find_library('freetype')); hb=C.CDLL(ctypes.util.find_library('harfbuzz'))
FT_Library=C.c_void_p; FT_Face=C.c_void_p
if ft.FT_Init_FreeType(C.byref(lib:=FT_Library())): raise SystemExit('FT_Init_FreeType failed')
if ft.FT_New_Face(lib,str(FONT).encode(),0,C.byref(face:=FT_Face())): raise SystemExit('FT_New_Face failed')
ft.FT_Set_Char_Size(face,0,SIZE*64,72,72)
# HarfBuzz uses the exact FreeType face and applies the font's OpenType shaping/kerning.
hb.hb_ft_font_create_referenced.argtypes=[FT_Face]; hb.hb_ft_font_create_referenced.restype=C.c_void_p
hb.hb_buffer_create.restype=C.c_void_p
hb.hb_buffer_add_utf8.argtypes=[C.c_void_p,C.c_char_p,C.c_int,C.c_uint,C.c_int]
hb.hb_buffer_guess_segment_properties.argtypes=[C.c_void_p]
hb.hb_shape.argtypes=[C.c_void_p,C.c_void_p,C.c_void_p,C.c_uint]
hb.hb_buffer_get_length.argtypes=[C.c_void_p]
hb.hb_buffer_get_glyph_infos.argtypes=[C.c_void_p,C.c_void_p]
hb.hb_buffer_get_glyph_positions.argtypes=[C.c_void_p,C.c_void_p]
hb.hb_buffer_destroy.argtypes=[C.c_void_p]; hb.hb_font_destroy.argtypes=[C.c_void_p]
font=hb.hb_ft_font_create_referenced(face); buf=hb.hb_buffer_create(); hb.hb_buffer_add_utf8.argtypes=[C.c_void_p,C.c_char_p,C.c_int,C.c_uint,C.c_int]
hb.hb_buffer_add_utf8(buf,TEXT.encode(),-1,0,-1); hb.hb_buffer_guess_segment_properties(buf); hb.hb_shape(font,buf,None,0)
class Info(C.Structure): _fields_=[('codepoint',C.c_uint32),('cluster',C.c_uint32),('mask',C.c_uint32),('v1',C.c_uint32),('v2',C.c_uint32)]
class Pos(C.Structure): _fields_=[('x_advance',C.c_int32),('y_advance',C.c_int32),('x_offset',C.c_int32),('y_offset',C.c_int32),('v',C.c_uint32)]
hb.hb_buffer_get_length.restype=C.c_uint; n=hb.hb_buffer_get_length(buf); hb.hb_buffer_get_glyph_infos.restype=C.POINTER(Info); hb.hb_buffer_get_glyph_positions.restype=C.POINTER(Pos)
infos=hb.hb_buffer_get_glyph_infos(buf,None); poss=hb.hb_buffer_get_glyph_positions(buf,None)
class Vec(C.Structure): _fields_=[('x',C.c_long),('y',C.c_long)]
Move=C.CFUNCTYPE(C.c_int,C.POINTER(Vec),C.c_void_p); Line=C.CFUNCTYPE(C.c_int,C.POINTER(Vec),C.c_void_p); Conic=C.CFUNCTYPE(C.c_int,C.POINTER(Vec),C.POINTER(Vec),C.c_void_p); Cubic=C.CFUNCTYPE(C.c_int,C.POINTER(Vec),C.POINTER(Vec),C.POINTER(Vec),C.c_void_p)
class Funcs(C.Structure): _fields_=[('move_to',Move),('line_to',Line),('conic_to',Conic),('cubic_to',Cubic),('shift',C.c_int),('delta',C.c_long)]
# ABI prefixes from FreeType 2: FT_FaceRec -> glyph; FT_GlyphSlotRec -> outline.
class FaceRec(C.Structure): _fields_=[('num_faces',C.c_long),('face_index',C.c_long),('face_flags',C.c_long),('style_flags',C.c_long),('num_glyphs',C.c_long),('family_name',C.c_void_p),('style_name',C.c_void_p),('num_fixed_sizes',C.c_int),('available_sizes',C.c_void_p),('num_charmaps',C.c_int),('charmaps',C.c_void_p),('generic_data',C.c_void_p),('generic_finalizer',C.c_void_p),('bbox',C.c_long*4),('units_per_EM',C.c_ushort),('ascender',C.c_short),('descender',C.c_short),('height',C.c_short),('max_advance_width',C.c_short),('max_advance_height',C.c_short),('underline_position',C.c_short),('underline_thickness',C.c_short),('glyph',C.c_void_p)]
class Outline(C.Structure): _fields_=[('n_contours',C.c_short),('n_points',C.c_short),('points',C.POINTER(Vec)),('tags',C.POINTER(C.c_ubyte)),('contours',C.POINTER(C.c_short)),('flags',C.c_int)]
class GlyphRec(C.Structure): _fields_=[('library',C.c_void_p),('clazz',C.c_void_p),('format',C.c_uint32),('advance',Vec),('outline',Outline)]
ft.FT_Get_Glyph.argtypes=[C.c_void_p,C.POINTER(C.c_void_p)]
ft.FT_Done_Glyph.argtypes=[C.c_void_p]
pen=[]; cursor_x=0
fmt=lambda v: str(int(v)) if int(v)==v else f'{v:.3f}'.rstrip('0').rstrip('.')
def point(v,ox,oy): return fmt(ox+v.contents.x/64),fmt(-(oy+v.contents.y/64))
for i in range(n):
 ox=cursor_x+poss[i].x_offset/64; oy=poss[i].y_offset/64
 @Move
 def move(p,u,ox=ox,oy=oy):
  if pen and pen[-1]!='Z': pen.append('Z')
  x,y=point(p,ox,oy); pen.extend(['M',x,y]); return 0
 @Line
 def line(p,u,ox=ox,oy=oy): x,y=point(p,ox,oy); pen.extend(['L',x,y]); return 0
 @Conic
 def conic(c,p,u,ox=ox,oy=oy): x1,y1=point(c,ox,oy); x,y=point(p,ox,oy); pen.extend(['Q',x1,y1,x,y]); return 0
 @Cubic
 def cubic(c1,c2,p,u,ox=ox,oy=oy):
  x1,y1=point(c1,ox,oy); x2,y2=point(c2,ox,oy); x,y=point(p,ox,oy); pen.extend(['C',x1,y1,x2,y2,x,y]); return 0
 if ft.FT_Load_Glyph(face,infos[i].codepoint,8): raise SystemExit('FT_Load_Glyph failed') # FT_LOAD_NO_HINTING
 slot_ptr=C.cast(face,C.POINTER(FaceRec)).contents.glyph
 glyph=C.c_void_p()
 if ft.FT_Get_Glyph(slot_ptr,C.byref(glyph)): raise SystemExit('FT_Get_Glyph failed')
 outline_glyph=C.cast(glyph,C.POINTER(GlyphRec))
 funcs=Funcs(move,line,conic,cubic,0,0)
 if ft.FT_Outline_Decompose(C.byref(outline_glyph.contents.outline),C.byref(funcs),None): raise SystemExit('decompose failed')
 ft.FT_Done_Glyph(glyph)
 if pen and pen[-1]!='Z': pen.append('Z')
 cursor_x += poss[i].x_advance/64
# Tight geometry bounds are deterministic from decomposed commands; font asc/desc establish a stable 1000-unit canvas.
width=round(cursor_x,3); d=' '.join(pen)
svg=f'''<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="-16 -840 {fmt(width + 36)} 860" role="img" aria-labelledby="title desc" fill="currentColor">\n  <title id="title">ARTales outlined wordmark candidate</title>\n  <desc id="desc">Review-only Option A ARTales wordmark outline generated from verified Libre Baskerville Regular; not a master or lockup.</desc>\n  <metadata>{{"status":"outline_candidate_review_only","approval_state":"awaiting_human_visual_review","not_master":true,"not_lockup":true,"publicIntegration":false}}</metadata>\n  <path d="{html.escape(d,quote=True)}"/>\n</svg>\n'''
OUT.write_text(svg,encoding='utf-8')
hb.hb_buffer_destroy(buf); hb.hb_font_destroy(font); ft.FT_Done_Face(face); ft.FT_Done_FreeType(lib)
print(OUT); print('glyphs',n,'advance',width)
