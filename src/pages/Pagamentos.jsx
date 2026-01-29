import { useState, useEffect } from 'react';
import { 
  DollarSign, Plus, Calculator, X, CheckCircle, Clock, FileText,
  Download, TrendingUp, Wallet
} from 'lucide-react';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { API_URL } from '../config';

function Pagamentos() {
  const [pagamentos, setPagamentos] = useState([]);
  const [funcionarios, setFuncionarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [calculando, setCalculando] = useState(false);
  const [form, setForm] = useState({
    funcionario_id: '',
    periodo_inicio: format(startOfMonth(subMonths(new Date(), 1)), 'yyyy-MM-dd'),
    periodo_fim: format(endOfMonth(subMonths(new Date(), 1)), 'yyyy-MM-dd'),
    horas_trabalhadas: '',
    horas_extras: '',
    valor_hora: '',
    descontos: '',
    bonus: '',
    observacoes: ''
  });
  const [filtroStatus, setFiltroStatus] = useState('');

  useEffect(() => {
    fetchDados();
  }, [filtroStatus]);

  const fetchDados = async () => {
    try {
      let url = `${API_URL}/pagamentos`;
      if (filtroStatus) url += `?status=${filtroStatus}`;
      
      const [pagRes, funcRes] = await Promise.all([
        fetch(url),
        fetch(`${API_URL}/funcionarios`)
      ]);
      setPagamentos(await pagRes.json());
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
      await fetch(`${API_URL}/pagamentos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      setShowModal(false);
      resetForm();
      fetchDados();
    } catch (error) {
      console.error('Erro ao salvar pagamento:', error);
    }
  };

  const calcularPagamento = async () => {
    if (!form.funcionario_id || !form.periodo_inicio || !form.periodo_fim) {
      alert('Selecione colaborador e período');
      return;
    }
    
    setCalculando(true);
    try {
      const res = await fetch(`${API_URL}/pagamentos/calcular`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          funcionario_id: form.funcionario_id,
          periodo_inicio: form.periodo_inicio,
          periodo_fim: form.periodo_fim
        })
      });
      const data = await res.json();
      setForm({
        ...form,
        horas_trabalhadas: data.horas_trabalhadas,
        horas_extras: data.horas_extras,
        valor_hora: data.valor_hora,
        descontos: data.descontos,
        bonus: 0
      });
    } catch (error) {
      console.error('Erro ao calcular pagamento:', error);
    } finally {
      setCalculando(false);
    }
  };

  const marcarComoPago = async (id) => {
    try {
      await fetch(`${API_URL}/pagamentos/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'pago',
          data_pagamento: format(new Date(), 'yyyy-MM-dd')
        })
      });
      fetchDados();
    } catch (error) {
      console.error('Erro ao marcar como pago:', error);
    }
  };

  const resetForm = () => {
    setForm({
      funcionario_id: '',
      periodo_inicio: format(startOfMonth(subMonths(new Date(), 1)), 'yyyy-MM-dd'),
      periodo_fim: format(endOfMonth(subMonths(new Date(), 1)), 'yyyy-MM-dd'),
      horas_trabalhadas: '',
      horas_extras: '',
      valor_hora: '',
      descontos: '',
      bonus: '',
      observacoes: ''
    });
  };

  const calcularTotal = () => {
    const horas = parseFloat(form.horas_trabalhadas) || 0;
    const extras = parseFloat(form.horas_extras) || 0;
    const valorHora = parseFloat(form.valor_hora) || 0;
    const descontos = parseFloat(form.descontos) || 0;
    const bonus = parseFloat(form.bonus) || 0;
    
    return (horas * valorHora) + (extras * valorHora * 1.5) + bonus - descontos;
  };

  const getStatusBadge = (status) => {
    if (status === 'pago') {
      return <span className="badge badge-success"><CheckCircle size={12} /> Pago</span>;
    }
    return <span className="badge badge-warning"><Clock size={12} /> Pendente</span>;
  };

  // Estatísticas
  const totalPendente = pagamentos
    .filter(p => p.status === 'pendente')
    .reduce((acc, p) => acc + p.valor_total, 0);
  
  const totalPago = pagamentos
    .filter(p => p.status === 'pago')
    .reduce((acc, p) => acc + p.valor_total, 0);

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
          <h1 className="page-title">Pagamentos</h1>
          <p className="page-subtitle">Gerenciar os pagamentos dos colaboradores</p>
        </div>
        <button className="btn btn-primary" onClick={() => {
          resetForm();
          setShowModal(true);
        }}>
          <Plus size={20} />
          Novo Pagamento
        </button>
      </div>

      {/* Estatísticas */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon yellow">
            <Clock size={24} />
          </div>
          <div className="stat-info">
            <h3>R$ {totalPendente.toFixed(2)}</h3>
            <p>Total Pendente</p>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon green">
            <CheckCircle size={24} />
          </div>
          <div className="stat-info">
            <h3>R$ {totalPago.toFixed(2)}</h3>
            <p>Total Pago</p>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon blue">
            <Wallet size={24} />
          </div>
          <div className="stat-info">
            <h3>{pagamentos.length}</h3>
            <p>Total de Registros</p>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="card mb-3">
        <div className="flex items-center gap-2">
          <span className="text-secondary">Filtrar por status:</span>
          <div className="tabs" style={{ marginBottom: 0, borderBottom: 'none', paddingBottom: 0 }}>
            <button 
              className={`tab ${filtroStatus === '' ? 'active' : ''}`}
              onClick={() => setFiltroStatus('')}
            >
              Todos
            </button>
            <button 
              className={`tab ${filtroStatus === 'pendente' ? 'active' : ''}`}
              onClick={() => setFiltroStatus('pendente')}
            >
              Pendentes
            </button>
            <button 
              className={`tab ${filtroStatus === 'pago' ? 'active' : ''}`}
              onClick={() => setFiltroStatus('pago')}
            >
              Pagos
            </button>
          </div>
        </div>
      </div>

      {/* Lista de Pagamentos */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Registros de Pagamento</h2>
          <span className="text-secondary">{pagamentos.length} registros</span>
        </div>

        {pagamentos.length > 0 ? (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Colaborador</th>
                  <th>Período</th>
                  <th>Horas</th>
                  <th>Extras</th>
                  <th>Descontos</th>
                  <th>Bônus</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {pagamentos.map(pag => (
                  <tr key={pag.id}>
                    <td className="font-medium">{pag.funcionario_nome}</td>
                    <td className="text-sm">
                      {format(new Date(pag.periodo_inicio), 'dd/MM')} - {format(new Date(pag.periodo_fim), 'dd/MM/yy')}
                    </td>
                    <td>{pag.horas_trabalhadas.toFixed(1)}h</td>
                    <td>{pag.horas_extras.toFixed(1)}h</td>
                    <td className="text-danger">-R$ {pag.descontos.toFixed(2)}</td>
                    <td className="text-success">+R$ {pag.bonus.toFixed(2)}</td>
                    <td className="font-bold text-primary">R$ {pag.valor_total.toFixed(2)}</td>
                    <td>{getStatusBadge(pag.status)}</td>
                    <td>
                      <div className="action-buttons">
                        {pag.status === 'pendente' && (
                          <button 
                            className="btn btn-success btn-sm"
                            onClick={() => marcarComoPago(pag.id)}
                          >
                            <CheckCircle size={14} />
                            Pagar
                          </button>
                        )}
                        {pag.status === 'pago' && (
                          <span className="text-sm text-secondary">
                            Pago em {format(new Date(pag.data_pagamento), 'dd/MM/yy')}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <DollarSign size={64} />
            <p>Nenhum pagamento registrado</p>
          </div>
        )}
      </div>

      {/* Modal Novo Pagamento */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Novo Pagamento</h2>
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
                  onChange={e => {
                    const func = funcionarios.find(f => f.id === e.target.value);
                    setForm({ 
                      ...form, 
                      funcionario_id: e.target.value,
                      valor_hora: func?.salario_hora || ''
                    });
                  }}
                  required
                >
                  <option value="">Selecione...</option>
                  {funcionarios.map(f => (
                    <option key={f.id} value={f.id}>
                      {f.nome} - R$ {f.salario_hora?.toFixed(2) || '0.00'}/h
                    </option>
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
                  <button 
                    type="button" 
                    className="btn btn-warning w-full" 
                    onClick={calcularPagamento}
                    disabled={calculando}
                  >
                    <Calculator size={18} />
                    {calculando ? 'Calculando...' : 'Calcular Auto'}
                  </button>
                </div>
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Horas Trabalhadas *</label>
                  <input
                    type="number"
                    step="0.1"
                    className="form-input"
                    value={form.horas_trabalhadas}
                    onChange={e => setForm({ ...form, horas_trabalhadas: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Horas Extras</label>
                  <input
                    type="number"
                    step="0.1"
                    className="form-input"
                    value={form.horas_extras}
                    onChange={e => setForm({ ...form, horas_extras: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Valor/Hora (R$) *</label>
                  <input
                    type="number"
                    step="0.01"
                    className="form-input"
                    value={form.valor_hora}
                    onChange={e => setForm({ ...form, valor_hora: e.target.value })}
                    required
                  />
                </div>
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Descontos (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="form-input"
                    value={form.descontos}
                    onChange={e => setForm({ ...form, descontos: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Bônus (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="form-input"
                    value={form.bonus}
                    onChange={e => setForm({ ...form, bonus: e.target.value })}
                  />
                </div>
              </div>
              
              {/* Preview do cálculo */}
              {form.horas_trabalhadas && form.valor_hora && (
                <div className="alert alert-info mb-3">
                  <div className="w-full">
                    <div className="flex justify-between mb-1">
                      <span>Horas normais:</span>
                      <span>R$ {((parseFloat(form.horas_trabalhadas) || 0) * (parseFloat(form.valor_hora) || 0)).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between mb-1">
                      <span>Horas extras (1.5x):</span>
                      <span>R$ {((parseFloat(form.horas_extras) || 0) * (parseFloat(form.valor_hora) || 0) * 1.5).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between mb-1">
                      <span>Bônus:</span>
                      <span className="text-success">+R$ {(parseFloat(form.bonus) || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between mb-1">
                      <span>Descontos:</span>
                      <span className="text-danger">-R$ {(parseFloat(form.descontos) || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-bold pt-2" style={{ borderTop: '1px solid var(--border)' }}>
                      <span>TOTAL:</span>
                      <span className="text-xl text-primary">R$ {calcularTotal().toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              )}
              
              <div className="form-group">
                <label className="form-label">Observações</label>
                <textarea
                  className="form-textarea"
                  rows="2"
                  value={form.observacoes}
                  onChange={e => setForm({ ...form, observacoes: e.target.value })}
                  placeholder="Observações adicionais..."
                />
              </div>
              
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  <DollarSign size={18} />
                  Registrar Pagamento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Pagamentos;
