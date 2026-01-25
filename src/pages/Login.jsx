import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { Lock, Mail, ChevronRight, Loader2, Hospital } from 'lucide-react';

export default function Login() {
    const [email, setEmail] = useState('');
    const [senha, setSenha] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        const result = await login(email, senha);

        if (result.success) {
            navigate('/dashboard');
        } else {
            setError(result.error || 'Falha ao autenticar');
            setLoading(false);
        }
    };

    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            background: 'linear-gradient(135deg, var(--bg-primary) 0%, #112240 100%)',
            padding: '1rem'
        }}>
            <div className="card" style={{
                width: '100%',
                maxWidth: '400px',
                padding: '2.5rem',
                border: '1px solid rgba(255,255,255,0.1)',
                backdropFilter: 'blur(10px)',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
            }}>
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <div style={{
                        display: 'inline-flex',
                        padding: '1rem',
                        borderRadius: '1rem',
                        background: 'linear-gradient(135deg, var(--primary) 0%, var(--info) 100%)',
                        marginBottom: '1rem',
                        boxShadow: '0 0 20px rgba(59, 130, 246, 0.5)'
                    }}>
                        <Hospital size={32} color="white" />
                    </div>
                    <h1 style={{
                        fontSize: '1.75rem',
                        fontWeight: 700,
                        marginBottom: '0.5rem',
                        background: 'linear-gradient(135deg, #fff 0%, #94a3b8 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent'
                    }}>Gestor de Plantões Santa Casa Bh</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>Gestão Inteligente de Escalas</p>
                </div>

                {error && (
                    <div className="alert alert-danger" style={{ marginBottom: '1.5rem', fontSize: '0.875rem' }}>
                        <span>{error}</span>
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="form-label" htmlFor="email">Email Corporativo</label>
                        <div style={{ position: 'relative' }}>
                            <Mail size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                            <input
                                id="email"
                                type="email"
                                className="form-input"
                                style={{ paddingLeft: '2.75rem' }}
                                placeholder="seunome@hospital.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label" htmlFor="senha">Senha</label>
                        <div style={{ position: 'relative' }}>
                            <Lock size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                            <input
                                id="senha"
                                type="password"
                                className="form-input"
                                style={{ paddingLeft: '2.75rem' }}
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
                        style={{ width: '100%', justifyContent: 'center', marginTop: '1rem', padding: '0.875rem' }}
                        disabled={loading}
                    >
                        {loading ? (
                            <>
                                <Loader2 size={20} className="spinner" style={{ borderTopColor: 'white', width: '20px', height: '20px' }} />
                                <span>Entrando...</span>
                            </>
                        ) : (
                            <>
                                <span>Acessar Sistema</span>
                                <ChevronRight size={20} />
                            </>
                        )}
                    </button>
                </form>

                <div style={{ display: 'flex', alignItems: 'center', margin: '1.5rem 0', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                    <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }}></div>
                    <span style={{ padding: '0 1rem' }}>ou entre com</span>
                    <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }}></div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                    <button
                        type="button"
                        className="btn"
                        style={{ background: 'white', color: '#333', justifyContent: 'center', gap: '0.5rem', fontSize: '0.875rem' }}
                        onClick={() => alert('Integração com Google em breve')}
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#EA4335" d="M24 12.27c0-.85-.07-1.68-.21-2.48H12v4.69h6.73c-.29 1.57-1.17 2.9-2.51 3.79v3.15h4.06c2.37-2.19 3.73-5.41 3.73-9.15z" /><path fill="#FBBC05" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-4.06-3.15c-1.13.75-2.57 1.2-3.87 1.2-2.98 0-5.5-2.02-6.4-4.73H1.41v3.31C3.39 21.65 7.42 24 12 24z" /><path fill="#34A853" d="M5.6 14.41c-.24-.71-.37-1.46-.37-2.41s.13-1.7.37-2.41V6.29H1.41C.51 8.08 0 10.01 0 12s.51 3.92 1.41 5.71l4.19-3.3z" /><path fill="#4285F4" d="M12 4.77c1.76 0 3.35.6 4.6 1.8l3.44-3.44C17.94 1.13 15.23 0 12 0 7.42 0 3.39 2.35 1.41 6.29l4.19 3.3c.9-2.71 3.42-4.73 6.4-4.73z" /></svg>
                        Google
                    </button>
                    <button
                        type="button"
                        className="btn"
                        style={{ background: '#0067b8', color: 'white', justifyContent: 'center', gap: '0.5rem', fontSize: '0.875rem' }}
                        onClick={() => alert('Integração com Microsoft em breve')}
                    >
                        <svg width="18" height="18" viewBox="0 0 23 23"><path fill="#f3f3f3" d="M0 0h11v11H0z" /><path fill="#f3f3f3" d="M12 0h11v11H12z" /><path fill="#f3f3f3" d="M0 12h11v11H0z" /><path fill="#f3f3f3" d="M12 12h11v11H12z" /></svg>
                        Microsoft
                    </button>
                </div>

                <div style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                    Não tem uma conta? <Link to="/register" style={{ color: 'var(--primary)', fontWeight: 600, textDecoration: 'none' }}>Cadastre-se</Link>
                </div>

                <div style={{
                    marginTop: '2rem',
                    textAlign: 'center',
                    fontSize: '0.75rem',
                    color: 'var(--secondary)'
                }}>
                    &copy; {new Date().getFullYear()} Gestor de Plantões Santa Casa Bh. Todos os direitos reservados.
                </div>
            </div>
        </div>
    );
}
