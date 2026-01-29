import { useState, useEffect } from 'react';
import { 
  Clock, CheckCircle, XCircle, AlertCircle, Calendar, 
  LogIn, LogOut, RefreshCw, User
} from 'lucide-react';
import { format, subDays } from 'date-fns';
import { API_URL } from '../config';

function Presencas() {
  const [presencas, setPresencas] = useState([]);
  const [funcionarios, setFuncionarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtros, setFiltros] = useState({
    data_inicio: format(subDays(new Date(), 7), 'yyyy-MM-dd'),
    data_fim: format(new Date(), 'yyyy-MM-dd'),
    funcionario_id: '',
    status: ''
  });

  useEffect(() => {
    fetchDados();
  }, [filtros]);

  const fetchDados = async () => {
    try {
      let url = `${API_URL}/presencas?data_inicio=${filtros.data_inicio}&data_fim=${filtros.data_fim}`;
      if (filtros.funcionario_id) url += `&funcionario_id=${filtros.funcionario_id}`;
      if (filtros.status) url += `&status=${filtros.status}`;

      const [presRes, funcRes] = await Promise.all([
        fetch(url),
        fetch(`${API_URL}/funcionarios`)
      ]);

      setPresencas(await presRes.json());
      setFuncionarios(await funcRes.json());
    } catch (error) {
      console.error('Erro ao buscar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const registrarPonto = async (funcionario_id, tipo) => {
    try {
      const res = await fetch(`${API_URL}/presencas/registrar-ponto`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ funcionario_id, tipo })
      });
      const data = await res.json();
      if (data.success) {
        alert(`Ponto de ${tipo} registrado às ${data.hora}`);
        fetchDados();
      } else {
        alert(data.error || 'Erro ao registrar ponto');
      }
    } catch (error) {
      console.error('Erro ao registrar ponto:', error);
      alert('Erro ao registrar ponto');
    }
  };

  const atualizarStatus = async (id, status, justificativa = '') => {
    try {
      await fetch(`${API_URL}/presencas/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, justificativa })
      });
      fetchDados();
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
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

  const verificarFuros = async () => {
    try {
      const res = await fetch(`${API_URL}/presencas/verificar-furos`, { method: 'POST' });
      const data = await res.json();
      alert(`${data.furos_detectados} furos detectados`);
      fetchDados();
    } catch (error) {
      console.error('Erro ao verificar furos:', error);
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
          <h1 className="page-title">Controle de Plantões</h1>
          <p className="page-subtitle">Registrar e monitorar a presença dos colaboradores</p>
        </div>
        <button className="btn btn-warning" onClick={verificarFuros}>
          <RefreshCw size={20} />
          Verificar Atrasos
        </button>
      </div>

      {/* Registro Rápido de Ponto */}
      <div className="card mb-3">
        <div className="card-header">
          <h2 className="card-title">Registro Rápido de Ponto</h2>
          <Clock size={20} className="text-secondary" />
        </div>
        <div className="flex flex-wrap gap-2">
          {funcionarios.map(func => (
            <div key={func.id} className="flex items-center gap-2" style={{ 
              background: 'var(--bg-tertiary)', 
              padding: '0.5rem 1rem', 
              borderRadius: '0.5rem' 
            }}>
              <User size={16} className="text-secondary" />
              <span>{func.nome}</span>
              <button 
                className="btn btn-success btn-sm"
                onClick={() => registrarPonto(func.id, 'entrada')}
              >
                <LogIn size={14} />
                Entrada
              </button>
              <button 
                className="btn btn-secondary btn-sm"
                onClick={() => registrarPonto(func.id, 'saida')}
              >
                <LogOut size={14} />
                Saída
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Filtros */}
      <div className="card mb-3">
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Data Inicial</label>
            <input
              type="date"
              className="form-input"
              value={filtros.data_inicio}
              onChange={e => setFiltros({ ...filtros, data_inicio: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Data Final</label>
            <input
              type="date"
              className="form-input"
              value={filtros.data_fim}
              onChange={e => setFiltros({ ...filtros, data_fim: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Colaborador</label>
            <select
              className="form-select"
              value={filtros.funcionario_id}
              onChange={e => setFiltros({ ...filtros, funcionario_id: e.target.value })}
            >
              <option value="">Todos</option>
              {funcionarios.map(f => (
                <option key={f.id} value={f.id}>{f.nome}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Status</label>
            <select
              className="form-select"
              value={filtros.status}
              onChange={e => setFiltros({ ...filtros, status: e.target.value })}
            >
              <option value="">Todos</option>
              <option value="presente">Presente</option>
              <option value="atraso">Atraso</option>
              <option value="falta">Ausência</option>
              <option value="pendente">Pendente</option>
            </select>
          </div>
        </div>
      </div>

      {/* Lista de Presenças */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Registro de Presenças</h2>
          <span className="text-secondary">{presencas.length} registros</span>
        </div>

        {presencas.length > 0 ? (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Colaborador</th>
                  <th>Horário Esperado</th>
                  <th>Entrada</th>
                  <th>Saída</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {presencas.map(presenca => (
                  <tr key={presenca.id}>
                    <td>{format(new Date(presenca.data + 'T00:00:00'), 'dd/MM/yyyy')}</td>
                    <td>{presenca.funcionario_nome}</td>
                    <td>{presenca.hora_esperada_inicio} - {presenca.hora_esperada_fim}</td>
                    <td>{presenca.hora_entrada || '-'}</td>
                    <td>{presenca.hora_saida || '-'}</td>
                    <td>{getStatusBadge(presenca.status)}</td>
                    <td>
                      <div className="action-buttons">
                        <select
                          className="form-select"
                          value={presenca.status}
                          onChange={e => {
                            if (e.target.value === 'falta') {
                              const justificativa = prompt('Justificativa (opcional):');
                              atualizarStatus(presenca.id, e.target.value, justificativa || '');
                            } else {
                              atualizarStatus(presenca.id, e.target.value);
                            }
                          }}
                          style={{ width: 'auto', minWidth: '120px' }}
                        >
                          <option value="pendente">Pendente</option>
                          <option value="presente">Presente</option>
                          <option value="atraso">Atraso</option>
                          <option value="furo">Furo</option>
                          <option value="falta">Falta</option>
                        </select>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <Calendar size={64} />
            <p>Nenhum registro encontrado para o período</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default Presencas;
