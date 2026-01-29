import { useState, useEffect, useCallback, useRef } from 'react';
import {
  MapPin, LogIn, LogOut, Clock, CheckCircle, XCircle, AlertCircle,
  Navigation, RefreshCw, User, Calendar, Timer, QrCode, Camera, Scan
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { API_URL } from '../config';

function CheckIn() {
  const [funcionarios, setFuncionarios] = useState([]);
  const [funcionarioSelecionado, setFuncionarioSelecionado] = useState('');
  const [localizacao, setLocalizacao] = useState(null);
  const [enderecoAtual, setEnderecoAtual] = useState(null);
  const [carregandoLocalizacao, setCarregandoLocalizacao] = useState(false);
  const [presencaHoje, setPresencaHoje] = useState(null);
  const [hospitais, setHospitais] = useState([]);
  const [enderecosHospitais, setEnderecosHospitais] = useState({});
  const [historico, setHistorico] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModalHoraExtra, setShowModalHoraExtra] = useState(false);
  const [motivoHoraExtra, setMotivoHoraExtra] = useState('');
  
  // QR Code states
  const [modoCheckin, setModoCheckin] = useState('gps'); // 'gps' ou 'qrcode'
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [showQRGenerator, setShowQRGenerator] = useState(false);
  const [qrCodeData, setQrCodeData] = useState(null);
  const [codigoManual, setCodigoManual] = useState('');
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  // Função para converter coordenadas em endereço amigável (Geocodificação Reversa)
  const geocodificarReverso = async (latitude, longitude) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1`,
        {
          headers: {
            'Accept-Language': 'pt-BR',
            'User-Agent': 'EscalaPro/1.0'
          }
        }
      );
      const data = await response.json();

      if (data && data.address) {
        const addr = data.address;
        // Montar endereço amigável
        const partes = [];

        if (addr.road) partes.push(addr.road);
        if (addr.house_number) partes[0] = `${addr.road}, ${addr.house_number}`;
        if (addr.suburb || addr.neighbourhood) partes.push(addr.suburb || addr.neighbourhood);
        if (addr.city || addr.town || addr.village) partes.push(addr.city || addr.town || addr.village);
        if (addr.state) partes.push(addr.state);

        return {
          enderecoCompleto: data.display_name,
          enderecoResumido: partes.slice(0, 3).join(', ') || 'Localização obtida',
          bairro: addr.suburb || addr.neighbourhood || '',
          cidade: addr.city || addr.town || addr.village || '',
          estado: addr.state || ''
        };
      }
      return null;
    } catch (error) {
      console.error('Erro na geocodificação reversa:', error);
      return null;
    }
  };

  const fetchPresencaHoje = useCallback(async () => {
    try {
      const hoje = new Date().toISOString().split('T')[0];
      const res = await fetch(`${API_URL}/presencas?funcionario_id=${funcionarioSelecionado}&data_inicio=${hoje}&data_fim=${hoje}`);
      const data = await res.json();
      setPresencaHoje(data[0] || null);
    } catch (error) {
      console.error('Erro:', error);
    }
  }, [funcionarioSelecionado]);

  const fetchHistorico = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/localizacao/historico/${funcionarioSelecionado}`);
      setHistorico(await res.json());
    } catch (error) {
      console.error('Erro:', error);
    }
  }, [funcionarioSelecionado]);

  const fetchDados = async () => {
    try {
      const [funcRes, hospRes] = await Promise.all([
        fetch(`${API_URL}/funcionarios`),
        fetch(`${API_URL}/hospitais`)
      ]);
      setFuncionarios(await funcRes.json());
      const hospitaisData = await hospRes.json();
      setHospitais(hospitaisData);

      // Buscar endereços amigáveis para os hospitais
      const enderecos = {};
      for (const hospital of hospitaisData) {
        if (hospital.latitude && hospital.longitude) {
          const endereco = await geocodificarReverso(hospital.latitude, hospital.longitude);
          if (endereco) {
            enderecos[hospital.id] = endereco;
          }
        }
      }
      setEnderecosHospitais(enderecos);
    } catch (error) {
      console.error('Erro:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDados();
  }, []);

  useEffect(() => {
    if (funcionarioSelecionado) {
      fetchPresencaHoje();
      fetchHistorico();
    }
  }, [funcionarioSelecionado, fetchPresencaHoje, fetchHistorico]);

  const obterLocalizacao = () => {
    setCarregandoLocalizacao(true);
    setEnderecoAtual(null);

    if (!navigator.geolocation) {
      alert('Geolocalização não suportada pelo navegador');
      setCarregandoLocalizacao(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;

        setLocalizacao({
          latitude: lat,
          longitude: lng,
          accuracy: position.coords.accuracy
        });

        // Buscar endereço amigável
        const endereco = await geocodificarReverso(lat, lng);
        setEnderecoAtual(endereco);

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

  // Check-in via código manual
  const fazerCheckInCodigo = async () => {
    if (!codigoManual.trim()) {
      alert('Por favor, digite o código');
      return;
    }

    try {
      const res = await fetch(`${API_URL}/checkin/codigo-manual`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          funcionario_id: funcionarioSelecionado,
          codigo: codigoManual.trim().toUpperCase()
        })
      });
      const data = await res.json();

      if (data.success) {
        alert(`✅ Check-in realizado via código!\n\n` +
          `🏥 Hospital: ${data.hospital}\n` +
          `⏰ Hora: ${data.hora}\n` +
          `📝 Status: ${data.status?.toUpperCase() || 'REGISTRADO'}`);
        setShowQRGenerator(false);
        setCodigoManual('');
        fetchPresencaHoje();
        fetchHistorico();
      } else {
        alert(data.error || 'Código inválido ou expirado');
      }
    } catch (error) {
      console.error('Erro:', error);
      alert('Erro ao fazer check-in');
    }
  };

  // Check-in via QR Code escaneado
  const fazerCheckInQR = async (codigoQR) => {
    try {
      const res = await fetch(`${API_URL}/checkin/qrcode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          funcionario_id: funcionarioSelecionado,
          codigo_qr: codigoQR
        })
      });
      const data = await res.json();

      if (data.success) {
        alert(`✅ Check-in realizado via QR Code!\n\n` +
          `🏥 Hospital: ${data.hospital}\n` +
          `⏰ Hora: ${data.hora}`);
        setShowQRScanner(false);
        stopCamera();
        fetchPresencaHoje();
        fetchHistorico();
      } else {
        alert(data.error || 'QR Code inválido');
      }
    } catch (error) {
      console.error('Erro:', error);
      alert('Erro ao fazer check-in');
    }
  };

  // Iniciar câmera para escanear QR
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (error) {
      console.error('Erro ao acessar câmera:', error);
      alert('Não foi possível acessar a câmera. Verifique as permissões.');
    }
  };

  // Parar câmera
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  // Efeito para iniciar/parar câmera
  useEffect(() => {
    if (showQRScanner) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [showQRScanner]);

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
            <label className="form-label">Selecione o Médico/Colaborador</label>
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
            <div style={{ flex: 1 }}>
              <p className="font-semibold">📍 Localização obtida!</p>
              {enderecoAtual ? (
                <>
                  <p className="text-sm" style={{ fontWeight: 500 }}>
                    {enderecoAtual.enderecoResumido}
                  </p>
                  {enderecoAtual.cidade && enderecoAtual.estado && (
                    <p className="text-xs text-secondary">
                      {enderecoAtual.cidade}, {enderecoAtual.estado}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-sm">Buscando endereço...</p>
              )}
              <p className="text-xs text-secondary" style={{ marginTop: '4px' }}>
                Precisão: {localizacao.accuracy?.toFixed(0) || '?'}m
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

          {/* Modo de Check-in */}
          <div className="card mb-3">
            <div className="card-header">
              <h2 className="card-title">Modo de Check-in</h2>
            </div>
            
            <div className="flex gap-2 mb-3">
              <button
                className={`btn ${modoCheckin === 'gps' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setModoCheckin('gps')}
              >
                <MapPin size={18} />
                GPS (Localização)
              </button>
              <button
                className={`btn ${modoCheckin === 'qrcode' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setModoCheckin('qrcode')}
              >
                <QrCode size={18} />
                QR Code / Código
              </button>
            </div>

            {modoCheckin === 'qrcode' && (
              <div className="alert alert-info">
                <QrCode size={20} />
                <div>
                  <p className="font-semibold">Check-in via QR Code ou Código Manual</p>
                  <p className="text-sm">
                    Escaneie o QR Code do hospital ou digite o código diário para registrar presença.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Botões de Ação */}
          <div className="card mb-3">
            <div className="card-header">
              <h2 className="card-title">Ações</h2>
            </div>

            <div className="flex flex-wrap gap-2">
              {!presencaHoje?.hora_entrada && presencaHoje && (
                <>
                  {modoCheckin === 'gps' ? (
                    <button
                      className="btn btn-success"
                      onClick={fazerCheckIn}
                      disabled={!localizacao}
                    >
                      <LogIn size={20} />
                      Fazer Check-in (GPS)
                    </button>
                  ) : (
                    <>
                      <button
                        className="btn btn-success"
                        onClick={() => setShowQRScanner(true)}
                      >
                        <Camera size={20} />
                        Escanear QR Code
                      </button>
                      <button
                        className="btn btn-primary"
                        onClick={() => setShowQRGenerator(true)}
                      >
                        <Scan size={20} />
                        Digitar Código Manual
                      </button>
                    </>
                  )}
                </>
              )}

              {presencaHoje?.hora_entrada && !presencaHoje?.hora_saida && (
                <>
                  <button
                    className="btn btn-danger"
                    onClick={() => fazerCheckOut(false)}
                    disabled={modoCheckin === 'gps' && !localizacao}
                  >
                    <LogOut size={20} />
                    Fazer Check-out
                  </button>

                  <button
                    className="btn btn-warning"
                    onClick={() => setShowModalHoraExtra(true)}
                    disabled={modoCheckin === 'gps' && !localizacao}
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
          
          {/* Seção para Gestores - Gerar Código QR */}
          <div className="card mb-3">
            <div className="card-header">
              <h2 className="card-title">
                <QrCode size={20} />
                Gerar Código para Check-in (Gestores)
              </h2>
            </div>
            
            <div className="form-group">
              <label className="form-label">Selecione o Hospital</label>
              <select
                className="form-select"
                onChange={async (e) => {
                  if (e.target.value) {
                    try {
                      const res = await fetch(`${API_URL}/hospitais/${e.target.value}/codigo-diario`);
                      const data = await res.json();
                      setQrCodeData(data);
                    } catch (error) {
                      console.error('Erro:', error);
                    }
                  } else {
                    setQrCodeData(null);
                  }
                }}
              >
                <option value="">Selecione...</option>
                {hospitais.map(h => (
                  <option key={h.id} value={h.id}>{h.nome}</option>
                ))}
              </select>
            </div>
            
            {qrCodeData && (
              <div className="alert alert-success mt-3">
                <div style={{ textAlign: 'center', width: '100%' }}>
                  <p className="font-semibold text-xl mb-2">🏥 {qrCodeData.hospital}</p>
                  <div style={{ 
                    fontSize: '3rem', 
                    fontWeight: 'bold', 
                    fontFamily: 'monospace',
                    backgroundColor: 'var(--background-primary)',
                    padding: '20px',
                    borderRadius: '12px',
                    letterSpacing: '4px',
                    marginBottom: '10px'
                  }}>
                    {qrCodeData.codigo}
                  </div>
                  <p className="text-sm">📅 Válido em: {qrCodeData.data}</p>
                  <p className="text-xs text-secondary">Válido até {qrCodeData.valido_ate}</p>
                </div>
              </div>
            )}
          </div>

          {/* Hospitais */}
          <div className="grid-2">
            <div className="card">
              <div className="card-header">
                <h2 className="card-title">Hospitais Cadastrados</h2>
              </div>

              {hospitais.map(h => {
                const endHosp = enderecosHospitais[h.id];
                return (
                  <div key={h.id} className="notification-item" style={{ borderBottom: '1px solid var(--border)' }}>
                    <div className="flex items-center gap-2">
                      <MapPin className="text-primary" size={20} />
                      <div>
                        <p className="font-semibold">🏥 {h.nome}</p>
                        <p className="text-sm text-secondary">
                          {endHosp ? endHosp.enderecoResumido : (h.endereco || 'Carregando endereço...')}
                        </p>
                        {endHosp && endHosp.cidade && (
                          <p className="text-xs text-secondary">
                            {endHosp.cidade}, {endHosp.estado}
                          </p>
                        )}
                        <p className="text-xs" style={{ color: 'var(--primary)', marginTop: '4px' }}>
                          📍 Raio de cobertura: {h.raio_metros}m
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
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

      {/* Modal Código Manual */}
      {showQRGenerator && (
        <div className="modal-overlay" onClick={() => setShowQRGenerator(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">
                <Scan size={20} />
                Digitar Código de Check-in
              </h2>
              <button className="modal-close" onClick={() => setShowQRGenerator(false)}>
                <XCircle size={24} />
              </button>
            </div>

            <div className="alert alert-info mb-3">
              <QrCode size={20} />
              <div>
                <p className="font-semibold">Código Diário do Hospital</p>
                <p className="text-sm">
                  Digite o código exibido no painel do hospital ou informado pelo gestor.
                </p>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Código de Check-in</label>
              <input
                type="text"
                className="form-input"
                value={codigoManual}
                onChange={e => setCodigoManual(e.target.value.toUpperCase())}
                placeholder="Ex: SANT2301"
                style={{ 
                  fontSize: '1.5rem', 
                  textAlign: 'center', 
                  fontFamily: 'monospace',
                  letterSpacing: '3px'
                }}
                maxLength={10}
              />
              <p className="text-xs text-secondary mt-1">
                O código tem formato: [4 letras do hospital] + [DDMM]
              </p>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowQRGenerator(false)}>
                Cancelar
              </button>
              <button
                className="btn btn-success"
                onClick={fazerCheckInCodigo}
                disabled={codigoManual.length < 6}
              >
                <LogIn size={18} />
                Fazer Check-in
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Scanner QR Code */}
      {showQRScanner && (
        <div className="modal-overlay" onClick={() => { setShowQRScanner(false); stopCamera(); }}>
          <div className="modal" style={{ maxWidth: '500px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">
                <Camera size={20} />
                Escanear QR Code
              </h2>
              <button className="modal-close" onClick={() => { setShowQRScanner(false); stopCamera(); }}>
                <XCircle size={24} />
              </button>
            </div>

            <div className="alert alert-info mb-3">
              <QrCode size={20} />
              <span>Aponte a câmera para o QR Code do hospital</span>
            </div>

            <div style={{ 
              position: 'relative', 
              width: '100%', 
              paddingTop: '100%',
              backgroundColor: '#000',
              borderRadius: '12px',
              overflow: 'hidden'
            }}>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover'
                }}
              />
              <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: '200px',
                height: '200px',
                border: '3px solid var(--primary)',
                borderRadius: '12px',
                boxShadow: '0 0 0 9999px rgba(0,0,0,0.5)'
              }} />
            </div>

            <p className="text-center text-secondary mt-3">
              Posicione o QR Code dentro da área destacada
            </p>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => { setShowQRScanner(false); stopCamera(); }}>
                Cancelar
              </button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  setShowQRScanner(false);
                  stopCamera();
                  setShowQRGenerator(true);
                }}
              >
                <Scan size={18} />
                Digitar Código Manualmente
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CheckIn;
