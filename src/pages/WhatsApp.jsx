import { useState, useEffect } from 'react';
import { 
  MessageSquare, Users, Plus, Send, Check, CheckCheck, X, 
  Phone, Link2, QrCode, Wifi, WifiOff, UserPlus, Bell, RefreshCw,
  Shield, Trash2, Edit2, ArrowUp, ArrowDown, AlertTriangle, BarChart3
} from 'lucide-react';
import { format } from 'date-fns';
import { API_URL } from '../config';

function WhatsApp() {
  const [gestores, setGestores] = useState([]);
  const [gestorSelecionado, setGestorSelecionado] = useState(null);
  const [grupos, setGrupos] = useState([]);
  const [membros, setMembros] = useState([]);
  const [funcionarios, setFuncionarios] = useState([]);
  const [mensagens, setMensagens] = useState([]);
  const [conexao, setConexao] = useState(null);
  const [supervisores, setSupervisores] = useState([]);
  const [estatisticas, setEstatisticas] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showModalGrupo, setShowModalGrupo] = useState(false);
  const [showModalMembro, setShowModalMembro] = useState(false);
  const [showModalMensagem, setShowModalMensagem] = useState(false);
  const [showModalConectar, setShowModalConectar] = useState(false);
  const [showModalSupervisor, setShowModalSupervisor] = useState(false);
  const [showModalEstatisticas, setShowModalEstatisticas] = useState(false);
  const [grupoSelecionado, setGrupoSelecionado] = useState(null);
  const [novaMensagem, setNovaMensagem] = useState({ destino: 'grupo', grupo_id: '', funcionario_id: '', mensagem: '' });
  const [telefoneConexao, setTelefoneConexao] = useState('');
  const [supervisorForm, setSupervisorForm] = useState({ nome: '', whatsapp: '', email: '' });
  const [editandoSupervisor, setEditandoSupervisor] = useState(null);
  const [abaSelecionada, setAbaSelecionada] = useState('grupos'); // 'grupos' | 'supervisores'

  useEffect(() => {
    fetchGestores();
    fetchFuncionarios();
  }, []);

  useEffect(() => {
    if (gestorSelecionado) {
      fetchGrupos();
      fetchConexao();
      fetchSupervisores();
    }
  }, [gestorSelecionado]);

  useEffect(() => {
    if (grupoSelecionado) {
      fetchMembros();
      fetchMensagens();
    }
  }, [grupoSelecionado]);

  const fetchGestores = async () => {
    try {
      const res = await fetch(`${API_URL}/gestores`);
      const data = await res.json();
      setGestores(data);
      if (data.length > 0 && !gestorSelecionado) {
        setGestorSelecionado(data[0].id);
      }
    } catch (error) {
      console.error('Erro:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchFuncionarios = async () => {
    try {
      const res = await fetch(`${API_URL}/funcionarios`);
      setFuncionarios(await res.json());
    } catch (error) {
      console.error('Erro:', error);
    }
  };

  const fetchGrupos = async () => {
    try {
      const res = await fetch(`${API_URL}/whatsapp/grupos/${gestorSelecionado}`);
      const data = await res.json();
      setGrupos(data);
      if (data.length > 0 && !grupoSelecionado) {
        setGrupoSelecionado(data[0].id);
      }
    } catch (error) {
      console.error('Erro:', error);
    }
  };

  const fetchConexao = async () => {
    try {
      const res = await fetch(`${API_URL}/whatsapp/status/${gestorSelecionado}`);
      setConexao(await res.json());
    } catch (error) {
      console.error('Erro:', error);
    }
  };

  const fetchSupervisores = async () => {
    try {
      const res = await fetch(`${API_URL}/supervisores/${gestorSelecionado}`);
      setSupervisores(await res.json());
    } catch (error) {
      console.error('Erro:', error);
    }
  };

  const fetchEstatisticas = async () => {
    try {
      const res = await fetch(`${API_URL}/supervisores/${gestorSelecionado}/estatisticas`);
      setEstatisticas(await res.json());
      setShowModalEstatisticas(true);
    } catch (error) {
      console.error('Erro:', error);
    }
  };

  const fetchMembros = async () => {
    try {
      const res = await fetch(`${API_URL}/whatsapp/grupos/${grupoSelecionado}/membros`);
      setMembros(await res.json());
    } catch (error) {
      console.error('Erro:', error);
    }
  };

  const fetchMensagens = async () => {
    try {
      const res = await fetch(`${API_URL}/whatsapp/mensagens?grupo_id=${grupoSelecionado}&limit=50`);
      setMensagens(await res.json());
    } catch (error) {
      console.error('Erro:', error);
    }
  };

  // ======== SUPERVISORES ========

  const adicionarSupervisor = async () => {
    try {
      await fetch(`${API_URL}/supervisores`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          gestor_id: gestorSelecionado, 
          ...supervisorForm 
        })
      });
      setShowModalSupervisor(false);
      setSupervisorForm({ nome: '', whatsapp: '', email: '' });
      fetchSupervisores();
      alert('Supervisor de backup adicionado com sucesso!');
    } catch (error) {
      console.error('Erro:', error);
      alert('Erro ao adicionar supervisor');
    }
  };

  const atualizarSupervisor = async () => {
    try {
      await fetch(`${API_URL}/supervisores/${editandoSupervisor}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...supervisorForm, ativo: true })
      });
      setShowModalSupervisor(false);
      setEditandoSupervisor(null);
      setSupervisorForm({ nome: '', whatsapp: '', email: '' });
      fetchSupervisores();
    } catch (error) {
      console.error('Erro:', error);
    }
  };

  const removerSupervisor = async (id) => {
    if (window.confirm('Tem certeza que deseja remover este supervisor de backup?')) {
      try {
        await fetch(`${API_URL}/supervisores/${id}`, { method: 'DELETE' });
        fetchSupervisores();
      } catch (error) {
        console.error('Erro:', error);
      }
    }
  };

  const moverSupervisor = async (index, direcao) => {
    const novaOrdem = [...supervisores];
    const novoIndex = index + direcao;
    if (novoIndex < 0 || novoIndex >= novaOrdem.length) return;

    [novaOrdem[index], novaOrdem[novoIndex]] = [novaOrdem[novoIndex], novaOrdem[index]];
    const ordemIds = novaOrdem.map(s => s.id);

    try {
      await fetch(`${API_URL}/supervisores/${gestorSelecionado}/reordenar`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ordem: ordemIds })
      });
      fetchSupervisores();
    } catch (error) {
      console.error('Erro:', error);
    }
  };

  const editarSupervisor = (sup) => {
    setSupervisorForm({ nome: sup.nome, whatsapp: sup.whatsapp, email: sup.email || '' });
    setEditandoSupervisor(sup.id);
    setShowModalSupervisor(true);
  };

  // ======== WHATSAPP ========

  const conectarWhatsApp = async () => {
    try {
      const res = await fetch(`${API_URL}/whatsapp/conectar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gestor_id: gestorSelecionado })
      });
      const data = await res.json();
      setConexao(data);
      setShowModalConectar(true);
    } catch (error) {
      console.error('Erro:', error);
    }
  };

  const confirmarConexao = async () => {
    try {
      await fetch(`${API_URL}/whatsapp/confirmar-conexao`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gestor_id: gestorSelecionado, telefone: telefoneConexao })
      });
      setShowModalConectar(false);
      fetchConexao();
      alert('WhatsApp conectado com sucesso!');
    } catch (error) {
      console.error('Erro:', error);
    }
  };

  const desconectar = async () => {
    if (window.confirm('Deseja desconectar o WhatsApp?')) {
      try {
        await fetch(`${API_URL}/whatsapp/desconectar`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ gestor_id: gestorSelecionado })
        });
        fetchConexao();
      } catch (error) {
        console.error('Erro:', error);
      }
    }
  };

  const criarGrupo = async () => {
    try {
      const res = await fetch(`${API_URL}/whatsapp/grupos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gestor_id: gestorSelecionado })
      });
      const data = await res.json();
      setShowModalGrupo(false);
      fetchGrupos();
      alert(`Grupo criado!\nLink de convite: ${data.link_convite}`);
    } catch (error) {
      console.error('Erro:', error);
    }
  };

  const adicionarMembro = async (funcionarioId) => {
    try {
      await fetch(`${API_URL}/whatsapp/grupos/${grupoSelecionado}/membros`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ funcionario_id: funcionarioId })
      });
      fetchMembros();
      setShowModalMembro(false);
      alert('Membro adicionado e link de convite enviado!');
    } catch (error) {
      console.error('Erro:', error);
    }
  };

  const enviarMensagem = async () => {
    try {
      if (novaMensagem.destino === 'grupo') {
        await fetch(`${API_URL}/whatsapp/mensagem/grupo`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            grupo_id: grupoSelecionado,
            mensagem: novaMensagem.mensagem,
            funcionario_marcado: novaMensagem.funcionario_id || null
          })
        });
      } else {
        await fetch(`${API_URL}/whatsapp/mensagem/pessoal`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            funcionario_id: novaMensagem.funcionario_id,
            mensagem: novaMensagem.mensagem
          })
        });
      }
      setShowModalMensagem(false);
      setNovaMensagem({ destino: 'grupo', grupo_id: '', funcionario_id: '', mensagem: '' });
      fetchMensagens();
      alert('Mensagem enviada!');
    } catch (error) {
      console.error('Erro:', error);
    }
  };

  const notificarPlantao = async () => {
    const hoje = new Date().toISOString().split('T')[0];
    try {
      await fetch(`${API_URL}/whatsapp/notificar-plantao`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gestor_id: gestorSelecionado, data: hoje })
      });
      fetchMensagens();
      alert('Notificação de plantão enviada ao grupo!');
    } catch (error) {
      console.error('Erro:', error);
    }
  };

  const grupoAtual = grupos.find(g => g.id === grupoSelecionado);
  const gestorAtual = gestores.find(g => g.id === gestorSelecionado);
  const funcionariosDisponiveis = funcionarios.filter(f => 
    !membros.find(m => m.id === f.id)
  );

  if (loading) {
    return <div className="loading"><div className="spinner"></div></div>;
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">WhatsApp Plantão</h1>
          <p className="page-subtitle">Gerencie grupos, supervisores e comunicação</p>
        </div>
        <div className="flex gap-2">
          {conexao?.status === 'conectado' ? (
            <button className="btn btn-danger" onClick={desconectar}>
              <WifiOff size={20} />
              Desconectar
            </button>
          ) : (
            <button className="btn btn-success" onClick={conectarWhatsApp}>
              <QrCode size={20} />
              Conectar WhatsApp
            </button>
          )}
        </div>
      </div>

      {/* Seletor de Gestor e Status */}
      <div className="card mb-3">
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Gestor Responsável</label>
            <select
              className="form-select"
              value={gestorSelecionado || ''}
              onChange={e => {
                setGestorSelecionado(e.target.value);
                setGrupoSelecionado(null);
              }}
            >
              <option value="">Selecione um gestor...</option>
              {gestores.map(g => (
                <option key={g.id} value={g.id}>{g.nome} - {g.cargo}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Status Conexão</label>
            <div className="flex items-center gap-2 mt-1">
              {conexao?.status === 'conectado' ? (
                <>
                  <Wifi className="text-success" size={20} />
                  <span className="badge badge-success">Conectado</span>
                  <span className="text-sm text-secondary">{conexao.telefone}</span>
                </>
              ) : (
                <>
                  <WifiOff className="text-danger" size={20} />
                  <span className="badge badge-danger">Desconectado</span>
                </>
              )}
              {conexao?.supervisores_backup > 0 && (
                <span className="badge badge-info ml-2">
                  <Shield size={12} />
                  {conexao.supervisores_backup} backup(s)
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {gestorSelecionado && (
        <>
          {/* Abas */}
          <div className="flex gap-2 mb-3">
            <button 
              className={`btn ${abaSelecionada === 'grupos' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setAbaSelecionada('grupos')}
            >
              <Users size={18} />
              Grupos e Mensagens
            </button>
            <button 
              className={`btn ${abaSelecionada === 'supervisores' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setAbaSelecionada('supervisores')}
            >
              <Shield size={18} />
              Supervisores de Backup ({supervisores.length})
            </button>
          </div>

          {/* Aba Supervisores */}
          {abaSelecionada === 'supervisores' && (
            <div className="card">
              <div className="card-header">
                <div>
                  <h2 className="card-title">Supervisores de Backup</h2>
                  <p className="text-sm text-secondary mt-1">
                    Caso o envio pelo WhatsApp principal falhe, o sistema tentará enviar pelos supervisores em ordem de prioridade
                  </p>
                </div>
                <div className="flex gap-2">
                  <button className="btn btn-secondary btn-sm" onClick={fetchEstatisticas}>
                    <BarChart3 size={16} />
                    Estatísticas
                  </button>
                  <button className="btn btn-primary btn-sm" onClick={() => {
                    setSupervisorForm({ nome: '', whatsapp: '', email: '' });
                    setEditandoSupervisor(null);
                    setShowModalSupervisor(true);
                  }}>
                    <Plus size={16} />
                    Adicionar Supervisor
                  </button>
                </div>
              </div>

              {/* Alerta explicativo */}
              <div className="alert alert-info mb-3">
                <Shield size={20} />
                <div>
                  <p className="font-semibold">Como funciona o fallback?</p>
                  <p className="text-sm">
                    Se o envio de mensagem pelo WhatsApp do gestor principal falhar, o sistema automaticamente 
                    tentará enviar pelos supervisores cadastrados, na ordem de prioridade definida. 
                    Isso garante que as mensagens sempre serão entregues.
                  </p>
                </div>
              </div>

              {supervisores.length > 0 ? (
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>Prioridade</th>
                        <th>Nome</th>
                        <th>WhatsApp</th>
                        <th>Email</th>
                        <th>Status</th>
                        <th>Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {supervisores.map((sup, index) => (
                        <tr key={sup.id}>
                          <td>
                            <div className="flex items-center gap-1">
                              <span className="badge badge-secondary">{index + 1}º</span>
                              <div className="flex flex-col">
                                <button 
                                  className="btn btn-sm" 
                                  style={{ padding: '2px', background: 'none' }}
                                  onClick={() => moverSupervisor(index, -1)}
                                  disabled={index === 0}
                                >
                                  <ArrowUp size={14} />
                                </button>
                                <button 
                                  className="btn btn-sm" 
                                  style={{ padding: '2px', background: 'none' }}
                                  onClick={() => moverSupervisor(index, 1)}
                                  disabled={index === supervisores.length - 1}
                                >
                                  <ArrowDown size={14} />
                                </button>
                              </div>
                            </div>
                          </td>
                          <td>
                            <div className="flex items-center gap-2">
                              <div className="stat-icon cyan" style={{ width: '32px', height: '32px' }}>
                                <Shield size={16} />
                              </div>
                              <span className="font-medium">{sup.nome}</span>
                            </div>
                          </td>
                          <td>
                            <div className="flex items-center gap-1">
                              <Phone size={14} className="text-success" />
                              {sup.whatsapp}
                            </div>
                          </td>
                          <td>{sup.email || '-'}</td>
                          <td>
                            {sup.falhas_consecutivas >= 3 ? (
                              <span className="badge badge-danger">
                                <AlertTriangle size={12} />
                                {sup.falhas_consecutivas} falhas
                              </span>
                            ) : sup.falhas_consecutivas > 0 ? (
                              <span className="badge badge-warning">
                                {sup.falhas_consecutivas} falha(s)
                              </span>
                            ) : (
                              <span className="badge badge-success">OK</span>
                            )}
                          </td>
                          <td>
                            <div className="action-buttons">
                              <button className="btn btn-secondary btn-sm" onClick={() => editarSupervisor(sup)}>
                                <Edit2 size={14} />
                              </button>
                              <button className="btn btn-danger btn-sm" onClick={() => removerSupervisor(sup.id)}>
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="empty-state">
                  <Shield size={64} />
                  <p>Nenhum supervisor de backup cadastrado</p>
                  <p className="text-sm text-secondary">
                    Adicione supervisores para garantir que as mensagens sempre sejam entregues
                  </p>
                  <button className="btn btn-primary mt-2" onClick={() => {
                    setSupervisorForm({ nome: '', whatsapp: '', email: '' });
                    setEditandoSupervisor(null);
                    setShowModalSupervisor(true);
                  }}>
                    <Plus size={18} />
                    Adicionar Primeiro Supervisor
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Aba Grupos */}
          {abaSelecionada === 'grupos' && (
            <div className="grid-2">
              {/* Grupos */}
              <div className="card">
                <div className="card-header">
                  <h2 className="card-title">Grupos do Plantão</h2>
                  <button className="btn btn-primary btn-sm" onClick={() => setShowModalGrupo(true)}>
                    <Plus size={16} />
                    Novo Grupo
                  </button>
                </div>

                {grupos.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {grupos.map(grupo => (
                      <div 
                        key={grupo.id}
                        className={`notification-item ${grupoSelecionado === grupo.id ? 'unread' : ''}`}
                        style={{ borderRadius: '0.5rem', cursor: 'pointer' }}
                        onClick={() => setGrupoSelecionado(grupo.id)}
                      >
                        <div className="flex items-center gap-2">
                          <div className="stat-icon blue" style={{ width: '40px', height: '40px' }}>
                            <Users size={20} />
                          </div>
                          <div>
                            <p className="font-semibold">{grupo.nome}</p>
                            <p className="text-sm text-secondary">{grupo.total_membros} membros</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <Link2 size={14} className="text-secondary" />
                          <span className="text-xs text-secondary">{grupo.link_convite}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state">
                    <Users size={48} />
                    <p>Nenhum grupo criado</p>
                    <button className="btn btn-primary btn-sm mt-2" onClick={() => setShowModalGrupo(true)}>
                      Criar Primeiro Grupo
                    </button>
                  </div>
                )}
              </div>

              {/* Membros e Ações */}
              <div className="card">
                <div className="card-header">
                  <h2 className="card-title">
                    {grupoAtual ? grupoAtual.nome : 'Selecione um Grupo'}
                  </h2>
                  {grupoSelecionado && (
                    <div className="flex gap-2">
                      <button className="btn btn-secondary btn-sm" onClick={() => setShowModalMembro(true)}>
                        <UserPlus size={16} />
                        Adicionar
                      </button>
                      <button className="btn btn-warning btn-sm" onClick={notificarPlantao}>
                        <Bell size={16} />
                        Notificar Plantão
                      </button>
                    </div>
                  )}
                </div>

                {grupoSelecionado && membros.length > 0 ? (
                  <>
                    <h3 className="text-sm font-semibold text-secondary mb-2">Membros ({membros.length})</h3>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {membros.map(m => (
                        <div key={m.id} className="badge badge-info" style={{ padding: '0.5rem 0.75rem' }}>
                          <Users size={14} />
                          {m.nome}
                          {m.especialidade && <span className="text-xs ml-1">({m.especialidade})</span>}
                        </div>
                      ))}
                    </div>

                    <div className="flex gap-2 mb-3">
                      <button className="btn btn-primary" onClick={() => setShowModalMensagem(true)}>
                        <Send size={18} />
                        Enviar Mensagem
                      </button>
                    </div>
                  </>
                ) : grupoSelecionado ? (
                  <div className="empty-state">
                    <UserPlus size={48} />
                    <p>Nenhum membro no grupo</p>
                  </div>
                ) : null}
              </div>
            </div>
          )}

          {/* Histórico de Mensagens */}
          {abaSelecionada === 'grupos' && grupoSelecionado && (
            <div className="card mt-3">
              <div className="card-header">
                <h2 className="card-title">Histórico de Mensagens</h2>
                <button className="btn btn-secondary btn-sm" onClick={fetchMensagens}>
                  <RefreshCw size={16} />
                  Atualizar
                </button>
              </div>

              {mensagens.length > 0 ? (
                <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                  {mensagens.map(msg => (
                    <div key={msg.id} className="notification-item" style={{ borderBottom: '1px solid var(--border)' }}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`badge ${msg.tipo === 'grupo' ? 'badge-info' : 'badge-secondary'}`}>
                          {msg.tipo === 'grupo' ? 'Grupo' : 'Pessoal'}
                        </span>
                        <span className="text-sm">{msg.destino}</span>
                        {msg.status === 'enviado' && <CheckCheck size={14} className="text-success" />}
                        {msg.status === 'falha' && <AlertTriangle size={14} className="text-danger" />}
                      </div>
                      <p className="text-sm" style={{ whiteSpace: 'pre-wrap' }}>{msg.mensagem}</p>
                      <p className="text-xs text-secondary mt-1">
                        {format(new Date(msg.enviado_em || msg.created_at), 'dd/MM/yyyy HH:mm')}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <MessageSquare size={48} />
                  <p>Nenhuma mensagem enviada</p>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Modal Supervisor */}
      {showModalSupervisor && (
        <div className="modal-overlay" onClick={() => setShowModalSupervisor(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">
                {editandoSupervisor ? 'Editar Supervisor' : 'Novo Supervisor de Backup'}
              </h2>
              <button className="modal-close" onClick={() => setShowModalSupervisor(false)}>
                <X size={24} />
              </button>
            </div>
            
            <div className="alert alert-info mb-3">
              <Shield size={20} />
              <span>Supervisores são usados como fallback caso o envio pelo gestor principal falhe</span>
            </div>
            
            <div className="form-group">
              <label className="form-label">Nome do Supervisor *</label>
              <input
                type="text"
                className="form-input"
                value={supervisorForm.nome}
                onChange={e => setSupervisorForm({ ...supervisorForm, nome: e.target.value })}
                placeholder="Nome completo"
                required
              />
            </div>
            
            <div className="form-group">
              <label className="form-label">WhatsApp *</label>
              <input
                type="text"
                className="form-input"
                value={supervisorForm.whatsapp}
                onChange={e => setSupervisorForm({ ...supervisorForm, whatsapp: e.target.value.replace(/\D/g, '') })}
                placeholder="5511999999999"
                required
              />
              <small className="text-secondary">Apenas números com DDI e DDD (ex: 5511999999999)</small>
            </div>
            
            <div className="form-group">
              <label className="form-label">Email (opcional)</label>
              <input
                type="email"
                className="form-input"
                value={supervisorForm.email}
                onChange={e => setSupervisorForm({ ...supervisorForm, email: e.target.value })}
                placeholder="supervisor@email.com"
              />
            </div>
            
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModalSupervisor(false)}>
                Cancelar
              </button>
              <button 
                className="btn btn-primary" 
                onClick={editandoSupervisor ? atualizarSupervisor : adicionarSupervisor}
                disabled={!supervisorForm.nome || !supervisorForm.whatsapp}
              >
                <Shield size={18} />
                {editandoSupervisor ? 'Salvar Alterações' : 'Adicionar Supervisor'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Estatísticas */}
      {showModalEstatisticas && estatisticas && (
        <div className="modal-overlay" onClick={() => setShowModalEstatisticas(false)}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Estatísticas de Envio</h2>
              <button className="modal-close" onClick={() => setShowModalEstatisticas(false)}>
                <X size={24} />
              </button>
            </div>
            
            <div className="grid-3 mb-3">
              <div className="stat-card">
                <div className="stat-icon blue">
                  <MessageSquare size={24} />
                </div>
                <div>
                  <span className="stat-value">{estatisticas.total_mensagens}</span>
                  <span className="stat-label">Total de Mensagens</span>
                </div>
              </div>
              
              <div className="stat-card">
                <div className="stat-icon green">
                  <Check size={24} />
                </div>
                <div>
                  <span className="stat-value">{estatisticas.gestor?.sucessos || 0}</span>
                  <span className="stat-label">Envios pelo Gestor</span>
                </div>
              </div>
              
              <div className="stat-card">
                <div className="stat-icon cyan">
                  <Shield size={24} />
                </div>
                <div>
                  <span className="stat-value">
                    {estatisticas.supervisores?.reduce((acc, s) => acc + s.sucessos, 0) || 0}
                  </span>
                  <span className="stat-label">Envios por Backup</span>
                </div>
              </div>
            </div>
            
            {estatisticas.supervisores?.length > 0 && (
              <>
                <h3 className="font-semibold mb-2">Detalhamento por Supervisor</h3>
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>Supervisor</th>
                        <th>WhatsApp</th>
                        <th>Sucessos</th>
                        <th>Falhas</th>
                        <th>Taxa de Sucesso</th>
                      </tr>
                    </thead>
                    <tbody>
                      {estatisticas.supervisores.map((sup, i) => (
                        <tr key={i}>
                          <td>{sup.nome}</td>
                          <td>{sup.whatsapp}</td>
                          <td><span className="badge badge-success">{sup.sucessos}</span></td>
                          <td><span className="badge badge-danger">{sup.falhas}</span></td>
                          <td>
                            {sup.total > 0 
                              ? `${Math.round((sup.sucessos / sup.total) * 100)}%`
                              : '-'
                            }
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
            
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModalEstatisticas(false)}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Criar Grupo */}
      {showModalGrupo && (
        <div className="modal-overlay" onClick={() => setShowModalGrupo(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Criar Grupo do Plantão</h2>
              <button className="modal-close" onClick={() => setShowModalGrupo(false)}>
                <X size={24} />
              </button>
            </div>
            
            <div className="alert alert-info">
              <MessageSquare size={20} />
              <div>
                <p>Um grupo será criado com o nome:</p>
                <p className="font-bold">Plantão - {gestorAtual?.nome}</p>
              </div>
            </div>
            
            <p className="text-secondary text-sm mb-3">
              O link de convite será gerado automaticamente para você compartilhar com os médicos.
            </p>
            
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModalGrupo(false)}>
                Cancelar
              </button>
              <button className="btn btn-primary" onClick={criarGrupo}>
                <Plus size={18} />
                Criar Grupo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Adicionar Membro */}
      {showModalMembro && (
        <div className="modal-overlay" onClick={() => setShowModalMembro(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Adicionar Membro ao Grupo</h2>
              <button className="modal-close" onClick={() => setShowModalMembro(false)}>
                <X size={24} />
              </button>
            </div>
            
            <p className="text-secondary text-sm mb-3">
              Selecione um médico para adicionar. Um link de convite será enviado automaticamente.
            </p>
            
            <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
              {funcionariosDisponiveis.map(f => (
                <div 
                  key={f.id}
                  className="notification-item"
                  style={{ cursor: 'pointer', borderRadius: '0.5rem', marginBottom: '0.5rem' }}
                  onClick={() => adicionarMembro(f.id)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold">{f.nome}</p>
                      <p className="text-sm text-secondary">{f.especialidade || f.cargo}</p>
                      {f.whatsapp && (
                        <p className="text-xs text-secondary flex items-center gap-1">
                          <Phone size={12} /> {f.whatsapp}
                        </p>
                      )}
                    </div>
                    <button className="btn btn-primary btn-sm">
                      <UserPlus size={14} />
                      Adicionar
                    </button>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModalMembro(false)}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Enviar Mensagem */}
      {showModalMensagem && (
        <div className="modal-overlay" onClick={() => setShowModalMensagem(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Enviar Mensagem</h2>
              <button className="modal-close" onClick={() => setShowModalMensagem(false)}>
                <X size={24} />
              </button>
            </div>
            
            <div className="form-group">
              <label className="form-label">Destino</label>
              <select
                className="form-select"
                value={novaMensagem.destino}
                onChange={e => setNovaMensagem({ ...novaMensagem, destino: e.target.value })}
              >
                <option value="grupo">Grupo (todos veem)</option>
                <option value="pessoal">Mensagem Pessoal</option>
              </select>
            </div>
            
            {novaMensagem.destino === 'grupo' && (
              <div className="form-group">
                <label className="form-label">Marcar Médico (opcional)</label>
                <select
                  className="form-select"
                  value={novaMensagem.funcionario_id}
                  onChange={e => setNovaMensagem({ ...novaMensagem, funcionario_id: e.target.value })}
                >
                  <option value="">Nenhum (mensagem geral)</option>
                  {membros.map(m => (
                    <option key={m.id} value={m.id}>@{m.nome}</option>
                  ))}
                </select>
              </div>
            )}
            
            {novaMensagem.destino === 'pessoal' && (
              <div className="form-group">
                <label className="form-label">Destinatário *</label>
                <select
                  className="form-select"
                  value={novaMensagem.funcionario_id}
                  onChange={e => setNovaMensagem({ ...novaMensagem, funcionario_id: e.target.value })}
                  required
                >
                  <option value="">Selecione...</option>
                  {funcionarios.map(f => (
                    <option key={f.id} value={f.id}>{f.nome}</option>
                  ))}
                </select>
              </div>
            )}
            
            <div className="form-group">
              <label className="form-label">Mensagem *</label>
              <textarea
                className="form-textarea"
                rows="4"
                value={novaMensagem.mensagem}
                onChange={e => setNovaMensagem({ ...novaMensagem, mensagem: e.target.value })}
                placeholder="Digite sua mensagem..."
                required
              />
            </div>
            
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModalMensagem(false)}>
                Cancelar
              </button>
              <button 
                className="btn btn-primary" 
                onClick={enviarMensagem}
                disabled={!novaMensagem.mensagem || (novaMensagem.destino === 'pessoal' && !novaMensagem.funcionario_id)}
              >
                <Send size={18} />
                Enviar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Conectar WhatsApp */}
      {showModalConectar && (
        <div className="modal-overlay" onClick={() => setShowModalConectar(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Conectar WhatsApp</h2>
              <button className="modal-close" onClick={() => setShowModalConectar(false)}>
                <X size={24} />
              </button>
            </div>
            
            <div className="text-center mb-3">
              <div className="stat-icon blue mx-auto mb-3" style={{ width: '100px', height: '100px' }}>
                <QrCode size={50} />
              </div>
              <p className="text-secondary mb-2">
                Escaneie o QR Code com seu WhatsApp
              </p>
              <p className="text-xs text-secondary">
                (Em produção, aqui aparecerá o QR Code real)
              </p>
            </div>
            
            <div className="alert alert-warning">
              <p className="text-sm">
                <strong>Simulação:</strong> Digite seu número de WhatsApp para simular a conexão.
              </p>
            </div>
            
            <div className="form-group">
              <label className="form-label">Número WhatsApp do Gestor</label>
              <input
                type="text"
                className="form-input"
                value={telefoneConexao}
                onChange={e => setTelefoneConexao(e.target.value)}
                placeholder="Ex: 5511999999999"
              />
            </div>
            
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModalConectar(false)}>
                Cancelar
              </button>
              <button className="btn btn-success" onClick={confirmarConexao} disabled={!telefoneConexao}>
                <Check size={18} />
                Confirmar Conexão
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default WhatsApp;
