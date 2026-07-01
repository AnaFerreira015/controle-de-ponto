# Configuração do Firebase (Free/Spark)

Este app usa Firebase em um projeto criado na sua própria conta Google/Firebase.

## 1. Criar projeto Firebase

1. Acesse o Firebase Console e clique em **Adicionar projeto**.
2. Escolha um nome, por exemplo `controle-ponto`.
3. O Google Analytics é opcional para este app.
4. O plano padrão é **Spark**, gratuito.

## 2. Ativar Authentication

1. No menu lateral, vá em **Build → Authentication → Get started**.
2. Abra a aba **Sign-in method**.
3. Habilite **Email/Password**.

## 3. Ativar Cloud Firestore

1. No menu lateral, vá em **Build → Firestore Database → Create database**.
2. Escolha o modo **Production**.
3. Escolha uma região, por exemplo **southamerica-east1 (São Paulo)** para uso principal no Brasil.

## 4. Publicar regras de segurança

1. Abra a aba **Rules** do Firestore.
2. Cole o conteúdo de `firestore.rules`, localizado na raiz deste projeto.
3. Clique em **Publish**.

## 5. Obter as credenciais Web

1. Clique na engrenagem do projeto.
2. Acesse **Project settings → General**.
3. Em **Your apps**, clique no ícone `</>` para registrar um app Web.
4. Copie os valores do objeto `firebaseConfig`.

## 6. Configurar variáveis de ambiente

Crie um arquivo `.env` na raiz do projeto com:

```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

Essas chaves são usadas pelo frontend. A proteção dos dados deve ser feita pelas regras do Firestore.

## 7. Autorizar domínios

Em **Authentication → Settings → Authorized domains**, adicione os domínios onde o app será executado, por exemplo:

- `localhost`, para desenvolvimento local
- domínio do seu deploy, como Vercel, Netlify, Firebase Hosting ou domínio próprio

## 8. Rodar localmente

```bash
npm install
npm run dev
```

Depois acesse a URL exibida no terminal.
