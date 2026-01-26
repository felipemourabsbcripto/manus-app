/**
 * ============================================
 * TESTE DO CRM SCRAPER
 * ============================================
 * 
 * Execute: node server/test-crm-scraper.js
 * 
 * Testa a consulta de CRM no portal do CFM
 */

const crmScraper = require('./crm-scraper');

async function testar() {
  console.log('🧪 Iniciando testes do CRM Scraper...\n');
  
  // CRMs de teste (usar números reais conhecidos para validar)
  const testes = [
    { crm: '12345', uf: 'SP' },
    { crm: '54321', uf: 'MG' },
    { crm: '11111', uf: 'RJ' },
  ];
  
  for (const teste of testes) {
    console.log(`\n📋 Consultando CRM ${teste.crm}/${teste.uf}...`);
    console.log('─'.repeat(50));
    
    try {
      const inicio = Date.now();
      const resultado = await crmScraper.consultar(teste.crm, teste.uf);
      const tempo = Date.now() - inicio;
      
      console.log(`⏱️ Tempo: ${tempo}ms`);
      console.log('📄 Resultado:');
      console.log(JSON.stringify(resultado, null, 2));
    } catch (error) {
      console.error(`❌ Erro: ${error.message}`);
    }
    
    // Aguardar entre consultas para não sobrecarregar
    await new Promise(r => setTimeout(r, 2000));
  }
  
  console.log('\n\n📊 Estatísticas do cache:');
  console.log(crmScraper.estatisticasCache());
  
  console.log('\n✅ Testes concluídos!');
}

testar().catch(console.error);
