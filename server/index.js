const express = require('express');
const cors = require('cors');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const db = require('./database');
const whatsapp = require('./whatsapp');
const localizacao = require('./localizacao');

const app = express();
app.use(cors());
app.use(express.json());

// ============ AUTENTICAÇÃO ============
app.post('/api/auth/login', (req, res) => {
  const { email, senha } = req.body;

  if (!email || !senha) {
    return res.status(400).json({ error: 'Email e senha são obrigatórios' });
  }

  // Em produção, use bcrypt para comparar hash!
  const usuario = db.prepare('SELECT * FROM funcionarios WHERE email = ? AND ativo = 1').get(email);

  if (!usuario || usuario.senha !== senha) {
    return res.status(401).json({ error: 'Credenciais inválidas' });
  }

  // Remover a senha do objeto retornado
  const { senha: _, ...usuarioSemSenha } = usuario;

  res.json({
    success: true,
    user: usuarioSemSenha,
    token: 'fake-jwt-token-for-now' // Futuro: Implementar JWT real
  });
});

app.post('/api/auth/register', (req, res) => {
  const { nome, email, senha, telefone, crm, uf, especialidade } = req.body;

  if (!nome || !email || !senha) {
    return res.status(400).json({ error: 'Nome, email e senha são obrigatórios' });
  }

  const existingUser = db.prepare('SELECT id FROM funcionarios WHERE email = ?').get(email);
  if (existingUser) {
    return res.status(400).json({ error: 'Email já cadastrado' });
  }

  const id = uuidv4();
  // Se informou CRM, é médico. Se não, é gestor? 
  // O sistema parece focar em gestores de escala (que costumam ser médicos chefes).
  // Vou salvar como 'medico' se tiver CRM, ou manter 'gestor' como padrão
  // O usuário pediu "Cadastro", assumindo que ele quer acessar o sistema.
  const tipo = crm ? 'medico' : 'gestor';
  const crmFormatado = crm ? `${crm}/${uf}` : null;
  const especialidadeFinal = especialidade || (crm ? 'Geral' : null);

  db.prepare(`
    INSERT INTO funcionarios (id, nome, email, senha, telefone, tipo, cargo, ativo, crm, especialidade) 
    VALUES (?, ?, ?, ?, ?, ?, 'Gestor/Médico', 1, ?, ?)
  `).run(id, nome, email, senha, telefone, tipo, crmFormatado, especialidadeFinal);

  res.json({ success: true, message: 'Cadastro realizado com sucesso' });
});


const { OAuth2Client } = require('google-auth-library');
const googleClient = new OAuth2Client("869821071891-ut47oq6o3thvnfudni1nun3tk0n8kl2n.apps.googleusercontent.com");

// ============ SOCIAL LOGIN UNIFICADO ============
app.post('/api/auth/social-login', async (req, res) => {
  const { provider, token, email, nome, photo, code, profile } = req.body;

  // Aceita tanto formato legado quanto novo
  const userEmail = email || (profile && profile.email);
  const userName = nome || (profile && profile.name);
  const userPhoto = photo || (profile && profile.picture);

  if (!userEmail || !provider) {
    return res.status(400).json({ error: 'Dados insuficientes para login social' });
  }

  // ===================================================
  // GOOGLE - Verificação de Token
  // ===================================================
  if (provider === 'google' && token) {
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken: token,
        audience: "869821071891-ut47oq6o3thvnfudni1nun3tk0n8kl2n.apps.googleusercontent.com",
      });
      const payload = ticket.getPayload();
      console.log('✅ Google Auth verificado:', payload.email);
    } catch (error) {
      console.error('❌ Erro na validação do token Google:', error.message);
      return res.status(401).json({ error: 'Token Google inválido' });
    }
  }

  // ===================================================
  // APPLE - Verificação de Token
  // ===================================================
  if (provider === 'apple' && token) {
    try {
      // Decodificar JWT da Apple (verificação básica)
      const payload = JSON.parse(atob(token.split('.')[1]));
      console.log('✅ Apple Auth recebido:', payload.email || payload.sub);
      // Nota: Para produção, verificar assinatura com chave pública da Apple
      // https://developer.apple.com/documentation/sign_in_with_apple/sign_in_with_apple_rest_api/verifying_a_user
    } catch (error) {
      console.error('❌ Erro na validação do token Apple:', error.message);
      return res.status(401).json({ error: 'Token Apple inválido' });
    }
  }

  // ===================================================
  // MICROSOFT - Verificação de Token  
  // ===================================================
  if (provider === 'microsoft' && token) {
    try {
      // Decodificar JWT da Microsoft (verificação básica)
      const payload = JSON.parse(atob(token.split('.')[1]));
      console.log('✅ Microsoft Auth recebido:', payload.preferred_username || payload.email);
      // Nota: Para produção, verificar com JWKS da Microsoft
      // https://login.microsoftonline.com/common/discovery/v2.0/keys
    } catch (error) {
      console.error('❌ Erro na validação do token Microsoft:', error.message);
      return res.status(401).json({ error: 'Token Microsoft inválido' });
    }
  }

  // Verificar se o usuário existe
  let usuario = db.prepare('SELECT * FROM funcionarios WHERE email = ?').get(userEmail);

  if (!usuario) {
    // Cadastro automático via Social Login
    const id = uuidv4();
    db.prepare(`
      INSERT INTO funcionarios (id, nome, email, tipo, cargo, ativo, foto_url) 
      VALUES (?, ?, ?, 'gestor', 'Gestor (Social)', 1, ?)
    `).run(id, userName || userEmail.split('@')[0], userEmail, userPhoto || '');

    usuario = db.prepare('SELECT * FROM funcionarios WHERE id = ?').get(id);
    console.log('📝 Novo usuário criado via', provider, ':', userEmail);
  } else if (usuario.ativo === 0) {
    return res.status(401).json({ error: 'Usuário desativado' });
  }

  const { senha: _, ...usuarioSemSenha } = usuario;

  res.json({
    success: true,
    user: usuarioSemSenha,
    token: `${provider}-token-${uuidv4()}`
  });
});

// ============ MICROSOFT OAuth CALLBACK ============
app.get('/api/auth/microsoft/callback', async (req, res) => {
  const { code, state, error, error_description } = req.query;

  if (error) {
    console.error('❌ Microsoft OAuth Error:', error, error_description);
    return res.redirect(`/?error=${encodeURIComponent(error_description || error)}`);
  }

  if (!code) {
    return res.redirect('/?error=Código de autorização não recebido');
  }

  try {
    // Configurações Microsoft Azure AD
    const MICROSOFT_CLIENT_ID = process.env.MICROSOFT_CLIENT_ID || '3a9e9d2c-7d9f-432a-a9fd-9d09d92c74f5';
    const MICROSOFT_CLIENT_SECRET = process.env.MICROSOFT_CLIENT_SECRET || ''; // Criar no Azure Portal
    const MICROSOFT_TENANT_ID = process.env.MICROSOFT_TENANT_ID || 'a4567b83-cd65-4d18-a9ca-34b28f4a7fbd';
    const MICROSOFT_REDIRECT_URI = process.env.MICROSOFT_REDIRECT_URI || `${req.protocol}://${req.get('host')}/api/auth/microsoft/callback`;

    // URL de token usando o tenant específico
    const tokenUrl = `https://login.microsoftonline.com/${MICROSOFT_TENANT_ID}/oauth2/v2.0/token`;

    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: MICROSOFT_CLIENT_ID,
        client_secret: MICROSOFT_CLIENT_SECRET,
        code: code,
        redirect_uri: MICROSOFT_REDIRECT_URI,
        grant_type: 'authorization_code',
        scope: 'openid profile email User.Read'
      })
    });

    const tokens = await tokenResponse.json();

    if (tokens.error) {
      console.error('❌ Microsoft Token Error:', tokens.error, tokens.error_description);
      // Se não tiver client_secret, tentar método alternativo (apenas para SPA/Mobile)
      if (tokens.error === 'invalid_client') {
        console.log('⚠️ Client Secret não configurado. Configure MICROSOFT_CLIENT_SECRET nas variáveis de ambiente.');
        return res.redirect('/?error=Configuração do login Microsoft incompleta. Entre em contato com o suporte.');
      }
      return res.redirect(`/?error=${encodeURIComponent(tokens.error_description || tokens.error)}`);
    }

    // Decodificar ID token para pegar dados do usuário
    const payload = JSON.parse(atob(tokens.id_token.split('.')[1]));
    const email = payload.preferred_username || payload.email || payload.upn;
    const nome = payload.name;
    
    console.log('✅ Microsoft Auth verificado:', email, '| Nome:', nome);

    // Verificar/criar usuário
    let usuario = db.prepare('SELECT * FROM funcionarios WHERE email = ?').get(email);

    if (!usuario) {
      const id = uuidv4();
      db.prepare(`
        INSERT INTO funcionarios (id, nome, email, tipo, cargo, ativo) 
        VALUES (?, ?, ?, 'gestor', 'Gestor (Microsoft)', 1)
      `).run(id, nome || email.split('@')[0], email);
      usuario = db.prepare('SELECT * FROM funcionarios WHERE id = ?').get(id);
      console.log('📝 Novo usuário criado via Microsoft:', email);
    }

    // Redirecionar com dados para o frontend processar
    const authData = encodeURIComponent(JSON.stringify({
      success: true,
      provider: 'microsoft',
      user: { id: usuario.id, nome: usuario.nome, email: usuario.email, tipo: usuario.tipo },
      token: `microsoft-token-${uuidv4()}`
    }));

    res.redirect(`/?auth=${authData}`);
  } catch (err) {
    console.error('❌ Microsoft Callback Error:', err);
    res.redirect('/?error=Erro ao processar login com Microsoft');
  }
});

