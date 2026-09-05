export function landingPage() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="theme-color" content="#082003" />
  <title>LinkedIn Pilot by SDK Enterprises</title>
  <meta name="description" content="Create, publish and schedule personal LinkedIn posts directly from ChatGPT." />
  <style>
    :root { --bg:#082003; --accent:#2cdb16; --soft:#d7e8d3; --panel:#0e2a09; --muted:#96ae92; }
    * { box-sizing:border-box; }
    body { margin:0; background:radial-gradient(circle at 80% 0%,#143f0c 0,#082003 38%,#050f04 100%); color:#f7fbf6; font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono",monospace; min-height:100vh; }
    a { color:inherit; text-decoration:none; }
    .wrap { width:min(1120px,calc(100% - 36px)); margin:auto; }
    nav { display:flex; align-items:center; justify-content:space-between; padding:24px 0; }
    .brand { display:flex; align-items:center; gap:12px; font-weight:800; letter-spacing:-.03em; }
    .mark { width:38px; height:38px; border:1px solid var(--accent); border-radius:12px; display:grid; place-items:center; background:#071905; box-shadow:0 0 30px #2cdb1622; }
    .mark span { color:var(--accent); font-size:21px; transform:translateY(-1px); }
    .by { color:var(--muted); font-size:12px; font-weight:500; }
    .navlink { color:var(--soft); font-size:13px; }
    main { padding:90px 0 72px; }
    .eyebrow { display:inline-flex; gap:8px; align-items:center; border:1px solid #2cdb1642; border-radius:999px; padding:8px 12px; color:var(--soft); background:#0b2107aa; font-size:12px; }
    .dot { width:7px; height:7px; border-radius:999px; background:var(--accent); box-shadow:0 0 12px var(--accent); }
    h1 { font-size:clamp(46px,8vw,92px); line-height:.95; letter-spacing:-.07em; max-width:930px; margin:28px 0 26px; }
    h1 em { font-style:normal; color:var(--accent); }
    .lead { color:#bfd0bc; font-size:clamp(17px,2vw,22px); line-height:1.55; max-width:710px; }
    .actions { display:flex; flex-wrap:wrap; gap:12px; margin-top:34px; }
    .btn { padding:14px 18px; border-radius:12px; border:1px solid #ffffff22; font-size:14px; font-weight:700; }
    .btn.primary { background:var(--accent); color:#061303; border-color:var(--accent); box-shadow:0 10px 40px #2cdb1625; }
    .btn.secondary { background:#ffffff08; color:var(--soft); }
    .grid { display:grid; grid-template-columns:repeat(3,1fr); gap:14px; margin-top:90px; }
    .card { padding:24px; min-height:190px; border:1px solid #d7e8d31c; border-radius:18px; background:linear-gradient(180deg,#ffffff08,#ffffff03); backdrop-filter:blur(10px); }
    .num { color:var(--accent); font-size:12px; }
    .card h2 { margin:34px 0 10px; font-size:20px; letter-spacing:-.03em; }
    .card p { margin:0; color:#a9bea6; line-height:1.6; font-size:14px; }
    .terminal { margin-top:18px; border:1px solid #ffffff18; border-radius:16px; overflow:hidden; background:#041003; }
    .terminal .bar { padding:10px 14px; border-bottom:1px solid #ffffff12; color:#789074; font-size:11px; }
    .terminal pre { margin:0; padding:22px; white-space:pre-wrap; color:#d7e8d3; font-size:14px; line-height:1.7; }
    .terminal b { color:var(--accent); font-weight:600; }
    footer { display:flex; justify-content:space-between; gap:20px; flex-wrap:wrap; border-top:1px solid #ffffff12; padding:28px 0 44px; color:#789074; font-size:12px; }
    footer .links { display:flex; gap:18px; }
    @media(max-width:760px){ main{padding-top:54px}.grid{grid-template-columns:1fr;margin-top:60px} h1{font-size:52px}.by{display:none} }
  </style>
</head>
<body>
  <div class="wrap">
    <nav>
      <a class="brand" href="/"><span class="mark"><span>↗</span></span><span>LinkedIn Pilot <span class="by">by SDK Enterprises</span></span></a>
      <a class="navlink" href="https://sdk.enterprises">sdk.enterprises ↗</a>
    </nav>
    <main>
      <span class="eyebrow"><span class="dot"></span> ChatGPT-native LinkedIn publishing</span>
      <h1>Write it in ChatGPT.<br/><em>Publish it for real.</em></h1>
      <p class="lead">LinkedIn Pilot connects your personal LinkedIn account to ChatGPT so you can publish text and image posts, schedule them for later, and keep the workflow inside the conversation.</p>
      <div class="actions">
        <a class="btn primary" href="/oauth/linkedin/start">Connect LinkedIn ↗</a>
        <a class="btn secondary" href="https://github.com/SDK-E/linkedin">View source</a>
      </div>

      <div class="terminal">
        <div class="bar">example / chatgpt</div>
        <pre><b>you</b>  Post this tomorrow at 09:30 with this image and give me the link.

<b>pilot</b>  Scheduled for tomorrow at 09:30. I’ll publish it to your connected LinkedIn account.</pre>
      </div>

      <section class="grid">
        <article class="card"><span class="num">01</span><h2>Publish</h2><p>Text and image posts go straight to the LinkedIn account you authenticated. No copy-paste loop.</p></article>
        <article class="card"><span class="num">02</span><h2>Schedule</h2><p>Use normal language like “tomorrow at 9:30”. Pilot stores the job and publishes it at the requested time.</p></article>
        <article class="card"><span class="num">03</span><h2>Stay in control</h2><p>Authentication is per user, publishing actions are explicit, and scheduled posts can be listed or cancelled before they go live.</p></article>
      </section>
    </main>
    <footer>
      <span>© SDK Enterprises · SADDEK Entreprises</span>
      <span class="links"><a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="mailto:hello@sdk.enterprises">Contact</a></span>
    </footer>
  </div>
</body>
</html>`;
}

export function policyPage(title: string, body: string) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} · LinkedIn Pilot</title><style>body{margin:0;background:#082003;color:#d7e8d3;font:15px/1.75 ui-monospace,SFMono-Regular,Menlo,monospace}.wrap{max-width:760px;margin:auto;padding:70px 24px}a{color:#2cdb16}h1{color:white;font-size:38px;letter-spacing:-.05em}p{white-space:pre-line;color:#bfd0bc}</style></head><body><div class="wrap"><a href="/">← LinkedIn Pilot</a><h1>${title}</h1><p>${body}</p></div></body></html>`;
}
