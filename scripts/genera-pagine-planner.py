# Genera public/planner.html (EN) e public/planner-it.html (IT), le pagine
# statiche di presentazione del Planner (SEO). Stile preso da public/guide.html.
# Uso: python scripts/genera-pagine-planner.py  (dalla cartella del progetto)
import json, os, re
APP=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
g=open(APP+'/public/guide.html',encoding='utf-8').read()
style=g[g.index('<style>')+7:g.index('</style>')]
style+='''
      /* ── Pagina Planner ─────────────────────────────────────── */
      .cta-row { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 22px; }
      .cta {
        display: inline-block; text-decoration: none; font-weight: 800;
        background: var(--amber); color: #1a1a2e; padding: 12px 22px;
        border-radius: 10px; font-size: 1.02rem;
      }
      .cta:hover { background: #fcd34d; }
      .cta-2 {
        display: inline-block; text-decoration: none; font-weight: 700;
        border: 1px solid var(--border); color: var(--text); padding: 12px 18px;
        border-radius: 10px; font-size: 0.98rem;
      }
      .cta-2:hover { border-color: var(--amber-dim); color: var(--amber); }
      .badges { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 18px; }
      video { width: 100%; border-radius: 12px; border: 1px solid var(--border); background: #000; }
      .faq h3 { margin-top: 22px; }
      .ba { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin: 18px 0 8px; }
      .ba figure { margin: 0; }
      .ba img { width: 100%; height: auto; display: block; border-radius: 10px; border: 1px solid var(--border); }
      .ba a:hover img { border-color: var(--amber-dim); }
      .ba figcaption { text-align: center; font-size: 0.9rem; color: var(--text-dim); margin-top: 6px; }
      .ba figcaption strong { color: var(--amber); }
      .ba-title { font-weight: 700; color: var(--text); margin: 26px 0 0; }
      @media (max-width: 640px) { .ba { grid-template-columns: 1fr; } }
'''
GITHUB='https://github.com/sdrushi2/foe-optimizer'

