/**
 * Módulo de Integração WhatsApp
 * Simula integração com Evolution API / Baileys
 * Em produção, substitua pela API real do WhatsApp Business
 * 
 * FUNCIONALIDADE DE FALLBACK:
 * - Se o envio pelo número principal falhar, tenta pelos supervisores
 * - Supervisores são tentados em ordem de prioridade
 * - Falhas são registradas para análise
 */

const { v4: uuidv4 } = require('uuid');
const db = require('./database');

class WhatsAppService {
  constructor() {
    this.conexoes = new Map();
    this.filaEnvio = [];
    this.MAX_TENTATIVAS = 3;
  }

  // ============ SUPERVISORES ============

  // Adicionar supervisor de backup para gestor
  async adicionarSupervisor(gestorId, dados) {
    const { nome, whatsapp, email, ordem_prioridade } = dados;
    
    const gestor = db.prepare('SELECT * FROM funcionarios WHERE id = ?').get(gestorId);
    if (!gestor) throw new Error('Gestor não encontrado');

    // Verificar se já existe supervisor com este WhatsApp
    const existe = db.prepare(`
      SELECT * FROM supervisores WHERE gestor_id = ? AND whatsapp = ?
    `).get(gestorId, whatsapp);
    
    if (existe) throw new Error('Já existe um supervisor com este WhatsApp');

    // Calcular próxima ordem se não especificada
    let ordem = ordem_prioridade;
    if (!ordem) {
      const maxOrdem = db.prepare(`
        SELECT MAX(ordem_prioridade) as max FROM supervisores WHERE gestor_id = ?
      `).get(gestorId);
      ordem = (maxOrdem?.max || 0) + 1;
    }

    const id = uuidv4();
    db.prepare(`
      INSERT INTO supervisores (id, gestor_id, nome, whatsapp, email, ordem_prioridade)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, gestorId, nome, whatsapp, email, ordem);

    return { id, gestor_id: gestorId, nome, whatsapp, email, ordem_prioridade: ordem };
  }

  // Listar supervisores do gestor
  async getSupervisores(gestorId) {
    return db.prepare(`
      SELECT * FROM supervisores 
      WHERE gestor_id = ? AND ativo = 1
      ORDER BY ordem_prioridade ASC
    `).all(gestorId);
  }

  // Atualizar supervisor
  async atualizarSupervisor(supervisorId, dados) {
    const { nome, whatsapp, email, ordem_prioridade, ativo } = dados;
    
    db.prepare(`
      UPDATE supervisores 
      SET nome = ?, whatsapp = ?, email = ?, ordem_prioridade = ?, ativo = ?
      WHERE id = ?
    `).run(nome, whatsapp, email, ordem_prioridade, ativo ? 1 : 0, supervisorId);

    return { success: true };
  }

  // Remover supervisor
  async removerSupervisor(supervisorId) {
    db.prepare('DELETE FROM supervisores WHERE id = ?').run(supervisorId);
    return { success: true };
  }

  // Reordenar supervisores
  async reordenarSupervisores(gestorId, ordemIds) {
    ordemIds.forEach((id, index) => {
      db.prepare(`
        UPDATE supervisores SET ordem_prioridade = ? WHERE id = ? AND gestor_id = ?
      `).run(index + 1, id, gestorId);
    });
    return { success: true };
  }

  // ============ ENVIO COM FALLBACK ============

  // Simular envio de mensagem (em produção, substituir por API real)
  async _enviarMensagemAPI(whatsappNumero, mensagem, tentativa = 1) {
    // Simular possível falha (10% de chance em produção seria a API real)
    const falhaSimulada = Math.random() < 0.1; // 10% de chance de falha para teste
    
    if (falhaSimulada && tentativa < this.MAX_TENTATIVAS) {
      throw new Error('Falha no envio: serviço temporariamente indisponível');
    }
    
    // Simular sucesso
    console.log(`[WhatsApp API] Enviando para ${whatsappNumero}: ${mensagem.substring(0, 50)}...`);
    return { success: true, timestamp: new Date().toISOString() };
  }

  // Registrar log de envio
  _registrarLogEnvio(mensagemId, remetenteTipo, remetenteId, remetenteWhatsapp, sucesso, erro = null, tentativa = 1) {
    db.prepare(`
      INSERT INTO whatsapp_envios_log (id, mensagem_id, remetente_tipo, remetente_id, remetente_whatsapp, sucesso, erro, tentativa)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(uuidv4(), mensagemId, remetenteTipo, remetenteId, remetenteWhatsapp, sucesso ? 1 : 0, erro, tentativa);
  }

  // Incrementar falhas consecutivas do supervisor
  _incrementarFalhasSupervisor(supervisorId) {
    db.prepare(`
      UPDATE supervisores SET falhas_consecutivas = falhas_consecutivas + 1 WHERE id = ?
    `).run(supervisorId);
  }

  // Resetar falhas do supervisor após sucesso
  _resetarFalhasSupervisor(supervisorId) {
    db.prepare(`
      UPDATE supervisores SET falhas_consecutivas = 0, ultimo_uso = datetime('now') WHERE id = ?
    `).run(supervisorId);
  }

  // Enviar mensagem com fallback para supervisores
  async enviarMensagemComFallback(gestorId, destino, mensagem, msgId = null) {
    const mensagemId = msgId || uuidv4();
    
    // 1. Primeiro, tentar pelo gestor principal
    const gestor = db.prepare('SELECT * FROM funcionarios WHERE id = ?').get(gestorId);
    const conexao = db.prepare(`
      SELECT * FROM whatsapp_conexoes WHERE gestor_id = ? AND status = 'conectado'
    `).get(gestorId);

    if (gestor && conexao) {
      try {
        await this._enviarMensagemAPI(conexao.telefone, mensagem);
        this._registrarLogEnvio(mensagemId, 'gestor', gestorId, conexao.telefone, true, null, 1);
        console.log(`[WhatsApp] ✅ Mensagem enviada pelo gestor principal: ${gestor.nome}`);
        return { success: true, enviado_por: 'gestor', nome: gestor.nome, whatsapp: conexao.telefone };
      } catch (error) {
        console.log(`[WhatsApp] ❌ Falha no envio pelo gestor principal: ${error.message}`);
        this._registrarLogEnvio(mensagemId, 'gestor', gestorId, conexao.telefone, false, error.message, 1);
      }
    }

    // 2. Buscar supervisores de backup ordenados por prioridade
    const supervisores = db.prepare(`
      SELECT * FROM supervisores 
      WHERE gestor_id = ? AND ativo = 1 AND falhas_consecutivas < 5
      ORDER BY ordem_prioridade ASC
    `).all(gestorId);

    if (supervisores.length === 0) {
      console.log(`[WhatsApp] ⚠️ Nenhum supervisor de backup disponível para gestor ${gestor?.nome}`);
      return { success: false, erro: 'Nenhum remetente disponível' };
    }

    // 3. Tentar cada supervisor em ordem
    let tentativa = 2; // Começa em 2 pois 1 foi o gestor
    for (const supervisor of supervisores) {
      try {
        await this._enviarMensagemAPI(supervisor.whatsapp, mensagem, tentativa);
        this._registrarLogEnvio(mensagemId, 'supervisor', supervisor.id, supervisor.whatsapp, true, null, tentativa);
        this._resetarFalhasSupervisor(supervisor.id);
        console.log(`[WhatsApp] ✅ Mensagem enviada pelo supervisor de backup: ${supervisor.nome}`);
        return { 
          success: true, 
          enviado_por: 'supervisor', 
          nome: supervisor.nome, 
          whatsapp: supervisor.whatsapp,
          tentativa 
        };
      } catch (error) {
        console.log(`[WhatsApp] ❌ Falha no envio pelo supervisor ${supervisor.nome}: ${error.message}`);
        this._registrarLogEnvio(mensagemId, 'supervisor', supervisor.id, supervisor.whatsapp, false, error.message, tentativa);
        this._incrementarFalhasSupervisor(supervisor.id);
        tentativa++;
      }
    }

    // 4. Todas as tentativas falharam
    console.log(`[WhatsApp] 🚫 Todas as tentativas de envio falharam`);
    return { success: false, erro: 'Todas as tentativas de envio falharam', tentativas: tentativa - 1 };
  }

  // Obter estatísticas de envio
  async getEstatisticasEnvio(gestorId, periodoInicio = null, periodoFim = null) {
    let whereData = '';
    const params = [gestorId];
    
    if (periodoInicio && periodoFim) {
      whereData = ' AND l.created_at BETWEEN ? AND ?';
      params.push(periodoInicio + ' 00:00:00', periodoFim + ' 23:59:59');
    }

    // Estatísticas do gestor
    const estatGestor = db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN sucesso = 1 THEN 1 ELSE 0 END) as sucessos,
        SUM(CASE WHEN sucesso = 0 THEN 1 ELSE 0 END) as falhas
      FROM whatsapp_envios_log l
      WHERE l.remetente_tipo = 'gestor' AND l.remetente_id = ? ${whereData}
    `).get(...params);

    // Estatísticas dos supervisores
    const estatSupervisores = db.prepare(`
      SELECT 
        s.nome,
        s.whatsapp,
        COUNT(*) as total,
        SUM(CASE WHEN l.sucesso = 1 THEN 1 ELSE 0 END) as sucessos,
        SUM(CASE WHEN l.sucesso = 0 THEN 1 ELSE 0 END) as falhas,
        s.falhas_consecutivas
      FROM whatsapp_envios_log l
      JOIN supervisores s ON l.remetente_id = s.id
      WHERE s.gestor_id = ? AND l.remetente_tipo = 'supervisor' ${whereData}
      GROUP BY s.id
    `).all(...params);

    return {
      gestor: estatGestor,
      supervisores: estatSupervisores,
      total_mensagens: (estatGestor?.total || 0) + estatSupervisores.reduce((acc, s) => acc + s.total, 0)
    };
  }

  // ============ CONEXÃO WHATSAPP ============

  // Gerar QR Code para conexão (simulado)
  async gerarQRCode(gestorId) {
    const id = uuidv4();
    const qrcode = `WHATSAPP_QR_${gestorId}_${Date.now()}`;
    
    // Salvar conexão pendente
    db.prepare(`
      INSERT OR REPLACE INTO whatsapp_conexoes (id, gestor_id, status, qrcode, created_at)
      VALUES (?, ?, 'aguardando_scan', ?, datetime('now'))
    `).run(id, gestorId, qrcode);

    return { id, qrcode, status: 'aguardando_scan' };
  }

  // Simular conexão bem sucedida
  async confirmarConexao(gestorId, telefone) {
    db.prepare(`
      UPDATE whatsapp_conexoes 
      SET status = 'conectado', telefone = ?, ultimo_sync = datetime('now'), qrcode = NULL
      WHERE gestor_id = ?
    `).run(telefone, gestorId);

    return { success: true, status: 'conectado' };
  }

  // Verificar status da conexão
  async getStatusConexao(gestorId) {
    const conexao = db.prepare(`
      SELECT * FROM whatsapp_conexoes WHERE gestor_id = ? ORDER BY created_at DESC LIMIT 1
    `).get(gestorId);
    
    // Incluir info dos supervisores
    const supervisores = await this.getSupervisores(gestorId);
    
    return { ...conexao, supervisores_backup: supervisores.length };
  }

  // Desconectar WhatsApp
  async desconectar(gestorId) {
    db.prepare(`
      UPDATE whatsapp_conexoes SET status = 'desconectado' WHERE gestor_id = ?
    `).run(gestorId);
    return { success: true };
  }

  // ============ GRUPOS ============

  // Criar grupo para gestor
  async criarGrupo(gestorId, nome, descricao = '') {
    const gestor = db.prepare('SELECT * FROM funcionarios WHERE id = ?').get(gestorId);
    if (!gestor) throw new Error('Gestor não encontrado');

    const grupoId = uuidv4();
    const linkConvite = `https://chat.whatsapp.com/CONVITE_${grupoId.substring(0, 8).toUpperCase()}`;
    const nomeGrupo = `Plantão - ${gestor.nome}`;

    db.prepare(`
      INSERT INTO whatsapp_grupos (id, gestor_id, nome, descricao, link_convite)
      VALUES (?, ?, ?, ?, ?)
    `).run(grupoId, gestorId, nomeGrupo, descricao, linkConvite);

    // Adicionar gestor como membro
    db.prepare(`
      INSERT INTO whatsapp_grupo_membros (id, grupo_id, funcionario_id)
      VALUES (?, ?, ?)
    `).run(uuidv4(), grupoId, gestorId);

    // Log no backlog
    this.registrarBacklog(gestorId, 'grupo_criado', 'Grupo WhatsApp Criado', 
      `Grupo "${nomeGrupo}" criado com sucesso`, { grupo_id: grupoId });

    return { 
      id: grupoId, 
      nome: nomeGrupo, 
      link_convite: linkConvite,
      gestor: gestor.nome
    };
  }

