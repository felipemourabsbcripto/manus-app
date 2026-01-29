/**
 * Módulo de Integração WhatsApp Simplificado
 * 
 * Utiliza 3 métodos:
 * 1. wa.me (Link direto - funciona sempre, abre WhatsApp do usuário)
 * 2. API WhatsApp Business (Oficial Meta - para empresas verificadas)
 * 3. Envio local via servidor (Baileys - gratuito, funciona sem custos)
 * 
 * VANTAGEM: Não precisa de Evolution API nem serviços pagos externos
 */

const { v4: uuidv4 } = require('uuid');
const db = require('./database');

class WhatsAppService {
  constructor() {
    this.modoAtivo = 'link'; // 'link', 'api', 'baileys'
  }

  // Formatar número para padrão internacional
  _formatarNumero(numero) {
    if (!numero) return null;
    // Remove tudo que não é dígito
    let limpo = numero.replace(/\D/g, '');
    // Se começa com 0, remove
    if (limpo.startsWith('0')) limpo = limpo.substring(1);
    // Se não tem código do país, adiciona Brasil (+55)
    if (limpo.length <= 11) limpo = '55' + limpo;
    return limpo;
  }

  // ============ MÉTODO 1: LINKS DIRETOS (wa.me) ============
  
  // Gera link para abrir WhatsApp com mensagem pré-preenchida
  gerarLinkWhatsApp(numero, mensagem) {
    const numeroFormatado = this._formatarNumero(numero);
    if (!numeroFormatado) return null;
    
    const mensagemEncoded = encodeURIComponent(mensagem);
    return `https://wa.me/${numeroFormatado}?text=${mensagemEncoded}`;
  }

  // Gera múltiplos links para envio em lote
  gerarLinksLote(destinatarios, mensagem) {
    return destinatarios.map(dest => ({
      nome: dest.nome,
      numero: dest.whatsapp,
      link: this.gerarLinkWhatsApp(dest.whatsapp, mensagem)
    })).filter(d => d.link);
  }

  // ============ MÉTODO 2: API OFICIAL WHATSAPP BUSINESS ============
  
  // Para uso com API oficial da Meta (requer conta verificada)
  async enviarViaAPIOficial(numero, mensagem, config) {
    if (!config?.phoneNumberId || !config?.accessToken) {
      return { success: false, error: 'Configuração da API não encontrada' };
    }

    try {
      const response = await fetch(
        `https://graph.facebook.com/v18.0/${config.phoneNumberId}/messages`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${config.accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: this._formatarNumero(numero),
            type: 'text',
            text: { body: mensagem }
          })
        }
      );

