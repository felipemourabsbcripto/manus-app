import { useState, useEffect } from 'react';
import { 
  Users, Calendar, AlertTriangle, DollarSign, Bell, Clock,
  TrendingUp, TrendingDown, CheckCircle, XCircle, AlertCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { API_URL } from '../config';

function Dashboard() {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboard();
    // Verificar furos automaticamente
    verificarFuros();
    const interval = setInterval(() => {
      fetchDashboard();
      verificarFuros();
    }, 60000); // A cada minuto
    return () => clearInterval(interval);
  }, []);

  const fetchDashboard = async () => {
    try {
      const res = await fetch(`${API_URL}/dashboard`);
      const data = await res.json();
      setDashboard(data);
    } catch (error) {
      console.error('Erro ao buscar dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const verificarFuros = async () => {
    try {
      await fetch(`${API_URL}/presencas/verificar-furos`, { method: 'POST' });
    } catch (error) {
      console.error('Erro ao verificar furos:', error);
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      presente: { class: 'badge-success', icon: CheckCircle, text: 'Presente' },
      atraso: { class: 'badge-warning', icon: AlertCircle, text: 'Atraso' },
      furo: { class: 'badge-danger', icon: XCircle, text: 'Furo' },
      falta: { class: 'badge-danger', icon: XCircle, text: 'Falta' },
      pendente: { class: 'badge-secondary', icon: Clock, text: 'Pendente' },
      agendado: { class: 'badge-info', icon: Calendar, text: 'Agendado' }
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
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">
            Visão geral do sistema • {format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })}
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon blue">
            <Users size={24} />
          </div>
          <div className="stat-info">
            <h3>{dashboard?.total_funcionarios || 0}</h3>
            <p>Funcionários Ativos</p>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon cyan">
            <Calendar size={24} />
          </div>
          <div className="stat-info">
            <h3>{dashboard?.escalas_hoje || 0}</h3>
            <p>Escalas Hoje</p>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon red">
            <AlertTriangle size={24} />
          </div>
          <div className="stat-info">
            <h3>{dashboard?.furos_hoje || 0}</h3>
            <p>Furos Hoje</p>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon yellow">
            <AlertTriangle size={24} />
          </div>
          <div className="stat-info">
            <h3>{dashboard?.furos_mes || 0}</h3>
            <p>Furos no Mês</p>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon green">
            <Bell size={24} />
          </div>
          <div className="stat-info">
            <h3>{dashboard?.avisos_nao_lidos || 0}</h3>
            <p>Avisos Pendentes</p>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon blue">
            <DollarSign size={24} />
          </div>
          <div className="stat-info">
            <h3>R$ {(dashboard?.valor_pagamentos_pendentes || 0).toFixed(2)}</h3>
            <p>{dashboard?.pagamentos_pendentes || 0} Pagamentos Pendentes</p>
          </div>
        </div>
      </div>

      <div className="grid-2">
        {/* Escalas de Hoje */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Escalas de Hoje</h2>
            <Clock size={20} className="text-secondary" />
          </div>
          
          {dashboard?.escalas_hoje_detalhes?.length > 0 ? (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Funcionário</th>
                    <th>Horário</th>
                    <th>Status</th>
                    <th>Entrada</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboard.escalas_hoje_detalhes.map(escala => (
                    <tr key={escala.id}>
                      <td>{escala.funcionario_nome}</td>
                      <td>{escala.hora_inicio} - {escala.hora_fim}</td>
                      <td>{getStatusBadge(escala.presenca_status)}</td>
                      <td>{escala.hora_entrada || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state">
              <Calendar size={48} />
              <p>Nenhuma escala para hoje</p>
            </div>
          )}
        </div>

        {/* Últimos Furos */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Últimos Furos/Atrasos</h2>
            <AlertTriangle size={20} className="text-warning" />
          </div>
          
          {dashboard?.ultimos_furos?.length > 0 ? (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Funcionário</th>
                    <th>Data</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboard.ultimos_furos.map(furo => (
                    <tr key={furo.id}>
                      <td>{furo.funcionario_nome}</td>
                      <td>{format(new Date(furo.data), 'dd/MM/yyyy')}</td>
                      <td>{getStatusBadge(furo.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state">
              <CheckCircle size={48} />
              <p>Nenhum furo registrado</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
