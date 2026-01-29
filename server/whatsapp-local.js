/**
 * Serviço WhatsApp Local usando whatsapp-web.js
 * 
 * Este serviço conecta diretamente ao WhatsApp Web sem precisar de Docker/Evolution API.
 * Mais simples para desenvolvimento e testes.
 * 
 * Uso:
 *   node server/whatsapp-local.js
 * 
 * Depois de conectar via QR Code, o serviço fica rodando e recebe requisições HTTP.
 */

const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Configurações
const PORT = process.env.WHATSAPP_PORT || 8080;
const API_KEY = process.env.WHATSAPP_API_KEY || 'manus-app-whatsapp-key-2024';

// Estado da conexão
let connectionStatus = 'disconnected';
let clientInfo = null;
let currentQR = null;

// Middleware de autenticação
const authMiddleware = (req, res, next) => {
  const apiKey = req.headers['apikey'] || req.headers['x-api-key'];
  if (apiKey !== API_KEY) {
    return res.status(401).json({ error: 'API key inválida' });
  }
  next();
};

// Criar cliente WhatsApp
const client = new Client({
  authStrategy: new LocalAuth({
    dataPath: './.wwebjs_auth'
  }),
  puppeteer: {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu'
    ]
  }
});

// Eventos do WhatsApp
client.on('qr', (qr) => {
  currentQR = qr;
  connectionStatus = 'qr_ready';
  console.log('\n📱 QR CODE gerado! Escaneie com seu WhatsApp:\n');
  qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
  connectionStatus = 'connected';
  clientInfo = client.info;
  currentQR = null;
  console.log('\n✅ WhatsApp conectado!');
  console.log(`📞 Número: ${client.info.wid.user}`);
  console.log(`👤 Nome: ${client.info.pushname}`);
});

client.on('authenticated', () => {
  connectionStatus = 'authenticated';
  console.log('🔐 Autenticado com sucesso!');
});

client.on('auth_failure', (msg) => {
  connectionStatus = 'auth_failed';
  console.error('❌ Falha na autenticação:', msg);
});

client.on('disconnected', (reason) => {
  connectionStatus = 'disconnected';
  clientInfo = null;
  console.log('⚠️ Desconectado:', reason);
});

// ============ ROTAS DA API ============

// Status da conexão
app.get('/', (req, res) => {
  res.json({
    name: 'WhatsApp Local API',
    version: '1.0.0',
    status: connectionStatus,
    connected: connectionStatus === 'connected'
  });
});

// Obter status da instância
app.get('/instance/connectionState/:instance', authMiddleware, (req, res) => {
  res.json({
    instance: {
      state: connectionStatus === 'connected' ? 'open' : 'close',
      ownerJid: clientInfo ? `${clientInfo.wid.user}@s.whatsapp.net` : null
    }
  });
});

// Conectar / Obter QR Code
app.get('/instance/connect/:instance', authMiddleware, async (req, res) => {
  if (connectionStatus === 'connected') {
    return res.json({ status: 'already_connected', info: clientInfo });
  }

  if (currentQR) {
    // Converter QR para base64
    const QRCode = require('qrcode');
    const qrBase64 = await QRCode.toDataURL(currentQR);
    return res.json({
      status: 'qr_ready',
      base64: qrBase64,
      code: currentQR
    });
  }

  res.json({ status: connectionStatus, message: 'Aguardando QR Code...' });
});

// Criar instância (compatibilidade com Evolution API)
app.post('/instance/create', authMiddleware, (req, res) => {
  res.json({
    instance: {
      instanceName: req.body.instanceName || 'default',
      status: connectionStatus
    }
  });
});

// Listar instâncias
app.get('/instance/fetchInstances', authMiddleware, (req, res) => {
  res.json([{
    instanceName: 'default',
    status: connectionStatus,
    owner: clientInfo ? clientInfo.wid.user : null
  }]);
});

// Desconectar
app.delete('/instance/logout/:instance', authMiddleware, async (req, res) => {
  try {
    await client.logout();
    res.json({ success: true, message: 'Desconectado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Enviar mensagem de texto
app.post('/message/sendText/:instance', authMiddleware, async (req, res) => {
  const { number, text, delay } = req.body;

  if (!number || !text) {
    return res.status(400).json({ error: 'number e text são obrigatórios' });
  }

  if (connectionStatus !== 'connected') {
    return res.status(503).json({ error: 'WhatsApp não está conectado' });
  }

  try {
    // Formatar número (adicionar @c.us se necessário)
    let formattedNumber = number.replace(/\D/g, '');
    if (!formattedNumber.includes('@')) {
      formattedNumber = `${formattedNumber}@c.us`;
    }

    // Delay opcional
    if (delay) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    const message = await client.sendMessage(formattedNumber, text);

    res.json({
      success: true,
      key: {
        id: message.id.id,
        remoteJid: formattedNumber
      },
      message: {
        text: text
      }
    });
  } catch (error) {
    console.error('Erro ao enviar:', error);
    res.status(500).json({ error: error.message });
  }
});

// Verificar se número existe no WhatsApp
app.post('/chat/whatsappNumbers/:instance', authMiddleware, async (req, res) => {
  const { numbers } = req.body;

  if (!numbers || !Array.isArray(numbers)) {
    return res.status(400).json({ error: 'numbers deve ser um array' });
  }

  if (connectionStatus !== 'connected') {
    return res.status(503).json({ error: 'WhatsApp não está conectado' });
  }

  try {
    const results = [];
    for (const num of numbers) {
      const formattedNumber = num.replace(/\D/g, '') + '@c.us';
      const isRegistered = await client.isRegisteredUser(formattedNumber);
      results.push({
        number: num,
        exists: isRegistered,
        jid: isRegistered ? formattedNumber : null
      });
    }
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obter foto de perfil
app.get('/chat/profilePicture/:instance', authMiddleware, async (req, res) => {
  const { number } = req.query;

  if (!number) {
    return res.status(400).json({ error: 'number é obrigatório' });
  }

  try {
    const formattedNumber = number.replace(/\D/g, '') + '@c.us';
    const profilePic = await client.getProfilePicUrl(formattedNumber);
    res.json({ profilePicture: profilePic || null });
  } catch (error) {
    res.json({ profilePicture: null });
  }
});

// ============ INICIALIZAÇÃO ============

console.log('🚀 Iniciando WhatsApp Local API...');
console.log(`📡 Porta: ${PORT}`);
console.log(`🔑 API Key: ${API_KEY}`);
console.log('');

// Iniciar cliente WhatsApp
client.initialize().catch(err => {
  console.error('Erro ao inicializar:', err);
});

// Iniciar servidor HTTP
app.listen(PORT, () => {
  console.log(`\n🌐 API rodando em http://localhost:${PORT}`);
  console.log('\n📖 Endpoints disponíveis:');
  console.log('  GET  /                           - Status geral');
  console.log('  GET  /instance/connectionState/* - Status da conexão');
  console.log('  GET  /instance/connect/*         - Obter QR Code');
  console.log('  POST /message/sendText/*         - Enviar mensagem');
  console.log('');
  console.log('⏳ Aguardando QR Code...');
});
