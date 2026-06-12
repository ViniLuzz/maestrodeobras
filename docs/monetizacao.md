# Monetização — planejamento (precisa de decisões antes de codar)

> Este é o único item da lista que **não dá pra simplesmente codar**: depende de
> decisões de produto e de credenciais externas. Abaixo, o caminho e o que eu
> preciso de você pra implementar numa sessão dedicada.

## ⚠️ O ponto mais importante (evita reprovação na loja)

Apple e Google **exigem o sistema de compra deles** (In-App Purchase) para vender
conteúdo/funcionalidade digital dentro do app. **Stripe no app de celular para
assinatura digital costuma ser reprovado** na revisão.

- O que já existe no banco (`stripe_customer_id`, `licencas`, etc.) serve bem para
  o **portal web das lojas** (cobrança via Stripe é permitida na web).
- Para o **app mobile**, o caminho correto é **In-App Purchase** — e o jeito mais
  simples de fazer isso no Expo é via **RevenueCat** (`react-native-purchases`),
  que abstrai App Store + Play Store e cuida de recibos/renovação.

Ou seja: o esquema Stripe do banco **não** é o que vai cobrar no app. São trilhos
diferentes.

## Decisões que eu preciso de você

1. **Modelo de cobrança:**
   - (a) Assinatura mensal/anual (ex.: R$ X/mês) — mais comum p/ SaaS.
   - (b) Licença única (pagamento único libera o app).
   - (c) Freemium: grátis até N obras, paga pra liberar mais / relatórios em PDF / RDO.
   - _Recomendo (c) freemium ou (a) assinatura — combinam com o valor recorrente do app._

2. **O que é grátis x pago** (a "linha de corte"). Ex.: criar 1 obra grátis;
   PDF/relatório executivo e equipe ilimitada no plano pago.

3. **Preço(s)** e se terá teste grátis (ex.: 7 dias).

## O que eu preciso de credencial/conta

- Conta **RevenueCat** (gratуita até certo faturamento) + chaves de API.
- Produtos criados no **App Store Connect** e no **Google Play Console**
  (IDs dos produtos/assinaturas).
- (Web/lojas, se for cobrar lá) chaves do **Stripe** + um endpoint de webhook
  (Supabase Edge Function) — separado do app.

## Plano de implementação (quando tivermos as decisões)

1. `expo install react-native-purchases` + plugin.
2. `src/lib/assinatura.ts`: init RevenueCat, expor `isPro`, `comprar()`, `restaurar()`.
3. Tela de **paywall** (planos + botão assinar + restaurar compras + termos).
4. **Gates** nos pontos pagos (ex.: ao criar a 2ª obra / exportar PDF) → abre paywall.
5. Sincronizar status `pro` na tabela `pessoas` (via webhook RevenueCat → Edge Function)
   para o backend também saber quem é pago (opcional, mas recomendado).
6. Testes com sandbox (TestFlight / faixa interna do Google Play).

## Recomendação de lançamento

Dá pra **lançar o MVP grátis** primeiro (validar com usuários reais) e ligar a
monetização numa atualização logo em seguida. Assim você não trava o lançamento
nas decisões de preço — e ainda colhe feedback antes de cobrar.

**Me diga o modelo (1), a linha de corte (2) e o preço (3)** que eu implemento o
RevenueCat + paywall + gates numa sessão dedicada.
