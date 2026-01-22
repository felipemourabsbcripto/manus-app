/**
 * Módulo de Geolocalização
 * Gerencia check-in, check-out e monitoramento de localização
 */

const { v4: uuidv4 } = require('uuid');
const db = require('./database');
const whatsapp = require('./whatsapp');

class LocalizacaoService {
  constructor() {
    this.verificacoesAtivas = new Map();
  }

  // Calcular distância entre dois pontos (fórmula de Haversine)
  calcularDistancia(lat1, lng1, lat2, lng2) {
    const R = 6371e3; // Raio da Terra em metros
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lng2 - lng1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distância em metros
  }

  // Obter hospital mais próximo
  getHospitalMaisProximo(lat, lng) {
    const hospitais = db.prepare('SELECT * FROM hospitais WHERE ativo = 1').all();
    
    let hospitalProximo = null;
    let menorDistancia = Infinity;

    hospitais.forEach(hospital => {
      const distancia = this.calcularDistancia(lat, lng, hospital.latitude, hospital.longitude);
      if (distancia < menorDistancia) {
        menorDistancia = distancia;
        hospitalProximo = { ...hospital, distancia };
      }
    });

    return hospitalProximo;
  }

  // Verificar se está dentro do raio do hospital
  estaDentroDoRaio(lat, lng, hospitalId = null) {
    if (hospitalId) {
      const hospital = db.prepare('SELECT * FROM hospitais WHERE id = ?').get(hospitalId);
      if (hospital) {
        const distancia = this.calcularDistancia(lat, lng, hospital.latitude, hospital.longitude);
        return { dentro: distancia <= hospital.raio_metros, distancia, hospital };
      }
    }

    const hospitalProximo = this.getHospitalMaisProximo(lat, lng);
    if (hospitalProximo) {
      return {
        dentro: hospitalProximo.distancia <= hospitalProximo.raio_metros,
        distancia: hospitalProximo.distancia,
        hospital: hospitalProximo
      };
    }

    return { dentro: false, distancia: null, hospital: null };
  }

