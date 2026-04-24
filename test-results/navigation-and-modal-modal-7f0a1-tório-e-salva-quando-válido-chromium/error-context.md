# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: navigation-and-modal.spec.js >> modal de setor valida nome obrigatório e salva quando válido
- Location: e2e\specs\navigation-and-modal.spec.js:40:1

# Error details

```
Test timeout of 45000ms exceeded.
```

```
Error: page.click: Test timeout of 45000ms exceeded.
Call log:
  - waiting for locator('#nav-equipamentos')
    - locator resolved to <button class="nav-btn" id="nav-equipamentos" data-nav="equipamentos" aria-label="Equipamentos">…</button>
  - attempting click action
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <div role="dialog" aria-modal="true" id="dash-overflow-modal" class="overflow-modal-overlay" aria-labelledby="overflow-modal-title">…</div> intercepts pointer events
    - retrying click action
    - waiting 20ms
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <div role="dialog" aria-modal="true" id="dash-overflow-modal" class="overflow-modal-overlay" aria-labelledby="overflow-modal-title">…</div> intercepts pointer events
    - retrying click action
      - waiting 100ms
    74 × waiting for element to be visible, enabled and stable
       - element is visible, enabled and stable
       - scrolling into view if needed
       - done scrolling
       - <div role="dialog" aria-modal="true" id="dash-overflow-modal" class="overflow-modal-overlay" aria-labelledby="overflow-modal-title">…</div> intercepts pointer events
     - retrying click action
       - waiting 500ms

```

# Page snapshot

