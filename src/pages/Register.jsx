import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { Loader2, Plus } from 'lucide-react';
import './Login.css';
import logo from '../assets/logo-login-new.jpg';

// Lista de especialidades médicas
const ESPECIALIDADES = [
    'Sem especialidade',
    'Anestesiologia',
    'Cardiologia',
    'Cirurgia Geral',
    'Cirurgia Plástica',
    'Clínica Médica',
    'Dermatologia',
    'Endocrinologia',
    'Gastroenterologia',
    'Geriatria',
    'Ginecologia e Obstetrícia',
    'Hematologia',
    'Infectologia',
    'Medicina de Emergência',
    'Medicina Intensiva',
    'Nefrologia',
    'Neurologia',
    'Oftalmologia',
    'Oncologia',
    'Ortopedia e Traumatologia',
    'Otorrinolaringologia',
    'Pediatria',
    'Pneumologia',
    'Psiquiatria',
    'Radiologia',
    'Reumatologia',
    'Urologia',
    '+ Adicionar outra'
];

export default function Register() {
    const [nome, setNome] = useState('');
    const [email, setEmail] = useState('');
    const [senha, setSenha] = useState('');
    const [telefone, setTelefone] = useState('');
    const [crm, setCrm] = useState('');
    const [uf, setUf] = useState('MG');
    const [crmData, setCrmData] = useState(null);
    
    // Novos campos de especialidade
    const [especialidade, setEspecialidade] = useState('');
    const [especialidadeCustom, setEspecialidadeCustom] = useState('');
    const [showCustomEspecialidade, setShowCustomEspecialidade] = useState(false);
    const [hasRQE, setHasRQE] = useState(false);
    const [hasPOS, setHasPOS] = useState(false);
    const [rqeNumero, setRqeNumero] = useState('');

    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const { register } = useAuth();
    const navigate = useNavigate();

    const verificarCRM = async () => {
        if (crm.length < 4) return;

        try {
            const response = await fetch(`/api/crm/consulta?crm=${crm}&uf=${uf}`);
            const data = await response.json();

            if (response.ok) {
                setCrmData(data);
                if (!nome) setNome(data.nome);
                // Auto-preencher especialidade se encontrada no CRM
                if (data.especialidade && !especialidade) {
                    const found = ESPECIALIDADES.find(e => 
                        e.toLowerCase().includes(data.especialidade.toLowerCase()) ||
                        data.especialidade.toLowerCase().includes(e.toLowerCase())
                    );
                    if (found && found !== '+ Adicionar outra') {
                        setEspecialidade(found);
                    }
                }
                setError('');
            } else {
                setCrmData(null);
                setError(data.error || 'CRM não encontrado');
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleEspecialidadeChange = (value) => {
        setEspecialidade(value);
        if (value === '+ Adicionar outra') {
            setShowCustomEspecialidade(true);
        } else {
            setShowCustomEspecialidade(false);
            setEspecialidadeCustom('');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        
        // Validar campos obrigatórios
        if (!nome.trim()) {
            setError('Nome é obrigatório');
            return;
        }
        if (!crm.trim()) {
            setError('CRM é obrigatório');
            return;
        }
        if (!telefone.trim()) {
            setError('WhatsApp é obrigatório');
            return;
        }
        
        setLoading(true);

        // Determinar especialidade final
        const especialidadeFinal = showCustomEspecialidade 
            ? especialidadeCustom 
            : (especialidade === 'Sem especialidade' ? '' : especialidade);

        const result = await register({
            nome,
            email: email || null,
            senha: senha || null,
            telefone,
            crm,
            uf,
            especialidade: especialidadeFinal || crmData?.especialidade || '',
            rqe: hasRQE ? rqeNumero : null,
            pos_graduacao: hasPOS
        });

        if (result.success) {
            navigate('/dashboard');
        } else {
            setError(result.error || 'Falha ao realizar cadastro');
            setLoading(false);
        }
    };

    return (
        <div className="login-container">
            <div className="login-card" style={{ maxWidth: '480px' }}>
                {/* Header / Logo */}
                <div className="logo-wrapper">
                    <img
                        src={logo}
                        alt="Hospital Santa Casa BH"
                        className="logo-img"
                    />
                    <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block' }}>Hospital</span>
                    <h2 className="institution-name">Santa Casa BH</h2>
                </div>

                <h1 className="login-title">Solicitar Acesso</h1>
                <p className="login-subtitle">Preencha seus dados para criar sua conta</p>

                {error && (
                    <div style={{
                        marginBottom: '1rem',
                        padding: '0.75rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem',
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.2)',
                        borderRadius: '8px',
                        color: '#ef4444'
                    }}>
                        <span>{error}</span>
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div className="input-group">
                        <label className="input-label" htmlFor="nome">Nome Completo *</label>
                        <input
                            id="nome"
                            type="text"
                            className="input-field"
                            placeholder="Seu nome completo"
                            value={nome}
                            onChange={(e) => setNome(e.target.value)}
                            required
                        />
                    </div>

                    {/* CRM e UF - Obrigatórios */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: '1rem', marginBottom: '20px' }}>
                        <div className="input-group" style={{ marginBottom: 0 }}>
                            <label className="input-label" htmlFor="crm">CRM *</label>
                            <input
                                id="crm"
                                type="text"
                                className="input-field"
                                placeholder="123456"
                                value={crm}
                                onChange={(e) => setCrm(e.target.value)}
                                onBlur={verificarCRM}
                                required
                            />
                        </div>
                        <div className="input-group" style={{ marginBottom: 0 }}>
                            <label className="input-label" htmlFor="uf">UF</label>
                            <select
                                id="uf"
                                className="input-field"
                                value={uf}
                                onChange={(e) => setUf(e.target.value)}
                                style={{ height: '52px' }}
                            >
                                <option value="AC">AC</option>
                                <option value="AL">AL</option>
                                <option value="AP">AP</option>
                                <option value="AM">AM</option>
                                <option value="BA">BA</option>
                                <option value="CE">CE</option>
                                <option value="DF">DF</option>
                                <option value="ES">ES</option>
                                <option value="GO">GO</option>
                                <option value="MA">MA</option>
                                <option value="MT">MT</option>
                                <option value="MS">MS</option>
                                <option value="MG">MG</option>
                                <option value="PA">PA</option>
                                <option value="PB">PB</option>
                                <option value="PR">PR</option>
                                <option value="PE">PE</option>
                                <option value="PI">PI</option>
                                <option value="RJ">RJ</option>
                                <option value="RN">RN</option>
                                <option value="RS">RS</option>
                                <option value="RO">RO</option>
                                <option value="RR">RR</option>
                                <option value="SC">SC</option>
                                <option value="SP">SP</option>
                                <option value="SE">SE</option>
                                <option value="TO">TO</option>
                            </select>
                        </div>
                    </div>

                    {crmData && (
                        <div style={{ 
                            padding: '0.75rem', 
                            background: 'rgba(16, 185, 129, 0.1)', 
                            borderRadius: '8px', 
                            border: '1px solid rgba(16, 185, 129, 0.3)', 
                            fontSize: '0.85rem', 
                            display: 'flex', 
                            gap: '0.5rem', 
                            alignItems: 'center',
                            marginBottom: '20px'
                        }}>
                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }}></div>
                            <div>
                                <strong style={{ color: '#10b981', display: 'block' }}>CRM Válido</strong>
                                <span style={{ color: '#64748b' }}>{crmData.nome} - {crmData.especialidade}</span>
                            </div>
                        </div>
                    )}

                    {/* Especialidade - Opcional */}
                    <div className="input-group">
                        <label className="input-label" htmlFor="especialidade">Especialidade (opcional)</label>
                        <select
                            id="especialidade"
                            className="input-field"
                            value={especialidade}
                            onChange={(e) => handleEspecialidadeChange(e.target.value)}
                            style={{ height: '52px' }}
                        >
                            <option value="">Selecione uma especialidade...</option>
                            {ESPECIALIDADES.map(esp => (
                                <option key={esp} value={esp}>{esp}</option>
                            ))}
                        </select>
                    </div>

                    {/* Campo customizado para especialidade */}
                    {showCustomEspecialidade && (
                        <div className="input-group">
                            <label className="input-label" htmlFor="especialidadeCustom">
                                <Plus size={14} style={{ marginRight: '4px', display: 'inline' }} />
                                Digite sua especialidade
                            </label>
                            <input
                                id="especialidadeCustom"
                                type="text"
                                className="input-field"
                                placeholder="Ex: Medicina do Esporte"
                                value={especialidadeCustom}
                                onChange={(e) => setEspecialidadeCustom(e.target.value)}
                            />
                        </div>
                    )}

                    {/* RQE e PÓS - Opcionais */}
                    <div style={{ 
                        display: 'flex', 
                        gap: '1.5rem', 
                        marginBottom: '20px',
                        padding: '1rem',
                        background: 'rgba(99, 102, 241, 0.05)',
                        borderRadius: '8px',
                        border: '1px solid rgba(99, 102, 241, 0.1)'
                    }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem' }}>
                            <input
                                type="checkbox"
                                checked={hasRQE}
                                onChange={(e) => setHasRQE(e.target.checked)}
                                style={{ width: '18px', height: '18px', accentColor: '#6366f1' }}
                            />
                            <span style={{ color: '#334155', fontWeight: 500 }}>RQE</span>
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem' }}>
                            <input
                                type="checkbox"
                                checked={hasPOS}
                                onChange={(e) => setHasPOS(e.target.checked)}
                                style={{ width: '18px', height: '18px', accentColor: '#6366f1' }}
                            />
                            <span style={{ color: '#334155', fontWeight: 500 }}>Pós-Graduação</span>
                        </label>
                    </div>

                    {/* Campo RQE número - aparece se marcou RQE */}
                    {hasRQE && (
                        <div className="input-group">
                            <label className="input-label" htmlFor="rqeNumero">Número do RQE</label>
                            <input
                                id="rqeNumero"
                                type="text"
                                className="input-field"
                                placeholder="12345"
                                value={rqeNumero}
                                onChange={(e) => setRqeNumero(e.target.value)}
                            />
                        </div>
                    )}

                    {/* WhatsApp - Obrigatório */}
                    <div className="input-group">
                        <label className="input-label" htmlFor="telefone">WhatsApp *</label>
                        <input
                            id="telefone"
                            type="tel"
                            className="input-field"
                            placeholder="(31) 99999-9999"
                            value={telefone}
                            onChange={(e) => setTelefone(e.target.value)}
                            required
                        />
                    </div>

                    {/* Email - Opcional */}
                    <div className="input-group">
                        <label className="input-label" htmlFor="email">Email Corporativo (opcional)</label>
                        <input
                            id="email"
                            type="email"
                            className="input-field"
                            placeholder="seu.nome@santacasabh.com.br"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </div>

                    {/* Senha - Opcional */}
                    <div className="input-group">
                        <label className="input-label" htmlFor="senha">Senha (opcional)</label>
                        <input
                            id="senha"
                            type="password"
                            className="input-field"
                            placeholder="••••••••"
                            value={senha}
                            onChange={(e) => setSenha(e.target.value)}
                        />
                        <span style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px', display: 'block' }}>
                            Se não definir, você poderá usar login social
                        </span>
                    </div>

                    <button type="submit" className="btn-login" disabled={loading}>
                        {loading ? (
                            <Loader2 size={24} className="spinner" />
                        ) : (
                            <span>Criar minha conta</span>
                        )}
                    </button>
                </form>

                <div className="footer-link">
                    Já tem acesso? <Link to="/login">Fazer Login</Link>
                </div>

                <div className="app-footer" style={{ fontSize: '12px', color: '#94a3b8', width: '100%', marginTop: '1.5rem' }}>
                    &copy; 2026 Hospital Santa Casa BH
                </div>
            </div>
        </div>
    );
}
