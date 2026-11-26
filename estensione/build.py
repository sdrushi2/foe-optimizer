"""Crea i pacchetti di FoE Optimizer Bridge per gli store in estensione/build/.

    py estensione/build.py

- store: Chrome Web Store;  amo: addons.mozilla.org (Firefox).
Hanno manifest.json nella radice dello zip, niente istruzioni.txt e niente localhost.
Il codice non viene trasformato: cambia solo il manifest.
Per provare l'estensione in sviluppo (anche con il sito su localhost) si carica
direttamente la cartella foe-bridge/ come estensione non pacchettizzata.
"""
import json
import os
import shutil
import zipfile

QUI = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(QUI, "foe-bridge")
OUT = os.path.join(QUI, "build")


def comprimi(cartella, zip_path):
    """Zip con i percorsi a '/', come vogliono gli store (anche da Windows)."""
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as z:
        for radice, _, files in os.walk(cartella):
            for nome in sorted(files):
                pieno = os.path.join(radice, nome)
                z.write(pieno, os.path.relpath(pieno, cartella).replace(os.sep, "/"))


def make(flavour, manifest):
    d = os.path.join(OUT, flavour)
    shutil.copytree(SRC, d)
    with open(os.path.join(d, "manifest.json"), "w", encoding="utf-8", newline="\n") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
    os.remove(os.path.join(d, "istruzioni.txt"))
    z = os.path.join(OUT, f"foe-optimizer-bridge-{manifest['version']}-{flavour}.zip")
    comprimi(d, z)
    shutil.rmtree(d)
    return z


def senza_localhost(m):
    m["host_permissions"] = [h for h in m["host_permissions"] if "localhost" not in h]
    for cs in m["content_scripts"]:
        cs["matches"] = [x for x in cs["matches"] if "localhost" not in x]
    return m


def main():
    shutil.rmtree(OUT, ignore_errors=True)
    os.makedirs(OUT)
    with open(os.path.join(SRC, "manifest.json"), encoding="utf-8") as f:
        m = senza_localhost(json.load(f))

    ff = json.loads(json.dumps(m))
    ff.pop("minimum_chrome_version", None)
    ff["background"] = {"scripts": ["background.js"]}
    # L'id gecko non va mai cambiato: è l'identità dell'estensione su Firefox
    ff["browser_specific_settings"] = {
        "gecko_android": {"strict_min_version": "142.0"},
        "gecko": {"id": "bridge@foe-optimizer.com", "strict_min_version": "140.0",
                  "data_collection_permissions": {"required": ["none"]}},
    }

    for z in (make("store", m), make("amo", ff)):
        print(os.path.relpath(z, QUI), f"{os.path.getsize(z) // 1024} KB")


if __name__ == "__main__":
    main()
