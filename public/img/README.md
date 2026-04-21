# public/img/

Imagens servidas no root pela Vite/Cloudflare Pages (ex.: `/img/etiqueta-hvac.png`).

## Assets

| Arquivo                        | Uso                                                                     | Status      |
| ------------------------------ | ----------------------------------------------------------------------- | ----------- |
| `etiqueta-hvac.jpg`            | Placa real LG Inverter (USNW092WSG3) usada no hero e na seção IA.       | ✅ ativo    |
| `tecnico-celular-etiqueta.jpg` | Foto de técnico apontando câmera pra etiqueta — candidata pra OG image. | ⏳ opcional |

## Como ativar a plaquinha PNG

Dois lugares usam uma etiqueta de ar-condicionado: o **hero** (celular com câmera na placa)
e a **seção IA "Cadastro por foto"** (foto → fields). Ambos têm fallback CSS-drawn pronto

- hook de swap pra `<img>` real.

### 1. Subir a imagem

Coloque `etiqueta-hvac.png` neste diretório. Specs sugeridas:

- Formato JPG ~80% ou PNG, < 150 KB
- Proporção ~4:2 ou 3:2 (larga, legível)
- Resolução mínima ~720x360 (pra retina 360x180 visível)

### 2. Ativar no hero (`src/ui/components/landingPage/template.js`)

Dentro da `.lp-phone__view`:

- Descomentar a linha `<img class="lp-nameplate-img" src="/img/etiqueta-hvac.png" alt="">`
- Remover (ou manter com `aria-hidden="true"`) o `<div class="lp-nameplate">` CSS-drawn

### 3. Ativar na seção IA (`template.js`, proximo a `.lp-ai-demo__photo-frame`)

Trocar o `<div class="lp-ai-demo__photo-frame">` + filhos CSS-drawn pelo bloco
comentado acima dele no template (frame com modifier `--img` + `<img class="lp-ai-demo__photo-img">`).

> As versoes CSS-drawn **ficam como fallback** ate o PNG ser publicado, pra garantir
> que a pagina nunca renderize vazio mesmo se o asset falhar.
