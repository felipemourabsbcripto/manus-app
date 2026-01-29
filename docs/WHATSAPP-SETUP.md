# Guia de Instalação - WhatsApp API

Este guia mostra como configurar a integração do WhatsApp no Manus App.

## Opção 1: WhatsApp Local (Recomendado para Dev)

Solução mais simples usando whatsapp-web.js:

```bash
# No diretório do projeto
npm run whatsapp
```

Isso irá:
1. Iniciar o servidor na porta 8080
2. Gerar um QR Code no terminal
3. Escaneie o QR com seu WhatsApp para conectar

A API fica compatível com o formato da Evolution API.

## Opção 2: Via Docker (Evolution API)

Se preferir usar Docker:

```bash
cd /Users/felipemoura/manus-app
docker compose -f docker-compose.evolution.yml up -d
```

## Configuração no Manus App

Após iniciar a API do WhatsApp:

### Credenciais Padrão
- URL da API: http://localhost:8080
- Chave da API: manus-app-whatsapp-key-2024

### No Manus App:

1. Acesse WhatsApp no menu lateral
2. Clique em Configurar (ícone de engrenagem)
3. Preencha:
   - URL da API: http://localhost:8080
   - Chave da API: manus-app-whatsapp-key-2024
4. Clique em Salvar
5. Conecte seu WhatsApp clicando em Conectar
6. Escaneie o QR Code com seu celular

## Testando a API

```bash
# Verificar se a API está rodando
curl http://localhost:8080

# Verificar status
curl -H "apikey: manus-app-whatsapp-key-2024" http://localhost:8080/instance/fetchInstances
```

## Scripts Disponíveis

```bash
npm run server    # Backend principal (porta 3000)
npm run whatsapp  # API WhatsApp local (porta 8080)
npm run dev       # Frontend Vite
```

## Referências

- whatsapp-web.js: https://github.com/pedroslopez/whatsapp-web.js
- Evolution API Docs: https://doc.evolution-api.com/
