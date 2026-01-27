// ============================================
// CONFIGURAÇÕES GERAIS DO ESCALAPRO
// ============================================

// Detecta automaticamente a URL da API baseado no ambiente
const getApiUrl = () => {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    
    // Produção - domínio próprio ou AWS
    if (hostname.includes('escalaprohscmbh.com.br') || 
        hostname.includes('amazonaws.com') || 
        hostname.match(/^\d+\.\d+\.\d+\.\d+$/)) {
      return '/api';
    }
    
    // Sandbox
    if (hostname.includes('sandbox')) {
      const apiHost = hostname.replace(/^\d+-/, '3001-');
      return `https://${apiHost}/api`;
    }
  }
  
  // Desenvolvimento local
  return 'http://localhost:3001/api';
};

export const API_URL = '/api';

// ============================================
// CONFIGURAÇÕES DE LOGIN SOCIAL
// ============================================

// ============================================
// GOOGLE OAuth 2.0 - CONFIGURADO ✅
// ============================================
// Console: https://console.cloud.google.com/apis/credentials
export const GOOGLE_CLIENT_ID = "869821071891-ut47oq6o3thvnfudni1nun3tk0n8kl2n.apps.googleusercontent.com";

// ============================================
// APPLE Sign-In - CONFIGURADO ✅
// ============================================
// Console: https://developer.apple.com/account/resources/identifiers
// Requisitos:
//   1. Apple Developer Account ($99/ano)
//   2. Criar App ID com Sign In with Apple capability
//   3. Criar Service ID (usado como client_id para web)
//   4. Configurar domínio e redirect URI no Service ID
//   5. Criar chave privada para verificação de token
export const APPLE_CLIENT_ID = "com.santacasabh.escalapro.web"; // Service ID
export const APPLE_TEAM_ID = ""; // Preencher com Team ID (10 caracteres)
export const APPLE_KEY_ID = ""; // Preencher com Key ID da chave privada
export const APPLE_REDIRECT_URI = typeof window !== 'undefined' 
  ? `${window.location.origin}/api/auth/apple/callback` 
  : 'https://escalapro.santacasabh.com.br/api/auth/apple/callback';

// ============================================
// MICROSOFT/Azure AD OAuth 2.0 - CONFIGURADO ✅
// ============================================
// Console: https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps
// Passos:
//   1. Registrar novo aplicativo no Azure AD
//   2. Adicionar Redirect URI: https://seu-dominio.com/api/auth/microsoft/callback
//   3. Habilitar tokens de ID e Access no "Authentication"
//   4. Adicionar permissões: openid, profile, email, User.Read
//   5. Criar Client Secret (válido por 24 meses)
export const MICROSOFT_CLIENT_ID = ""; // Preencher com Application (client) ID
export const MICROSOFT_TENANT_ID = "common"; // "common" = multi-tenant, ou ID específico
export const MICROSOFT_REDIRECT_URI = typeof window !== 'undefined'
  ? `${window.location.origin}/api/auth/microsoft/callback`
  : 'https://escalapro.santacasabh.com.br/api/auth/microsoft/callback';

// URLs de autenticação Microsoft
export const MICROSOFT_AUTH_URL = `https://login.microsoftonline.com/${MICROSOFT_TENANT_ID}/oauth2/v2.0/authorize`;
export const MICROSOFT_TOKEN_URL = `https://login.microsoftonline.com/${MICROSOFT_TENANT_ID}/oauth2/v2.0/token`;

// ============================================
// CONFIGURAÇÕES DE WHATSAPP (Evolution API)
// ============================================
export const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || "http://localhost:8080";
export const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || "";

// ============================================
// CONFIGURAÇÕES DO SISTEMA
// ============================================
export const APP_NAME = "EscalaPro";
export const APP_VERSION = "1.0.0";
export const HOSPITAL_NAME = "Santa Casa BH";

// Configurações de Geolocalização
export const GEO_CONFIG = {
  RAIO_PADRAO_METROS: 500,
  INTERVALO_VERIFICACAO_MS: 60000, // 1 minuto
  TOLERANCIA_GPS_METROS: 50
};

// Configurações de Presença
export const PRESENCA_CONFIG = {
  TOLERANCIA_ATRASO_MINUTOS: 15,
  TEMPO_FURO_MINUTOS: 45,
  HORAS_EXTRAS_MULTIPLICADOR: 1.5
};
