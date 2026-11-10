"""
FULGOR — checagem dos vídeos renderizados.

Para cada vídeo pedido: extrai frames em 0 s, 1 s, 2 s, metade, 12,5 s (antes/depois)
e final para out/checagem/<id>/, e mede:
  - duração real (ffprobe);
  - movimento: diferença média entre dois frames seguidos em vários pontos;
  - loop: diferença entre o último e o primeiro frame, comparada com a diferença
    normal entre frames seguidos (loop bom = parecidas);
  - paleta (só vídeos "loop"): % de pixels coloridos fora do laranja da marca.

Uso (de dentro de videos/):  python -I checar.py 01-loop 03-CARROSSEL
"""
import json, subprocess, sys, colorsys
from pathlib import Path
from PIL import Image, ImageChops, ImageStat

sys.stdout.reconfigure(encoding="utf-8")   # o console do Windows não é UTF-8 por padrão

AQUI = Path(__file__).resolve().parent
OUT = AQUI / "out"
cfg = {v["id"]: v for v in json.loads((AQUI / "config.json").read_text(encoding="utf-8"))["videos"]}


def duracao(mp4):
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration:stream=width,height,r_frame_rate,pix_fmt,codec_name",
                        "-of", "json", str(mp4)], capture_output=True, text=True, check=True)
    return json.loads(r.stdout)


def frame(mp4, t, destino):
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{t:.3f}", "-i", str(mp4), "-frames:v", "1", str(destino)], check=True)
    return Image.open(destino).convert("RGB")


def diff(a, b):
    return sum(ImageStat.Stat(ImageChops.difference(a, b)).mean) / 3


def fora_da_paleta(img):
    """% de pixels com cor (saturação e brilho) cujo matiz não é laranja (0°–45°)."""
    p = img.resize((270, 480))
    fora = cor = 0
    for r, g, b in p.getdata():
        h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
        if s > .3 and v > .18:
            cor += 1
            if not (h * 360 <= 45 or h * 360 >= 350):
                fora += 1
    return 100 * fora / (270 * 480), 100 * cor / (270 * 480)


for vid in sys.argv[1:]:
    v = cfg[vid]
    mp4 = OUT / f"{vid}.mp4"
    info = duracao(mp4)
    d = float(info["format"]["duration"])
    s = info["streams"][0]
    pasta = OUT / "checagem" / vid
    pasta.mkdir(parents=True, exist_ok=True)
    fps = 30
    ultimo = d - 1.6 / fps        # o último frame inteiro (buscar em d - 1/fps cai fora do vídeo)
    tempos = {"0s": 0, "1s": 1, "2s": 2, "metade": d / 2, "final": ultimo}
    if v["tipo"] == "antes-depois":
        tempos["12.5s"] = 12.5
    print(f"\n== {vid}: {d:.2f}s · {s['width']}x{s['height']} · {s['r_frame_rate']} · {s['pix_fmt']} · {s['codec_name']}")
    imgs = {}
    for nome, t in tempos.items():
        imgs[nome] = frame(mp4, t, pasta / f"{nome}.png")
    # movimento: frames seguidos em vários pontos
    for t in (1, d / 2, ultimo - 1 / fps):
        a = frame(mp4, t, pasta / "_a.png")
        b = frame(mp4, t + 1 / fps, pasta / "_b.png")
        print(f"  movimento em {t:5.2f}s: {diff(a, b):.2f}")
    if v["tipo"] == "loop":
        seguidos = diff(frame(mp4, 0, pasta / "_a.png"), frame(mp4, 1 / fps, pasta / "_b.png"))
        print(f"  loop: último→primeiro {diff(imgs['final'], imgs['0s']):.2f}  (frames seguidos: {seguidos:.2f})")
    if v["tipo"] in ("loop", "manifesto"):          # os vídeos de marca: só preto, laranja e branco
        for nome, img in imgs.items():
            f, c = fora_da_paleta(img)
            print(f"  paleta {nome:>6}: {f:.3f}% fora do laranja ({c:.1f}% da tela tem cor)")
    for x in ("_a.png", "_b.png"):
        (pasta / x).unlink(missing_ok=True)
    print(f"  frames em {pasta}")
