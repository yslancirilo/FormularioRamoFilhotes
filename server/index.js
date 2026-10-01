require('dotenv').config();
const express = require('express');
const https   = require('https');
const path    = require('path');

const app  = express();
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
  const allowed = ['login', 'getData', 'submit'];
  const action  = req.query.action;

  if (!allowed.includes(action)) {
    return res.status(400).json({ status: 'error', message: 'Ação inválida.' });
  }

  const params   = new URLSearchParams(req.query).toString();
  const url      = `${APPS_SCRIPT_URL}?${params}`;

  const request = https.get(url, (appsRes) => {
    let body = '';
    appsRes.on('data', chunk => body += chunk);
    appsRes.on('end', () => {
      try {
        // Apps Script retorna JSONP: callback({...}) — extrai o JSON puro
        const json = body.replace(/^[^(]+\(/, '').replace(/\);?\s*$/, '');
        res.setHeader('Content-Type', 'application/json');
        res.send(json);
      } catch {
        res.status(500).json({ status: 'error', message: 'Resposta inválida do servidor.' });
      }
    });
  });

  request.setTimeout(25000, () => {
    request.destroy();
    res.status(504).json({ status: 'error', message: 'Tempo limite excedido. Tente novamente.' });
  });

  request.on('error', (err) => {
    if (!res.headersSent)
      res.status(502).json({ status: 'error', message: 'Erro ao conectar com o servidor: ' + err.message });
  });
});

app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
