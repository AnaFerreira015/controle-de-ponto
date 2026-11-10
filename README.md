# Controle de Ponto

App web responsivo/PWA para controle de horas de trabalho com Firebase Authentication e Cloud Firestore.

## Requisitos

- Node.js 22 ou superior
- npm
- Projeto Firebase no plano Spark/Free

## Configuração

1. Configure o Firebase seguindo `FIREBASE_SETUP.md`.
2. Crie um arquivo `.env` na raiz do projeto com base em `.env.example`.
3. Instale as dependências:

```bash
npm install
```

4. Rode em desenvolvimento:

```bash
npm run dev
```

## Criar um novo repositório Git

Depois de extrair este projeto:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin URL_DO_SEU_NOVO_REPOSITORIO
git push -u origin main
```

## Observações

- O arquivo `.env` não deve ser commitado.
- Use `.env.example` como modelo para novas instalações.
- As regras do Firestore estão em `firestore.rules`.

## Histórico

- A tela `/historico` exibe o mês atual por padrão.
- As setas de navegação só ficam habilitadas quando existe algum registro em um mês anterior ou posterior.
- O seletor de mês permite abrir o calendário/seletor nativo do navegador e escolher o mês atual ou meses com registros.

## Notificações

O app tem dois níveis de notificação:

1. **Lembrete local:** funciona enquanto o app está aberto ou enquanto o navegador permitir execução em segundo plano.
2. **Push/offline real:** usa Firebase Cloud Messaging e um service worker para receber mensagens mesmo com o app fechado, quando o navegador/sistema operacional permitir.

Para ativar push/offline real, configure `VITE_FIREBASE_VAPID_KEY` no `.env` e publique as regras atualizadas do Firestore. O app salva o token do dispositivo em `users/{uid}/notificationTokens`.

Importante: para enviar lembretes automáticos com o app fechado, ainda é necessário um backend/agendador externo que envie mensagens FCM para os tokens salvos. O frontend já faz a inscrição do dispositivo e recebe mensagens em foreground/background.

## Dias sem expediente

Sábados, domingos e feriados do calendário nacional brasileiro não geram carga
horária prevista, lembretes, pendências de jornada ou pontos na folha aleatória.
O calendário inclui Sexta-feira Santa (calculada a cada ano) e 20 de novembro
como feriado nacional a partir de 2024. Carnaval, Corpus Christi e outros pontos
facultativos continuam como dias úteis; feriados estaduais e municipais não
estão incluídos.

Registros reais são preservados, inclusive na exportação. É possível registrar
manualmente trabalho em dias dispensados; essas horas são contabilizadas sem
carga horária obrigatória. A folha aleatória não completa registros nesses dias.
As datas seguem o calendário local do navegador, como os demais registros.

Referência do calendário: https://agenciagov.ebc.com.br/noticias/202512/confira-o-calendario-oficial-de-feriados-nacionais-e-pontos-facultativos-em-2026

Para executar os testes de calendário: `npm test`.