  // Adicionar membro ao grupo
  async adicionarMembro(grupoId, funcionarioId) {
    const grupo = db.prepare('SELECT * FROM whatsapp_grupos WHERE id = ?').get(grupoId);
    const funcionario = db.prepare('SELECT * FROM funcionarios WHERE id = ?').get(funcionarioId);
    
    if (!grupo || !funcionario) throw new Error('Grupo ou funcionário não encontrado');

    // Verificar se já é membro
    const jaMembro = db.prepare(`
      SELECT * FROM whatsapp_grupo_membros WHERE grupo_id = ? AND funcionario_id = ?
    `).get(grupoId, funcionarioId);

    if (!jaMembro) {
      db.prepare(`
        INSERT INTO whatsapp_grupo_membros (id, grupo_id, funcionario_id)
        VALUES (?, ?, ?)
      `).run(uuidv4(), grupoId, funcionarioId);

      // Enviar link de convite
      await this.enviarMensagemPessoal(
        funcionarioId,
        `🏥 *Bem-vindo ao Plantão!*\n\nVocê foi adicionado ao grupo de plantão.\n\n` +
        `📱 *Link do grupo:* ${grupo.link_convite}\n\n` +
        `Clique no link acima para entrar no grupo e receber atualizações em tempo real.`
      );
    }

    return { success: true, funcionario: funcionario.nome };
  }

