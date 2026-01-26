const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.join(__dirname, 'server', 'escala.db'));

try {
    const configs = db.prepare('SELECT * FROM configuracoes').all();
    console.log('--- Configurações do Banco ---');
    console.log(JSON.stringify(configs, null, 2));
} catch (e) {
    console.error('Erro ao ler banco:', e.message);
}