// ============ APPLE OAuth CALLBACK ============
app.post('/api/auth/apple/callback', async (req, res) => {
  const { code, id_token, state, user } = req.body;

  if (!id_token && !code) {
    return res.status(400).json({ error: 'Token ou código não recebido' });
  }

  try {
    // Decodificar ID token
    const payload = JSON.parse(atob(id_token.split('.')[1]));
    const email = payload.email || (user && JSON.parse(user).email);
    const nome = user ? JSON.parse(user).name : null;

    // Verificar/criar usuário
    let usuario = db.prepare('SELECT * FROM funcionarios WHERE email = ?').get(email);

    if (!usuario) {
      const id = uuidv4();
      const fullName = nome ? `${nome.firstName || ''} ${nome.lastName || ''}`.trim() : email.split('@')[0];
      db.prepare(`
        INSERT INTO funcionarios (id, nome, email, tipo, cargo, ativo) 
        VALUES (?, ?, ?, 'gestor', 'Gestor (Apple)', 1)
      `).run(id, fullName, email);
      usuario = db.prepare('SELECT * FROM funcionarios WHERE id = ?').get(id);
    }

    res.json({
      success: true,
      user: { id: usuario.id, nome: usuario.nome, email: usuario.email },
      token: `apple-token-${uuidv4()}`
    });
  } catch (err) {
    console.error('❌ Apple Callback Error:', err);
    res.status(500).json({ error: 'Erro ao processar login com Apple' });
  }
});


// ============ CONSULTA CRM ============
// API oficial: Consultar.io (R$ 0,20 por consulta)
// Site: https://consultar.io | Painel: https://consultar.io/painel/

const CONSULTARIO_API_KEY = process.env.CONSULTARIO_KEY || 'eaea57f17a96235b067cd0ffaefc8801fa737603';

// Estado mutável do modo CRM (pode ser alterado em runtime)
let currentCrmMode = process.env.CRM_MODE || 'CONSULTARIO';

app.get('/api/crm/consulta', async (req, res) => {
  const { crm, uf } = req.query;

  if (!crm || !uf) {
    return res.status(400).json({ error: 'CRM e UF são obrigatórios' });
  }

  const crmClean = crm.toString().replace(/\D/g, '');
  const ufClean = uf.toUpperCase().trim();

  // Validação básica
  if (crmClean.length < 3 || crmClean.length > 10) {
    return res.status(400).json({ error: 'CRM inválido (formato incorreto)' });
  }

  const ufsValidas = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];
  if (!ufsValidas.includes(ufClean)) {
    return res.status(400).json({ error: `UF inválida: ${ufClean}` });
  }

  console.log(`🔍 Consulta CRM ${crmClean}/${ufClean} - Modo: ${currentCrmMode}`);

  // ===================================================
  // MODO: CONSULTAR.IO (API Oficial - Paga R$ 0,20/consulta)
  // ===================================================
  if (currentCrmMode === 'CONSULTARIO') {
    if (!CONSULTARIO_API_KEY) {
      return res.status(501).json({ error: 'Consultar.io não configurado. Defina CONSULTARIO_KEY.' });
    }
    
    try {
      const response = await fetch(`https://consultar.io/api/v1/crm/consultar?uf=${ufClean}&numero_registro=${crmClean}`, {
        headers: { 'Authorization': `Token ${CONSULTARIO_API_KEY}` }
      });
      const data = await response.json();
      
      if (data.error) {
        return res.status(response.status).json({ 
          error: data.message || 'CRM não encontrado',
          fonte: 'Consultar.io'
        });
      }
      
      return res.json({
        nome: data.nome_razao_social,
        crm: data.numero_registro,
        uf: data.uf,
        situacao: data.situacao,
        especialidade: data.especialidades || '',
        tipoInscricao: data.tipo_inscricao,
        categoria: data.categoria,
        fonte: 'Consultar.io'
      });
    } catch (error) {
      console.error('❌ Erro Consultar.io:', error);
      return res.status(500).json({ error: 'Erro ao consultar Consultar.io' });
    }
  }

  // ===================================================
  // MODO: MOCK (Simulação para Desenvolvimento)
  // ===================================================
  // Atraso artificial para parecer requisição real
  await new Promise(r => setTimeout(r, 500 + Math.random() * 500));

  const lastDigit = parseInt(crmClean.slice(-1));
  const especialidades = ['Cardiologia', 'Pediatria', 'Clínica Médica', 'Ortopedia', 'Neurologia', 
                          'Ginecologia', 'Cirurgia Geral', 'Dermatologia', 'Psiquiatria', 'Anestesiologia'];
  const nomes = ['Ana Silva', 'Carlos Santos', 'Maria Oliveira', 'João Souza', 'Patricia Pereira',
                 'Roberto Lima', 'Fernanda Costa', 'Ricardo Almeida', 'Juliana Martins', 'Bruno Ferreira'];
  const situacoes = ['Regular', 'Regular', 'Regular', 'Regular', 'Regular', 'Regular', 'Regular', 'Regular', 'Irregular', 'Cancelado'];

  res.json({
    nome: `Dr(a). ${nomes[lastDigit] || 'Médico Teste'}`,
    crm: crmClean,
    uf: ufClean,
    situacao: situacoes[lastDigit] || 'Regular',
    especialidade: especialidades[lastDigit] || 'Clínica Médica',
    tipoInscricao: 'Principal',
    data_inscricao: `${10 + lastDigit}/0${(lastDigit % 9) + 1}/20${10 + lastDigit}`,
    fonte: 'Mock (simulação)',
    aviso: 'Dados simulados para desenvolvimento. Configure CRM_MODE=SCRAPER para dados reais.'
  });
});

// ============ CRM - CONFIGURAÇÃO E STATUS ============
app.get('/api/crm/config', (req, res) => {
  res.json({
    modoAtual: currentCrmMode,
    modosDisponiveis: ['MOCK', 'CONSULTARIO'],
    consultarioConfigurado: !!CONSULTARIO_API_KEY,
    custos: {
      MOCK: 'Gratuito (dados simulados)',
      CONSULTARIO: 'R$ 0,20 por consulta (Consultar.io)'
    },
    recarregar: 'https://consultar.io/painel/'
  });
});

app.post('/api/crm/config', (req, res) => {
  const { modo } = req.body;
  
  const modosValidos = ['MOCK', 'CONSULTARIO'];
  if (!modosValidos.includes(modo)) {
    return res.status(400).json({ error: `Modo inválido. Use: ${modosValidos.join(', ')}` });
  }
  
  if (modo === 'CONSULTARIO' && !CONSULTARIO_API_KEY) {
    return res.status(400).json({ error: 'CONSULTARIO_KEY não configurada' });
  }
  
  currentCrmMode = modo;
  console.log(`✅ Modo CRM alterado para: ${modo}`);
  
  res.json({ 
    success: true, 
    modoAtual: currentCrmMode,
    mensagem: `Modo de consulta CRM alterado para ${modo}`
  });
});

// ============ FUNCIONÁRIOS / MÉDICOS ============
app.get('/api/funcionarios', (req, res) => {
  const { tipo, gestor_id } = req.query;
  let query = 'SELECT * FROM funcionarios WHERE ativo = 1';
  const params = [];

  if (tipo) {
    query += ' AND tipo = ?';
    params.push(tipo);
  }
  if (gestor_id) {
    query += ' AND gestor_id = ?';
    params.push(gestor_id);
  }
  query += ' ORDER BY nome';

  const funcionarios = db.prepare(query).all(...params);
  res.json(funcionarios);
});

app.get('/api/funcionarios/:id', (req, res) => {
  const funcionario = db.prepare('SELECT * FROM funcionarios WHERE id = ?').get(req.params.id);
  res.json(funcionario);
});

