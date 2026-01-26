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
  const { nome, email, senha, telefone } = req.body;

  if (!nome || !email || !senha) {
    return res.status(400).json({ error: 'Nome, email e senha são obrigatórios' });
  }

  const existingUser = db.prepare('SELECT id FROM funcionarios WHERE email = ?').get(email);
  if (existingUser) {
    return res.status(400).json({ error: 'Email já cadastrado' });
  }

  const id = uuidv4();
  // Por padrão, quem se cadastra é "gestor" para poder testar o sistema, ou "funcionario"? 
  // O usuário pediu área de cadastro. Vamos criar como 'gestor' para ele poder usar o sistema, ou 'funcionario' pendente?
  // Vou criar como 'gestor' por enquanto para facilitar o teste do Felipe, mas o ideal seria aprovação.

  db.prepare(`
    INSERT INTO funcionarios (id, nome, email, senha, telefone, tipo, cargo, ativo) 
    VALUES (?, ?, ?, ?, ?, 'gestor', 'Gestor', 1)
  `).run(id, nome, email, senha, telefone);

  res.json({ success: true, message: 'Cadastro realizado com sucesso' });
});


app.post('/api/auth/social-login', async (req, res) => {
  const { provider, token, email, nome, photo } = req.body;

  if (!email || !provider) {
    return res.status(400).json({ error: 'Dados insuficientes para login social' });
  }

  // Verificar se o usuário existe
  let usuario = db.prepare('SELECT * FROM funcionarios WHERE email = ?').get(email);

  if (!usuario) {
    // Cadastro automático via Social Login
    const id = uuidv4();
    db.prepare(`
      INSERT INTO funcionarios (id, nome, email, tipo, cargo, ativo, foto_url) 
      VALUES (?, ?, ?, 'gestor', 'Gestor (Social)', 1, ?)
    `).run(id, nome || email.split('@')[0], email, photo || '');

    usuario = db.prepare('SELECT * FROM funcionarios WHERE id = ?').get(id);
  } else if (usuario.ativo === 0) {
    return res.status(401).json({ error: 'Usuário desativado' });
  }

  const { senha: _, ...usuarioSemSenha } = usuario;

  res.json({
    success: true,
    user: usuarioSemSenha,
    token: 'social-token-' + uuidv4()
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

// Check-in com localização
app.post('/api/checkin', async (req, res) => {
  try {
    const { funcionario_id, latitude, longitude } = req.body;
    const resultado = await localizacao.fazerCheckIn(funcionario_id, latitude, longitude);
    res.json(resultado);
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

// ============ WHATSAPP ============

// Gerar QR Code para conexão
app.post('/api/whatsapp/conectar', async (req, res) => {
  try {
    const { gestor_id } = req.body;
    const resultado = await whatsapp.gerarQRCode(gestor_id);
    res.json(resultado);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Confirmar conexão (simulação)
app.post('/api/whatsapp/confirmar-conexao', async (req, res) => {
  try {
    const { gestor_id, telefone } = req.body;
    const resultado = await whatsapp.confirmarConexao(gestor_id, telefone);
    res.json(resultado);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Status da conexão
app.get('/api/whatsapp/status/:gestor_id', async (req, res) => {
  const status = await whatsapp.getStatusConexao(req.params.gestor_id);
  res.json(status || { status: 'nao_configurado' });
});

// Desconectar
app.post('/api/whatsapp/desconectar', async (req, res) => {
  try {
    const { gestor_id } = req.body;
    const resultado = await whatsapp.desconectar(gestor_id);
    res.json(resultado);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Criar grupo
app.post('/api/whatsapp/grupos', async (req, res) => {
  try {
    const { gestor_id, descricao } = req.body;
    const resultado = await whatsapp.criarGrupo(gestor_id, descricao);
    res.json(resultado);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Listar grupos do gestor
app.get('/api/whatsapp/grupos/:gestor_id', async (req, res) => {
  const grupos = await whatsapp.getGruposGestor(req.params.gestor_id);
  res.json(grupos);
});

// Membros do grupo
app.get('/api/whatsapp/grupos/:grupo_id/membros', async (req, res) => {
  const membros = await whatsapp.getMembrosGrupo(req.params.grupo_id);
  res.json(membros);
});

// Adicionar membro ao grupo
app.post('/api/whatsapp/grupos/:grupo_id/membros', async (req, res) => {
  try {
    const { funcionario_id } = req.body;
    const resultado = await whatsapp.adicionarMembro(req.params.grupo_id, funcionario_id);
    res.json(resultado);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Enviar mensagem para grupo
app.post('/api/whatsapp/mensagem/grupo', async (req, res) => {
  try {
    const { grupo_id, mensagem, funcionario_marcado } = req.body;
    const resultado = await whatsapp.enviarMensagemGrupo(grupo_id, mensagem, funcionario_marcado);
    res.json(resultado);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Enviar mensagem pessoal
app.post('/api/whatsapp/mensagem/pessoal', async (req, res) => {
  try {
    const { funcionario_id, mensagem } = req.body;
    const resultado = await whatsapp.enviarMensagemPessoal(funcionario_id, mensagem);
    res.json(resultado);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Notificar início do plantão
app.post('/api/whatsapp/notificar-plantao', async (req, res) => {
  try {
    const { gestor_id, data } = req.body;
    const resultado = await whatsapp.notificarInicioPlantao(gestor_id, data);
    res.json(resultado);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Histórico de mensagens
app.get('/api/whatsapp/mensagens', (req, res) => {
  const { grupo_id, funcionario_id, limit } = req.query;
  let query = 'SELECT * FROM whatsapp_mensagens WHERE 1=1';
  const params = [];

  if (grupo_id) {
    query += ' AND grupo_id = ?';
    params.push(grupo_id);
  }
  if (funcionario_id) {
    query += ' AND destino_id = ?';
    params.push(funcionario_id);
  }
  query += ' ORDER BY created_at DESC LIMIT ?';
  params.push(parseInt(limit) || 100);

  const mensagens = db.prepare(query).all(...params);
  res.json(mensagens);
});

// ============ SUPERVISORES DE BACKUP ============

// Listar supervisores de um gestor
app.get('/api/supervisores/:gestor_id', async (req, res) => {
  try {
    const supervisores = await whatsapp.getSupervisores(req.params.gestor_id);
    res.json(supervisores);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Adicionar supervisor
app.post('/api/supervisores', async (req, res) => {
  try {
    const { gestor_id, nome, whatsapp: whatsappNum, email, ordem_prioridade } = req.body;
    const resultado = await whatsapp.adicionarSupervisor(gestor_id, { nome, whatsapp: whatsappNum, email, ordem_prioridade });
    res.json(resultado);
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
