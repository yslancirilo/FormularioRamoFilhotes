
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby9B_YNikCcouLXPsCBbAHz32LiG1BYyw1Mfsuk-9YgdmlQXGvbFiZSu8ADHQPiYCEU/exec';
const SESSION_KEY     = 'filhotes_admin_session';

// ---- Auth ----
function getSessionToken() { return sessionStorage.getItem(SESSION_KEY); }
function isLoggedIn()      { return !!getSessionToken(); }

function showPanel() {
  document.getElementById('loginSection').classList.add('hidden');
  document.getElementById('adminSection').classList.remove('hidden');
  loadInscricoes();
}

function showLogin() {
  document.getElementById('loginSection').classList.remove('hidden');
  document.getElementById('adminSection').classList.add('hidden');
}

if (isLoggedIn()) showPanel();

document.getElementById('loginForm').addEventListener('submit', async function (e) {
  e.preventDefault();
  const user  = document.getElementById('adminUser').value.trim();
  const pass  = document.getElementById('adminPass').value;
  const errEl = document.getElementById('loginError');

  errEl.textContent = 'Verificando...';

  try {
    const url  = `${APPS_SCRIPT_URL}?action=login&user=${encodeURIComponent(user)}&pass=${encodeURIComponent(pass)}`;
    const res  = await fetch(url);
    const json = await res.json();

    if (json.status === 'ok' && json.token) {
      sessionStorage.setItem(SESSION_KEY, json.token);
      errEl.textContent = '';
      showPanel();
    } else {
      errEl.textContent = 'Usuário ou senha incorretos.';
      document.getElementById('adminPass').value = '';
    }
  } catch {
    errEl.textContent = 'Erro ao conectar. Tente novamente.';
  }
});

document.getElementById('btnLogout').addEventListener('click', function () {
  sessionStorage.removeItem(SESSION_KEY);
  showLogin();
});

// ---- Dados ----
let allData = [];

async function loadInscricoes() {
  const tbody    = document.getElementById('tableBody');
  const emptyMsg = document.getElementById('emptyMsg');

  tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;padding:24px;color:#999">Carregando...</td></tr>';
  emptyMsg.classList.add('hidden');

  try {
    const url  = `${APPS_SCRIPT_URL}?action=getData&token=${encodeURIComponent(getSessionToken())}`;
    const res  = await fetch(url);
    const json = await res.json();

    if (json.status === 'unauthorized') {
      sessionStorage.removeItem(SESSION_KEY);
      showLogin();
      return;
    }

    if (json.status !== 'ok') throw new Error('Erro no servidor.');

    allData = json.data || [];
    renderTable(document.getElementById('searchInput').value.toLowerCase().trim());

  } catch (err) {
    const td = document.createElement('td');
    td.colSpan = 10;
    td.style.cssText = 'text-align:center;padding:24px;color:#e53935';
    td.textContent = 'Erro ao carregar dados: ' + err.message;
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

  if (filtered.length === 0) {
    emptyMsg.classList.remove('hidden');
    return;
  }
  emptyMsg.classList.add('hidden');

  filtered.forEach((r, i) => {
    const tr = document.createElement('tr');
    const cells = [i + 1, formatDate(r.dataEnvio), r.nomeResponsavel, r.nomeCrianca, r.dataNascimento, r.observacoes, r.vinculo, r.telefone, r.email];

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

  const headers = ['#','Data','Responsável','Criança','Dt. Nascimento','Observações','Vínculo','Telefone','E-mail'];
  const rows = allData.map((r, i) => [
    i + 1, r.dataEnvio, r.nomeResponsavel, r.nomeCrianca, r.dataNascimento, r.observacoes, r.vinculo, r.telefone, r.email,
  ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(';'));

  const csv  = '\uFEFF' + [headers.join(';'), ...rows].join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `inscricoes-filhotes-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
});

// Botão atualizar
document.getElementById('btnClearAll').textContent = '🔄 Atualizar';
document.getElementById('btnClearAll').classList.remove('btn-danger');
document.getElementById('btnClearAll').classList.add('btn-export');
document.getElementById('btnClearAll').addEventListener('click', loadInscricoes);
