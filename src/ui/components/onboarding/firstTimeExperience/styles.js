/**
 * CoolTrack Pro - FirstTimeExperience / styles
 * CSS do overlay de onboarding (namespace .ftx-* + #ftx-*). Exportado como
 * template string para ser injetado dentro de <style> pelo orquestrador.
 */

export const ftxStyles = `
  @keyframes ftx-fade-in{from{opacity:0}to{opacity:1}}
  @keyframes ftx-slide-up{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
  @keyframes ftx-step-in{from{opacity:0;transform:translateX(24px)}to{opacity:1;transform:translateX(0)}}

  #ftx-card{
    background:#0C1929;
    border:1px solid rgba(0,200,232,0.15);
    border-radius:16px;
    width:100%;max-width:480px;
    padding:32px;
    animation:ftx-slide-up .3s ease;
    position:relative;
  }

  .ftx-steps{
    display:flex;align-items:center;gap:6px;
    margin-bottom:28px;
  }
  .ftx-step-dot{
    width:6px;height:6px;border-radius:50%;
    background:rgba(0,200,232,0.2);
    transition:all .2s;
  }
  .ftx-step-dot.active{
    background:#00C8E8;width:20px;border-radius:3px;
  }
  .ftx-step-dot.done{background:rgba(0,200,112,0.6)}

  .ftx-step{animation:ftx-step-in .25s ease}

  .ftx-logo{
    display:flex;align-items:center;gap:10px;
    margin-bottom:24px;
  }
  .ftx-logo-icon{
    width:40px;height:40px;
    background:rgba(0,200,232,0.1);
    border:1px solid rgba(0,200,232,0.2);
    border-radius:10px;
    display:flex;align-items:center;justify-content:center;
  }
  .ftx-logo-text{font-size:18px;font-weight:600;color:#E8F2FA;letter-spacing:.02em}
  .ftx-logo-sub{
    font-size:9px;font-weight:600;letter-spacing:.1em;
    color:#00C8E8;background:rgba(0,200,232,0.1);
    border:1px solid rgba(0,200,232,0.2);
    padding:2px 6px;border-radius:4px;
  }

  .ftx-eyebrow{
    font-size:11px;font-weight:600;letter-spacing:.1em;
    color:#00C8E8;margin-bottom:8px;
  }
  .ftx-title{
    font-size:22px;font-weight:700;color:#E8F2FA;
    line-height:1.25;margin-bottom:10px;
  }
  .ftx-desc{
    font-size:14px;color:#8AAAC8;line-height:1.6;
    margin-bottom:24px;
  }

  .ftx-form-label{
    font-size:11px;font-weight:600;color:#6A8BA8;
    letter-spacing:.06em;margin-bottom:6px;display:block;
  }
  .ftx-input{
    width:100%;background:rgba(255,255,255,0.05);
    border:1px solid rgba(255,255,255,0.1);
    border-radius:8px;padding:12px 14px;
    font-size:15px;color:#E8F2FA;
    font-family:inherit;outline:none;
    transition:border-color .15s;
    margin-bottom:14px;
  }
  .ftx-input:focus{border-color:rgba(0,200,232,0.5)}
  .ftx-input::placeholder{color:rgba(138,170,200,0.4)}
  .ftx-select{
    width:100%;background:rgba(255,255,255,0.05);
    border:1px solid rgba(255,255,255,0.1);
    border-radius:8px;padding:12px 14px;
    font-size:15px;color:#E8F2FA;
    font-family:inherit;outline:none;
    transition:border-color .15s;
    margin-bottom:14px;
    cursor:pointer;
  }
  .ftx-select:focus{border-color:rgba(0,200,232,0.5)}
  .ftx-select option{background:#0C1929;color:#E8F2FA}

  .ftx-row{display:grid;grid-template-columns:1fr 1fr;gap:10px}

  .ftx-btn-primary{
    width:100%;background:#00C8E8;color:#07111F;
    border:none;border-radius:10px;
    padding:14px;font-size:15px;font-weight:600;
    font-family:inherit;cursor:pointer;
    transition:opacity .15s,transform .1s;
  }
  .ftx-btn-primary:hover{opacity:.92}
  .ftx-btn-primary:active{transform:scale(.99)}
  .ftx-btn-primary:disabled{opacity:.4;cursor:not-allowed}

  .ftx-hint{
    font-size:12px;color:rgba(138,170,200,0.5);
    text-align:center;margin-top:12px;
  }

  .ftx-success-icon{
    width:56px;height:56px;border-radius:50%;
    background:rgba(0,200,112,0.15);
    border:1px solid rgba(0,200,112,0.3);
    display:flex;align-items:center;justify-content:center;
    margin:0 auto 20px;
    font-size:24px;
  }
  .ftx-actions{display:flex;flex-direction:column;gap:10px;margin-top:20px}
  .ftx-btn-sec{
    width:100%;background:transparent;
    border:1px solid rgba(255,255,255,0.1);
    border-radius:10px;padding:13px;
    font-size:14px;color:#8AAAC8;
    font-family:inherit;cursor:pointer;
    transition:border-color .15s,color .15s;
  }
  .ftx-btn-sec:hover{border-color:rgba(255,255,255,0.2);color:#E8F2FA}

  .ftx-value-props{
    display:flex;flex-direction:column;gap:8px;
    margin-bottom:24px;
  }
  .ftx-prop{
    display:flex;align-items:center;gap:10px;
    font-size:13px;color:#8AAAC8;
  }
  .ftx-prop-icon{
    width:28px;height:28px;border-radius:6px;
    background:rgba(0,200,232,0.08);
    border:1px solid rgba(0,200,232,0.15);
    display:flex;align-items:center;justify-content:center;
    font-size:13px;flex-shrink:0;
  }
  .ftx-report-copy-top{
    font-size:14px;color:#CFE2F4;line-height:1.5;
    margin-bottom:14px;
  }
  .ftx-report-preview-wrap{
    position:relative;
    max-height:280px;
    overflow:hidden;
    border-radius:10px;
    border:1px solid rgba(255,255,255,0.14);
    margin-bottom:14px;
    background:#fff;
  }
  .ftx-report-preview-wrap::after{
    content:"";
    position:absolute;
    left:0;right:0;bottom:0;
    height:58px;
    background:linear-gradient(180deg,rgba(255,255,255,0) 0%,#fff 78%);
    pointer-events:none;
  }
  .ftx-report-preview{
    background:#fff;
    color:#1B2430;
    padding:14px;
    font-size:11px;
    line-height:1.45;
  }
  .ftx-report-header{
    display:flex;align-items:center;justify-content:space-between;
    gap:10px;padding-bottom:10px;border-bottom:1px solid #DCE4EC;
    margin-bottom:10px;
  }
  .ftx-report-brand{
    display:flex;align-items:center;gap:8px;
    font-size:12px;font-weight:700;color:#0F2237;
  }
  .ftx-report-logo{
    width:22px;height:22px;border-radius:6px;
    background:#E8F8FC;border:1px solid #BCEAF3;
    display:flex;align-items:center;justify-content:center;
    color:#0089A0;font-size:12px;
  }
  .ftx-report-meta{
    display:grid;grid-template-columns:1fr 1fr;gap:8px 12px;
    margin-bottom:10px;
  }
  .ftx-report-meta span{display:block;color:#5A6A7D;font-size:10px}
  .ftx-report-meta strong{font-size:11px;color:#162232}
  .ftx-report-table{
    width:100%;border-collapse:collapse;
    margin-bottom:14px;
  }
  .ftx-report-table th,
  .ftx-report-table td{
    border:1px solid #DEE6EE;
    padding:6px 7px;
    text-align:left;
    vertical-align:top;
    font-size:10px;
  }
  .ftx-report-table th{
    background:#F5F8FB;
    color:#33445A;
    font-weight:700;
  }
  .ftx-signature-mock{
    margin-top:14px;
    padding-top:12px;
    border-top:1px solid #E2E8EF;
  }
  .ftx-signature-line{
    margin-top:18px;
    border-top:1px dashed #8A98A8;
    padding-top:6px;
    font-size:10px;
    color:#4C5C6E;
    width:68%;
  }
  .ftx-report-copy-bottom{
    text-align:center;
    color:#8AAAC8;
    font-size:13px;
    margin-bottom:16px;
  }
`;
