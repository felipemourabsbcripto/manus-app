import { useState, useEffect, useRef } from 'react';
import { 
  FileText, Download, Calendar, Users, AlertTriangle, CheckCircle,
  Clock, DollarSign, MessageSquare, RefreshCw, Eye, FileDown, Printer,
  Building, User, Phone, Mail, MapPin
} from 'lucide-react';
import { format, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { API_URL } from '../config';

function Relatorios() {
  const [gestores, setGestores] = useState([]);
  const [gestorSelecionado, setGestorSelecionado] = useState('');
  const [relatorios, setRelatorios] = useState([]);
  const [relatorioAtual, setRelatorioAtual] = useState(null);
  const [loading, setLoading] = useState(true);
  const [gerando, setGerando] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const printRef = useRef();
  
  const [filtros, setFiltros] = useState({
    periodo_inicio: format(subMonths(new Date(), 1), 'yyyy-MM-dd'),
    periodo_fim: format(new Date(), 'yyyy-MM-dd')
  });

  useEffect(() => {
    fetchGestores();
  }, []);

  useEffect(() => {
    if (gestorSelecionado) {
      fetchRelatorios();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gestorSelecionado]);

  const fetchGestores = async () => {
    try {
      const res = await fetch(`${API_URL}/gestores`);
      const data = await res.json();
      setGestores(data);
      if (data.length > 0) {
        setGestorSelecionado(data[0].id);
      }
    } catch (error) {
      console.error('Erro:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRelatorios = async () => {
    try {
      const res = await fetch(`${API_URL}/relatorios/${gestorSelecionado}`);
      setRelatorios(await res.json());
    } catch (error) {
      console.error('Erro:', error);
    }
  };

  const gerarRelatorio = async () => {
    setGerando(true);
    try {
      const res = await fetch(`${API_URL}/relatorios/gerar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gestor_id: gestorSelecionado,
          periodo_inicio: filtros.periodo_inicio,
          periodo_fim: filtros.periodo_fim
        })
      });
      const data = await res.json();
      setRelatorioAtual(data);
      fetchRelatorios();
    } catch (error) {
      console.error('Erro:', error);
      alert('Erro ao gerar relatório');
    } finally {
      setGerando(false);
    }
  };

  const verRelatorio = async (id) => {
    try {
      const res = await fetch(`${API_URL}/relatorios/detalhes/${id}`);
      const data = await res.json();
      setRelatorioAtual(data.dados);
    } catch (error) {
      console.error('Erro:', error);
    }
  };

  // Gerar TXT no formato escala.app
  const gerarTXT = () => {
    if (!relatorioAtual) return;
    
    const gestor = gestores.find(g => g.id === gestorSelecionado);
    const linhas = [];
    
    linhas.push('═══════════════════════════════════════════════════════════════════════════');
    linhas.push('                          RELATÓRIO DE PLANTÕES                             ');
    linhas.push('                              ESCALA PRO                                    ');
    linhas.push('═══════════════════════════════════════════════════════════════════════════');
    linhas.push('');
    linhas.push(`Gestor/Coordenador: ${relatorioAtual.gestor || gestor?.nome || 'N/A'}`);
    linhas.push(`Período: ${format(new Date(filtros.periodo_inicio), 'dd/MM/yyyy')} a ${format(new Date(filtros.periodo_fim), 'dd/MM/yyyy')}`);
    linhas.push(`Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`);
    linhas.push('');
    linhas.push('───────────────────────────────────────────────────────────────────────────');
    linhas.push('                              RESUMO GERAL                                  ');
    linhas.push('───────────────────────────────────────────────────────────────────────────');
    linhas.push('');
    linhas.push(`  Total de Presenças:       ${relatorioAtual.resumo?.total_presencas || 0}`);
    linhas.push(`  Presentes no Horário:     ${relatorioAtual.resumo?.presentes || 0}`);
    linhas.push(`  Atrasos:                  ${relatorioAtual.resumo?.atrasos || 0}`);
    linhas.push(`  Furos/Faltas:             ${relatorioAtual.resumo?.furos || 0}`);
    linhas.push(`  Horas Extras Registradas: ${relatorioAtual.resumo?.horas_extras || 0}min`);
    linhas.push(`  Mensagens Enviadas:       ${relatorioAtual.mensagens_enviadas || 0}`);
    linhas.push('');
    
    // Taxa de presença
    const total = relatorioAtual.resumo?.total_presencas || 1;
    const presentes = relatorioAtual.resumo?.presentes || 0;
    const taxaPresenca = ((presentes / total) * 100).toFixed(1);
    linhas.push(`  Taxa de Presença: ${taxaPresenca}%`);
    linhas.push('');
    
    linhas.push('───────────────────────────────────────────────────────────────────────────');
    linhas.push('                        DETALHAMENTO DE PRESENÇAS                          ');
    linhas.push('───────────────────────────────────────────────────────────────────────────');
    linhas.push('');
    linhas.push('  DATA       | COLABORADOR           | ENTRADA | SAÍDA   | STATUS    | H.EXTRA');
    linhas.push('  -----------+----------------------+---------+---------+-----------+--------');
    
    if (relatorioAtual.presencas?.length > 0) {
      relatorioAtual.presencas.forEach(p => {
        const data = format(new Date(p.data + 'T00:00:00'), 'dd/MM/yyyy');
        const nome = (p.nome || 'N/A').substring(0, 20).padEnd(20);
        const entrada = (p.hora_entrada || '--:--').padEnd(7);
        const saida = (p.hora_saida || '--:--').padEnd(7);
        const status = (p.status || 'N/A').substring(0, 9).padEnd(9);
        const horaExtra = p.hora_extra_minutos > 0 ? `${p.hora_extra_minutos}min` : '-';
        linhas.push(`  ${data} | ${nome} | ${entrada} | ${saida} | ${status} | ${horaExtra}`);
      });
    } else {
      linhas.push('  Nenhuma presença registrada no período');
    }
    
    linhas.push('');
    linhas.push('───────────────────────────────────────────────────────────────────────────');
    linhas.push('                            EVENTOS (BACKLOG)                              ');
    linhas.push('───────────────────────────────────────────────────────────────────────────');
    linhas.push('');
    
    if (relatorioAtual.backlog?.length > 0) {
      relatorioAtual.backlog.forEach(b => {
        const data = format(new Date(b.data_evento), 'dd/MM HH:mm');
        linhas.push(`  [${b.tipo.toUpperCase()}] ${data} - ${b.titulo}`);
        if (b.descricao) linhas.push(`    └─ ${b.descricao}`);
      });
    } else {
      linhas.push('  Nenhum evento registrado no período');
    }
    
    linhas.push('');
    linhas.push('═══════════════════════════════════════════════════════════════════════════');
    linhas.push('                         FIM DO RELATÓRIO                                  ');
    linhas.push('              Sistema EscalaPro - Gestão de Plantões                       ');
    linhas.push('═══════════════════════════════════════════════════════════════════════════');
    
    const texto = linhas.join('\n');
    const blob = new Blob([texto], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio_${relatorioAtual.gestor || 'geral'}_${filtros.periodo_inicio}_${filtros.periodo_fim}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Gerar PDF usando print do navegador
  const gerarPDF = () => {
    setShowPreview(true);
    setTimeout(() => {
      window.print();
    }, 300);
  };

  // Exportar JSON
  const exportarJSON = () => {
    if (!relatorioAtual) return;
    
    const dataStr = JSON.stringify(relatorioAtual, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `relatorio_${relatorioAtual.gestor}_${relatorioAtual.periodo?.inicio}_${relatorioAtual.periodo?.fim}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  if (loading) {
    return <div className="loading"><div className="spinner"></div></div>;
  }

  return (
    <div>
      {/* Estilos para impressão */}
      <style>
        {`
          @media print {
            body * { visibility: hidden; }
            .print-area, .print-area * { visibility: visible; }
            .print-area { 
              position: absolute; 
              left: 0; 
              top: 0; 
              width: 100%;
              padding: 20px;
            }
            .no-print { display: none !important; }
            .print-header { display: block !important; }
          }
          .print-header { display: none; }
        `}
      </style>

      <div className="page-header no-print">
        <div>
          <h1 className="page-title">Relatórios</h1>
          <p className="page-subtitle">Gerar relatórios de plantões e presenças • Estilo EscalaPro</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="card mb-3 no-print">
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Gestor</label>
            <select
              className="form-select"
              value={gestorSelecionado}
              onChange={e => setGestorSelecionado(e.target.value)}
            >
              {gestores.map(g => (
                <option key={g.id} value={g.id}>{g.nome}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Data Inicial</label>
            <input
              type="date"
              className="form-input"
              value={filtros.periodo_inicio}
              onChange={e => setFiltros({ ...filtros, periodo_inicio: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Data Final</label>
            <input
              type="date"
              className="form-input"
              value={filtros.periodo_fim}
              onChange={e => setFiltros({ ...filtros, periodo_fim: e.target.value })}
            />
          </div>
          <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button 
              className="btn btn-primary w-full"
              onClick={gerarRelatorio}
              disabled={gerando}
            >
              <FileText size={18} />
              {gerando ? 'Gerando...' : 'Gerar Relatório'}
            </button>
          </div>
        </div>
      </div>

      <div className="grid-2 no-print">
        {/* Lista de Relatórios */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Relatórios Gerados</h2>
            <button className="btn btn-secondary btn-sm" onClick={fetchRelatorios}>
              <RefreshCw size={16} />
            </button>
          </div>

          {relatorios.length > 0 ? (
            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
              {relatorios.map(rel => (
                <div 
                  key={rel.id} 
                  className="notification-item"
                  style={{ cursor: 'pointer', borderRadius: '0.5rem', marginBottom: '0.5rem' }}
                  onClick={() => verRelatorio(rel.id)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold">
                        {format(new Date(rel.periodo_inicio), 'dd/MM/yyyy')} - {format(new Date(rel.periodo_fim), 'dd/MM/yyyy')}
                      </p>
                      <p className="text-xs text-secondary">
                        Gerado em: {format(new Date(rel.created_at), 'dd/MM/yyyy HH:mm')}
                      </p>
                    </div>
                    <button className="btn btn-secondary btn-sm">
                      <Eye size={14} />
                      Ver
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <FileText size={48} />
              <p>Nenhum relatório gerado</p>
            </div>
          )}
        </div>

        {/* Resumo do Relatório */}
        {relatorioAtual && (
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Resumo do Relatório</h2>
              <div className="flex gap-1">
                <button className="btn btn-info btn-sm" onClick={gerarPDF} title="Exportar PDF">
                  <Printer size={16} />
                  PDF
                </button>
                <button className="btn btn-warning btn-sm" onClick={gerarTXT} title="Exportar TXT">
                  <FileDown size={16} />
                  TXT
                </button>
                <button className="btn btn-secondary btn-sm" onClick={exportarJSON} title="Exportar JSON">
                  <Download size={16} />
                  JSON
                </button>
              </div>
            </div>

            <div className="mb-3">
              <p className="text-secondary">Gestor: <strong>{relatorioAtual.gestor}</strong></p>
              <p className="text-secondary">
                Período: <strong>{relatorioAtual.periodo?.inicio}</strong> a <strong>{relatorioAtual.periodo?.fim}</strong>
              </p>
            </div>

            <div className="stats-grid" style={{ marginBottom: '1rem' }}>
              <div className="stat-card">
                <div className="stat-icon blue">
                  <Calendar size={20} />
                </div>
                <div className="stat-info">
                  <h3>{relatorioAtual.resumo?.total_presencas || 0}</h3>
                  <p className="text-xs">Total Presenças</p>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon green">
                  <CheckCircle size={20} />
                </div>
                <div className="stat-info">
                  <h3>{relatorioAtual.resumo?.presentes || 0}</h3>
                  <p className="text-xs">Presentes</p>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon yellow">
                  <Clock size={20} />
                </div>
                <div className="stat-info">
                  <h3>{relatorioAtual.resumo?.atrasos || 0}</h3>
                  <p className="text-xs">Atrasos</p>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon red">
                  <AlertTriangle size={20} />
                </div>
                <div className="stat-info">
                  <h3>{relatorioAtual.resumo?.furos || 0}</h3>
                  <p className="text-xs">Furos</p>
                </div>
              </div>
            </div>

            <p className="text-sm text-secondary">
              <MessageSquare size={14} className="inline mr-1" />
              {relatorioAtual.mensagens_enviadas || 0} mensagens enviadas no período
            </p>
          </div>
        )}
      </div>

      {/* ========== ÁREA DE IMPRESSÃO (PDF) ========== */}
      {relatorioAtual && (
        <div className="print-area" ref={printRef}>
          {/* Header do PDF */}
          <div className="print-header" style={{ 
            borderBottom: '3px solid #1e40af', 
            paddingBottom: '20px', 
            marginBottom: '20px',
            display: showPreview ? 'block' : 'none'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h1 style={{ fontSize: '24px', color: '#1e40af', marginBottom: '5px' }}>RELATÓRIO DE PLANTÕES</h1>
                <p style={{ color: '#64748b', fontSize: '14px' }}>Sistema EscalaPro - Gestão de Escalas</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontWeight: 'bold' }}>Período:</p>
                <p>{format(new Date(filtros.periodo_inicio), 'dd/MM/yyyy')} a {format(new Date(filtros.periodo_fim), 'dd/MM/yyyy')}</p>
              </div>
            </div>
          </div>

          {/* Informações do Gestor */}
          <div style={{ 
            background: '#f8fafc', 
            padding: '15px', 
            borderRadius: '8px', 
            marginBottom: '20px',
            display: showPreview ? 'block' : 'none'
          }}>
            <h3 style={{ color: '#1e40af', marginBottom: '10px' }}>
              <User size={18} style={{ display: 'inline', marginRight: '8px' }} />
              Coordenador/Gestor
            </h3>
            <p><strong>{relatorioAtual.gestor}</strong></p>
          </div>

          {/* Resumo Estatístico */}
          <div style={{ 
            display: showPreview ? 'grid' : 'none', 
            gridTemplateColumns: 'repeat(4, 1fr)', 
            gap: '15px', 
            marginBottom: '20px' 
          }}>
            <div style={{ background: '#dbeafe', padding: '15px', borderRadius: '8px', textAlign: 'center' }}>
              <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#1e40af' }}>{relatorioAtual.resumo?.total_presencas || 0}</p>
              <p style={{ color: '#64748b', fontSize: '12px' }}>Total Escalas</p>
            </div>
            <div style={{ background: '#dcfce7', padding: '15px', borderRadius: '8px', textAlign: 'center' }}>
              <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#16a34a' }}>{relatorioAtual.resumo?.presentes || 0}</p>
              <p style={{ color: '#64748b', fontSize: '12px' }}>Presentes</p>
            </div>
            <div style={{ background: '#fef3c7', padding: '15px', borderRadius: '8px', textAlign: 'center' }}>
              <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#d97706' }}>{relatorioAtual.resumo?.atrasos || 0}</p>
              <p style={{ color: '#64748b', fontSize: '12px' }}>Atrasos</p>
            </div>
            <div style={{ background: '#fee2e2', padding: '15px', borderRadius: '8px', textAlign: 'center' }}>
              <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#dc2626' }}>{relatorioAtual.resumo?.furos || 0}</p>
              <p style={{ color: '#64748b', fontSize: '12px' }}>Furos/Faltas</p>
            </div>
          </div>

          {/* Detalhes do Relatório (visível sempre) */}
          <div className="card mt-3">
            <div className="card-header">
              <h2 className="card-title">Detalhamento de Presenças</h2>
              <span className="text-secondary">{relatorioAtual.presencas?.length || 0} registros</span>
            </div>

            {relatorioAtual.presencas?.length > 0 ? (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Colaborador</th>
                      <th>Especialidade</th>
                      <th>Entrada</th>
                      <th>Saída</th>
                      <th>Status</th>
                      <th>Hora Extra</th>
                    </tr>
                  </thead>
                  <tbody>
                    {relatorioAtual.presencas.map(p => (
                      <tr key={p.id}>
                        <td>{format(new Date(p.data + 'T00:00:00'), 'dd/MM/yyyy')}</td>
                        <td>{p.nome}</td>
                        <td>{p.especialidade || '-'}</td>
                        <td>{p.hora_entrada || '-'}</td>
                        <td>{p.hora_saida || '-'}</td>
                        <td>
                          <span className={`badge badge-${
                            p.status === 'presente' ? 'success' :
                            p.status === 'atraso' ? 'warning' :
                            p.status === 'furo' || p.status === 'falta' ? 'danger' : 'secondary'
                          }`}>
                            {p.status}
                          </span>
                        </td>
                        <td>
                          {p.hora_extra_minutos > 0 
                            ? `${Math.floor(p.hora_extra_minutos / 60)}h ${p.hora_extra_minutos % 60}min`
                            : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state">
                <Calendar size={48} />
                <p>Nenhuma presença no período</p>
              </div>
            )}
          </div>

          {/* Backlog */}
          <div className="card mt-3">
            <div className="card-header">
              <h2 className="card-title">Backlog de Eventos</h2>
              <span className="text-secondary">{relatorioAtual.backlog?.length || 0} eventos</span>
            </div>

            {relatorioAtual.backlog?.length > 0 ? (
              <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                {relatorioAtual.backlog.map(b => (
                  <div key={b.id} className="notification-item" style={{ borderBottom: '1px solid var(--border)' }}>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`badge badge-${
                            b.tipo === 'checkin' || b.tipo === 'checkout' ? 'success' :
                            b.tipo === 'furo' || b.tipo === 'falta' ? 'danger' :
                            b.tipo === 'atraso' ? 'warning' : 'info'
                          }`}>
                            {b.tipo}
                          </span>
                          <span className="font-semibold">{b.titulo}</span>
                        </div>
                        <p className="text-sm text-secondary">{b.descricao}</p>
                        <p className="text-xs text-secondary">{b.nome}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-secondary">
                          {format(new Date(b.data_evento), 'dd/MM/yyyy HH:mm')}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <FileText size={48} />
                <p>Nenhum evento no período</p>
              </div>
            )}
          </div>

          {/* Rodapé do PDF */}
          <div style={{ 
            marginTop: '30px', 
            paddingTop: '20px', 
            borderTop: '1px solid #e2e8f0', 
            textAlign: 'center',
            display: showPreview ? 'block' : 'none'
          }}>
            <p style={{ color: '#64748b', fontSize: '12px' }}>
              Relatório gerado automaticamente pelo Sistema EscalaPro em {format(new Date(), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
            </p>
            <p style={{ color: '#94a3b8', fontSize: '10px', marginTop: '5px' }}>
              Este documento é de uso interno e confidencial
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default Relatorios;
