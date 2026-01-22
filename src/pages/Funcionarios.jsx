import { useState, useEffect } from 'react';
import { Users, Plus, Edit2, Trash2, X, Search, Phone, Mail, Stethoscope, UserCog } from 'lucide-react';
import { API_URL } from '../config';

// Lista de especialidades médicas
const ESPECIALIDADES = [
  'Acupuntura',
  'Alergia e Imunologia',
  'Anestesiologia',
  'Angiologia',
  'Cancerologia (Oncologia)',
  'Cardiologia',
  'Cirurgia Cardiovascular',
  'Cirurgia da Mão',
  'Cirurgia de Cabeça e Pescoço',
  'Cirurgia do Aparelho Digestivo',
  'Cirurgia Geral',
  'Cirurgia Pediátrica',
  'Cirurgia Plástica',
  'Cirurgia Torácica',
  'Cirurgia Vascular',
  'Clínica Médica',
  'Coloproctologia',
  'Dermatologia',
  'Endocrinologia e Metabologia',
  'Endoscopia',
  'Gastroenterologia',
  'Genética Médica',
  'Geriatria',
  'Ginecologia e Obstetrícia',
  'Hematologia e Hemoterapia',
  'Homeopatia',
  'Infectologia',
  'Mastologia',
  'Medicina de Emergência',
  'Medicina de Família e Comunidade',
  'Medicina do Trabalho',
  'Medicina do Tráfego',
  'Medicina Esportiva',
  'Medicina Física e Reabilitação',
  'Medicina Intensiva',
  'Medicina Legal e Perícia Médica',
  'Medicina Nuclear',
  'Medicina Preventiva e Social',
  'Nefrologia',
  'Neurocirurgia',
  'Neurologia',
  'Nutrologia',
  'Oftalmologia',
  'Ortopedia e Traumatologia',
  'Otorrinolaringologia',
  'Patologia',
  'Patologia Clínica/Medicina Laboratorial',
  'Pediatria',
  'Pneumologia',
  'Psiquiatria',
  'Radiologia e Diagnóstico por Imagem',
  'Radioterapia',
  'Reumatologia',
  'Urologia'
];

