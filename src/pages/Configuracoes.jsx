import { useState, useEffect } from 'react';
import { Settings, Save, Clock, DollarSign, Bell, AlertTriangle } from 'lucide-react';
import { API_URL } from '../config';

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

  useEffect(() => {
    fetchConfiguracoes();
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
                Notificações
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
