# Maestro de Obras

App mobile (Expo + React Native + TypeScript) para gestão de obras civis e marketplace de prestadores.

## Status atual — Fase 1: fundação

- Autenticação (email/senha) via Supabase Auth
- Schema base do banco: `pessoas`, `user_roles`, `licencas`, `obras`, `obra_membros`
- RLS configurado para todas as tabelas da Fase 1
- Funções SECURITY DEFINER para operações sensíveis (criação de pessoa, ativação de licença, convite de membros)
- Estrutura de navegação com stack de auth e stack do app
- Telas: Login, Signup, Ativar licença, Acesso por token (stub), Lista de obras, Detalhe (stub), Configurações, Marketplace (stub)

## Setup inicial

### 1. Variáveis de ambiente

Copie o arquivo de exemplo e preencha com as credenciais do seu projeto Supabase novo:

```bash
cp .env.example .env
```

```
EXPO_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=anon-key-do-supabase
```

### 2. Aplicar migrations no Supabase

Existem três migrations em `supabase/migrations/` que **devem ser aplicadas em ordem** num projeto Supabase **vazio**:

1. `20260101000001_initial_schema.sql` — tabelas, enums, índices, triggers
2. `20260101000002_security_functions.sql` — funções `SECURITY DEFINER`
3. `20260101000003_rls_policies.sql` — policies RLS

**Forma mais simples (sem CLI):**

1. Abra o SQL Editor do projeto Supabase no dashboard.
2. Cole o conteúdo de cada arquivo em ordem e clique em **Run**.

**Com Supabase CLI (recomendado a longo prazo):**

```bash
npm install -g supabase
supabase login
supabase link --project-ref SEU_PROJECT_REF
supabase db push
```

### 3. Configurar Auth no Supabase

No dashboard, em **Authentication → Providers → Email**:

- Habilitar provider Email/Password.
- Para desenvolvimento, desabilitar "Confirm email" (Authentication → Providers → Email → "Confirm email" off) — assim o signup já entra logado direto. Reative em produção.

### 4. Rodar o app

```bash
npm install
npm start
```

Use o app **Expo Go** no celular Android/iOS pra escanear o QR code, ou rode em emulador:

```bash
npm run android
# ou
npm run ios   # macOS apenas
```

## Próximas fases (planejadas)

- **Fase 2** — Etapas (Timeline com pré-requisitos, fotos, conclusão)
- **Fase 3** — Materiais + Contratações (com vínculo opcional ao marketplace)
- **Fase 4** — Marketplace (perfis, busca, avaliações por admins que contrataram)
- **Fase 5** — Notificações push (OneSignal + cron de prazos)
- **Fase 6** — Gravação por voz com IA (OpenAI Whisper + classificação automática)
- **Fase 7** — Stripe (paywall freemium, assinaturas, portal cliente)

## Build de produção (APK / IPA)

Quando chegar a hora:

```bash
npm install -g eas-cli
eas login
eas build:configure
eas build -p android --profile production    # gera .aab/.apk
eas build -p ios --profile production        # gera .ipa (requer conta Apple Developer)
```

## Estrutura

```
maestro-de-obras-mobile/
├── App.tsx                       # Providers raiz
├── app.json                      # Config Expo (bundle ids, scheme)
├── babel.config.js               # Path alias @/ → src/
├── src/
│   ├── components/               # Componentes compartilhados (TextField, PrimaryButton)
│   ├── contexts/                 # AuthContext
│   ├── lib/                      # supabase client, theme
│   ├── navigation/               # RootNavigator, AuthStack, AppStack
│   ├── screens/
│   │   ├── auth/                 # Login, Signup, AtivarLicenca, AcessoToken
│   │   └── app/                  # ListaObras, ObraDetalhe, Marketplace, Configuracoes
│   └── types/                    # database.ts (tipos do schema)
└── supabase/
    ├── migrations/               # SQL versionado
    └── functions/                # Edge functions (próximas fases)
```
