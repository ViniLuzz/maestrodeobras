# Roteiro de QA — antes de publicar

Rodar num **aparelho Android físico** (de preferência também num iPhone), com o
APK/IPA de `preview` ou `production`, **não** no Expo Go (notificações e splash
diferem). Marque cada item. Anote o que falhar.

## 0. Primeiro uso
- [ ] Splash em vídeo toca e **sai sem tela preta** no fim.
- [ ] Onboarding (3 telas) aparece **só na 1ª vez**; "Pular" e "Começar" funcionam.
- [ ] Fechar e reabrir o app → onboarding **não** aparece de novo.

## 1. Autenticação
- [ ] Cadastro com e-mail/senha cria conta e entra.
- [ ] Login com conta existente.
- [ ] "Esqueci minha senha" envia o e-mail de reset.
- [ ] Modo visitante (sem login) abre e deixa **navegar**; ações que exigem conta
      mostram o convite pra criar conta (AuthWall).
- [ ] Excluir conta (Configurações) pede confirmação e desloga.

## 2. Obra + cronograma
- [ ] Criar obra nova (aparece na lista; contadores na home corretos).
- [ ] Abrir obra → os 4 botões (Tarefas/Monitoramento/Financeiro/Gerenciar)
      centralizados no card.
- [ ] Criar etapa, material e contratação (cada um aparece no cronograma).
- [ ] No card do cronograma aparece o **responsável** (ou "Sem responsável").
- [ ] **Tocar no card** abre o formulário do item.
- [ ] Marcar item como concluído → ao voltar, **some** dos pendentes e os
      contadores atualizam.

## 3. Atraso + motivo (etapa, material, contratação)
- [ ] Criar item com prazo **no passado** → editar → aparece "⚠️ atrasado — motivo?".
- [ ] Tentar salvar sem escolher motivo → **bloqueia** com aviso.
- [ ] Escolher "Outro" sem texto → **bloqueia**.
- [ ] Salvar com motivo (ex.: Clima) → ok.
- [ ] Repetir pros 3 tipos (etapa, material, contratação).

## 4. Relatório executivo
- [ ] Abrir via **Monitoramento** (não mais em Gerenciar).
- [ ] Itens atrasados aparecem em "Detalhe dos Atrasos" com tipo + causa + motivo.
- [ ] Concluir um item atrasado → ele **continua** no relatório (resolvido c/ atraso).
- [ ] Gerar PDF abre/compartilha corretamente.
- [ ] "Compartilhar resumo" (texto) abre o share do sistema.

## 5. Diário de Obra (RDO)
- [ ] Criar RDO (efetivo, clima, atividades, itens, fotos).
- [ ] Fotos de itens marcados entram automaticamente.
- [ ] "👁 Ver" abre o RDO em leitura.
- [ ] **Tocar numa foto abre em tela cheia**; toque fecha.
- [ ] Gerar PDF do RDO.

## 6. Financeiro
- [ ] Definir orçamento (só admin).
- [ ] Registrar despesa → total/restante/% atualizam.
- [ ] Breakdown por categoria correto.
- [ ] Aceitar um aluguel no portal de lojas → vira **despesa** na obra (categoria aluguel).

## 7. Notificações de prazo
- [ ] No 1º login com conta real, o app **pede permissão** de notificação.
- [ ] Criar item com prazo pra **amanhã** → fechar o app → receber lembrete às 9h
      (ou ajustar o relógio do aparelho pra testar mais rápido).
- [ ] Concluir o item → o lembrete não dispara mais (reabrir o app reagenda).

## 8. Equipe / membros
- [ ] Admin convida membro (token/link) → membro entra na obra.
- [ ] Membro vê só as obras dele (testar com 2ª conta).
- [ ] Progresso da equipe mostra os números por pessoa.

## 9. Marketplace / equipamentos / portal de lojas (web)
- [ ] Listagem de equipamentos/lojas carrega.
- [ ] Pedido de aluguel pelo app chega no portal da loja.
- [ ] Loja aceita/recusa; estados (Pedidos/Ativos/Histórico) corretos.

## 10. Robustez
- [ ] **Offline**: abrir o app sem internet → mensagem clara, sem travar; ao
      voltar a conexão, dados carregam.
- [ ] Girar pra paisagem / fontes grandes do sistema não quebram telas.
- [ ] Sair e voltar do app (background) várias vezes não derruba a sessão.
- [ ] (Se Sentry configurado) forçar um erro de teste e confirmar que chega no Sentry.

## 11. Conformidade de loja
- [ ] Links de Política de Privacidade e Termos abrem.
- [ ] Permissões (fotos, câmera, localização, notificação) pedem com texto claro.
- [ ] Ícone, nome e splash corretos na tela inicial do aparelho.
