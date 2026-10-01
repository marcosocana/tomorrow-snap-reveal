import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { syncGuestEventManifest } from "@/lib/guestEventAccess";

/** Mantiene el manifest de la PWA apuntando al evento del invitado. */
const GuestEventManifest = () => {
  const { pathname, search } = useLocation();
  useEffect(() => {
    syncGuestEventManifest(pathname, search);
  }, [pathname, search]);
  return null;
};

export default GuestEventManifest;
