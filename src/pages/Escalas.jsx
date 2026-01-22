import { useState, useEffect } from 'react';
import { 
  Calendar, Plus, Edit2, Trash2, X, ChevronLeft, ChevronRight,
  Clock, Users, Wand2, RefreshCw
} from 'lucide-react';
import { format, addDays, startOfWeek, endOfWeek, addWeeks, subWeeks, 
  startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { API_URL } from '../config';

function Escalas() {
  const [escalas, setEscalas] = useState([]);
  const [funcionarios, setFuncionarios] = useState([]);
  const [turnos, setTurnos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showModalTurno, setShowModalTurno] = useState(false);
  const [showModalAuto, setShowModalAuto] = useState(false);
  const [dataAtual, setDataAtual] = useState(new Date());
  const [visualizacao, setVisualizacao] = useState('semana');
  const [form, setForm] = useState({
    funcionario_id: '',
    turno_id: '',
    data: '',
    hora_inicio: '',
    hora_fim: ''
  });
  const [formTurno, setFormTurno] = useState({
    nome: '',
    hora_inicio: '',
    hora_fim: '',
    dias_semana: []
  });
  const [formAuto, setFormAuto] = useState({
    turno_id: '',
    data_inicio: '',
    data_fim: ''
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

  useEffect(() => {
    fetchDados();
  }, [dataAtual, visualizacao]);

  const fetchDados = async () => {
    try {
      let inicio, fim;
      if (visualizacao === 'semana') {
        inicio = startOfWeek(dataAtual, { weekStartsOn: 0 });
        fim = endOfWeek(dataAtual, { weekStartsOn: 0 });
      } else {
        inicio = startOfMonth(dataAtual);
        fim = endOfMonth(dataAtual);
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

  const handleSubmitTurno = async (e) => {
    e.preventDefault();
    try {
      await fetch(`${API_URL}/turnos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formTurno)
      });
      setShowModalTurno(false);
      setFormTurno({ nome: '', hora_inicio: '', hora_fim: '', dias_semana: [] });
      fetchDados();
    } catch (error) {
      console.error('Erro ao salvar turno:', error);
    }
  };

  const handleGerarAutomatico = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_URL}/escalas/gerar-automatico`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formAuto)
      });
      const data = await res.json();
      alert(`${data.escalas_geradas} escalas geradas com sucesso!`);
      setShowModalAuto(false);
      setFormAuto({ turno_id: '', data_inicio: '', data_fim: '' });
      fetchDados();
    } catch (error) {
      console.error('Erro ao gerar escalas:', error);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Tem certeza que deseja excluir esta escala?')) {
      try {
        await fetch(`${API_URL}/escalas/${id}`, { method: 'DELETE' });
        fetchDados();
      } catch (error) {
        console.error('Erro ao excluir escala:', error);
      }
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

  const getDiasVisualizacao = () => {
    let inicio, fim;
    if (visualizacao === 'semana') {
      inicio = startOfWeek(dataAtual, { weekStartsOn: 0 });
      fim = endOfWeek(dataAtual, { weekStartsOn: 0 });
    } else {
      inicio = startOfMonth(dataAtual);
      fim = endOfMonth(dataAtual);
    }
    return eachDayOfInterval({ start: inicio, end: fim });
  };

  const getEscalasDia = (dia) => {
    return escalas.filter(e => isSameDay(new Date(e.data + 'T00:00:00'), dia));
  };

  const navegar = (direcao) => {
    if (visualizacao === 'semana') {
      setDataAtual(direcao === 'next' ? addWeeks(dataAtual, 1) : subWeeks(dataAtual, 1));
    } else {
      const novaData = new Date(dataAtual);
      novaData.setMonth(novaData.getMonth() + (direcao === 'next' ? 1 : -1));
      setDataAtual(novaData);
    }
  };

  const abrirModalDia = (dia) => {
    setForm({
      ...form,
      data: format(dia, 'yyyy-MM-dd')
    });
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
          <h1 className="page-title">Escalas</h1>
          <p className="page-subtitle">Gerencie as escalas de trabalho</p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-secondary" onClick={() => setShowModalTurno(true)}>
            <Clock size={20} />
            Novo Turno
          </button>
          <button className="btn btn-warning" onClick={() => setShowModalAuto(true)}>
            <Wand2 size={20} />
            Gerar Automático
          </button>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            <Plus size={20} />
            Nova Escala
          </button>
        </div>
      </div>

      {/* Turnos existentes */}
      {turnos.length > 0 && (
        <div className="card mb-3">
          <div className="card-header">
            <h3 className="card-title">Turnos Cadastrados</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {turnos.map(turno => (
              <div key={turno.id} className="badge badge-info" style={{ padding: '0.5rem 1rem' }}>
                <Clock size={14} />
                {turno.nome}: {turno.hora_inicio} - {turno.hora_fim}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Navegação do calendário */}
      <div className="card">
        <div className="card-header">
          <div className="flex items-center gap-2">
            <button className="btn btn-secondary btn-icon" onClick={() => navegar('prev')}>
              <ChevronLeft size={20} />
            </button>
            <h3 className="card-title" style={{ minWidth: '200px', textAlign: 'center' }}>
              {visualizacao === 'semana' 
                ? `${format(startOfWeek(dataAtual, { weekStartsOn: 0 }), 'dd/MM')} - ${format(endOfWeek(dataAtual, { weekStartsOn: 0 }), 'dd/MM/yyyy')}`
                : format(dataAtual, "MMMM 'de' yyyy", { locale: ptBR })}
            </h3>
            <button className="btn btn-secondary btn-icon" onClick={() => navegar('next')}>
              <ChevronRight size={20} />
            </button>
          </div>
          <div className="tabs" style={{ marginBottom: 0, borderBottom: 'none', paddingBottom: 0 }}>
            <button 
              className={`tab ${visualizacao === 'semana' ? 'active' : ''}`}
              onClick={() => setVisualizacao('semana')}
            >
              Semana
            </button>
            <button 
              className={`tab ${visualizacao === 'mes' ? 'active' : ''}`}
              onClick={() => setVisualizacao('mes')}
            >
              Mês
            </button>
          </div>
        </div>

        {/* Calendário */}
        <div className="calendar-grid">
          {diasSemana.map(dia => (
            <div key={dia.valor} className="calendar-header">{dia.nome}</div>
          ))}
          
          {getDiasVisualizacao().map(dia => {
            const escalasDia = getEscalasDia(dia);
            const hoje = isToday(dia);
            const mesAtual = dia.getMonth() === dataAtual.getMonth();
            
            return (
              <div 
                key={dia.toISOString()} 
                className={`calendar-day ${hoje ? 'today' : ''} ${!mesAtual ? 'other-month' : ''}`}
                onClick={() => abrirModalDia(dia)}
                style={{ cursor: 'pointer' }}
              >
                <div className="calendar-day-number">{format(dia, 'd')}</div>
                {escalasDia.slice(0, 3).map(escala => (
                  <div 
                    key={escala.id} 
                    className="calendar-event"
                    style={{ background: 'var(--primary)', color: 'white' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (window.confirm(`Excluir escala de ${escala.funcionario_nome}?`)) {
                        handleDelete(escala.id);
                      }
                    }}
                  >
                    {escala.funcionario_nome?.split(' ')[0]} • {escala.hora_inicio}
                  </div>
                ))}
                {escalasDia.length > 3 && (
                  <div className="calendar-event" style={{ background: 'var(--secondary)' }}>
                    +{escalasDia.length - 3} mais
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal Nova Escala */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Nova Escala</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Funcionário *</label>
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
                  Criar Escala
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Novo Turno */}
      {showModalTurno && (
        <div className="modal-overlay" onClick={() => setShowModalTurno(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Novo Turno</h2>
              <button className="modal-close" onClick={() => setShowModalTurno(false)}>
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleSubmitTurno}>
              <div className="form-group">
                <label className="form-label">Nome do Turno *</label>
                <input
                  type="text"
                  className="form-input"
                  value={formTurno.nome}
                  onChange={e => setFormTurno({ ...formTurno, nome: e.target.value })}
                  placeholder="Ex: Manhã, Tarde, Noite..."
                  required
                />
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Hora Início *</label>
                  <input
                    type="time"
                    className="form-input"
                    value={formTurno.hora_inicio}
                    onChange={e => setFormTurno({ ...formTurno, hora_inicio: e.target.value })}
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">Hora Fim *</label>
                  <input
                    type="time"
                    className="form-input"
                    value={formTurno.hora_fim}
                    onChange={e => setFormTurno({ ...formTurno, hora_fim: e.target.value })}
                    required
                  />
                </div>
              </div>
              
              <div className="form-group">
                <label className="form-label">Dias da Semana *</label>
                <div className="flex flex-wrap gap-2">
                  {diasSemana.map(dia => (
                    <label key={dia.valor} className="flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={formTurno.dias_semana.includes(dia.valor)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormTurno({
                              ...formTurno,
                              dias_semana: [...formTurno.dias_semana, dia.valor]
                            });
                          } else {
                            setFormTurno({
                              ...formTurno,
                              dias_semana: formTurno.dias_semana.filter(d => d !== dia.valor)
                            });
                          }
                        }}
                      />
                      {dia.nome}
                    </label>
                  ))}
                </div>
              </div>
              
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModalTurno(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  Criar Turno
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Gerar Automático */}
      {showModalAuto && (
        <div className="modal-overlay" onClick={() => setShowModalAuto(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Gerar Escalas Automaticamente</h2>
              <button className="modal-close" onClick={() => setShowModalAuto(false)}>
                <X size={24} />
              </button>
            </div>
            
            <div className="alert alert-info">
              <Wand2 size={20} />
              As escalas serão geradas automaticamente distribuindo os funcionários de forma rotativa nos dias do turno selecionado.
            </div>
            
            <form onSubmit={handleGerarAutomatico}>
              <div className="form-group">
                <label className="form-label">Turno *</label>
                <select
                  className="form-select"
                  value={formAuto.turno_id}
                  onChange={e => setFormAuto({ ...formAuto, turno_id: e.target.value })}
                  required
                >
                  <option value="">Selecione um turno...</option>
                  {turnos.map(t => (
                    <option key={t.id} value={t.id}>{t.nome} ({t.hora_inicio} - {t.hora_fim})</option>
                  ))}
                </select>
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Data Início *</label>
                  <input
                    type="date"
                    className="form-input"
                    value={formAuto.data_inicio}
                    onChange={e => setFormAuto({ ...formAuto, data_inicio: e.target.value })}
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">Data Fim *</label>
                  <input
                    type="date"
                    className="form-input"
                    value={formAuto.data_fim}
                    onChange={e => setFormAuto({ ...formAuto, data_fim: e.target.value })}
                    required
                  />
                </div>
              </div>
              
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModalAuto(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-warning">
                  <Wand2 size={18} />
                  Gerar Escalas
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
