import { useState, useEffect } from 'react';
import { 
  Star, Plus, Calculator, X, User, TrendingUp, TrendingDown
} from 'lucide-react';
import { format, subMonths } from 'date-fns';
import { API_URL } from '../config';

function Notas() {
  const [notas, setNotas] = useState([]);
  const [funcionarios, setFuncionarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [notasCalculadas, setNotasCalculadas] = useState(null);
  const [form, setForm] = useState({
    funcionario_id: '',
    periodo_inicio: format(subMonths(new Date(), 1), 'yyyy-MM-dd'),
    periodo_fim: format(new Date(), 'yyyy-MM-dd'),
    pontualidade: '',
    assiduidade: '',
    desempenho: '',
    observacoes: ''
  });

  useEffect(() => {
    fetchDados();
  }, []);

  const fetchDados = async () => {
    try {
      const [notasRes, funcRes] = await Promise.all([
        fetch(`${API_URL}/notas`),
        fetch(`${API_URL}/funcionarios`)
      ]);
      setNotas(await notasRes.json());
      setFuncionarios(await funcRes.json());
    } catch (error) {
      console.error('Erro ao buscar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await fetch(`${API_URL}/notas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      setShowModal(false);
      setForm({
        funcionario_id: '',
        periodo_inicio: format(subMonths(new Date(), 1), 'yyyy-MM-dd'),
        periodo_fim: format(new Date(), 'yyyy-MM-dd'),
        pontualidade: '',
        assiduidade: '',
        desempenho: '',
        observacoes: ''
      });
      setNotasCalculadas(null);
      fetchDados();
    } catch (error) {
      console.error('Erro ao salvar nota:', error);
    }
  };

  const calcularNotas = async () => {
    if (!form.funcionario_id || !form.periodo_inicio || !form.periodo_fim) {
      alert('Selecione colaborador e período');
      return;
    }
    
    try {
      const res = await fetch(`${API_URL}/notas/calcular-automatico`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          funcionario_id: form.funcionario_id,
          periodo_inicio: form.periodo_inicio,
          periodo_fim: form.periodo_fim
        })
      });
      const data = await res.json();
      setNotasCalculadas(data);
      setForm({
        ...form,
        pontualidade: data.pontualidade,
        assiduidade: data.assiduidade,
        desempenho: data.desempenho
      });
    } catch (error) {
      console.error('Erro ao calcular notas:', error);
    }
  };

  const renderStars = (nota) => {
    const stars = [];
    const fullStars = Math.floor(nota / 2);
    const halfStar = (nota % 2) >= 1;
    
    for (let i = 0; i < 5; i++) {
      if (i < fullStars) {
        stars.push(<Star key={i} size={16} className="rating-star" fill="currentColor" />);
      } else if (i === fullStars && halfStar) {
        stars.push(<Star key={i} size={16} className="rating-star" style={{ opacity: 0.5 }} fill="currentColor" />);
      } else {
        stars.push(<Star key={i} size={16} className="rating-star empty" />);
      }
    }
    return <div className="rating">{stars}</div>;
  };

  const getNotaColor = (nota) => {
    if (nota >= 8) return 'var(--success)';
    if (nota >= 6) return 'var(--warning)';
    return 'var(--danger)';
  };

  const getMediaGeral = (nota) => {
    return ((nota.pontualidade + nota.assiduidade + nota.desempenho) / 3).toFixed(1);
  };

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
      </div>
    );
  }

  // Agrupar notas por funcionário
  const notasPorFuncionario = {};
  notas.forEach(nota => {
    if (!notasPorFuncionario[nota.funcionario_id]) {
      notasPorFuncionario[nota.funcionario_id] = [];
    }
    notasPorFuncionario[nota.funcionario_id].push(nota);
  });

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Notas e Avaliações</h1>
          <p className="page-subtitle">Avalie o desempenho dos colaboradores</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={20} />
          Nova Avaliação
        </button>
      </div>

      {/* Cards de funcionários com últimas notas */}
      <div className="grid-3" style={{ marginBottom: '1.5rem' }}>
        {funcionarios.map(func => {
          const notasFunc = notasPorFuncionario[func.id] || [];
          const ultimaNota = notasFunc[0];
          
          return (
            <div key={func.id} className="card">
              <div className="flex items-center gap-2 mb-2">
                <div className="stat-icon blue" style={{ width: '40px', height: '40px' }}>
                  <User size={20} />
                </div>
                <div>
                  <h3 className="font-semibold">{func.nome}</h3>
                  <p className="text-sm text-secondary">{func.cargo || 'Sem cargo'}</p>
                </div>
              </div>
              
              {ultimaNota ? (
                <div className="mt-2">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-secondary">Última avaliação</span>
                    <span className="text-sm">{format(new Date(ultimaNota.periodo_fim), 'MM/yyyy')}</span>
                  </div>
                  
                  <div className="mb-2">
                    <div className="flex justify-between text-sm mb-1">
                      <span>Pontualidade</span>
                      <span style={{ color: getNotaColor(ultimaNota.pontualidade) }}>
                        {ultimaNota.pontualidade.toFixed(1)}
                      </span>
                    </div>
                    <div className="progress-bar">
                      <div 
                        className="progress-fill" 
                        style={{ 
                          width: `${ultimaNota.pontualidade * 10}%`,
                          background: getNotaColor(ultimaNota.pontualidade)
                        }} 
                      />
                    </div>
                  </div>
                  
                  <div className="mb-2">
                    <div className="flex justify-between text-sm mb-1">
                      <span>Assiduidade</span>
                      <span style={{ color: getNotaColor(ultimaNota.assiduidade) }}>
                        {ultimaNota.assiduidade.toFixed(1)}
                      </span>
                    </div>
                    <div className="progress-bar">
                      <div 
                        className="progress-fill" 
                        style={{ 
                          width: `${ultimaNota.assiduidade * 10}%`,
                          background: getNotaColor(ultimaNota.assiduidade)
                        }} 
                      />
                    </div>
                  </div>
                  
                  <div className="mb-2">
                    <div className="flex justify-between text-sm mb-1">
                      <span>Desempenho</span>
                      <span style={{ color: getNotaColor(ultimaNota.desempenho) }}>
                        {ultimaNota.desempenho.toFixed(1)}
                      </span>
                    </div>
                    <div className="progress-bar">
                      <div 
                        className="progress-fill" 
                        style={{ 
                          width: `${ultimaNota.desempenho * 10}%`,
                          background: getNotaColor(ultimaNota.desempenho)
                        }} 
                      />
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center mt-3 pt-2" style={{ borderTop: '1px solid var(--border)' }}>
                    <span className="font-semibold">Média Geral</span>
                    <span 
                      className="text-xl font-bold"
                      style={{ color: getNotaColor(parseFloat(getMediaGeral(ultimaNota))) }}
                    >
                      {getMediaGeral(ultimaNota)}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-center py-3 text-secondary">
                  <Star size={24} className="mb-1" style={{ opacity: 0.3 }} />
                  <p className="text-sm">Sem avaliações</p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Histórico de Notas */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Histórico de Avaliações</h2>
          <span className="text-secondary">{notas.length} avaliações</span>
        </div>

        {notas.length > 0 ? (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Colaborador</th>
                  <th>Período</th>
                  <th>Pontualidade</th>
                  <th>Assiduidade</th>
                  <th>Desempenho</th>
                  <th>Média</th>
                  <th>Observações</th>
                </tr>
              </thead>
              <tbody>
                {notas.map(nota => (
                  <tr key={nota.id}>
                    <td>{nota.funcionario_nome}</td>
                    <td>
                      {format(new Date(nota.periodo_inicio), 'dd/MM')} - {format(new Date(nota.periodo_fim), 'dd/MM/yyyy')}
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        {renderStars(nota.pontualidade)}
                        <span style={{ color: getNotaColor(nota.pontualidade) }}>
                          {nota.pontualidade.toFixed(1)}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        {renderStars(nota.assiduidade)}
                        <span style={{ color: getNotaColor(nota.assiduidade) }}>
                          {nota.assiduidade.toFixed(1)}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        {renderStars(nota.desempenho)}
                        <span style={{ color: getNotaColor(nota.desempenho) }}>
                          {nota.desempenho.toFixed(1)}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span 
                        className="font-bold"
                        style={{ color: getNotaColor(parseFloat(getMediaGeral(nota))) }}
                      >
                        {getMediaGeral(nota)}
                      </span>
                    </td>
                    <td className="text-sm text-secondary">{nota.observacoes || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <Star size={64} />
            <p>Nenhuma avaliação registrada</p>
          </div>
        )}
      </div>

      {/* Modal Nova Avaliação */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Nova Avaliação</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Colaborador *</label>
                <select
                  className="form-select"
                  value={form.funcionario_id}
                  onChange={e => setForm({ ...form, funcionario_id: e.target.value })}
                  required
                >
                  <option value="">Selecione...</option>
                  {funcionarios.map(f => (
                    <option key={f.id} value={f.id}>{f.nome}</option>
                  ))}
                </select>
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Período Início *</label>
                  <input
                    type="date"
                    className="form-input"
                    value={form.periodo_inicio}
                    onChange={e => setForm({ ...form, periodo_inicio: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Período Fim *</label>
                  <input
                    type="date"
                    className="form-input"
                    value={form.periodo_fim}
                    onChange={e => setForm({ ...form, periodo_fim: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end' }}>
                  <button type="button" className="btn btn-warning w-full" onClick={calcularNotas}>
                    <Calculator size={18} />
                    Calcular Auto
                  </button>
                </div>
              </div>
              
              {notasCalculadas && (
                <div className="alert alert-info mb-3">
                  <div>
                    <strong>Notas calculadas automaticamente</strong>
                    <p className="text-sm mt-1">
                      Baseado em {notasCalculadas.estatisticas?.total || 0} registros: {' '}
                      {notasCalculadas.estatisticas?.presentes || 0} presenças, {' '}
                      {notasCalculadas.estatisticas?.atrasos || 0} atrasos, {' '}
                      {notasCalculadas.estatisticas?.furos || 0} furos
                    </p>
                  </div>
                </div>
              )}
              
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Pontualidade (0-10) *</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="10"
                    className="form-input"
                    value={form.pontualidade}
                    onChange={e => setForm({ ...form, pontualidade: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Assiduidade (0-10) *</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="10"
                    className="form-input"
                    value={form.assiduidade}
                    onChange={e => setForm({ ...form, assiduidade: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Desempenho (0-10) *</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="10"
                    className="form-input"
                    value={form.desempenho}
                    onChange={e => setForm({ ...form, desempenho: e.target.value })}
                    required
                  />
                </div>
              </div>
              
              <div className="form-group">
                <label className="form-label">Observações</label>
                <textarea
                  className="form-textarea"
                  rows="3"
                  value={form.observacoes}
                  onChange={e => setForm({ ...form, observacoes: e.target.value })}
                  placeholder="Adicione observações sobre a avaliação..."
                />
              </div>
              
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  <Star size={18} />
                  Salvar Avaliação
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Notas;
