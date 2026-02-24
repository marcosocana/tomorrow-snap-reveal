export interface Country {
  code: string;
  name: string;
  flag: string;
  timezone: string;
}

export const COUNTRIES: Country[] = [
  { code: "DE", name: "Alemania", flag: "🇩🇪", timezone: "Europe/Berlin" },
  { code: "AL", name: "Albania", flag: "🇦🇱", timezone: "Europe/Tirane" },
  { code: "AD", name: "Andorra", flag: "🇦🇩", timezone: "Europe/Andorra" },
  { code: "AR", name: "Argentina", flag: "🇦🇷", timezone: "America/Argentina/Buenos_Aires" },
  { code: "AT", name: "Austria", flag: "🇦🇹", timezone: "Europe/Vienna" },
  { code: "BE", name: "Bélgica", flag: "🇧🇪", timezone: "Europe/Brussels" },
  { code: "BO", name: "Bolivia", flag: "🇧🇴", timezone: "America/La_Paz" },
  { code: "BA", name: "Bosnia y Herzegovina", flag: "🇧🇦", timezone: "Europe/Sarajevo" },
  { code: "BG", name: "Bulgaria", flag: "🇧🇬", timezone: "Europe/Sofia" },
  { code: "CL", name: "Chile", flag: "🇨🇱", timezone: "America/Santiago" },
  { code: "CY", name: "Chipre", flag: "🇨🇾", timezone: "Asia/Nicosia" },
  { code: "CO", name: "Colombia", flag: "🇨🇴", timezone: "America/Bogota" },
  { code: "CR", name: "Costa Rica", flag: "🇨🇷", timezone: "America/Costa_Rica" },
  { code: "HR", name: "Croacia", flag: "🇭🇷", timezone: "Europe/Zagreb" },
  { code: "CU", name: "Cuba", flag: "🇨🇺", timezone: "America/Havana" },
  { code: "DK", name: "Dinamarca", flag: "🇩🇰", timezone: "Europe/Copenhagen" },
  { code: "EC", name: "Ecuador", flag: "🇪🇨", timezone: "America/Guayaquil" },
  { code: "SV", name: "El Salvador", flag: "🇸🇻", timezone: "America/El_Salvador" },
  { code: "ES", name: "España", flag: "🇪🇸", timezone: "Europe/Madrid" },
  { code: "US", name: "Estados Unidos", flag: "🇺🇸", timezone: "America/New_York" },
  { code: "EE", name: "Estonia", flag: "🇪🇪", timezone: "Europe/Tallinn" },
  { code: "FI", name: "Finlandia", flag: "🇫🇮", timezone: "Europe/Helsinki" },
  { code: "FR", name: "Francia", flag: "🇫🇷", timezone: "Europe/Paris" },
  { code: "GR", name: "Grecia", flag: "🇬🇷", timezone: "Europe/Athens" },
  { code: "GT", name: "Guatemala", flag: "🇬🇹", timezone: "America/Guatemala" },
  { code: "HN", name: "Honduras", flag: "🇭🇳", timezone: "America/Tegucigalpa" },
  { code: "HU", name: "Hungría", flag: "🇭🇺", timezone: "Europe/Budapest" },
  { code: "IE", name: "Irlanda", flag: "🇮🇪", timezone: "Europe/Dublin" },
  { code: "IS", name: "Islandia", flag: "🇮🇸", timezone: "Atlantic/Reykjavik" },
  { code: "IT", name: "Italia", flag: "🇮🇹", timezone: "Europe/Rome" },
  { code: "XK", name: "Kosovo", flag: "🇽🇰", timezone: "Europe/Belgrade" },
  { code: "LV", name: "Letonia", flag: "🇱🇻", timezone: "Europe/Riga" },
  { code: "LI", name: "Liechtenstein", flag: "🇱🇮", timezone: "Europe/Vaduz" },
  { code: "LT", name: "Lituania", flag: "🇱🇹", timezone: "Europe/Vilnius" },
  { code: "LU", name: "Luxemburgo", flag: "🇱🇺", timezone: "Europe/Luxembourg" },
  { code: "MT", name: "Malta", flag: "🇲🇹", timezone: "Europe/Malta" },
  { code: "MX", name: "México", flag: "🇲🇽", timezone: "America/Mexico_City" },
  { code: "MD", name: "Moldavia", flag: "🇲🇩", timezone: "Europe/Chisinau" },
  { code: "MC", name: "Mónaco", flag: "🇲🇨", timezone: "Europe/Monaco" },
  { code: "ME", name: "Montenegro", flag: "🇲🇪", timezone: "Europe/Podgorica" },
  { code: "NI", name: "Nicaragua", flag: "🇳🇮", timezone: "America/Managua" },
  { code: "NO", name: "Noruega", flag: "🇳🇴", timezone: "Europe/Oslo" },
  { code: "NL", name: "Países Bajos", flag: "🇳🇱", timezone: "Europe/Amsterdam" },
  { code: "PA", name: "Panamá", flag: "🇵🇦", timezone: "America/Panama" },
  { code: "PY", name: "Paraguay", flag: "🇵🇾", timezone: "America/Asuncion" },
  { code: "PE", name: "Perú", flag: "🇵🇪", timezone: "America/Lima" },
  { code: "PL", name: "Polonia", flag: "🇵🇱", timezone: "Europe/Warsaw" },
  { code: "PT", name: "Portugal", flag: "🇵🇹", timezone: "Europe/Lisbon" },
  { code: "PR", name: "Puerto Rico", flag: "🇵🇷", timezone: "America/Puerto_Rico" },
  { code: "GB", name: "Reino Unido", flag: "🇬🇧", timezone: "Europe/London" },
  { code: "CZ", name: "República Checa", flag: "🇨🇿", timezone: "Europe/Prague" },
  { code: "DO", name: "República Dominicana", flag: "🇩🇴", timezone: "America/Santo_Domingo" },
  { code: "RO", name: "Rumanía", flag: "🇷🇴", timezone: "Europe/Bucharest" },
  { code: "RU", name: "Rusia", flag: "🇷🇺", timezone: "Europe/Moscow" },
  { code: "SM", name: "San Marino", flag: "🇸🇲", timezone: "Europe/Rome" },
  { code: "RS", name: "Serbia", flag: "🇷🇸", timezone: "Europe/Belgrade" },
  { code: "SK", name: "Eslovaquia", flag: "🇸🇰", timezone: "Europe/Bratislava" },
  { code: "SI", name: "Eslovenia", flag: "🇸🇮", timezone: "Europe/Ljubljana" },
  { code: "SE", name: "Suecia", flag: "🇸🇪", timezone: "Europe/Stockholm" },
  { code: "CH", name: "Suiza", flag: "🇨🇭", timezone: "Europe/Zurich" },
  { code: "TR", name: "Turquía", flag: "🇹🇷", timezone: "Europe/Istanbul" },
  { code: "UA", name: "Ucrania", flag: "🇺🇦", timezone: "Europe/Kyiv" },
  { code: "UY", name: "Uruguay", flag: "🇺🇾", timezone: "America/Montevideo" },
  { code: "VA", name: "Vaticano", flag: "🇻🇦", timezone: "Europe/Rome" },
  { code: "VE", name: "Venezuela", flag: "🇻🇪", timezone: "America/Caracas" },
].sort((a, b) => a.name.localeCompare(b.name, "es"));

export const getCountryByCode = (code: string): Country | undefined => {
  return COUNTRIES.find(c => c.code === code);
};

export const getTimezoneOffset = (timezone: string): number => {
  const now = new Date();
  const utcDate = new Date(now.toLocaleString("en-US", { timeZone: "UTC" }));
  const tzDate = new Date(now.toLocaleString("en-US", { timeZone: timezone }));
  return (tzDate.getTime() - utcDate.getTime()) / (1000 * 60);
};
