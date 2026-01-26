/**
 * ============================================
 * CRM SCRAPER - Consulta Automatizada CFM
 * ============================================
 * 
 * Este módulo faz web scraping no portal do CFM para consultar
 * dados públicos de médicos. 
 * 
 * IMPORTANTE: 
 * - Use com moderação para não sobrecarregar o servidor do CFM
 * - Para uso em produção, considere contratar o Webservice oficial:
 *   https://sistemas.cfm.org.br/listamedicos/informacoes
 *   Custo: R$ 948,00/ano (empresas) | Gratuito (entidades públicas)
 * 
 * Dados disponíveis:
 * - Nome completo do médico
 * - Número do CRM
 * - Estado (UF)
 * - Tipo de inscrição
 * - Situação (Ativo/Inativo)
 * - Especialidades registradas
 */

const puppeteer = require('puppeteer');

// Cache em memória para evitar consultas repetidas
const cache = new Map();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 horas

/**
 * Consulta CRM no portal do CFM usando Puppeteer
 * @param {string} crm - Número do CRM
 * @param {string} uf - UF do registro (ex: MG, SP, RJ)
 * @returns {Promise<Object>} Dados do médico
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
    // Iniciar navegador headless
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--window-size=1920x1080'
      ]
    });

    const page = await browser.newPage();
    
    // Configurar User-Agent para parecer um navegador real
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Configurar timeout
    page.setDefaultTimeout(30000);
    
    // Acessar página de busca
    await page.goto('https://portal.cfm.org.br/busca-medicos/', {
      waitUntil: 'networkidle2'
    });

    // Aguardar formulário carregar
    await page.waitForSelector('#buscaForm', { timeout: 10000 });

    // Preencher campos do formulário
    // Campo CRM
    await page.type('input[name="crm"]', crm.toString());
    
    // Campo UF (select)
    await page.select('select[name="uf"]', uf.toUpperCase());

    // Clicar em Enviar
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2' }),
      page.click('button[type="submit"], input[type="submit"]')
    ]).catch(() => {
      // Algumas vezes não há navegação, só atualização de conteúdo
    });

    // Aguardar resultados
    await page.waitForTimeout(2000);

    // Extrair dados da página de resultados
    const resultado = await page.evaluate(() => {
      // Procurar tabela de resultados ou card com dados
      const rows = document.querySelectorAll('.resultado-busca tr, .card-medico, .medico-info');
      
      if (rows.length === 0) {
        // Verificar se há mensagem de "não encontrado"
        const noResult = document.querySelector('.no-result, .sem-resultado, .alert-warning');
        if (noResult) {
          return { encontrado: false, mensagem: noResult.textContent.trim() };
        }
        return { encontrado: false, mensagem: 'Médico não encontrado' };
      }

      // Tentar extrair dados de diferentes formatos possíveis
      const extrairTexto = (seletor) => {
        const el = document.querySelector(seletor);
        return el ? el.textContent.trim() : null;
      };

      // Formato 1: Tabela
      const dados = {};
      document.querySelectorAll('table tr').forEach(row => {
        const cells = row.querySelectorAll('td, th');
        if (cells.length >= 2) {
          const label = cells[0].textContent.trim().toLowerCase();
          const value = cells[1].textContent.trim();
          
          if (label.includes('nome')) dados.nome = value;
          if (label.includes('crm')) dados.crm = value;
          if (label.includes('uf') || label.includes('estado')) dados.uf = value;
          if (label.includes('situação') || label.includes('situacao')) dados.situacao = value;
          if (label.includes('inscrição') || label.includes('inscricao')) dados.tipoInscricao = value;
          if (label.includes('especialidade')) dados.especialidade = value;
        }
      });

      // Formato 2: Divs com labels
      document.querySelectorAll('.field, .campo, [class*="resultado"]').forEach(field => {
        const text = field.textContent;
        if (text.includes('Nome:')) dados.nome = text.split('Nome:')[1]?.split('\n')[0]?.trim();
        if (text.includes('CRM:')) dados.crm = text.split('CRM:')[1]?.split('\n')[0]?.trim();
        if (text.includes('Situação:')) dados.situacao = text.split('Situação:')[1]?.split('\n')[0]?.trim();
      });

      if (Object.keys(dados).length > 0) {
        return { encontrado: true, ...dados };
      }

      // Capturar HTML para debug se necessário
      return { 
        encontrado: false, 
        mensagem: 'Formato de resposta não reconhecido',
        debug: document.body.innerHTML.substring(0, 500)
      };
    });

    // Salvar no cache se encontrou
    if (resultado.encontrado) {
      cache.set(cacheKey, {
        timestamp: Date.now(),
        data: resultado
      });
    }

    console.log(`✅ Consulta CRM ${crm}/${uf} concluída:`, resultado.encontrado ? 'Encontrado' : 'Não encontrado');
    return resultado;

  } catch (error) {
    console.error(`❌ Erro ao consultar CRM ${crm}/${uf}:`, error.message);
    return {
      encontrado: false,
      erro: true,
      mensagem: `Erro na consulta: ${error.message}`
    };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Consulta CRM usando fetch direto (alternativa sem Puppeteer)
 * Tenta fazer requisição direta à API do CFM se disponível
 */
async function consultarCRMFetch(crm, uf) {
  const cacheKey = `${crm}-${uf.toUpperCase()}`;
  
  // Verificar cache
  if (cache.has(cacheKey)) {
    const cached = cache.get(cacheKey);
    if (Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }
  }

  try {
    // Tentar endpoint de API interno do CFM (pode não funcionar)
    const response = await fetch('https://portal.cfm.org.br/wp-admin/admin-ajax.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'X-Requested-With': 'XMLHttpRequest'
      },
      body: new URLSearchParams({
        action: 'busca_medicos',
        crm: crm,
        uf: uf.toUpperCase()
      })
    });

    if (response.ok) {
      const data = await response.json();
      if (data && data.success) {
        const resultado = {
          encontrado: true,
          ...data.data
        };
        cache.set(cacheKey, { timestamp: Date.now(), data: resultado });
        return resultado;
      }
    }
  } catch (error) {
    // Se fetch falhar, retorna null para tentar Puppeteer
  }

  return null;
}

/**
 * Função principal de consulta - tenta fetch primeiro, depois Puppeteer
 */
async function consultar(crm, uf) {
  // Validar inputs
  if (!crm || !uf) {
    return { encontrado: false, erro: true, mensagem: 'CRM e UF são obrigatórios' };
  }

  // Normalizar
  crm = crm.toString().replace(/\D/g, '');
  uf = uf.toUpperCase().trim();

  // Validar UF
  const ufsValidas = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];
  if (!ufsValidas.includes(uf)) {
    return { encontrado: false, erro: true, mensagem: `UF inválida: ${uf}` };
  }

  // Tentar fetch rápido primeiro
  const resultadoFetch = await consultarCRMFetch(crm, uf);
  if (resultadoFetch) {
    return resultadoFetch;
  }

  // Fallback para Puppeteer (web scraping)
  return consultarCRM(crm, uf);
}

/**
 * Limpar cache
 */
function limparCache() {
  cache.clear();
  console.log('🗑️ Cache de CRM limpo');
}

/**
 * Estatísticas do cache
 */
function estatisticasCache() {
  return {
    tamanho: cache.size,
    chaves: Array.from(cache.keys())
  };
}

module.exports = {
  consultar,
  consultarCRM,
  limparCache,
  estatisticasCache
};