def pagina(L):
    url=f"https://foe-optimizer.com/{L['file']}"
    faq_ld={"@type":"FAQPage","@id":url+"#faq","mainEntity":[{"@type":"Question","name":q,"acceptedAnswer":{"@type":"Answer","text":re.sub(r'<[^>]+>','',a)}} for q,a in L['faq']]}
    ld={"@context":"https://schema.org","@graph":[
      {"@type":"WebPage","@id":url,"url":url,"name":L['title'],"description":L['desc'],"inLanguage":L['lang'],
       "isPartOf":{"@type":"WebSite","name":"FoE Optimizer","url":"https://foe-optimizer.com/"},
       "about":{"@id":"https://foe-optimizer.com/#planner"},
       "image":[f"https://foe-optimizer.com/planner-{x}.jpg" for x in ("dopo-1","prima-1","dopo-2","prima-2")],
       "breadcrumb":{"@type":"BreadcrumbList","itemListElement":[
         {"@type":"ListItem","position":1,"name":"FoE Optimizer","item":"https://foe-optimizer.com/"},
         {"@type":"ListItem","position":2,"name":L['crumb'],"item":url}]}},
      {"@type":"WebApplication","@id":"https://foe-optimizer.com/#planner","name":L['appname'],
       "url":"https://foe-optimizer.com/","applicationCategory":"GameApplication","operatingSystem":"Web",
       "isAccessibleForFree":True,"offers":{"@type":"Offer","price":"0","priceCurrency":"EUR"},
       "description":L['appdesc'],"featureList":L['features_ld'],"inLanguage":["en","it"],
       "creator":{"@type":"Person","name":"Sdrushi"}},
      {"@type":"VideoObject","name":L['video_name'],"description":L['video_desc'],
       "thumbnailUrl":"https://foe-optimizer.com/planner-ita.jpg","contentUrl":"https://foe-optimizer.com/video/planner-ita.mp4",
       "uploadDate":"2026-10-28","inLanguage":"it"},
      faq_ld]}
    feats=''.join(f'''
          <div class="tabcard">
            <span class="emoji">{e}</span>
            <h4>{h}</h4>
            <p>{p}</p>
          </div>''' for e,h,p in L['features'])
    steps=''.join(f'''
          <li>
            <h4>{h}</h4>
            <p>{p}</p>
          </li>''' for h,p in L['steps'])
    faq=''.join(f'''
        <h3>{q}</h3>
        <p>{a}</p>''' for q,a in L['faq'])
    ba=''
    for k,(titolo,prima,dopo) in enumerate(L['ba'],1):
        ba+=f'''
        <p class="ba-title">{titolo}</p>
        <div class="ba">
          <figure>
            <a href="/planner-prima-{k}.png" target="_blank" rel="noopener"><img src="/planner-prima-{k}.jpg" alt="{L['alt_prima']} {k}" width="1000" height="{1056 if k==1 else 824}" loading="lazy"></a>
            <figcaption>{prima}</figcaption>
          </figure>
          <figure>
            <a href="/planner-dopo-{k}.png" target="_blank" rel="noopener"><img src="/planner-dopo-{k}.jpg" alt="{L['alt_dopo']} {k}" width="1000" height="{1056 if k==1 else 824}" loading="lazy"></a>
            <figcaption>{dopo}</figcaption>
          </figure>
        </div>'''
    pills=''.join(f'<span class="pill">{p}</span>' for p in L['pills'])
    altro=L['other']
    return f'''<!doctype html>
<html lang="{L['lang']}">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{L['title']}</title>
    <meta name="description" content="{L['desc']}">
    <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">
    <meta name="theme-color" content="#1a1a2e">
    <meta name="color-scheme" content="dark light">
    <link rel="icon" type="image/png" sizes="32x32" href="/favicon.png">
    <link rel="canonical" href="{url}">
    <link rel="alternate" hreflang="en" href="https://foe-optimizer.com/planner.html">
    <link rel="alternate" hreflang="it" href="https://foe-optimizer.com/planner-it.html">
    <link rel="alternate" hreflang="x-default" href="https://foe-optimizer.com/planner.html">

    <meta property="og:title" content="{L['title']}">
    <meta property="og:description" content="{L['desc']}">
    <meta property="og:url" content="{url}">
    <meta property="og:type" content="website">
    <meta property="og:locale" content="{L['locale']}">
    <meta property="og:site_name" content="FoE Optimizer">
    <meta property="og:image" content="https://foe-optimizer.com/og-image.png">
    <meta name="twitter:card" content="summary_large_image">

    <!-- Dati strutturati: pagina, app (planner), video tutorial, domande frequenti -->
    <script type="application/ld+json">
{json.dumps(ld,ensure_ascii=False,indent=2)}
    </script>

    <style>{style}</style>
  </head>
  <body>
    <div class="wrap">

      <div class="top">
        <a class="brand" href="/">
          <span class="swords">⚔️</span>
          FOE OPTIMIZER
        </a>
        <div class="top-actions">
          {L['langsw']}
          <a class="back-link" href="/">{L['back']}</a>
        </div>
      </div>

      <div class="hero">
        <h1>{L['h1']}</h1>
        <p>{L['lede']}</p>
        <div class="badges">{pills}</div>
        <div class="cta-row">
          <a class="cta" href="/">{L['cta']}</a>
          <a class="cta-2" href="{L['guide']}#importing">{L['cta2']}</a>
        </div>
      </div>

      <section id="before-after">
        <h2>{L['ba_h']}</h2>
        <p class="lede">{L['ba_lede']}</p>{ba}
      </section>

      <section id="why">
        <h2>{L['why_h']}</h2>
        <p class="lede">{L['why_lede']}</p>
        <div class="tabgrid">{feats}
        </div>
      </section>

      <section id="how">
        <h2>{L['how_h']}</h2>
        <ol class="steps">{steps}
        </ol>
        <div class="callout">{L['how_note']}</div>
      </section>

      <section id="video">
        <h2>{L['video_h']}</h2>
        <p class="lede">{L['video_lede']}</p>
        <video controls preload="none" poster="/planner-ita.jpg" width="1920" height="1080">
          <source src="/video/planner-ita.mp4" type="video/mp4">
        </video>
      </section>

      <section id="faq" class="faq">
        <h2>{L['faq_h']}</h2>{faq}
      </section>

      <div class="card card-amber">
        <p style="margin:0">{L['final']}</p>
        <div class="cta-row"><a class="cta" href="/">{L['cta']}</a></div>
      </div>

      <footer>
        <p><a href="/">{L['foot_back']}</a> · <a href="{L['guide']}">{L['foot_guide']}</a> · <a href="{altro}">{L['foot_other']}</a></p>
        <p>{L['foot_tm']}</p>
      </footer>

    </div>
  </body>
</html>
'''

