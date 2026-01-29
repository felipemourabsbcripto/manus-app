import { useState, useEffect } from 'react';
import { Settings, Save, Clock, DollarSign, Bell, AlertTriangle, Smartphone, Download } from 'lucide-react';
import { API_URL } from '../config';
import { 
  isPushSupported, 
  getNotificationPermission, 
  requestNotificationPermission,
  showLocalNotification 
} from '../utils/notifications';

function Configuracoes() {
  const [config, setConfig] = useState({
    tolerancia_atraso_minutos: '15',
    horas_extras_multiplicador: '1.5',
    desconto_furo_percentual: '5',
    email_notificacao: '',
    notificar_furos: '1',
    notificar_escalas: '1'
  });
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState(null);
  const [notificationPermission, setNotificationPermission] = useState('default');
  const [pwaInstalled, setPwaInstalled] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);

  useEffect(() => {
    fetchConfiguracoes();
    
    // Verificar permissão de notificações
    if (isPushSupported()) {
      setNotificationPermission(getNotificationPermission());
    }
    
    // Verificar se PWA está instalado
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setPwaInstalled(true);
    }
    
    // Capturar evento de instalação PWA
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const fetchConfiguracoes = async () => {
    try {
      const res = await fetch(`${API_URL}/configuracoes`);
      const data = await res.json();
      setConfig(data);
    } catch (error) {
      console.error('Erro ao buscar configurações:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestNotifications = async () => {
    const granted = await requestNotificationPermission();
    setNotificationPermission(granted ? 'granted' : 'denied');
    
    if (granted) {
      showLocalNotification('✅ Notificações Ativadas!', {
        body: 'Você receberá alertas de escalas e lembretes.',
        tag: 'permission-granted'
      });
    }
  };

  const handleInstallPWA = async () => {
    if (!deferredPrompt) {
      alert('Para instalar, use a opção "Adicionar à tela inicial" no menu do navegador.');
      return;
    }
    
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setPwaInstalled(true);
      setDeferredPrompt(null);
    }
  };

  const handleTestNotification = () => {
    showLocalNotification('🧪 Teste de Notificação', {
      body: 'Se você está vendo isto, as notificações estão funcionando!',
      tag: 'test-notification'
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSalvando(true);
    setMensagem(null);
    
    try {
      await fetch(`${API_URL}/configuracoes`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      setMensagem({ tipo: 'success', texto: 'Configurações salvas com sucesso!' });
    } catch (error) {
      console.error('Erro ao salvar configurações:', error);
      setMensagem({ tipo: 'danger', texto: 'Erro ao salvar configurações.' });
    } finally {
      setSalvando(false);
    }
  };

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Configurações</h1>
          <p className="page-subtitle">Configurar as regras do sistema</p>
        </div>
      </div>

      {mensagem && (
        <div className={`alert alert-${mensagem.tipo}`}>
          {mensagem.tipo === 'success' ? <Save size={20} /> : <AlertTriangle size={20} />}
          {mensagem.texto}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="grid-2">
          {/* Controle de Ponto */}
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">
                <Clock size={20} className="mr-2" />
                Controle de Ponto
              </h2>
            </div>
            
            <div className="form-group">
              <label className="form-label">Tolerância para Atraso (minutos)</label>
              <input
                type="number"
                className="form-input"
                value={config.tolerancia_atraso_minutos}
                onChange={e => setConfig({ ...config, tolerancia_atraso_minutos: e.target.value })}
                min="0"
                max="60"
              />
              <small className="text-secondary">
                Tempo de tolerância antes de considerar como atraso
              </small>
            </div>
          </div>

          {/* Pagamentos */}
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">
                <DollarSign size={20} className="mr-2" />
                Pagamentos
              </h2>
            </div>
            
            <div className="form-group">
              <label className="form-label">Multiplicador Horas Extras</label>
              <input
                type="number"
                step="0.1"
                className="form-input"
                value={config.horas_extras_multiplicador}
                onChange={e => setConfig({ ...config, horas_extras_multiplicador: e.target.value })}
                min="1"
                max="3"
              />
              <small className="text-secondary">
                Ex: 1.5 = 50% a mais por hora extra
              </small>
            </div>
            
            <div className="form-group">
              <label className="form-label">Desconto por Furo (%)</label>
              <input
                type="number"
                step="0.5"
                className="form-input"
                value={config.desconto_furo_percentual}
                onChange={e => setConfig({ ...config, desconto_furo_percentual: e.target.value })}
                min="0"
                max="100"
              />
              <small className="text-secondary">
                Percentual do dia a ser descontado por furo não justificado
              </small>
            </div>
          </div>

          {/* Notificações */}
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">
                <Bell size={20} className="mr-2" />
                Notificações por Email
              </h2>
            </div>
            
            <div className="form-group">
              <label className="form-label">Email para Notificações</label>
              <input
                type="email"
                className="form-input"
                value={config.email_notificacao}
                onChange={e => setConfig({ ...config, email_notificacao: e.target.value })}
                placeholder="seu@email.com"
              />
              <small className="text-secondary">
                Email para receber alertas importantes (opcional)
              </small>
            </div>
            
            <div className="form-group">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={config.notificar_furos === '1'}
                  onChange={e => setConfig({ 
                    ...config, 
                    notificar_furos: e.target.checked ? '1' : '0' 
                  })}
                />
                <span>Notificar quando houver furos</span>
              </label>
            </div>
            
            <div className="form-group">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={config.notificar_escalas === '1'}
                  onChange={e => setConfig({ 
                    ...config, 
                    notificar_escalas: e.target.checked ? '1' : '0' 
                  })}
                />
                <span>Notificar sobre novas escalas</span>
              </label>
            </div>
          </div>

          {/* Push Notifications / PWA */}
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">
                <Smartphone size={20} className="mr-2" />
                App & Push Notifications
              </h2>
            </div>
            
            {/* Status PWA */}
            <div className="mb-3 p-3" style={{ backgroundColor: 'var(--background-primary)', borderRadius: '8px' }}>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="font-semibold">📱 Instalar App</p>
                  <p className="text-xs text-secondary">
                    {pwaInstalled 
                      ? '✅ App instalado no dispositivo' 
                      : 'Instale o app para acesso rápido'}
                  </p>
                </div>
                {!pwaInstalled && (
                  <button 
                    className="btn btn-primary" 
                    onClick={handleInstallPWA}
                    style={{ fontSize: '0.85rem', padding: '0.5rem 1rem' }}
                  >
                    <Download size={16} />
                    Instalar
                  </button>
                )}
              </div>
            </div>

            {/* Status Push Notifications */}
            {isPushSupported() ? (
              <div className="mb-3 p-3" style={{ backgroundColor: 'var(--background-primary)', borderRadius: '8px' }}>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="font-semibold">🔔 Push Notifications</p>
                    <p className="text-xs text-secondary">
                      {notificationPermission === 'granted' 
                        ? '✅ Notificações ativadas' 
                        : notificationPermission === 'denied'
                          ? '❌ Notificações bloqueadas (altere nas configurações do navegador)'
                          : 'Receba alertas mesmo com o app fechado'}
                    </p>
                  </div>
                  {notificationPermission === 'default' && (
                    <button 
                      className="btn btn-primary" 
                      onClick={handleRequestNotifications}
                      style={{ fontSize: '0.85rem', padding: '0.5rem 1rem' }}
                    >
                      <Bell size={16} />
                      Ativar
                    </button>
                  )}
                  {notificationPermission === 'granted' && (
                    <button 
                      className="btn btn-secondary" 
                      onClick={handleTestNotification}
                      style={{ fontSize: '0.85rem', padding: '0.5rem 1rem' }}
                    >
                      🧪 Testar
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="alert alert-warning">
                <AlertTriangle size={20} />
                <span>Push notifications não são suportadas neste navegador</span>
              </div>
            )}

            <div className="text-sm text-secondary">
              <p className="font-semibold mb-1">Você receberá notificações sobre:</p>
              <ul style={{ marginLeft: '1rem', listStyle: 'disc' }}>
                <li>Lembretes de plantão (1 hora antes)</li>
                <li>Novas escalas atribuídas</li>
                <li>Propostas de troca de plantão</li>
                <li>Alertas de furos (para gestores)</li>
              </ul>
            </div>
          </div>

          {/* Informações do Sistema */}
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">
                <Settings size={20} className="mr-2" />
                Sobre o Sistema
              </h2>
            </div>
            
            <div className="mb-2">
              <p className="text-secondary text-sm">Versão</p>
              <p className="font-semibold">EscalaPro v1.0.0</p>
            </div>
            
            <div className="mb-2">
              <p className="text-secondary text-sm">Desenvolvido por</p>
              <p className="font-semibold">Sistema de Gestão de Escalas</p>
            </div>
            
            <div className="mb-2">
              <p className="text-secondary text-sm">Funcionalidades</p>
              <ul className="text-sm text-secondary" style={{ marginLeft: '1rem', listStyle: 'disc' }}>
                <li>Gestão de colaboradores</li>
                <li>Controle de escalas automatizado</li>
                <li>Registro de presenças e furos</li>
                <li>Sistema de notas e avaliações</li>
                <li>Controle de pagamentos</li>
                <li>Notificações automáticas</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="flex justify-end mt-3">
          <button 
            type="submit" 
            className="btn btn-primary"
            disabled={salvando}
          >
            <Save size={20} />
            {salvando ? 'Salvando...' : 'Salvar Configurações'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default Configuracoes;
