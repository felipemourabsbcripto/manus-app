const Database = require('better-sqlite3');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const db = new Database(path.join(__dirname, 'escala.db'));

// Criar tabelas
db.exec(`
  -- Unidades
  CREATE TABLE IF NOT EXISTS unidades (
    id TEXT PRIMARY KEY,
    nome TEXT NOT NULL,
    endereco TEXT,
    ativo INTEGER DEFAULT 1
  );

  -- Funcionários (agora com campos para médicos e unidade)
  CREATE TABLE IF NOT EXISTS funcionarios (
    id TEXT PRIMARY KEY,
    nome TEXT NOT NULL,
    email TEXT UNIQUE,
    senha TEXT,
    telefone TEXT,
    whatsapp TEXT,
    cargo TEXT,
    especialidade TEXT,
    crm TEXT,
    tipo TEXT DEFAULT 'funcionario',
    gestor_id TEXT,
    salario_hora REAL DEFAULT 0,
    ativo INTEGER DEFAULT 1,
    unidade_id TEXT,
    foto_url TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (gestor_id) REFERENCES funcionarios(id),
    FOREIGN KEY (unidade_id) REFERENCES unidades(id)
  );
`);


// Migrations para bancos existentes
try {
  db.exec("ALTER TABLE funcionarios ADD COLUMN senha TEXT");
} catch (err) { }

try {
  db.exec("ALTER TABLE funcionarios ADD COLUMN unidade_id TEXT");
} catch (err) { }

try {
  db.exec("ALTER TABLE funcionarios ADD COLUMN foto_url TEXT");
} catch (err) { }

// Criar usuário Admin padrão se não existir nenhum funcionário
const adminExiste = db.prepare("SELECT COUNT(*) as count FROM funcionarios WHERE email = 'felipemouragestor@outlook.com'").get();
if (adminExiste.count === 0) {
  // Senha padrão:admin123 (em um app real, use hash/salt)
  const adminId = uuidv4();
  db.prepare(`
      INSERT INTO funcionarios(id, nome, email, senha, tipo, cargo) 
      VALUES(?, ?, ?, ?, ?, ?)
    `).run(adminId, 'Administrador', 'felipemouragestor@outlook.com', 'santacasa123', 'admin', 'Administrador do Sistema');
}



