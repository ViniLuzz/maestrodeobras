// ────────────────────────────────────────────────────────────────
// CONFIG
// ────────────────────────────────────────────────────────────────
const SUPABASE_URL  = 'https://agqmuanlbraxeqbupmbb.supabase.co';
const SUPABASE_ANON = 'sb_publishable_Mh5MBQZJkN0E0Wv4fJcS8Q_gCW_gJN0';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

const CATEGORIAS = [
  'Betoneira', 'Andaime', 'Compactador', 'Escavadeira',
  'Furadeira', 'Geradores', 'Guindaste', 'Martelete',
  'Misturador', 'Motoniveladora', 'Retroescavadeira',
  'Serra', 'Vibrador de concreto', 'Outro'
];

// ────────────────────────────────────────────────────────────────
// ESTADO GLOBAL
// ────────────────────────────────────────────────────────────────
let currentUser  = null;
let currentLoja  = null;
let eqFotoFile   = null;
let eqFotoUrlAtual = null;
let lojaAvatarFile = null;

// ────────────────────────────────────────────────────────────────
// INIT
// ────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  populaCategorias();

  sb.auth.onAuthStateChange((_event, session) => {
    currentUser = session?.user ?? null;
    renderAuth();
  });

  const { data: { session } } = await sb.auth.getSession();
  currentUser = session?.user ?? null;
  renderAuth();
});

function renderAuth() {
  const telaAuth      = document.getElementById('telaAuth');
  const telaDashboard = document.getElementById('telaDashboard');
  const headerUser    = document.getElementById('headerUser');

  if (currentUser) {
    telaAuth.classList.add('hidden');
    telaDashboard.classList.remove('hidden');
    headerUser.classList.remove('hidden');
    headerUser.classList.add('flex');
    document.getElementById('headerEmail').textContent = currentUser.email;
    carregarDados();
  } else {
    telaAuth.classList.remove('hidden');
    telaDashboard.classList.add('hidden');
    headerUser.classList.add('hidden');
  }
}

async function carregarDados() {
  mostrarLoading(true);
  try {
    const dbClient = await db();
    const { data, error } = await dbClient
      .from('lojas_equipamentos')
      .select('*')
      .eq('auth_user_id', currentUser.id)
      .maybeSingle();

    if (error) throw error;

    currentLoja = data;
    preencherFormLoja(currentLoja);

    if (currentLoja) {
      document.getElementById('bannerSemLoja').classList.add('hidden');
      document.getElementById('secaoEquipamentos').classList.remove('hidden');
      await carregarEquipamentos();
    } else {
      document.getElementById('bannerSemLoja').classList.remove('hidden');
      document.getElementById('secaoEquipamentos').classList.add('hidden');
    }
  } catch (e) {
    console.error(e);
    mostrarErro('erroLoja', 'Erro ao carregar dados: ' + e.message);
  } finally {
    mostrarLoading(false);
  }
}

// ────────────────────────────────────────────────────────────────
// AUTENTICAÇÃO
// ────────────────────────────────────────────────────────────────
function trocarAba(aba) {
  const isLogin = aba === 'login';
  const isRec   = aba === 'recuperar';

  document.getElementById('formLogin').classList.toggle('hidden', !isLogin);
  document.getElementById('formCadastro').classList.toggle('hidden', aba !== 'cadastro');
  document.getElementById('formRecuperar').classList.toggle('hidden', !isRec);

  document.getElementById('abaLogin').className =
    'flex-1 py-2 text-sm font-bold rounded-md transition-all ' +
    (isLogin ? 'bg-white text-maestro-navy' : 'text-gray-600');
  document.getElementById('abaCadastro').className =
    'flex-1 py-2 text-sm font-bold rounded-md transition-all ' +
    (aba === 'cadastro' ? 'bg-white text-maestro-navy' : 'text-gray-600');
}

function mostrarRecuperarSenha() {
  document.getElementById('formLogin').classList.add('hidden');
  document.getElementById('formCadastro').classList.add('hidden');
  document.getElementById('formRecuperar').classList.remove('hidden');
}

async function fazerLogin(e) {
  e.preventDefault();
  limparMensagem('erroLogin');
  setBtnLoading('btnLogin', true, 'Entrando...');

  const email = document.getElementById('loginEmail').value.trim();
  const senha  = document.getElementById('loginSenha').value;

  const { error } = await sb.auth.signInWithPassword({ email, password: senha });
  if (error) mostrarErro('erroLogin', traduzirErroAuth(error.message));
  setBtnLoading('btnLogin', false, 'Entrar');
}