  // Obter grupos do gestor
  async getGruposGestor(gestorId) {
    const grupos = db.prepare(`
      SELECT g.*, 
        (SELECT COUNT(*) FROM whatsapp_grupo_membros WHERE grupo_id = g.id) as total_membros
      FROM whatsapp_grupos g
      WHERE g.gestor_id = ? AND g.ativo = 1
    `).all(gestorId);

    return grupos;
  }

  // Obter membros do grupo
  async getMembrosGrupo(grupoId) {
    const membros = db.prepare(`
      SELECT f.*, gm.adicionado_em
      FROM whatsapp_grupo_membros gm
      JOIN funcionarios f ON gm.funcionario_id = f.id
      WHERE gm.grupo_id = ?
    `).all(grupoId);

    return membros;
  }

  // ============ MENSAGENS COM FALLBACK ============

  // Enviar mensagem para o grupo (com fallback)
  async enviarMensagemGrupo(grupoId, mensagem, funcionarioMarcado = null) {
    const grupo = db.prepare('SELECT * FROM whatsapp_grupos WHERE id = ?').get(grupoId);
    if (!grupo) throw new Error('Grupo não encontrado');

    let mensagemFinal = mensagem;
    if (funcionarioMarcado) {
      const func = db.prepare('SELECT * FROM funcionarios WHERE id = ?').get(funcionarioMarcado);
      if (func) {
        mensagemFinal = `@${func.whatsapp || func.telefone} ${mensagem}`;
      }
    }

    const msgId = uuidv4();
    
    // Tentar enviar com fallback para supervisores
    const resultado = await this.enviarMensagemComFallback(grupo.gestor_id, grupo.nome, mensagemFinal, msgId);
    
    db.prepare(`
      INSERT INTO whatsapp_mensagens (id, tipo, destino, destino_id, mensagem, grupo_id, funcionario_marcado, status, enviado_em)
      VALUES (?, 'grupo', ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(msgId, grupo.nome, grupoId, mensagemFinal, grupoId, funcionarioMarcado, resultado.success ? 'enviado' : 'falha');

    console.log(`[WhatsApp Grupo] ${grupo.nome}: ${mensagemFinal.substring(0, 50)}...`);
    return { success: resultado.success, mensagem_id: msgId, enviado_por: resultado.enviado_por || 'nenhum' };
  }

  // Enviar mensagem pessoal (com fallback se necessário)
  async enviarMensagemPessoal(funcionarioId, mensagem) {
    const func = db.prepare('SELECT * FROM funcionarios WHERE id = ?').get(funcionarioId);
    if (!func) throw new Error('Funcionário não encontrado');

    const msgId = uuidv4();
    
    // Se o funcionário tem gestor, usar sistema de fallback
    let resultado = { success: true };
    if (func.gestor_id) {
      resultado = await this.enviarMensagemComFallback(func.gestor_id, func.whatsapp || func.telefone, mensagem, msgId);
    }

    db.prepare(`
      INSERT INTO whatsapp_mensagens (id, tipo, destino, destino_id, mensagem, status, enviado_em)
      VALUES (?, 'pessoal', ?, ?, ?, ?, datetime('now'))
    `).run(msgId, func.whatsapp || func.telefone, funcionarioId, mensagem, resultado.success ? 'enviado' : 'falha');

    console.log(`[WhatsApp Pessoal] ${func.nome}: ${mensagem.substring(0, 50)}...`);
    return { success: resultado.success, mensagem_id: msgId, enviado_por: resultado.enviado_por || 'direto' };
  }

  // Enviar para grupo E pessoal (quando específico para um médico)
  async enviarMensagemCompleta(grupoId, funcionarioId, mensagem, apenasGrupo = false) {
    // Enviar no grupo marcando o funcionário
    await this.enviarMensagemGrupo(grupoId, mensagem, funcionarioId);
    
    // Enviar também no pessoal se não for apenas grupo
    if (!apenasGrupo) {
      await this.enviarMensagemPessoal(funcionarioId, mensagem);
    }

    return { success: true };
  }

  // ============ NOTIFICAÇÕES DE PLANTÃO ============

  // Notificar início de plantão no grupo
  async notificarInicioPlantao(gestorId, data) {
    const grupo = db.prepare(`
      SELECT * FROM whatsapp_grupos WHERE gestor_id = ? AND ativo = 1 LIMIT 1
    `).get(gestorId);

    if (!grupo) return;

    // Buscar escalas do dia
    const escalas = db.prepare(`
      SELECT e.*, f.nome, f.especialidade, f.whatsapp, f.telefone
      FROM escalas e
      JOIN funcionarios f ON e.funcionario_id = f.id
      WHERE e.data = ? AND f.gestor_id = ?
      ORDER BY e.hora_inicio
    `).all(data, gestorId);

    if (escalas.length === 0) return;

    let mensagem = `🏥 *PLANTÃO DO DIA ${data.split('-').reverse().join('/')}*\n\n`;
    mensagem += `📋 *Equipe escalada:*\n\n`;

    escalas.forEach((e, i) => {
      mensagem += `${i + 1}. *${e.nome}*\n`;
      mensagem += `   📌 Especialidade: ${e.especialidade || 'N/A'}\n`;
      mensagem += `   ⏰ Horário: ${e.hora_inicio} - ${e.hora_fim}\n\n`;
    });

    mensagem += `\n✅ Todos devem fazer check-in ao chegar!\n`;
    mensagem += `📍 Lembre-se de compartilhar sua localização.`;

    await this.enviarMensagemGrupo(grupo.id, mensagem);

    return { success: true, escalas_notificadas: escalas.length };
  }

  // Notificar check-in de médico
  async notificarCheckIn(funcionarioId, hora, localizacao) {
    const func = db.prepare(`
      SELECT f.*, g.gestor_id 
      FROM funcionarios f
      LEFT JOIN funcionarios g ON f.gestor_id = g.id
      WHERE f.id = ?
    `).get(funcionarioId);

    if (!func) return;

    const grupo = db.prepare(`
      SELECT * FROM whatsapp_grupos WHERE gestor_id = ? AND ativo = 1 LIMIT 1
    `).get(func.gestor_id);

    if (grupo) {
      const mensagem = `✅ *CHECK-IN REALIZADO*\n\n` +
        `👨‍⚕️ *${func.nome}*\n` +
        `📌 ${func.especialidade || 'Médico'}\n` +
        `⏰ Entrada: ${hora}\n` +
        `📍 Localização confirmada`;

      await this.enviarMensagemGrupo(grupo.id, mensagem);
    }

    // Log no backlog
    this.registrarBacklog(funcionarioId, 'checkin', 'Check-in Realizado',
      `Check-in às ${hora}`, { localizacao, hora });

    return { success: true };
  }

  // Notificar check-out de médico
  async notificarCheckOut(funcionarioId, hora, horaExtra = false, motivo = '') {
    const func = db.prepare(`
      SELECT f.*, g.gestor_id 
      FROM funcionarios f
      LEFT JOIN funcionarios g ON f.gestor_id = g.id
      WHERE f.id = ?
    `).get(funcionarioId);

    if (!func) return;

    const grupo = db.prepare(`
      SELECT * FROM whatsapp_grupos WHERE gestor_id = ? AND ativo = 1 LIMIT 1
    `).get(func.gestor_id);

    if (grupo) {
      let mensagem = `🔴 *PLANTÃO ENCERRADO*\n\n` +
        `👨‍⚕️ *${func.nome}*\n` +
        `📌 ${func.especialidade || 'Médico'}\n` +
        `⏰ Saída: ${hora}`;

      if (horaExtra) {
        mensagem += `\n\n⏱️ *HORA EXTRA REGISTRADA*\n📝 Motivo: ${motivo}`;
      }

      await this.enviarMensagemGrupo(grupo.id, mensagem);
    }

    // Log no backlog
    this.registrarBacklog(funcionarioId, 'checkout', 'Check-out Realizado',
      `Check-out às ${hora}${horaExtra ? ' (com hora extra)' : ''}`, { hora, horaExtra, motivo });

    return { success: true };
  }

  // Notificar falta/furo
  async notificarFalta(funcionarioId, data, tipo) {
    const func = db.prepare(`
      SELECT f.*, g.gestor_id, g.nome as gestor_nome
      FROM funcionarios f
      LEFT JOIN funcionarios g ON f.gestor_id = g.id
      WHERE f.id = ?
    `).get(funcionarioId);

    if (!func) return;

    const grupo = db.prepare(`
      SELECT * FROM whatsapp_grupos WHERE gestor_id = ? AND ativo = 1 LIMIT 1
    `).get(func.gestor_id);

    const tipoTexto = tipo === 'furo' ? 'FURO' : 'FALTA';
    const emoji = tipo === 'furo' ? '⚠️' : '❌';

    // Mensagem no grupo marcando o funcionário
    if (grupo) {
      const mensagemGrupo = `${emoji} *${tipoTexto} REGISTRADO*\n\n` +
        `👨‍⚕️ *${func.nome}*\n` +
        `📅 Data: ${data.split('-').reverse().join('/')}\n\n` +
        `⚠️ Gestor notificado.`;

      await this.enviarMensagemGrupo(grupo.id, mensagemGrupo, funcionarioId);
    }

    // Mensagem pessoal
    const mensagemPessoal = `${emoji} *ATENÇÃO: ${tipoTexto} REGISTRADO*\n\n` +
      `Você teve um ${tipoTexto.toLowerCase()} registrado em ${data.split('-').reverse().join('/')}.\n\n` +
      `Por favor, entre em contato com seu gestor para justificar.`;

    await this.enviarMensagemPessoal(funcionarioId, mensagemPessoal);

    // Notificar gestor
    if (func.gestor_id) {
      const mensagemGestor = `🚨 *ALERTA DE ${tipoTexto}*\n\n` +
        `👨‍⚕️ Médico: ${func.nome}\n` +
        `📅 Data: ${data.split('-').reverse().join('/')}\n\n` +
        `Acesse o sistema para mais detalhes.`;

      await this.enviarMensagemPessoal(func.gestor_id, mensagemGestor);
    }

    // Log no backlog
    this.registrarBacklog(funcionarioId, tipo, `${tipoTexto} Registrado`,
      `${tipoTexto} em ${data}`, { data, tipo });

    return { success: true };
  }

  // Notificar troca de escala
  async notificarTroca(funcionarioOriginalId, funcionarioNovoId, data, horario) {
    const original = db.prepare('SELECT * FROM funcionarios WHERE id = ?').get(funcionarioOriginalId);
    const novo = db.prepare('SELECT * FROM funcionarios WHERE id = ?').get(funcionarioNovoId);

    const gestorId = original?.gestor_id || novo?.gestor_id;
    const grupo = db.prepare(`
      SELECT * FROM whatsapp_grupos WHERE gestor_id = ? AND ativo = 1 LIMIT 1
    `).get(gestorId);

    if (grupo) {
      const mensagem = `🔄 *TROCA DE ESCALA*\n\n` +
        `📅 Data: ${data.split('-').reverse().join('/')}\n` +
        `⏰ Horário: ${horario}\n\n` +
        `❌ Saiu: *${original?.nome}*\n` +
        `✅ Entrou: *${novo?.nome}*\n\n` +
        `Troca registrada no sistema.`;

      await this.enviarMensagemGrupo(grupo.id, mensagem);
    }

    // Notificar ambos individualmente
    if (original) {
      await this.enviarMensagemPessoal(funcionarioOriginalId,
        `🔄 Sua escala do dia ${data.split('-').reverse().join('/')} foi transferida para ${novo?.nome}.`);
    }
    if (novo) {
      await this.enviarMensagemPessoal(funcionarioNovoId,
        `🔄 Você assumiu a escala de ${original?.nome} no dia ${data.split('-').reverse().join('/')}.`);
    }

    // Log no backlog
    if (original) {
      this.registrarBacklog(funcionarioOriginalId, 'troca_escala', 'Troca de Escala',
        `Escala transferida para ${novo?.nome}`, { data, novo_id: funcionarioNovoId });
    }
    if (novo) {
      this.registrarBacklog(funcionarioNovoId, 'troca_escala', 'Troca de Escala',
        `Assumiu escala de ${original?.nome}`, { data, original_id: funcionarioOriginalId });
    }

    return { success: true };
  }

  // Perguntar sobre saída do plantão
  async perguntarSaida(funcionarioId) {
    const func = db.prepare('SELECT * FROM funcionarios WHERE id = ?').get(funcionarioId);
    if (!func) return;

    const mensagem = `⏰ *HORÁRIO DE SAÍDA*\n\n` +
      `Olá ${func.nome}!\n\n` +
      `Seu plantão está no horário de encerramento.\n\n` +
      `Você já encerrou ou precisará continuar?\n\n` +
      `📱 Acesse o sistema para:\n` +
      `✅ Fazer check-out\n` +
      `⏱️ Registrar hora extra`;

    await this.enviarMensagemPessoal(funcionarioId, mensagem);

    return { success: true };
  }

  // Notificar localização distante
  async notificarLocalizacaoDistante(funcionarioId, distancia) {
    const func = db.prepare(`
      SELECT f.*, g.id as gestor_id
      FROM funcionarios f
      LEFT JOIN funcionarios g ON f.gestor_id = g.id
      WHERE f.id = ?
    `).get(funcionarioId);

    if (!func || !func.gestor_id) return;

    const mensagem = `📍 *ALERTA DE LOCALIZAÇÃO*\n\n` +
      `👨‍⚕️ Médico: ${func.nome}\n` +
      `📏 Distância do hospital: ${(distancia / 1000).toFixed(1)} km\n\n` +
      `⚠️ O médico está a mais de 2km do hospital durante o plantão.`;

    await this.enviarMensagemPessoal(func.gestor_id, mensagem);

    // Log no backlog
    this.registrarBacklog(funcionarioId, 'localizacao_distante', 'Localização Distante',
      `Distância: ${(distancia / 1000).toFixed(1)} km do hospital`, { distancia });

    return { success: true };
  }

  // ============ BACKLOG ============

  registrarBacklog(funcionarioId, tipo, titulo, descricao, dados = {}) {
    db.prepare(`
      INSERT INTO backlog (id, funcionario_id, tipo, titulo, descricao, dados_json, data_evento)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(uuidv4(), funcionarioId, tipo, titulo, descricao, JSON.stringify(dados));
  }

  // Obter backlog do funcionário
  getBacklog(funcionarioId, limite = 50) {
    return db.prepare(`
      SELECT * FROM backlog 
      WHERE funcionario_id = ?
      ORDER BY data_evento DESC
      LIMIT ?
    `).all(funcionarioId, limite);
  }

  // ============ RELATÓRIOS ============

  async gerarRelatorioGestor(gestorId, periodoInicio, periodoFim) {
    const gestor = db.prepare('SELECT * FROM funcionarios WHERE id = ?').get(gestorId);
    
    // Buscar dados do período
    const presencas = db.prepare(`
      SELECT p.*, f.nome, f.especialidade
      FROM presencas p
      JOIN funcionarios f ON p.funcionario_id = f.id
      WHERE f.gestor_id = ? AND p.data BETWEEN ? AND ?
      ORDER BY p.data, f.nome
    `).all(gestorId, periodoInicio, periodoFim);

    const backlog = db.prepare(`
      SELECT b.*, f.nome
      FROM backlog b
      JOIN funcionarios f ON b.funcionario_id = f.id
      WHERE f.gestor_id = ? AND date(b.data_evento) BETWEEN ? AND ?
      ORDER BY b.data_evento DESC
    `).all(gestorId, periodoInicio, periodoFim);

    const mensagens = db.prepare(`
      SELECT * FROM whatsapp_mensagens
      WHERE created_at BETWEEN ? AND ?
      ORDER BY created_at DESC
    `).all(periodoInicio + ' 00:00:00', periodoFim + ' 23:59:59');

    // Estatísticas de envio
    const estatisticasEnvio = await this.getEstatisticasEnvio(gestorId, periodoInicio, periodoFim);

    const relatorio = {
      gestor: gestor?.nome,
      periodo: { inicio: periodoInicio, fim: periodoFim },
      resumo: {
        total_presencas: presencas.length,
        presentes: presencas.filter(p => p.status === 'presente').length,
        atrasos: presencas.filter(p => p.status === 'atraso').length,
        furos: presencas.filter(p => p.status === 'furo').length,
        faltas: presencas.filter(p => p.status === 'falta').length
      },
      presencas,
      backlog,
      mensagens_enviadas: mensagens.length,
      estatisticas_envio: estatisticasEnvio
    };

    // Salvar relatório
    const relatorioId = uuidv4();
    db.prepare(`
      INSERT INTO relatorios (id, gestor_id, tipo, periodo_inicio, periodo_fim, dados_json)
      VALUES (?, ?, 'completo', ?, ?, ?)
    `).run(relatorioId, gestorId, periodoInicio, periodoFim, JSON.stringify(relatorio));

    return { id: relatorioId, ...relatorio };
  }
}

module.exports = new WhatsAppService();
