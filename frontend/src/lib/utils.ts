import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Resuelve el id de upload activo: usa el prop si viene definido, si no
 * lo toma del query param `?id=` de la URL. Permite que las páginas
 * estáticas pasen el id por la URL sin requerir SSR.
 */
export function resolveUploadId(propValue?: string): string | undefined {
  if (propValue) return propValue;
  if (typeof window === "undefined") return undefined;
  return new URLSearchParams(window.location.search).get("id") ?? undefined;
}