async function fazerCadastro(e) {
  e.preventDefault();
  limparMensagem('erroCadastro');

  const email    = document.getElementById('cadEmail').value.trim();
  const senha    = document.getElementById('cadSenha').value;
  const senhaConf = document.getElementById('cadSenhaConf').value;

  if (senha !== senhaConf) {
    mostrarErro('erroCadastro', 'As senhas não conferem.');
    return;
  }

  setBtnLoading('btnCadastro', true, 'Criando Conta...');
  const { error } = await sb.auth.signUp({ email, password: senha });
  if (error) {
    mostrarErro('erroCadastro', traduzirErroAuth(error.message));
  } else {
    mostrarErro('erroCadastro',
      '✅ Conta criada! Verifique seu e-mail para confirmar.',
      'text-green-600 bg-green-50 border-green-200');
  }
  setBtnLoading('btnCadastro', false, 'Criar Conta');
}

async function enviarRecuperacao(e) {
  e.preventDefault();
  limparMensagem('erroRecuperar');
  limparMensagem('okRecuperar');
  const email = document.getElementById('recEmail').value.trim();
  setBtnLoading('btnRecuperar', true, 'Enviando...');

  const { error } = await sb.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.href,
  });

  if (error) {
    mostrarErro('erroRecuperar', traduzirErroAuth(error.message));
  } else {
    document.getElementById('okRecuperar').textContent = '✅ Link enviado! Verifique seu e-mail.';
    document.getElementById('okRecuperar').classList.remove('hidden');
  }
  setBtnLoading('btnRecuperar', false, 'Enviar Link');
}

async function fazerLogout() {
  await sb.auth.signOut();
  currentLoja = null;
}

