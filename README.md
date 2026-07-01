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