app.post('/api/funcionarios', (req, res) => {
  const { nome, email, senha, telefone, whatsapp: whatsappNum, cargo, especialidade, crm, tipo, gestor_id, salario_hora, unidade_id } = req.body;
  const id = uuidv4();
  const senhaFinal = senha || 'santacasa123'; // Senha padrão se não informada

  db.prepare(`
    INSERT INTO funcionarios (id, nome, email, senha, telefone, whatsapp, cargo, especialidade, crm, tipo, gestor_id, salario_hora, unidade_id) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, nome, email, senhaFinal, telefone, whatsappNum || telefone, cargo, especialidade, crm, tipo || 'medico', gestor_id, salario_hora || 0, unidade_id);

  res.json({ id, nome, email, telefone, whatsapp: whatsappNum, cargo, especialidade, crm, tipo, gestor_id, salario_hora, unidade_id });
});

app.put('/api/funcionarios/:id', (req, res) => {
  const { nome, email, telefone, whatsapp: whatsappNum, cargo, especialidade, crm, tipo, gestor_id, salario_hora, unidade_id } = req.body;
  db.prepare(`
    UPDATE funcionarios 
    SET nome = ?, email = ?, telefone = ?, whatsapp = ?, cargo = ?, especialidade = ?, crm = ?, tipo = ?, gestor_id = ?, salario_hora = ?, unidade_id = ?
    WHERE id = ?
  `).run(nome, email, telefone, whatsappNum || telefone, cargo, especialidade, crm, tipo, gestor_id, salario_hora, unidade_id, req.params.id);
  res.json({ success: true });
});

app.delete('/api/funcionarios/:id', (req, res) => {
  db.prepare('UPDATE funcionarios SET ativo = 0 WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// Listar gestores
app.get('/api/gestores', (req, res) => {
  const gestores = db.prepare("SELECT * FROM funcionarios WHERE tipo IN ('gestor', 'admin') AND ativo = 1 ORDER BY nome").all();
  res.json(gestores);
});

// Listar médicos de um gestor
app.get('/api/gestores/:id/medicos', (req, res) => {
  const medicos = db.prepare('SELECT * FROM funcionarios WHERE gestor_id = ? AND ativo = 1 ORDER BY nome').all(req.params.id);
  res.json(medicos);
});

// ============ TURNOS ============
app.get('/api/turnos', (req, res) => {
  const turnos = db.prepare('SELECT * FROM turnos WHERE ativo = 1').all();
  res.json(turnos);
});

app.post('/api/turnos', (req, res) => {
  const { nome, hora_inicio, hora_fim, dias_semana } = req.body;
  const id = uuidv4();
  db.prepare('INSERT INTO turnos (id, nome, hora_inicio, hora_fim, dias_semana) VALUES (?, ?, ?, ?, ?)')
    .run(id, nome, hora_inicio, hora_fim, JSON.stringify(dias_semana));
  res.json({ id, nome, hora_inicio, hora_fim, dias_semana });
});

app.delete('/api/turnos/:id', (req, res) => {
  db.prepare('UPDATE turnos SET ativo = 0 WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ============ ESCALAS ============
app.get('/api/escalas', (req, res) => {
  const { data_inicio, data_fim, funcionario_id, gestor_id } = req.query;
  let query = `
    SELECT e.*, f.nome as funcionario_nome, f.especialidade, f.whatsapp, t.nome as turno_nome 
    FROM escalas e 
    LEFT JOIN funcionarios f ON e.funcionario_id = f.id
    LEFT JOIN turnos t ON e.turno_id = t.id
    WHERE 1=1
  `;
  const params = [];

  if (data_inicio && data_fim) {
    query += ' AND e.data BETWEEN ? AND ?';
    params.push(data_inicio, data_fim);
  }
  if (funcionario_id) {
    query += ' AND e.funcionario_id = ?';
    params.push(funcionario_id);
  }
  if (gestor_id) {
    query += ' AND f.gestor_id = ?';
    params.push(gestor_id);
  }
  query += ' ORDER BY e.data, e.hora_inicio';

  const escalas = db.prepare(query).all(...params);
  res.json(escalas);
});

app.post('/api/escalas', async (req, res) => {
  const { funcionario_id, turno_id, data, hora_inicio, hora_fim } = req.body;
  const id = uuidv4();
  db.prepare('INSERT INTO escalas (id, funcionario_id, turno_id, data, hora_inicio, hora_fim) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, funcionario_id, turno_id, data, hora_inicio, hora_fim);

  // Criar registro de presença
  const presencaId = uuidv4();
  db.prepare('INSERT INTO presencas (id, escala_id, funcionario_id, data) VALUES (?, ?, ?, ?)')
    .run(presencaId, id, funcionario_id, data);

  // Criar aviso
  const avisoId = uuidv4();
  const func = db.prepare('SELECT nome FROM funcionarios WHERE id = ?').get(funcionario_id);
  db.prepare('INSERT INTO avisos (id, tipo, titulo, mensagem, funcionario_id) VALUES (?, ?, ?, ?, ?)')
    .run(avisoId, 'escala', 'Nova Escala', `Escala agendada para ${data} - ${hora_inicio} às ${hora_fim}`, funcionario_id);

  res.json({ id, funcionario_id, turno_id, data, hora_inicio, hora_fim });
});

app.post('/api/escalas/gerar-automatico', async (req, res) => {
  const { data_inicio, data_fim, turno_id, gestor_id } = req.body;
  const turno = db.prepare('SELECT * FROM turnos WHERE id = ?').get(turno_id);

  let queryFuncs = 'SELECT * FROM funcionarios WHERE ativo = 1';
  if (gestor_id) {
    queryFuncs += ' AND gestor_id = ?';
  }
  const funcionarios = gestor_id
    ? db.prepare(queryFuncs).all(gestor_id)
    : db.prepare(queryFuncs).all();

  if (!turno || funcionarios.length === 0) {
    return res.status(400).json({ error: 'Turno ou funcionários não encontrados' });
  }

  const diasSemana = JSON.parse(turno.dias_semana);
  const escalasGeradas = [];

  let dataAtual = new Date(data_inicio);
  const dataFinal = new Date(data_fim);
  let funcionarioIndex = 0;

  while (dataAtual <= dataFinal) {
    const diaSemana = dataAtual.getDay();
    if (diasSemana.includes(diaSemana)) {
      const funcionario = funcionarios[funcionarioIndex % funcionarios.length];
      const dataStr = dataAtual.toISOString().split('T')[0];

      const id = uuidv4();
      db.prepare('INSERT INTO escalas (id, funcionario_id, turno_id, data, hora_inicio, hora_fim) VALUES (?, ?, ?, ?, ?, ?)')
        .run(id, funcionario.id, turno.id, dataStr, turno.hora_inicio, turno.hora_fim);

      const presencaId = uuidv4();
      db.prepare('INSERT INTO presencas (id, escala_id, funcionario_id, data) VALUES (?, ?, ?, ?)')
        .run(presencaId, id, funcionario.id, dataStr);

      escalasGeradas.push({ id, funcionario_id: funcionario.id, funcionario_nome: funcionario.nome, data: dataStr });
      funcionarioIndex++;
    }
    dataAtual.setDate(dataAtual.getDate() + 1);
  }

  res.json({ escalas_geradas: escalasGeradas.length, escalas: escalasGeradas });
});

// Trocar escala entre funcionários
app.post('/api/escalas/trocar', async (req, res) => {
  const { escala_id, novo_funcionario_id } = req.body;

  const escala = db.prepare(`
    SELECT e.*, f.id as original_id, f.nome as original_nome
    FROM escalas e
    JOIN funcionarios f ON e.funcionario_id = f.id
    WHERE e.id = ?
  `).get(escala_id);

  if (!escala) {
    return res.status(404).json({ error: 'Escala não encontrada' });
  }

  // Atualizar escala
  db.prepare('UPDATE escalas SET funcionario_id = ? WHERE id = ?').run(novo_funcionario_id, escala_id);

  // Atualizar presença
  db.prepare('UPDATE presencas SET funcionario_id = ? WHERE escala_id = ?').run(novo_funcionario_id, escala_id);

  // Notificar troca
  await whatsapp.notificarTroca(escala.original_id, novo_funcionario_id, escala.data, `${escala.hora_inicio} - ${escala.hora_fim}`);

  res.json({ success: true });
});

app.put('/api/escalas/:id', (req, res) => {
  const { funcionario_id, data, hora_inicio, hora_fim, status } = req.body;
  db.prepare('UPDATE escalas SET funcionario_id = ?, data = ?, hora_inicio = ?, hora_fim = ?, status = ? WHERE id = ?')
    .run(funcionario_id, data, hora_inicio, hora_fim, status, req.params.id);

  db.prepare('UPDATE presencas SET funcionario_id = ?, data = ? WHERE escala_id = ?')
    .run(funcionario_id, data, req.params.id);

  res.json({ success: true });
});

app.delete('/api/escalas/:id', (req, res) => {
  db.prepare('DELETE FROM presencas WHERE escala_id = ?').run(req.params.id);
  db.prepare('DELETE FROM escalas WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ============ CALENDÁRIO - EXPORTAÇÃO (.ICS) ============

// Gerar arquivo .ics (iCalendar) para um funcionário
app.get('/api/calendario/ics/:funcionario_id', (req, res) => {
  try {
    const { funcionario_id } = req.params;
    const { data_inicio, data_fim } = req.query;
    
    const funcionario = db.prepare('SELECT * FROM funcionarios WHERE id = ?').get(funcionario_id);
    if (!funcionario) {
      return res.status(404).json({ error: 'Funcionário não encontrado' });
    }
    
    // Buscar escalas do período (ou próximos 90 dias)
    const inicio = data_inicio || new Date().toISOString().split('T')[0];
    const fim = data_fim || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    const escalas = db.prepare(`
      SELECT e.*, t.nome as turno_nome, h.nome as hospital_nome, h.endereco as hospital_endereco
      FROM escalas e
      LEFT JOIN turnos t ON e.turno_id = t.id
      LEFT JOIN hospitais h ON t.hospital_id = h.id
      WHERE e.funcionario_id = ? AND e.data BETWEEN ? AND ?
      ORDER BY e.data, e.hora_inicio
    `).all(funcionario_id, inicio, fim);
    
    // Gerar conteúdo .ics
    let ics = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//EscalaPro//NONSGML v1.0//PT
CALSCALE:GREGORIAN
METHOD:PUBLISH
X-WR-CALNAME:Escalas - ${funcionario.nome}
X-WR-TIMEZONE:America/Sao_Paulo
`;
    
    escalas.forEach(escala => {
      const dtStart = escala.data.replace(/-/g, '') + 'T' + escala.hora_inicio.replace(/:/g, '') + '00';
      const dtEnd = escala.data.replace(/-/g, '') + 'T' + escala.hora_fim.replace(/:/g, '') + '00';
      const uid = `${escala.id}@escalapro.com.br`;
      const now = format(new Date(), "yyyyMMdd'T'HHmmss");
      
      ics += `BEGIN:VEVENT
UID:${uid}
DTSTAMP:${now}Z
DTSTART;TZID=America/Sao_Paulo:${dtStart}
DTEND;TZID=America/Sao_Paulo:${dtEnd}
SUMMARY:🏥 Plantão - ${escala.turno_nome || 'Plantão'}
DESCRIPTION:Escala de trabalho no ${escala.hospital_nome || 'Hospital'}
LOCATION:${escala.hospital_endereco || escala.hospital_nome || ''}
STATUS:CONFIRMED
CATEGORIES:Plantão,Trabalho
BEGIN:VALARM
TRIGGER:-PT60M
ACTION:DISPLAY
DESCRIPTION:Lembrete: Plantão em 1 hora
END:VALARM
END:VEVENT
`;
    });
    
    ics += 'END:VCALENDAR';
    
    // Enviar arquivo
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="escalas-${funcionario.nome.replace(/\s+/g, '-').toLowerCase()}.ics"`);
    res.send(ics);
  } catch (error) {
    console.error('Erro ao gerar ICS:', error);
    res.status(500).json({ error: error.message });
  }
});

// URL de inscrição de calendário (para sincronização automática)
app.get('/api/calendario/subscribe/:funcionario_id', (req, res) => {
  try {
    const { funcionario_id } = req.params;
    
    const funcionario = db.prepare('SELECT * FROM funcionarios WHERE id = ?').get(funcionario_id);
    if (!funcionario) {
      return res.status(404).json({ error: 'Funcionário não encontrado' });
    }
    
    // Gerar URL de inscrição
    const baseUrl = process.env.BASE_URL || `http://localhost:${PORT}`;
    const subscribeUrl = `${baseUrl}/api/calendario/ics/${funcionario_id}`;
    
    // URLs específicas para cada plataforma
    const googleCalendarUrl = `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(subscribeUrl)}`;
    const outlookUrl = `https://outlook.live.com/calendar/0/addcalendar?name=Escalas%20EscalaPro&url=${encodeURIComponent(subscribeUrl)}`;
    
    res.json({
      funcionario: funcionario.nome,
      url_download: subscribeUrl,
      url_subscribe: subscribeUrl.replace('http://', 'webcal://').replace('https://', 'webcal://'),
      instrucoes: {
        google: {
          url: googleCalendarUrl,
          passos: [
            '1. Clique no link ou copie a URL',
            '2. No Google Calendar, vá em "Configurações" > "Adicionar calendário"',
            '3. Selecione "De URL" e cole a URL de inscrição'
          ]
        },
        outlook: {
          url: outlookUrl,
          passos: [
            '1. Clique no link ou copie a URL',
            '2. No Outlook, vá em "Adicionar calendário" > "Assinar da web"',
            '3. Cole a URL de inscrição'
          ]
        },
        apple: {
          url: subscribeUrl.replace('http://', 'webcal://').replace('https://', 'webcal://'),
          passos: [
            '1. Abra o aplicativo Calendário no iPhone/Mac',
            '2. Vá em "Arquivo" > "Nova Assinatura de Calendário"',
            '3. Cole a URL de inscrição'
          ]
        },
        download: {
          url: subscribeUrl,
          passos: [
            '1. Clique para baixar o arquivo .ics',
            '2. Abra com seu aplicativo de calendário preferido'
          ]
        }
      }
    });
  } catch (error) {
    console.error('Erro ao gerar URL de inscrição:', error);
    res.status(500).json({ error: error.message });
  }
});