// Continuar criando as outras tabelas
db.exec(`
  -- Turnos disponíveis
  CREATE TABLE IF NOT EXISTS turnos (
    id TEXT PRIMARY KEY,
    nome TEXT NOT NULL,
    hora_inicio TEXT NOT NULL,
    hora_fim TEXT NOT NULL,
    dias_semana TEXT NOT NULL,
    ativo INTEGER DEFAULT 1
  );

  -- Escalas
  CREATE TABLE IF NOT EXISTS escalas (
    id TEXT PRIMARY KEY,
    funcionario_id TEXT NOT NULL,
    turno_id TEXT,
    data TEXT NOT NULL,
    hora_inicio TEXT NOT NULL,
    hora_fim TEXT NOT NULL,
    status TEXT DEFAULT 'agendado',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (funcionario_id) REFERENCES funcionarios(id),
    FOREIGN KEY (turno_id) REFERENCES turnos(id)
  );

  -- Presenças/Furos
  CREATE TABLE IF NOT EXISTS presencas (
    id TEXT PRIMARY KEY,
    escala_id TEXT,
    funcionario_id TEXT NOT NULL,
    data TEXT NOT NULL,
    hora_entrada TEXT,
    hora_saida TEXT,
    status TEXT DEFAULT 'pendente',
    justificativa TEXT,
    aprovado INTEGER DEFAULT 0,
    checkin_lat REAL,
    checkin_lng REAL,
    checkin_timestamp TEXT,
    checkout_lat REAL,
    checkout_lng REAL,
    checkout_timestamp TEXT,
    hora_extra_minutos INTEGER DEFAULT 0,
    hora_extra_motivo TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (escala_id) REFERENCES escalas(id),
    FOREIGN KEY (funcionario_id) REFERENCES funcionarios(id)
  );

  -- Notas/Avaliações
  CREATE TABLE IF NOT EXISTS notas (
    id TEXT PRIMARY KEY,
    funcionario_id TEXT NOT NULL,
    periodo_inicio TEXT NOT NULL,
    periodo_fim TEXT NOT NULL,
    pontualidade REAL DEFAULT 0,
    assiduidade REAL DEFAULT 0,
    desempenho REAL DEFAULT 0,
    observacoes TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (funcionario_id) REFERENCES funcionarios(id)
  );

  -- Pagamentos
  CREATE TABLE IF NOT EXISTS pagamentos (
    id TEXT PRIMARY KEY,
    funcionario_id TEXT NOT NULL,
    periodo_inicio TEXT NOT NULL,
    periodo_fim TEXT NOT NULL,
    horas_trabalhadas REAL DEFAULT 0,
    horas_extras REAL DEFAULT 0,
    valor_hora REAL DEFAULT 0,
    descontos REAL DEFAULT 0,
    bonus REAL DEFAULT 0,
    valor_total REAL DEFAULT 0,
    status TEXT DEFAULT 'pendente',
    data_pagamento TEXT,
    observacoes TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (funcionario_id) REFERENCES funcionarios(id)
  );

  -- Avisos/Notificações
  CREATE TABLE IF NOT EXISTS avisos (
    id TEXT PRIMARY KEY,
    tipo TEXT NOT NULL,
    titulo TEXT NOT NULL,
    mensagem TEXT NOT NULL,
    funcionario_id TEXT,
    lido INTEGER DEFAULT 0,
    enviado_whatsapp INTEGER DEFAULT 0,
    enviado_grupo INTEGER DEFAULT 0,
    data_criacao TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (funcionario_id) REFERENCES funcionarios(id)
  );

  -- Configurações
  CREATE TABLE IF NOT EXISTS configuracoes (
    chave TEXT PRIMARY KEY,
    valor TEXT
  );

  -- ============ NOVAS TABELAS PARA WHATSAPP E GRUPOS ============

  -- Conexões WhatsApp (gestores conectados)
  CREATE TABLE IF NOT EXISTS whatsapp_conexoes (
    id TEXT PRIMARY KEY,
    gestor_id TEXT NOT NULL,
    instancia_id TEXT,
    telefone TEXT,
    status TEXT DEFAULT 'desconectado',
    qrcode TEXT,
    ultimo_sync TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (gestor_id) REFERENCES funcionarios(id)
  );

  -- Grupos WhatsApp por gestor
  CREATE TABLE IF NOT EXISTS whatsapp_grupos (
    id TEXT PRIMARY KEY,
    gestor_id TEXT NOT NULL,
    grupo_id_whatsapp TEXT,
    nome TEXT NOT NULL,
    descricao TEXT,
    link_convite TEXT,
    ativo INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (gestor_id) REFERENCES funcionarios(id)
  );

  -- Membros dos grupos
  CREATE TABLE IF NOT EXISTS whatsapp_grupo_membros (
    id TEXT PRIMARY KEY,
    grupo_id TEXT NOT NULL,
    funcionario_id TEXT NOT NULL,
    adicionado_em TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (grupo_id) REFERENCES whatsapp_grupos(id),
    FOREIGN KEY (funcionario_id) REFERENCES funcionarios(id)
  );

  -- Mensagens enviadas (log)
  CREATE TABLE IF NOT EXISTS whatsapp_mensagens (
    id TEXT PRIMARY KEY,
    tipo TEXT NOT NULL,
    destino TEXT NOT NULL,
    destino_id TEXT,
    mensagem TEXT NOT NULL,
    grupo_id TEXT,
    funcionario_marcado TEXT,
    status TEXT DEFAULT 'pendente',
    enviado_em TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (grupo_id) REFERENCES whatsapp_grupos(id)
  );

  -- Localizações registradas
  CREATE TABLE IF NOT EXISTS localizacoes (
    id TEXT PRIMARY KEY,
    funcionario_id TEXT NOT NULL,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    tipo TEXT NOT NULL,
    distancia_hospital REAL,
    presenca_id TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (funcionario_id) REFERENCES funcionarios(id),
    FOREIGN KEY (presenca_id) REFERENCES presencas(id)
  );

  -- Hospitais/Locais de trabalho
  CREATE TABLE IF NOT EXISTS hospitais (
    id TEXT PRIMARY KEY,
    nome TEXT NOT NULL,
    endereco TEXT,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    raio_metros INTEGER DEFAULT 500,
    ativo INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  -- Backlog individual (histórico de eventos)
  CREATE TABLE IF NOT EXISTS backlog (
    id TEXT PRIMARY KEY,
    funcionario_id TEXT NOT NULL,
    tipo TEXT NOT NULL,
    titulo TEXT NOT NULL,
    descricao TEXT,
    dados_json TEXT,
    data_evento TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (funcionario_id) REFERENCES funcionarios(id)
  );

  -- Relatórios gerados
  CREATE TABLE IF NOT EXISTS relatorios (
    id TEXT PRIMARY KEY,
    gestor_id TEXT NOT NULL,
    tipo TEXT NOT NULL,
    periodo_inicio TEXT,
    periodo_fim TEXT,
    dados_json TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (gestor_id) REFERENCES funcionarios(id)
  );

  -- Verificações de localização agendadas
  CREATE TABLE IF NOT EXISTS verificacoes_localizacao (
    id TEXT PRIMARY KEY,
    funcionario_id TEXT NOT NULL,
    presenca_id TEXT NOT NULL,
    tipo TEXT NOT NULL,
    agendado_para TEXT NOT NULL,
    executado INTEGER DEFAULT 0,
    resultado TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (funcionario_id) REFERENCES funcionarios(id),
    FOREIGN KEY (presenca_id) REFERENCES presencas(id)
  );

  -- Hora extra
  CREATE TABLE IF NOT EXISTS horas_extras (
    id TEXT PRIMARY KEY,
    funcionario_id TEXT NOT NULL,
    presenca_id TEXT NOT NULL,
    data TEXT NOT NULL,
    hora_inicio TEXT NOT NULL,
    hora_fim TEXT,
    minutos_total INTEGER DEFAULT 0,
    motivo TEXT,
    status TEXT DEFAULT 'em_andamento',
    aprovado INTEGER DEFAULT 0,
    aprovado_por TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (funcionario_id) REFERENCES funcionarios(id),
    FOREIGN KEY (presenca_id) REFERENCES presencas(id)
  );

  -- Supervisores de backup para gestores (envio de mensagens)
  CREATE TABLE IF NOT EXISTS supervisores (
    id TEXT PRIMARY KEY,
    gestor_id TEXT NOT NULL,
    nome TEXT NOT NULL,
    whatsapp TEXT NOT NULL,
    email TEXT,
    ordem_prioridade INTEGER DEFAULT 1,
    ativo INTEGER DEFAULT 1,
    ultimo_uso TEXT,
    falhas_consecutivas INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (gestor_id) REFERENCES funcionarios(id)
  );

  -- Log de tentativas de envio de mensagens (para fallback)
  CREATE TABLE IF NOT EXISTS whatsapp_envios_log (
    id TEXT PRIMARY KEY,
    mensagem_id TEXT NOT NULL,
    remetente_tipo TEXT NOT NULL,
    remetente_id TEXT NOT NULL,
    remetente_whatsapp TEXT NOT NULL,
    sucesso INTEGER DEFAULT 0,
    erro TEXT,
    tentativa INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (mensagem_id) REFERENCES whatsapp_mensagens(id)
  );
`);

