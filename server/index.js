require('dotenv').config();
const express = require('express');
const https   = require('https');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;
const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL;

if (!APPS_SCRIPT_URL) {
  console.error('ERRO: APPS_SCRIPT_URL não definida no .env');
  process.exit(1);
}

// Serve os arquivos estáticos do frontend
app.use(express.static(path.join(__dirname, '..', 'public')));

// Proxy para o Apps Script — browser nunca vê a URL real
app.get('/api', (req, res) => {
  const allowed = ['login', 'getData', 'submit'];
  const action  = req.query.action;

  if (!allowed.includes(action)) {
    return res.status(400).json({ status: 'error', message: 'Ação inválida.' });
  }

  const params   = new URLSearchParams(req.query).toString();
  const url      = `${APPS_SCRIPT_URL}?${params}`;

  https.get(url, (appsRes) => {
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
  }).on('error', () => {
    res.status(502).json({ status: 'error', message: 'Erro ao conectar com o servidor.' });
  });
});

app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
