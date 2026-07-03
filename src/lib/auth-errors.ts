// Traduz códigos de erro do Firebase Auth em mensagens amigáveis (pt-BR).
// Referência: https://firebase.google.com/docs/auth/admin/errors

type FirebaseLikeError = { code?: unknown; message?: unknown };

export type AuthErrorField = "email" | "password" | "name" | "form";

export interface FriendlyAuthError {
  /** Mensagem curta exibida ao usuário. */
  message: string;
  /** Campo que deve receber o foco / marcação aria-invalid (quando aplicável). */
  field: AuthErrorField;
}

const MAP: Record<string, FriendlyAuthError> = {
  "auth/invalid-email": { field: "email", message: "E-mail inválido. Verifique o endereço digitado." },
  "auth/user-disabled": { field: "email", message: "Esta conta foi desativada. Fale com o suporte." },
  "auth/user-not-found": {
    field: "email",
    message: "Não encontramos uma conta com este e-mail.",
  },
  "auth/wrong-password": { field: "password", message: "Senha incorreta. Tente novamente." },
  "auth/invalid-credential": {
    field: "form",
    message: "E-mail ou senha incorretos. Confira os dados e tente novamente.",
  },
  "auth/invalid-login-credentials": {
    field: "form",
    message: "E-mail ou senha incorretos. Confira os dados e tente novamente.",
  },
  "auth/missing-password": { field: "password", message: "Informe sua senha para continuar." },
  "auth/missing-email": { field: "email", message: "Informe seu e-mail para continuar." },
  "auth/email-already-in-use": {
    field: "email",
    message: "Este e-mail já está cadastrado. Faça login ou use outro e-mail.",
  },
  "auth/weak-password": {
    field: "password",
    message: "Senha muito fraca. Use pelo menos 6 caracteres.",
  },
  "auth/too-many-requests": {
    field: "form",
    message:
      "Muitas tentativas em pouco tempo. Aguarde alguns minutos antes de tentar novamente.",
  },
  "auth/network-request-failed": {
    field: "form",
    message: "Falha de conexão. Verifique sua internet e tente novamente.",
  },
  "auth/popup-closed-by-user": {
    field: "form",
    message: "A janela de login foi fechada antes da conclusão.",
  },
  "auth/operation-not-allowed": {
    field: "form",
    message: "Este método de login não está habilitado. Fale com o suporte.",
  },
  "auth/requires-recent-login": {
    field: "form",
    message: "Por segurança, entre novamente para concluir esta ação.",
  },
  "auth/internal-error": {
    field: "form",
    message: "Ocorreu um erro inesperado. Tente novamente em instantes.",
  },
};

export function friendlyAuthError(err: unknown): FriendlyAuthError {
  const raw = err as FirebaseLikeError | null | undefined;
  const code = typeof raw?.code === "string" ? raw.code : "";
  if (code && MAP[code]) return MAP[code];

  const message =
    typeof raw?.message === "string" && raw.message.trim().length > 0
      ? raw.message
      : "Não foi possível concluir a operação. Tente novamente.";
  return { field: "form", message };
}
