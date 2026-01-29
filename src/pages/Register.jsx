import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import './Login.css';
import logo from '../assets/logo-login-new.jpg';

export default function Register() {
    const [nome, setNome] = useState('');
    const [email, setEmail] = useState('');
    const [senha, setSenha] = useState('');
    const [telefone, setTelefone] = useState('');
    const [crm, setCrm] = useState('');
    const [uf, setUf] = useState('MG');
    const [crmData, setCrmData] = useState(null);

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
                setError('');
            } else {
                setCrmData(null);
                setError(data.error || 'CRM não encontrado');
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        const result = await register({
            nome,
            email,
            senha,
            telefone,
            crm,
            uf,
            especialidade: crmData?.especialidade
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
                        <label className="input-label" htmlFor="nome">Nome Completo</label>
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

                    <div className="input-group">
                        <label className="input-label" htmlFor="email">Email Corporativo</label>
                        <input
                            id="email"
                            type="email"
                            className="input-field"
                            placeholder="seu.nome@santacasabh.com.br"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: '1rem', marginBottom: '20px' }}>
                        <div className="input-group" style={{ marginBottom: 0 }}>
                            <label className="input-label" htmlFor="crm">CRM</label>
                            <input
                                id="crm"
                                type="text"
                                className="input-field"
                                placeholder="123456"
                                value={crm}
                                onChange={(e) => setCrm(e.target.value)}
                                onBlur={verificarCRM}
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

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '20px' }}>
                        <div className="input-group" style={{ marginBottom: 0 }}>
                            <label className="input-label" htmlFor="telefone">WhatsApp</label>
                            <input
                                id="telefone"
                                type="tel"
                                className="input-field"
                                placeholder="(31) 99999-9999"
                                value={telefone}
                                onChange={(e) => setTelefone(e.target.value)}
                            />
                        </div>
                        <div className="input-group" style={{ marginBottom: 0 }}>
                            <label className="input-label" htmlFor="senha">Senha</label>
                            <input
                                id="senha"
                                type="password"
                                className="input-field"
                                placeholder="••••••••"
                                value={senha}
                                onChange={(e) => setSenha(e.target.value)}
                                required
                            />
                        </div>
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