function Funcionarios() {
  const [funcionarios, setFuncionarios] = useState([]);
  const [gestores, setGestores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editando, setEditando] = useState(null);
  const [busca, setBusca] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [form, setForm] = useState({
    nome: '',
    email: '',
    telefone: '',
    whatsapp: '',
    cargo: '',
    especialidade: '',
    crm: '',
    tipo: 'medico',
    gestor_id: '',
    salario_hora: ''
  });

  useEffect(() => {
    fetchFuncionarios();
    fetchGestores();
  }, [filtroTipo]);

  const fetchFuncionarios = async () => {
    try {
      let url = `${API_URL}/funcionarios`;
      if (filtroTipo) url += `?tipo=${filtroTipo}`;
      const res = await fetch(url);
      const data = await res.json();
      setFuncionarios(data);
    } catch (error) {
      console.error('Erro ao buscar funcionários:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchGestores = async () => {
    try {
      const res = await fetch(`${API_URL}/gestores`);
      setGestores(await res.json());
    } catch (error) {
      console.error('Erro:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validações para médico
    if (form.tipo === 'medico') {
      if (!form.nome || !form.crm || !form.especialidade || !form.whatsapp) {
        alert('Por favor, preencha todos os campos obrigatórios: Nome, CRM, Especialidade e WhatsApp');
        return;
      }
    }
    
    try {
      if (editando) {
        await fetch(`${API_URL}/funcionarios/${editando}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form)
        });
      } else {
        await fetch(`${API_URL}/funcionarios`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form)
        });
      }
      setShowModal(false);
      setEditando(null);
      resetForm();
      fetchFuncionarios();
      fetchGestores();
    } catch (error) {
      console.error('Erro ao salvar funcionário:', error);
    }
  };

  const resetForm = () => {
    setForm({
      nome: '',
      email: '',
      telefone: '',
      whatsapp: '',
      cargo: '',
      especialidade: '',
      crm: '',
      tipo: 'medico',
      gestor_id: '',
      salario_hora: ''
    });
  };

  const handleEdit = (funcionario) => {
    setForm({
      nome: funcionario.nome,
      email: funcionario.email || '',
      telefone: funcionario.telefone || '',
      whatsapp: funcionario.whatsapp || funcionario.telefone || '',
      cargo: funcionario.cargo || '',
      especialidade: funcionario.especialidade || '',
      crm: funcionario.crm || '',
      tipo: funcionario.tipo || 'medico',
      gestor_id: funcionario.gestor_id || '',
      salario_hora: funcionario.salario_hora || ''
    });
    setEditando(funcionario.id);
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Tem certeza que deseja excluir este cadastro?')) {
      try {
        await fetch(`${API_URL}/funcionarios/${id}`, { method: 'DELETE' });
        fetchFuncionarios();
      } catch (error) {
        console.error('Erro ao excluir funcionário:', error);
      }
    }
  };

  const funcionariosFiltrados = funcionarios.filter(f =>
    f.nome.toLowerCase().includes(busca.toLowerCase()) ||
    f.especialidade?.toLowerCase().includes(busca.toLowerCase()) ||
    f.crm?.toLowerCase().includes(busca.toLowerCase()) ||
    f.cargo?.toLowerCase().includes(busca.toLowerCase())
  );

  const getTipoBadge = (tipo) => {
    const tipos = {
      admin: { class: 'badge-danger', text: 'Admin', icon: UserCog },
      gestor: { class: 'badge-warning', text: 'Gestor', icon: UserCog },
      medico: { class: 'badge-info', text: 'Médico', icon: Stethoscope },
      funcionario: { class: 'badge-secondary', text: 'Funcionário', icon: Users }
    };
    const config = tipos[tipo] || tipos.funcionario;
    const Icon = config.icon;
    return (
      <span className={`badge ${config.class}`}>
        <Icon size={12} />
        {config.text}
      </span>
    );
  };

  const getGestorNome = (gestorId) => {
    const gestor = gestores.find(g => g.id === gestorId);
    return gestor?.nome || '-';
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
          <h1 className="page-title">Médicos e Gestores</h1>
          <p className="page-subtitle">Gerencie a equipe de plantão</p>
        </div>
        <button className="btn btn-primary" onClick={() => {
          resetForm();
          setEditando(null);
          setShowModal(true);
        }}>
          <Plus size={20} />
          Novo Cadastro
        </button>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="flex items-center gap-2 flex-wrap">
            <Search size={20} className="text-secondary" />
            <input
              type="text"
              className="form-input"
              placeholder="Buscar por nome, especialidade, CRM..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              style={{ maxWidth: '300px' }}
            />
            <select
              className="form-select"
              value={filtroTipo}
              onChange={e => setFiltroTipo(e.target.value)}
              style={{ maxWidth: '150px' }}
            >
              <option value="">Todos</option>
              <option value="admin">Admin</option>
              <option value="gestor">Gestores</option>
              <option value="medico">Médicos</option>
              <option value="funcionario">Funcionários</option>
            </select>
          </div>
          <span className="text-secondary">{funcionariosFiltrados.length} registros</span>
        </div>

        {funcionariosFiltrados.length > 0 ? (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Tipo</th>
                  <th>CRM</th>
                  <th>Especialidade</th>
                  <th>WhatsApp</th>
                  <th>Email</th>
                  <th>Gestor</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {funcionariosFiltrados.map(funcionario => (
                  <tr key={funcionario.id}>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className={`stat-icon ${funcionario.tipo === 'medico' ? 'cyan' : funcionario.tipo === 'gestor' ? 'yellow' : 'blue'}`} style={{ width: '36px', height: '36px' }}>
                          {funcionario.tipo === 'medico' ? <Stethoscope size={18} /> : <Users size={18} />}
                        </div>
                        <span className="font-medium">{funcionario.nome}</span>
                      </div>
                    </td>
                    <td>{getTipoBadge(funcionario.tipo)}</td>
                    <td>
                      {funcionario.crm ? (
                        <span className="badge badge-secondary">{funcionario.crm}</span>
                      ) : '-'}
                    </td>
                    <td>{funcionario.especialidade || funcionario.cargo || '-'}</td>
                    <td>
                      {funcionario.whatsapp && (
                        <div className="flex items-center gap-1 text-sm">
                          <Phone size={14} className="text-success" />
                          {funcionario.whatsapp}
                        </div>
                      )}
                    </td>
                    <td>
                      {funcionario.email && (
                        <div className="flex items-center gap-1 text-sm text-secondary">
                          <Mail size={14} />
                          {funcionario.email}
                        </div>
                      )}
                    </td>
                    <td>{getGestorNome(funcionario.gestor_id)}</td>
                    <td>
                      <div className="action-buttons">
                        <button className="btn btn-secondary btn-sm" onClick={() => handleEdit(funcionario)}>
                          <Edit2 size={14} />
                        </button>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(funcionario.id)}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <Users size={64} />
            <p>Nenhum cadastro encontrado</p>
            <button className="btn btn-primary mt-2" onClick={() => setShowModal(true)}>
              <Plus size={20} />
              Adicionar Primeiro
            </button>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">
                {editando ? 'Editar Cadastro' : 'Novo Cadastro'}
              </h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit}>
              {/* Tipo de cadastro */}
              <div className="form-group">
                <label className="form-label">Tipo de Cadastro *</label>
                <div className="flex gap-2 flex-wrap">
                  {[
                    { value: 'medico', label: 'Médico', icon: Stethoscope },
                    { value: 'gestor', label: 'Gestor', icon: UserCog },
                    { value: 'admin', label: 'Administrador', icon: UserCog }
                  ].map(tipo => (
                    <button
                      key={tipo.value}
                      type="button"
                      className={`btn ${form.tipo === tipo.value ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => setForm({ ...form, tipo: tipo.value })}
                    >
                      <tipo.icon size={18} />
                      {tipo.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Campos para MÉDICO */}
              {form.tipo === 'medico' && (
                <>
                  <div className="alert alert-info mb-3">
                    <Stethoscope size={20} />
                    <span>Cadastro de Médico - Preencha os campos obrigatórios</span>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Nome Completo *</label>
                    <input
                      type="text"
                      className="form-input"
                      value={form.nome}
                      onChange={e => setForm({ ...form, nome: e.target.value })}
                      placeholder="Dr(a). Nome Completo"
                      required
                    />
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">CRM *</label>
                      <input
                        type="text"
                        className="form-input"
                        value={form.crm}
                        onChange={e => setForm({ ...form, crm: e.target.value.toUpperCase() })}
                        placeholder="CRM/UF 000000"
                        required
                      />
                      <small className="text-secondary">Ex: CRM/SP 123456</small>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Especialidade *</label>
                      <select
                        className="form-select"
                        value={form.especialidade}
                        onChange={e => setForm({ ...form, especialidade: e.target.value })}
                        required
                      >
                        <option value="">Selecione a especialidade...</option>
                        {ESPECIALIDADES.map(esp => (
                          <option key={esp} value={esp}>{esp}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">WhatsApp *</label>
                      <input
                        type="text"
                        className="form-input"
                        value={form.whatsapp}
                        onChange={e => setForm({ ...form, whatsapp: e.target.value.replace(/\D/g, '') })}
                        placeholder="5511999999999"
                        required
                      />
                      <small className="text-secondary">Apenas números com DDD e DDI (55)</small>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Email</label>
                      <input
                        type="email"
                        className="form-input"
                        value={form.email}
                        onChange={e => setForm({ ...form, email: e.target.value })}
                        placeholder="medico@email.com"
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Gestor Responsável</label>
                      <select
                        className="form-select"
                        value={form.gestor_id}
                        onChange={e => setForm({ ...form, gestor_id: e.target.value })}
                      >
                        <option value="">Selecione o gestor...</option>
                        {gestores.map(g => (
                          <option key={g.id} value={g.id}>{g.nome}</option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Valor/Hora (R$)</label>
                      <input
                        type="number"
                        step="0.01"
                        className="form-input"
                        value={form.salario_hora}
                        onChange={e => setForm({ ...form, salario_hora: e.target.value })}
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Campos para GESTOR/ADMIN */}
              {(form.tipo === 'gestor' || form.tipo === 'admin') && (
                <>
                  <div className="alert alert-warning mb-3">
                    <UserCog size={20} />
                    <span>Cadastro de {form.tipo === 'admin' ? 'Administrador' : 'Gestor'}</span>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Nome Completo *</label>
                    <input
                      type="text"
                      className="form-input"
                      value={form.nome}
                      onChange={e => setForm({ ...form, nome: e.target.value })}
                      placeholder="Nome Completo"
                      required
                    />
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">WhatsApp *</label>
                      <input
                        type="text"
                        className="form-input"
                        value={form.whatsapp}
                        onChange={e => setForm({ ...form, whatsapp: e.target.value.replace(/\D/g, '') })}
                        placeholder="5511999999999"
                        required
                      />
                      <small className="text-secondary">Número para conexão do WhatsApp</small>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Email</label>
                      <input
                        type="email"
                        className="form-input"
                        value={form.email}
                        onChange={e => setForm({ ...form, email: e.target.value })}
                        placeholder="gestor@email.com"
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Cargo</label>
                    <input
                      type="text"
                      className="form-input"
                      value={form.cargo}
                      onChange={e => setForm({ ...form, cargo: e.target.value })}
                      placeholder="Ex: Coordenador de Plantão"
                    />
                  </div>
                </>
              )}
              
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  {editando ? 'Salvar Alterações' : 'Cadastrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Funcionarios;
