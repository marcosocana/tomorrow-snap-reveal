/**
 * Available font families for event names
 * These are Google Fonts that will be loaded dynamically
 */
export type EventFontFamily = 
  | 'system'
  | 'dancing-script'
  | 'pacifico'
  | 'great-vibes'
  | 'alex-brush'
  | 'allura'
  | 'sacramento'
  | 'tangerine'
  | 'pinyon-script'
  | 'mr-dafoe'
  | 'playlist-script'
  | 'satisfy'
  | 'cookie'
  | 'kaushan-script'
  | 'caveat'
  | 'lobster'
  | 'playball'
  | 'yellowtail'
  | 'marck-script';

export interface FontOption {
  id: EventFontFamily;
  name: string;
  googleFont: string;
  fontFamily: string;
  category: 'system' | 'calligraphic' | 'decorative';
}

export const FONT_OPTIONS: FontOption[] = [
  {
    id: 'system',
    name: 'Sistema (Por defecto)',
    googleFont: '',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    category: 'system',
  },
  // Calligraphic fonts
  {
    id: 'dancing-script',
    name: 'Dancing Script',
    googleFont: 'Dancing+Script:wght@400;700',
    fontFamily: '"Dancing Script", cursive',
    category: 'calligraphic',
  },
  {
    id: 'pacifico',
    name: 'Pacifico',
    googleFont: 'Pacifico',
    fontFamily: '"Pacifico", cursive',
    category: 'calligraphic',
  },
  {
    id: 'great-vibes',
    name: 'Great Vibes',
    googleFont: 'Great+Vibes',
    fontFamily: '"Great Vibes", cursive',
    category: 'calligraphic',
  },
  {
    id: 'alex-brush',
    name: 'Alex Brush',
    googleFont: 'Alex+Brush',
    fontFamily: '"Alex Brush", cursive',
    category: 'calligraphic',
  },
  {
    id: 'allura',
    name: 'Allura',
    googleFont: 'Allura',
    fontFamily: '"Allura", cursive',
    category: 'calligraphic',
  },
  {
    id: 'sacramento',
    name: 'Sacramento',
    googleFont: 'Sacramento',
    fontFamily: '"Sacramento", cursive',
    category: 'calligraphic',
  },
  {
    id: 'tangerine',
    name: 'Tangerine',
    googleFont: 'Tangerine:wght@400;700',
    fontFamily: '"Tangerine", cursive',
    category: 'calligraphic',
  },
  {
    id: 'pinyon-script',
    name: 'Pinyon Script',
    googleFont: 'Pinyon+Script',
    fontFamily: '"Pinyon Script", cursive',
    category: 'calligraphic',
  },
  {
    id: 'mr-dafoe',
    name: 'Mr Dafoe',
    googleFont: 'Mr+Dafoe',
    fontFamily: '"Mr Dafoe", cursive',
    category: 'calligraphic',
  },
  {
    id: 'satisfy',
    name: 'Satisfy',
    googleFont: 'Satisfy',
    fontFamily: '"Satisfy", cursive',
    category: 'calligraphic',
  },
  {
    id: 'cookie',
    name: 'Cookie',
    googleFont: 'Cookie',
    fontFamily: '"Cookie", cursive',
    category: 'calligraphic',
  },
  {
    id: 'kaushan-script',
    name: 'Kaushan Script',
    googleFont: 'Kaushan+Script',
    fontFamily: '"Kaushan Script", cursive',
    category: 'calligraphic',
  },
  {
    id: 'caveat',
    name: 'Caveat',
    googleFont: 'Caveat:wght@400;700',
    fontFamily: '"Caveat", cursive',
    category: 'calligraphic',
  },
  // Decorative fonts
  {
    id: 'lobster',
    name: 'Lobster',
    googleFont: 'Lobster',
    fontFamily: '"Lobster", cursive',
    category: 'decorative',
  },
  {
    id: 'playball',
    name: 'Playball',
    googleFont: 'Playball',
    fontFamily: '"Playball", cursive',
    category: 'decorative',
  },
  {
    id: 'yellowtail',
    name: 'Yellowtail',
    googleFont: 'Yellowtail',
    fontFamily: '"Yellowtail", cursive',
    category: 'decorative',
  },
  {
    id: 'marck-script',
    name: 'Marck Script',
    googleFont: 'Marck+Script',
    fontFamily: '"Marck Script", cursive',
    category: 'decorative',
  },
];

/**
 * Get font option by ID
 */
export const getFontById = (id: EventFontFamily): FontOption => {
  return FONT_OPTIONS.find(f => f.id === id) || FONT_OPTIONS[0];
};

/**
 * Load a Google Font dynamically
 */
export const loadGoogleFont = (fontOption: FontOption): void => {
  if (!fontOption.googleFont || fontOption.id === 'system') return;
  
  const linkId = `google-font-${fontOption.id}`;
  
  // Check if already loaded
  if (document.getElementById(linkId)) return;
  
  const link = document.createElement('link');
  link.id = linkId;
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${fontOption.googleFont}&display=swap`;
  document.head.appendChild(link);
};

/**
 * Get the font family CSS value for an event font
 */
export const getEventFontFamily = (fontId: EventFontFamily): string => {
  const font = getFontById(fontId);
  loadGoogleFont(font);
  return font.fontFamily;
};
