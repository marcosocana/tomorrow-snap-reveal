import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { guestEventLinkRedirect } from "@/lib/guestEventAccess";

/**
 * Envuelve la cámara y la galería: si la URL trae otro evento (`?e=<código>`)
 * o el navegador no tiene ninguno guardado, pasa por la URL del QR antes de
 * montar la página. Sin `?e=` todo funciona exactamente igual que antes.
 */
const GuestEventLinkGate = ({ children }: { children: ReactNode }) => {
  const { search } = useLocation();
  const redirect = guestEventLinkRedirect(search);
  if (redirect) return <Navigate to={redirect} replace />;
  return <>{children}</>;
};

export default GuestEventLinkGate;
