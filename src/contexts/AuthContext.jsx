import { createContext, useState, useEffect, useContext } from 'react';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Verificar se existe usuário salvo no localStorage
        const storedUser = localStorage.getItem('@ManusApp:user');
        const storedToken = localStorage.getItem('@ManusApp:token');

        if (storedUser && storedToken) {
            setUser(JSON.parse(storedUser));
        }
        setLoading(false);
    }, []);

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

    const logout = () => {
        setUser(null);
        localStorage.removeItem('@ManusApp:user');
        localStorage.removeItem('@ManusApp:token');
    };

    return (
        <AuthContext.Provider value={{
            user,
            signed: !!user,
            loading,
            login,
            logout
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
