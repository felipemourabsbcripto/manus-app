# ═══════════════════════════════════════════════════════════════════════════════
#                           MANUAL TÉCNICO COMPLETO
#                              SISTEMA ESCALAPRO
#                     Gestão de Plantões Médicos | Santa Casa BH
# ═══════════════════════════════════════════════════════════════════════════════

---

# 📋 ÍNDICE

1. [Introdução](#1-introdução)
2. [Arquitetura do Sistema](#2-arquitetura-do-sistema)
3. [Módulo de Funcionários/Médicos](#3-módulo-de-funcionáriosmédicos)
4. [Módulo de Escalas](#4-módulo-de-escalas)
5. [Módulo de Presenças e Furos](#5-módulo-de-presenças-e-furos)
6. [Módulo de Geolocalização](#6-módulo-de-geolocalização)
7. [Módulo de WhatsApp](#7-módulo-de-whatsapp)
8. [Módulo de Supervisores de Backup](#8-módulo-de-supervisores-de-backup)
9. [Módulo de Notas e Avaliações](#9-módulo-de-notas-e-avaliações)
10. [Módulo de Pagamentos](#10-módulo-de-pagamentos)
11. [Módulo de Relatórios](#11-módulo-de-relatórios)
12. [Configurações do Sistema](#12-configurações-do-sistema)
13. [API Reference](#13-api-reference)
14. [Instalação e Deploy](#14-instalação-e-deploy)

---

# 1. INTRODUÇÃO

## 1.1 Sobre o Sistema

O **EscalaPro** é um sistema web completo para gerenciamento de escalas de plantões médicos, desenvolvido exclusivamente para a **Santa Casa de Misericórdia de Belo Horizonte**.

### Principais Objetivos:
- Automatizar a criação e gestão de escalas de plantão
- Controlar presenças com ponto eletrônico e geolocalização
- Centralizar a comunicação via WhatsApp
- Registrar e rastrear todas as atividades (backlog)
- Calcular pagamentos automaticamente
- Gerar relatórios gerenciais

## 1.2 Stack Tecnológica

| Componente | Tecnologia |
|------------|------------|
| Frontend | React 19 + Vite 7 |
| Backend | Node.js + Express 5 |
| Banco de Dados | SQLite (better-sqlite3) |
| UI Icons | Lucide React |
| Gráficos | Recharts |
| Roteamento | React Router DOM 7 |
| Datas | date-fns |

## 1.3 Requisitos do Sistema

- Node.js 18+ 
- NPM 9+
- Navegador moderno (Chrome, Firefox, Safari, Edge)
- Conexão com internet para WhatsApp

---

# 2. ARQUITETURA DO SISTEMA

## 2.1 Estrutura de Diretórios

```
escalapro/
├── public/                 # Arquivos estáticos
├── server/                 # Backend
│   ├── database.js         # Configuração SQLite + Tabelas
│   ├── index.js            # API Express (todas as rotas)
│   ├── whatsapp.js         # Módulo de integração WhatsApp
│   └── localizacao.js      # Módulo de geolocalização
├── src/                    # Frontend React
│   ├── pages/              # Páginas/Componentes
│   │   ├── Dashboard.jsx
│   │   ├── Funcionarios.jsx
│   │   ├── Escalas.jsx
│   │   ├── Presencas.jsx
│   │   ├── Furos.jsx
│   │   ├── CheckIn.jsx
│   │   ├── WhatsApp.jsx
│   │   ├── Notas.jsx
│   │   ├── Pagamentos.jsx
│   │   ├── Relatorios.jsx
│   │   ├── Avisos.jsx
│   │   └── Configuracoes.jsx
│   ├── App.jsx             # Componente principal + rotas
│   ├── App.css             # Estilos globais
│   ├── config.js           # Configuração da API URL
│   └── main.jsx            # Entry point
├── package.json
└── vite.config.js
```

## 2.2 Modelo de Dados (Tabelas SQLite)

### Tabelas Principais:

```sql
-- Funcionários (Médicos, Gestores, Admin)
funcionarios (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  email TEXT,
  telefone TEXT,
  whatsapp TEXT,
  cargo TEXT,
  especialidade TEXT,
  crm TEXT,
  tipo TEXT DEFAULT 'medico',  -- 'admin', 'gestor', 'medico'
  gestor_id TEXT,
  salario_hora REAL DEFAULT 0,
  ativo INTEGER DEFAULT 1
)

-- Turnos
turnos (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  hora_inicio TEXT NOT NULL,
  hora_fim TEXT NOT NULL,
  dias_semana TEXT NOT NULL,  -- JSON array [0,1,2,3,4,5,6]
  ativo INTEGER DEFAULT 1
)

-- Escalas
escalas (
  id TEXT PRIMARY KEY,
  funcionario_id TEXT NOT NULL,
  turno_id TEXT,
  data TEXT NOT NULL,
  hora_inicio TEXT NOT NULL,
  hora_fim TEXT NOT NULL,
  status TEXT DEFAULT 'agendado'
)

-- Presenças
presencas (
  id TEXT PRIMARY KEY,
  escala_id TEXT NOT NULL,
  funcionario_id TEXT NOT NULL,
  data TEXT NOT NULL,
  hora_entrada TEXT,
  hora_saida TEXT,
  status TEXT DEFAULT 'pendente',  -- 'pendente', 'presente', 'atraso', 'furo', 'falta'
  justificativa TEXT,
  aprovado INTEGER DEFAULT 0,
  checkin_lat REAL,
  checkin_lng REAL,
  checkout_lat REAL,
  checkout_lng REAL,
  hora_extra_minutos INTEGER DEFAULT 0,
  hora_extra_motivo TEXT
)

-- Supervisores de Backup
supervisores (
  id TEXT PRIMARY KEY,
  gestor_id TEXT NOT NULL,
  nome TEXT NOT NULL,
  whatsapp TEXT NOT NULL,
  email TEXT,
  ordem_prioridade INTEGER DEFAULT 1,
  ativo INTEGER DEFAULT 1,
  falhas_consecutivas INTEGER DEFAULT 0
)
```

### Tabelas de WhatsApp:

```sql
-- Conexões WhatsApp
whatsapp_conexoes (
  id TEXT PRIMARY KEY,
  gestor_id TEXT NOT NULL,
  telefone TEXT,
  status TEXT DEFAULT 'desconectado',
  qrcode TEXT
)

-- Grupos
whatsapp_grupos (
  id TEXT PRIMARY KEY,
  gestor_id TEXT NOT NULL,
  nome TEXT NOT NULL,
  link_convite TEXT,
  ativo INTEGER DEFAULT 1
)

-- Membros dos grupos
whatsapp_grupo_membros (
  id TEXT PRIMARY KEY,
  grupo_id TEXT NOT NULL,
  funcionario_id TEXT NOT NULL
)

-- Mensagens enviadas
whatsapp_mensagens (
  id TEXT PRIMARY KEY,
  tipo TEXT NOT NULL,  -- 'grupo', 'pessoal'
  destino TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  status TEXT DEFAULT 'pendente'
)
```

---

# 3. MÓDULO DE FUNCIONÁRIOS/MÉDICOS

## 3.1 Tipos de Usuário

| Tipo | Descrição | Permissões |
|------|-----------|------------|
| admin | Administrador | Acesso total ao sistema |
| gestor | Gestor de Plantão | Gerencia sua equipe de médicos |
| medico | Médico | Visualiza escalas, faz check-in/out |

## 3.2 Campos do Cadastro de Médico

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| nome | texto | ✅ | Nome completo |
| crm | texto | ✅ | CRM com UF (ex: CRM/SP 123456) |
| especialidade | select | ✅ | Lista de 54 especialidades |
| whatsapp | texto | ✅ | Número com DDI+DDD (5511999999999) |
| email | texto | ❌ | Email para contato |
| gestor_id | select | ❌ | Gestor responsável |
| salario_hora | número | ❌ | Valor/hora para cálculo de pagamento |

## 3.3 Lista de Especialidades Médicas

```
Acupuntura, Alergia e Imunologia, Anestesiologia, Angiologia,
Cancerologia (Oncologia), Cardiologia, Cirurgia Cardiovascular,
Cirurgia da Mão, Cirurgia de Cabeça e Pescoço, Cirurgia do Aparelho Digestivo,
Cirurgia Geral, Cirurgia Pediátrica, Cirurgia Plástica, Cirurgia Torácica,
Cirurgia Vascular, Clínica Médica, Coloproctologia, Dermatologia,
Endocrinologia e Metabologia, Endoscopia, Gastroenterologia, Genética Médica,
Geriatria, Ginecologia e Obstetrícia, Hematologia e Hemoterapia, Homeopatia,
Infectologia, Mastologia, Medicina de Emergência, Medicina de Família e Comunidade,
Medicina do Trabalho, Medicina do Tráfego, Medicina Esportiva,
Medicina Física e Reabilitação, Medicina Intensiva, Medicina Legal e Perícia Médica,
Medicina Nuclear, Medicina Preventiva e Social, Nefrologia, Neurocirurgia,
Neurologia, Nutrologia, Oftalmologia, Ortopedia e Traumatologia,
Otorrinolaringologia, Patologia, Patologia Clínica/Medicina Laboratorial,
Pediatria, Pneumologia, Psiquiatria, Radiologia e Diagnóstico por Imagem,
Radioterapia, Reumatologia, Urologia
```

## 3.4 API Endpoints

```
GET    /api/funcionarios          - Lista todos
GET    /api/funcionarios/:id      - Busca por ID
POST   /api/funcionarios          - Criar novo
PUT    /api/funcionarios/:id      - Atualizar
DELETE /api/funcionarios/:id      - Desativar (soft delete)
GET    /api/gestores              - Lista gestores e admins
GET    /api/gestores/:id/medicos  - Lista médicos de um gestor
```

---

# 4. MÓDULO DE ESCALAS

## 4.1 Funcionalidades

### Criação Manual de Escala
- Selecionar funcionário
- Definir data
- Definir horário de início e fim
- Associar a um turno (opcional)

### Geração Automática de Escalas
- Definir período (data início e fim)
- Selecionar turno
- Selecionar gestor (opcional, filtra médicos)
- Sistema distribui automaticamente os médicos disponíveis

### Troca de Escala
- Selecionar escala existente
- Escolher novo médico
- Sistema notifica ambos via WhatsApp

## 4.2 Algoritmo de Geração Automática

```javascript
// Pseudocódigo
1. Obter lista de funcionários (filtrar por gestor se informado)
2. Obter turno selecionado (dias da semana, horários)
3. Para cada dia no período:
   a. Verificar se dia da semana está no turno
   b. Se sim, atribuir próximo funcionário da lista (rodízio)
   c. Criar registro de escala
   d. Criar registro de presença (pendente)
4. Retornar lista de escalas geradas
```

## 4.3 API Endpoints

```
GET    /api/escalas                    - Lista com filtros
POST   /api/escalas                    - Criar escala manual
POST   /api/escalas/gerar-automatico   - Geração automática
POST   /api/escalas/trocar             - Trocar funcionário
PUT    /api/escalas/:id                - Atualizar
DELETE /api/escalas/:id                - Excluir
```

---

# 5. MÓDULO DE PRESENÇAS E FUROS

## 5.1 Status de Presença

| Status | Descrição | Cor |
|--------|-----------|-----|
| pendente | Aguardando check-in | Cinza |
| presente | Check-in realizado no horário | Verde |
| atraso | Check-in após tolerância | Amarelo |
| furo | Não compareceu (>30min após tolerância) | Vermelho |
| falta | Ausência justificada | Laranja |

## 5.2 Fluxo de Verificação Automática

```
1. Sistema verifica a cada minuto (cron interno)
2. Busca escalas do dia com hora_inicio < agora
3. Para cada escala sem check-in:
   a. Calcula diferença de tempo
   b. Se > tolerância + 30 min → marca como FURO
   c. Cria aviso no sistema
   d. Envia notificação WhatsApp para médico e gestor
```

## 5.3 Configurações de Tolerância

| Configuração | Valor Padrão | Descrição |
|--------------|--------------|-----------|
| tolerancia_atraso_minutos | 15 | Minutos de tolerância para atraso |
| verificar_saida_intervalo | 30 | Intervalo (min) para verificar saída |

## 5.4 API Endpoints

```
GET  /api/presencas                  - Lista com filtros
GET  /api/furos                      - Lista apenas furos/atrasos/faltas
PUT  /api/presencas/:id              - Atualizar (registrar entrada/saída)
POST /api/presencas/verificar-furos  - Executar verificação manual
```

---

# 6. MÓDULO DE GEOLOCALIZAÇÃO

## 6.1 Funcionalidades

### Check-in
1. Médico acessa página de Check-in
2. Sistema solicita permissão de localização
3. Médico confirma check-in
4. Sistema:
   - Registra latitude/longitude
   - Calcula distância do hospital
   - Registra hora de entrada
   - Atualiza status da presença
   - Notifica grupo WhatsApp

### Check-out
1. Médico acessa página de Check-in
2. Clica em "Finalizar Plantão"
3. Se hora > hora_fim esperada:
   - Sistema pergunta se é hora extra
   - Se sim, solicita motivo (obrigatório)
4. Sistema:
   - Registra localização de saída
   - Calcula horas trabalhadas
   - Registra hora extra (se houver)
   - Notifica grupo WhatsApp

### Verificação Periódica
- A cada 1 hora durante o plantão
- Médico recebe solicitação para atualizar localização
- Se distância > 2km do hospital → alerta ao gestor

## 6.2 Cálculo de Distância

```javascript
// Fórmula de Haversine
function calcularDistancia(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Raio da Terra em metros
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c; // Distância em metros
}
```

## 6.3 Configurações

| Configuração | Valor Padrão | Descrição |
|--------------|--------------|-----------|
| distancia_maxima_hospital | 2000 | Distância máxima em metros |
| verificar_localizacao_intervalo | 60 | Intervalo de verificação (min) |
| hospital_principal_lat | -23.5505 | Latitude do hospital |
| hospital_principal_lng | -46.6333 | Longitude do hospital |

## 6.4 API Endpoints

```
POST /api/checkin                         - Realizar check-in
POST /api/checkout                        - Realizar check-out
POST /api/localizacao/atualizar           - Atualizar localização
GET  /api/localizacao/historico/:func_id  - Histórico de localizações
POST /api/localizacao/executar-verificacoes - Executar verificações pendentes
```

---

# 7. MÓDULO DE WHATSAPP

## 7.1 Arquitetura de Integração

O sistema utiliza uma camada de abstração que pode ser conectada a:
- **Evolution API** (recomendado para produção)
- **Baileys** (biblioteca Node.js)
- **WhatsApp Business API** (oficial)

### Fluxo de Conexão:
1. Gestor acessa página WhatsApp
2. Clica em "Conectar WhatsApp"
3. Sistema gera QR Code
4. Gestor escaneia com WhatsApp
5. Conexão estabelecida

## 7.2 Grupos de Plantão

Cada gestor pode ter um grupo com nome padrão: **"Plantão - [Nome do Gestor]"**

### Funcionalidades do Grupo:
- Link de convite automático
- Adicionar/remover membros
- Enviar mensagens para todos
- Marcar médico específico (@)
- Notificações automáticas

## 7.3 Tipos de Notificação Automática

| Evento | Destinatário | Mensagem |
|--------|--------------|----------|
| Início do Plantão | Grupo | Lista completa da equipe escalada |
| Check-in | Grupo | Confirmação de entrada com hora |
| Check-out | Grupo | Confirmação de saída (+ hora extra se houver) |
| Furo/Falta | Grupo + Médico + Gestor | Alerta de ausência |
| Troca de Escala | Grupo + Médicos envolvidos | Notificação da troca |
| Localização Distante | Gestor | Alerta de distância >2km |
| Lembrete de Saída | Médico | Pergunta se encerrou ou continua |

## 7.4 Formato das Mensagens

### Notificação de Plantão:
```
🏥 *PLANTÃO DO DIA 22/01/2026*

📋 *Equipe escalada:*

1. *Dr. João Santos*
   📌 Especialidade: Cardiologia
   ⏰ Horário: 07:00 - 19:00

2. *Dra. Maria Silva*
   📌 Especialidade: Medicina de Emergência
   ⏰ Horário: 07:00 - 19:00

✅ Todos devem fazer check-in ao chegar!
📍 Lembre-se de compartilhar sua localização.
```

### Check-in:
```
✅ *CHECK-IN REALIZADO*

👨‍⚕️ *Dr. João Santos*
📌 Cardiologia
⏰ Entrada: 06:55
📍 Localização confirmada
```

### Alerta de Furo:
```
⚠️ *FURO REGISTRADO*

👨‍⚕️ *Dr. João Santos*
📅 Data: 22/01/2026

⚠️ Gestor notificado.
```

## 7.5 API Endpoints

```
POST /api/whatsapp/conectar           - Gerar QR Code
POST /api/whatsapp/confirmar-conexao  - Confirmar conexão
GET  /api/whatsapp/status/:gestor_id  - Status da conexão
POST /api/whatsapp/desconectar        - Desconectar
POST /api/whatsapp/grupos             - Criar grupo
GET  /api/whatsapp/grupos/:gestor_id  - Listar grupos
POST /api/whatsapp/grupos/:id/membros - Adicionar membro
POST /api/whatsapp/mensagem/grupo     - Enviar para grupo
POST /api/whatsapp/mensagem/pessoal   - Enviar pessoal
POST /api/whatsapp/notificar-plantao  - Notificar início do plantão
GET  /api/whatsapp/mensagens          - Histórico de mensagens
```

---

# 8. MÓDULO DE SUPERVISORES DE BACKUP

## 8.1 Conceito

Os **Supervisores de Backup** são números de WhatsApp alternativos cadastrados para cada gestor. Se o envio de mensagem pelo número principal falhar, o sistema automaticamente tenta enviar pelos supervisores em ordem de prioridade.

## 8.2 Fluxo de Fallback

```
Enviar Mensagem
      │
      ▼
┌─────────────┐
│   Gestor    │ ──falha──┐
│  Principal  │          │
└─────────────┘          ▼
      │            ┌─────────────┐
   sucesso         │ Supervisor  │ ──falha──┐
      │            │     1º      │          │
      ▼            └─────────────┘          ▼
  ✅ Enviado            │            ┌─────────────┐
                     sucesso         │ Supervisor  │ ──falha──> ...
                        │            │     2º      │
                        ▼            └─────────────┘
                    ✅ Enviado
```

## 8.3 Campos do Supervisor

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| nome | texto | ✅ | Nome do supervisor |
| whatsapp | texto | ✅ | Número com DDI+DDD |
| email | texto | ❌ | Email para contato |
| ordem_prioridade | número | auto | Ordem de tentativa |
| falhas_consecutivas | número | auto | Contador de falhas |

## 8.4 Regras de Fallback

- Supervisores com >5 falhas consecutivas são temporariamente ignorados
- Após envio bem-sucedido, contador de falhas é resetado
- Ordem pode ser alterada manualmente pelo gestor
- Estatísticas de envio são registradas para auditoria

## 8.5 API Endpoints

```
GET    /api/supervisores/:gestor_id           - Listar supervisores
POST   /api/supervisores                      - Adicionar supervisor
PUT    /api/supervisores/:id                  - Atualizar
DELETE /api/supervisores/:id                  - Remover
PUT    /api/supervisores/:gestor_id/reordenar - Reordenar prioridades
GET    /api/supervisores/:gestor_id/estatisticas - Estatísticas de envio
```

---

# 9. MÓDULO DE NOTAS E AVALIAÇÕES

## 9.1 Critérios de Avaliação

| Critério | Cálculo | Peso |
|----------|---------|------|
| Pontualidade | (dias sem atraso / total) × 10 | 33% |
| Assiduidade | (dias sem furo/falta / total) × 10 | 33% |
| Desempenho | Média de pontualidade + assiduidade | 34% |

## 9.2 Cálculo Automático

```javascript
// Buscar presenças do período
const presencas = buscarPresencas(funcionario_id, periodo_inicio, periodo_fim);

const total = presencas.length;
const presentes = presencas.filter(p => p.status === 'presente').length;
const atrasos = presencas.filter(p => p.status === 'atraso').length;
const furos = presencas.filter(p => ['furo', 'falta'].includes(p.status)).length;

const pontualidade = ((total - atrasos) / total) * 10;
const assiduidade = ((total - furos) / total) * 10;
const desempenho = (pontualidade + assiduidade) / 2;
```

## 9.3 API Endpoints

```
GET  /api/notas                    - Listar notas
POST /api/notas                    - Criar avaliação manual
POST /api/notas/calcular-automatico - Calcular nota automática
```

---

# 10. MÓDULO DE PAGAMENTOS

## 10.1 Cálculo de Pagamento

```
Valor Total = (Horas Trabalhadas × Valor/Hora) 
            + (Horas Extras × Valor/Hora × Multiplicador)
            + Bônus
            - Descontos
```

## 10.2 Configurações

| Configuração | Valor Padrão | Descrição |
|--------------|--------------|-----------|
| horas_extras_multiplicador | 1.5 | Multiplicador para hora extra |
| desconto_furo_percentual | 5 | % de desconto por furo |

## 10.3 Cálculo Automático

```javascript
// Buscar presenças com entrada/saída
const presencas = buscarPresencas(funcionario_id, periodo);

let horasTrabalhadas = 0;
let horasExtras = 0;

presencas.forEach(p => {
  // Calcular minutos trabalhados
  const trabalhado = calcularMinutos(p.hora_entrada, p.hora_saida);
  const esperado = calcularMinutos(p.esperado_inicio, p.esperado_fim);
  
  horasTrabalhadas += Math.min(trabalhado, esperado) / 60;
  if (trabalhado > esperado) {
    horasExtras += (trabalhado - esperado) / 60;
  }
});

// Calcular descontos por furos
const furos = contarFuros(funcionario_id, periodo);
const descontos = furos * (valor_hora * 8 * (desconto_percentual / 100));
```

## 10.4 Status de Pagamento

| Status | Descrição |
|--------|-----------|
| pendente | Aguardando pagamento |
| pago | Pagamento realizado |
| cancelado | Pagamento cancelado |

## 10.5 API Endpoints

```
GET  /api/pagamentos           - Listar pagamentos
POST /api/pagamentos           - Criar pagamento
POST /api/pagamentos/calcular  - Calcular valores automaticamente
PUT  /api/pagamentos/:id       - Atualizar status
```

---

# 11. MÓDULO DE RELATÓRIOS

## 11.1 Tipos de Relatório

### Relatório Completo do Gestor
Inclui:
- Resumo de presenças (total, presentes, atrasos, furos, faltas)
- Lista detalhada de presenças
- Backlog de eventos
- Estatísticas de mensagens enviadas
- Estatísticas de envio por supervisor

### Backlog Individual
Histórico de eventos do funcionário:
- Check-ins e check-outs
- Furos e atrasos
- Trocas de escala
- Horas extras
- Localizações
- Mensagens

## 11.2 Exportação

- **JSON**: Dados completos para integração
- **PDF**: Relatório formatado (via frontend)

## 11.3 API Endpoints

```
POST /api/relatorios/gerar           - Gerar relatório
GET  /api/relatorios/:gestor_id      - Listar relatórios do gestor
GET  /api/relatorios/detalhes/:id    - Detalhes de um relatório
GET  /api/backlog/:funcionario_id    - Backlog individual
```

---

# 12. CONFIGURAÇÕES DO SISTEMA

## 12.1 Lista de Configurações

| Chave | Valor Padrão | Descrição |
|-------|--------------|-----------|
| tolerancia_atraso_minutos | 15 | Minutos de tolerância para atraso |
| horas_extras_multiplicador | 1.5 | Multiplicador para hora extra |
| desconto_furo_percentual | 5 | % de desconto por furo |
| notificar_furos | 1 | Notificar furos via WhatsApp |
| notificar_escalas | 1 | Notificar escalas via WhatsApp |
| whatsapp_ativo | 1 | WhatsApp habilitado |
| verificar_localizacao_intervalo | 60 | Intervalo de verificação (min) |
| distancia_maxima_hospital | 2000 | Distância máxima em metros |
| verificar_saida_intervalo | 30 | Intervalo para verificar saída (min) |
| hospital_principal_lat | -23.5505 | Latitude do hospital |
| hospital_principal_lng | -46.6333 | Longitude do hospital |
| hospital_principal_nome | Hospital Principal | Nome do hospital |

## 12.2 API Endpoints

```
GET /api/configuracoes  - Obter todas as configurações
PUT /api/configuracoes  - Atualizar configurações
```

---

# 13. API REFERENCE

## 13.1 Base URL

```
Desenvolvimento: http://localhost:3001/api
Produção: https://[seu-dominio]/api
```

## 13.2 Formato de Resposta

Todas as respostas são em JSON:

```json
// Sucesso
{ "id": "uuid", "nome": "valor", ... }

// Lista
[ { ... }, { ... } ]

// Erro
{ "error": "Mensagem de erro" }
```

## 13.3 Endpoints Completos

### Dashboard
```
GET /api/dashboard?gestor_id=xxx
```

### Funcionários
```
GET    /api/funcionarios
GET    /api/funcionarios/:id
POST   /api/funcionarios
PUT    /api/funcionarios/:id
DELETE /api/funcionarios/:id
GET    /api/gestores
GET    /api/gestores/:id/medicos
```

### Turnos
```
GET    /api/turnos
POST   /api/turnos
DELETE /api/turnos/:id
```

### Escalas
```
GET    /api/escalas
POST   /api/escalas
POST   /api/escalas/gerar-automatico
POST   /api/escalas/trocar
PUT    /api/escalas/:id
DELETE /api/escalas/:id
```

### Presenças
```
GET  /api/presencas
GET  /api/furos
PUT  /api/presencas/:id
POST /api/presencas/verificar-furos
```

### Geolocalização
```
POST /api/checkin
POST /api/checkout
POST /api/localizacao/atualizar
GET  /api/localizacao/historico/:funcionario_id
POST /api/localizacao/executar-verificacoes
```

### WhatsApp
```
POST /api/whatsapp/conectar
POST /api/whatsapp/confirmar-conexao
GET  /api/whatsapp/status/:gestor_id
POST /api/whatsapp/desconectar
POST /api/whatsapp/grupos
GET  /api/whatsapp/grupos/:gestor_id
GET  /api/whatsapp/grupos/:grupo_id/membros
POST /api/whatsapp/grupos/:grupo_id/membros
POST /api/whatsapp/mensagem/grupo
POST /api/whatsapp/mensagem/pessoal
POST /api/whatsapp/notificar-plantao
GET  /api/whatsapp/mensagens
```

### Supervisores
```
GET    /api/supervisores/:gestor_id
POST   /api/supervisores
PUT    /api/supervisores/:id
DELETE /api/supervisores/:id
PUT    /api/supervisores/:gestor_id/reordenar
GET    /api/supervisores/:gestor_id/estatisticas
```

### Notas
```
GET  /api/notas
POST /api/notas
POST /api/notas/calcular-automatico
```

### Pagamentos
```
GET  /api/pagamentos
POST /api/pagamentos
POST /api/pagamentos/calcular
PUT  /api/pagamentos/:id
```

### Horas Extras
```
GET /api/horas-extras
PUT /api/horas-extras/:id/aprovar
```

### Hospitais
```
GET  /api/hospitais
POST /api/hospitais
PUT  /api/hospitais/:id
```

### Avisos
```
GET /api/avisos
PUT /api/avisos/:id/lido
PUT /api/avisos/marcar-todos-lidos
```

### Relatórios
```
POST /api/relatorios/gerar
GET  /api/relatorios/:gestor_id
GET  /api/relatorios/detalhes/:id
GET  /api/backlog/:funcionario_id
```

### Configurações
```
GET /api/configuracoes
PUT /api/configuracoes
```

---

# 14. INSTALAÇÃO E DEPLOY

## 14.1 Requisitos

- Node.js 18+
- NPM 9+
- Git

## 14.2 Instalação Local

```bash
# Clonar repositório
git clone https://github.com/felipemourabsbcripto/manus-app.git
cd manus-app

# Instalar dependências
npm install

# Iniciar backend (terminal 1)
node server/index.js

# Iniciar frontend (terminal 2)
npm run dev
```

## 14.3 Variáveis de Ambiente

```env
PORT=3001                    # Porta do backend
NODE_ENV=production          # Ambiente
```

## 14.4 Build para Produção

```bash
# Build do frontend
npm run build

# Os arquivos estáticos estarão em dist/
```

## 14.5 Deploy Recomendado

### Backend:
- **Render** / **Railway** / **Fly.io** (Node.js)
- Ou VPS com PM2

### Frontend:
- **Vercel** / **Netlify** / **Cloudflare Pages**
- Ou servir estático via backend

### Banco de Dados:
- SQLite para pequeno/médio porte
- Migrar para PostgreSQL se necessário escalar

---

# 📞 SUPORTE

Para dúvidas técnicas ou suporte:
- Documentação: Este manual
- Repositório: https://github.com/felipemourabsbcripto/manus-app

---

*Manual Técnico EscalaPro v1.0*
*Desenvolvido para Santa Casa de Misericórdia de Belo Horizonte*
*Janeiro 2026*