EN=dict(file='planner.html',lang='en',locale='en_US',crumb='City Planner',
 title='Forge of Empires City Planner – Free Automatic Layout | FoE Optimizer',
 desc='Free Forge of Empires city planner: import your city and it automatically rearranges your buildings with as few roads as possible. Two-lane roads, chains, no sign-up.',
 appname='FoE Optimizer City Planner',
 appdesc='Free automatic city planner for Forge of Empires: rearranges the buildings of an imported city looking for the layout with the fewest roads.',
 features_ld=['Automatic city layout with the fewest roads','Several scenarios searched in parallel','Two-lane road support','Building chains kept together','Optional connection of military buildings','Built-in city editor','PNG and JSON export','Runs in the browser, no sign-up'],
 video_name='How to use the FoE Optimizer City Planner (Italian)',video_desc='Video tutorial of the Forge of Empires city planner in FoE Optimizer.',
 langsw='<span class="lang-switch active">🇬🇧 English</span>\n          <span class="lang-sep">/</span>\n          <a class="lang-switch" href="/planner-it.html">🇮🇹 Italiano</a>',
 back='Open the tool →',
 h1='Forge of Empires City Planner',
 lede='A free, automatic city planner for Forge of Empires. Import your city and the Planner rearranges your buildings from scratch, looking for the layout with the fewest roads, so more of your city is left for buildings.',
 pills=['100% free','No sign-up','Runs in your browser','English &amp; Italian'],
 cta='Open the Planner →',cta2='How to import your city',guide='/guide.html',
 why_h='🗺️ Why use it',why_lede='Roads produce nothing. Every road tile you save is space for another building.',
 features=[
  ('🛣️','Fewer roads','The Planner searches for the arrangement that connects every building with as few road tiles as possible, and shows you how many you save.'),
  ('⚡','Several layouts at once','It explores several scenarios in parallel (Connector 3, 4 and 5, Pinwheel, Pinwheel 2 and your Current layout), each with its own map and stats.'),
  ('🚗','Two-lane roads','Buildings that need two-lane roads are connected to 2×2 roads.'),
  ('🔗','Chains kept together','Statue of Honor and Victory Roads, trains, Hippodrome: each chain stays together as one block.'),
  ('⚔️','Smart about military buildings','With Alcatraz or the Star Warship, military buildings don\'t need a road: you choose which ones to connect anyway.'),
  ('✏️','Edit before and after','Remove buildings or add new ones from your inventory or the database before optimizing; fine-tune the result in the built-in editor.'),
  ('⬇️','PNG and JSON export','Download the solution as an image to follow while you rebuild, or as a JSON file to share.'),
  ('🔒','Private','Everything runs in your browser: no account, no server, your city stays on your computer.'),
 ],
 how_h='🧭 How it works',
 steps=[
  ('Import your city','With the FoE Optimizer bookmark and FoE Helper or Forge Hammer, or by loading a JSON file (FoE Optimizer, FoE Helper or Forge Hammer export).'),
  ('Optimize','Open the Planner tab and press Optimize: the search starts on every scenario and improves as it goes.'),
  ('Pause and smooth','When the numbers stop improving, pause. Smooth (optional) reduces corners and gaps so small buildings fit better.'),
  ('Complete','The Planner places the buildings that don\'t need a road and finishes every map.'),
  ('Rebuild in the game','Pick the layout you like, adjust it in the editor if needed, download the PNG and rearrange your city in Forge of Empires.'),
 ],
 how_note='<strong>Tip:</strong> MIN / MED / MAX choose how much of your computer\'s power the Planner uses. The full step-by-step explanation is in the <a href="/guide.html#tab-planner">guide</a>.',
 video_h='🎬 Video tutorial',video_lede='The Planner explained step by step (video in Italian).',
 faq_h='❓ Frequently asked questions',
 faq=[
  ('Is the Forge of Empires city planner free?','Yes, completely: no account, no subscription, no limits, no ads.'),
  ('Does it move the buildings in my game?','No. FoE Optimizer never touches your game: it shows you a better layout, and you rebuild it in Forge of Empires yourself, following the map or the PNG.'),
  ('What do I need to import my city?','A desktop browser with FoE Helper or Forge Hammer and the FoE Optimizer bookmark, or a JSON export of the city from FoE Optimizer, FoE Helper or Forge Hammer.'),
  ('Does it handle two-lane roads, chains and sets?','Two-lane roads and chains (Statue of Honor, trains, Hippodrome) yes. Building sets with adjacency bonuses are not handled: the Planner flags them in the statistics.'),
  ('How long does it take?','It depends on the size of the city and on your computer. The search runs on several scenarios in parallel and keeps improving: pause it when the numbers stop changing.'),
  ('Is my data safe?','Yes. Everything is processed and saved only in your browser; no server receives your city.'),
 ],
 final='Ready to free up space in your city? Import it and let the Planner do the work.',
 foot_back='← Back to FoE Optimizer',foot_guide='Guide',foot_other='/planner-it.html',
 foot_tm='Forge of Empires is a trademark of InnoGames GmbH. FoE Optimizer is an independent hobby project, not affiliated with InnoGames.')
