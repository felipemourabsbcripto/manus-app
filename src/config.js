// Detecta automaticamente a URL da API baseado no ambiente
const getApiUrl = () => {
  // Se estiver em produção/sandbox, usa a mesma origem com porta 3001
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;

    // Se for sandbox, substitui a porta no hostname
    if (hostname.includes('sandbox')) {
      const apiHost = hostname.replace(/^\d+-/, '3001-');
      return `https://${apiHost}/api`;
    }
  }

  // Fallback para desenvolvimento local
  return 'http://localhost:3001/api';
};

export const API_URL = '/api';

// Configurações de Login Social
// Substitua estas chaves após gerá-las nos consoles do Google/Apple/Microsoft
export const GOOGLE_CLIENT_ID = "869821071891-ut47oq6o3thvnfudni1nun3tk0n8kl2n.apps.googleusercontent.com";
export const APPLE_CLIENT_ID = "com.santacasabh.manus.login"; // Seu Service ID da Apple
export const MICROSOFT_CLIENT_ID = "SEU_MICROSOFT_CLIENT_ID_AQUI";
