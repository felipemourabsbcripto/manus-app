import { useState, useEffect } from 'react';
import { 
  MapPin, LogIn, LogOut, Clock, CheckCircle, XCircle, AlertCircle,
  Navigation, RefreshCw, User, Calendar, Timer
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { API_URL } from '../config';

function CheckIn() {
  const [funcionarios, setFuncionarios] = useState([]);
  const [funcionarioSelecionado, setFuncionarioSelecionado] = useState('');
  const [localizacao, setLocalizacao] = useState(null);
  const [carregandoLocalizacao, setCarregandoLocalizacao] = useState(false);
  const [presencaHoje, setPresencaHoje] = useState(null);
  const [hospitais, setHospitais] = useState([]);
  const [historico, setHistorico] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModalHoraExtra, setShowModalHoraExtra] = useState(false);
  const [motivoHoraExtra, setMotivoHoraExtra] = useState('');

  useEffect(() => {
    fetchDados();
  }, []);

  useEffect(() => {
    if (funcionarioSelecionado) {
      fetchPresencaHoje();
      fetchHistorico();
    }
  }, [funcionarioSelecionado]);

  const fetchDados = async () => {
    try {
      const [funcRes, hospRes] = await Promise.all([
        fetch(`${API_URL}/funcionarios`),
        fetch(`${API_URL}/hospitais`)
      ]);
      setFuncionarios(await funcRes.json());
      setHospitais(await hospRes.json());
    } catch (error) {
      console.error('Erro:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPresencaHoje = async () => {
    try {
      const hoje = new Date().toISOString().split('T')[0];
      const res = await fetch(`${API_URL}/presencas?funcionario_id=${funcionarioSelecionado}&data_inicio=${hoje}&data_fim=${hoje}`);
      const data = await res.json();
      setPresencaHoje(data[0] || null);
    } catch (error) {
      console.error('Erro:', error);
    }
  };

  const fetchHistorico = async () => {
    try {
      const res = await fetch(`${API_URL}/localizacao/historico/${funcionarioSelecionado}`);
      setHistorico(await res.json());
    } catch (error) {
      console.error('Erro:', error);
    }
  };

  const obterLocalizacao = () => {
    setCarregandoLocalizacao(true);
    
    if (!navigator.geolocation) {
      alert('Geolocalização não suportada pelo navegador');
      setCarregandoLocalizacao(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocalizacao({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy
        });
        setCarregandoLocalizacao(false);
      },
      (error) => {
        console.error('Erro ao obter localização:', error);
        alert('Não foi possível obter sua localização. Verifique as permissões.');
        setCarregandoLocalizacao(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const fazerCheckIn = async () => {
    if (!localizacao) {
      alert('Por favor, obtenha sua localização primeiro');
      return;
    }

    try {
      const res = await fetch(`${API_URL}/checkin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          funcionario_id: funcionarioSelecionado,
          latitude: localizacao.latitude,
          longitude: localizacao.longitude
        })
      });
      const data = await res.json();
      
      if (data.success) {
        alert(`Check-in realizado às ${data.hora}!\n\n` +
          `Status: ${data.status.toUpperCase()}\n` +
          `Distância do hospital: ${data.distancia ? (data.distancia / 1000).toFixed(2) + ' km' : 'N/A'}\n` +
          `${data.dentro_raio ? '✅ Dentro do raio permitido' : '⚠️ Fora do raio permitido'}`);
        fetchPresencaHoje();
        fetchHistorico();
      } else {
        alert(data.error || 'Erro ao fazer check-in');
      }
    } catch (error) {
      console.error('Erro:', error);
      alert('Erro ao fazer check-in');
    }
  };

  const fazerCheckOut = async (horaExtra = false) => {
    if (!localizacao) {
      alert('Por favor, obtenha sua localização primeiro');
      return;
    }

    try {
      const res = await fetch(`${API_URL}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          funcionario_id: funcionarioSelecionado,
          latitude: localizacao.latitude,
          longitude: localizacao.longitude,
          hora_extra: horaExtra,
          motivo: motivoHoraExtra
        })
      });
      const data = await res.json();
      
      if (data.success) {
        let msg = `Check-out realizado às ${data.hora}!`;
        if (data.hora_extra_minutos > 0) {
          msg += `\n\n⏱️ Hora extra registrada: ${Math.floor(data.hora_extra_minutos / 60)}h ${data.hora_extra_minutos % 60}min`;
        }
        alert(msg);
        setShowModalHoraExtra(false);
        setMotivoHoraExtra('');
        fetchPresencaHoje();
        fetchHistorico();
      } else {
        alert(data.error || 'Erro ao fazer check-out');
      }
    } catch (error) {
      console.error('Erro:', error);
      alert('Erro ao fazer check-out');
    }
  };

  const atualizarLocalizacao = async () => {
    if (!localizacao) {
      alert('Por favor, obtenha sua localização primeiro');
      return;
    }

    try {
      const res = await fetch(`${API_URL}/localizacao/atualizar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          funcionario_id: funcionarioSelecionado,
          latitude: localizacao.latitude,
          longitude: localizacao.longitude
        })
      });
      const data = await res.json();
      
      alert(`Localização atualizada!\n\n` +
        `Distância: ${data.distancia ? (data.distancia / 1000).toFixed(2) + ' km' : 'N/A'}\n` +
        `${data.dentro_raio ? '✅ Dentro do raio' : '⚠️ Fora do raio'}\n` +
        `${data.alerta_enviado ? '🚨 Alerta enviado ao gestor' : ''}`);
      
      fetchHistorico();
    } catch (error) {
      console.error('Erro:', error);
      alert('Erro ao atualizar localização');
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      presente: { class: 'badge-success', icon: CheckCircle, text: 'Presente' },
      atraso: { class: 'badge-warning', icon: AlertCircle, text: 'Atraso' },
      furo: { class: 'badge-danger', icon: XCircle, text: 'Furo' },
      falta: { class: 'badge-danger', icon: XCircle, text: 'Falta' },
      pendente: { class: 'badge-secondary', icon: Clock, text: 'Pendente' }
    };
    const config = statusConfig[status] || statusConfig.pendente;
    const Icon = config.icon;
    return (
      <span className={`badge ${config.class}`}>
        <Icon size={12} />
        {config.text}
      </span>
    );
  };

  const funcionarioAtual = funcionarios.find(f => f.id === funcionarioSelecionado);

  if (loading) {
    return <div className="loading"><div className="spinner"></div></div>;
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Check-in / Check-out</h1>
          <p className="page-subtitle">
            Registre sua presença com localização • {format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })}
          </p>
        </div>
      </div>

      {/* Seleção de Funcionário */}
      <div className="card mb-3">
        <div className="form-row">
          <div className="form-group" style={{ flex: 2 }}>
            <label className="form-label">Selecione o Médico/Funcionário</label>
            <select
              className="form-select"
              value={funcionarioSelecionado}
              onChange={e => setFuncionarioSelecionado(e.target.value)}
            >
              <option value="">Selecione...</option>
              {funcionarios.map(f => (
                <option key={f.id} value={f.id}>
                  {f.nome} - {f.especialidade || f.cargo}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Localização</label>
            <button 
              className="btn btn-primary w-full"
              onClick={obterLocalizacao}
              disabled={carregandoLocalizacao}
            >
              <Navigation size={18} />
              {carregandoLocalizacao ? 'Obtendo...' : 'Obter Localização'}
            </button>
          </div>
        </div>

        {localizacao && (
          <div className="alert alert-info mt-2">
            <MapPin size={20} />
            <div>
              <p className="font-semibold">Localização obtida!</p>
              <p className="text-sm">
                Lat: {localizacao.latitude.toFixed(6)} | Lng: {localizacao.longitude.toFixed(6)}
                {localizacao.accuracy && ` | Precisão: ${localizacao.accuracy.toFixed(0)}m`}
              </p>
            </div>
          </div>
        )}
      </div>

      {funcionarioSelecionado && (
        <>
          {/* Status do Dia */}
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon blue">
                <User size={24} />
              </div>
              <div className="stat-info">
                <h3>{funcionarioAtual?.nome}</h3>
                <p>{funcionarioAtual?.especialidade || funcionarioAtual?.cargo}</p>
              </div>
            </div>

            <div className="stat-card">
              <div className={`stat-icon ${presencaHoje ? (presencaHoje.hora_entrada ? 'green' : 'yellow') : 'red'}`}>
                <Calendar size={24} />
              </div>
              <div className="stat-info">
                <h3>{presencaHoje ? getStatusBadge(presencaHoje.status) : 'Sem Escala'}</h3>
                <p>Status Hoje</p>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon cyan">
                <Clock size={24} />
              </div>
              <div className="stat-info">
                <h3>
                  {presencaHoje?.hora_entrada || '--:--'} - {presencaHoje?.hora_saida || '--:--'}
                </h3>
                <p>Entrada / Saída</p>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon blue">
                <Timer size={24} />
              </div>
              <div className="stat-info">
                <h3>{presencaHoje?.hora_esperada_inicio} - {presencaHoje?.hora_esperada_fim || '--:--'}</h3>
                <p>Horário Esperado</p>
              </div>
            </div>
          </div>

          {/* Botões de Ação */}
          <div className="card mb-3">
            <div className="card-header">
              <h2 className="card-title">Ações</h2>
            </div>
            
            <div className="flex flex-wrap gap-2">
              {!presencaHoje?.hora_entrada && presencaHoje && (
                <button 
                  className="btn btn-success"
                  onClick={fazerCheckIn}
                  disabled={!localizacao}
                >
                  <LogIn size={20} />
                  Fazer Check-in
                </button>
              )}

              {presencaHoje?.hora_entrada && !presencaHoje?.hora_saida && (
                <>
                  <button 
                    className="btn btn-danger"
                    onClick={() => fazerCheckOut(false)}
                    disabled={!localizacao}
                  >
                    <LogOut size={20} />
                    Fazer Check-out
                  </button>
                  
                  <button 
                    className="btn btn-warning"
                    onClick={() => setShowModalHoraExtra(true)}
                    disabled={!localizacao}
                  >
                    <Timer size={20} />
                    Check-out com Hora Extra
                  </button>

                  <button 
                    className="btn btn-secondary"
                    onClick={atualizarLocalizacao}
                    disabled={!localizacao}
                  >
                    <RefreshCw size={20} />
                    Atualizar Localização
                  </button>
                </>
              )}

              {presencaHoje?.hora_saida && (
                <div className="alert alert-success w-full">
                  <CheckCircle size={20} />
                  <span>Plantão encerrado às {presencaHoje.hora_saida}</span>
                </div>
              )}

              {!presencaHoje && (
                <div className="alert alert-warning w-full">
                  <AlertCircle size={20} />
                  <span>Você não tem escala para hoje</span>
                </div>
              )}
            </div>
          </div>

          {/* Hospitais */}
          <div className="grid-2">
            <div className="card">
              <div className="card-header">
                <h2 className="card-title">Hospitais Cadastrados</h2>
              </div>
              
              {hospitais.map(h => (
                <div key={h.id} className="notification-item" style={{ borderBottom: '1px solid var(--border)' }}>
                  <div className="flex items-center gap-2">
                    <MapPin className="text-primary" size={20} />
                    <div>
                      <p className="font-semibold">{h.nome}</p>
                      <p className="text-sm text-secondary">{h.endereco}</p>
                      <p className="text-xs text-secondary">
                        Raio: {h.raio_metros}m | Lat: {h.latitude}, Lng: {h.longitude}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Histórico de Localizações */}
            <div className="card">
              <div className="card-header">
                <h2 className="card-title">Histórico de Localizações</h2>
              </div>
              
              {historico.length > 0 ? (
                <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                  {historico.slice(0, 10).map(loc => (
                    <div key={loc.id} className="notification-item" style={{ borderBottom: '1px solid var(--border)' }}>
                      <div className="flex items-center justify-between">
                        <div>
                          <span className={`badge ${loc.tipo === 'checkin' ? 'badge-success' : loc.tipo === 'checkout' ? 'badge-danger' : 'badge-info'}`}>
                            {loc.tipo}
                          </span>
                          <p className="text-xs text-secondary mt-1">
                            {format(new Date(loc.created_at), 'dd/MM HH:mm')}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm">
                            {loc.distancia_hospital 
                              ? `${(loc.distancia_hospital / 1000).toFixed(2)} km` 
                              : 'N/A'}
                          </p>
                          <p className="text-xs text-secondary">do hospital</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <MapPin size={48} />
                  <p>Nenhum registro de localização</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Modal Hora Extra */}
      {showModalHoraExtra && (
        <div className="modal-overlay" onClick={() => setShowModalHoraExtra(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Registrar Hora Extra</h2>
              <button className="modal-close" onClick={() => setShowModalHoraExtra(false)}>
                <XCircle size={24} />
              </button>
            </div>
            
            <div className="alert alert-info mb-3">
              <Timer size={20} />
              <span>Você está saindo após o horário previsto. O tempo extra será registrado.</span>
            </div>
            
            <div className="form-group">
              <label className="form-label">Motivo da Hora Extra *</label>
              <textarea
                className="form-textarea"
                rows="3"
                value={motivoHoraExtra}
                onChange={e => setMotivoHoraExtra(e.target.value)}
                placeholder="Descreva o motivo da hora extra..."
                required
              />
            </div>
            
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModalHoraExtra(false)}>
                Cancelar
              </button>
              <button 
                className="btn btn-warning" 
                onClick={() => fazerCheckOut(true)}
                disabled={!motivoHoraExtra.trim()}
              >
                <Timer size={18} />
                Registrar e Fazer Check-out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CheckIn;