```yaml
- generic [ref=e1]:
    - banner [ref=e2]:
        - generic [ref=e3]:
            - generic [ref=e4]:
                - img [ref=e6]
                - generic [ref=e20]: CoolTrack
                - generic [ref=e21]:
                    - img [ref=e22]
                    - generic [ref=e24]: FREE
            - generic [ref=e25]:
                - generic [ref=e26]:
                    - img [ref=e27]
                    - generic [ref=e30]: pendente
                - button "Abrir alertas" [ref=e31] [cursor=pointer]:
                    - img [ref=e32]
                - button "Configurações e ajuda" [ref=e36] [cursor=pointer]:
                    - img [ref=e37]
                - button "Meu perfil — abre sua conta" [ref=e40] [cursor=pointer]:
                    - generic [ref=e41]: —
    - generic [ref=e42]:
        - generic [ref=e43]:
            - navigation "Navegação principal" [ref=e44]:
                - button "Painel" [ref=e45] [cursor=pointer]:
                    - img [ref=e47]
                    - text: Painel
                - button "Equipamentos" [ref=e49] [cursor=pointer]:
                    - img [ref=e51]
                    - text: Equip.
                - button "Registrar serviço" [ref=e53] [cursor=pointer]:
                    - img [ref=e55]
                    - generic [ref=e57]: Registrar
                - button "Histórico" [ref=e58] [cursor=pointer]:
                    - img [ref=e60]
                    - text: Histórico
                - button "Alertas" [ref=e63] [cursor=pointer]:
                    - img [ref=e65]
                    - text: Alertas
                    - generic [ref=e68]: '3'
            - main [ref=e69]:
                - generic [ref=e71]:
                    - article "Status geral do parque" [ref=e72]:
                        - generic [ref=e73]:
                            - generic [ref=e74]:
                                - img [ref=e76]
                                - generic [ref=e78]: AÇÃO NECESSÁRIA
                            - heading "Olá, Técnico" [level=1] [ref=e79]
                            - generic [ref=e80]: Qui, 23 de abr · 23:56
                            - paragraph [ref=e81]:
                                - strong [ref=e82]: Equipamento fora de operação
                                - text: em
                                - emphasis [ref=e83]: Câmara Fria Farmácia
                                - text: . Prioridade Alta | criticidade Crítica
                        - button "Registrar agora" [ref=e85] [cursor=pointer]:
                            - img [ref=e87]
                            - generic [ref=e89]: Registrar agora
                    - status [ref=e91]:
                        - img [ref=e92]
                        - generic [ref=e94]: Você cadastrou 7 equipamentos — o plano grátis permite 3.
                        - button "Ver planos →" [ref=e95] [cursor=pointer]
                    - region "Indicadores principais" [ref=e96]:
                        - article [ref=e97]:
                            - generic [ref=e98]: Ativos
                            - generic [ref=e99]: 6/7
                            - generic [ref=e100]: 1 fora
                        - article [ref=e101]:
                            - generic [ref=e102]: Eficiência
                            - generic [ref=e103]: 75%
                            - img [ref=e105]
                            - generic [ref=e114]: saudável
                        - article [ref=e115]:
                            - generic [ref=e116]: Anomalias
                            - generic [ref=e117]: '3'
                            - generic [ref=e118]: 3 alertas ativos
                        - article [ref=e119]:
                            - generic [ref=e120]: Serviços / mês
                            - generic [ref=e121]: '7'
                            - img [ref=e123]
                            - generic [ref=e132]: +5 vs mês passado
                    - generic [ref=e133]:
                        - article [ref=e134]:
                            - generic [ref=e135]: Próxima ação
                            - generic [ref=e136]: Equipamento fora de operação
                            - generic [ref=e137]: Prioridade Alta | criticidade Crítica
                            - button "Registrar agora" [ref=e138] [cursor=pointer]:
                                - generic [ref=e139]: Registrar agora
                                - img [ref=e140]
                        - article [ref=e142]:
                            - img [ref=e144]
                            - generic [ref=e146]:
                                - generic [ref=e147]: Último serviço
                                - generic [ref=e148]: Manutenção Corretiva
                                - generic [ref=e149]: Câmara Fria Farmácia · Ontem
                                - generic [ref=e150]: Compressor não acionava. Capacitor de partida com falha. Substituição realizada. Motor parti...
                    - generic [ref=e151]:
                        - generic [ref=e152]:
                            - generic [ref=e153]: A FAZER AGORA
                            - generic [ref=e154]: '3'
                        - generic [ref=e155]:
                            - generic [ref=e156]:
                                - generic [ref=e157]: Crítico agora
                                - button "Câmara Fria Farmácia · Registrar serviço corretivo imediatamente Fora de operação · Prioridade urgente · Criticidade critica Registrar" [ref=e159] [cursor=pointer]:
                                    - generic [ref=e160]: '!!'
                                    - generic [ref=e161]:
                                        - generic [ref=e162]: Câmara Fria Farmácia · Registrar serviço corretivo imediatamente
                                        - generic [ref=e163]: Fora de operação · Prioridade urgente · Criticidade critica
                                    - generic [ref=e164]: Registrar
                            - generic [ref=e165]:
                                - generic [ref=e166]: Atenção
                                - generic [ref=e167]:
                                    - button "Split Centro Cirúrgico · Registrar serviço corretivo imediatamente Prioridade alta prioridade · Criticidade critica Registrar" [ref=e168] [cursor=pointer]:
                                        - generic [ref=e169]: '!'
                                        - generic [ref=e170]:
                                            - generic [ref=e171]: Split Centro Cirúrgico · Registrar serviço corretivo imediatamente
                                            - generic [ref=e172]: Prioridade alta prioridade · Criticidade critica
                                        - generic [ref=e173]: Registrar
                                    - button "Chiller Linha Produção · Registrar serviço corretivo imediatamente Prioridade alta prioridade · Criticidade critica Registrar" [ref=e174] [cursor=pointer]:
                                        - generic [ref=e175]: '!'
                                        - generic [ref=e176]:
                                            - generic [ref=e177]: Chiller Linha Produção · Registrar serviço corretivo imediatamente
                                            - generic [ref=e178]: Prioridade alta prioridade · Criticidade critica
                                        - generic [ref=e179]: Registrar
                    - generic [ref=e180]:
                        - generic [ref=e182]: Alertas ativos
                        - generic [ref=e184]:
                            - listitem [ref=e185] [cursor=pointer]:
                                - generic [ref=e186]: '!!'
                                - generic [ref=e187]:
                                    - generic [ref=e188]: Câmara Fria Farmácia
                                    - generic [ref=e189]: Equipamento fora de operação
                                    - generic [ref=e190]: Prioridade Alta | criticidade Crítica
                                - generic [ref=e191]: → Agir
                            - listitem [ref=e192] [cursor=pointer]:
                                - generic [ref=e193]: '::'
                                - generic [ref=e194]:
                                    - generic [ref=e195]: Split Centro Cirúrgico
                                    - generic [ref=e196]: Preventiva próxima
                                    - generic [ref=e197]: vence em 8 dias | janela de planejamento 10 dias
                                - generic [ref=e198]: → Agir
                            - listitem [ref=e199] [cursor=pointer]:
                                - generic [ref=e200]: '>'
                                - generic [ref=e201]:
                                    - generic [ref=e202]: Chiller Linha Produção
                                    - generic [ref=e203]: Equipamento exige acompanhamento
                                    - generic [ref=e204]: Ocorrências recentes indicam monitoramento mais curto
                                - generic [ref=e205]: → Agir
                        - note [ref=e207]:
                            - generic [ref=e208]: 🔒 Exportar relatorio em lote disponível a partir do plano Plus
                            - link "Conhecer →" [ref=e209] [cursor=pointer]:
                                - /url: '#'
                    - generic [ref=e210]:
                        - generic [ref=e212]: Equipamentos com ocorrência
                        - generic [ref=e214]:
                            - listitem "Câmara Fria Farmácia — FORA DE OPERAÇÃO" [ref=e215] [cursor=pointer]:
                                - generic [ref=e217]:
                                    - generic [ref=e218]:
                                        - generic [ref=e219]: CF
                                        - generic [ref=e220]: 🏔️
                                    - generic [ref=e221]:
                                        - generic [ref=e222]: Câmara Fria Farmácia
                                        - generic [ref=e223]: R-134A · Prioridade Crítica
                                    - generic [ref=e224]: FORA DE OPERAÇÃO
                                - generic [ref=e229]:
                                    - generic [ref=e230]: Eficiência
                                    - generic [ref=e231]: 37%
                                - generic [ref=e232]:
                                    - generic [ref=e233]: Alto risco
                                    - generic [ref=e234]: Score 85
                                    - generic "Tendência estável" [ref=e235]: → estável
                                - generic [ref=e237]: Urgente
                                - generic [ref=e238]:
                                    - generic [ref=e239]:
                                        - generic [ref=e240]: Última manutenção
                                        - generic [ref=e241]: Ontem
                                        - generic [ref=e242]: Manutenção Corretiva
                                    - generic [ref=e243]:
                                        - generic [ref=e244]: Próxima prev.
                                        - generic [ref=e245]: '! Em 3 dias'
                                - button "Registrar serviço corretivo agora →" [ref=e247]
                            - listitem "Split Centro Cirúrgico — OPERANDO COM RESTRIÇÕES" [ref=e248] [cursor=pointer]:
                                - generic [ref=e250]:
                                    - generic [ref=e251]:
                                        - generic [ref=e252]: SC
                                        - generic [ref=e253]: 📐
                                    - generic [ref=e254]:
                                        - generic [ref=e255]: Split Centro Cirúrgico
                                        - generic [ref=e256]: R-410A · Prioridade Crítica
                                    - generic [ref=e257]: OPERANDO COM RESTRIÇÕES
                                - generic [ref=e262]:
                                    - generic [ref=e263]: Eficiência
                                    - generic [ref=e264]: 56%
                                - generic [ref=e265]:
                                    - generic [ref=e266]: Médio risco
                                    - generic [ref=e267]: Score 50
                                    - generic "Tendência melhorando" [ref=e268]: ↓ 33
                                - generic [ref=e270]: Alta prioridade
                                - generic [ref=e271]:
                                    - generic [ref=e272]:
                                        - generic [ref=e273]: Última manutenção
                                        - generic [ref=e274]: há 6 dias
                                        - generic [ref=e275]: Carga de Gás Refrigera...
                                    - generic [ref=e276]:
                                        - generic [ref=e277]: Próxima prev.
                                        - generic [ref=e278]: Em 8 dias
                                - button "Registrar serviço corretivo agora →" [ref=e280]
                            - listitem "Chiller Linha Produção — OPERANDO COM RESTRIÇÕES" [ref=e281] [cursor=pointer]:
                                - generic [ref=e283]:
                                    - generic [ref=e284]:
                                        - generic [ref=e285]: CL
                                        - generic [ref=e286]: 🧊
                                    - generic [ref=e287]:
                                        - generic [ref=e288]: Chiller Linha Produção
                                        - generic [ref=e289]: R-134A · Prioridade Crítica
                                    - generic [ref=e290]: OPERANDO COM RESTRIÇÕES
                                - generic [ref=e295]:
                                    - generic [ref=e296]: Eficiência
                                    - generic [ref=e297]: 62%
                                - generic [ref=e298]:
                                    - generic [ref=e299]: Médio risco
                                    - generic [ref=e300]: Score 50
                                    - generic "Tendência estável" [ref=e301]: → estável
                                - generic [ref=e303]: Alta prioridade
                                - generic [ref=e304]:
                                    - generic [ref=e305]:
                                        - generic [ref=e306]: Última manutenção
                                        - generic [ref=e307]: há 8 dias
                                        - generic [ref=e308]: Verificação Elétrica
                                    - generic [ref=e309]:
                                        - generic [ref=e310]: Próxima prev.
                                        - generic [ref=e311]: Em 12 dias
                                - button "Registrar serviço corretivo agora →" [ref=e313]
                            - listitem "Split UTI Adulto — OPERANDO NORMALMENTE" [ref=e314] [cursor=pointer]:
                                - generic [ref=e316]:
                                    - generic [ref=e317]:
                                        - generic [ref=e318]: SU
                                        - generic [ref=e319]: ❄️
                                    - generic [ref=e320]:
                                        - generic [ref=e321]: Split UTI Adulto
                                        - generic [ref=e322]: R-410A · Prioridade Crítica
                                    - generic [ref=e323]: OPERANDO NORMALMENTE
                                - generic [ref=e328]:
                                    - generic [ref=e329]: Eficiência
                                    - generic [ref=e330]: 88%
                                - generic [ref=e331]:
                                    - generic [ref=e332]: Baixo risco
                                    - generic [ref=e333]: Score 21
                                    - generic "Tendência melhorando" [ref=e334]: ↓ 43
                                - generic [ref=e336]: Monitorar
                                - generic [ref=e337]:
                                    - generic [ref=e338]:
                                        - generic [ref=e339]: Última manutenção
                                        - generic [ref=e340]: há 3 dias
                                        - generic [ref=e341]: Manutenção Preventiva
                                    - generic [ref=e342]:
                                        - generic [ref=e343]: Próxima prev.
                                        - generic [ref=e344]: Em 27 dias
                                - button "Registrar serviço →" [ref=e346]
                    - generic [ref=e347]:
                        - generic [ref=e349]: Últimos serviços
                        - generic [ref=e351]:
                            - article [ref=e352] [cursor=pointer]:
                                - generic [ref=e353]: 20/04/2026 23:56
                                - generic [ref=e354]: Manutenção Preventiva
                                - generic [ref=e355]: Split UTI Adulto · AC-UTI-01
                                - generic [ref=e356]: 'Limpeza completa de serpentina. Corrente de compressor: 8,2A (nominal ...'
                            - article [ref=e357] [cursor=pointer]:
                                - generic [ref=e358]: 17/04/2026 23:56
                                - generic [ref=e359]: Carga de Gás Refrigerante
                                - generic [ref=e360]: Split Centro Cirúrgico · AC-CC-01
                                - generic [ref=e361]: Vazamento na conexão do evaporador. Reparo realizado. Recarga de 1,5 k...
                            - article [ref=e362] [cursor=pointer]:
                                - generic [ref=e363]: 15/04/2026 23:56
                                - generic [ref=e364]: Verificação Elétrica
                                - generic [ref=e365]: Chiller Linha Produção · CH-PROD-01
                                - generic [ref=e366]: Desligamento por sobrecorrente. 3 fusíveis queimados substituídos. Cor...
                    - region "Análise do parque" [ref=e367]:
                        - generic [ref=e369]: Análise do parque
                        - generic [ref=e370]:
                            - group [ref=e371]:
                                - generic "Status do parque" [ref=e372] [cursor=pointer]:
                                    - generic [ref=e373]: Status do parque
                            - group [ref=e375]:
                                - generic "Serviços por período" [ref=e376] [cursor=pointer]:
                                    - generic [ref=e377]: Serviços por período
                            - group [ref=e379]:
                                - generic "Tipos de serviço" [ref=e380] [cursor=pointer]:
                                    - generic [ref=e381]: Tipos de serviço
                - text: R$ R$
        - text: ＋
    - dialog "Seu parque passou dos 3 equipamentos" [ref=e383]:
        - generic [ref=e384]:
            - generic [ref=e385]:
                - img [ref=e387]
                - heading "Seu parque passou dos 3 equipamentos" [level=3] [ref=e389]
            - paragraph [ref=e390]: O plano grátis permite 3 equipamentos cadastrados. Você continua vendo os atuais, mas para cadastrar novos o Plus destrava até 15 equipamentos.
            - generic [ref=e391]:
                - button "Continuar assim" [ref=e392] [cursor=pointer]
                - button "Ver o plano Plus →" [ref=e393] [cursor=pointer]
    - dialog "Tour de introdução" [ref=e394]:
        - generic [ref=e395]:
            - generic [ref=e397]:
                - generic [ref=e398]: 🧊
                - generic [ref=e399]: Bem-vindo ao CoolTrack
                - generic [ref=e400]:
                    - text: Este é o seu controle de manutenções de climatização, pensado pra quem vive no campo. Funciona
                    - strong [ref=e401]: online e offline
                    - text: ', então dá pra registrar serviços no meio de uma casa de máquinas sem sinal — tudo sincroniza quando você voltar pra uma área com internet. Em menos de 1 minuto, você vai conhecer os 5 recursos principais do app.'
            - generic [ref=e409]:
                - button "Pular tour" [active] [ref=e410] [cursor=pointer]
                - generic [ref=e411]:
                    - button "Anterior" [disabled] [ref=e412] [cursor=pointer]
                    - button "Próximo" [ref=e413] [cursor=pointer]
```