async function db() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session?.access_token) throw new Error('Sessão expirada. Faça login novamente.');
  return supabase.createClient(SUPABASE_URL, SUPABASE_ANON, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${session.access_token}` } },
  });
}

// ────────────────────────────────────────────────────────────────
// LOJA
// ────────────────────────────────────────────────────────────────
function preencherFormLoja(loja) {
  if (!loja) {
    document.getElementById('lojaStatusBadge').innerHTML = '';
    return;
  }

  document.getElementById('lojaNome').value     = loja.nome ?? '';
  document.getElementById('lojaDesc').value     = loja.descricao ?? '';
  document.getElementById('lojaCidade').value   = loja.cidade ?? '';
  document.getElementById('lojaEstado').value   = loja.estado ?? '';
  document.getElementById('lojaTelefone').value = loja.telefone ?? '';
  document.getElementById('lojaEndereco').value = loja.endereco ?? '';
  document.getElementById('lojaLat').value      = loja.latitude ?? '';
  document.getElementById('lojaLng').value      = loja.longitude ?? '';
  document.getElementById('lojaAtivo').checked  = loja.ativo ?? true;

  if (loja.avatar_url) {
    const img = document.getElementById('lojaAvatarPreview');
    img.src = loja.avatar_url;
    img.classList.remove('hidden');
  }

  const badge = document.getElementById('lojaStatusBadge');
  badge.innerHTML = loja.ativo
    ? '<span class="badge-active">● Loja Ativa</span>'
    : '<span class="badge-inactive">● Loja Inativa</span>';
}

async function salvarLoja(e) {
  e.preventDefault();
  limparMensagem('erroLoja');
  limparMensagem('okLoja');
  setBtnLoading('btnSalvarLoja', true, 'Salvando...');

  try {
    let avatar_url = currentLoja?.avatar_url ?? null;

    if (lojaAvatarFile) {
      avatar_url = await uploadImagem(lojaAvatarFile, 'equipamentos', `${currentUser.id}/loja-avatar`);
    }

    const payload = {
      nome:        document.getElementById('lojaNome').value.trim(),
      descricao:   document.getElementById('lojaDesc').value.trim() || null,
      cidade:      document.getElementById('lojaCidade').value.trim(),
      estado:      document.getElementById('lojaEstado').value,
      telefone:    document.getElementById('lojaTelefone').value.trim(),
      endereco:    document.getElementById('lojaEndereco').value.trim() || null,
      latitude:    parseFloat(document.getElementById('lojaLat').value) || null,
      longitude:   parseFloat(document.getElementById('lojaLng').value) || null,
      ativo:       document.getElementById('lojaAtivo').checked,
      atualizado_em: new Date().toISOString(),
      avatar_url,
    };

    const dbClient = await db();
    let error;
    if (currentLoja) {
      ({ error } = await dbClient
        .from('lojas_equipamentos')
        .update(payload)
        .eq('id', currentLoja.id));
    } else {
      const { data, error: e2 } = await dbClient
        .from('lojas_equipamentos')
        .insert({ ...payload, auth_user_id: currentUser.id })
        .select()
        .single();
      error = e2;
      if (!e2) {
        currentLoja = data;
        document.getElementById('bannerSemLoja').classList.add('hidden');
        document.getElementById('secaoEquipamentos').classList.remove('hidden');
        await carregarEquipamentos();
      }
    }

    if (error) throw error;

    if (currentLoja) {
      const { data } = await dbClient
        .from('lojas_equipamentos')
        .select('*')
        .eq('id', currentLoja.id)
        .single();
      currentLoja = data;
      preencherFormLoja(currentLoja);
    }

    lojaAvatarFile = null;
    mostrarOk('okLoja', '✅ Loja salva com sucesso!');
  } catch (err) {
    mostrarErro('erroLoja', 'Erro ao salvar: ' + err.message);
  } finally {
    setBtnLoading('btnSalvarLoja', false, 'Salvar Loja');
  }
}

function previewAvatar(e) {
  const file = e.target.files[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) {
    alert('Imagem muito grande. Máximo 5 MB.');
    return;
  }
  lojaAvatarFile = file;
  const reader = new FileReader();
  reader.onload = ev => {
    const img = document.getElementById('lojaAvatarPreview');
    img.src = ev.target.result;
    img.classList.remove('hidden');
  };
  reader.readAsDataURL(file);
}

// ────────────────────────────────────────────────────────────────
// EQUIPAMENTOS
// ────────────────────────────────────────────────────────────────
async function carregarEquipamentos() {
  if (!currentLoja) return;

  const lista = document.getElementById('listaEquipamentos');
  lista.innerHTML = '<p class="text-sm text-gray-400 text-center py-8">Carregando...</p>';

  const dbClient = await db();
  const { data, error } = await dbClient
    .from('equipamentos')
    .select('*')
    .eq('loja_id', currentLoja.id)
    .eq('deletado', false)
    .order('criado_em', { ascending: false });

  if (error) {
    lista.innerHTML = `<p class="text-sm text-red-500 text-center py-4">Erro: ${error.message}</p>`;
    return;
  }

  if (!data.length) {
    lista.innerHTML = `
      <div class="text-center py-12 text-gray-400">
        <div class="text-5xl mb-3">🔧</div>
        <p class="text-base font-semibold">Nenhum equipamento cadastrado</p>
        <p class="text-sm mt-2">Clique em "➕ Adicionar" para começar seu catálogo.</p>
      </div>`;
    return;
  }

  lista.innerHTML = '';
  data.forEach(eq => lista.appendChild(criarCardEquipamento(eq)));
}

function criarCardEquipamento(eq) {
  const div = document.createElement('div');
  div.className = 'equipment-card';
  div.innerHTML = `
    <div class="flex items-start gap-4">
      <div class="flex-shrink-0">
        ${eq.foto_url
          ? `<img src="${eq.foto_url}" alt="${eq.nome}"
               class="w-20 h-20 rounded-lg object-cover cursor-pointer border-2 border-maestro-primary/20 hover:border-maestro-primary transition-colors"
               onclick="verFoto('${eq.foto_url}')" />`
          : `<div class="w-20 h-20 rounded-lg bg-maestro-light border-2 border-maestro-primary/20 flex items-center justify-center text-3xl">🔧</div>`
        }
      </div>
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 flex-wrap mb-1">
          <span class="font-bold text-maestro-navy">${escaparHtml(eq.nome)}</span>
          ${eq.categoria ? `<span class="badge bg-blue-100 text-blue-700">${escaparHtml(eq.categoria)}</span>` : ''}
          ${!eq.ativo ? `<span class="badge bg-gray-100 text-gray-600">Inativo</span>` : ''}
        </div>
        ${eq.descricao ? `<p class="text-sm text-gray-600 mb-2 line-clamp-2">${escaparHtml(eq.descricao)}</p>` : ''}
        ${eq.preco_diaria ? `<p class="text-base font-bold text-maestro-primary">R$ ${parseFloat(eq.preco_diaria).toFixed(2).replace('.', ',')}/dia</p>` : ''}
      </div>
      <div class="flex gap-2 flex-shrink-0 flex-col sm:flex-row">
        <button onclick="abrirModalEquipamento(${JSON.stringify(eq).replace(/"/g, '&quot;')})"
          class="text-sm font-semibold text-maestro-navy border-2 border-maestro-navy hover:bg-maestro-navy hover:text-white px-3 py-2 rounded-lg transition-all">
          ✏️ Editar
        </button>
        <button onclick="excluirEquipamento('${eq.id}', '${escaparHtml(eq.nome)}')"
          class="text-sm font-semibold text-red-600 border-2 border-red-300 hover:bg-red-600 hover:text-white px-3 py-2 rounded-lg transition-all">
          🗑️ Excluir
        </button>
      </div>
    </div>
  `;
  return div;
}

function populaCategorias() {
  const sel = document.getElementById('eqCategoria');
  CATEGORIAS.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c;
    opt.textContent = c;
    sel.appendChild(opt);
  });
}

function abrirModalEquipamento(eq) {
  eqFotoFile = null;
  eqFotoUrlAtual = null;

  document.getElementById('eqId').value        = eq?.id ?? '';
  document.getElementById('eqNome').value      = eq?.nome ?? '';
  document.getElementById('eqCategoria').value = eq?.categoria ?? '';
  document.getElementById('eqPreco').value     = eq?.preco_diaria ?? '';
  document.getElementById('eqDesc').value      = eq?.descricao ?? '';
  document.getElementById('eqAtivo').checked   = eq?.ativo ?? true;
  limparMensagem('erroEq');

  const preview     = document.getElementById('eqFotoPreview');
  const placeholder = document.getElementById('eqFotoPlaceholder');
  const btnRemover  = document.getElementById('btnRemoverFoto');

  if (eq?.foto_url) {
    eqFotoUrlAtual = eq.foto_url;
    preview.src = eq.foto_url;
    preview.classList.remove('hidden');
    placeholder.classList.add('hidden');
    btnRemover.classList.remove('hidden');
  } else {
    preview.src = '';
    preview.classList.add('hidden');
    placeholder.classList.remove('hidden');
    btnRemover.classList.add('hidden');
  }

  document.getElementById('eqFotoInput').value = '';
  document.getElementById('modalEqTitulo').textContent = eq ? 'Editar Equipamento' : 'Novo Equipamento';
  document.getElementById('modalEquipamento').classList.remove('hidden');
}

function fecharModalEquipamento() {
  document.getElementById('modalEquipamento').classList.add('hidden');
}

function previewFotoEq(e) {
  const file = e.target.files[0];
  if (!file) return;
  if (file.size > 8 * 1024 * 1024) {
    alert('Imagem muito grande. Máximo 8 MB.');
    return;
  }
  eqFotoFile = file;
  const reader = new FileReader();
  reader.onload = ev => {
    const preview = document.getElementById('eqFotoPreview');
    preview.src = ev.target.result;
    preview.classList.remove('hidden');
    document.getElementById('eqFotoPlaceholder').classList.add('hidden');
    document.getElementById('btnRemoverFoto').classList.remove('hidden');
  };
  reader.readAsDataURL(file);
}

function removerFotoEq() {
  eqFotoFile = null;
  eqFotoUrlAtual = null;
  document.getElementById('eqFotoPreview').src = '';
  document.getElementById('eqFotoPreview').classList.add('hidden');
  document.getElementById('eqFotoPlaceholder').classList.remove('hidden');
  document.getElementById('btnRemoverFoto').classList.add('hidden');
  document.getElementById('eqFotoInput').value = '';
}

async function salvarEquipamento(e) {
  e.preventDefault();
  limparMensagem('erroEq');
  setBtnLoading('btnSalvarEq', true, 'Salvando...');

  try {
    let foto_url = eqFotoUrlAtual;

    if (eqFotoFile) {
      const ext  = eqFotoFile.name.split('.').pop().toLowerCase();
      const nome = `${Date.now()}.${ext}`;
      const path = `${currentUser.id}/${nome}`;
      foto_url = await uploadImagem(eqFotoFile, 'equipamentos', path);
    } else if (eqFotoUrlAtual === null) {
      foto_url = null;
    }

    const id = document.getElementById('eqId').value;
    const payload = {
      nome:        document.getElementById('eqNome').value.trim(),
      categoria:   document.getElementById('eqCategoria').value || null,
      preco_diaria: parseFloat(document.getElementById('eqPreco').value) || null,
      descricao:   document.getElementById('eqDesc').value.trim() || null,
      ativo:       document.getElementById('eqAtivo').checked,
      foto_url,
    };

    const dbClient = await db();
    let error;
    if (id) {
      ({ error } = await dbClient.from('equipamentos').update(payload).eq('id', id));
    } else {
      ({ error } = await dbClient.from('equipamentos').insert({
        ...payload,
        loja_id: currentLoja.id,
      }));
    }

    if (error) throw error;

    fecharModalEquipamento();
    await carregarEquipamentos();
  } catch (err) {
    mostrarErro('erroEq', 'Erro ao salvar: ' + err.message);
  } finally {
    setBtnLoading('btnSalvarEq', false, 'Salvar');
  }
}

async function excluirEquipamento(id, nome) {
  if (!confirm(`Tem certeza que deseja excluir "${nome}"?`)) return;

  const dbClient = await db().catch(() => null);
  if (!dbClient) { alert('Sessão expirada. Faça login novamente.'); return; }
  const { error } = await dbClient
    .from('equipamentos')
    .update({ deletado: true })
    .eq('id', id);

  if (error) {
    alert('Erro ao excluir: ' + error.message);
    return;
  }

  await carregarEquipamentos();
}

function verFoto(url) {
  document.getElementById('modalFotoImg').src = url;
  document.getElementById('modalFoto').classList.remove('hidden');
}

// ────────────────────────────────────────────────────────────────
// UPLOAD
// ────────────────────────────────────────────────────────────────
async function uploadImagem(file, bucket, path) {
  const ext  = file.name.split('.').pop().toLowerCase();
  const fullPath = path.includes('.') ? path : `${path}.${ext}`;

  const { data: sessionData } = await sb.auth.getSession();
  const token = sessionData.session?.access_token ?? '';

  const formData = new FormData();
  formData.append('file', file);

  const resp = await fetch(
    `${SUPABASE_URL}/storage/v1/object/${bucket}/${fullPath}`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'x-upsert': 'true' },
      body: formData,
    }
  );

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ message: 'Erro no upload' }));
    throw new Error(err.message ?? 'Erro no upload');
  }

  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${fullPath}`;
}