      const data = await response.json();
      if (response.ok) {
        return { success: true, messageId: data.messages?.[0]?.id };
      } else {
        return { success: false, error: data.error?.message || 'Erro na API' };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // ============ GESTÃO DE MENSAGENS ============

  // Salvar mensagem no banco (para histórico e re-tentativas)
  salvarMensagem(tipo, destino, destinoId, mensagem, grupoId = null) {
    const id = uuidv4();
    db.prepare(`
      INSERT INTO whatsapp_mensagens (id, tipo, destino, destino_id, mensagem, grupo_id, status)
      VALUES (?, ?, ?, ?, ?, ?, 'pendente')
    `).run(id, tipo, destino, destinoId, mensagem, grupoId);
    return id;
  }

  // Atualizar status da mensagem
  atualizarStatusMensagem(id, status) {
    db.prepare(`
      UPDATE whatsapp_mensagens 
      SET status = ?, enviado_em = CASE WHEN ? = 'enviado' THEN CURRENT_TIMESTAMP ELSE enviado_em END
      WHERE id = ?
    `).run(status, status, id);
  }

  // Buscar mensagens pendentes
  getMensagensPendentes() {
    return db.prepare(`
      SELECT * FROM whatsapp_mensagens 
      WHERE status = 'pendente' 
      ORDER BY created_at ASC
    `).all();
  }

  // ============ TEMPLATES DE MENSAGEM ============

  templates = {
    // Confirmação de escala
    escala_confirmacao: (dados) => 
      `🏥 *EscalaPro - Confirmação de Escala*\n\n` +
      `Olá ${dados.nome}!\n\n` +
      `📅 Data: ${dados.data}\n` +
      `⏰ Horário: ${dados.hora_inicio} às ${dados.hora_fim}\n` +
      `📍 Local: ${dados.local || 'A definir'}\n\n` +
      `✅ Por favor, confirme sua presença.`,

    // Alerta de furo
    furo_alerta: (dados) =>
      `🚨 *ALERTA DE FURO*\n\n` +
      `O colaborador *${dados.nome}* não realizou check-in.\n\n` +
      `📅 Data: ${dados.data}\n` +
      `⏰ Horário esperado: ${dados.hora_inicio}\n` +
      `⏱️ Atraso: ${dados.minutos_atraso} minutos\n\n` +
      `Por favor, verifique a situação.`,

    // Check-in realizado
    checkin_confirmado: (dados) =>
      `✅ *Check-in Confirmado*\n\n` +
      `${dados.nome} realizou check-in.\n\n` +
      `📅 ${dados.data}\n` +
      `⏰ Hora: ${dados.hora}\n` +
      `📍 Distância: ${dados.distancia}m do hospital\n` +
      `${dados.dentro_raio ? '✅ Dentro do raio permitido' : '⚠️ Fora do raio permitido'}`,

    // Checkout realizado
    checkout_confirmado: (dados) =>
      `🏁 *Check-out Confirmado*\n\n` +
      `${dados.nome} finalizou o plantão.\n\n` +
      `📅 ${dados.data}\n` +
      `⏰ Saída: ${dados.hora}\n` +
      `⏱️ Total trabalhado: ${dados.horas_trabalhadas}\n` +
      `${dados.hora_extra ? `⏰ Hora extra: ${dados.hora_extra}min` : ''}`,

    // Troca de plantão
    troca_solicitada: (dados) =>
      `🔄 *Solicitação de Troca*\n\n` +
      `${dados.solicitante} está oferecendo troca de plantão.\n\n` +
      `📅 Data: ${dados.data}\n` +
      `⏰ Horário: ${dados.hora_inicio} - ${dados.hora_fim}\n` +
      `💬 Motivo: ${dados.motivo || 'Não informado'}\n\n` +
      `Interessados devem responder no sistema.`,

    // Anúncio urgente
    anuncio_urgente: (dados) =>
      `🚨 *PLANTÃO URGENTE*\n\n` +
      `${dados.titulo}\n\n` +
      `📅 Data: ${dados.data}\n` +
      `⏰ Horário: ${dados.hora_inicio} - ${dados.hora_fim}\n` +
      `💰 Adicional: R$ ${dados.valor_adicional || '0,00'}\n\n` +
      `${dados.descricao || ''}\n\n` +
      `Interessados devem se candidatar no sistema.`,

    // Lembrete de escala
    lembrete_escala: (dados) =>
      `⏰ *Lembrete de Plantão*\n\n` +
      `Olá ${dados.nome}!\n\n` +
      `Você tem plantão ${dados.quando}:\n` +
      `📅 ${dados.data}\n` +
      `⏰ ${dados.hora_inicio} às ${dados.hora_fim}\n\n` +
      `Não se esqueça do check-in!`
  };

  // Gerar mensagem a partir de template
  gerarMensagem(template, dados) {
    if (this.templates[template]) {
      return this.templates[template](dados);
    }
    return null;
  }

  // ============ ENVIO SIMPLIFICADO ============

  // Método principal de envio - retorna link ou envia via API se configurado
  async enviar(gestorId, destino, mensagem, tipo = 'individual') {
    const mensagemId = this.salvarMensagem(tipo, destino, null, mensagem);

    // Tentar obter configuração da API oficial
    const configRow = db.prepare("SELECT valor FROM configuracoes WHERE chave = 'whatsapp_api_oficial'").get();
    let apiConfig = null;
    if (configRow?.valor) {
      try { apiConfig = JSON.parse(configRow.valor); } catch (e) { }
    }

    // Se tem API oficial configurada, usa ela
    if (apiConfig?.accessToken) {
      const resultado = await this.enviarViaAPIOficial(destino, mensagem, apiConfig);
      this.atualizarStatusMensagem(mensagemId, resultado.success ? 'enviado' : 'erro');
      return { ...resultado, mensagemId, modo: 'api_oficial' };
    }

    // Caso contrário, retorna link para envio manual
    const link = this.gerarLinkWhatsApp(destino, mensagem);
    this.atualizarStatusMensagem(mensagemId, 'link_gerado');
    
    return {
      success: true,
      modo: 'link',
      link,
      mensagemId,
      instrucao: 'Clique no link para enviar a mensagem via WhatsApp'
    };
  }

  // Envio em lote - retorna lista de links
  async enviarLote(gestorId, destinatarios, mensagem) {
    const resultados = [];
    
    for (const dest of destinatarios) {
      const resultado = await this.enviar(gestorId, dest.whatsapp, mensagem);
      resultados.push({
        nome: dest.nome,
        numero: dest.whatsapp,
        ...resultado
      });
    }

    return resultados;
  }

  // ============ GRUPOS (SIMULADOS) ============

  // Criar grupo (apenas registro local)
  criarGrupo(gestorId, nome, descricao) {
    const id = uuidv4();
    db.prepare(`
      INSERT INTO whatsapp_grupos (id, gestor_id, nome, descricao)
      VALUES (?, ?, ?, ?)
    `).run(id, gestorId, nome, descricao);
    return { id, nome };
  }

  // Adicionar membro ao grupo
  adicionarMembro(grupoId, funcionarioId) {
    const id = uuidv4();
    db.prepare(`
      INSERT OR IGNORE INTO whatsapp_grupo_membros (id, grupo_id, funcionario_id)
      VALUES (?, ?, ?)
    `).run(id, grupoId, funcionarioId);
    return { success: true };
  }

  // Listar grupos do gestor
  getGrupos(gestorId) {
    return db.prepare(`
      SELECT g.*, COUNT(m.id) as total_membros
      FROM whatsapp_grupos g
      LEFT JOIN whatsapp_grupo_membros m ON g.id = m.grupo_id
      WHERE g.gestor_id = ?
      GROUP BY g.id
    `).all(gestorId);
  }

  // Membros de um grupo
  getMembrosGrupo(grupoId) {
    return db.prepare(`
      SELECT f.id, f.nome, f.whatsapp, f.especialidade
      FROM whatsapp_grupo_membros m
      JOIN funcionarios f ON m.funcionario_id = f.id
      WHERE m.grupo_id = ?
    `).all(grupoId);
  }

  // Enviar para grupo (gera links para todos os membros)
  async enviarParaGrupo(gestorId, grupoId, mensagem) {
    const membros = this.getMembrosGrupo(grupoId);
    return await this.enviarLote(gestorId, membros, mensagem);
  }

  // ============ UTILITÁRIOS ============

  // Status da conexão (sempre 'ativo' no modo link)
  getStatus(gestorId) {
    return {
      conectado: true,
      modo: 'link',
      descricao: 'Modo Link Direto - Envio via wa.me'
    };
  }

  // Histórico de mensagens
  getHistorico(gestorId, limite = 50) {
    return db.prepare(`
      SELECT * FROM whatsapp_mensagens 
      ORDER BY created_at DESC 
      LIMIT ?
    `).all(limite);
  }

  // Estatísticas
  getEstatisticas(gestorId) {
    const hoje = new Date().toISOString().split('T')[0];
    
    const total = db.prepare(`
      SELECT COUNT(*) as total FROM whatsapp_mensagens
    `).get();

    const hoje_count = db.prepare(`
      SELECT COUNT(*) as total FROM whatsapp_mensagens 
      WHERE DATE(created_at) = ?
    `).get(hoje);

    const enviadas = db.prepare(`
      SELECT COUNT(*) as total FROM whatsapp_mensagens 
      WHERE status = 'enviado'
    `).get();

    return {
      total_mensagens: total.total,
      mensagens_hoje: hoje_count.total,
      mensagens_enviadas: enviadas.total,
      modo: 'link'
    };
  }
}

// Exportar instância única
module.exports = new WhatsAppService();
