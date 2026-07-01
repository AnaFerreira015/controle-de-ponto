import type { User } from "firebase/auth";
import type { UserProfile } from "./types";

export function looksLikeEmail(value: string | null | undefined): boolean {
  const text = value?.trim();
  return Boolean(text && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text));
}

export function sanitizeDisplayName(value: string | null | undefined): string {
  const text = value?.trim() ?? "";
  if (!text || looksLikeEmail(text)) return "";
  return text;
}

export function getDisplayName(
  profile: UserProfile | null | undefined,
  user: User | null | undefined,
  fallback = "Usuário",
): string {
  return sanitizeDisplayName(profile?.name) || sanitizeDisplayName(user?.displayName) || fallback;
}

export function getFirstName(
  profile: UserProfile | null | undefined,
  user: User | null | undefined,
  fallback = "por aqui",
): string {
  return getDisplayName(profile, user, fallback).split(/\s+/)[0] || fallback;
}
