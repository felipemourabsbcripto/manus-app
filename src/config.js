// ============================================
// CONFIGURAÇÕES GERAIS DO ESCALAPRO
// ============================================

// Detecta automaticamente a URL da API baseado no ambiente
const getApiUrl = () => {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    
    // Produção AWS - mesma origem
    if (hostname.includes('amazonaws.com') || hostname.match(/^\d+\.\d+\.\d+\.\d+$/)) {
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

// Google OAuth 2.0 - CONFIGURADO ✅
// Console: https://console.cloud.google.com/apis/credentials
export const GOOGLE_CLIENT_ID = "869821071891-ut47oq6o3thvnfudni1nun3tk0n8kl2n.apps.googleusercontent.com";

// Apple Sign-In - PENDENTE
// Console: https://developer.apple.com/account/resources/identifiers
// Necessário: Apple Developer Account ($99/ano)
export const APPLE_CLIENT_ID = "com.santacasabh.escalapro";
export const APPLE_REDIRECT_URI = typeof window !== 'undefined' 
  ? `${window.location.origin}/api/auth/apple/callback` 
  : '';

// Microsoft/Azure AD - PENDENTE  
// Console: https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps
// Gratuito com conta Microsoft
export const MICROSOFT_CLIENT_ID = ""; // Preencher após criar app no Azure
export const MICROSOFT_TENANT_ID = "common"; // "common" para multi-tenant

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
