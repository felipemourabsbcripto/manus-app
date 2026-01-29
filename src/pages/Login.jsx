import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { 
    GOOGLE_CLIENT_ID, 
    APPLE_CLIENT_ID, 
    APPLE_REDIRECT_URI,
    MICROSOFT_CLIENT_ID,
    MICROSOFT_AUTH_URL,
    MICROSOFT_REDIRECT_URI,
    APP_NAME, 
    HOSPITAL_NAME 
} from '../config';
import './Login.css';
import logo from '../assets/logo-login-new.jpg';

export default function Login() {
    const [email, setEmail] = useState('');
    const [senha, setSenha] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [googleLoaded, setGoogleLoaded] = useState(false);
    // appleLoaded usado para controle de carregamento do SDK Apple
    // eslint-disable-next-line no-unused-vars
    const [appleLoaded, setAppleLoaded] = useState(false);

    const { login, loginSocial } = useAuth();
    const navigate = useNavigate();

    // ===================================================
    // GOOGLE Sign-In SDK
    // ===================================================
    useEffect(() => {
        const loadGoogleScript = () => {
            if (document.getElementById('google-signin-script')) {
                setGoogleLoaded(true);
                return;
            }
            
            const script = document.createElement('script');
            script.id = 'google-signin-script';
            script.src = 'https://accounts.google.com/gsi/client';
            script.async = true;
            script.defer = true;
            script.onload = () => setGoogleLoaded(true);
            document.body.appendChild(script);
        };
        
        loadGoogleScript();
    }, []);

    // ===================================================
    // APPLE Sign-In SDK
    // ===================================================
    useEffect(() => {
        const loadAppleScript = () => {
            if (document.getElementById('apple-signin-script')) {
                setAppleLoaded(true);
                return;
            }
            
            const script = document.createElement('script');
            script.id = 'apple-signin-script';
            script.src = 'https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js';
            script.async = true;
            script.defer = true;
            script.onload = () => {
                if (window.AppleID && APPLE_CLIENT_ID) {
                    window.AppleID.auth.init({
                        clientId: APPLE_CLIENT_ID,
                        scope: 'name email',
                        redirectURI: APPLE_REDIRECT_URI,
                        usePopup: true
                    });
                }
                setAppleLoaded(true);
            };
            document.body.appendChild(script);
        };
        
        loadAppleScript();
    }, []);

    // ===================================================
    // Callback do Google Sign-In
    // ===================================================
    const handleGoogleCallback = useCallback(async (response) => {
        setLoading(true);
        setError('');
        
        try {
            // Decodificar JWT para obter dados do usuário
            const payload = JSON.parse(atob(response.credential.split('.')[1]));
            
            const result = await loginSocial({
                provider: 'google',
                token: response.credential, // Token real para verificação no backend
                profile: {
                    email: payload.email,
                    name: payload.name,
                    picture: payload.picture
                }
            });
            
            if (result.success) {
                navigate('/dashboard');
            } else {
                setError(result.error || 'Falha no login com Google');
            }
        } catch {
            setError('Erro ao processar login com Google');
        } finally {
            setLoading(false);
        }
    }, [loginSocial, navigate]);

    // ===================================================
    // Inicializar Google Sign-In quando SDK carregar
    // ===================================================
    useEffect(() => {
        if (googleLoaded && window.google && GOOGLE_CLIENT_ID) {
            window.google.accounts.id.initialize({
                client_id: GOOGLE_CLIENT_ID,
                callback: handleGoogleCallback,
                auto_select: false,
            });
        }
    }, [googleLoaded, handleGoogleCallback]);

    // ===================================================
    // Callback do Apple Sign-In
    // ===================================================
    const handleAppleCallback = async (response) => {
        setLoading(true);
        setError('');
        
        try {
            const { authorization, user } = response;
            
            const result = await loginSocial({
                provider: 'apple',
                token: authorization.id_token,
                code: authorization.code,
                profile: user ? {
                    email: user.email,
                    name: user.name ? `${user.name.firstName} ${user.name.lastName}` : null
                } : null
            });
            
            if (result.success) {
                navigate('/dashboard');
            } else {
                setError(result.error || 'Falha no login com Apple');
            }
        } catch (err) {
            console.error('Erro Apple Sign-In:', err);
            setError('Erro ao processar login com Apple');
        } finally {
            setLoading(false);
        }
    };

    // ===================================================
    // Microsoft OAuth 2.0 Flow
    // ===================================================
    const handleMicrosoftLogin = () => {
        if (!MICROSOFT_CLIENT_ID) {
            setError('Login com Microsoft ainda não configurado. Entre em contato com o suporte.');
            return;
        }
        
        // Gerar state para segurança (CSRF protection)
        const state = btoa(JSON.stringify({ 
            timestamp: Date.now(),
            nonce: Math.random().toString(36).substring(7)
        }));
        sessionStorage.setItem('microsoft_oauth_state', state);
        
        // Construir URL de autorização
        const params = new URLSearchParams({
            client_id: MICROSOFT_CLIENT_ID,
            response_type: 'code',
            redirect_uri: MICROSOFT_REDIRECT_URI,
            scope: 'openid profile email User.Read',
            state: state,
            response_mode: 'query'
        });
        
        // Redirecionar para Microsoft
        window.location.href = `${MICROSOFT_AUTH_URL}?${params.toString()}`;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const result = await login(email, senha);
            if (result.success) {
                navigate('/dashboard');
            } else {
                setError(result.error || 'Falha ao realizar login');
            }
        } catch {
            setError('Erro inesperado ao fazer login');
        } finally {
            setLoading(false);
        }
    };

    // ===================================================
    // Handler para login social (Google, Apple, Microsoft)
    // ===================================================
    const handleSocialLogin = async (provider) => {
        setLoading(true);
        setError('');
        
        // ---- GOOGLE ----
        if (provider === 'google') {
            if (!GOOGLE_CLIENT_ID) {
                setError('Login com Google não configurado.');
                setLoading(false);
                return;
            }
            
            if (window.google) {
                window.google.accounts.id.prompt((notification) => {
                    if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
                        setLoading(false);
                        setError('Popup bloqueado. Permita popups ou clique novamente.');
                    }
                });
            } else {
                setError('SDK do Google ainda está carregando. Tente novamente.');
                setLoading(false);
            }
            return;
        }
        
        // ---- APPLE ----
        if (provider === 'apple') {
            if (!APPLE_CLIENT_ID) {
                setError('Login com Apple ainda não configurado. Use Google ou email/senha.');
                setLoading(false);
                return;
            }
            
            try {
                if (window.AppleID) {
                    const response = await window.AppleID.auth.signIn();
                    await handleAppleCallback(response);
                } else {
                    setError('SDK do Apple ainda está carregando. Tente novamente.');
                }
            } catch (err) {
                console.error('Erro Apple Sign-In:', err);
                if (err.error !== 'popup_closed_by_user') {
                    setError('Erro ao conectar com Apple. Tente novamente.');
                }
            }
            setLoading(false);
            return;
        }
        
        // ---- MICROSOFT ----
        if (provider === 'microsoft') {
            handleMicrosoftLogin();
            // Não desativa loading pois vai redirecionar
            return;
        }
        
        setLoading(false);
    };

    return (
        <div className="login-container">
            <div className="login-card">
                {/* Header / Logo */}
                <div className="logo-wrapper">
                    <img
                        src={logo}
                        alt="Hospital Santa Casa BH"
                        className="logo-img"
                        style={{ width: '120px', height: '120px', marginBottom: '1rem' }}
                    />
                    <span style={{ 
                        fontSize: '0.75rem', 
                        color: '#64748b', 
                        fontWeight: 500, 
                        textTransform: 'uppercase', 
                        letterSpacing: '0.2em',
                        marginBottom: '0.25rem',
                        display: 'block'
                    }}>Hospital</span>
                    <h2 className="institution-name" style={{
                        fontSize: '1.75rem',
                        fontWeight: 700,
                        color: '#b91c1c',
                        marginBottom: '0.5rem',
                        letterSpacing: '0.02em'
                    }}>Santa Casa BH</h2>
                    <span style={{ 
                        fontSize: '0.7rem', 
                        color: '#64748b', 
                        fontWeight: 600, 
                        textTransform: 'uppercase', 
                        letterSpacing: '0.15em',
                        display: 'block',
                        marginBottom: '1.5rem'
                    }}>GESTÃO DE PLANTÕES</span>
                </div>

                <p className="login-subtitle">Acesse sua conta para continuar</p>

                {/* Form Block */}
                {error && (
                    <div className="alert alert-danger" style={{
                        marginBottom: '1rem',
                        padding: '0.75rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem'
                    }}>
                        <span>{error}</span>
                    </div>
                )}

                <form onSubmit={handleSubmit}>
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

                    <div className="input-group">
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

                    <button type="submit" className="btn-login" disabled={loading}>
                        {loading ? (
                            <Loader2 size={24} className="spinner" />
                        ) : (
                            <span>Acessar Sistema</span>
                        )}
                    </button>
                </form>

                {/* Footer Block */}
                <div className="divider">Ou continue com</div>

                <div className="social-buttons" style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                    <button type="button" className="btn-social" onClick={() => handleSocialLogin('apple')} title="Entrar com Apple">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="black">
                            <path d="M17.05 20.28c-.98.95-2.05 1.6-3.08 1.6-1.01 0-2.03-1.05-3.05-1.05-1.03 0-1.88 1.03-2.91 1.05-1.12.03-2.45-1.28-3.41-2.93C2.26 15.34 2.5 9.4 6.7 9.17c1.37.03 2.51.98 3.32.98.81 0 1.96-1.07 3.51-1.07 1.25 0 2.58.55 3.39 1.55-2.8 1.48-2.31 5.38.48 6.64-.53 1.34-1.27 2.67-1.35 3.01zM12.95 6.7c.68-.89 1.15-2.06 1.01-3.23-1.06.05-2.31.74-3.04 1.63-.61.73-1.12 1.9-1.01 3.09 1.18.09 2.37-.62 3.04-1.49z" />
                        </svg>
                    </button>

                    <button type="button" className="btn-social" onClick={() => handleSocialLogin('google')} title="Entrar com Google">
                        <svg width="24" height="24" viewBox="0 0 24 24"><path fill="#EA4335" d="M24 12.27c0-.85-.07-1.68-.21-2.48H12v4.69h6.73c-.29 1.57-1.17 2.9-2.51 3.79v3.15h4.06c2.37-2.19 3.73-5.41 3.73-9.15z" /><path fill="#FBBC05" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-4.06-3.15c-1.13.75-2.57 1.2-3.87 1.2-2.98 0-5.5-2.02-6.4-4.73H1.41v3.31C3.39 21.65 7.42 24 12 24z" /><path fill="#34A853" d="M5.6 14.41c-.24-.71-.37-1.46-.37-2.41s.13-1.7.37-2.41V6.29H1.41C.51 8.08 0 10.01 0 12s.51 3.92 1.41 5.71l4.19-3.3z" /><path fill="#4285F4" d="M12 4.77c1.76 0 3.35.6 4.6 1.8l3.44-3.44C17.94 1.13 15.23 0 12 0 7.42 0 3.39 2.35 1.41 6.29l4.19 3.3c.9-2.71 3.42-4.73 6.4-4.73z" /></svg>
                    </button>

                    <button type="button" className="btn-social" onClick={() => handleSocialLogin('microsoft')} title="Entrar com Microsoft">
                        <svg width="21" height="21" viewBox="0 0 21 21">
                            <rect x="1" y="1" width="9" height="9" fill="#f25022" />
                            <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
                            <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
                            <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
                        </svg>
                    </button>
                </div>

                <div className="footer-link">
                    Novo colaborador? <Link to="/register">Solicitar Acesso</Link>
                </div>

                <div className="app-footer" style={{ fontSize: '12px', color: '#cbd5e1', width: '100%' }}>
                    &copy; 2026 Felipe Moura Devgestor
                </div>
            </div>
        </div>
    );
}
