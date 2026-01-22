import { useState, useEffect } from 'react';
import { 
  AlertTriangle, XCircle, AlertCircle, Calendar, CheckCircle,
  Phone, MessageSquare, FileText, X
} from 'lucide-react';
import { format, subDays } from 'date-fns';
import { API_URL } from '../config';

function Furos() {
  const [furos, setFuros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [furoSelecionado, setFuroSelecionado] = useState(null);
  const [filtros, setFiltros] = useState({
    data_inicio: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
    data_fim: format(new Date(), 'yyyy-MM-dd')
  });
  const [estatisticas, setEstatisticas] = useState({
    total: 0,
    furos: 0,
    faltas: 0,
    atrasos: 0
  });

  useEffect(() => {
    fetchFuros();
  }, [filtros]);

  const fetchFuros = async () => {
    try {
      const res = await fetch(
        `${API_URL}/furos?data_inicio=${filtros.data_inicio}&data_fim=${filtros.data_fim}`
      );
      const data = await res.json();
      setFuros(data);
      
      // Calcular estatísticas
      setEstatisticas({
        total: data.length,
        furos: data.filter(f => f.status === 'furo').length,
        faltas: data.filter(f => f.status === 'falta').length,
        atrasos: data.filter(f => f.status === 'atraso').length
      });
    } catch (error) {
      console.error('Erro ao buscar furos:', error);
    } finally {
      setLoading(false);
    }
  };

  const atualizarFuro = async (id, dados) => {
    try {
      await fetch(`${API_URL}/presencas/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dados)
      });
      fetchFuros();
      setShowModal(false);
    } catch (error) {
      console.error('Erro ao atualizar furo:', error);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'furo': return <XCircle size={20} className="text-danger" />;
      case 'falta': return <XCircle size={20} className="text-danger" />;
      case 'atraso': return <AlertCircle size={20} className="text-warning" />;
      default: return <AlertTriangle size={20} />;
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      furo: { class: 'badge-danger', text: 'Furo' },
      falta: { class: 'badge-danger', text: 'Falta' },
      atraso: { class: 'badge-warning', text: 'Atraso' }
    };
    const config = statusConfig[status] || { class: 'badge-secondary', text: status };
    return <span className={`badge ${config.class}`}>{config.text}</span>;
  };

  const abrirDetalhes = (furo) => {
    setFuroSelecionado(furo);
    setShowModal(true);
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
          <h1 className="page-title">Controle de Furos</h1>
          <p className="page-subtitle">Monitore e gerencie ausências e atrasos</p>
        </div>
      </div>

      {/* Estatísticas */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon red">
            <AlertTriangle size={24} />
          </div>
          <div className="stat-info">
            <h3>{estatisticas.total}</h3>
            <p>Total de Ocorrências</p>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon red">
            <XCircle size={24} />
          </div>
          <div className="stat-info">
            <h3>{estatisticas.furos}</h3>
            <p>Furos</p>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon red">
            <XCircle size={24} />
          </div>
          <div className="stat-info">
            <h3>{estatisticas.faltas}</h3>
            <p>Faltas</p>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon yellow">
            <AlertCircle size={24} />
          </div>
          <div className="stat-info">
            <h3>{estatisticas.atrasos}</h3>
            <p>Atrasos</p>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="card mb-3">
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Data Início</label>
            <input
              type="date"
              className="form-input"
              value={filtros.data_inicio}
              onChange={e => setFiltros({ ...filtros, data_inicio: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Data Fim</label>
            <input
              type="date"
              className="form-input"
              value={filtros.data_fim}
              onChange={e => setFiltros({ ...filtros, data_fim: e.target.value })}
            />
          </div>
        </div>
      </div>

      {/* Lista de Furos */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Ocorrências Registradas</h2>
          <span className="text-secondary">{furos.length} registros</span>
        </div>

        {furos.length > 0 ? (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Funcionário</th>
                  <th>Horário Esperado</th>
                  <th>Contato</th>
                  <th>Status</th>
                  <th>Justificativa</th>
                  <th>Aprovado</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {furos.map(furo => (
                  <tr key={furo.id}>
                    <td>{format(new Date(furo.data + 'T00:00:00'), 'dd/MM/yyyy')}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(furo.status)}
                        {furo.funcionario_nome}
                      </div>
                    </td>
                    <td>{furo.hora_esperada_inicio} - {furo.hora_esperada_fim}</td>
                    <td>
                      {furo.telefone ? (
                        <a href={`tel:${furo.telefone}`} className="flex items-center gap-1 text-primary">
                          <Phone size={14} />
                          {furo.telefone}
                        </a>
                      ) : '-'}
                    </td>
                    <td>{getStatusBadge(furo.status)}</td>
                    <td>
                      <span className="text-sm text-secondary">
                        {furo.justificativa || '-'}
                      </span>
                    </td>
                    <td>
                      {furo.aprovado ? (
                        <span className="badge badge-success">
                          <CheckCircle size={12} />
                          Sim
                        </span>
                      ) : (
                        <span className="badge badge-secondary">Não</span>
                      )}
                    </td>
                    <td>
                      <button 
                        className="btn btn-secondary btn-sm"
                        onClick={() => abrirDetalhes(furo)}
                      >
                        <FileText size={14} />
                        Detalhes
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <CheckCircle size={64} />
            <p>Nenhum furo registrado no período</p>
            <span className="text-secondary">Ótimo trabalho da equipe!</span>
          </div>
        )}
      </div>

      {/* Modal Detalhes */}
      {showModal && furoSelecionado && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Detalhes da Ocorrência</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>
                <X size={24} />
              </button>
            </div>
            
            <div className="mb-3">
              <div className="flex items-center gap-2 mb-2">
                {getStatusIcon(furoSelecionado.status)}
                <span className="font-bold">{furoSelecionado.funcionario_nome}</span>
                {getStatusBadge(furoSelecionado.status)}
              </div>
              
              <div className="grid-2" style={{ gap: '1rem' }}>
                <div>
                  <p className="text-secondary text-sm">Data</p>
                  <p>{format(new Date(furoSelecionado.data + 'T00:00:00'), 'dd/MM/yyyy')}</p>
                </div>
                <div>
                  <p className="text-secondary text-sm">Horário Esperado</p>
                  <p>{furoSelecionado.hora_esperada_inicio} - {furoSelecionado.hora_esperada_fim}</p>
                </div>
                <div>
                  <p className="text-secondary text-sm">Telefone</p>
                  <p>{furoSelecionado.telefone || 'Não informado'}</p>
                </div>
                <div>
                  <p className="text-secondary text-sm">Status Aprovação</p>
                  <p>{furoSelecionado.aprovado ? 'Aprovado' : 'Pendente'}</p>
                </div>
              </div>
            </div>
            
            <div className="form-group">
              <label className="form-label">Justificativa</label>
              <textarea
                className="form-textarea"
                rows="3"
                value={furoSelecionado.justificativa || ''}
                onChange={e => setFuroSelecionado({
                  ...furoSelecionado,
                  justificativa: e.target.value
                })}
                placeholder="Adicione uma justificativa..."
              />
            </div>
            
            <div className="form-group">
              <label className="form-label">Alterar Status</label>
              <select
                className="form-select"
                value={furoSelecionado.status}
                onChange={e => setFuroSelecionado({
                  ...furoSelecionado,
                  status: e.target.value
                })}
              >
                <option value="furo">Furo</option>
                <option value="falta">Falta</option>
                <option value="atraso">Atraso</option>
                <option value="presente">Presente (corrigir)</option>
              </select>
            </div>
            
            <div className="modal-footer">
              {!furoSelecionado.aprovado && (
                <button 
                  className="btn btn-success"
                  onClick={() => atualizarFuro(furoSelecionado.id, {
                    ...furoSelecionado,
                    aprovado: true
                  })}
                >
                  <CheckCircle size={18} />
                  Aprovar Justificativa
                </button>
              )}
              <button 
                className="btn btn-primary"
                onClick={() => atualizarFuro(furoSelecionado.id, {
                  status: furoSelecionado.status,
                  justificativa: furoSelecionado.justificativa,
                  aprovado: furoSelecionado.aprovado
                })}
              >
                Salvar Alterações
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Furos;
