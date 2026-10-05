// ---- Sessão com TTL (LGPD: tempo limitado de acesso) ----
function saveSession(token) {
  const session = { token, savedAt: Date.now() };
  sessionStorage.setItem(APP_CONFIG.SESSION_KEY, JSON.stringify(session));
}

function getSessionToken() {
  try {
    const raw = sessionStorage.getItem(APP_CONFIG.SESSION_KEY);
    if (!raw) return null;
    const { token, savedAt } = JSON.parse(raw);
    if (Date.now() - savedAt > APP_CONFIG.SESSION_TTL_MS) {
      clearSession();
      return null;
    }
    return token;
  } catch {
    clearSession();
    return null;
  }
}

function clearSession() {
  sessionStorage.removeItem(APP_CONFIG.SESSION_KEY);
}

function isLoggedIn() { return !!getSessionToken(); }

// Expiração automática de sessão (LGPD: não manter dados além do necessário)
let sessionTimer = null;
function startSessionTimer() {
  clearTimeout(sessionTimer);
  sessionTimer = setTimeout(() => {
    clearSession();
    showLogin();
    document.getElementById('loginError').textContent = 'Sessão expirada. Faça login novamente.';
  }, APP_CONFIG.SESSION_TTL_MS);
}

// ---- API (proxy / Apps Script) ----
async function fetchJsonp(params) {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${APP_CONFIG.APPS_SCRIPT_URL}?${qs}`, {
    method: 'GET',
    redirect: 'follow',
  });

  // Pega a resposta bruta como texto
  let text = await res.text();
  text = text.trim();

  // Se a resposta vier envolvida por parênteses ou função callback, remove para isolar o JSON
  if (text.startsWith('(') && text.endsWith(')')) {
    text = text.slice(1, -1).trim();
  } else if (/^[a-zA-Z0-9_]+\s*\(/.test(text)) {
    text = text.substring(text.indexOf('(') + 1, text.lastIndexOf(')')).trim();
  }

  try {
    return JSON.parse(text);
  } catch (err) {
    console.error('Conteúdo recebido que gerou o erro:', text);
    throw new Error('Falha ao interpretar resposta do servidor.');
  }
}

// ---- UI ----
function showPanel() {
  document.getElementById('loginSection').classList.add('hidden');
  document.getElementById('adminSection').classList.remove('hidden');
  startSessionTimer();
  loadInscricoes();
}

function showLogin() {
  clearTimeout(sessionTimer);
  document.getElementById('loginSection').classList.remove('hidden');
  document.getElementById('adminSection').classList.add('hidden');
}

if (isLoggedIn()) showPanel();

// ---- Login ----
document.getElementById('loginForm').addEventListener('submit', async function (e) {
  e.preventDefault();
  const user  = document.getElementById('adminUser').value.trim();
  const pass  = document.getElementById('adminPass').value;
  const errEl = document.getElementById('loginError');

  errEl.textContent = 'Verificando...';

  try {
    const json = await fetchJsonp({ action: 'login', user, pass });

    if (json.status === 'ok' && json.token) {
      saveSession(json.token);
      errEl.textContent = '';
      document.getElementById('adminPass').value = ''; // LGPD: não manter senha em memória
      showPanel();
    } else {
      errEl.textContent = 'Usuário ou senha incorretos.';
      document.getElementById('adminPass').value = '';
    }
  } catch (err) {
    errEl.textContent = 'Erro ao conectar. Tente novamente. Detalhe: ' + (err.message || err);
  }
});

document.getElementById('btnLogout').addEventListener('click', function () {
  clearSession();
  allData = []; // LGPD: limpa dados pessoais da memória ao sair
  document.getElementById('tableBody').innerHTML = '';
  showLogin();
});

// ---- Dados ----
let allData = [];

async function loadInscricoes() {
  const token = getSessionToken();
  if (!token) { showLogin(); return; }

  const tbody    = document.getElementById('tableBody');
  const emptyMsg = document.getElementById('emptyMsg');

  tbody.innerHTML = '<tr><td colspan="10" class="td-loading">Carregando...</td></tr>';
  emptyMsg.classList.add('hidden');

  try {
    const json = await fetchJsonp({ action: 'getData', token });

    if (json.status === 'unauthorized') {
      clearSession();
      showLogin();
      return;
    }

    if (json.status !== 'ok') throw new Error('Erro no servidor.');

    allData = json.data || [];
    renderTable(document.getElementById('searchInput').value.toLowerCase().trim());

  } catch (err) {
    const td = document.createElement('td');
    td.colSpan = 10;
    td.className = 'td-error';
    td.textContent = 'Erro ao carregar dados: ' + (err.message || err);
    const tr = document.createElement('tr');
    tr.appendChild(td);
    tbody.innerHTML = '';
    tbody.appendChild(tr);
  }
}

function formatDate(raw) {
  const d = new Date(raw);
  if (isNaN(d)) return raw;
  return d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

function formatDateOnly(raw) {
  if (!raw) return '';
  const [year, month, day] = String(raw).slice(0, 10).split('-');
  return `${day}/${month}/${year}`;
}

function renderTable(filter = '') {
  const tbody      = document.getElementById('tableBody');
  const emptyMsg   = document.getElementById('emptyMsg');
  const totalCount = document.getElementById('totalCount');

  const filtered = filter
    ? allData.filter(r =>
        String(r.nomeResponsavel).toLowerCase().includes(filter) ||
        String(r.nomeCrianca).toLowerCase().includes(filter) ||
        String(r.email).toLowerCase().includes(filter)
      )
    : allData;

  totalCount.textContent = `Total: ${allData.length} inscrição(ões)${filter ? ` — ${filtered.length} encontrada(s)` : ''}`;
  tbody.innerHTML = '';

  if (filtered.length === 0) { emptyMsg.classList.remove('hidden'); return; }
  emptyMsg.classList.add('hidden');

  filtered.forEach((r, i) => {
    const tr = document.createElement('tr');
    const cells = [i + 1, formatDate(r.dataEnvio), r.nomeResponsavel, r.nomeCrianca, formatDateOnly(r.dataNascimento), r.observacoes, r.vinculo, r.telefone, r.email];

    cells.forEach((val, ci) => {
      const td = document.createElement('td');
      if (ci === 0) {
        const span = document.createElement('span');
        span.className = 'badge-num';
        span.textContent = val;
        td.appendChild(span);
      } else {
        td.textContent = val ?? '';
      }
      tr.appendChild(td);
    });

    const tdWa = document.createElement('td');
    const phone = String(r.telefone).replace(/\D/g, '');
    if (/^\d{10,11}$/.test(phone)) {
      const a = document.createElement('a');
      a.href = `https://wa.me/55${phone}`;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.className = 'btn-whatsapp';
      a.title = 'Abrir WhatsApp';
      a.textContent = '💬';
      tdWa.appendChild(a);
    }
    tr.appendChild(tdWa);
    tbody.appendChild(tr);
  });
}

document.getElementById('searchInput').addEventListener('input', function () {
  renderTable(this.value.toLowerCase().trim());
});

document.getElementById('btnExport').addEventListener('click', function () {
  if (!allData.length) { document.getElementById('emptyMsg').classList.remove('hidden'); return; }

  const headers = ['#', 'Data', 'Responsável', 'Criança', 'Dt. Nascimento', 'Observações', 'Vínculo', 'Telefone', 'E-mail'];
  const rows = allData.map((r, i) => [
    i + 1, r.dataEnvio, r.nomeResponsavel, r.nomeCrianca, r.dataNascimento, r.observacoes, r.vinculo, r.telefone, r.email,
  ].map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(';'));

  const csv  = '\uFEFF' + [headers.join(';'), ...rows].join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `inscricoes-filhotes-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
});

// Botão atualizar
document.getElementById('btnClearAll').textContent = '🔄 Atualizar';
document.getElementById('btnClearAll').classList.remove('btn-danger');
document.getElementById('btnClearAll').classList.add('btn-export');
document.getElementById('btnClearAll').addEventListener('click', loadInscricoes);
