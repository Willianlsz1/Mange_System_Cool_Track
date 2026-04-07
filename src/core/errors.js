import { Toast } from "./toast.js";

export const ErrorCodes = Object.freeze({
  AUTH_FAILED: "AUTH_FAILED",
  NETWORK_ERROR: "NETWORK_ERROR",
  STORAGE_QUOTA: "STORAGE_QUOTA",
  DATA_CORRUPT: "DATA_CORRUPT",
  SYNC_FAILED: "SYNC_FAILED",
  VALIDATION_ERROR: "VALIDATION_ERROR",
});

const ERROR_LOG_KEY = "cooltrack-error-log";
const ERROR_LOG_LIMIT = 50;

const DEFAULT_MESSAGES = {
  [ErrorCodes.AUTH_FAILED]: "Falha de autenticação. Faça login novamente.",
  [ErrorCodes.NETWORK_ERROR]:
    "Erro de conexão. Verifique sua internet e tente novamente.",
  [ErrorCodes.STORAGE_QUOTA]:
    "Armazenamento cheio. Remova dados antigos para continuar.",
  [ErrorCodes.DATA_CORRUPT]:
    "Foram encontrados dados inválidos. Alguns registros podem não carregar.",
  [ErrorCodes.SYNC_FAILED]:
    "Não foi possível sincronizar agora. Seus dados foram mantidos localmente.",
  [ErrorCodes.VALIDATION_ERROR]: "Dados inválidos. Revise os campos e tente novamente.",
};

export class AppError extends Error {
  constructor(message, code = ErrorCodes.NETWORK_ERROR, severity = "error", context = {}) {
    super(message || DEFAULT_MESSAGES[code] || "Ocorreu um erro inesperado.");
    this.name = "AppError";
    this.code = code;
    this.severity = severity;
    this.context = context;
    this.timestamp = new Date().toISOString();
  }
}

function toAppError(error, options = {}) {
  if (error instanceof AppError) return error;
  const code = options.code || error?.code || ErrorCodes.NETWORK_ERROR;
  const severity = options.severity || error?.severity || "error";
  const context = { ...(options.context || {}), originalName: error?.name };
  const message =
    options.message ||
    error?.userMessage ||
    error?.message ||
    DEFAULT_MESSAGES[code] ||
    "Ocorreu um erro inesperado.";
  return new AppError(message, code, severity, context);
}

function appendErrorLog(appError) {
  try {
    const current = JSON.parse(localStorage.getItem(ERROR_LOG_KEY) || "[]");
    const next = Array.isArray(current) ? current : [];
    next.unshift({
      message: appError.message,
      code: appError.code,
      severity: appError.severity,
      context: appError.context,
      timestamp: appError.timestamp,
    });
    localStorage.setItem(ERROR_LOG_KEY, JSON.stringify(next.slice(0, ERROR_LOG_LIMIT)));
  } catch (logErr) {
    console.error("[Erro] Falha ao salvar log de erro local", logErr);
  }
}

export function handleError(error, options = {}) {
  const appError = toAppError(error, options);
  const shouldToast = options.showToast !== false;
  const shouldLog = options.log !== false;
  const shouldReport = options.report !== false;

  if (shouldLog) {
    console.error("[Erro]", {
      message: appError.message,
      code: appError.code,
      severity: appError.severity,
      timestamp: appError.timestamp,
      context: appError.context,
      cause: error,
    });
  }

  if (shouldReport) {
    appendErrorLog(appError);
  }

  if (shouldToast) {
    if (appError.severity === "warning") Toast.warning(appError.message);
    else Toast.error(appError.message);
  }

  return appError;
}

