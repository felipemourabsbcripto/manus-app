import { useState, useEffect } from 'react';
import {
  RefreshCw, Plus, Check, X, Clock, AlertTriangle,
  Calendar, User, ArrowRightLeft, MessageSquare, Filter,
  Bell, CheckCircle, XCircle, Eye, Send, Gift, Shield,
  Info, AlertCircle, Timer, Users
} from 'lucide-react';
import { format, differenceInHours, addHours, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { API_URL } from '../config';
import { useAuth } from '../contexts/AuthContext';

function Trocas() {
  const { user, hasPermission, isGestorOrAdmin } = useAuth();
  
  const [trocas, setTrocas] = useState([]);
  const [minhasEscalas, setMinhasEscalas] = useState([]);
  const [anuncios, setAnuncios] = useState([]);
  const [regras, setRegras] = useState({});
  const [loading, setLoading] = useState(true);
  const [abaSelecionada, setAbaSelecionada] = useState('marketplace');
  const [validacaoErros, setValidacaoErros] = useState([]);
  
  // Modais
  const [showModalNovaTroca, setShowModalNovaTroca] = useState(false);
  const [showModalNovoAnuncio, setShowModalNovoAnuncio] = useState(false);
  const [showModalDoacao, setShowModalDoacao] = useState(false);
  const [showModalDetalhes, setShowModalDetalhes] = useState(false);
  const [trocaSelecionada, setTrocaSelecionada] = useState(null);
  
  // Formulários
  const [novaTroca, setNovaTroca] = useState({
    escala_id: '',
    tipo: 'oferta',
    motivo: ''
  });
  
  const [novoAnuncio, setNovoAnuncio] = useState({
    titulo: '',
    descricao: '',
    tipo: 'urgente',
    data_plantao: '',
    hora_inicio: '',
    hora_fim: '',
    valor_adicional: 0,
    vagas: 1
  });

  const [doacao, setDoacao] = useState({
    escala_id: '',
    destinatario_id: '',
    motivo: ''
  });

  const [funcionarios, setFuncionarios] = useState([]);

  useEffect(() => {
    fetchData();
    fetchRegras();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [resTrocas, resEscalas, resAnuncios, resFuncs] = await Promise.all([
        fetch(`${API_URL}/trocas`),
        fetch(`${API_URL}/escalas?funcionario_id=${user?.id}`),
        fetch(`${API_URL}/anuncios`),
        fetch(`${API_URL}/funcionarios`)
      ]);
      
      setTrocas(await resTrocas.json());
      setMinhasEscalas(await resEscalas.json());
      setAnuncios(await resAnuncios.json());
      setFuncionarios(await resFuncs.json());
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRegras = async () => {
    try {
      const res = await fetch(`${API_URL}/regras-troca`);
      const data = await res.json();
      // Converter array para objeto
      const regrasObj = {};
      if (Array.isArray(data)) {
        data.forEach(r => { regrasObj[r.nome] = r.valor; });
      } else {
        Object.assign(regrasObj, data);
      }
      setRegras(regrasObj);
    } catch (error) {
      console.error('Erro ao carregar regras:', error);
    }
  };

  // ========== VALIDAÇÕES (ESTILO ESCALA.APP) ==========

  const validarTroca = async (escalaId, aceitanteId) => {
    const erros = [];
    
    // Buscar escala
    const escala = minhasEscalas.find(e => e.id === escalaId) || 
                   trocas.find(t => t.escala_id === escalaId);
    
    if (!escala) {
      erros.push({ tipo: 'erro', mensagem: 'Escala não encontrada' });
      return erros;
    }

    // Regra 1: Intervalo mínimo entre plantões (11h por padrão)
    const intervaloMinimo = parseInt(regras.intervalo_minimo_horas) || 11;
    
    // Buscar escalas do aceitante
    try {
      const resEscalasAceitante = await fetch(`${API_URL}/escalas?funcionario_id=${aceitanteId}`);
      const escalasAceitante = await resEscalasAceitante.json();
      
      const dataEscala = new Date(`${escala.data_escala || escala.data}T${escala.hora_inicio}`);
      const fimEscala = new Date(`${escala.data_escala || escala.data}T${escala.hora_fim}`);
      
      for (const esc of escalasAceitante) {
        const dataOutra = new Date(`${esc.data}T${esc.hora_inicio}`);
        const fimOutra = new Date(`${esc.data}T${esc.hora_fim}`);
        
        const horasAntes = differenceInHours(dataEscala, fimOutra);
        const horasDepois = differenceInHours(dataOutra, fimEscala);
        
        if (Math.abs(horasAntes) < intervaloMinimo || Math.abs(horasDepois) < intervaloMinimo) {
          erros.push({
            tipo: 'alerta',
            mensagem: `⚠️ Intervalo menor que ${intervaloMinimo}h entre plantões (Interjornada)`,
            detalhe: `Plantão em ${format(dataOutra, 'dd/MM')} das ${esc.hora_inicio} às ${esc.hora_fim}`
          });
        }
      }

      // Regra 2: Máximo de horas por dia (12h por padrão)
      const maxHorasDia = parseInt(regras.max_horas_dia) || 12;
      const horasNoDia = escalasAceitante
        .filter(e => e.data === (escala.data_escala || escala.data))
        .reduce((total, e) => {
          const inicio = new Date(`2000-01-01T${e.hora_inicio}`);
          const fim = new Date(`2000-01-01T${e.hora_fim}`);
          return total + differenceInHours(fim, inicio);
        }, 0);
      
      const horasNovaEscala = differenceInHours(
        new Date(`2000-01-01T${escala.hora_fim}`),
        new Date(`2000-01-01T${escala.hora_inicio}`)
      );
      
      if (horasNoDia + horasNovaEscala > maxHorasDia) {
        erros.push({
          tipo: 'erro',
          mensagem: `❌ Excede limite de ${maxHorasDia}h por dia`,
          detalhe: `Total com esta troca: ${horasNoDia + horasNovaEscala}h`
        });
      }

      // Regra 3: Máximo de horas por semana (60h por padrão)
      const maxHorasSemana = parseInt(regras.max_horas_semana) || 60;
      // Simplificado - soma total das escalas
      const horasSemana = escalasAceitante.reduce((total, e) => {
        const inicio = new Date(`2000-01-01T${e.hora_inicio}`);
        const fim = new Date(`2000-01-01T${e.hora_fim}`);
        return total + differenceInHours(fim, inicio);
      }, 0);
      
      if (horasSemana + horasNovaEscala > maxHorasSemana) {
        erros.push({
          tipo: 'alerta',
          mensagem: `⚠️ Próximo do limite semanal (${maxHorasSemana}h)`,
          detalhe: `Total estimado: ${horasSemana + horasNovaEscala}h`
        });
      }

    } catch (error) {
      console.error('Erro na validação:', error);
    }

    return erros;
  };

  // ========== AÇÕES ==========

  // Criar nova solicitação de troca (Marketplace)
  const handleCriarTroca = async () => {
    if (!novaTroca.escala_id) {
      alert('Selecione uma escala');
      return;
    }
    
    try {
      const response = await fetch(`${API_URL}/trocas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...novaTroca,
          solicitante_id: user.id
        })
      });
      
      if (response.ok) {
        setShowModalNovaTroca(false);
        setNovaTroca({ escala_id: '', tipo: 'oferta', motivo: '' });
        fetchData();
        alert('✅ Plantão publicado no marketplace!');
      }
    } catch (error) {
      console.error('Erro ao criar troca:', error);
    }
  };

  // Aceitar uma troca com validação
  const handleAceitarTroca = async (trocaId) => {
    // Validar antes de aceitar
    const erros = await validarTroca(
      trocas.find(t => t.id === trocaId)?.escala_id, 
      user.id
    );
    
    setValidacaoErros(erros);
    
    const temErrosGraves = erros.some(e => e.tipo === 'erro');
    
    if (temErrosGraves) {
      alert('❌ Não é possível aceitar esta troca. Verifique as regras.');
      return;
    }
    
    if (erros.length > 0) {
      const continuar = window.confirm(
        'Atenção! Existem alertas:\n\n' + 
        erros.map(e => `${e.mensagem}\n${e.detalhe || ''}`).join('\n\n') +
        '\n\nDeseja continuar mesmo assim?'
      );
      if (!continuar) return;
    }
    
    try {
      await fetch(`${API_URL}/trocas/${trocaId}/aceitar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ funcionario_id: user.id })
      });
      fetchData();
      alert('✅ Troca aceita! Aguardando aprovação do gestor.');
    } catch (error) {
      console.error('Erro ao aceitar troca:', error);
    }
  };

  // Aprovar troca (gestor/admin)
  const handleAprovarTroca = async (trocaId, aprovar) => {
    try {
      await fetch(`${API_URL}/trocas/${trocaId}/aprovar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          aprovado: aprovar,
          aprovador_id: user.id 
        })
      });
      fetchData();
      alert(aprovar ? '✅ Troca aprovada!' : '❌ Troca rejeitada.');
    } catch (error) {
      console.error('Erro ao aprovar/rejeitar troca:', error);
    }
  };

  // Doação direta de plantão
  const handleDoarPlantao = async () => {
    if (!doacao.escala_id || !doacao.destinatario_id) {
      alert('Selecione a escala e o destinatário');
      return;
    }

    // Validar
    const erros = await validarTroca(doacao.escala_id, doacao.destinatario_id);
    if (erros.some(e => e.tipo === 'erro')) {
      alert('❌ Doação não permitida. ' + erros.map(e => e.mensagem).join(', '));
      return;
    }

    try {
      // Criar troca com status já aceita (pula marketplace)
      const response = await fetch(`${API_URL}/trocas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          escala_id: doacao.escala_id,
          solicitante_id: user.id,
          tipo: 'doacao',
          motivo: doacao.motivo
        })
      });

      if (response.ok) {
        const trocaCriada = await response.json();
        // Aceitar automaticamente pelo destinatário
        await fetch(`${API_URL}/trocas/${trocaCriada.id}/aceitar`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ funcionario_id: doacao.destinatario_id })
        });
        
        setShowModalDoacao(false);
        setDoacao({ escala_id: '', destinatario_id: '', motivo: '' });
        fetchData();
        alert('✅ Plantão doado! Aguardando aprovação do gestor.');
      }
    } catch (error) {
      console.error('Erro ao doar plantão:', error);
    }
  };

  // Criar anúncio de plantão (gestor)
  const handleCriarAnuncio = async () => {
    if (!novoAnuncio.titulo || !novoAnuncio.data_plantao) {
      alert('Preencha os campos obrigatórios');
      return;
    }
    
    try {
      const response = await fetch(`${API_URL}/anuncios`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...novoAnuncio,
          gestor_id: user.id
        })
      });
      
      if (response.ok) {
        setShowModalNovoAnuncio(false);
        setNovoAnuncio({
          titulo: '',
          descricao: '',
          tipo: 'urgente',
          data_plantao: '',
          hora_inicio: '',
          hora_fim: '',
          valor_adicional: 0,
          vagas: 1
        });
        fetchData();
        alert('✅ Anúncio publicado!');
      }
    } catch (error) {
      console.error('Erro ao criar anúncio:', error);
    }
  };

  // Candidatar-se a um anúncio
  const handleCandidatar = async (anuncioId) => {
    try {
      const res = await fetch(`${API_URL}/anuncios/${anuncioId}/candidatar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ funcionario_id: user.id })
      });
      
      if (res.ok) {
        fetchData();
        alert('✅ Candidatura enviada!');
      } else {
        const data = await res.json();
        alert(data.error || 'Erro ao candidatar');
      }
    } catch (error) {
      console.error('Erro ao candidatar:', error);
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      aberta: { class: 'badge-info', text: '🟢 Disponível', icon: <CheckCircle size={12} /> },
      aceita: { class: 'badge-warning', text: '⏳ Aguardando Aprovação', icon: <Clock size={12} /> },
      aprovada: { class: 'badge-success', text: '✅ Aprovada', icon: <Check size={12} /> },
      rejeitada: { class: 'badge-danger', text: '❌ Rejeitada', icon: <X size={12} /> },
      cancelada: { class: 'badge-secondary', text: '🚫 Cancelada', icon: <XCircle size={12} /> }
    };
    const badge = badges[status] || badges.aberta;
    return <span className={`badge ${badge.class}`} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>{badge.icon} {badge.text}</span>;
  };

  if (loading) return <div className="loading"><div className="spinner"></div></div>;

  return (
    <div className="trocas-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Marketplace de Plantões</h1>
          <p className="page-subtitle">Trocas, doações e anúncios de plantões • Estilo Escala.app</p>
        </div>
        <div className="flex gap-2">
          {hasPermission('canOfferTroca') && (
            <>
              <button className="btn btn-primary" onClick={() => setShowModalNovaTroca(true)}>
                <ArrowRightLeft size={20} /> Publicar Troca
              </button>
              <button className="btn btn-success" onClick={() => setShowModalDoacao(true)}>
                <Gift size={20} /> Doar Plantão
              </button>
            </>
          )}
          {hasPermission('canCreateAnuncios') && (
            <button className="btn btn-warning" onClick={() => setShowModalNovoAnuncio(true)}>
              <Bell size={20} /> Novo Anúncio
            </button>
          )}
        </div>
      </div>

      {/* Cards de Resumo */}
      <div className="grid-4 mb-4">
        <div className="card stat-card" style={{ borderLeft: '4px solid var(--info)' }}>
          <div className="stat-icon bg-info"><ArrowRightLeft size={24} /></div>
          <div>
            <p className="stat-value">{trocas.filter(t => t.status === 'aberta').length}</p>
            <p className="stat-label">Disponíveis</p>
          </div>
        </div>
        <div className="card stat-card" style={{ borderLeft: '4px solid var(--warning)' }}>
          <div className="stat-icon bg-warning"><Clock size={24} /></div>
          <div>
            <p className="stat-value">{trocas.filter(t => t.status === 'aceita').length}</p>
            <p className="stat-label">Aguardando</p>
          </div>
        </div>
        <div className="card stat-card" style={{ borderLeft: '4px solid var(--danger)' }}>
          <div className="stat-icon bg-danger"><Bell size={24} /></div>
          <div>
            <p className="stat-value">{anuncios.filter(a => a.status === 'aberto').length}</p>
            <p className="stat-label">Anúncios Urgentes</p>
          </div>
        </div>
        <div className="card stat-card" style={{ borderLeft: '4px solid var(--success)' }}>
          <div className="stat-icon bg-success"><CheckCircle size={24} /></div>
          <div>
            <p className="stat-value">{trocas.filter(t => t.status === 'aprovada').length}</p>
            <p className="stat-label">Concluídas</p>
          </div>
        </div>
      </div>

      {/* Alertas de Regras */}
      <div className="card mb-3" style={{ background: 'rgba(59, 130, 246, 0.05)', borderColor: 'rgba(59, 130, 246, 0.2)' }}>
        <div className="flex items-center gap-2 mb-2">
          <Shield size={20} className="text-primary" />
          <strong>Regras de Troca Ativas</strong>
        </div>
        <div className="flex flex-wrap gap-3" style={{ fontSize: '0.85rem' }}>
          <span><Timer size={14} style={{ display: 'inline' }} /> Intervalo mínimo: <strong>{regras.intervalo_minimo_horas || 11}h</strong></span>
          <span>|</span>
          <span><Clock size={14} style={{ display: 'inline' }} /> Máx. dia: <strong>{regras.max_horas_dia || 12}h</strong></span>
          <span>|</span>
          <span><Calendar size={14} style={{ display: 'inline' }} /> Máx. semana: <strong>{regras.max_horas_semana || 60}h</strong></span>
          <span>|</span>
          <span><AlertCircle size={14} style={{ display: 'inline' }} /> Antecedência: <strong>{regras.periodo_troca_dias || 7} dias</strong></span>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs flex gap-2 mb-3" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '1rem' }}>
        <button
          className={`btn ${abaSelecionada === 'marketplace' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setAbaSelecionada('marketplace')}
        >
          <ArrowRightLeft size={18} /> Marketplace
        </button>
        <button
          className={`btn ${abaSelecionada === 'anuncios' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setAbaSelecionada('anuncios')}
        >
          <Bell size={18} /> Anúncios Urgentes
        </button>
        <button
          className={`btn ${abaSelecionada === 'minhas' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setAbaSelecionada('minhas')}
        >
          <User size={18} /> Minhas Solicitações
        </button>
        {isGestorOrAdmin() && (
          <button
            className={`btn ${abaSelecionada === 'aprovar' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setAbaSelecionada('aprovar')}
          >
            <CheckCircle size={18} /> Aprovar ({trocas.filter(t => t.status === 'aceita').length})
          </button>
        )}
      </div>

      {/* ========== ABA: MARKETPLACE ========== */}
      {abaSelecionada === 'marketplace' && (
        <div className="grid-2">
          {trocas.filter(t => t.status === 'aberta' && t.solicitante_id !== user?.id).map(troca => (
            <div key={troca.id} className="card" style={{ 
              borderLeft: troca.tipo === 'doacao' ? '4px solid var(--success)' : '4px solid var(--primary)',
              position: 'relative'
            }}>
              <div className="flex justify-between items-start mb-3">
                <div>
                  <span className={`badge ${troca.tipo === 'doacao' ? 'badge-success' : 'badge-info'}`}>
                    {troca.tipo === 'doacao' ? '🎁 Doação' : '🔄 Troca'}
                  </span>
                  <h3 style={{ marginTop: '0.5rem', marginBottom: '0.25rem' }}>
                    {troca.solicitante_nome}
                  </h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    {troca.especialidade || 'Colaborador'}
                  </p>
                </div>
                {getStatusBadge(troca.status)}
              </div>
              
              <div className="flex gap-3 mb-3" style={{ fontSize: '0.9rem' }}>
                <div>
                  <Calendar size={16} style={{ display: 'inline', marginRight: '4px' }} /> 
                  <strong>{troca.data_escala ? format(new Date(troca.data_escala), 'dd/MM/yyyy') : '-'}</strong>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginLeft: '4px' }}>
                    {troca.data_escala ? format(new Date(troca.data_escala), 'EEEE', { locale: ptBR }) : ''}
                  </span>
                </div>
                <div>
                  <Clock size={16} style={{ display: 'inline', marginRight: '4px' }} /> 
                  {troca.hora_inicio} - {troca.hora_fim}
                </div>
              </div>
              
              {troca.motivo && (
                <div style={{ 
                  padding: '0.5rem', 
                  background: 'rgba(100, 116, 139, 0.1)', 
                  borderRadius: '6px',
                  marginBottom: '1rem',
                  fontSize: '0.85rem'
                }}>
                  💬 {troca.motivo}
                </div>
              )}
              
              <button 
                className="btn btn-primary w-full"
                onClick={() => handleAceitarTroca(troca.id)}
              >
                <Check size={16} /> Aceitar {troca.tipo === 'doacao' ? 'Doação' : 'Troca'}
              </button>
            </div>
          ))}
          
          {trocas.filter(t => t.status === 'aberta' && t.solicitante_id !== user?.id).length === 0 && (
            <div className="card" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3rem' }}>
              <ArrowRightLeft size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} />
              <p style={{ color: 'var(--text-secondary)' }}>Nenhum plantão disponível no marketplace</p>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Publique seu plantão para iniciar uma troca
              </p>
            </div>
          )}
        </div>
      )}

      {/* ========== ABA: ANÚNCIOS ========== */}
      {abaSelecionada === 'anuncios' && (
        <div className="grid-2">
          {anuncios.filter(a => a.status === 'aberto').map(anuncio => (
            <div key={anuncio.id} className="card" style={{ 
              borderLeft: anuncio.tipo === 'urgente' ? '4px solid var(--danger)' : '4px solid var(--primary)'
            }}>
              <div className="flex justify-between items-start mb-2">
                <div>
                  <span className={`badge ${anuncio.tipo === 'urgente' ? 'badge-danger' : 'badge-info'}`}>
                    {anuncio.tipo === 'urgente' ? '🚨 URGENTE' : '📢 Anúncio'}
                  </span>
                  <h3 style={{ marginTop: '0.5rem', marginBottom: '0.25rem' }}>{anuncio.titulo}</h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    Por {anuncio.gestor_nome} • {format(new Date(anuncio.created_at), 'dd/MM HH:mm')}
                  </p>
                </div>
              </div>
              
              <p style={{ marginBottom: '1rem' }}>{anuncio.descricao}</p>
              
              <div className="flex gap-3 mb-3" style={{ fontSize: '0.9rem' }}>
                <div><Calendar size={16} style={{ display: 'inline', marginRight: '4px' }} /> 
                  {anuncio.data_plantao ? format(new Date(anuncio.data_plantao), 'dd/MM/yyyy') : 'A definir'}
                </div>
                <div><Clock size={16} style={{ display: 'inline', marginRight: '4px' }} /> 
                  {anuncio.hora_inicio || '00:00'} - {anuncio.hora_fim || '00:00'}
                </div>
              </div>
              
              {anuncio.valor_adicional > 0 && (
                <div style={{ 
                  padding: '0.5rem', 
                  background: 'rgba(16, 185, 129, 0.1)', 
                  borderRadius: '6px',
                  marginBottom: '1rem',
                  fontSize: '0.9rem'
                }}>
                  💰 Adicional: <strong>R$ {anuncio.valor_adicional.toFixed(2)}</strong>
                </div>
              )}
              
              <div className="flex justify-between items-center">
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  <Users size={14} style={{ display: 'inline' }} /> {anuncio.vagas_preenchidas || 0}/{anuncio.vagas} vagas
                </span>
                <button 
                  className="btn btn-primary btn-sm"
                  onClick={() => handleCandidatar(anuncio.id)}
                  disabled={anuncio.vagas_preenchidas >= anuncio.vagas}
                >
                  <Send size={14} /> Candidatar-se
                </button>
              </div>
            </div>
          ))}
          
          {anuncios.filter(a => a.status === 'aberto').length === 0 && (
            <div className="card" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3rem' }}>
              <Bell size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} />
              <p style={{ color: 'var(--text-secondary)' }}>Nenhum anúncio de plantão no momento</p>
            </div>
          )}
        </div>
      )}

      {/* ========== ABA: MINHAS SOLICITAÇÕES ========== */}
      {abaSelecionada === 'minhas' && (
        <div className="card">
          <h2 className="card-title mb-3">Minhas Solicitações</h2>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Data</th>
                  <th>Horário</th>
                  <th>Status</th>
                  <th>Aceito por</th>
                  <th>Ação</th>
                </tr>
              </thead>
              <tbody>
                {trocas.filter(t => t.solicitante_id === user?.id).map(troca => (
                  <tr key={troca.id}>
                    <td>
                      <span className={`badge ${troca.tipo === 'doacao' ? 'badge-success' : 'badge-info'}`}>
                        {troca.tipo === 'doacao' ? '🎁 Doação' : '🔄 Troca'}
                      </span>
                    </td>
                    <td>{troca.data_escala ? format(new Date(troca.data_escala), 'dd/MM/yyyy') : '-'}</td>
                    <td>{troca.hora_inicio} - {troca.hora_fim}</td>
                    <td>{getStatusBadge(troca.status)}</td>
                    <td>{troca.aceito_por_nome || '-'}</td>
                    <td>
                      {troca.status === 'aberta' && (
                        <button className="btn btn-danger btn-sm" onClick={async () => {
                          if (window.confirm('Cancelar esta solicitação?')) {
                            await fetch(`${API_URL}/trocas/${troca.id}`, { method: 'DELETE' });
                            fetchData();
                          }
                        }}>
                          <X size={14} /> Cancelar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {trocas.filter(t => t.solicitante_id === user?.id).length === 0 && (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                      Você não possui solicitações
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========== ABA: APROVAR (GESTOR) ========== */}
      {abaSelecionada === 'aprovar' && isGestorOrAdmin() && (
        <div className="card">
          <h2 className="card-title mb-3">Trocas Pendentes de Aprovação</h2>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Data</th>
                  <th>Horário</th>
                  <th>De</th>
                  <th>Para</th>
                  <th>Motivo</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {trocas.filter(t => t.status === 'aceita').map(troca => (
                  <tr key={troca.id}>
                    <td>
                      <span className={`badge ${troca.tipo === 'doacao' ? 'badge-success' : 'badge-info'}`}>
                        {troca.tipo === 'doacao' ? '🎁' : '🔄'}
                      </span>
                    </td>
                    <td>{troca.data_escala ? format(new Date(troca.data_escala), 'dd/MM/yyyy') : '-'}</td>
                    <td>{troca.hora_inicio} - {troca.hora_fim}</td>
                    <td>{troca.solicitante_nome}</td>
                    <td>{troca.aceito_por_nome}</td>
                    <td>{troca.motivo || '-'}</td>
                    <td>
                      <div className="flex gap-1">
                        <button 
                          className="btn btn-success btn-sm"
                          onClick={() => handleAprovarTroca(troca.id, true)}
                        >
                          <Check size={14} /> Aprovar
                        </button>
                        <button 
                          className="btn btn-danger btn-sm"
                          onClick={() => handleAprovarTroca(troca.id, false)}
                        >
                          <X size={14} /> Rejeitar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {trocas.filter(t => t.status === 'aceita').length === 0 && (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                      Nenhuma troca pendente de aprovação
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========== MODAL: NOVA TROCA (MARKETPLACE) ========== */}
      {showModalNovaTroca && (
        <div className="modal-overlay" onClick={() => setShowModalNovaTroca(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Publicar Plantão no Marketplace</h2>
              <button className="modal-close" onClick={() => setShowModalNovaTroca(false)}><X size={24} /></button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Selecione o Plantão *</label>
                <select 
                  className="form-select"
                  value={novaTroca.escala_id}
                  onChange={e => setNovaTroca({ ...novaTroca, escala_id: e.target.value })}
                >
                  <option value="">Selecione...</option>
                  {minhasEscalas.filter(e => e.status === 'agendado' || !e.status).map(escala => (
                    <option key={escala.id} value={escala.id}>
                      {format(new Date(escala.data), 'dd/MM/yyyy')} ({format(new Date(escala.data), 'EEE', { locale: ptBR })}) - {escala.hora_inicio} às {escala.hora_fim}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="form-group">
                <label className="form-label">Motivo (opcional)</label>
                <textarea
                  className="form-input"
                  rows={3}
                  placeholder="Ex: Compromisso pessoal, viagem..."
                  value={novaTroca.motivo}
                  onChange={e => setNovaTroca({ ...novaTroca, motivo: e.target.value })}
                />
              </div>

              <div style={{ 
                padding: '0.75rem', 
                background: 'rgba(59, 130, 246, 0.1)', 
                borderRadius: '6px',
                fontSize: '0.85rem'
              }}>
                <Info size={16} style={{ display: 'inline', marginRight: '4px' }} />
                Seu plantão ficará disponível para qualquer colega interessado assumir.
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModalNovaTroca(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleCriarTroca}>
                <ArrowRightLeft size={18} /> Publicar no Marketplace
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========== MODAL: DOAÇÃO DIRETA ========== */}
      {showModalDoacao && (
        <div className="modal-overlay" onClick={() => setShowModalDoacao(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Doar Plantão Diretamente</h2>
              <button className="modal-close" onClick={() => setShowModalDoacao(false)}><X size={24} /></button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Plantão a Doar *</label>
                <select 
                  className="form-select"
                  value={doacao.escala_id}
                  onChange={e => setDoacao({ ...doacao, escala_id: e.target.value })}
                >
                  <option value="">Selecione...</option>
                  {minhasEscalas.filter(e => e.status === 'agendado' || !e.status).map(escala => (
                    <option key={escala.id} value={escala.id}>
                      {format(new Date(escala.data), 'dd/MM/yyyy')} - {escala.hora_inicio} às {escala.hora_fim}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Doar para *</label>
                <select 
                  className="form-select"
                  value={doacao.destinatario_id}
                  onChange={e => setDoacao({ ...doacao, destinatario_id: e.target.value })}
                >
                  <option value="">Selecione o colega...</option>
                  {funcionarios.filter(f => f.id !== user?.id && f.tipo !== 'admin').map(f => (
                    <option key={f.id} value={f.id}>
                      {f.nome} - {f.especialidade || f.cargo}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="form-group">
                <label className="form-label">Motivo (opcional)</label>
                <textarea
                  className="form-input"
                  rows={2}
                  placeholder="Ex: Combinado prévio..."
                  value={doacao.motivo}
                  onChange={e => setDoacao({ ...doacao, motivo: e.target.value })}
                />
              </div>

              <div style={{ 
                padding: '0.75rem', 
                background: 'rgba(16, 185, 129, 0.1)', 
                borderRadius: '6px',
                fontSize: '0.85rem'
              }}>
                <Gift size={16} style={{ display: 'inline', marginRight: '4px' }} />
                A doação será enviada diretamente para aprovação do gestor.
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModalDoacao(false)}>Cancelar</button>
              <button className="btn btn-success" onClick={handleDoarPlantao}>
                <Gift size={18} /> Confirmar Doação
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========== MODAL: NOVO ANÚNCIO (GESTOR) ========== */}
      {showModalNovoAnuncio && (
        <div className="modal-overlay" onClick={() => setShowModalNovoAnuncio(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h2 className="modal-title">Novo Anúncio de Plantão</h2>
              <button className="modal-close" onClick={() => setShowModalNovoAnuncio(false)}><X size={24} /></button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Título *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Ex: Preciso de cobertura urgente"
                  value={novoAnuncio.titulo}
                  onChange={e => setNovoAnuncio({ ...novoAnuncio, titulo: e.target.value })}
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">Urgência</label>
                <select 
                  className="form-select"
                  value={novoAnuncio.tipo}
                  onChange={e => setNovoAnuncio({ ...novoAnuncio, tipo: e.target.value })}
                >
                  <option value="urgente">🚨 Urgente</option>
                  <option value="normal">📢 Normal</option>
                </select>
              </div>
              
              <div className="form-group">
                <label className="form-label">Descrição</label>
                <textarea
                  className="form-input"
                  rows={3}
                  placeholder="Detalhes do plantão..."
                  value={novoAnuncio.descricao}
                  onChange={e => setNovoAnuncio({ ...novoAnuncio, descricao: e.target.value })}
                />
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Data *</label>
                  <input
                    type="date"
                    className="form-input"
                    value={novoAnuncio.data_plantao}
                    onChange={e => setNovoAnuncio({ ...novoAnuncio, data_plantao: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Início</label>
                  <input
                    type="time"
                    className="form-input"
                    value={novoAnuncio.hora_inicio}
                    onChange={e => setNovoAnuncio({ ...novoAnuncio, hora_inicio: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Fim</label>
                  <input
                    type="time"
                    className="form-input"
                    value={novoAnuncio.hora_fim}
                    onChange={e => setNovoAnuncio({ ...novoAnuncio, hora_fim: e.target.value })}
                  />
                </div>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Valor Adicional (R$)</label>
                  <input
                    type="number"
                    className="form-input"
                    min="0"
                    step="0.01"
                    value={novoAnuncio.valor_adicional}
                    onChange={e => setNovoAnuncio({ ...novoAnuncio, valor_adicional: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Vagas</label>
                  <input
                    type="number"
                    className="form-input"
                    min="1"
                    value={novoAnuncio.vagas}
                    onChange={e => setNovoAnuncio({ ...novoAnuncio, vagas: parseInt(e.target.value) || 1 })}
                  />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModalNovoAnuncio(false)}>Cancelar</button>
              <button className="btn btn-warning" onClick={handleCriarAnuncio}>
                <Bell size={18} /> Publicar Anúncio
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Trocas;
