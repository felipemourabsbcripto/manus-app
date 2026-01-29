import { useState, useEffect, useCallback } from 'react';
import {
  Calendar, Plus, Clock, ChevronLeft, ChevronRight, MapPin,
  MoreVertical, Search, Filter, User, X
} from 'lucide-react';
import {
  format, addDays, startOfWeek, endOfWeek, addWeeks, subWeeks,
  startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday,
  addMonths, subMonths, isSameMonth
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { API_URL } from '../config';
import './Escalas.css';

function Escalas() {
  const [escalas, setEscalas] = useState([]);
  const [funcionarios, setFuncionarios] = useState([]);
  const [turnos, setTurnos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dataAtual, setDataAtual] = useState(new Date());
  const [visualizacao, setVisualizacao] = useState('mes'); // 'mes', 'semana', 'dia'
  const [showModal, setShowModal] = useState(false);

  // Estados para Modal de Criação (simplificado para o exemplo)
  const [form, setForm] = useState({
    funcionario_id: '',
    turno_id: '',
    data: '',
    hora_inicio: '',
    hora_fim: ''
  });

  const diasSemana = [
    { valor: 0, nome: 'Dom' },
    { valor: 1, nome: 'Seg' },
    { valor: 2, nome: 'Ter' },
    { valor: 3, nome: 'Qua' },
    { valor: 4, nome: 'Qui' },
    { valor: 5, nome: 'Sex' },
    { valor: 6, nome: 'Sáb' }
  ];

  const fetchDados = useCallback(async () => {
    try {
      let inicio, fim;
      if (visualizacao === 'mes') {
        inicio = startOfMonth(dataAtual);
        fim = endOfMonth(dataAtual);
        // Ajustar para pegar semanas completas para a grade visual
        inicio = startOfWeek(inicio, { weekStartsOn: 0 });
        fim = endOfWeek(fim, { weekStartsOn: 0 });
      } else if (visualizacao === 'semana') {
        inicio = startOfWeek(dataAtual, { weekStartsOn: 0 });
        fim = endOfWeek(dataAtual, { weekStartsOn: 0 });
      } else {
        inicio = dataAtual;
        fim = dataAtual;
      }

      const [escRes, funcRes, turnosRes] = await Promise.all([
        fetch(`${API_URL}/escalas?data_inicio=${format(inicio, 'yyyy-MM-dd')}&data_fim=${format(fim, 'yyyy-MM-dd')}`),
        fetch(`${API_URL}/funcionarios`),
        fetch(`${API_URL}/turnos`)
      ]);

      const escData = await escRes.json();
      const funcData = await funcRes.json();
      const turnosData = await turnosRes.json();

      setEscalas(escData);
      setFuncionarios(funcData);
      setTurnos(turnosData);
    } catch (error) {
      console.error('Erro ao buscar dados:', error);
    } finally {
      setLoading(false);
    }
  }, [dataAtual, visualizacao]);

  useEffect(() => {
    fetchDados();
  }, [fetchDados]);

  const navegar = (direcao) => {
    if (visualizacao === 'mes') {
      setDataAtual(direcao === 'next' ? addMonths(dataAtual, 1) : subMonths(dataAtual, 1));
    } else if (visualizacao === 'semana') {
      setDataAtual(direcao === 'next' ? addWeeks(dataAtual, 1) : subWeeks(dataAtual, 1));
    } else {
      setDataAtual(direcao === 'next' ? addDays(dataAtual, 1) : addDays(dataAtual, -1));
    }
  };

  const irParaHoje = () => {
    setDataAtual(new Date());
  };

  const getTituloCalendario = () => {
    if (visualizacao === 'mes') {
      return format(dataAtual, "MMMM 'de' yyyy", { locale: ptBR });
    } else if (visualizacao === 'semana') {
      const inicio = startOfWeek(dataAtual, { weekStartsOn: 0 });
      const fim = endOfWeek(dataAtual, { weekStartsOn: 0 });
      // Se for mesmo mês
      if (isSameMonth(inicio, fim)) {
        return format(dataAtual, "MMMM 'de' yyyy", { locale: ptBR });
      }
      return `${format(inicio, "MMM", { locale: ptBR })} - ${format(fim, "MMM yyyy", { locale: ptBR })}`;
    } else {
      return format(dataAtual, "d 'de' MMMM 'de' yyyy", { locale: ptBR });
    }
  };

  const abrirModal = (dia = null) => {
    const dataInicial = dia ? format(dia, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd');
    setForm({
      ...form,
      data: dataInicial
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await fetch(`${API_URL}/escalas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      setShowModal(false);
      setForm({ funcionario_id: '', turno_id: '', data: '', hora_inicio: '', hora_fim: '' });
      fetchDados();
    } catch (error) {
      console.error('Erro ao salvar escala:', error);
    }
  };

  const handleTurnoSelect = (turnoId) => {
    const turno = turnos.find(t => t.id === turnoId);
    if (turno) {
      setForm({
        ...form,
        turno_id: turnoId,
        hora_inicio: turno.hora_inicio,
        hora_fim: turno.hora_fim
      });
    }
  };

  // --- Renderização das Vistas ---

  const renderMonthView = () => {
    const monthStart = startOfMonth(dataAtual);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 0 });
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 0 });

    const days = eachDayOfInterval({ start: startDate, end: endDate });

    return (
      <div className="month-grid">
        {/* Headers */}
        {diasSemana.map(d => (
          <div key={d.valor} className="weekday-header">
            {d.nome}
          </div>
        ))}

        {/* Body */}
        <div className="month-body">
          {days.map(day => {
            const isCurrentMonth = isSameMonth(day, monthStart);
            const dayScales = escalas.filter(e => isSameDay(new Date(e.data + 'T00:00:00'), day));

            return (
              <div
                key={day.toISOString()}
                className={`calendar-cell ${!isCurrentMonth ? 'different-month' : ''} ${isToday(day) ? 'today' : ''}`}
                onClick={() => {
                  setDataAtual(day);
                  setVisualizacao('dia');
                }}
              >
                <div className="day-header" style={{ display: 'flex', justifyContent: 'center' }}>
                  <span className="day-number">{format(day, 'd')}</span>
                </div>

                <div className="day-events">
                  {dayScales.slice(0, 3).map(scale => (
                    <div key={scale.id} className="event-chip morning">
                      <Clock size={10} />
                      {scale.hora_inicio} • {scale.funcionario_nome?.split(' ')[0]}
                    </div>
                  ))}
                  {dayScales.length > 3 && (
                    <div className="event-more">
                      + {dayScales.length - 3} mais
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderDayView = () => {
    const dayScales = escalas.filter(e => isSameDay(new Date(e.data + 'T00:00:00'), dataAtual));

    return (
      <div className="day-view-container">
        {dayScales.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
            <Calendar size={48} style={{ margin: '0 auto 1rem', display: 'block', opacity: 0.3 }} />
            <p>Nenhuma escala para este dia.</p>
            <button className="btn btn-primary" style={{ marginTop: '1rem' }} onClick={() => abrirModal(dataAtual)}>
              Criar Escala
            </button>
          </div>
        ) : (
          dayScales.map(scale => (
            <div key={scale.id} className="day-event-card">
              <div className="event-time-col">
                <div>{scale.hora_inicio}</div>
                <div style={{ color: '#94a3b8', fontSize: '0.8rem' }}>{scale.hora_fim}</div>
              </div>
              <div className="event-info-col">
                <div className="event-title">{scale.funcionario_nome}</div>
                <div className="event-subtitle">
                  <span>{scale.especialidade || 'Médico Plantonista'}</span>
                  {scale.turno_nome && <span className="badge badge-info" style={{ fontSize: '0.7rem', padding: '2px 6px' }}>{scale.turno_nome}</span>}
                </div>
              </div>
              <div className="event-actions">
                <button className="btn-icon" style={{ color: '#64748b' }}>
                  <MoreVertical size={18} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    );
  };

  const renderWeekView = () => {
    // Simplificado para lista vertical por dia (como solicitado na ref 1)
    const weekStart = startOfWeek(dataAtual, { weekStartsOn: 0 });
    const weekEnd = endOfWeek(dataAtual, { weekStartsOn: 0 });
    const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

    return (
      <div className="day-view-container">
        {days.map(day => {
          const dayScales = escalas.filter(e => isSameDay(new Date(e.data + 'T00:00:00'), day));
          const isDayToday = isToday(day);

          return (
            <div key={day.toISOString()} style={{ marginBottom: '1.5rem' }}>
              <h4 style={{
                fontSize: '1rem',
                color: isDayToday ? '#e11d48' : '#334155',
                fontWeight: 600,
                borderBottom: `1px solid ${isDayToday ? '#e11d48' : '#e2e8f0'}`,
                paddingBottom: '0.5rem',
                marginBottom: '0.75rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <span style={{ textTransform: 'uppercase' }}>{format(day, 'EEE', { locale: ptBR })}</span>
                <span style={{ fontWeight: 400 }}>{format(day, 'd, MMM', { locale: ptBR })}</span>
              </h4>

              {dayScales.length === 0 ? (
                <div style={{ fontSize: '0.85rem', color: '#94a3b8', fontStyle: 'italic', paddingLeft: '1rem' }}>Sem escalas</div>
              ) : (
                dayScales.map(scale => (
                  <div key={scale.id} className="day-event-card" style={{ padding: '0.75rem', marginBottom: '0.5rem' }}>
                    <div className="event-time-col" style={{ width: '60px' }}>
                      {scale.hora_inicio}
                    </div>
                    <div className="event-info-col">
                      <div className="event-title" style={{ fontSize: '0.9rem' }}>{scale.funcionario_nome}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="escalas-container">
      {/* Header / Toolbar */}
      <div className="calendar-toolbar">
        <div className="calendar-nav">
          <h1 style={{ margin: 0, marginRight: '1rem', fontSize: '1.5rem', fontWeight: 800, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Calendar size={24} />
            Agenda
          </h1>
          <button className="today-btn" onClick={irParaHoje}>Hoje</button>
          <div className="flex bg-slate-100 rounded-full p-1">
            <button className="nav-btn" onClick={() => navegar('prev')}>
              <ChevronLeft size={18} />
            </button>
            <button className="nav-btn" onClick={() => navegar('next')}>
              <ChevronRight size={18} />
            </button>
          </div>
          <h2 className="calendar-title" style={{ textTransform: 'capitalize' }}>
            {getTituloCalendario()}
          </h2>
        </div>

        <div className="flex gap-3">
          {/* View Switcher */}
          <div className="view-switcher">
            <button
              className={`view-btn ${visualizacao === 'mes' ? 'active' : ''}`}
              onClick={() => setVisualizacao('mes')}
            >
              Mês
            </button>
            <button
              className={`view-btn ${visualizacao === 'semana' ? 'active' : ''}`}
              onClick={() => setVisualizacao('semana')}
            >
              Semana
            </button>
            <button
              className={`view-btn ${visualizacao === 'dia' ? 'active' : ''}`}
              onClick={() => setVisualizacao('dia')}
            >
              Dia
            </button>
          </div>

          <button className="btn btn-primary" onClick={() => abrirModal()} style={{ padding: '0.5rem 1rem' }}>
            <Plus size={18} />
            <span className="hidden md:inline">Criar</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="loading"><div className="spinner"></div></div>
      ) : (
        <>
          {visualizacao === 'mes' && renderMonthView()}
          {visualizacao === 'semana' && renderWeekView()}
          {visualizacao === 'dia' && renderDayView()}
        </>
      )}

      {/* Modal de Criação Rápida */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)} style={{ zIndex: 2000 }}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Nova Escala</h2>
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

              {turnos.length > 0 && (
                <div className="form-group">
                  <label className="form-label">Turno (opcional)</label>
                  <select
                    className="form-select"
                    value={form.turno_id}
                    onChange={e => handleTurnoSelect(e.target.value)}
                  >
                    <option value="">Selecione um turno...</option>
                    {turnos.map(t => (
                      <option key={t.id} value={t.id}>{t.nome} ({t.hora_inicio} - {t.hora_fim})</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Data *</label>
                <input
                  type="date"
                  className="form-input"
                  value={form.data}
                  onChange={e => setForm({ ...form, data: e.target.value })}
                  required
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Hora Início *</label>
                  <input
                    type="time"
                    className="form-input"
                    value={form.hora_inicio}
                    onChange={e => setForm({ ...form, hora_inicio: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Hora Fim *</label>
                  <input
                    type="time"
                    className="form-input"
                    value={form.hora_fim}
                    onChange={e => setForm({ ...form, hora_fim: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Escalas;