// Inserir configurações padrão
const configPadrao = [
  ['tolerancia_atraso_minutos', '15'],
  ['horas_extras_multiplicador', '1.5'],
  ['desconto_furo_percentual', '5'],
  ['email_notificacao', ''],
  ['notificar_furos', '1'],
  ['notificar_escalas', '1'],
  ['whatsapp_ativo', '1'],
  ['verificar_localizacao_intervalo', '60'],
  ['distancia_maxima_hospital', '2000'],
  ['verificar_saida_intervalo', '30'],
  ['hospital_principal_lat', '-23.5505'],
  ['hospital_principal_lng', '-46.6333'],
  ['hospital_principal_nome', 'Hospital Principal']
];

const insertConfig = db.prepare('INSERT OR IGNORE INTO configuracoes (chave, valor) VALUES (?, ?)');
configPadrao.forEach(([chave, valor]) => insertConfig.run(chave, valor));

// Inserir unidades institucionais se não existirem
const countUnidades = db.prepare("SELECT COUNT(*) as count FROM unidades").get();
if (countUnidades && countUnidades.count === 0) {
  const { v4: uuidv4 } = require('uuid');
  const unidades = [
    'Hospital Santa Casa BH',
    'Hospital São Lucas',
    'Unidade de Oncologia SCBH',
    'Faculdade de Saúde SCBH',
    'ÓrixLab',
    'Instituto Geriátrico',
    'Assistência Familiar SCBH',
    'Instituto de Educação e Pesquisa',
    'Centro de Especialidades Médicas',
    'Unidade de Transplantes'
  ];
  const stmt = db.prepare("INSERT INTO unidades (id, nome) VALUES (?, ?)");
  unidades.forEach(nome => stmt.run(uuidv4(), nome));
}

// Inserir hospital padrão
const hospitalExiste = db.prepare('SELECT COUNT(*) as count FROM hospitais').get();
if (hospitalExiste.count === 0) {
  // Assuming uuidv4 is defined globally or imported elsewhere if not in the above block
  // If uuidv4 is only defined within the 'unidades' block, it needs to be moved to a higher scope
  // For now, keeping it as per the instruction's context.
  db.prepare(`
    INSERT INTO hospitais (id, nome, endereco, latitude, longitude, raio_metros) 
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(uuidv4(), 'Hospital Principal', 'Endereço do Hospital', -23.5505, -46.6333, 500);
}

module.exports = db;
