// ─────────────────────────────────────────────────────────────────────────────
//  functions/video/[[file]].js — Pages Function per i video tutorial (2.0)
//
//  Cloudflare Pages serve i file statici ignorando l'intestazione Range:
//  risponde sempre 200 con tutto il file e senza "Accept-Ranges", quindi nel
//  lettore video non si può saltare a un punto (verificato il 28/10/2026 su
//  foe-optimizer-v2.pages.dev). Questa funzione gira SOLO per /video/* (i
//  video stanno in public/video/): prende il file dagli asset statici e, se
//  il browser chiede un intervallo, risponde 206 con solo quei byte.
//  Il file non viene caricato in memoria: lo stream viene "tagliato" al volo
//  (si saltano i byte prima dell'inizio e ci si ferma dopo la fine).
// ─────────────────────────────────────────────────────────────────────────────

/** Taglia uno stream di byte: tiene solo [start, end] (estremi inclusi). */
function taglia(body, start, end) {
  let pos = 0;
  return body.pipeThrough(new TransformStream({
    transform(chunk, controller) {
      const da = pos, a = pos + chunk.byteLength; // chunk = [da, a)
      pos = a;
      if (a <= start || da > end) {
        if (da > end) controller.terminate();
        return;
      }
      const i = Math.max(0, start - da), j = Math.min(chunk.byteLength, end + 1 - da);
      controller.enqueue(chunk.subarray(i, j));
      if (a > end) controller.terminate();
    },
  }));
}

async function servi(context, head) {
  const { request, env } = context;
  // l'asset statico, sempre intero (senza Range)
  const asset = await env.ASSETS.fetch(new Request(request.url, { method: "GET" }));
  if (!asset.ok || !asset.body) return asset;
  const headers = new Headers(asset.headers);
  headers.set("Accept-Ranges", "bytes");
  const size = Number(asset.headers.get("Content-Length"));
  const range = request.headers.get("Range");
  if (!range || !Number.isFinite(size) || size <= 0) {
    if (head) { asset.body.cancel(); return new Response(null, { status: 200, headers }); }
    return new Response(asset.body, { status: 200, headers });
  }
  const m = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
  let start, end;
  if (m && m[1] !== "") { start = Number(m[1]); end = m[2] === "" ? size - 1 : Math.min(Number(m[2]), size - 1); }
  else if (m && m[2] !== "") { start = Math.max(0, size - Number(m[2])); end = size - 1; } // ultimi N byte
  if (!m || start === undefined || start > end || start >= size) {
    asset.body.cancel();
    return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}`, "Accept-Ranges": "bytes" } });
  }
  headers.set("Content-Range", `bytes ${start}-${end}/${size}`);
  headers.set("Content-Length", String(end - start + 1));
  if (head) { asset.body.cancel(); return new Response(null, { status: 206, headers }); }
  return new Response(taglia(asset.body, start, end), { status: 206, headers });
}

export const onRequestGet = (context) => servi(context, false);
export const onRequestHead = (context) => servi(context, true);