EN.update(ba_h='📐 Before and after',
 ba_lede='Two real cities, before and after the Planner. Same buildings: the road tiles saved become free space (in yellow). Click a map to see it full size.',
 alt_prima='Forge of Empires city before the Planner, example',alt_dopo='Forge of Empires city after the Planner, example',
 ba=[('Example 1','Before: <strong>~406</strong> road tiles','After: <strong>~93</strong> road tiles (−77%)'),
     ('Example 2','Before: <strong>~208</strong> road tiles','After: <strong>~96</strong> road tiles (−54%)')])
EN['other']='/planner-it.html'; EN['foot_other']='Italiano'

IT=dict(file='planner-it.html',lang='it',locale='it_IT',crumb='Planner della città',
 title='Planner città Forge of Empires – Layout automatico gratuito | FoE Optimizer',
 desc='Planner gratuito per Forge of Empires: importi la città e riorganizza automaticamente gli edifici con meno strade possibile. Strade a due corsie, catene, senza registrazione.',
 appname='FoE Optimizer – Planner della città',
 appdesc='Planner automatico e gratuito per Forge of Empires: riorganizza gli edifici di una città importata cercando la disposizione con meno strade.',
 features_ld=['Layout automatico della città con meno strade','Più scenari cercati in parallelo','Strade a due corsie','Catene di edifici tenute insieme','Collegamento facoltativo degli edifici militari','Editor della città integrato','Esportazione PNG e JSON','Funziona nel browser, senza registrazione'],
 video_name='Come usare il Planner di FoE Optimizer',video_desc='Video tutorial del planner della città di Forge of Empires in FoE Optimizer.',
 langsw='<a class="lang-switch" href="/planner.html">🇬🇧 English</a>\n          <span class="lang-sep">/</span>\n          <span class="lang-switch active">🇮🇹 Italiano</span>',
 back='Apri il tool →',
 h1='Planner della città per Forge of Empires',
 lede='Un planner automatico e gratuito per Forge of Empires. Importi la tua città e il Planner ridisegna da zero la disposizione degli edifici, cercando quella con meno strade, così resta più spazio per gli edifici.',
 pills=['Gratis al 100%','Senza registrazione','Funziona nel browser','Italiano e inglese'],
 cta='Apri il Planner →',cta2='Come importare la città',guide='/guida.html',
 why_h='🗺️ Perché usarlo',why_lede='Le strade non producono nulla. Ogni casella di strada risparmiata è spazio per un altro edificio.',
 features=[
  ('🛣️','Meno strade','Il Planner cerca la disposizione che collega tutti gli edifici con meno caselle di strada possibile, e ti mostra quante ne risparmi.'),
  ('⚡','Più layout insieme','Esplora più scenari in parallelo (Raccordo a 3, 4 e 5, Girandola, Girandola 2 e Configurazione attuale), ognuno con la sua mappa e le sue statistiche.'),
  ('🚗','Strade a due corsie','Gli edifici che ne hanno bisogno vengono collegati a strade 2×2.'),
  ('🔗','Catene tenute insieme','Statua all\'onore e Strade per la vittoria, treni, Ippodromo: ogni catena resta unita in un solo blocco.'),
  ('⚔️','Edifici militari, con giudizio','Con Alcatraz o la Nave da guerra stellare gli edifici militari non hanno bisogno di strada: scegli tu quali collegare comunque.'),
  ('✏️','Modifiche prima e dopo','Prima di ottimizzare togli edifici o aggiungine di nuovi dall\'inventario o dal database; poi rifinisci il risultato nell\'editor integrato.'),
  ('⬇️','Esportazione PNG e JSON','Scarica la soluzione come immagine da seguire mentre ricostruisci, o come file JSON da condividere.'),
  ('🔒','Privato','Tutto funziona nel tuo browser: niente account, niente server, la tua città resta sul tuo computer.'),
 ],
 how_h='🧭 Come funziona',
 steps=[
  ('Importa la città','Con il segnalibro di FoE Optimizer e FoE Helper o Forge Hammer, oppure caricando un file JSON (export di FoE Optimizer, FoE Helper o Forge Hammer).'),
  ('Ottimizza','Apri la scheda Planner e premi Ottimizza: la ricerca parte su tutti gli scenari e migliora man mano.'),
  ('Pausa e smussatura','Quando i numeri smettono di migliorare, metti in pausa. Smussa (facoltativo) riduce angoli e rientranze così gli edifici piccoli si incastrano meglio.'),
  ('Completa','Il Planner piazza gli edifici che non hanno bisogno di strada e chiude ogni mappa.'),
  ('Ricostruisci nel gioco','Scegli il layout che preferisci, ritoccalo nell\'editor se serve, scarica il PNG e risistema la città in Forge of Empires.'),
 ],
 how_note='<strong>Consiglio:</strong> MIN / MED / MAX scelgono quanta potenza del computer usa il Planner. La spiegazione completa, passo per passo, è nella <a href="/guida.html#tab-planner">guida</a>.',
 video_h='🎬 Video tutorial',video_lede='Il Planner spiegato passo per passo.',
 faq_h='❓ Domande frequenti',
 faq=[
  ('Il planner per Forge of Empires è gratuito?','Sì, del tutto: niente account, niente abbonamenti, nessun limite, nessuna pubblicità.'),
  ('Sposta gli edifici nel mio gioco?','No. FoE Optimizer non tocca mai il gioco: ti mostra una disposizione migliore, e sei tu a ricostruirla in Forge of Empires seguendo la mappa o il PNG.'),
  ('Cosa serve per importare la città?','Un browser da computer con FoE Helper o Forge Hammer e il segnalibro di FoE Optimizer, oppure un export JSON della città da FoE Optimizer, FoE Helper o Forge Hammer.'),
  ('Gestisce strade a due corsie, catene e set?','Strade a due corsie e catene (Statua all\'onore, treni, Ippodromo) sì. I set di edifici con bonus di vicinanza non sono gestiti: il Planner li segnala nelle statistiche.'),
  ('Quanto tempo ci mette?','Dipende dalla grandezza della città e dal computer. La ricerca lavora su più scenari in parallelo e continua a migliorare: mettila in pausa quando i numeri smettono di cambiare.'),
  ('I miei dati sono al sicuro?','Sì. Tutto viene elaborato e salvato solo nel tuo browser; nessun server riceve la tua città.'),
 ],
 final='Vuoi liberare spazio nella tua città? Importala e lascia lavorare il Planner.',
 foot_back='← Torna a FoE Optimizer',foot_guide='Guida',
 foot_tm='Forge of Empires è un marchio di InnoGames GmbH. FoE Optimizer è un progetto amatoriale indipendente, non affiliato a InnoGames.')
IT.update(ba_h='📐 Prima e dopo',
 ba_lede='Due città reali, prima e dopo il Planner. Stessi edifici: le caselle di strada risparmiate diventano spazio libero (in giallo). Clicca una mappa per vederla a grandezza piena.',
 alt_prima='Città di Forge of Empires prima del Planner, esempio',alt_dopo='Città di Forge of Empires dopo il Planner, esempio',
 ba=[('Esempio 1','Prima: <strong>~406</strong> caselle di strada','Dopo: <strong>~93</strong> caselle di strada (−77%)'),
     ('Esempio 2','Prima: <strong>~208</strong> caselle di strada','Dopo: <strong>~96</strong> caselle di strada (−54%)')])
IT['other']='/planner.html'; IT['foot_other']='English'

for L in (EN,IT):
    open(APP+'/public/'+L['file'],'w',encoding='utf-8',newline='\n').write(pagina(L))
print('ok')
