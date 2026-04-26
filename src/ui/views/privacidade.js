/**
 * /privacidade — Página estática com a política de privacidade.
 *
 * Conteúdo placeholder: cobre os pontos essenciais (LGPD art. 6, 9 e 18) num
 * tom direto pra técnico autônomo. O Willian pode iterar o copy depois — a
 * estrutura é só HTML estático com h2/h3/p/ul.
 *
 * Acessada via "Saiba mais" do footer LGPD da página /conta.
 */

import { goTo } from '../../core/router.js';

const VIEW_ID = 'view-privacidade';

const ICON_BACK = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 6 9 12 15 18"/></svg>`;
const ICON_SHIELD = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2l8 4v6c0 5-3.5 9-8 10-4.5-1-8-5-8-10V6l8-4z"/><path d="M9 12l2 2 4-4"/></svg>`;
const ICON_LOCK = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>`;
const ICON_DOC = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`;
const ICON_USER_X = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="8" r="4"/><path d="M3 21c0-3.3 2.7-6 6-6h0c1.7 0 3.3.7 4.4 1.8"/><line x1="17" y1="14" x2="22" y2="19"/><line x1="22" y1="14" x2="17" y2="19"/></svg>`;

let _bound = false;

function _bindOnce() {
  if (_bound) return;
  _bound = true;
  const view = document.getElementById(VIEW_ID);
  if (!view) return;
  view.addEventListener('click', (event) => {
    const target = event.target.closest?.('[data-action="privacidade-back"]');
    if (target) {
      event.preventDefault();
      goTo('conta');
    }
  });
}

export function renderPrivacidade() {
  const view = document.getElementById(VIEW_ID);
  if (!view) return;

  view.innerHTML = `
    <article class="privacy-page">
      <button type="button" class="privacy-page__back" data-action="privacidade-back"
        aria-label="Voltar para a conta">
        <span aria-hidden="true">${ICON_BACK}</span>
        <span>Voltar para a conta</span>
      </button>

      <header class="privacy-page__hero">
        <span class="privacy-page__hero-icon" aria-hidden="true">${ICON_SHIELD}</span>
        <div>
          <h1 class="privacy-page__title">Política de Privacidade</h1>
          <p class="privacy-page__sub">
            Como o CoolTrack Pro coleta, usa e protege seus dados — de acordo com a LGPD (Lei nº 13.709/2018).
          </p>
        </div>
      </header>

      <div class="privacy-page__updated">
        Última atualização: 25 de abril de 2026
      </div>

      <section class="privacy-section" aria-labelledby="priv-controlador">
        <div class="privacy-section__head">
          <span class="privacy-section__icon" aria-hidden="true">${ICON_DOC}</span>
          <h2 class="privacy-section__title" id="priv-controlador">1. Quem é o controlador</h2>
        </div>
        <p>
          O <strong>CoolTrack Pro</strong> é um aplicativo voltado a técnicos em refrigeração e
          climatização para registro de manutenções, geração de relatórios e cumprimento da NBR 13971
          (PMOC). Todos os dados pessoais que você insere são tratados sob a sua responsabilidade
          como controlador dos dados dos seus clientes; o CoolTrack atua como
          <em>operador</em> — armazena e processa os dados pra te entregar a funcionalidade.
        </p>
      </section>

      <section class="privacy-section" aria-labelledby="priv-dados">
        <div class="privacy-section__head">
          <span class="privacy-section__icon" aria-hidden="true">${ICON_LOCK}</span>
          <h2 class="privacy-section__title" id="priv-dados">2. Que dados coletamos</h2>
        </div>
        <p>Coletamos apenas o que é necessário pra fazer o app funcionar:</p>
        <ul class="privacy-list">
          <li><strong>Identificação do técnico:</strong> nome, e-mail, telefone (opcional), CNPJ/CPF, foto de perfil opcional.</li>
          <li><strong>Empresa:</strong> razão social, logo, endereço, dados de contato — se você optar por preencher.</li>
          <li><strong>Equipamentos cadastrados:</strong> nome, modelo, número de série, local, fotos.</li>
          <li><strong>Registros de serviço:</strong> data, tipo de serviço, técnico responsável, observações, peças, custos, fotos e assinatura digital do cliente.</li>
          <li><strong>Clientes:</strong> nome, CNPJ/CPF, contato, endereço — somente o que você cadastra manualmente.</li>
          <li><strong>Dados de pagamento:</strong> processados diretamente pelo Stripe — o CoolTrack não armazena número de cartão.</li>
          <li><strong>Telemetria mínima:</strong> versão do app, tipo de dispositivo, erros técnicos — sem rastreamento de comportamento.</li>
        </ul>
      </section>

      <section class="privacy-section" aria-labelledby="priv-uso">
        <div class="privacy-section__head">
          <span class="privacy-section__icon" aria-hidden="true">${ICON_DOC}</span>
          <h2 class="privacy-section__title" id="priv-uso">3. Como usamos seus dados</h2>
        </div>
        <ul class="privacy-list">
          <li>Operar a funcionalidade que você contratou (registros, PDFs, PMOC, etc).</li>
          <li>Enviar relatórios via WhatsApp ou e-mail quando você solicita.</li>
          <li>Cobrar pela assinatura via Stripe (apenas planos pagos).</li>
          <li>Suporte técnico, quando você abre um chamado ou usa o canal de ajuda.</li>
          <li>Cumprimento de obrigações legais (notas fiscais, retenção mínima por legislação).</li>
        </ul>
        <p>
          <strong>Não fazemos:</strong> venda de dados a terceiros, perfilamento publicitário,
          ou compartilhamento com parceiros comerciais sem o seu consentimento explícito.
        </p>
      </section>

      <section class="privacy-section" aria-labelledby="priv-seguranca">
        <div class="privacy-section__head">
          <span class="privacy-section__icon" aria-hidden="true">${ICON_LOCK}</span>
          <h2 class="privacy-section__title" id="priv-seguranca">4. Como protegemos</h2>
        </div>
        <ul class="privacy-list">
          <li>Conexão criptografada (TLS 1.3) entre o app e os servidores.</li>
          <li>Banco de dados em provedor com isolamento por usuário (Row Level Security do Supabase).</li>
          <li>Backups automáticos diários, retenção de 30 dias.</li>
          <li>Acesso interno restrito a operações de suporte, sob registro de auditoria.</li>
        </ul>
      </section>

      <section class="privacy-section" aria-labelledby="priv-direitos">
        <div class="privacy-section__head">
          <span class="privacy-section__icon" aria-hidden="true">${ICON_USER_X}</span>
          <h2 class="privacy-section__title" id="priv-direitos">5. Seus direitos (LGPD art. 18)</h2>
        </div>
        <p>Você pode, a qualquer momento, dentro do app:</p>
        <ul class="privacy-list">
          <li><strong>Confirmar e acessar</strong> seus dados — em <em>Conta → Editar perfil</em>.</li>
          <li><strong>Corrigir</strong> dados desatualizados ou imprecisos no mesmo lugar.</li>
          <li><strong>Portabilidade:</strong> baixe um JSON com tudo em <em>Conta → Exportar meus dados</em>.</li>
          <li><strong>Eliminação:</strong> apague tudo permanentemente em <em>Conta → Excluir minha conta</em>.</li>
          <li><strong>Revogar consentimento</strong> de comunicação cancelando a assinatura.</li>
        </ul>
        <p>
          Para qualquer outro pedido, fale com a gente em
          <a href="mailto:contato@cooltrack.app">contato@cooltrack.app</a>. Respondemos em até 15 dias.
        </p>
      </section>

      <section class="privacy-section" aria-labelledby="priv-mudancas">
        <div class="privacy-section__head">
          <span class="privacy-section__icon" aria-hidden="true">${ICON_DOC}</span>
          <h2 class="privacy-section__title" id="priv-mudancas">6. Mudanças nesta política</h2>
        </div>
        <p>
          Se mudarmos algo material, avisamos no app antes de a mudança entrar em vigor. A versão
          vigente é sempre esta página, com a data no topo.
        </p>
      </section>

      <footer class="privacy-page__foot">
        <p>
          Em caso de incidente que envolva seus dados, comunicamos a ANPD e você
          dentro dos prazos legais.
        </p>
      </footer>
    </article>`;

  _bindOnce();
}
