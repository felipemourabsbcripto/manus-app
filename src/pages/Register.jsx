import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { Lock, Mail, User, Phone, ChevronRight, Loader2, Heart } from 'lucide-react';

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
                // Opcional: Auto-preencher nome se vazio
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
        <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            background: 'radial-gradient(circle at top right, #1e1b4b, #020617)',
            padding: '1.5rem',
            position: 'relative',
            overflow: 'hidden'
        }}>
            {/* Elementos decorativos de fundo */}
            <div style={{ position: 'absolute', top: '-10%', left: '-10%', width: '40%', height: '40%', background: 'var(--glow)', filter: 'blur(120px)', borderRadius: '50%', opacity: 0.5 }}></div>
            <div style={{ position: 'absolute', bottom: '-10%', right: '-10%', width: '40%', height: '40%', background: 'var(--glow)', filter: 'blur(120px)', borderRadius: '50%', opacity: 0.3 }}></div>

            <div className="card" style={{
                width: '100%',
                maxWidth: '480px',
                padding: '3rem',
                border: '1px solid var(--border)',
                backdropFilter: 'blur(20px)',
                background: 'rgba(15, 23, 42, 0.6)',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                zIndex: 1
            }}>
                <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
                    <div style={{
                        display: 'inline-flex',
                        padding: '1.25rem',
                        borderRadius: '1.5rem',
                        background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)',
                        marginBottom: '1.5rem',
                        boxShadow: '0 0 30px var(--glow)'
                    }}>
                        <Heart size={40} fill="white" color="white" />
                    </div>
                    <h1 style={{
                        fontSize: '2rem',
                        fontWeight: 800,
                        marginBottom: '0.5rem',
                        letterSpacing: '-0.03em',
                        background: 'linear-gradient(to right, #ffffff, #94a3b8)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent'
                    }}>Seja bem-vindo</h1>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', fontWeight: 500 }}>Solicite seu acesso ao sistema</p>
                </div>

                {error && (
                    <div className="alert alert-danger" style={{ marginBottom: '1.5rem', fontSize: '0.9rem', borderRadius: '0.75rem' }}>
                        <span>{error}</span>
                    </div>
                )}

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Nome Completo</label>
                        <div style={{ position: 'relative' }}>
                            <User size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                            <input
                                type="text"
                                className="form-input"
                                style={{ paddingLeft: '3rem', height: '3.5rem' }}
                                placeholder="Seu nome"
                                value={nome}
                                onChange={(e) => setNome(e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">E-mail Corporativo</label>
                        <div style={{ position: 'relative' }}>
                            <Mail size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                            <input
                                type="email"
                                className="form-input"
                                style={{ paddingLeft: '3rem', height: '3.5rem' }}
                                placeholder="seu.e-mail@santacasabh.com.br"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">CRM</label>
                            <input
                                type="text"
                                className="form-input"
                                style={{ height: '3.5rem' }}
                                placeholder="123456"
                                value={crm}
                                onChange={(e) => setCrm(e.target.value)}
                                onBlur={verificarCRM}
                            />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">UF</label>
                            <select
                                className="form-input"
                                style={{ height: '3.5rem' }}
                                value={uf}
                                onChange={(e) => setUf(e.target.value)}
                            >
                                <option value="MG">MG</option>
                                <option value="SP">SP</option>
                                <option value="RJ">RJ</option>
                                <option value="ES">ES</option>
                                <option value="BA">BA</option>
                            </select>
                        </div>
                    </div>

                    {crmData && (
                        <div style={{ padding: '0.75rem', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.2)', fontSize: '0.85rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }}></div>
                            <div>
                                <strong style={{ color: '#10b981', display: 'block' }}>CRM Válido</strong>
                                <span style={{ color: 'var(--text-secondary)' }}>{crmData.nome} - {crmData.especialidade}</span>
                            </div>
                        </div>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">WhatsApp</label>
                            <div style={{ position: 'relative' }}>
                                <Phone size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                                <input
                                    type="tel"
                                    className="form-input"
                                    style={{ paddingLeft: '3rem', height: '3.5rem' }}
                                    placeholder="(31) 9..."
                                    value={telefone}
                                    onChange={(e) => setTelefone(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">Senha</label>
                            <div style={{ position: 'relative' }}>
                                <Lock size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                                <input
                                    type="password"
                                    className="form-input"
                                    style={{ paddingLeft: '3rem', height: '3.5rem' }}
                                    placeholder="••••••••"
                                    value={senha}
                                    onChange={(e) => setSenha(e.target.value)}
                                    required
                                />
                            </div>
                        </div>
                    </div>

                    <button
                        type="submit"
                        className="btn btn-primary"
                        style={{ width: '100%', justifyContent: 'center', height: '3.5rem', marginTop: '0.5rem', fontSize: '1rem' }}
                        disabled={loading}
                    >
                        {loading ? (
                            <Loader2 size={24} className="spinner" style={{ borderTopColor: 'white' }} />
                        ) : (
                            <>
                                <span>Criar minha conta</span>
                                <ChevronRight size={20} />
                            </>
                        )}
                    </button>
                </form>

                <div style={{ marginTop: '2rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                    Já tem acesso? <Link to="/login" style={{ color: 'var(--primary)', fontWeight: 700, textDecoration: 'none' }}>Fazer Login</Link>
                </div>

                <div style={{
                    marginTop: '3.5rem',
                    textAlign: 'center',
                    fontSize: '0.75rem',
                    color: 'var(--secondary)',
                    opacity: 0.6
                }}>
                    &copy; {new Date().getFullYear()} Santa Casa Belo Horizonte.<br />
                    Plataforma de Gestão Médica.
                </div>
            </div>
        </div>
    );
}