// ────────────────────────────────────────────────────────────────
// HELPERS
// ────────────────────────────────────────────────────────────────
function mostrarLoading(show) {
  document.getElementById('loadingOverlay').classList.toggle('hidden', !show);
}

function setBtnLoading(id, loading, texto) {
  const btn = document.getElementById(id);
  btn.disabled = loading;
  btn.textContent = loading ? texto : btn.dataset.defaultText ?? texto;
  if (!loading) btn.dataset.defaultText = texto;
}

function mostrarErro(id, msg, cls) {
  const el = document.getElementById(id);
  el.textContent = msg;
  el.className = `text-sm px-3 py-2 rounded-lg border ${cls ?? 'text-red-600 bg-red-50 border-red-200'}`;
  el.classList.remove('hidden');
}

function mostrarOk(id, msg) {
  const el = document.getElementById(id);
  el.textContent = msg;
  el.className = 'text-sm px-3 py-2 rounded-lg border text-green-600 bg-green-50 border-green-200';
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 4000);
}

function limparMensagem(id) {
  document.getElementById(id)?.classList.add('hidden');
}

function traduzirErroAuth(msg) {
  if (msg.includes('Invalid login credentials')) return 'E-mail ou senha incorretos.';
  if (msg.includes('Email not confirmed'))       return 'E-mail ainda não confirmado. Verifique sua caixa de entrada.';
  if (msg.includes('User already registered'))   return 'Este e-mail já está cadastrado. Tente entrar.';
  if (msg.includes('Password should be'))        return 'A senha deve ter pelo menos 6 caracteres.';
  return msg;
}

function mascararTelefone(input) {
  let v = input.value.replace(/\D/g, '').substring(0, 11);
  if (v.length >= 7) {
    v = v.length === 11
      ? v.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')
      : v.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3');
  } else if (v.length >= 3) {
    v = v.replace(/(\d{2})(\d+)/, '($1) $2');
  }
  input.value = v;
}

function escaparHtml(str) {
  if (!str) return '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// Fechar modal ao clicar fora
document.getElementById('modalEquipamento').addEventListener('click', function(e) {
  if (e.target === this) fecharModalEquipamento();
});
