const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbykLr-H2l-N9yN6vyWV4xx2i_9FVLjPHyEi6fa1stl6rgOpVdWtteiP20XQWca6OK_Deg/exec';

function fetchJsonp(params) {
  return new Promise((resolve, reject) => {
    const cbName = '_cb_' + Date.now();
    const base   = Object.entries(params).map(([k,v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
    const url    = `${APPS_SCRIPT_URL}?${base}&callback=${cbName}`;
    const script = document.createElement('script');
    const timer  = setTimeout(() => { cleanup(); reject(new Error('Timeout')); }, 10000);

    window[cbName] = (data) => { cleanup(); resolve(data); };
    script.onerror = () => { cleanup(); reject(new Error('Erro de rede')); };
    script.src = url;
    document.head.appendChild(script);

    function cleanup() {
      clearTimeout(timer);
      delete window[cbName];
      script.remove();
    }
  });
}

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
    fetchJsonp({ action: 'submit', ...data });
    setTimeout(() => {
      form.classList.add('hidden');
      successMsg.classList.remove('hidden');
    }, 1500);

  } finally {
    btnSubmit.disabled    = false;
    btnSubmit.textContent = 'Enviar Interesse';
  }
});

