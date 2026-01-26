import { useState, useEffect } from 'react';
import {
  Users, Calendar, AlertTriangle, DollarSign, Bell, Clock,
  CheckCircle, XCircle, AlertCircle, ArrowRight, Heart
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { API_URL } from '../config';

import { useAuth } from '../contexts/AuthContext';

function Dashboard() {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    fetchDashboard();
    verificarFuros();
    const interval = setInterval(() => {
      fetchDashboard();
      verificarFuros();
    }, 60000);
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
    <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header Institucional */}
      <div className="card" style={{
        marginBottom: '3rem',
        background: 'linear-gradient(135deg, rgba(225, 29, 72, 0.1) 0%, rgba(15, 23, 42, 0.4) 100%)',
        padding: '2.5rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderLeft: '5px solid var(--primary)'
      }}>
        <div>
          <h1 className="page-title" style={{ fontSize: '2.5rem', marginBottom: '0.25rem' }}>
            Olá, {user?.nome?.split(' ')[0]} 👋
          </h1>
          <p className="page-subtitle">
            Bem-vindo ao Gestor de Plantões da Santa Casa BH. Estamos operando em {format(new Date(), "dd 'de' MMMM", { locale: ptBR })}.
          </p>
        </div>
        <div style={{ opacity: 0.2 }}>
          <Heart size={80} fill="var(--primary)" color="var(--primary)" />
        </div>
      </div>

      {/* Stats Grid */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon blue">
            <Users size={28} />
          </div>
          <div className="stat-info">
            <h3>{dashboard?.total_funcionarios || 0}</h3>
            <p>Médicos Ativos</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon cyan">
            <Calendar size={28} />
          </div>
          <div className="stat-info">
            <h3>{dashboard?.escalas_hoje || 0}</h3>
            <p>Escalas Hoje</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon red">
            <AlertTriangle size={28} />
          </div>
          <div className="stat-info">
            <h3>{dashboard?.furos_hoje || 0}</h3>
            <p>Furos Hoje</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon green">
            <Bell size={28} />
          </div>
          <div className="stat-info">
            <h3>{dashboard?.avisos_nao_lidos || 0}</h3>
            <p>Avisos</p>
          </div>
        </div>
      </div>

      <div className="grid-2">
        {/* Lado Esquerdo: Plantões do Dia */}
        <div className="card">
          <div className="card-header" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '1.5rem', marginBottom: '1.5rem' }}>
            <div>
              <h2 className="card-title">Escalas em Andamento</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Monitoramento em tempo real</p>
            </div>
            <Clock size={24} className="text-secondary" />
          </div>

          {dashboard?.escalas_hoje_detalhes?.length > 0 ? (
            <div className="table-container" style={{ background: 'none', border: 'none' }}>
              <table style={{ background: 'transparent' }}>
                <thead>
                  <tr>
                    <th style={{ background: 'none' }}>Médico</th>
                    <th style={{ background: 'none' }}>Horário</th>
                    <th style={{ background: 'none' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboard.escalas_hoje_detalhes.map(escala => (
                    <tr key={escala.id}>
                      <td style={{ fontWeight: 700 }}>{escala.funcionario_nome}</td>
                      <td>{escala.hora_inicio} - {escala.hora_fim}</td>
                      <td>{getStatusBadge(escala.presenca_status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state" style={{ padding: '3rem' }}>
              <Calendar size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
              <p>Tranquilo por aqui. Nenhuma escala agendada no momento.</p>
            </div>
          )}
          <button className="btn btn-secondary" style={{ width: '100%', marginTop: '1.5rem', justifyContent: 'center' }}>
            Ver Escala Completa <ArrowRight size={18} />
          </button>
        </div>

        {/* Lado Direito: Alertas e Financeiro */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <div className="card" style={{ background: 'rgba(239, 68, 68, 0.05)', borderColor: 'rgba(239, 68, 68, 0.2)' }}>
            <div className="card-header" style={{ marginBottom: '1rem' }}>
              <h2 className="card-title" style={{ fontSize: '1.25rem', color: '#f87171' }}>Alertas Críticos</h2>
              <AlertCircle size={20} color="#f87171" />
            </div>
            {dashboard?.furos_hoje > 0 ? (
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                Existem <strong>{dashboard.furos_hoje} furos</strong> detectados hoje que precisam de remanejamento imediato.
              </p>
            ) : (
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Tudo em ordem. Nenhum plantão descoberto hoje.</p>
            )}
          </div>

          <div className="card">
            <div className="card-header" style={{ marginBottom: '1.5rem' }}>
              <h2 className="card-title" style={{ fontSize: '1.25rem' }}>Previsão de Pagamentos</h2>
              <DollarSign size={20} className="text-secondary" />
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '2rem', fontWeight: 800 }}>R$ {(dashboard?.valor_pagamentos_pendentes || 0).toLocaleString('pt-BR')}</span>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>pendentes</span>
            </div>
            <div style={{ width: '100%', height: '8px', background: 'var(--bg-tertiary)', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ width: '65%', height: '100%', background: 'var(--primary)' }}></div>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '1rem' }}>
              Próximo fechamento em 5 dias.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
