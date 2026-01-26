import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { Lock, Mail, ChevronRight, Loader2, Heart, Apple } from 'lucide-react';

export default function Login() {
    const [email, setEmail] = useState('');
    const [senha, setSenha] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const { login, loginSocial } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        const result = await login(email, senha);

        if (result.success) {
            navigate('/dashboard');
        } else {
            setError(result.error || 'Falha ao realizar login');
            setLoading(false);
        }
    };

    const handleSocialLogin = async (provider) => {
        setLoading(true);
        // Simulação de login social (Front-end side)
        // Em um app real, aqui chamaria o SDK do Google/Apple/MS
        const mockProfile = {
            email: email || `user_${provider}@santacasabh.com.br`,
            name: email.split('@')[0] || 'Usuário Santa Casa',
            picture: ''
        };

        const result = await loginSocial({ provider, profile: mockProfile });
        if (result.success) {
            navigate('/dashboard');
        } else {
            setError(result.error);
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
                    }}>Santa Casa BH</h1>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', fontWeight: 500 }}>Gestor de Plantões Inteligente</p>
                </div>

                {error && (
                    <div className="alert alert-danger" style={{ marginBottom: '1.5rem', fontSize: '0.9rem', borderRadius: '0.75rem' }}>
                        <span>{error}</span>
                    </div>
                )}

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">E-mail Corporativo</label>
                        <div style={{ position: 'relative' }}>
                            <Mail size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                            <input
                                id="email"
                                type="email"
                                className="form-input"
                                style={{ paddingLeft: '3rem', height: '3.5rem' }}
                                placeholder="seu.nome@santacasabh.com.br"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Senha de Acesso</label>
                        <div style={{ position: 'relative' }}>
                            <Lock size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                            <input
                                id="senha"
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
                                <span>Entrar no Sistema</span>
                                <ChevronRight size={20} />
                            </>
                        )}
                    </button>
                </form>

                <div style={{ display: 'flex', alignItems: 'center', margin: '2rem 0', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                    <div style={{ flex: 1, height: '1px', background: 'var(--border)' }}></div>
                    <span style={{ padding: '0 1rem' }}>OU CONTINUE COM</span>
                    <div style={{ flex: 1, height: '1px', background: 'var(--border)' }}></div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', marginBottom: '2rem' }}>
                    <button
                        type="button"
                        className="btn"
                        style={{ background: '#000', color: '#fff', justifyContent: 'center', padding: '0.75rem 0' }}
                        onClick={() => handleSocialLogin('apple')}
                    >
                        <Apple size={20} fill="white" />
                    </button>
                    <button
                        type="button"
                        className="btn"
                        style={{ background: 'white', color: '#333', justifyContent: 'center', padding: '0.75rem 0' }}
                        onClick={() => handleSocialLogin('google')}
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24"><path fill="#EA4335" d="M24 12.27c0-.85-.07-1.68-.21-2.48H12v4.69h6.73c-.29 1.57-1.17 2.9-2.51 3.79v3.15h4.06c2.37-2.19 3.73-5.41 3.73-9.15z" /><path fill="#FBBC05" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-4.06-3.15c-1.13.75-2.57 1.2-3.87 1.2-2.98 0-5.5-2.02-6.4-4.73H1.41v3.31C3.39 21.65 7.42 24 12 24z" /><path fill="#34A853" d="M5.6 14.41c-.24-.71-.37-1.46-.37-2.41s.13-1.7.37-2.41V6.29H1.41C.51 8.08 0 10.01 0 12s.51 3.92 1.41 5.71l4.19-3.3z" /><path fill="#4285F4" d="M12 4.77c1.76 0 3.35.6 4.6 1.8l3.44-3.44C17.94 1.13 15.23 0 12 0 7.42 0 3.39 2.35 1.41 6.29l4.19 3.3c.9-2.71 3.42-4.73 6.4-4.73z" /></svg>
                    </button>
                    <button
                        type="button"
                        className="btn"
                        style={{ background: '#0067b8', color: 'white', justifyContent: 'center', padding: '0.75rem 0' }}
                        onClick={() => handleSocialLogin('microsoft')}
                    >
                        <svg width="20" height="20" viewBox="0 0 23 23"><path fill="#f3f3f3" d="M0 0h11v11H0z" /><path fill="#f3f3f3" d="M12 0h11v11H12z" /><path fill="#f3f3f3" d="M0 12h11v11H0z" /><path fill="#f3f3f3" d="M12 12h11v11H12z" /></svg>
                    </button>
                </div>

                <div style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                    Novo colaborador? <Link to="/register" style={{ color: 'var(--primary)', fontWeight: 700, textDecoration: 'none' }}>Solicitar Acesso</Link>
                </div>

                <div style={{
                    marginTop: '3rem',
                    textAlign: 'center',
                    fontSize: '0.75rem',
                    color: 'var(--secondary)',
                    opacity: 0.6
                }}>
                    &copy; {new Date().getFullYear()} Santa Casa Belo Horizonte.<br />
                    Todos os direitos reservados.
                </div>
            </div>
        </div>
    );
}
