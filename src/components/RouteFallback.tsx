/**
 * Fallback de Suspense para las rutas diferidas.
 *
 * Reutiliza el mismo marcado e id (`#app-boot`) que la pantalla de arranque de
 * `index.html`, cuyos estilos están en el <style> de esa página. Así la
 * transición entre el arranque y la carga de una ruta es visualmente idéntica
 * y no se añade CSS nuevo al bundle.
 */
const RouteFallback = () => {
  const isCaptains =
    typeof window !== "undefined" && window.location.pathname.startsWith("/capitanes");

  return (
    <div id="app-boot" role="status" aria-label="Cargando">
      {isCaptains && (
        <img src="/capitanes-logo.svg" alt="Capitanes" style={{ display: "block" }} />
      )}
      <span aria-hidden="true" />
    </div>
  );
};

export default RouteFallback;
