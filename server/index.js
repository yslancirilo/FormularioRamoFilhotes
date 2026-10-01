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

// Bloqueia acesso direto ao admin.html
app.use((req, res, next) => {
  if (req.path === '/admin.html') return res.status(404).send('Not found');
  next();
});

// Serve os arquivos estáticos do frontend
app.use(express.static(path.join(__dirname, '..', 'public')));

// Rota protegida do painel admin — exige ?secret=ADMIN_SECRET na URL
app.get('/admin', (req, res) => {
  if (req.query.secret !== ADMIN_SECRET) {
    return res.status(401).send('Acesso negado.');
  }
  res.sendFile(path.join(__dirname, '..', 'public', 'admin.html'));
});

// Proxy para o Apps Script — browser nunca vê a URL real
app.get('/api', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Pragma', 'no-cache');
  const allowed = ['login', 'getData', 'submit'];
  const action  = req.query.action;

  if (!allowed.includes(action)) {
    return res.status(400).json({ status: 'error', message: 'Ação inválida.' });
  }

  const params   = new URLSearchParams(req.query).toString();
  const url      = `${APPS_SCRIPT_URL}?${params}`;

  function doRequest(targetUrl, redirectCount = 0) {
    if (redirectCount > 5) {
      return res.status(502).json({ status: 'error', message: 'Muitos redirecionamentos.' });
    }

    const request = https.get(targetUrl, (appsRes) => {
      // Segue redirects (302/301) que o Apps Script faz
      if ([301, 302, 303, 307, 308].includes(appsRes.statusCode) && appsRes.headers.location) {
        appsRes.resume();
        return doRequest(appsRes.headers.location, redirectCount + 1);
      }

      let body = '';
      appsRes.on('data', chunk => body += chunk);
      appsRes.on('end', () => {
        try {
          // Remove wrapper JSONP se existir, senão usa JSON puro
          const json = body.includes('(') 
            ? body.replace(/^[^(]+\(/, '').replace(/\);?\s*$/, '')
            : body;
          res.setHeader('Content-Type', 'application/json');
          res.send(json);
        } catch (e) {
          res.status(500).json({ status: 'error', message: 'Resposta inválida do servidor.' });
        }
      });
    });

    request.setTimeout(25000, () => {
      request.destroy();
      if (!res.headersSent)
        res.status(504).json({ status: 'error', message: 'Tempo limite excedido. Tente novamente.' });
    });

    request.on('error', (err) => {
      if (!res.headersSent)
        res.status(502).json({ status: 'error', message: 'Erro ao conectar: ' + err.message });
    });
  }

  doRequest(url);
});

app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
