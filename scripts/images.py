#!/usr/bin/env python3
"""Optimise les photos des œuvres : WebP responsive + JPEG de partage (Open Graph).

Usage : python3 scripts/images.py <jobs.json> <manifest.json>
jobs.json : [{"src": "assets-src/media/image1.jpg", "out": "dist/img/oeuvres/slug-1", "og": true}, ...]
Le manifeste renvoie largeur/hauteur et variantes produites, pour des balises <img> sans décalage de mise en page.
"""
import hashlib
import json
import os
import sys

from PIL import Image, ImageOps

WIDTHS = [480, 900, 1500]
OG_SIZE = (1200, 630)


def sha1(path):
    h = hashlib.sha1()
    with open(path, "rb") as f:
        h.update(f.read())
    return h.hexdigest()


def process(job, manifest, sigs):
    """Produit les variantes d'une photo. Le cache repose sur l'empreinte du fichier source
    (et non sur sa date), pour rester valable après un clonage du dépôt sur Netlify."""
    src, out = job["src"], job["out"]
    key = os.path.basename(out)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    digest = sha1(src)
    cached = sigs.get(key)
    if cached and cached["sha1"] == digest and all(
        os.path.exists(os.path.join(os.path.dirname(out), v["file"])) for v in cached["variants"]
    ) and (not job.get("og") or os.path.exists(f"{out}-og.jpg")) and (
        not job.get("thumb") or os.path.exists(job["thumb"])
    ):
        manifest[key] = {k: cached[k] for k in ("w", "h", "variants")}
        return False
    im = ImageOps.exif_transpose(Image.open(src)).convert("RGB")
    w0, h0 = im.size
    variants = []
    for i, w in enumerate(WIDTHS):
        if i > 0 and WIDTHS[i - 1] >= w0:
            break  # pas d'agrandissement : la variante précédente couvre déjà l'original
        tw = min(w, w0)
        th = round(h0 * tw / w0)
        path = f"{out}-{w}.webp"
        variants.append({"w": tw, "h": th, "file": os.path.basename(path)})
        im.resize((tw, th), Image.LANCZOS).save(path, "WEBP", quality=80, method=6)
    if job.get("og"):
        canvas = Image.new("RGB", OG_SIZE, (0, 0, 0))
        fit = im.copy()
        fit.thumbnail((OG_SIZE[0], OG_SIZE[1] - 30), Image.LANCZOS)
        canvas.paste(fit, ((OG_SIZE[0] - fit.width) // 2, (OG_SIZE[1] - fit.height) // 2))
        canvas.save(f"{out}-og.jpg", "JPEG", quality=84, optimize=True, progressive=True)
    if job.get("thumb"):
        # vignette légère au nom d'origine : sert d'aperçu dans l'administration (/media/…)
        os.makedirs(os.path.dirname(job["thumb"]), exist_ok=True)
        th = im.copy()
        th.thumbnail((400, 500), Image.LANCZOS)
        if job["thumb"].lower().endswith(".png"):
            th.save(job["thumb"], "PNG", optimize=True)
        else:
            th.save(job["thumb"], "JPEG", quality=80, optimize=True)
    manifest[key] = {"w": w0, "h": h0, "variants": variants}
    sigs[key] = {"sha1": digest, **manifest[key]}
    return True


def main():
    jobs = json.load(open(sys.argv[1], encoding="utf-8"))
    manifest = {}
    sig_path = os.path.join(os.path.dirname(jobs[0]["out"]), "_sources.json") if jobs else None
    sigs = json.load(open(sig_path, encoding="utf-8")) if sig_path and os.path.exists(sig_path) else {}
    done = sum(process(job, manifest, sigs) for job in jobs)
    if sig_path:
        json.dump(sigs, open(sig_path, "w", encoding="utf-8"))
    json.dump(manifest, open(sys.argv[2], "w", encoding="utf-8"))
    print(f"images : {len(jobs)} sources, {done} (re)générées")


if __name__ == "__main__":
    main()
