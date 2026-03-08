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
        <p className="text-sm text-muted-foreground">Última actualización: 08-03-2026</p>
        {customText ? (
          <div className="prose prose-sm max-w-none text-muted-foreground prose-headings:text-foreground prose-strong:text-foreground prose-a:text-primary">
            <ReactMarkdown>{customText}</ReactMarkdown>
          </div>
        ) : (
          <>
            <section className="space-y-4">
              <h2 className="text-lg font-semibold text-foreground">1. Definiciones</h2>
              <p className="text-muted-foreground leading-relaxed">
                "Servicio" se refiere al servicio online y funcionalidades relacionadas ofrecidas por Revelao.
                "Compañía", "nosotros", "nos" y "nuestro" se refieren a Revelao.
                "Usted" y "su" se refieren al usuario del Servicio.
                "Contenido" incluye texto, imágenes, audio, vídeo, información u otros materiales publicados por los usuarios.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-lg font-semibold text-foreground">2. Cancelación y suspensión</h2>
              <p className="text-muted-foreground leading-relaxed">
                Nos reservamos el derecho de cancelar o suspender pedidos, cuentas o eventos si se utilizan para cargar contenidos inapropiados o para un uso contrario a estos términos.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-lg font-semibold text-foreground">3. Ajustes de precios</h2>
              <p className="text-muted-foreground leading-relaxed">
                Nos reservamos el derecho de modificar precios en cualquier momento. Estos cambios no afectarán a pedidos ya realizados y pagados.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-lg font-semibold text-foreground">4. Datos de cuenta y seguridad</h2>
              <p className="text-muted-foreground leading-relaxed">
                Al crear una cuenta, debe proporcionar información veraz, completa y actualizada. Usted es responsable de mantener la confidencialidad de su contraseña y de todas las actividades realizadas con su cuenta.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-lg font-semibold text-foreground">5. Uso del servicio y contenido</h2>
              <p className="text-muted-foreground leading-relaxed">
                Usted es responsable del contenido que publique en el Servicio, incluyendo su legalidad, fiabilidad y adecuación. Declara que tiene los derechos necesarios sobre dicho contenido.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-lg font-semibold text-foreground">6. Política de uso justo y almacenamiento</h2>
              <p className="text-muted-foreground leading-relaxed">
                Revelao aplica una política de uso justo para el almacenamiento y subida de contenido según el plan contratado. El Servicio no está diseñado como almacenamiento en la nube personal ni copia de seguridad permanente.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-lg font-semibold text-foreground">7. Licencia del contenido publicado</h2>
              <p className="text-muted-foreground leading-relaxed">
                Al publicar contenido, usted otorga a Revelao una licencia no exclusiva, mundial y gratuita para alojar, procesar, reproducir, mostrar y distribuir dicho contenido únicamente para prestar el Servicio.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-lg font-semibold text-foreground">8. Contenido inaceptable</h2>
              <p className="text-muted-foreground leading-relaxed">
                No está permitido publicar contenido ilegal, ofensivo, amenazante, difamatorio, obsceno, discriminatorio, violento o que vulnere derechos de terceros.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-lg font-semibold text-foreground">9. Derecho a rechazar o eliminar contenido</h2>
              <p className="text-muted-foreground leading-relaxed">
                Revelao podrá revisar, rechazar, bloquear, retirar o limitar contenido y/o cuentas cuando considere que incumplen estos términos o la normativa aplicable.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-lg font-semibold text-foreground">10. Respaldo e integridad de datos</h2>
              <p className="text-muted-foreground leading-relaxed">
                Aunque se aplican medidas razonables de respaldo y seguridad, no garantizamos ausencia total de pérdida o corrupción de datos. Recomendamos mantener copias propias.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-lg font-semibold text-foreground">11. Enlaces de terceros</h2>
              <p className="text-muted-foreground leading-relaxed">
                El Servicio puede incluir enlaces a webs o servicios de terceros. Revelao no controla ni asume responsabilidad por su contenido, políticas o prácticas.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-lg font-semibold text-foreground">12. Limitación de responsabilidad</h2>
              <p className="text-muted-foreground leading-relaxed">
                En la máxima medida permitida por la ley, la responsabilidad total de Revelao se limita al importe efectivamente pagado por usted por el Servicio en cuestión, o 100 € si no hubo pago.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-lg font-semibold text-foreground">13. Sin garantía</h2>
              <p className="text-muted-foreground leading-relaxed">
                El Servicio se ofrece "tal cual" y "según disponibilidad", sin garantías de funcionamiento ininterrumpido, ausencia de errores o adecuación a un propósito concreto.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-lg font-semibold text-foreground">14. Contacto</h2>
              <p className="text-muted-foreground leading-relaxed">
                Para cualquier consulta o reclamación puede escribir a: revelao.cam@gmail.com
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-lg font-semibold text-foreground">15. Ley aplicable y jurisdicción</h2>
              <p className="text-muted-foreground leading-relaxed">
                Estos términos se regirán por la normativa aplicable en España. Cualquier controversia se someterá a los juzgados y tribunales competentes conforme a derecho.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-lg font-semibold text-foreground">16. Modificaciones</h2>
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
