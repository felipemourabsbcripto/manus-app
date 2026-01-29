/* eslint-disable react-refresh/only-export-components */
import { createContext, useState, useContext } from 'react';

const AuthContext = createContext({});

// ============================================
// DEFINIÇÃO DE PERMISSÕES POR TIPO DE USUÁRIO
// ============================================
const PERMISSIONS = {
    // Médico: acesso básico - apenas visualização e trocas
    medico: {
        canViewDashboard: true,
        canViewEscalas: true,
        canViewOwnProfile: true,
        canEditOwnProfile: true,
        canRequestTroca: true,
        canOfferTroca: true,
        canViewAnuncios: true,
        canViewRelatorios: false,
        canCreateEscala: false,
        canEditEscala: false,
        canDeleteEscala: false,
        canManageFuncionarios: false,
        canManageGestores: false,
        canApproveTrocas: false,
        canCreateAnuncios: false,
        canManageWhatsApp: false,
        canManagePagamentos: false,
        canManageConfiguracoes: false,
        canAccessAdmin: false,
    },
    // Gestor: pode criar escalas, aprovar trocas, fazer anúncios
    gestor: {
        canViewDashboard: true,
        canViewEscalas: true,
        canViewOwnProfile: true,
        canEditOwnProfile: true,
        canRequestTroca: true,
        canOfferTroca: true,
        canViewAnuncios: true,
        canViewRelatorios: true,
        canCreateEscala: true,
        canEditEscala: true,
        canDeleteEscala: true,
        canManageFuncionarios: true,
        canManageGestores: false,
        canApproveTrocas: true,
        canCreateAnuncios: true,
        canManageWhatsApp: true,
        canManagePagamentos: true,
        canManageConfiguracoes: true,
        canAccessAdmin: false,
    },
    // Admin: acesso total
    admin: {
        canViewDashboard: true,
        canViewEscalas: true,
        canViewOwnProfile: true,
        canEditOwnProfile: true,
        canRequestTroca: true,
        canOfferTroca: true,
        canViewAnuncios: true,
        canViewRelatorios: true,
        canCreateEscala: true,
        canEditEscala: true,
        canDeleteEscala: true,
        canManageFuncionarios: true,
        canManageGestores: true,
        canApproveTrocas: true,
        canCreateAnuncios: true,
        canManageWhatsApp: true,
        canManagePagamentos: true,
        canManageConfiguracoes: true,
        canAccessAdmin: true,
    },
    // Funcionário genérico: mesmas permissões de médico
    funcionario: {
        canViewDashboard: true,
        canViewEscalas: true,
        canViewOwnProfile: true,
        canEditOwnProfile: true,
        canRequestTroca: true,
        canOfferTroca: true,
        canViewAnuncios: true,
        canViewRelatorios: false,
        canCreateEscala: false,
        canEditEscala: false,
        canDeleteEscala: false,
        canManageFuncionarios: false,
        canManageGestores: false,
        canApproveTrocas: false,
        canCreateAnuncios: false,
        canManageWhatsApp: false,
        canManagePagamentos: false,
        canManageConfiguracoes: false,
        canAccessAdmin: false,
    }
};

export const AuthProvider = ({ children }) => {
    // Inicializar estado com valores do localStorage
    const [user, setUser] = useState(() => {
        const storedUser = localStorage.getItem('@ManusApp:user');
        const storedToken = localStorage.getItem('@ManusApp:token');
        if (storedUser && storedToken) {
            try {
                return JSON.parse(storedUser);
            } catch {
                return null;
            }
        }
        return null;
    });
    // loading mantido para compatibilidade com componentes que o utilizam
    const loading = false;

    const loginSocial = async ({ provider, token, profile }) => {
        try {
            const response = await fetch('/api/auth/social-login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    provider,
                    token: token || profile?.token, // Token JWT do Google para verificação
                    email: profile.email,
                    nome: profile.name,
                    photo: profile.picture
                })
            });

            const data = await response.json();

            if (data.success) {
                setUser(data.user);
                localStorage.setItem('@ManusApp:user', JSON.stringify(data.user));
                localStorage.setItem('@ManusApp:token', data.token);
                return { success: true };
            }
            return { success: false, error: data.error };
        } catch (error) {
            console.error('Erro no login social:', error);
            return { success: false, error: 'Erro no login social' };
        }
    };

    const login = async (email, senha) => {
        try {
            // Em desenvolvimento, a URL pode variar, então tente usar config ou relativo se tiver proxy
            // Assumindo que o proxy do Vite (/api) está funcionando
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, senha })
            });

            const data = await response.json();

            if (data.success) {
                setUser(data.user);
                localStorage.setItem('@ManusApp:user', JSON.stringify(data.user));
                localStorage.setItem('@ManusApp:token', data.token);
                return { success: true };
            } else {
                return { success: false, error: data.error };
            }
        } catch (error) {
            console.error('Erro no login:', error);
            return { success: false, error: 'Erro ao conectar ao servidor' };
        }
    };

    const register = async (userData) => {
        try {
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(userData)
            });

            const data = await response.json();

            if (data.success) {
                // Auto login after register? Or redirect to login? 
                // Let's just return success and let the component handle it (e.g. login automatically or show success message)
                // For better UX, let's login automatically.
                return login(userData.email, userData.senha);
            } else {
                return { success: false, error: data.error };
            }
        } catch (error) {
            console.error('Erro no cadastro:', error);
            return { success: false, error: 'Erro ao conectar ao servidor' };
        }
    };

    const logout = () => {
        setUser(null);
        localStorage.removeItem('@ManusApp:user');
        localStorage.removeItem('@ManusApp:token');
    };

    // ============================================
    // FUNÇÕES DE VERIFICAÇÃO DE PERMISSÃO
    // ============================================
    
    // Obter tipo do usuário (com fallback para 'medico')
    const getUserType = () => {
        return user?.tipo || 'medico';
    };

    // Verificar se usuário tem uma permissão específica
    const hasPermission = (permission) => {
        const userType = getUserType();
        const perms = PERMISSIONS[userType] || PERMISSIONS.medico;
        return perms[permission] || false;
    };

    // Verificar se é admin
    const isAdmin = () => getUserType() === 'admin';

    // Verificar se é gestor ou admin
    const isGestorOrAdmin = () => ['gestor', 'admin'].includes(getUserType());

    // Verificar se é médico
    const isMedico = () => ['medico', 'funcionario'].includes(getUserType());

    // Obter todas as permissões do usuário atual
    const getPermissions = () => {
        const userType = getUserType();
        return PERMISSIONS[userType] || PERMISSIONS.medico;
    };

    return (
        <AuthContext.Provider value={{
            user,
            signed: !!user,
            loading,
            login,
            loginSocial,
            logout,
            register,
            // Novas funções de permissão
            hasPermission,
            isAdmin,
            isGestorOrAdmin,
            isMedico,
            getUserType,
            getPermissions,
            PERMISSIONS
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth deve ser usado dentro de um AuthProvider');
    }
    return context;
}