  // Registrar localização
  async registrarLocalizacao(funcionarioId, latitude, longitude, tipo, presencaId = null) {
    const id = uuidv4();
    const hospitalInfo = this.getHospitalMaisProximo(latitude, longitude);
    const distancia = hospitalInfo?.distancia || null;

    db.prepare(`
      INSERT INTO localizacoes (id, funcionario_id, latitude, longitude, tipo, distancia_hospital, presenca_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, funcionarioId, latitude, longitude, tipo, distancia, presencaId);

    // Log no backlog
    whatsapp.registrarBacklog(funcionarioId, 'localizacao', 'Localização Registrada',
      `${tipo} - Distância: ${distancia ? (distancia / 1000).toFixed(2) + 'km' : 'N/A'}`,
      { latitude, longitude, tipo, distancia });

    return { id, distancia, dentro_raio: hospitalInfo ? hospitalInfo.distancia <= (hospitalInfo.raio_metros || 500) : false };
  }

  // Check-in com localização
  async fazerCheckIn(funcionarioId, latitude, longitude) {
    const hoje = new Date().toISOString().split('T')[0];
    const agora = new Date().toTimeString().split(' ')[0].substring(0, 5);

    // Buscar presença do dia
    const presenca = db.prepare(`
      SELECT p.*, e.hora_inicio, e.hora_fim
      FROM presencas p
      LEFT JOIN escalas e ON p.escala_id = e.id
      WHERE p.funcionario_id = ? AND p.data = ?
    `).get(funcionarioId, hoje);

    if (!presenca) {
      return { success: false, error: 'Nenhuma escala encontrada para hoje' };
    }

    // Verificar localização
    const verificacao = this.estaDentroDoRaio(latitude, longitude);
    
    // Registrar check-in mesmo se estiver fora do raio
    let status = 'presente';
    
    // Verificar atraso
    const [horaEsperada, minEsperado] = presenca.hora_inicio.split(':').map(Number);
    const [horaAtual, minAtual] = agora.split(':').map(Number);
    const config = db.prepare("SELECT valor FROM configuracoes WHERE chave = 'tolerancia_atraso_minutos'").get();
    const tolerancia = parseInt(config?.valor || '15');
    
    const minutosEsperado = horaEsperada * 60 + minEsperado;
    const minutosAtual = horaAtual * 60 + minAtual;
    
    if (minutosAtual > minutosEsperado + tolerancia) {
      status = 'atraso';
    }

    // Atualizar presença
    db.prepare(`
      UPDATE presencas 
      SET hora_entrada = ?, status = ?, checkin_lat = ?, checkin_lng = ?, checkin_timestamp = datetime('now')
      WHERE id = ?
    `).run(agora, status, latitude, longitude, presenca.id);

    // Registrar localização
    await this.registrarLocalizacao(funcionarioId, latitude, longitude, 'checkin', presenca.id);

    // Notificar no WhatsApp
    await whatsapp.notificarCheckIn(funcionarioId, agora, { latitude, longitude });

    // Se estiver fora do raio, alertar gestor
    if (!verificacao.dentro) {
      const configDistMax = db.prepare("SELECT valor FROM configuracoes WHERE chave = 'distancia_maxima_hospital'").get();
      const distanciaMax = parseInt(configDistMax?.valor || '2000');
      
      if (verificacao.distancia > distanciaMax) {
        await whatsapp.notificarLocalizacaoDistante(funcionarioId, verificacao.distancia);
      }
    }

    // Agendar verificações de localização a cada 1 hora
    this.agendarVerificacaoLocalizacao(funcionarioId, presenca.id, presenca.hora_fim);

    return {
      success: true,
      hora: agora,
      status,
      dentro_raio: verificacao.dentro,
      distancia: verificacao.distancia,
      hospital: verificacao.hospital?.nome
    };
  }

  // Check-out com localização
  async fazerCheckOut(funcionarioId, latitude, longitude, horaExtra = false, motivoHoraExtra = '') {
    const hoje = new Date().toISOString().split('T')[0];
    const agora = new Date().toTimeString().split(' ')[0].substring(0, 5);

    // Buscar presença do dia
    const presenca = db.prepare(`
      SELECT p.*, e.hora_inicio, e.hora_fim
      FROM presencas p
      LEFT JOIN escalas e ON p.escala_id = e.id
      WHERE p.funcionario_id = ? AND p.data = ? AND p.hora_entrada IS NOT NULL
    `).get(funcionarioId, hoje);

    if (!presenca) {
      return { success: false, error: 'Nenhum check-in encontrado para hoje' };
    }

    // Calcular hora extra se aplicável
    let minutosExtra = 0;
    if (horaExtra) {
      const [horaFimEsperada, minFimEsperado] = presenca.hora_fim.split(':').map(Number);
      const [horaAtual, minAtual] = agora.split(':').map(Number);
      
      const minutosFim = horaFimEsperada * 60 + minFimEsperado;
      const minutosAtual = horaAtual * 60 + minAtual;
      
      if (minutosAtual > minutosFim) {
        minutosExtra = minutosAtual - minutosFim;
        
        // Registrar hora extra
        db.prepare(`
          INSERT INTO horas_extras (id, funcionario_id, presenca_id, data, hora_inicio, hora_fim, minutos_total, motivo, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pendente')
        `).run(uuidv4(), funcionarioId, presenca.id, hoje, presenca.hora_fim, agora, minutosExtra, motivoHoraExtra);
      }
    }

    // Atualizar presença
    db.prepare(`
      UPDATE presencas 
      SET hora_saida = ?, checkout_lat = ?, checkout_lng = ?, checkout_timestamp = datetime('now'),
          hora_extra_minutos = ?, hora_extra_motivo = ?
      WHERE id = ?
    `).run(agora, latitude, longitude, minutosExtra, motivoHoraExtra, presenca.id);

    // Registrar localização
    await this.registrarLocalizacao(funcionarioId, latitude, longitude, 'checkout', presenca.id);

    // Notificar no WhatsApp
    await whatsapp.notificarCheckOut(funcionarioId, agora, minutosExtra > 0, motivoHoraExtra);

    // Cancelar verificações pendentes
    this.cancelarVerificacoes(presenca.id);

    return {
      success: true,
      hora: agora,
      hora_extra_minutos: minutosExtra,
      motivo: motivoHoraExtra
    };
  }

  // Agendar verificação de localização
  agendarVerificacaoLocalizacao(funcionarioId, presencaId, horaFim) {
    const configIntervalo = db.prepare("SELECT valor FROM configuracoes WHERE chave = 'verificar_localizacao_intervalo'").get();
    const intervalo = parseInt(configIntervalo?.valor || '60') * 60 * 1000; // Em milissegundos

    // Calcular quantas verificações até o fim do plantão
    const agora = new Date();
    const [horaF, minF] = horaFim.split(':').map(Number);
    const fimPlantao = new Date();
    fimPlantao.setHours(horaF, minF, 0, 0);

    const tempoRestante = fimPlantao.getTime() - agora.getTime();
    const numVerificacoes = Math.floor(tempoRestante / intervalo);

    for (let i = 1; i <= numVerificacoes; i++) {
      const agendadoPara = new Date(agora.getTime() + (i * intervalo));
      
      db.prepare(`
        INSERT INTO verificacoes_localizacao (id, funcionario_id, presenca_id, tipo, agendado_para)
        VALUES (?, ?, ?, 'periodica', ?)
      `).run(uuidv4(), funcionarioId, presencaId, agendadoPara.toISOString());
    }

    // Agendar verificação de saída
    db.prepare(`
      INSERT INTO verificacoes_localizacao (id, funcionario_id, presenca_id, tipo, agendado_para)
      VALUES (?, ?, ?, 'saida', ?)
    `).run(uuidv4(), funcionarioId, presencaId, fimPlantao.toISOString());
  }

  // Executar verificações pendentes
  async executarVerificacoesPendentes() {
    const agora = new Date().toISOString();
    
    const verificacoes = db.prepare(`
      SELECT v.*, f.nome, f.whatsapp
      FROM verificacoes_localizacao v
      JOIN funcionarios f ON v.funcionario_id = f.id
      WHERE v.executado = 0 AND v.agendado_para <= ?
    `).all(agora);

    for (const v of verificacoes) {
      if (v.tipo === 'saida') {
        // Perguntar sobre saída
        await whatsapp.perguntarSaida(v.funcionario_id);
        
        // Agendar verificações de meia em meia hora se não fizer checkout
        const configIntervaloSaida = db.prepare("SELECT valor FROM configuracoes WHERE chave = 'verificar_saida_intervalo'").get();
        const intervaloSaida = parseInt(configIntervaloSaida?.valor || '30') * 60 * 1000;
        
        for (let i = 1; i <= 4; i++) { // Máximo 2 horas de verificação
          const proximaVerificacao = new Date(new Date().getTime() + (i * intervaloSaida));
          db.prepare(`
            INSERT INTO verificacoes_localizacao (id, funcionario_id, presenca_id, tipo, agendado_para)
            VALUES (?, ?, ?, 'lembrete_saida', ?)
          `).run(uuidv4(), v.funcionario_id, v.presenca_id, proximaVerificacao.toISOString());
        }
      } else if (v.tipo === 'lembrete_saida') {
        // Verificar se ainda não fez checkout
        const presenca = db.prepare('SELECT * FROM presencas WHERE id = ?').get(v.presenca_id);
        if (!presenca.hora_saida) {
          await whatsapp.perguntarSaida(v.funcionario_id);
        }
      } else if (v.tipo === 'periodica') {
        // Solicitar localização
        const mensagem = `📍 *VERIFICAÇÃO DE LOCALIZAÇÃO*\n\n` +
          `Por favor, confirme sua localização atual.\n\n` +
          `Acesse o sistema e clique em "Atualizar Localização".`;
        
        await whatsapp.enviarMensagemPessoal(v.funcionario_id, mensagem);
      }

      // Marcar como executado
      db.prepare('UPDATE verificacoes_localizacao SET executado = 1, resultado = ? WHERE id = ?')
        .run('executado', v.id);
    }

    return { verificacoes_executadas: verificacoes.length };
  }

  // Verificar localização atual (chamada manual ou automática)
  async verificarLocalizacaoAtual(funcionarioId, latitude, longitude) {
    const configDistMax = db.prepare("SELECT valor FROM configuracoes WHERE chave = 'distancia_maxima_hospital'").get();
    const distanciaMax = parseInt(configDistMax?.valor || '2000');

    const verificacao = this.estaDentroDoRaio(latitude, longitude);
    
    // Registrar localização
    await this.registrarLocalizacao(funcionarioId, latitude, longitude, 'verificacao');

    // Alertar se estiver longe
    if (verificacao.distancia > distanciaMax) {
      await whatsapp.notificarLocalizacaoDistante(funcionarioId, verificacao.distancia);
    }

    return {
      dentro_raio: verificacao.dentro,
      distancia: verificacao.distancia,
      hospital: verificacao.hospital?.nome,
      alerta_enviado: verificacao.distancia > distanciaMax
    };
  }

  // Cancelar verificações pendentes
  cancelarVerificacoes(presencaId) {
    db.prepare(`
      UPDATE verificacoes_localizacao 
      SET executado = 1, resultado = 'cancelado'
      WHERE presenca_id = ? AND executado = 0
    `).run(presencaId);
  }

  // Obter histórico de localizações
  getHistoricoLocalizacoes(funcionarioId, data = null) {
    let query = `
      SELECT l.*, h.nome as hospital_nome
      FROM localizacoes l
      LEFT JOIN hospitais h ON l.distancia_hospital <= h.raio_metros
      WHERE l.funcionario_id = ?
    `;
    const params = [funcionarioId];

    if (data) {
      query += ' AND date(l.created_at) = ?';
      params.push(data);
    }

    query += ' ORDER BY l.created_at DESC LIMIT 100';

    return db.prepare(query).all(...params);
  }
}

module.exports = new LocalizacaoService();
