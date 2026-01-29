// Push Notifications Utilities para EscalaPro

// Verificar suporte a notificações
export function isPushSupported() {
  return 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
}

// Verificar permissão atual
export function getNotificationPermission() {
  if (!isPushSupported()) return 'unsupported';
  return Notification.permission;
}

// Solicitar permissão
export async function requestNotificationPermission() {
  if (!isPushSupported()) {
    console.warn('Push notifications não suportadas neste navegador');
    return false;
  }
  
  try {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  } catch (error) {
    console.error('Erro ao solicitar permissão:', error);
    return false;
  }
}

// Registrar Service Worker
export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    console.warn('Service Worker não suportado');
    return null;
  }
  
  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/'
    });
    
    console.log('Service Worker registrado:', registration.scope);
    
    // Verificar por atualizações
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      console.log('Novo Service Worker sendo instalado...');
      
      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          // Nova versão disponível
          console.log('Nova versão disponível! Recarregue a página.');
        }
      });
    });
    
    return registration;
  } catch (error) {
    console.error('Erro ao registrar Service Worker:', error);
    return null;
  }
}

// Subscrever para Push Notifications
export async function subscribeToPush(registration) {
  try {
    // VAPID public key (você precisará gerar uma própria para produção)
    const vapidPublicKey = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U';
    
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
    });
    
    console.log('Push subscription:', subscription);
    return subscription;
  } catch (error) {
    console.error('Erro ao subscrever para push:', error);
    return null;
  }
}

// Enviar subscription para o servidor
export async function saveSubscriptionToServer(subscription, funcionarioId) {
  try {
    const response = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscription: subscription.toJSON(),
        funcionario_id: funcionarioId
      })
    });
    
    return response.ok;
  } catch (error) {
    console.error('Erro ao salvar subscription:', error);
    return false;
  }
}

// Mostrar notificação local (sem push server)
export function showLocalNotification(title, options = {}) {
  if (Notification.permission !== 'granted') {
    console.warn('Permissão de notificação não concedida');
    return;
  }
  
  const defaultOptions = {
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-72.png',
    vibrate: [200, 100, 200],
    tag: 'escalapro-local',
    requireInteraction: false
  };
  
  return new Notification(title, { ...defaultOptions, ...options });
}

// Notificação de escala
export function notifyEscala(escala) {
  showLocalNotification('🏥 Lembrete de Plantão', {
    body: `Seu plantão começa em 1 hora: ${escala.hora_inicio} - ${escala.hora_fim}`,
    tag: `escala-${escala.id}`,
    data: { tipo: 'escala', escalaId: escala.id },
    requireInteraction: true,
    actions: [
      { action: 'ver', title: 'Ver Detalhes' },
      { action: 'checkin', title: 'Check-in' }
    ]
  });
}

// Notificação de troca
export function notifyTroca(troca) {
  showLocalNotification('🔄 Nova Proposta de Troca', {
    body: troca.mensagem || 'Você tem uma nova proposta de troca de plantão',
    tag: `troca-${troca.id}`,
    data: { tipo: 'troca', trocaId: troca.id }
  });
}

// Notificação de furo
export function notifyFuro(furo) {
  showLocalNotification('⚠️ Alerta de Furo', {
    body: `${furo.funcionario_nome} não compareceu ao plantão`,
    tag: `furo-${furo.id}`,
    data: { tipo: 'furo', furoId: furo.id },
    requireInteraction: true
  });
}

// Notificação genérica de aviso
export function notifyAviso(aviso) {
  const icons = {
    'urgente': '🚨',
    'escala': '📅',
    'lembrete': '⏰',
    'sistema': '⚙️',
    'geral': '📢'
  };
  
  showLocalNotification(`${icons[aviso.tipo] || '📌'} ${aviso.titulo}`, {
    body: aviso.mensagem,
    tag: `aviso-${aviso.id}`,
    data: { tipo: 'aviso', avisoId: aviso.id }
  });
}

// Agendar notificação para uma data/hora específica
export function scheduleNotification(title, options, scheduledTime) {
  const now = Date.now();
  const delay = scheduledTime.getTime() - now;
  
  if (delay <= 0) {
    console.warn('Data/hora já passou');
    return null;
  }
  
  // Limite de 24 horas para setTimeout
  if (delay > 24 * 60 * 60 * 1000) {
    console.warn('Agendamento muito distante. Use o servidor para notificações de longo prazo.');
    return null;
  }
  
  const timeoutId = setTimeout(() => {
    showLocalNotification(title, options);
  }, delay);
  
  return timeoutId;
}

// Cancelar notificação agendada
export function cancelScheduledNotification(timeoutId) {
  if (timeoutId) {
    clearTimeout(timeoutId);
  }
}

// Helper: Converter VAPID key
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Verificar e agendar lembretes para escalas do dia
export async function checkAndScheduleReminders(escalas, funcionarioId) {
  if (!isPushSupported() || Notification.permission !== 'granted') {
    return;
  }
  
  const agora = new Date();
  const umHora = 60 * 60 * 1000;
  
  escalas.forEach(escala => {
    if (escala.funcionario_id !== funcionarioId) return;
    
    // Construir data/hora de início
    const [hora, minuto] = escala.hora_inicio.split(':').map(Number);
    const dataEscala = new Date(escala.data + 'T00:00:00');
    dataEscala.setHours(hora, minuto, 0, 0);
    
    // Calcular quando notificar (1 hora antes)
    const notifyTime = new Date(dataEscala.getTime() - umHora);
    
    // Se ainda não passou e é dentro das próximas 24h
    if (notifyTime > agora && notifyTime.getTime() - agora.getTime() < 24 * umHora) {
      scheduleNotification(
        '🏥 Plantão em 1 hora!',
        {
          body: `Seu plantão começa às ${escala.hora_inicio}`,
          tag: `reminder-${escala.id}`,
          data: { tipo: 'escala', escalaId: escala.id },
          requireInteraction: true
        },
        notifyTime
      );
      
      console.log(`Lembrete agendado para ${notifyTime.toLocaleString()}`);
    }
  });
}

export default {
  isPushSupported,
  getNotificationPermission,
  requestNotificationPermission,
  registerServiceWorker,
  subscribeToPush,
  saveSubscriptionToServer,
  showLocalNotification,
  notifyEscala,
  notifyTroca,
  notifyFuro,
  notifyAviso,
  scheduleNotification,
  cancelScheduledNotification,
  checkAndScheduleReminders
};
