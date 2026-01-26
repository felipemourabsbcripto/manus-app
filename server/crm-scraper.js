/**
 * ============================================
 * CRM SCRAPER - Consulta Automatizada CFM
 * ============================================
 * 
 * Web scraping no portal do CFM para consultar dados públicos de médicos.
 * 
 * IMPORTANTE PARA SANTA CASA BH:
 * Como entidade filantrópica/pública, vocês podem solicitar acesso
 * GRATUITO ao Webservice oficial do CFM:
 * https://sistemas.cfm.org.br/listamedicos/informacoes
 * Email: webservice@portalmedico.org.br | Tel: (61) 3770-3594
 */

const puppeteer = require('puppeteer');

// Cache em memória (24h)
const cache = new Map();
const CACHE_TTL = 24 * 60 * 60 * 1000;

/**
 * Consulta CRM no portal do CFM
 */
async function consultarCRM(crm, uf) {
  const cacheKey = `${crm}-${uf.toUpperCase()}`;
  
  // Verificar cache
  if (cache.has(cacheKey)) {
    const cached = cache.get(cacheKey);
    if (Date.now() - cached.timestamp < CACHE_TTL) {
      console.log(`📋 Cache hit para CRM ${crm}/${uf}`);
      return cached.data;
    }
    cache.delete(cacheKey);
  }

  console.log(`🔍 Consultando CRM ${crm}/${uf} no portal do CFM...`);

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--single-process'
      ]
    });

    const page = await browser.newPage();
    
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1366, height: 768 });
    
    // Timeout maior para o site do CFM
    page.setDefaultTimeout(60000);
    
    console.log('📄 Acessando portal CFM...');
    await page.goto('https://portal.cfm.org.br/busca-medicos/', {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    // Aguardar página
    await new Promise(r => setTimeout(r, 3000));
    
    console.log('📝 Preenchendo formulário...');
    
    // Preencher UF
    const ufSelect = await page.$('select[name="uf"], select#uf, #inscricao, [name="estado"]');
    if (ufSelect) {
      await page.select('select[name="uf"], select#uf, #inscricao, [name="estado"]', uf.toUpperCase()).catch(() => {});
    }
    
    // Preencher CRM
    const crmInput = await page.$('input[name="crm"], input#crm, #num-inscricao, [name="numero"]');
    if (crmInput) {
      await crmInput.type(crm.toString(), { delay: 50 });
    }
    
    await new Promise(r => setTimeout(r, 1000));
    
    // Clicar no botão de busca
    console.log('🔎 Buscando...');
    const searchBtn = await page.$('button[type="submit"], input[type="submit"], .btn-buscar, #btn-pesquisar');
    if (searchBtn) {
      await searchBtn.click();
    }
    
    // Aguardar resultado
    await new Promise(r => setTimeout(r, 5000));
    
    // Extrair dados
    console.log('📊 Extraindo dados...');
    const resultado = await page.evaluate(() => {
      // Buscar dados em tabela ou cards de resultado
      const getText = (selectors) => {
        for (const sel of selectors) {
          const el = document.querySelector(sel);
          if (el && el.textContent.trim()) return el.textContent.trim();
        }
        return '';
      };
      
      // Tentar diferentes estruturas de resultado
      const nome = getText([
        '.resultado-nome', '.nome-medico', 'td:nth-child(1)', 
        '.card-title', 'h2.nome', '[data-nome]'
      ]);
      
      const situacao = getText([
        '.resultado-situacao', '.situacao', 'td:nth-child(4)',
        '.status', '[data-situacao]'
      ]);
      
      const especialidade = getText([
        '.resultado-especialidade', '.especialidade', 'td:nth-child(3)',
        '.especializacao', '[data-especialidade]'
      ]);
      
      // Verificar se encontrou dados
      const pageText = document.body.innerText.toLowerCase();
      const naoEncontrado = pageText.includes('não encontrado') || 
                           pageText.includes('nenhum resultado') ||
                           pageText.includes('sem resultado');
      
      return {
        nome: nome || '',
        situacao: situacao || '',
        especialidade: especialidade || '',
        naoEncontrado,
        pageContent: document.body.innerText.substring(0, 2000)
      };
    });
    
    await browser.close();
    
    // Processar resultado
    if (resultado.naoEncontrado || !resultado.nome) {
      // Tentar extrair do conteúdo da página
      const pageContent = resultado.pageContent || '';
      
      // Regex para encontrar dados
      const nomeMatch = pageContent.match(/Nome[:\s]+([A-Z][A-Za-z\s]+)/);
      const situMatch = pageContent.match(/Situa[çc][ãa]o[:\s]+(\w+)/i);
      
      if (nomeMatch) {
        const data = {
          encontrado: true,
          nome: nomeMatch[1].trim(),
          crm,
          uf: uf.toUpperCase(),
          situacao: situMatch ? situMatch[1] : 'Não informado',
          fonte: 'CFM Portal (scraping)'
        };
        
        cache.set(cacheKey, { timestamp: Date.now(), data });
        return data;
      }
      
      return {
        encontrado: false,
        mensagem: `CRM ${crm}/${uf} não encontrado no portal CFM`
      };
    }
    
    const data = {
      encontrado: true,
      nome: resultado.nome,
      crm,
      uf: uf.toUpperCase(),
      situacao: resultado.situacao || 'Não informado',
      especialidade: resultado.especialidade || '',
      fonte: 'CFM Portal (scraping)'
    };
    
    cache.set(cacheKey, { timestamp: Date.now(), data });
    console.log('✅ Dados obtidos:', data.nome);
    return data;
    
  } catch (error) {
    console.error('❌ Erro no scraper:', error.message);
    
    if (browser) {
      try { await browser.close(); } catch {}
    }
    
    // Retornar erro com sugestão
    return {
      encontrado: false,
      erro: true,
      mensagem: `Erro ao consultar CFM: ${error.message}`,
      sugestao: 'O portal CFM pode estar lento. Tente novamente ou use o modo MOCK para testes.'
    };
  }
}

// Alias para compatibilidade
const consultar = consultarCRM;

// Limpar cache
function limparCache() {
  const count = cache.size;
  cache.clear();
  console.log(`🗑️ Cache limpo. ${count} entradas removidas.`);
  return count;
}

// Estatísticas do cache
function estatisticasCache() {
  const agora = Date.now();
  let validos = 0;
  let expirados = 0;
  
  for (const [key, value] of cache.entries()) {
    if (agora - value.timestamp < CACHE_TTL) {
      validos++;
    } else {
      expirados++;
      cache.delete(key);
    }
  }
  
  return {
    total: validos,
    expiradosRemovidos: expirados,
    ttlHoras: CACHE_TTL / (60 * 60 * 1000)
  };
}

module.exports = {
  consultar,
  consultarCRM,
  limparCache,
  estatisticasCache
};
