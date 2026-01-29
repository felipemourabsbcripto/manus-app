import { useState, useEffect, useCallback } from 'react';
import { 
  Bell, AlertTriangle, XCircle, AlertCircle, CheckCircle,
  Clock, Check, CheckCheck, Trash2
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { API_URL } from '../config';

function Avisos() {
  const [avisos, setAvisos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState('todos');

  const fetchAvisos = useCallback(async () => {
    try {
      let url = `${API_URL}/avisos`;
      if (filtro === 'nao_lidos') url += '?lido=false';
      if (filtro === 'lidos') url += '?lido=true';
      
      const res = await fetch(url);
      const data = await res.json();
      setAvisos(data);
    } catch (error) {
      console.error('Erro ao buscar avisos:', error);
    } finally {
      setLoading(false);
    }
  }, [filtro]);

  useEffect(() => {
    fetchAvisos();
  }, [fetchAvisos]);

  const marcarComoLido = async (id) => {
    try {
      await fetch(`${API_URL}/avisos/${id}/lido`, { method: 'PUT' });
      fetchAvisos();
    } catch (error) {
      console.error('Erro ao marcar como lido:', error);
    }
  };

  const marcarTodosComoLidos = async () => {
    try {
      await fetch(`${API_URL}/avisos/marcar-todos-lidos`, { method: 'PUT' });
      fetchAvisos();
    } catch (error) {
      console.error('Erro ao marcar todos como lidos:', error);
    }
  };

  const getIconeTipo = (tipo) => {
    switch (tipo) {
      case 'furo': return <XCircle size={24} className="text-danger" />;
      case 'atraso': return <AlertCircle size={24} className="text-warning" />;
      case 'alerta': return <AlertTriangle size={24} className="text-warning" />;
      default: return <Bell size={24} className="text-info" />;
    }
  };

  const getTipoBadge = (tipo) => {
    const tipos = {
      furo: { class: 'badge-danger', text: 'Ausência' },
      atraso: { class: 'badge-warning', text: 'Atraso' },
      falta: { class: 'badge-danger', text: 'Ausência' },
      alerta: { class: 'badge-warning', text: 'Alerta' },
      info: { class: 'badge-info', text: 'Info' }
    };
    const config = tipos[tipo] || tipos.info;
    return <span className={`badge ${config.class}`}>{config.text}</span>;
  };

  const naoLidos = avisos.filter(a => !a.lido).length;

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
          <h1 className="page-title">Avisos e Notificações</h1>
          <p className="page-subtitle">
            {naoLidos > 0 ? `${naoLidos} avisos não lidos` : 'Todos os avisos foram lidos'}
          </p>
        </div>
        {naoLidos > 0 && (
          <button className="btn btn-primary" onClick={marcarTodosComoLidos}>
            <CheckCheck size={20} />
            Marcar Todos como Lidos
          </button>
        )}
      </div>

      {/* Estatísticas */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon blue">
            <Bell size={24} />
          </div>
          <div className="stat-info">
            <h3>{avisos.length}</h3>
            <p>Total de Avisos</p>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon yellow">
            <Clock size={24} />
          </div>
          <div className="stat-info">
            <h3>{naoLidos}</h3>
            <p>Não Lidos</p>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon red">
            <XCircle size={24} />
          </div>
          <div className="stat-info">
            <h3>{avisos.filter(a => a.tipo === 'furo' || a.tipo === 'falta').length}</h3>
            <p>Ausências Reportadas</p>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon yellow">
            <AlertCircle size={24} />
          </div>
          <div className="stat-info">
            <h3>{avisos.filter(a => a.tipo === 'atraso').length}</h3>
            <p>Atrasos Reportados</p>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="card mb-3">
        <div className="flex items-center gap-2">
          <span className="text-secondary">Filtrar:</span>
          <div className="tabs" style={{ marginBottom: 0, borderBottom: 'none', paddingBottom: 0 }}>
            <button 
              className={`tab ${filtro === 'todos' ? 'active' : ''}`}
              onClick={() => setFiltro('todos')}
            >
              Todos
            </button>
            <button 
              className={`tab ${filtro === 'nao_lidos' ? 'active' : ''}`}
              onClick={() => setFiltro('nao_lidos')}
            >
              Não Lidos ({naoLidos})
            </button>
            <button 
              className={`tab ${filtro === 'lidos' ? 'active' : ''}`}
              onClick={() => setFiltro('lidos')}
            >
              Lidos
            </button>
          </div>
        </div>
      </div>

      {/* Lista de Avisos */}
      <div className="card">
        {avisos.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {avisos.map(aviso => (
              <div 
                key={aviso.id} 
                className={`notification-item ${!aviso.lido ? 'unread' : ''}`}
                style={{ 
                  borderRadius: '0.5rem',
                  border: '1px solid var(--border)',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '1rem'
                }}
              >
                <div style={{ flexShrink: 0 }}>
                  {getIconeTipo(aviso.tipo)}
                </div>
                
                <div style={{ flex: 1 }}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold">{aviso.titulo}</span>
                    {getTipoBadge(aviso.tipo)}
                    {!aviso.lido && (
                      <span className="badge badge-info" style={{ fontSize: '0.65rem' }}>NOVO</span>
                    )}
                  </div>
                  
                  <p className="text-secondary mb-2">{aviso.mensagem}</p>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-secondary">
                      <Clock size={14} />
                      <span>
                        {formatDistanceToNow(new Date(aviso.data_criacao), { 
                          addSuffix: true, 
                          locale: ptBR 
                        })}
                      </span>
                      {aviso.funcionario_nome && (
                        <>
                          <span>•</span>
                          <span>{aviso.funcionario_nome}</span>
                        </>
                      )}
                    </div>
                    
                    {!aviso.lido && (
                      <button 
                        className="btn btn-secondary btn-sm"
                        onClick={() => marcarComoLido(aviso.id)}
                      >
                        <Check size={14} />
                        Marcar como Lido
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <CheckCircle size={64} />
            <p>Nenhum aviso encontrado</p>
            <span className="text-secondary">Você está em dia com as notificações!</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default Avisos;
