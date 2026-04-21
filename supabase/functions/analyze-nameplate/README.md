# analyze-nameplate

Edge function que recebe uma foto de placa de equipamento, chama Claude
vision e devolve os campos extraídos (tipo, refrigerante, marca/modelo,
capacidade BTU, tensão, etc).

Entrou em produção no release 3.4.0 como hero CTA no modal-add-eq
(`Aponta a câmera pra placa`). Só Plus+ e Pro podem usar.

---

## Como funciona

1. Cliente (browser) pega o JWT do Supabase, faz `POST /functions/v1/analyze-nameplate` com o arquivo em base64.
2. A função valida o JWT via admin API (service role) — o gateway roda `--no-verify-jwt` porque valida só HS256 e o Supabase novo assina ES256. Valida no código mesmo é mais simples que perseguir JWKS.
3. Checa o plano do usuário. Free → 403 `PLAN_GATE_FREE`.
4. Monta o prompt multi-part com a imagem + schema JSON estrito, chama Claude Sonnet 4.6 via tool_use.
5. Devolve `{ ok: true, fields: {...} }` pro client mapear pros campos do form.

Fluxo de UI: ver `src/ui/components/nameplateCapture.js` (hero CTA) + `src/domain/nameplateAnalysis.js` (chamada + mapping).

---

## Setup (primeira vez)

### 1. Secret da Anthropic

```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-api03-...
```

Pega a chave em [console.anthropic.com](https://console.anthropic.com) → Settings → API Keys. Coloca crédito no Billing (~US$5 rende ~700 análises).

### 2. Deploy

```bash
supabase functions deploy analyze-nameplate --no-verify-jwt
```

A flag `--no-verify-jwt` é **necessária** — o gateway do Supabase ainda espera HS256, mas as sessões novas são assinadas em ES256. A auth real acontece dentro da função, via admin API. Sem a flag, toda chamada dá 401 no gateway, antes da função rodar.

### 3. Confirmar

```bash
supabase secrets list                    # ANTHROPIC_API_KEY tem que aparecer
supabase functions logs analyze-nameplate --tail
```

---

## Testar em produção

O jeito oficial é pelo próprio app:

1. Login como user Plus+ ou Pro.
2. Novo equipamento → Hero CTA "Usar foto da placa".
3. Seleciona foto (JPG/PNG/WEBP, até 8 MB).
4. Espera ~5s. Os campos do step 2 preenchem sozinhos.

### Teste rápido via curl (debug)

```bash
# 1. Pegar um JWT de user Plus+
JWT=$(supabase db exec "select encode(digest('...', 'sha256'), 'hex')")   # ou pega do devtools do browser após login

# 2. Converter foto pra base64
IMG=$(base64 -w0 ~/placa-teste.jpg)

# 3. Chamar a função
curl -X POST https://SEU_PROJECT_REF.supabase.co/functions/v1/analyze-nameplate \
  -H "Authorization: Bearer $JWT" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"image_base64\":\"$IMG\",\"media_type\":\"image/jpeg\"}" | jq
```

---

## Troubleshooting

| Sintoma                           | Provavelmente é                                                                 |
| --------------------------------- | ------------------------------------------------------------------------------- |
| 401 `AUTH_REQUIRED`               | JWT ausente ou inválido. Client não está mandando o Authorization header.       |
| 403 `PLAN_GATE_FREE`              | Usuário no plano Free. Esperado — o gate do client deveria ter bloqueado antes. |
| 500 `MISSING_API_KEY`             | `supabase secrets set ANTHROPIC_API_KEY=...` não foi feito.                     |
| 503 `UPSTREAM_BUSY`               | Anthropic sobrecarregado. Retry em 30s.                                         |
| `NOT_IDENTIFIED` / low confidence | Foto ruim. Mais luz + placa preenchendo o quadro + foto reta.                   |

Pra ver logs em tempo real enquanto testa:

```bash
supabase functions logs analyze-nameplate --tail
```

---

## Custo

Claude Sonnet 4.6 com vision: **~$0.007–0.01 por análise** (varia com tamanho da imagem e tamanho da resposta). Validação inicial com foto LG 2024 rodou em ~$0.01.
