import { useState, useEffect } from 'react';
import {
  MessageSquare, Users, Plus, Send, Check, CheckCheck, X,
  Phone, Link2, QrCode, Wifi, WifiOff, UserPlus, Bell, RefreshCw,
  Shield, Trash2, Edit2, ArrowUp, ArrowDown, AlertTriangle, BarChart3,
  Settings, Globe, Key, Activity
} from 'lucide-react';
import { format } from 'date-fns';
import { API_URL } from '../config';

function WhatsApp() {
  const [gestores, setGestores] = useState([]);
  const [gestorSelecionado, setGestorSelecionado] = useState('');
  const [grupos, setGrupos] = useState([]);
  const [membros, setMembros] = useState([]);
  const [funcionarios, setFuncionarios] = useState([]);
  const [mensagens, setMensagens] = useState([]);
  const [conexao, setConexao] = useState(null);
  const [supervisores, setSupervisores] = useState([]);
  const [estatisticas, setEstatisticas] = useState(null);
  const [loading, setLoading] = useState(true);

  // Modais
  const [showModalGrupo, setShowModalGrupo] = useState(false);
  const [showModalMembro, setShowModalMembro] = useState(false);
  const [showModalMensagem, setShowModalMensagem] = useState(false);
  const [showModalConectar, setShowModalConectar] = useState(false);
  const [showModalSupervisor, setShowModalSupervisor] = useState(false);
  const [showModalEstatisticas, setShowModalEstatisticas] = useState(false);
  const [showModalConfig, setShowModalConfig] = useState(false);

  const [grupoSelecionado, setGrupoSelecionado] = useState(null);
  const [novaMensagem, setNovaMensagem] = useState({ destino: 'grupo', grupo_id: '', funcionario_id: '', mensagem: '' });

  // Configuração API Real
  const [apiConfig, setApiConfig] = useState({
    url: '',
    key: '',
    instance: ''
  });

  const [supervisorForm, setSupervisorForm] = useState({ nome: '', whatsapp: '', email: '' });
  const [editandoSupervisor, setEditandoSupervisor] = useState(null);
  const [abaSelecionada, setAbaSelecionada] = useState('grupos');

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      const [resGestores, resFuncs] = await Promise.all([
        fetch(`${API_URL}/gestores`),
        fetch(`${API_URL}/funcionarios`)
      ]);
      const gestoresData = await resGestores.json();
      setGestores(gestoresData);
      setFuncionarios(await resFuncs.json());

      if (gestoresData.length > 0) {
        setGestorSelecionado(gestoresData[0].id);
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (gestorSelecionado) {
      refreshGestorData();
    }
  }, [gestorSelecionado]);

  const refreshGestorData = async () => {
    if (!gestorSelecionado) return;
    try {
      const [resGrupos, resCon, resSup] = await Promise.all([
        fetch(`${API_URL}/whatsapp/grupos/${gestorSelecionado}`),
        fetch(`${API_URL}/whatsapp/status/${gestorSelecionado}`),
        fetch(`${API_URL}/supervisores/${gestorSelecionado}`)
      ]);

      const gruposData = await resGrupos.json();
      setGrupos(gruposData);
      setConexao(await resCon.json());
      setSupervisores(await resSup.json());

      if (gruposData.length > 0 && !grupoSelecionado) {
        setGrupoSelecionado(gruposData[0].id);
      }
    } catch (e) {
      console.error('Erro ao atualizar dados do gestor:', e);
    }
  };

  useEffect(() => {
    if (grupoSelecionado) {
      fetchMembros();
      fetchMensagens();
    }
  }, [grupoSelecionado]);

  const fetchMembros = async () => {
    const res = await fetch(`${API_URL}/whatsapp/grupos/${grupoSelecionado}/membros`);
    setMembros(await res.json());
  };

  const fetchMensagens = async () => {
    const res = await fetch(`${API_URL}/whatsapp/mensagens?grupo_id=${grupoSelecionado}`);
    setMensagens(await res.json());
  };

  // ======== ACTIONS ========

  const handleConectar = async () => {
    try {
      const res = await fetch(`${API_URL}/whatsapp/conectar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gestor_id: gestorSelecionado,
          api_config: apiConfig.url ? apiConfig : null
        })
      });
      const data = await res.json();
      setConexao(data);
      setShowModalConectar(true);
    } catch (e) {
      alert('Erro ao conectar: ' + e.message);
    }
  };

  const handleDesconectar = async () => {
    if (window.confirm('Realmente deseja desconectar o WhatsApp?')) {
      await fetch(`${API_URL}/whatsapp/desconectar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gestor_id: gestorSelecionado })
      });
      refreshGestorData();
    }
  };

  const handleCriarGrupo = async () => {
    const nome = prompt('Nome do grupo:', `Plantão - ${gestores.find(g => g.id === gestorSelecionado)?.nome}`);
    if (!nome) return;

    await fetch(`${API_URL}/whatsapp/grupos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gestor_id: gestorSelecionado, nome })
    });
    refreshGestorData();
    setShowModalGrupo(false);
  };

  const handleAdicionarSupervisor = async () => {
    await fetch(`${API_URL}/supervisores`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gestor_id: gestorSelecionado, ...supervisorForm })
    });
    setShowModalSupervisor(false);
    setSupervisorForm({ nome: '', whatsapp: '', email: '' });
    refreshGestorData();
  };

  const handleEnviarMensagem = async () => {
    const endpoint = novaMensagem.destino === 'grupo' ? 'grupo' : 'pessoal';
    const body = novaMensagem.destino === 'grupo'
      ? { grupo_id: grupoSelecionado, mensagem: novaMensagem.mensagem }
      : { funcionario_id: novaMensagem.funcionario_id, mensagem: novaMensagem.mensagem };

    await fetch(`${API_URL}/whatsapp/mensagem/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    setShowModalMensagem(false);
    setNovaMensagem({ ...novaMensagem, mensagem: '' });
    fetchMensagens();
  };

  const handleNotificarPlantao = async () => {
    const data = new Date().toISOString().split('T')[0];
    await fetch(`${API_URL}/whatsapp/notificar-plantao`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gestor_id: gestorSelecionado, data })
    });
    alert('Notificação enviada!');
    fetchMensagens();
  };

  if (loading) return <div className="loading"><div className="spinner"></div></div>;

  return (
    <div className="whatsapp-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Comunicação WhatsApp</h1>
          <p className="page-subtitle">Instâncias reais e sistema de backup</p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-secondary" onClick={() => setShowModalConfig(true)}>
            <Settings size={20} />
            Configurar API
          </button>
          {conexao?.status === 'conectado' ? (
            <button className="btn btn-danger" onClick={handleDesconectar}>
              <WifiOff size={20} />
              Desconectar
            </button>
          ) : (
            <button className="btn btn-primary" onClick={handleConectar}>
              <QrCode size={20} />
              Conectar WhatsApp
            </button>
          )}
        </div>
      </div>

      <div className="grid-3 mb-3">
        <div className="card">
          <label className="form-label">Gestor Responsável</label>
          <select
            className="form-select"
            value={gestorSelecionado}
            onChange={e => setGestorSelecionado(e.target.value)}
          >
            {gestores.map(g => <option key={g.id} value={g.id}>{g.nome}</option>)}
          </select>
        </div>
        <div className="card text-center">
          <p className="text-secondary text-xs uppercase font-bold mb-2">Status da Instância</p>
          <div className="flex items-center justify-center gap-2">
            {conexao?.status === 'conectado' ? (
              <span className="badge badge-success"><Wifi size={14} /> Conectado</span>
            ) : (
              <span className="badge badge-danger"><WifiOff size={14} /> Desconectado</span>
            )}
            {conexao?.instancia && <span className="text-xs text-secondary">[{conexao.instancia}]</span>}
          </div>
        </div>
        <div className="card text-center">
          <p className="text-secondary text-xs uppercase font-bold mb-2">Supervisores de Backup</p>
          <div className="flex items-center justify-center gap-2">
            <span className="badge badge-info"><Shield size={14} /> {supervisores.length} Ativos</span>
          </div>
        </div>
      </div>

      <div className="tabs flex gap-2 mb-3">
        <button
          className={`btn ${abaSelecionada === 'grupos' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setAbaSelecionada('grupos')}
        >
          <Users size={18} /> Grupos e Mensagens
        </button>
        <button
          className={`btn ${abaSelecionada === 'supervisores' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setAbaSelecionada('supervisores')}
        >
          <Shield size={18} /> Supervisores de Backup
        </button>
      </div>

      {abaSelecionada === 'grupos' ? (
        <div className="grid-2">
          {/* Coluna Grupos */}
          <div className="card">
            <div className="flex justify-between items-center mb-3">
              <h2 className="card-title">Grupos</h2>
              <button className="btn btn-primary btn-sm" onClick={() => setShowModalGrupo(true)}>
                <Plus size={16} /> Novo
              </button>
            </div>
            <div className="list">
              {grupos.map(g => (
                <div
                  key={g.id}
                  className={`notification-item ${grupoSelecionado === g.id ? 'unread' : ''}`}
                  onClick={() => setGrupoSelecionado(g.id)}
                  style={{ cursor: 'pointer', borderRadius: '0.75rem', marginBottom: '0.5rem' }}
                >
                  <p className="font-semibold">{g.nome}</p>
                  <p className="text-xs text-secondary">{g.total_membros} membros</p>
                </div>
              ))}
            </div>
          </div>

          {/* Coluna Detalhes/Chat */}
          <div className="card">
            {grupoSelecionado ? (
              <>
                <div className="flex justify-between items-center mb-3">
                  <h2 className="card-title">Equipe do Grupo</h2>
                  <div className="flex gap-2">
                    <button className="btn btn-warning btn-sm" onClick={handleNotificarPlantao}>
                      <Bell size={16} /> Notificar
                    </button>
                    <button className="btn btn-primary btn-sm" onClick={() => setShowModalMensagem(true)}>
                      <Send size={16} /> Enviar
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 mb-3">
                  {membros.map(m => (
                    <span key={m.id} className="badge badge-info">{m.nome}</span>
                  ))}
                  <button className="btn btn-secondary btn-sm" onClick={() => setShowModalMembro(true)}>
                    <UserPlus size={14} />
                  </button>
                </div>
                <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '1rem 0' }} />
                <h3 className="text-sm font-bold mb-2 uppercase text-secondary">Backlog de Mensagens</h3>
                <div className="chat-log" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                  {mensagens.map(msg => (
                    <div key={msg.id} className="notification-item" style={{ marginBottom: '0.5rem' }}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-bold">{msg.tipo === 'grupo' ? 'GRUPO' : 'PESSOAL'}</span>
                        <span className="text-secondary">{format(new Date(msg.created_at), 'HH:mm')}</span>
                      </div>
                      <p className="text-sm">{msg.mensagem}</p>
                      <div className="flex justify-end mt-1">
                        {msg.status === 'enviado' ? <CheckCheck size={14} className="text-success" /> : <AlertTriangle size={14} className="text-danger" />}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : <p className="text-center text-secondary py-5">Selecione um grupo para gerenciar</p>}
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="flex justify-between items-center mb-3">
            <h2 className="card-title">Supervisores Cadastrados</h2>
            <button className="btn btn-primary" onClick={() => setShowModalSupervisor(true)}>
              <Plus size={20} /> Adicionar Supervisor
            </button>
          </div>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Prioridade</th>
                  <th>Nome</th>
                  <th>WhatsApp</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {supervisores.map((s, i) => (
                  <tr key={s.id}>
                    <td>{i + 1}º</td>
                    <td className="font-bold">{s.nome}</td>
                    <td>{s.whatsapp}</td>
                    <td>{s.falhas_consecutivas > 0 ? <span className="text-danger">{s.falhas_consecutivas} falhas</span> : <span className="text-success">OK</span>}</td>
                    <td>
                      <button className="btn btn-danger btn-sm" onClick={async () => {
                        if (confirm('Excluir?')) {
                          await fetch(`${API_URL}/supervisores/${s.id}`, { method: 'DELETE' });
                          refreshGestorData();
                        }
                      }}><Trash2 size={14} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAIS */}

      {showModalConfig && (
        <div className="modal-overlay" onClick={() => setShowModalConfig(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Configurar Evolution API</h2>
              <button className="modal-close" onClick={() => setShowModalConfig(false)}><X size={24} /></button>
            </div>
            <div className="modal-body">
              <div className="alert alert-info mb-3">
                <Globe size={20} />
                <span>Configure sua instância da Evolution API v2 para este gestor.</span>
              </div>
              <div className="form-group">
                <label className="form-label">API URL</label>
                <input
                  className="form-input"
                  placeholder="https://api.seuserver.com"
                  value={apiConfig.url}
                  onChange={e => setApiConfig({ ...apiConfig, url: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">API Key</label>
                <input
                  className="form-input"
                  type="password"
                  placeholder="Seu token apikey"
                  value={apiConfig.key}
                  onChange={e => setApiConfig({ ...apiConfig, key: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Nome da Instância</label>
                <input
                  className="form-input"
                  placeholder="ex: gestor_felipe"
                  value={apiConfig.instance}
                  onChange={e => setApiConfig({ ...apiConfig, instance: e.target.value })}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModalConfig(false)}>Fechar</button>
              <button className="btn btn-primary" onClick={() => {
                handleConectar();
                setShowModalConfig(false);
              }}>Salvar e Conectar</button>
            </div>
          </div>
        </div>
      )}

      {showModalConectar && (
        <div className="modal-overlay" onClick={() => setShowModalConectar(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Conectar WhatsApp</h2>
              <button className="modal-close" onClick={() => setShowModalConectar(false)}><X size={24} /></button>
            </div>
            <div className="modal-body text-center">
              {conexao?.qrcode ? (
                <>
                  <div className="bg-white p-3 inline-block rounded mb-3">
                    {conexao.qrcode === 'SIMULATION_QR' ? (
                      <QrCode size={200} className="text-secondary" />
                    ) : (
                      <img src={conexao.qrcode} alt="QR Code" style={{ width: '250px' }} />
                    )}
                  </div>
                  <p className="text-secondary">Escaneie o código acima com seu aplicativo do WhatsApp.</p>
                </>
              ) : <p>Gerando conexão...</p>}
            </div>
            <div className="modal-footer">
              <button className="btn btn-primary" onClick={() => refreshGestorData()}>Já escaneei</button>
            </div>
          </div>
        </div>
      )}

      {showModalMensagem && (
        <div className="modal-overlay" onClick={() => setShowModalMensagem(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Nova Mensagem</h2>
              <button className="modal-close" onClick={() => setShowModalMensagem(false)}><X size={24} /></button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Destino</label>
                <select
                  className="form-select"
                  value={novaMensagem.destino}
                  onChange={e => setNovaMensagem({ ...novaMensagem, destino: e.target.value })}
                >
                  <option value="grupo">Grupo Selecionado</option>
                  <option value="pessoal">Mensagem Pessoal</option>
                </select>
              </div>
              {novaMensagem.destino === 'pessoal' && (
                <div className="form-group">
                  <label className="form-label">Médico</label>
                  <select
                    className="form-select"
                    value={novaMensagem.funcionario_id}
                    onChange={e => setNovaMensagem({ ...novaMensagem, funcionario_id: e.target.value })}
                  >
                    <option value="">Selecione...</option>
                    {funcionarios.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
                  </select>
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Mensagem</label>
                <textarea
                  className="form-input"
                  rows="4"
                  value={novaMensagem.mensagem}
                  onChange={e => setNovaMensagem({ ...novaMensagem, mensagem: e.target.value })}
                ></textarea>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModalMensagem(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleEnviarMensagem}>Enviar Agora</button>
            </div>
          </div>
        </div>
      )}

      {showModalSupervisor && (
        <div className="modal-overlay" onClick={() => setShowModalSupervisor(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Novo Supervisor</h2>
              <button className="modal-close" onClick={() => setShowModalSupervisor(false)}><X size={24} /></button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Nome</label>
                <input className="form-input" value={supervisorForm.nome} onChange={e => setSupervisorForm({ ...supervisorForm, nome: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">WhatsApp (DDI+DDD+Num)</label>
                <input className="form-input" placeholder="5531999999999" value={supervisorForm.whatsapp} onChange={e => setSupervisorForm({ ...supervisorForm, whatsapp: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input className="form-input" value={supervisorForm.email} onChange={e => setSupervisorForm({ ...supervisorForm, email: e.target.value })} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModalSupervisor(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleAdicionarSupervisor}>Cadastrar</button>
            </div>
          </div>
        </div>
      )}

      {showModalMembro && (
        <div className="modal-overlay" onClick={() => setShowModalMembro(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Adicionar Médico</h2>
              <button className="modal-close" onClick={() => setShowModalMembro(false)}><X size={24} /></button>
            </div>
            <div className="modal-body" style={{ maxHeight: '400px', overflowY: 'auto' }}>
              {funcionarios.filter(f => !membros.find(m => m.id === f.id)).map(f => (
                <div key={f.id} className="notification-item flex justify-between items-center mb-2" onClick={async () => {
                  await fetch(`${API_URL}/whatsapp/grupos/${grupoSelecionado}/membros`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ funcionario_id: f.id })
                  });
                  fetchMembros();
                }}>
                  <div>
                    <p className="font-bold">{f.nome}</p>
                    <p className="text-xs text-secondary">{f.especialidade || f.cargo}</p>
                  </div>
                  <UserPlus size={20} className="text-primary" />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {showModalGrupo && (
        <div className="modal-overlay" onClick={() => setShowModalGrupo(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Novo Grupo</h2>
              <button className="modal-close" onClick={() => setShowModalGrupo(false)}><X size={24} /></button>
            </div>
            <div className="modal-body">
              <p>Deseja criar um novo grupo de plantão para este gestor?</p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModalGrupo(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleCriarGrupo}>Criar Grupo</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default WhatsApp;