# Test source

```ts
  1   | import { expect, test } from '@playwright/test';
  2   |
  3   | const OVERLAY_OPEN_SELECTOR = '.modal-overlay.is-open';
  4   |
  5   | test.beforeEach(async ({ page }) => {
  6   |   await page.addInitScript(() => {
  7   |     localStorage.clear();
  8   |     localStorage.setItem('cooltrack-guest-mode', '1');
  9   |   });
  10  |
  11  |   await page.goto('/');
  12  |   await expect(page.locator('#main-content')).toBeVisible();
  13  | });
  14  |
  15  | test('equipamentos → detalhe → editor de foto fecha em cadeia com back', async ({ page }) => {
  16  |   await page.click('#nav-equipamentos');
  17  |
  18  |   const firstEquipCard = page.locator('[data-action="open-equip"]').first();
  19  |   await expect(firstEquipCard).toBeVisible();
  20  |   await firstEquipCard.click();
  21  |
  22  |   const detailModal = page.locator('#modal-eq-det');
  23  |   await expect(detailModal).toHaveClass(/is-open/);
  24  |
  25  |   const photoCta = detailModal.locator('[data-action="open-eq-photos-editor"]').first();
  26  |   await photoCta.click();
  27  |
  28  |   const photoModal = page.locator('#modal-eq-photos');
  29  |   await expect(photoModal).toHaveClass(/is-open/);
  30  |
  31  |   await page.goBack();
  32  |   await expect(photoModal).not.toHaveClass(/is-open/);
  33  |   await expect(detailModal).toHaveClass(/is-open/);
  34  |
  35  |   await page.goBack();
  36  |   await expect(detailModal).not.toHaveClass(/is-open/);
  37  |   await expect(page.locator(OVERLAY_OPEN_SELECTOR)).toHaveCount(0);
  38  | });
  39  |
  40  | test('modal de setor valida nome obrigatório e salva quando válido', async ({ page }) => {
> 41  |   await page.click('#nav-equipamentos');
      |              ^ Error: page.click: Test timeout of 45000ms exceeded.
  42  |
  43  |   await page.evaluate(() => {
  44  |     localStorage.setItem('cooltrack-dev-mode', 'true');
  45  |   });
  46  |
  47  |   await page.evaluate(() => {
  48  |     document.dispatchEvent(
  49  |       new CustomEvent('app:route-changed', { detail: { route: 'equipamentos' } }),
  50  |     );
  51  |   });
  52  |
  53  |   await page.evaluate(async () => {
  54  |     const [{ setCachedPlan }, { renderEquip }] = await Promise.all([
  55  |       import('/src/core/plans/planCache.js'),
  56  |       import('/src/ui/views/equipamentos.js'),
  57  |     ]);
  58  |     setCachedPlan('pro');
  59  |     await renderEquip('');
  60  |   });
  61  |
  62  |   const openSetorButton = page.locator('[data-action="open-setor-modal"]').first();
  63  |   await expect(openSetorButton).toBeVisible();
  64  |   await openSetorButton.click();
  65  |
  66  |   const setorModal = page.locator('#modal-add-setor');
  67  |   await expect(setorModal).toHaveClass(/is-open/);
  68  |
  69  |   await page.click('#setor-save-btn');
  70  |   await expect(page.locator('#setor-nome-err')).toBeVisible();
  71  |
  72  |   await page.fill('#setor-nome', 'UTI');
  73  |   await page.click('#setor-save-btn');
  74  |   await expect(setorModal).not.toHaveClass(/is-open/);
  75  |
  76  |   await expect(page.locator('.setor-card__nome', { hasText: 'UTI' })).toBeVisible();
  77  | });
  78  |
  79  | test('overlay de assinatura fecha com back', async ({ page }) => {
  80  |   await page.evaluate(async () => {
  81  |     const { SignatureModal } = await import('/src/ui/components/signature/signature-modal.js');
  82  |     SignatureModal.request('reg-1', 'Split Teste');
  83  |   });
  84  |
  85  |   const signatureOverlay = page.locator('#modal-signature-overlay');
  86  |   await expect(signatureOverlay).toHaveClass(/is-open/);
  87  |
  88  |   await page.goBack();
  89  |   await expect(signatureOverlay).toHaveCount(0);
  90  | });
  91  |
  92  | test('contexto de quickfilter é preservado ao abrir/voltar detalhe', async ({ page }) => {
  93  |   await page.click('#nav-equipamentos');
  94  |
  95  |   const semSetorFilter = page
  96  |     .locator('[data-action="equip-quickfilter"][data-id="sem-setor"]')
  97  |     .first();
  98  |   await expect(semSetorFilter).toBeVisible();
  99  |   await semSetorFilter.click();
  100 |
  101 |   await expect(semSetorFilter).toHaveClass(/equip-filter--active/);
  102 |
  103 |   const firstEquipCard = page.locator('[data-action="open-equip"]').first();
  104 |   await firstEquipCard.click();
  105 |   await expect(page.locator('#modal-eq-det')).toHaveClass(/is-open/);
  106 |
  107 |   await page.goBack();
  108 |   await expect(page.locator('#modal-eq-det')).not.toHaveClass(/is-open/);
  109 |
  110 |   await expect(
  111 |     page.locator('[data-action="equip-quickfilter"][data-id="sem-setor"].equip-filter--active'),
  112 |   ).toHaveCount(1);
  113 | });
  114 |
```
