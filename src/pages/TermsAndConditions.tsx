import { useNavigate, useSearchParams } from "react-router-dom";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import ReactMarkdown from "react-markdown";

const TermsAndConditions = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const eventId = searchParams.get("eventId");
  const [customText, setCustomText] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!eventId);

  useEffect(() => {
    if (!eventId) return;
    const loadCustomText = async () => {
      const { data } = await supabase
        .from("events")
        .select("custom_terms_text, legal_text_type")
        .eq("id", eventId)
        .single();
      if (data && (data as any).legal_text_type === "custom" && (data as any).custom_terms_text) {
        setCustomText((data as any).custom_terms_text);
      }
      setLoading(false);
    };
    loadCustomText();
  }, [eventId]);

  const handleBack = () => {
    navigate(-1);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Cargando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 p-4 flex items-center gap-4 bg-card border-b border-border">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleBack}
          className="rounded-full"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-xl font-bold text-foreground">Términos y Condiciones</h1>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8 space-y-6">
        {customText ? (
          <div className="prose prose-sm max-w-none text-muted-foreground prose-headings:text-foreground prose-strong:text-foreground prose-a:text-primary">
            <ReactMarkdown>{customText}</ReactMarkdown>
          </div>
        ) : (
          <>
            <section className="space-y-4">
              <h2 className="text-lg font-semibold text-foreground">1. Objeto</h2>
              <p className="text-muted-foreground leading-relaxed">
                Revelao permite a los usuarios tomar fotografías a través de la plataforma y subirlas automáticamente para su visualización y descarga temporal.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-lg font-semibold text-foreground">2. Uso del servicio</h2>
              <p className="text-muted-foreground leading-relaxed">
                Al utilizar el servicio, el usuario declara que:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                <li>Tiene derecho a capturar y subir las imágenes.</li>
                <li>No infringe derechos de terceros (imagen, privacidad, propiedad intelectual).</li>
                <li>No utiliza el servicio para fines ilegales, ofensivos o no autorizados.</li>
              </ul>
              <p className="text-muted-foreground leading-relaxed">
                Revelao se reserva el derecho de eliminar cualquier contenido que incumpla estas condiciones.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-lg font-semibold text-foreground">3. Disponibilidad de las fotografías</h2>
              <p className="text-muted-foreground leading-relaxed">
                Las fotografías subidas estarán disponibles durante un plazo máximo de 15 días desde su captura.
                Transcurrido este plazo, las imágenes se eliminarán automáticamente de los sistemas de Revelao.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-lg font-semibold text-foreground">4. Responsabilidad</h2>
              <p className="text-muted-foreground leading-relaxed">
                Revelao no se hace responsable del uso que terceros puedan hacer de las imágenes una vez descargadas por el usuario.
                El servicio se ofrece "tal cual", sin garantía de disponibilidad permanente o ausencia de errores.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-lg font-semibold text-foreground">5. Modificaciones</h2>
              <p className="text-muted-foreground leading-relaxed">
                Revelao podrá modificar estos Términos y Condiciones cuando sea necesario. Las versiones actualizadas estarán disponibles en esta misma página.
              </p>
            </section>
          </>
        )}

        <div className="pt-8">
          <Button onClick={handleBack} className="w-full sm:w-auto">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver
          </Button>
        </div>
      </main>
    </div>
  );
};

export default TermsAndConditions;
