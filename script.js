const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbz8rWMbVJxHVOEXi68s47tnbUmOt5SnFR_TFBSiMSKsPO2QaP0W5l-9ZfFVZovDQs5S/exec';

document.getElementById('year').textContent = new Date().getFullYear();

const form       = document.getElementById('formFilhotes');
const successMsg = document.getElementById('successMsg');
const btnSubmit  = form.querySelector('button[type="submit"]');

document.getElementById('telefone').addEventListener('input', function () {
  let v = this.value.replace(/\D/g, '').slice(0, 11);
  if (v.length > 10)     v = v.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
  else if (v.length > 6) v = v.replace(/^(\d{2})(\d{4})(\d*)$/,   '($1) $2-$3');
  else if (v.length > 2) v = v.replace(/^(\d{2})(\d*)$/,           '($1) $2');
  this.value = v;
});

function sanitize(str) {
  return String(str).replace(/[<>"'`]/g, '').trim().slice(0, 500);
}

function setError(id, msg) {
  const el    = document.getElementById('err-' + id);
  const input = document.getElementById(id);
  if (el)    el.textContent = msg;
  if (input) input.classList.toggle('invalid', !!msg);
}

function clearErrors() {
  ['nomeResponsavel', 'nomeCrianca', 'dataNascimento', 'vinculo', 'telefone', 'email', 'lgpd']
    .forEach(id => setError(id, ''));
}

function validate(data) {
  let ok = true;
  if (!data.nomeResponsavel || data.nomeResponsavel.length < 5) {
    setError('nomeResponsavel', 'Informe o nome completo do responsável.'); ok = false;
  }
  if (!data.nomeCrianca || data.nomeCrianca.length < 2) {
    setError('nomeCrianca', 'Informe o nome da criança.'); ok = false;
  }
  if (!data.dataNascimento) {
    setError('dataNascimento', 'Informe a data de nascimento da criança.'); ok = false;
  }
  if (!data.vinculo || data.vinculo.length < 5) {
    setError('vinculo', 'Descreva o vínculo ou indicação.'); ok = false;
  }
  if (data.telefone.replace(/\D/g, '').length < 10) {
    setError('telefone', 'Informe um telefone válido com DDD.'); ok = false;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    setError('email', 'Informe um e-mail válido.'); ok = false;
  }
  if (!data.lgpd) {
    setError('lgpd', 'É necessário aceitar o termo para continuar.'); ok = false;
  }
  return ok;
}

form.addEventListener('submit', async function (e) {
  e.preventDefault();
  clearErrors();

  const data = {
    nomeResponsavel: sanitize(document.getElementById('nomeResponsavel').value),
    nomeCrianca:     sanitize(document.getElementById('nomeCrianca').value),
    dataNascimento:  document.getElementById('dataNascimento').value,
    observacoes:     sanitize(document.getElementById('observacoes').value),
    vinculo:         sanitize(document.getElementById('vinculo').value),
    telefone:        sanitize(document.getElementById('telefone').value),
    email:           sanitize(document.getElementById('email').value),
    lgpd:            document.getElementById('lgpd').checked,
  };

  if (!validate(data)) return;

  btnSubmit.disabled    = true;
  btnSubmit.textContent = 'Enviando...';

  try {
    const params = new URLSearchParams({ action: 'submit', ...data });
    const res    = await fetch(`${APPS_SCRIPT_URL}?${params}`);
    const json   = await res.json();
    if (json.status !== 'ok') throw new Error(json.message || 'Erro desconhecido');

    form.classList.add('hidden');
    successMsg.classList.remove('hidden');

  } catch (err) {
    alert('Erro ao enviar. Verifique sua conexão e tente novamente.');
    btnSubmit.disabled    = false;
    btnSubmit.textContent = 'Enviar Interesse';
  }
});