// Gerar arquivo .ics de todas escalas de um gestor/setor
app.get('/api/calendario/ics-equipe/:gestor_id', (req, res) => {
  try {
    const { gestor_id } = req.params;
    const { data_inicio, data_fim } = req.query;
    
    const gestor = db.prepare('SELECT * FROM gestores WHERE id = ?').get(gestor_id);
    if (!gestor) {
      return res.status(404).json({ error: 'Gestor não encontrado' });
    }
    
    const inicio = data_inicio || new Date().toISOString().split('T')[0];
    const fim = data_fim || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    const escalas = db.prepare(`
      SELECT e.*, f.nome as funcionario_nome, t.nome as turno_nome, h.nome as hospital_nome
      FROM escalas e
      JOIN funcionarios f ON e.funcionario_id = f.id
      LEFT JOIN turnos t ON e.turno_id = t.id
      LEFT JOIN hospitais h ON t.hospital_id = h.id
      WHERE f.gestor_id = ? AND e.data BETWEEN ? AND ?
      ORDER BY e.data, e.hora_inicio
    `).all(gestor_id, inicio, fim);
    
    let ics = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//EscalaPro//NONSGML v1.0//PT
CALSCALE:GREGORIAN
METHOD:PUBLISH
X-WR-CALNAME:Escalas Equipe - ${gestor.setor}
X-WR-TIMEZONE:America/Sao_Paulo
`;
    
    escalas.forEach(escala => {
      const dtStart = escala.data.replace(/-/g, '') + 'T' + escala.hora_inicio.replace(/:/g, '') + '00';
      const dtEnd = escala.data.replace(/-/g, '') + 'T' + escala.hora_fim.replace(/:/g, '') + '00';
      const uid = `${escala.id}@escalapro.com.br`;
      const now = format(new Date(), "yyyyMMdd'T'HHmmss");
      
      ics += `BEGIN:VEVENT
UID:${uid}
DTSTAMP:${now}Z
DTSTART;TZID=America/Sao_Paulo:${dtStart}
DTEND;TZID=America/Sao_Paulo:${dtEnd}
SUMMARY:${escala.funcionario_nome} - ${escala.turno_nome || 'Plantão'}
DESCRIPTION:Plantão de ${escala.funcionario_nome}
LOCATION:${escala.hospital_nome || ''}
STATUS:CONFIRMED
CATEGORIES:Equipe,Plantão
END:VEVENT
`;
    });
    
    ics += 'END:VCALENDAR';
    
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="escalas-equipe-${gestor.setor.replace(/\s+/g, '-').toLowerCase()}.ics"`);
    res.send(ics);
  } catch (error) {
    console.error('Erro ao gerar ICS equipe:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============ PRESENÇAS / FUROS ============
app.get('/api/presencas', (req, res) => {
  const { data_inicio, data_fim, status, funcionario_id, gestor_id } = req.query;
  let query = `
    SELECT p.*, f.nome as funcionario_nome, f.especialidade, f.whatsapp, e.hora_inicio as hora_esperada_inicio, e.hora_fim as hora_esperada_fim
    FROM presencas p
    LEFT JOIN funcionarios f ON p.funcionario_id = f.id
    LEFT JOIN escalas e ON p.escala_id = e.id
    WHERE 1=1
  `;
  const params = [];

  if (data_inicio && data_fim) {
    query += ' AND p.data BETWEEN ? AND ?';
    params.push(data_inicio, data_fim);
  }
  if (status) {
    query += ' AND p.status = ?';
    params.push(status);
  }
  if (funcionario_id) {
    query += ' AND p.funcionario_id = ?';
    params.push(funcionario_id);
  }
  if (gestor_id) {
    query += ' AND f.gestor_id = ?';
    params.push(gestor_id);
  }
  query += ' ORDER BY p.data DESC';

  const presencas = db.prepare(query).all(...params);
  res.json(presencas);
});

// Registrar ponto manualmente (entrada ou saída)
app.post('/api/presencas/registrar-ponto', async (req, res) => {
  const { funcionario_id, tipo } = req.body; // tipo: 'entrada' ou 'saida'
  const hoje = new Date().toISOString().split('T')[0];
  const agora = new Date().toTimeString().split(' ')[0].substring(0, 5); // HH:MM

  try {
    // Buscar presença do dia para este funcionário
    const presenca = db.prepare(`
      SELECT p.*, e.hora_inicio, e.hora_fim 
      FROM presencas p 
      LEFT JOIN escalas e ON p.escala_id = e.id 
      WHERE p.funcionario_id = ? AND p.data = ?
    `).get(funcionario_id, hoje);

    // Se não existe presença, criar uma avulsa (ponto sem escala)
    let presencaAtual = presenca;
    if (!presenca) {
      const novaPresencaId = uuidv4();
      db.prepare(`
        INSERT INTO presencas (id, funcionario_id, data, status) 
        VALUES (?, ?, ?, 'pendente')
      `).run(novaPresencaId, funcionario_id, hoje);

      presencaAtual = {
        id: novaPresencaId,
        funcionario_id,
        data: hoje,
        hora_entrada: null,
        hora_saida: null,
        hora_inicio: null,
        hora_fim: null
      };
    }

    if (tipo === 'entrada') {
      if (presencaAtual.hora_entrada) {
        return res.status(400).json({
          success: false,
          error: 'Entrada já registrada'
        });
      }

      // Determinar status baseado no horário
      let status = 'presente';
      if (presencaAtual.hora_inicio) {
        const [horaEsperada, minEsperado] = presencaAtual.hora_inicio.split(':').map(Number);
        const [horaAtual, minAtual] = agora.split(':').map(Number);
        const config = db.prepare("SELECT valor FROM configuracoes WHERE chave = 'tolerancia_atraso_minutos'").get();
        const tolerancia = parseInt(config?.valor || '15');

        if ((horaAtual * 60 + minAtual) > (horaEsperada * 60 + minEsperado + tolerancia)) {
          status = 'atraso';
        }
      }

      db.prepare('UPDATE presencas SET hora_entrada = ?, status = ? WHERE id = ?')
        .run(agora, status, presencaAtual.id);

      res.json({ success: true, hora: agora, status });

    } else if (tipo === 'saida') {
      if (!presencaAtual.hora_entrada) {
        return res.status(400).json({
          success: false,
          error: 'Entrada não registrada'
        });
      }
      if (presencaAtual.hora_saida) {
        return res.status(400).json({
          success: false,
          error: 'Saída já registrada'
        });
      }

      db.prepare('UPDATE presencas SET hora_saida = ? WHERE id = ?')
        .run(agora, presencaAtual.id);

      res.json({ success: true, hora: agora });

    } else {
      return res.status(400).json({
        success: false,
        error: 'Tipo inválido. Use "entrada" ou "saida"'
      });
    }
  } catch (error) {
    console.error('Erro ao registrar ponto:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/furos', (req, res) => {
  const { data_inicio, data_fim, gestor_id } = req.query;
  let query = `
    SELECT p.*, f.nome as funcionario_nome, f.telefone, f.whatsapp, f.especialidade, e.hora_inicio as hora_esperada_inicio, e.hora_fim as hora_esperada_fim
    FROM presencas p
    LEFT JOIN funcionarios f ON p.funcionario_id = f.id
    LEFT JOIN escalas e ON p.escala_id = e.id
    WHERE p.status IN ('furo', 'atraso', 'falta')
  `;
  const params = [];

  if (data_inicio && data_fim) {
    query += ' AND p.data BETWEEN ? AND ?';
    params.push(data_inicio, data_fim);
  }
  if (gestor_id) {
    query += ' AND f.gestor_id = ?';
    params.push(gestor_id);
  }
  query += ' ORDER BY p.data DESC';

  const furos = db.prepare(query).all(...params);
  res.json(furos);
});

app.put('/api/presencas/:id', async (req, res) => {
  const { hora_entrada, hora_saida, status, justificativa, aprovado } = req.body;
  db.prepare('UPDATE presencas SET hora_entrada = ?, hora_saida = ?, status = ?, justificativa = ?, aprovado = ? WHERE id = ?')
    .run(hora_entrada, hora_saida, status, justificativa, aprovado ? 1 : 0, req.params.id);

  // Criar aviso e notificar se for furo/falta
  if (status === 'furo' || status === 'falta') {
    const presenca = db.prepare(`
      SELECT p.*, f.nome, f.gestor_id FROM presencas p 
      LEFT JOIN funcionarios f ON p.funcionario_id = f.id 
      WHERE p.id = ?
    `).get(req.params.id);

    const avisoId = uuidv4();
    db.prepare('INSERT INTO avisos (id, tipo, titulo, mensagem, funcionario_id) VALUES (?, ?, ?, ?, ?)')
      .run(avisoId, 'furo', `${status.toUpperCase()} Registrado`, `${presenca.nome} teve ${status} no dia ${presenca.data}`, presenca.funcionario_id);

    // Notificar via WhatsApp
    await whatsapp.notificarFalta(presenca.funcionario_id, presenca.data, status);
  }

  res.json({ success: true });
});

// Verificar furos automaticamente
app.post('/api/presencas/verificar-furos', async (req, res) => {
  const hoje = new Date().toISOString().split('T')[0];
  const agora = new Date().toTimeString().split(' ')[0].substring(0, 5);

  const escalasAtrasadas = db.prepare(`
    SELECT p.*, f.nome, f.telefone, f.whatsapp, e.hora_inicio
    FROM presencas p
    LEFT JOIN funcionarios f ON p.funcionario_id = f.id
    LEFT JOIN escalas e ON p.escala_id = e.id
    WHERE p.data = ? AND p.hora_entrada IS NULL AND e.hora_inicio < ? AND p.status = 'pendente'
  `).all(hoje, agora);

  const config = db.prepare("SELECT valor FROM configuracoes WHERE chave = 'tolerancia_atraso_minutos'").get();
  const tolerancia = parseInt(config?.valor || '15');

  const furosDetectados = [];

  for (const escala of escalasAtrasadas) {
    const [horaEsperada, minEsperado] = escala.hora_inicio.split(':').map(Number);
    const [horaAtual, minAtual] = agora.split(':').map(Number);

    const minutosEsperado = horaEsperada * 60 + minEsperado;
    const minutosAtual = horaAtual * 60 + minAtual;

    if (minutosAtual > minutosEsperado + tolerancia + 30) {
      db.prepare('UPDATE presencas SET status = ? WHERE id = ?').run('furo', escala.id);

      const avisoId = uuidv4();
      db.prepare('INSERT INTO avisos (id, tipo, titulo, mensagem, funcionario_id) VALUES (?, ?, ?, ?, ?)')
        .run(avisoId, 'furo', 'FURO Detectado', `${escala.nome} não compareceu. Escala: ${escala.hora_inicio}. Tel: ${escala.telefone || 'N/A'}`, escala.funcionario_id);

      // Notificar via WhatsApp
      await whatsapp.notificarFalta(escala.funcionario_id, escala.data, 'furo');

      furosDetectados.push(escala);
    }
  }

  res.json({ furos_detectados: furosDetectados.length, furos: furosDetectados });
});

// ============ GEOLOCALIZAÇÃO / CHECK-IN / CHECK-OUT ============

// Check-in com localização (GPS)
app.post('/api/checkin', async (req, res) => {
  try {
    const { funcionario_id, latitude, longitude } = req.body;
    const resultado = await localizacao.fazerCheckIn(funcionario_id, latitude, longitude);
    res.json(resultado);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Check-in via QR Code
app.post('/api/checkin/qrcode', async (req, res) => {
  try {
    const { funcionario_id, codigo_qr } = req.body;
    
    // Validar código QR (formato: ESCALAPRO-{hospital_id}-{timestamp}-{hash})
    if (!codigo_qr || !codigo_qr.startsWith('ESCALAPRO-')) {
      return res.status(400).json({ error: 'Código QR inválido' });
    }
    
    const partes = codigo_qr.split('-');
    if (partes.length < 4) {
      return res.status(400).json({ error: 'Formato de código inválido' });
    }
    
    const hospital_id = partes[1];
    const timestamp = parseInt(partes[2]);
    
    // Verificar se o código não expirou (válido por 5 minutos)
    const agora = Date.now();
    const cincoMinutos = 5 * 60 * 1000;
    if (agora - timestamp > cincoMinutos) {
      return res.status(400).json({ error: 'Código QR expirado. Gere um novo código.' });
    }
    
    // Buscar hospital
    const hospital = db.prepare('SELECT * FROM hospitais WHERE id = ?').get(hospital_id);
    if (!hospital) {
      return res.status(400).json({ error: 'Hospital não encontrado' });
    }
    
    // Fazer check-in usando coordenadas do hospital
    const resultado = await localizacao.fazerCheckIn(
      funcionario_id, 
      hospital.latitude, 
      hospital.longitude,
      'qrcode' // tipo de check-in
    );
    
    res.json({ 
      ...resultado, 
      metodo: 'qrcode',
      hospital: hospital.nome 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Gerar QR Code para check-in (gestor/admin)
app.post('/api/checkin/gerar-qrcode', (req, res) => {
  try {
    const { hospital_id } = req.body;
    
    const hospital = db.prepare('SELECT * FROM hospitais WHERE id = ?').get(hospital_id);
    if (!hospital) {
      return res.status(404).json({ error: 'Hospital não encontrado' });
    }
    
    // Gerar código único
    const timestamp = Date.now();
    const hash = Math.random().toString(36).substring(2, 8).toUpperCase();
    const codigo = `ESCALAPRO-${hospital_id}-${timestamp}-${hash}`;
    
    // Validade do QR Code (5 minutos)
    const expira_em = new Date(timestamp + 5 * 60 * 1000).toISOString();
    
    res.json({
      codigo,
      hospital: hospital.nome,
      expira_em,
      valido_por_minutos: 5
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Check-in via código manual
app.post('/api/checkin/codigo-manual', async (req, res) => {
  try {
    const { funcionario_id, codigo } = req.body;
    
    // Código diário do hospital (formato simples: HOSP-DDMM)
    const hoje = new Date();
    const diaAtual = String(hoje.getDate()).padStart(2, '0');
    const mesAtual = String(hoje.getMonth() + 1).padStart(2, '0');
    
    // Buscar hospital pelo código
    const hospitais = db.prepare('SELECT * FROM hospitais WHERE ativo = 1').all();
    let hospitalEncontrado = null;
    
    for (const hospital of hospitais) {
      // Código esperado: primeiras 4 letras do nome + DDMM
      const prefixo = hospital.nome.replace(/[^A-Za-z]/g, '').substring(0, 4).toUpperCase();
      const codigoEsperado = `${prefixo}${diaAtual}${mesAtual}`;
      
      if (codigo.toUpperCase() === codigoEsperado) {
        hospitalEncontrado = hospital;
        break;
      }
    }
    
    if (!hospitalEncontrado) {
      return res.status(400).json({ error: 'Código inválido ou expirado' });
    }
    
    // Fazer check-in
    const resultado = await localizacao.fazerCheckIn(
      funcionario_id, 
      hospitalEncontrado.latitude, 
      hospitalEncontrado.longitude,
      'codigo'
    );
    
    res.json({ 
      ...resultado, 
      metodo: 'codigo',
      hospital: hospitalEncontrado.nome 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obter código diário do hospital
app.get('/api/hospitais/:id/codigo-diario', (req, res) => {
  try {
    const hospital = db.prepare('SELECT * FROM hospitais WHERE id = ?').get(req.params.id);
    if (!hospital) {
      return res.status(404).json({ error: 'Hospital não encontrado' });
    }
    
    const hoje = new Date();
    const diaAtual = String(hoje.getDate()).padStart(2, '0');
    const mesAtual = String(hoje.getMonth() + 1).padStart(2, '0');
    const prefixo = hospital.nome.replace(/[^A-Za-z]/g, '').substring(0, 4).toUpperCase();
    const codigo = `${prefixo}${diaAtual}${mesAtual}`;
    
    res.json({
      codigo,
      hospital: hospital.nome,
      data: format(hoje, 'dd/MM/yyyy'),
      valido_ate: '23:59'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Check-out com localização
app.post('/api/checkout', async (req, res) => {
  try {
    const { funcionario_id, latitude, longitude, hora_extra, motivo } = req.body;
    const resultado = await localizacao.fazerCheckOut(funcionario_id, latitude, longitude, hora_extra, motivo);
    res.json(resultado);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Atualizar localização (verificação periódica)
app.post('/api/localizacao/atualizar', async (req, res) => {
  try {
    const { funcionario_id, latitude, longitude } = req.body;
    const resultado = await localizacao.verificarLocalizacaoAtual(funcionario_id, latitude, longitude);
    res.json(resultado);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Histórico de localizações
app.get('/api/localizacao/historico/:funcionario_id', (req, res) => {
  const { data } = req.query;
  const historico = localizacao.getHistoricoLocalizacoes(req.params.funcionario_id, data);
  res.json(historico);
});

// Executar verificações pendentes (chamada por cron ou manual)
app.post('/api/localizacao/executar-verificacoes', async (req, res) => {
  try {
    const resultado = await localizacao.executarVerificacoesPendentes();
    res.json(resultado);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ WHATSAPP (SIMPLIFICADO) ============

// Gerar link de mensagem WhatsApp
app.post('/api/whatsapp/gerar-link', (req, res) => {
  try {
    const { numero, mensagem } = req.body;
    const link = whatsapp.gerarLinkWhatsApp(numero, mensagem);
    res.json({ success: true, link });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Enviar mensagem (retorna link ou envia via API se configurada)
app.post('/api/whatsapp/enviar', async (req, res) => {
  try {
    const { gestor_id, numero, mensagem, template, dados } = req.body;
    
    let mensagemFinal = mensagem;
    if (template && dados) {
      mensagemFinal = whatsapp.gerarMensagem(template, dados);
    }
    
    const resultado = await whatsapp.enviar(gestor_id, numero, mensagemFinal);
    res.json(resultado);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Enviar para múltiplos destinatários
app.post('/api/whatsapp/enviar-lote', async (req, res) => {
  try {
    const { gestor_id, destinatarios, mensagem } = req.body;
    const resultados = await whatsapp.enviarLote(gestor_id, destinatarios, mensagem);
    res.json({ success: true, resultados });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Status da conexão (sempre ativo no modo link)
app.get('/api/whatsapp/status/:gestor_id', (req, res) => {
  const status = whatsapp.getStatus(req.params.gestor_id);
  res.json(status);
});

// Criar grupo (registro local)
app.post('/api/whatsapp/grupos', (req, res) => {
  try {
    const { gestor_id, nome, descricao } = req.body;
    const resultado = whatsapp.criarGrupo(gestor_id, nome, descricao);
    res.json(resultado);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Listar grupos do gestor
app.get('/api/whatsapp/grupos/:gestor_id', (req, res) => {
  const grupos = whatsapp.getGrupos(req.params.gestor_id);
  res.json(grupos);
});

// Membros do grupo
app.get('/api/whatsapp/grupos/:grupo_id/membros', (req, res) => {
  const membros = whatsapp.getMembrosGrupo(req.params.grupo_id);
  res.json(membros);
});

// Adicionar membro ao grupo
app.post('/api/whatsapp/grupos/:grupo_id/membros', (req, res) => {
  try {
    const { funcionario_id } = req.body;
    const resultado = whatsapp.adicionarMembro(req.params.grupo_id, funcionario_id);
    res.json(resultado);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Enviar para grupo (gera links para todos os membros)
app.post('/api/whatsapp/mensagem/grupo', async (req, res) => {
  try {
    const { grupo_id, mensagem } = req.body;
    const grupo = db.prepare('SELECT gestor_id FROM whatsapp_grupos WHERE id = ?').get(grupo_id);
    const resultados = await whatsapp.enviarParaGrupo(grupo?.gestor_id, grupo_id, mensagem);
    res.json({ success: true, resultados });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Enviar mensagem pessoal
app.post('/api/whatsapp/mensagem/pessoal', async (req, res) => {
  try {
    const { funcionario_id, mensagem, gestor_id } = req.body;
    const funcionario = db.prepare('SELECT * FROM funcionarios WHERE id = ?').get(funcionario_id);
    if (!funcionario?.whatsapp && !funcionario?.telefone) {
      return res.status(400).json({ error: 'Funcionário sem telefone cadastrado' });
    }
    const numero = funcionario.whatsapp || funcionario.telefone;
    const resultado = await whatsapp.enviar(gestor_id, numero, mensagem);
    res.json(resultado);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Templates disponíveis
app.get('/api/whatsapp/templates', (req, res) => {
  res.json(Object.keys(whatsapp.templates));
});

// Histórico de mensagens
app.get('/api/whatsapp/mensagens', (req, res) => {
  const { grupo_id, funcionario_id, limit } = req.query;
  let query = 'SELECT * FROM whatsapp_mensagens WHERE 1=1';
  const params = [];

  if (grupo_id) {
    query += ' AND destino_id = ? AND tipo = "grupo"';
    params.push(grupo_id);
  }
  if (funcionario_id) {
    query += ' AND destino_id = ? AND tipo = "pessoal"';
    params.push(funcionario_id);
  }
  query += ' ORDER BY created_at DESC LIMIT ?';
  params.push(parseInt(limit) || 100);

  const mensagens = db.prepare(query).all(...params);
  res.json(mensagens);
});

// Estatísticas
app.get('/api/whatsapp/estatisticas/:gestor_id', (req, res) => {
  const estatisticas = whatsapp.getEstatisticas(req.params.gestor_id);
  res.json(estatisticas);
});

// ============ SUPERVISORES DE BACKUP ============

// Listar supervisores de um gestor
app.get('/api/supervisores/:gestor_id', (req, res) => {
  try {
    const supervisores = db.prepare('SELECT * FROM supervisores WHERE gestor_id = ? AND ativo = 1 ORDER BY ordem_prioridade ASC').all(req.params.gestor_id);
    res.json(supervisores);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Adicionar supervisor
app.post('/api/supervisores', (req, res) => {
  try {
    const { gestor_id, nome, whatsapp: whatsappNum, email, ordem_prioridade } = req.body;
    const id = uuidv4();
    const maxOrdem = db.prepare('SELECT MAX(ordem_prioridade) as max FROM supervisores WHERE gestor_id = ?').get(gestor_id);
    const ordem = ordem_prioridade || (maxOrdem?.max || 0) + 1;
    
    db.prepare(`
      INSERT INTO supervisores (id, gestor_id, nome, whatsapp, email, ordem_prioridade)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, gestor_id, nome, whatsappNum, email, ordem);
    
    res.json({ id, success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Atualizar supervisor
app.put('/api/supervisores/:id', async (req, res) => {
  try {
    const { nome, whatsapp: whatsappNum, email, ordem_prioridade, ativo } = req.body;
    const resultado = await whatsapp.atualizarSupervisor(req.params.id, { nome, whatsapp: whatsappNum, email, ordem_prioridade, ativo });
    res.json(resultado);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Remover supervisor
app.delete('/api/supervisores/:id', async (req, res) => {
  try {
    const resultado = await whatsapp.removerSupervisor(req.params.id);
    res.json(resultado);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Reordenar supervisores
app.put('/api/supervisores/:gestor_id/reordenar', async (req, res) => {
  try {
    const { ordem } = req.body; // Array de IDs na nova ordem
    const resultado = await whatsapp.reordenarSupervisores(req.params.gestor_id, ordem);
    res.json(resultado);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Estatísticas de envio de mensagens
app.get('/api/supervisores/:gestor_id/estatisticas', async (req, res) => {
  try {
    const { periodo_inicio, periodo_fim } = req.query;
    const estatisticas = await whatsapp.getEstatisticasEnvio(req.params.gestor_id, periodo_inicio, periodo_fim);
    res.json(estatisticas);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ BACKLOG ============
app.get('/api/backlog/:funcionario_id', (req, res) => {
  const { limit } = req.query;
  const backlog = whatsapp.getBacklog(req.params.funcionario_id, parseInt(limit) || 50);
  res.json(backlog);
});

// ============ RELATÓRIOS ============
app.post('/api/relatorios/gerar', async (req, res) => {
  try {
    const { gestor_id, periodo_inicio, periodo_fim } = req.body;
    const relatorio = await whatsapp.gerarRelatorioGestor(gestor_id, periodo_inicio, periodo_fim);
    res.json(relatorio);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/relatorios/:gestor_id', (req, res) => {
  const relatorios = db.prepare(`
    SELECT id, tipo, periodo_inicio, periodo_fim, created_at 
    FROM relatorios 
    WHERE gestor_id = ? 
    ORDER BY created_at DESC
  `).all(req.params.gestor_id);
  res.json(relatorios);
});

app.get('/api/relatorios/detalhes/:id', (req, res) => {
  const relatorio = db.prepare('SELECT * FROM relatorios WHERE id = ?').get(req.params.id);
  if (relatorio) {
    relatorio.dados = JSON.parse(relatorio.dados_json);
  }
  res.json(relatorio);
});

// ============ HORAS EXTRAS ============
app.get('/api/horas-extras', (req, res) => {
  const { funcionario_id, status, data_inicio, data_fim } = req.query;
  let query = `
    SELECT he.*, f.nome as funcionario_nome
    FROM horas_extras he
    JOIN funcionarios f ON he.funcionario_id = f.id
    WHERE 1=1
  `;
  const params = [];

  if (funcionario_id) {
    query += ' AND he.funcionario_id = ?';
    params.push(funcionario_id);
  }
  if (status) {
    query += ' AND he.status = ?';
    params.push(status);
  }
  if (data_inicio && data_fim) {
    query += ' AND he.data BETWEEN ? AND ?';
    params.push(data_inicio, data_fim);
  }
  query += ' ORDER BY he.data DESC';

  const horasExtras = db.prepare(query).all(...params);
  res.json(horasExtras);
});

app.put('/api/horas-extras/:id/aprovar', (req, res) => {
  const { aprovado_por } = req.body;
  db.prepare(`
    UPDATE horas_extras SET status = 'aprovado', aprovado = 1, aprovado_por = ? WHERE id = ?
  `).run(aprovado_por, req.params.id);
  res.json({ success: true });
});

// ============ HOSPITAIS ============
app.get('/api/hospitais', (req, res) => {
  const hospitais = db.prepare('SELECT * FROM hospitais WHERE ativo = 1').all();
  res.json(hospitais);
});

app.post('/api/hospitais', (req, res) => {
  const { nome, endereco, latitude, longitude, raio_metros } = req.body;
  const id = uuidv4();
  db.prepare(`
    INSERT INTO hospitais (id, nome, endereco, latitude, longitude, raio_metros)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, nome, endereco, latitude, longitude, raio_metros || 500);
  res.json({ id, nome, endereco, latitude, longitude, raio_metros });
});

app.put('/api/hospitais/:id', (req, res) => {
  const { nome, endereco, latitude, longitude, raio_metros } = req.body;
  db.prepare(`
    UPDATE hospitais SET nome = ?, endereco = ?, latitude = ?, longitude = ?, raio_metros = ?
    WHERE id = ?
  `).run(nome, endereco, latitude, longitude, raio_metros, req.params.id);
  res.json({ success: true });
});

// ============ NOTAS ============
app.get('/api/notas', (req, res) => {
  const { funcionario_id } = req.query;
  let query = `
    SELECT n.*, f.nome as funcionario_nome 
    FROM notas n
    LEFT JOIN funcionarios f ON n.funcionario_id = f.id
    WHERE 1=1
  `;
  const params = [];

  if (funcionario_id) {
    query += ' AND n.funcionario_id = ?';
    params.push(funcionario_id);
  }
  query += ' ORDER BY n.periodo_fim DESC';

  const notas = db.prepare(query).all(...params);
  res.json(notas);
});

app.post('/api/notas', (req, res) => {
  const { funcionario_id, periodo_inicio, periodo_fim, pontualidade, assiduidade, desempenho, observacoes } = req.body;
  const id = uuidv4();
  db.prepare('INSERT INTO notas (id, funcionario_id, periodo_inicio, periodo_fim, pontualidade, assiduidade, desempenho, observacoes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(id, funcionario_id, periodo_inicio, periodo_fim, pontualidade, assiduidade, desempenho, observacoes);
  res.json({ id, funcionario_id, periodo_inicio, periodo_fim, pontualidade, assiduidade, desempenho, observacoes });
});

app.post('/api/notas/calcular-automatico', (req, res) => {
  const { funcionario_id, periodo_inicio, periodo_fim } = req.body;

  const presencas = db.prepare(`
    SELECT * FROM presencas 
    WHERE funcionario_id = ? AND data BETWEEN ? AND ?
  `).all(funcionario_id, periodo_inicio, periodo_fim);

  const total = presencas.length;
  if (total === 0) {
    return res.json({ pontualidade: 0, assiduidade: 0, desempenho: 0 });
  }

  const presentes = presencas.filter(p => p.status === 'presente').length;
  const atrasos = presencas.filter(p => p.status === 'atraso').length;
  const furos = presencas.filter(p => p.status === 'furo' || p.status === 'falta').length;

  const pontualidade = Math.max(0, ((total - atrasos) / total) * 10);
  const assiduidade = Math.max(0, ((total - furos) / total) * 10);
  const desempenho = (pontualidade + assiduidade) / 2;

  res.json({
    pontualidade: Math.round(pontualidade * 10) / 10,
    assiduidade: Math.round(assiduidade * 10) / 10,
    desempenho: Math.round(desempenho * 10) / 10,
    estatisticas: { total, presentes, atrasos, furos }
  });
});

// ============ PAGAMENTOS ============
app.get('/api/pagamentos', (req, res) => {
  const { funcionario_id, status } = req.query;
  let query = `
    SELECT p.*, f.nome as funcionario_nome 
    FROM pagamentos p
    LEFT JOIN funcionarios f ON p.funcionario_id = f.id
    WHERE 1=1
  `;
  const params = [];

  if (funcionario_id) {
    query += ' AND p.funcionario_id = ?';
    params.push(funcionario_id);
  }
  if (status) {
    query += ' AND p.status = ?';
    params.push(status);
  }
  query += ' ORDER BY p.periodo_fim DESC';

  const pagamentos = db.prepare(query).all(...params);
  res.json(pagamentos);
});

app.post('/api/pagamentos', (req, res) => {
  const { funcionario_id, periodo_inicio, periodo_fim, horas_trabalhadas, horas_extras, valor_hora, descontos, bonus, observacoes } = req.body;
  const id = uuidv4();

  const configMultiplicador = db.prepare("SELECT valor FROM configuracoes WHERE chave = 'horas_extras_multiplicador'").get();
  const multiplicador = parseFloat(configMultiplicador?.valor || '1.5');

  const valor_total = (horas_trabalhadas * valor_hora) + (horas_extras * valor_hora * multiplicador) + bonus - descontos;

  db.prepare('INSERT INTO pagamentos (id, funcionario_id, periodo_inicio, periodo_fim, horas_trabalhadas, horas_extras, valor_hora, descontos, bonus, valor_total, observacoes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(id, funcionario_id, periodo_inicio, periodo_fim, horas_trabalhadas, horas_extras, valor_hora, descontos, bonus, valor_total, observacoes);
  res.json({ id, funcionario_id, periodo_inicio, periodo_fim, horas_trabalhadas, horas_extras, valor_hora, descontos, bonus, valor_total, observacoes });
});

app.post('/api/pagamentos/calcular', (req, res) => {
  const { funcionario_id, periodo_inicio, periodo_fim } = req.body;

  const funcionario = db.prepare('SELECT * FROM funcionarios WHERE id = ?').get(funcionario_id);
  if (!funcionario) {
    return res.status(404).json({ error: 'Funcionário não encontrado' });
  }

  const presencas = db.prepare(`
    SELECT p.*, e.hora_inicio as esperado_inicio, e.hora_fim as esperado_fim
    FROM presencas p
    LEFT JOIN escalas e ON p.escala_id = e.id
    WHERE p.funcionario_id = ? AND p.data BETWEEN ? AND ? AND p.status IN ('presente', 'atraso')
  `).all(funcionario_id, periodo_inicio, periodo_fim);

  let horasTrabalhadas = 0;
  let horasExtras = 0;

  presencas.forEach(p => {
    if (p.hora_entrada && p.hora_saida) {
      const [hEntrada, mEntrada] = p.hora_entrada.split(':').map(Number);
      const [hSaida, mSaida] = p.hora_saida.split(':').map(Number);
      const [hEsperadoFim, mEsperadoFim] = p.esperado_fim.split(':').map(Number);

      const minutosTrabalho = (hSaida * 60 + mSaida) - (hEntrada * 60 + mEntrada);
      const minutosEsperado = (hEsperadoFim * 60 + mEsperadoFim) - (hEntrada * 60 + mEntrada);

      horasTrabalhadas += Math.min(minutosTrabalho, minutosEsperado) / 60;
      if (minutosTrabalho > minutosEsperado) {
        horasExtras += (minutosTrabalho - minutosEsperado) / 60;
      }
    }
    // Adicionar horas extras registradas
    horasExtras += (p.hora_extra_minutos || 0) / 60;
  });

  const furos = db.prepare(`
    SELECT COUNT(*) as total FROM presencas 
    WHERE funcionario_id = ? AND data BETWEEN ? AND ? AND status IN ('furo', 'falta') AND aprovado = 0
  `).get(funcionario_id, periodo_inicio, periodo_fim);

  const configDesconto = db.prepare("SELECT valor FROM configuracoes WHERE chave = 'desconto_furo_percentual'").get();
  const percentualDesconto = parseFloat(configDesconto?.valor || '5');

  const descontos = furos.total * (funcionario.salario_hora * 8 * (percentualDesconto / 100));

  res.json({
    horas_trabalhadas: Math.round(horasTrabalhadas * 100) / 100,
    horas_extras: Math.round(horasExtras * 100) / 100,
    valor_hora: funcionario.salario_hora,
    descontos: Math.round(descontos * 100) / 100,
    furos: furos.total
  });
});

app.put('/api/pagamentos/:id', (req, res) => {
  const { status, data_pagamento } = req.body;
  db.prepare('UPDATE pagamentos SET status = ?, data_pagamento = ? WHERE id = ?')
    .run(status, data_pagamento, req.params.id);
  res.json({ success: true });
});

// ============ AVISOS ============
app.get('/api/avisos', (req, res) => {
  const { lido, funcionario_id } = req.query;
  let query = 'SELECT a.*, f.nome as funcionario_nome FROM avisos a LEFT JOIN funcionarios f ON a.funcionario_id = f.id WHERE 1=1';
  const params = [];

  if (lido !== undefined) {
    query += ' AND a.lido = ?';
    params.push(lido === 'true' ? 1 : 0);
  }
  if (funcionario_id) {
    query += ' AND a.funcionario_id = ?';
    params.push(funcionario_id);
  }
  query += ' ORDER BY a.data_criacao DESC LIMIT 50';

  const avisos = db.prepare(query).all(...params);
  res.json(avisos);
});

app.put('/api/avisos/:id/lido', (req, res) => {
  db.prepare('UPDATE avisos SET lido = 1 WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

app.put('/api/avisos/marcar-todos-lidos', (req, res) => {
  db.prepare('UPDATE avisos SET lido = 1').run();
  res.json({ success: true });
});

// ============ CONFIGURAÇÕES ============
app.get('/api/configuracoes', (req, res) => {
  const configs = db.prepare('SELECT * FROM configuracoes').all();
  const resultado = {};
  configs.forEach(c => resultado[c.chave] = c.valor);
  res.json(resultado);
});

app.put('/api/configuracoes', (req, res) => {
  const configs = req.body;
  Object.entries(configs).forEach(([chave, valor]) => {
    db.prepare('INSERT OR REPLACE INTO configuracoes (chave, valor) VALUES (?, ?)').run(chave, valor);
  });
  res.json({ success: true });
});

// ============ DASHBOARD ============
app.get('/api/dashboard', (req, res) => {
  const { gestor_id } = req.query;
  const hoje = new Date().toISOString().split('T')[0];
  const inicioMes = hoje.substring(0, 7) + '-01';

  let whereGestor = '';
  const params = [];
  if (gestor_id) {
    whereGestor = ' AND f.gestor_id = ?';
    params.push(gestor_id);
  }

  const totalFuncionarios = db.prepare(`
    SELECT COUNT(*) as total FROM funcionarios f WHERE f.ativo = 1 ${whereGestor}
  `).get(...params);

  const escalasHoje = db.prepare(`
    SELECT COUNT(*) as total FROM escalas e 
    JOIN funcionarios f ON e.funcionario_id = f.id
    WHERE e.data = ? ${whereGestor}
  `).get(hoje, ...params);

  const furosHoje = db.prepare(`
    SELECT COUNT(*) as total FROM presencas p 
    JOIN funcionarios f ON p.funcionario_id = f.id
    WHERE p.data = ? AND p.status IN ('furo', 'falta') ${whereGestor}
  `).get(hoje, ...params);

  const furosMes = db.prepare(`
    SELECT COUNT(*) as total FROM presencas p 
    JOIN funcionarios f ON p.funcionario_id = f.id
    WHERE p.data >= ? AND p.status IN ('furo', 'falta') ${whereGestor}
  `).get(inicioMes, ...params);

  const avisosNaoLidos = db.prepare('SELECT COUNT(*) as total FROM avisos WHERE lido = 0').get();
  const pagamentosPendentes = db.prepare("SELECT COUNT(*) as total, SUM(valor_total) as valor FROM pagamentos WHERE status = 'pendente'").get();

  const escalasHojeDetalhes = db.prepare(`
    SELECT e.*, f.nome as funcionario_nome, f.especialidade, f.whatsapp, p.status as presenca_status, p.hora_entrada, p.checkin_lat, p.checkin_lng
    FROM escalas e
    LEFT JOIN funcionarios f ON e.funcionario_id = f.id
    LEFT JOIN presencas p ON p.escala_id = e.id
    WHERE e.data = ? ${whereGestor}
    ORDER BY e.hora_inicio
  `).all(hoje, ...params);

  const ultimosFuros = db.prepare(`
    SELECT p.*, f.nome as funcionario_nome, f.especialidade
    FROM presencas p
    LEFT JOIN funcionarios f ON p.funcionario_id = f.id
    WHERE p.status IN ('furo', 'falta', 'atraso') ${whereGestor}
    ORDER BY p.data DESC
    LIMIT 5
  `).all(...params);

  res.json({
    total_funcionarios: totalFuncionarios.total,
    escalas_hoje: escalasHoje.total,
    furos_hoje: furosHoje.total,
    furos_mes: furosMes.total,
    avisos_nao_lidos: avisosNaoLidos.total,
    pagamentos_pendentes: pagamentosPendentes.total,
    valor_pagamentos_pendentes: pagamentosPendentes.valor || 0,
    escalas_hoje_detalhes: escalasHojeDetalhes,
    ultimos_furos: ultimosFuros
  });
});

// Intervalo para verificações automáticas (a cada minuto)
setInterval(async () => {
  try {
    await localizacao.executarVerificacoesPendentes();
  } catch (error) {
    console.error('Erro nas verificações automáticas:', error);
  }
}, 60000);

app.get('/api/unidades', (req, res) => {
  const unidades = db.prepare('SELECT * FROM unidades WHERE ativo = 1 ORDER BY nome').all();
  res.json(unidades);
});

// ============ TROCAS DE PLANTÃO ============

// Listar trocas
app.get('/api/trocas', (req, res) => {
  try {
    const trocas = db.prepare(`
      SELECT 
        t.*,
        f1.nome as solicitante_nome,
        f2.nome as aceito_por_nome,
        f3.nome as aprovador_nome,
        e.data as data_escala,
        e.hora_inicio,
        e.hora_fim
      FROM trocas_plantao t
      LEFT JOIN funcionarios f1 ON t.solicitante_id = f1.id
      LEFT JOIN funcionarios f2 ON t.aceito_por_id = f2.id
      LEFT JOIN funcionarios f3 ON t.aprovador_id = f3.id
      LEFT JOIN escalas e ON t.escala_id = e.id
      ORDER BY t.created_at DESC
    `).all();
    res.json(trocas);
  } catch (error) {
    console.error('Erro ao buscar trocas:', error);
    res.status(500).json({ error: 'Erro ao buscar trocas' });
  }
});

// Criar troca
app.post('/api/trocas', (req, res) => {
  const { escala_id, solicitante_id, tipo, motivo } = req.body;
  
  if (!escala_id || !solicitante_id) {
    return res.status(400).json({ error: 'Escala e solicitante são obrigatórios' });
  }
  
  const id = uuidv4();
  try {
    db.prepare(`
      INSERT INTO trocas_plantao (id, escala_id, solicitante_id, tipo, motivo, status)
      VALUES (?, ?, ?, ?, ?, 'aberta')
    `).run(id, escala_id, solicitante_id, tipo || 'oferta', motivo || '');
    
    res.json({ success: true, id });
  } catch (error) {
    console.error('Erro ao criar troca:', error);
    res.status(500).json({ error: 'Erro ao criar troca' });
  }
});

// Aceitar troca
app.post('/api/trocas/:id/aceitar', (req, res) => {
  const { id } = req.params;
  const { funcionario_id } = req.body;
  
  try {
    // Verificar regras de troca
    const regras = db.prepare('SELECT * FROM regras_troca').get();
    
    db.prepare(`
      UPDATE trocas_plantao 
      SET aceito_por_id = ?, status = 'aceita', aceito_em = CURRENT_TIMESTAMP
      WHERE id = ? AND status = 'aberta'
    `).run(funcionario_id, id);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Erro ao aceitar troca:', error);
    res.status(500).json({ error: 'Erro ao aceitar troca' });
  }
});

// Aprovar/rejeitar troca (gestor)
app.post('/api/trocas/:id/aprovar', (req, res) => {
  const { id } = req.params;
  const { aprovado, aprovador_id } = req.body;
  
  try {
    const troca = db.prepare('SELECT * FROM trocas_plantao WHERE id = ?').get(id);
    if (!troca) {
      return res.status(404).json({ error: 'Troca não encontrada' });
    }
    
    const status = aprovado ? 'aprovada' : 'rejeitada';
    db.prepare(`
      UPDATE trocas_plantao 
      SET status = ?, aprovador_id = ?, aprovado_em = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(status, aprovador_id, id);
    
    // Se aprovada, atualiza a escala
    if (aprovado && troca.aceito_por_id) {
      db.prepare(`
        UPDATE escalas SET funcionario_id = ? WHERE id = ?
      `).run(troca.aceito_por_id, troca.escala_id);
    }
    
    res.json({ success: true, status });
  } catch (error) {
    console.error('Erro ao aprovar troca:', error);
    res.status(500).json({ error: 'Erro ao aprovar troca' });
  }
});

// Cancelar troca
app.delete('/api/trocas/:id', (req, res) => {
  const { id } = req.params;
  try {
    db.prepare(`UPDATE trocas_plantao SET status = 'cancelada' WHERE id = ?`).run(id);
    res.json({ success: true });
  } catch (error) {
    console.error('Erro ao cancelar troca:', error);
    res.status(500).json({ error: 'Erro ao cancelar troca' });
  }
});

// ============ ANÚNCIOS DE PLANTÃO ============

// Listar anúncios
app.get('/api/anuncios', (req, res) => {
  try {
    const anuncios = db.prepare(`
      SELECT 
        a.*,
        f.nome as gestor_nome,
        (SELECT COUNT(*) FROM anuncios_candidaturas WHERE anuncio_id = a.id AND status = 'aprovada') as vagas_preenchidas
      FROM anuncios_plantao a
      LEFT JOIN funcionarios f ON a.gestor_id = f.id
      ORDER BY a.created_at DESC
    `).all();
    res.json(anuncios);
  } catch (error) {
    console.error('Erro ao buscar anúncios:', error);
    res.status(500).json({ error: 'Erro ao buscar anúncios' });
  }
});

// Criar anúncio
app.post('/api/anuncios', (req, res) => {
  const { titulo, descricao, tipo, data_plantao, hora_inicio, hora_fim, valor_adicional, vagas, gestor_id } = req.body;
  
  if (!titulo || !gestor_id) {
    return res.status(400).json({ error: 'Título e gestor são obrigatórios' });
  }
  
  const id = uuidv4();
  try {
    db.prepare(`
      INSERT INTO anuncios_plantao (id, gestor_id, titulo, descricao, tipo, data_plantao, hora_inicio, hora_fim, valor_adicional, vagas, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'aberto')
    `).run(id, gestor_id, titulo, descricao || '', tipo || 'normal', data_plantao, hora_inicio, hora_fim, valor_adicional || 0, vagas || 1);
    
    res.json({ success: true, id });
  } catch (error) {
    console.error('Erro ao criar anúncio:', error);
    res.status(500).json({ error: 'Erro ao criar anúncio' });
  }
});

// Candidatar-se a um anúncio
app.post('/api/anuncios/:id/candidatar', (req, res) => {
  const { id } = req.params;
  const { funcionario_id } = req.body;
  
  const candidaturaId = uuidv4();
  try {
    // Verifica se já existe candidatura
    const existente = db.prepare(`
      SELECT id FROM anuncios_candidaturas WHERE anuncio_id = ? AND funcionario_id = ?
    `).get(id, funcionario_id);
    
    if (existente) {
      return res.status(400).json({ error: 'Você já se candidatou a este anúncio' });
    }
    
    db.prepare(`
      INSERT INTO anuncios_candidaturas (id, anuncio_id, funcionario_id, status)
      VALUES (?, ?, ?, 'pendente')
    `).run(candidaturaId, id, funcionario_id);
    
    res.json({ success: true, id: candidaturaId });
  } catch (error) {
    console.error('Erro ao candidatar:', error);
    res.status(500).json({ error: 'Erro ao candidatar' });
  }
});

// Aprovar candidatura
app.post('/api/anuncios/:id/aprovar-candidatura', (req, res) => {
  const { id } = req.params;
  const { candidatura_id, aprovado } = req.body;
  
  try {
    const status = aprovado ? 'aprovada' : 'rejeitada';
    db.prepare(`
      UPDATE anuncios_candidaturas SET status = ?, aprovado_em = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(status, candidatura_id);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Erro ao aprovar candidatura:', error);
    res.status(500).json({ error: 'Erro ao aprovar candidatura' });
  }
});

// Regras de troca
app.get('/api/regras-troca', (req, res) => {
  try {
    const regras = db.prepare('SELECT * FROM regras_troca').get();
    res.json(regras || {});
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar regras' });
  }
});

app.put('/api/regras-troca', (req, res) => {
  const { intervalo_minimo_horas, max_horas_semana, max_horas_dia, aprovacao_automatica } = req.body;
  
  try {
    db.prepare(`
      UPDATE regras_troca SET 
        intervalo_minimo_horas = ?,
        max_horas_semana = ?,
        max_horas_dia = ?,
        aprovacao_automatica = ?
    `).run(intervalo_minimo_horas, max_horas_semana, max_horas_dia, aprovacao_automatica ? 1 : 0);
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao atualizar regras' });
  }
});

// Servir arquivos estáticos do React em produção
app.use(express.static(path.join(__dirname, '../dist')));

// Rota "catch-all" para servir o index.html do React para qualquer rota não-API
app.get(/(.*)/, (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
