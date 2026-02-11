import { useNavigate, useSearchParams } from "react-router-dom";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import ReactMarkdown from "react-markdown";

const PrivacyPolicy = () => {
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
        .select("custom_privacy_text, legal_text_type")
        .eq("id", eventId)
        .single();
      if (data && (data as any).legal_text_type === "custom" && (data as any).custom_privacy_text) {
        setCustomText((data as any).custom_privacy_text);
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
        <h1 className="text-xl font-bold text-foreground">Política de Privacidad</h1>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8 space-y-6">
        {customText ? (
          <div className="prose prose-sm max-w-none text-muted-foreground prose-headings:text-foreground prose-strong:text-foreground prose-a:text-primary">
            <ReactMarkdown>{customText}</ReactMarkdown>
          </div>
        ) : (
          <>
            <section className="space-y-4">
              <h2 className="text-lg font-semibold text-foreground">1. Responsable del tratamiento</h2>
              <p className="text-muted-foreground leading-relaxed">
                <strong>Responsable:</strong> Revelao<br />
                <strong>Contacto:</strong> info@revelao.es
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-lg font-semibold text-foreground">2. Datos tratados</h2>
              <p className="text-muted-foreground leading-relaxed">
                Los únicos datos personales tratados son las imágenes (fotografías) capturadas y subidas por el propio usuario mediante la plataforma.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                No se recogen datos de registro, perfiles de usuario ni información adicional.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-lg font-semibold text-foreground">3. Finalidad del tratamiento</h2>
              <p className="text-muted-foreground leading-relaxed">
                Las imágenes se tratan exclusivamente para:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                <li>Permitir su visualización y descarga por el usuario.</li>
                <li>Gestionar el funcionamiento técnico del servicio.</li>
              </ul>
              <p className="text-muted-foreground leading-relaxed">
                Las fotografías no se utilizan para fines publicitarios, comerciales, analíticos ni de entrenamiento de modelos.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-lg font-semibold text-foreground">4. Conservación de los datos</h2>
              <p className="text-muted-foreground leading-relaxed">
                Las imágenes se almacenan durante un máximo de 15 días, tras los cuales se eliminan automáticamente y de forma definitiva.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-lg font-semibold text-foreground">5. Base legal</h2>
              <p className="text-muted-foreground leading-relaxed">
                La base legal para el tratamiento de los datos es el consentimiento del usuario, otorgado al hacer uso del servicio y tomar la fotografía.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-lg font-semibold text-foreground">6. Cesión de datos</h2>
              <p className="text-muted-foreground leading-relaxed">
                Las imágenes no se ceden a terceros, salvo obligación legal.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-lg font-semibold text-foreground">7. Derechos del usuario</h2>
              <p className="text-muted-foreground leading-relaxed">
                El usuario puede ejercer sus derechos de acceso, rectificación y supresión de sus datos enviando una solicitud al correo de contacto indicado, indicando la imagen o contexto correspondiente.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-lg font-semibold text-foreground">8. Seguridad</h2>
              <p className="text-muted-foreground leading-relaxed">
                Revelao aplica medidas técnicas razonables para proteger las imágenes frente a accesos no autorizados durante el tiempo en que están almacenadas.
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

export default PrivacyPolicy;
