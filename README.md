# manus-app

O **Manus App** é uma aplicação desenvolvida para facilitar a gestão de presenças, calendários, relatórios, notas e notificações automáticas para equipes e empresas. Oferece integrações com WhatsApp e ferramentas avançadas para monitorar e gerenciar ocorrências, escalas, pagamentos e mais.

## Funcionalidades Principais

- **Gestão de Funcionários:** Controle de escalas automatizado, registro de presenças, atrasos e faltas.
- **Controle de Ocorrências:** Monitoramento prático de furos e inconsistências nos registros.
- **Sistema de Relatórios:** Geração de relatórios personalizados com dados de presenças, notas e mensagens.
- **Notificações via WhatsApp:** Integração robusta para envio de mensagens e alertas.
- **Notas e Avaliações:** Acompanhamento de desempenho e métricas para colaboradores.
- **Controle de Pagamentos:** Ferramentas para gerenciamento de pagamentos e indicadores financeiros.
- **Customização e Configurações:** Personalização da aplicação às necessidades da equipe.

## Tecnologias Utilizadas

- **Frontend:**
  - ReactJS com React Router para navegação entre páginas.
  - Biblioteca de ícones Lucide-React para componentes visuais.
  - Estilização utilizando CSS e classes utilitárias.
- **Backend:**
  - Node.js como servidor principal.
  - Rotas e APIs REST, integrando funções para checagens de localização e geração de relatórios.
  - Integração com banco de dados para registros e gerenciamento de informações.

## Estrutura e Navegação

O aplicativo organiza suas principais funcionalidades através de páginas:

- `/presencas`: Registro e monitoramento de presenças.
- `/furos`: Análise e exibição de inconsistências (furos) no sistema.
- `/relatorios`: Geração de relatórios gerenciais.
- `/whatsapp`: Integração para envio de mensagens e estatísticas do WhatsApp.
- `/notas`: Gerenciamento de notas e avaliações.
- `/configuracoes`: Ajuste das configurações da aplicação.

## Instalação e Uso

Siga os passos abaixo para executar o projeto localmente:

1. Clone o repositório:

   ```bash
   git clone https://github.com/felipemourabsbcripto/manus-app.git
   cd manus-app
   ```

2. Instale as dependências do projeto:

   ```bash
   npm install
   ```

3. Inicie o servidor de desenvolvimento:

   ```bash
   npm start
   ```

4. Acesse a aplicação no navegador em `http://localhost:3000`.

## Geração de Relatórios via Backend

A aplicação possui rotas específicas para interações via backend. Por exemplo:

- **Gerar QR Code para conexão no WhatsApp:**
  Endpoint: `/api/whatsapp/conectar`

- **Executar verificações pendentes:**
  Endpoint: `/api/localizacao/executar-verificacoes`

## Como Contribuir

1. Faça um fork do projeto.
2. Crie uma nova branch: `git checkout -b minha-feature`.
3. Faça suas alterações e commits.
4. Envie suas alterações para análise: `git push origin minha-feature`.
5. Crie um Pull Request.

## Licença

Este projeto está sob a licença [MIT](LICENSE). Sinta-se à vontade para usá-lo e modificá-lo conforme necessário.

## Contato

Para mais informações ou dúvidas, entre em contato:
- **Autor:** Felipe Moura
- **GitHub:** [felipemourabsbcripto](https://github.com/felipemourabsbcripto)

---

🎉 **Explore, colabore e aproveite!**