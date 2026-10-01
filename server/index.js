require('dotenv').config();
const express = require('express');
const https   = require('https');
const path    = require('path');

const app  = express();
app.set('etag', false);
const PORT = process.env.PORT || 3000;
const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL;
const ADMIN_SECRET    = process.env.ADMIN_SECRET;

if (!APPS_SCRIPT_URL || !ADMIN_SECRET) {
  console.error('ERRO: APPS_SCRIPT_URL e ADMIN_SECRET devem estar definidas no .env');
  process.exit(1);
}

app.use((req, res, next) => {
  if (req.path === '/admin.html') return res.status(404).send('Not found');
  next();
});

app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/admin', (req, res) => {
  if (req.query.secret !== ADMIN_SECRET) {
    return res.status(401).send('Acesso negado.');
  }
  res.sendFile(path.join(__dirname, '..', 'public', 'admin.html'));
});

app.get('/api', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Pragma', 'no-cache');

  const allowed = ['login', 'getData', 'submit'];
  const action  = req.query.action;

  if (!allowed.includes(action)) {
    return res.status(400).json({ status: 'error', message: 'Ação inválida.' });
  }

  const params = new URLSearchParams(req.query).toString();
  const url    = `${APPS_SCRIPT_URL}?${params}`;

  function doRequest(targetUrl, redirectCount = 0) {
    if (redirectCount > 5) {
      return res.status(502).json({ status: 'error', message: 'Muitos redirecionamentos.' });
    }

    const parsedUrl = new URL(targetUrl);
    const options = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      headers: { 'Accept-Encoding': 'identity' },
    };

    const request = https.get(options, (appsRes) => {
      if ([301, 302, 303, 307, 308].includes(appsRes.statusCode) && appsRes.headers.location) {
        appsRes.resume();
        return doRequest(appsRes.headers.location, redirectCount + 1);
      }

      const chunks = [];
      appsRes.on('data', chunk => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      appsRes.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8');
        console.log('[API] body completo:', JSON.stringify(body));
        try {
          const raw = body.includes('(')
            ? body.replace(/^[^(]+\(/, '').replace(/\);?\s*$/, '')
            : body;
          let parsed = JSON.parse(raw);
          if (typeof parsed === 'string') parsed = JSON.parse(parsed);
          res.json(parsed);
        } catch (e) {
          console.log('[API] parse error:', e.message);
          res.status(500).json({ status: 'error', message: 'Resposta inválida: ' + e.message });
        }
      });
    });

    request.setTimeout(25000, () => {
      request.destroy();
      if (!res.headersSent)
        res.status(504).json({ status: 'error', message: 'Tempo limite excedido.' });
    });

    request.on('error', (err) => {
      if (!res.headersSent)
        res.status(502).json({ status: 'error', message: 'Erro ao conectar: ' + err.message });
    });
  }

  doRequest(url);
});

app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
