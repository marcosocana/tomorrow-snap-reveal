export interface Country {
  code: string;
  name: string;
  flag: string;
  timezone: string;
}

export const COUNTRIES: Country[] = [
  { code: "ES", name: "España", flag: "🇪🇸", timezone: "Europe/Madrid" },
  { code: "MX", name: "México", flag: "🇲🇽", timezone: "America/Mexico_City" },
  { code: "AR", name: "Argentina", flag: "🇦🇷", timezone: "America/Argentina/Buenos_Aires" },
  { code: "CO", name: "Colombia", flag: "🇨🇴", timezone: "America/Bogota" },
  { code: "CL", name: "Chile", flag: "🇨🇱", timezone: "America/Santiago" },
  { code: "PE", name: "Perú", flag: "🇵🇪", timezone: "America/Lima" },
  { code: "EC", name: "Ecuador", flag: "🇪🇨", timezone: "America/Guayaquil" },
  { code: "VE", name: "Venezuela", flag: "🇻🇪", timezone: "America/Caracas" },
  { code: "BO", name: "Bolivia", flag: "🇧🇴", timezone: "America/La_Paz" },
  { code: "PY", name: "Paraguay", flag: "🇵🇾", timezone: "America/Asuncion" },
  { code: "UY", name: "Uruguay", flag: "🇺🇾", timezone: "America/Montevideo" },
  { code: "GT", name: "Guatemala", flag: "🇬🇹", timezone: "America/Guatemala" },
  { code: "CU", name: "Cuba", flag: "🇨🇺", timezone: "America/Havana" },
  { code: "DO", name: "República Dominicana", flag: "🇩🇴", timezone: "America/Santo_Domingo" },
  { code: "HN", name: "Honduras", flag: "🇭🇳", timezone: "America/Tegucigalpa" },
  { code: "SV", name: "El Salvador", flag: "🇸🇻", timezone: "America/El_Salvador" },
  { code: "NI", name: "Nicaragua", flag: "🇳🇮", timezone: "America/Managua" },
  { code: "CR", name: "Costa Rica", flag: "🇨🇷", timezone: "America/Costa_Rica" },
  { code: "PA", name: "Panamá", flag: "🇵🇦", timezone: "America/Panama" },
  { code: "PR", name: "Puerto Rico", flag: "🇵🇷", timezone: "America/Puerto_Rico" },
];

export const getCountryByCode = (code: string): Country | undefined => {
  return COUNTRIES.find(c => c.code === code);
};

export const getTimezoneOffset = (timezone: string): number => {
  const now = new Date();
  const utcDate = new Date(now.toLocaleString("en-US", { timeZone: "UTC" }));
  const tzDate = new Date(now.toLocaleString("en-US", { timeZone: timezone }));
  return (tzDate.getTime() - utcDate.getTime()) / (1000 * 60);
};
