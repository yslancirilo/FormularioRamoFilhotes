// ⚠️ Cole aqui a URL e o token que você definiu no Apps Script
const APPS_SCRIPT_URL   = 'https://script.google.com/macros/s/AKfycby9B_YNikCcouLXPsCBbAHz32LiG1BYyw1Mfsuk-9YgdmlQXGvbFiZSu8ADHQPiYCEU/exec';
const ADMIN_TOKEN       = 'Filhotes107MG';

const ADMIN_USER        = 'admin';
const SESSION_KEY       = 'filhotes_admin_session';

async function sha256(msg) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(msg));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

let REAL_HASH = '';
sha256('Filhotes@107').then(h => { REAL_HASH = h; });

// ---- Auth ----
function isLoggedIn() { return sessionStorage.getItem(SESSION_KEY) === '1'; }

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
  const hash  = await sha256(pass);

  if (user === ADMIN_USER && hash === REAL_HASH) {
    sessionStorage.setItem(SESSION_KEY, '1');
    errEl.textContent = '';
    showPanel();
  } else {
    errEl.textContent = 'Usuário ou senha incorretos.';
    document.getElementById('adminPass').value = '';
  }
});

document.getElementById('btnLogout').addEventListener('click', function () {
  sessionStorage.removeItem(SESSION_KEY);
  showLogin();
});

// ---- Dados ----
let allData = [];

async function loadInscricoes() {
  const tbody     = document.getElementById('tableBody');
  const emptyMsg  = document.getElementById('emptyMsg');
  const totalCount = document.getElementById('totalCount');

  tbody.innerHTML  = '<tr><td colspan="10" style="text-align:center;padding:24px;color:#999">Carregando...</td></tr>';
  emptyMsg.classList.add('hidden');

  try {
    const res  = await fetch(`${APPS_SCRIPT_URL}?token=${encodeURIComponent(ADMIN_TOKEN)}`);
    const json = await res.json();

    if (json.status !== 'ok') throw new Error('Não autorizado ou erro no servidor.');

    allData = json.data || [];
    renderTable(document.getElementById('searchInput').value.toLowerCase().trim());

  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;padding:24px;color:#e53935">Erro ao carregar dados: ${esc(err.message)}</td></tr>`;
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
    tr.innerHTML = `
      <td><span class="badge-num">${i + 1}</span></td>
      <td>${esc(formatDate(r.dataEnvio))}</td>
      <td>${esc(r.nomeResponsavel)}</td>
      <td>${esc(r.nomeCrianca)}</td>
      <td>${esc(r.dataNascimento)}</td>
      <td>${esc(r.observacoes)}</td>
      <td>${esc(r.vinculo)}</td>
      <td>${esc(r.telefone)}</td>
      <td>${esc(r.email)}</td>
      <td><a href="https://wa.me/55${String(r.telefone).replace(/\D/g,'')}" target="_blank" class="btn-whatsapp" title="Abrir WhatsApp">💬</a></td>
    `;
    tbody.appendChild(tr);
  });
}

function esc(str) {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

document.getElementById('searchInput').addEventListener('input', function () {
  renderTable(this.value.toLowerCase().trim());
});

document.getElementById('btnExport').addEventListener('click', function () {
  if (!allData.length) { alert('Nenhuma inscrição para exportar.'); return; }

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

// Botão atualizar (substitui "Limpar Tudo" — dados ficam na planilha)
document.getElementById('btnClearAll').textContent = '🔄 Atualizar';
document.getElementById('btnClearAll').classList.remove('btn-danger');
document.getElementById('btnClearAll').classList.add('btn-export');
document.getElementById('btnClearAll').addEventListener('click', loadInscricoes);
