import { lazy, type ComponentType } from "react";

/**
 * Carga diferida de rutas resistente a despliegues.
 *
 * Al desplegar, los ficheros de `dist/assets` cambian de hash y los antiguos
 * dejan de existir. Una pestaña abierta desde antes del despliegue que navegue
 * a una ruta todavía no descargada pide un chunk que ya no está y falla con
 * "Failed to fetch dynamically imported module".
 *
 * Aquí se recarga la página una sola vez por ruta: el navegador vuelve a pedir
 * `index.html`, recibe los hashes nuevos y continúa. Si falla otra vez (sin
 * conexión de verdad), el error se propaga en lugar de entrar en bucle.
 */

const RELOAD_FLAG_PREFIX = "chunk-reload:";

const hasReloadedFor = (key: string) => {
  try {
    return sessionStorage.getItem(`${RELOAD_FLAG_PREFIX}${key}`) === "1";
  } catch {
    return false;
  }
};

const markReloadedFor = (key: string) => {
  try {
    sessionStorage.setItem(`${RELOAD_FLAG_PREFIX}${key}`, "1");
  } catch {
    // Safari en navegación privada puede lanzar al escribir: seguimos igual.
  }
};

const clearReloadFlag = (key: string) => {
  try {
    sessionStorage.removeItem(`${RELOAD_FLAG_PREFIX}${key}`);
  } catch {
    // idem
  }
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const lazyWithRetry = <T extends ComponentType<any>>(
  key: string,
  factory: () => Promise<{ default: T }>,
) =>
  lazy(async () => {
    try {
      const module = await factory();
      clearReloadFlag(key);
      return module;
    } catch (error) {
      if (hasReloadedFor(key)) throw error;
      markReloadedFor(key);
      window.location.reload();
      // La página se está recargando: mantenemos el Suspense en fallback
      // en lugar de resolver con un componente vacío.
      return new Promise<never>(() => {});
    }
  });
