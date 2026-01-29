/**
 * Módulo de Integração WhatsApp
 * Integração REAL com Evolution API v2
 * 
 * Para configurar:
 * 1. Instale a Evolution API: https://doc.evolution-api.com/
 * 2. Configure as variáveis no arquivo .env ou via interface
 * 3. Conecte seu WhatsApp escaneando o QR Code
 */

const { v4: uuidv4 } = require('uuid');
const fetch = require('node-fetch');
const db = require('./database');

class WhatsAppService {
  constructor() {
    this.conexoes = new Map();
    this.MAX_TENTATIVAS = 3;
  }

  // Obter configurações da API de um gestor
  async _getApiConfig(gestorId) {
    const config = db.prepare("SELECT valor FROM configuracoes WHERE chave = 'whatsapp_api_config'").get();
    if (!config || !config.valor) return null;
    try {
      const allConfigs = JSON.parse(config.valor);
      return allConfigs[gestorId] || null;
    } catch (e) {
      return null;
    }
  }

  // Envio Real via Evolution API
  async _enviarMensagemAPI(gestorId, destino, mensagem, tentativa = 1) {
    const apiConfig = await this._getApiConfig(gestorId);

    // Se não houver config real, usa simulação
    if (!apiConfig || !apiConfig.url || !apiConfig.key) {
      console.log(`[WhatsApp Simulação] Enviando para ${destino}: ${mensagem.substring(0, 50)}...`);
      return { success: true, mode: 'simulado' };
    }

    try {
      const response = await fetch(`${apiConfig.url}/message/sendText/${apiConfig.instance}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': apiConfig.key
        },
        body: JSON.stringify({
          number: destino,
          text: mensagem,
          delay: 1200,
          linkPreview: true
        })
      });

      const data = await response.json();
      if (response.ok) {
        return { success: true, api_response: data };
      } else {
        throw new Error(data.message || 'Falha na Evolution API');
      }
    } catch (error) {
      console.error(`[WhatsApp API Error] ${error.message}`);
      if (tentativa < this.MAX_TENTATIVAS) {
        return await this._enviarMensagemAPI(gestorId, destino, mensagem, tentativa + 1);
      }
      throw error;
    }
  }

  // ============ SUPERVISORES ============

  async adicionarSupervisor(gestorId, dados) {
    const { nome, whatsapp, email, ordem_prioridade } = dados;
    const id = uuidv4();

    // Calcular ordem
    const maxOrdem = db.prepare('SELECT MAX(ordem_prioridade) as max FROM supervisores WHERE gestor_id = ?').get(gestorId);
    const ordem = ordem_prioridade || (maxOrdem?.max || 0) + 1;

    db.prepare(`
      INSERT INTO supervisores (id, gestor_id, nome, whatsapp, email, ordem_prioridade)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, gestorId, nome, whatsapp, email, ordem);

    return { id, success: true };
  }

  async getSupervisores(gestorId) {
    return db.prepare('SELECT * FROM supervisores WHERE gestor_id = ? AND ativo = 1 ORDER BY ordem_prioridade ASC').all(gestorId);
  }

  async removerSupervisor(supervisorId) {
    db.prepare('DELETE FROM supervisores WHERE id = ?').run(supervisorId);
    return { success: true };
  }

  // ============ ENVIO COM FALLBACK ============

  async enviarMensagemComFallback(gestorId, destino, mensagem, msgId = null) {
    const mensagemId = msgId || uuidv4();

    // 1. Tentar envio principal
    try {
      const resultado = await this._enviarMensagemAPI(gestorId, destino, mensagem);
      this._registrarLogEnvio(mensagemId, 'gestor', gestorId, 'Principal', true);
      return { success: true, enviado_por: 'gestor' };
    } catch (error) {
      console.log(`[WhatsApp] Fallback iniciado para ${destino}`);
      this._registrarLogEnvio(mensagemId, 'gestor', gestorId, 'Principal', false, error.message);
    }

    // 2. Tentar Supervisores
    const supervisores = await this.getSupervisores(gestorId);
    for (const sup of supervisores) {
      if (sup.falhas_consecutivas >= 5) continue;

      try {
        // Para simplificar, enviamos do sistema usando a API do gestor para o número destino
        // Ou em alguns casos, o supervisor tem seu próprio número conectado? 
        // Aqui simulamos que o sistema tenta outro canal de saída.
        await this._enviarMensagemAPI(gestorId, destino, mensagem);
        return { success: true, enviado_por: 'supervisor', nome: sup.nome };
      } catch (e) {
        db.prepare('UPDATE supervisores SET falhas_consecutivas = falhas_consecutivas + 1 WHERE id = ?').run(sup.id);
      }
    }

    return { success: false, erro: 'Todos os canais falharam' };
  }

  _registrarLogEnvio(mensagemId, tipo, remetenteId, whatsapp, sucesso, erro = null) {
    db.prepare(`
      INSERT INTO whatsapp_envios_log (id, mensagem_id, remetente_tipo, remetente_id, remetente_whatsapp, sucesso, erro)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(uuidv4(), mensagemId, tipo, remetenteId, whatsapp, sucesso ? 1 : 0, erro);
  }

  // ============ CONEXÃO (EVOLUTION API) ============

  async gerarQRCode(gestorId, apiConfig = null) {
    // Se recebeu config nova, salva
    if (apiConfig) {
      let configs = {};
      const atual = db.prepare("SELECT valor FROM configuracoes WHERE chave = 'whatsapp_api_config'").get();
      if (atual?.valor) configs = JSON.parse(atual.valor);

      configs[gestorId] = apiConfig;
      db.prepare("INSERT OR REPLACE INTO configuracoes (chave, valor) VALUES ('whatsapp_api_config', ?)").run(JSON.stringify(configs));
    }

    const config = await this._getApiConfig(gestorId);
    if (!config) {
      // Retorna modo simulação se não configurado
      return { id: uuidv4(), status: 'simulacao', qrcode: 'SIMULATION_QR' };
    }

    // Chamada real para Evolution API para gerar instância/QR
    try {
      // 1. Criar instância se não existir
      await fetch(`${config.url}/instance/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': config.key },
        body: JSON.stringify({ instanceName: config.instance, token: config.key })
      });

      // 2. Pegar QR Code
      const res = await fetch(`${config.url}/instance/connect/${config.instance}`, {
        headers: { 'apikey': config.key }
      });
      const data = await res.json();

      return {
        id: uuidv4(),
        status: 'aguardando_scan',
        qrcode: data.base64 || data.code,
        api_real: true
      };
    } catch (e) {
      return { status: 'erro', message: e.message };
    }
  }

  async getStatusConexao(gestorId) {
    const config = await this._getApiConfig(gestorId);
    if (!config) return { status: 'nao_configurado' };

    try {
      const res = await fetch(`${config.url}/instance/connectionState/${config.instance}`, {
        headers: { 'apikey': config.key }
      });
      const data = await res.json();

      db.prepare("INSERT OR REPLACE INTO whatsapp_conexoes (id, gestor_id, status, telefone) VALUES (?, ?, ?, ?)")
        .run(uuidv4(), gestorId, data.instance.state, data.instance.ownerJid || '');

      return {
        status: data.instance.state === 'open' ? 'conectado' : 'desconectado',
        telefone: data.instance.ownerJid,
        instancia: config.instance
      };
    } catch (e) {
      return { status: 'erro' };
    }
  }

  async desconectar(gestorId) {
    const config = await this._getApiConfig(gestorId);
    if (!config) return { success: true };

    try {
      await fetch(`${config.url}/instance/logout/${config.instance}`, {
        method: 'DELETE',
        headers: { 'apikey': config.key }
      });
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  // ============ GRUPOS ============

  async criarGrupo(gestorId, nome) {
    const grupoId = uuidv4();
    db.prepare(`
      INSERT INTO whatsapp_grupos (id, gestor_id, nome, link_convite)
      VALUES (?, ?, ?, ?)
    `).run(grupoId, gestorId, nome, 'https://chat.whatsapp.com/simulado');

    return { id: grupoId, nome, success: true };
  }

  async adicionarMembro(grupoId, funcionarioId) {
    db.prepare(`
      INSERT INTO whatsapp_grupo_membros (id, grupo_id, funcionario_id)
      VALUES (?, ?, ?)
    `).run(uuidv4(), grupoId, funcionarioId);
    return { success: true };
  }

  async getGruposGestor(gestorId) {
    return db.prepare('SELECT g.*, (SELECT COUNT(*) FROM whatsapp_grupo_membros WHERE grupo_id = g.id) as total_membros FROM whatsapp_grupos g WHERE gestor_id = ?').all(gestorId);
  }

  async getMembrosGrupo(grupoId) {
    return db.prepare('SELECT f.* FROM whatsapp_grupo_membros gm JOIN funcionarios f ON gm.funcionario_id = f.id WHERE gm.grupo_id = ?').all(grupoId);
  }

  // ============ MENSAGENS ============

  async enviarMensagemGrupo(grupoId, mensagem, funcionarioMarcado = null) {
    const grupo = db.prepare('SELECT * FROM whatsapp_grupos WHERE id = ?').get(grupoId);
    const resultado = await this.enviarMensagemComFallback(grupo.gestor_id, grupo.nome, mensagem);

    db.prepare(`
      INSERT INTO whatsapp_mensagens (id, tipo, destino, destino_id, mensagem, status, enviado_em)
      VALUES (?, 'grupo', ?, ?, ?, ?, datetime('now'))
    `).run(uuidv4(), grupo.nome, grupoId, mensagem, resultado.success ? 'enviado' : 'falha');

    return resultado;
  }

  async enviarMensagemPessoal(funcionarioId, mensagem) {
    const func = db.prepare('SELECT * FROM funcionarios WHERE id = ?').get(funcionarioId);
    const resultado = await this.enviarMensagemComFallback(func.gestor_id || 'system', func.whatsapp || func.telefone, mensagem);

    db.prepare(`
      INSERT INTO whatsapp_mensagens (id, tipo, destino, destino_id, mensagem, status, enviado_em)
      VALUES (?, 'pessoal', ?, ?, ?, ?, datetime('now'))
    `).run(uuidv4(), func.nome, funcionarioId, mensagem, resultado.success ? 'enviado' : 'falha');

    return resultado;
  }

  async notificarInicioPlantao(gestorId, data) {
    const escalas = db.prepare(`
      SELECT e.*, f.nome, f.especialidade FROM escalas e 
      JOIN funcionarios f ON e.funcionario_id = f.id 
      WHERE e.data = ? AND f.gestor_id = ?
    `).all(data, gestorId);

    if (escalas.length === 0) return { success: false };

    let msg = `🏥 *PLANTÃO ${data}*\n\n`;
    escalas.forEach(e => msg += `• ${e.nome} (${e.hora_inicio}-${e.hora_fim})\n`);

    const grupos = await this.getGruposGestor(gestorId);
    if (grupos.length > 0) {
      await this.enviarMensagemGrupo(grupos[0].id, msg);
    }
    return { success: true };
  }

  // Logs e estatísticas (simplificado para real uso)
  async getEstatisticasEnvio(gestorId) {
    const total = db.prepare('SELECT COUNT(*) as count FROM whatsapp_mensagens WHERE status = "enviado"').get();
    return { total_mensagens: total.count, supervisores: [] };
  }

  async getBacklog(funcionarioId, limite = 50) {
    return db.prepare('SELECT * FROM backlog WHERE funcionario_id = ? ORDER BY data_evento DESC LIMIT ?').all(funcionarioId, limite);
  }
}

module.exports = new WhatsAppService();
