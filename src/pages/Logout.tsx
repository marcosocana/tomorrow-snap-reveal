import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAdminI18n } from "@/lib/adminI18n";

const Logout = () => {
  const navigate = useNavigate();
  const { pathPrefix } = useAdminI18n();

  useEffect(() => {
    const run = async () => {
      await supabase.auth.signOut();
      localStorage.removeItem("isDemoMode");
      localStorage.removeItem("adminEventId");
      navigate(`${pathPrefix}/admin-login`, { replace: true });
    };
    run();
  }, [navigate, pathPrefix]);

  return null;
};

export default Logout;
