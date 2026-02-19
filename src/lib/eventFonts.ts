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
  | 'marck-script'
  | 'playfair-display'
  | 'merriweather'
  | 'lora'
  | 'libre-baskerville'
  | 'cormorant-garamond'
  | 'cinzel'
  | 'crimson-text'
  | 'eb-garamond'
  | 'alegreya'
  | 'vollkorn'
  | 'montserrat'
  | 'poppins'
  | 'raleway'
  | 'lato'
  | 'open-sans'
  | 'nunito'
  | 'source-sans-3'
  | 'work-sans'
  | 'rubik'
  | 'ubuntu'
  | 'mulish'
  | 'manrope'
  | 'abril-fatface'
  | 'bebas-neue'
  | 'oswald'
  | 'anton'
  | 'fredoka'
  | 'righteous'
  | 'lobster-two'
  | 'yeseva-one'
  | 'alfa-slab-one'
  | 'bungee'
  | 'parisienne'
  | 'gloria-hallelujah'
  | 'indie-flower'
  | 'patrick-hand'
  | 'shadows-into-light'
  | 'handlee';

export interface FontOption {
  id: EventFontFamily;
  name: string;
  googleFont: string;
  fontFamily: string;
  category: 'system' | 'calligraphic' | 'handwritten' | 'serif' | 'sans' | 'display' | 'decorative';
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
  // Handwritten fonts
  {
    id: 'parisienne',
    name: 'Parisienne',
    googleFont: 'Parisienne',
    fontFamily: '"Parisienne", cursive',
    category: 'handwritten',
  },
  {
    id: 'gloria-hallelujah',
    name: 'Gloria Hallelujah',
    googleFont: 'Gloria+Hallelujah',
    fontFamily: '"Gloria Hallelujah", cursive',
    category: 'handwritten',
  },
  {
    id: 'indie-flower',
    name: 'Indie Flower',
    googleFont: 'Indie+Flower',
    fontFamily: '"Indie Flower", cursive',
    category: 'handwritten',
  },
  {
    id: 'patrick-hand',
    name: 'Patrick Hand',
    googleFont: 'Patrick+Hand',
    fontFamily: '"Patrick Hand", cursive',
    category: 'handwritten',
  },
  {
    id: 'shadows-into-light',
    name: 'Shadows Into Light',
    googleFont: 'Shadows+Into+Light',
    fontFamily: '"Shadows Into Light", cursive',
    category: 'handwritten',
  },
  {
    id: 'handlee',
    name: 'Handlee',
    googleFont: 'Handlee',
    fontFamily: '"Handlee", cursive',
    category: 'handwritten',
  },
  // Serif fonts
  {
    id: 'playfair-display',
    name: 'Playfair Display',
    googleFont: 'Playfair+Display:wght@400;600;700',
    fontFamily: '"Playfair Display", serif',
    category: 'serif',
  },
  {
    id: 'merriweather',
    name: 'Merriweather',
    googleFont: 'Merriweather:wght@300;400;700',
    fontFamily: '"Merriweather", serif',
    category: 'serif',
  },
  {
    id: 'lora',
    name: 'Lora',
    googleFont: 'Lora:wght@400;600;700',
    fontFamily: '"Lora", serif',
    category: 'serif',
  },
  {
    id: 'libre-baskerville',
    name: 'Libre Baskerville',
    googleFont: 'Libre+Baskerville:wght@400;700',
    fontFamily: '"Libre Baskerville", serif',
    category: 'serif',
  },
  {
    id: 'cormorant-garamond',
    name: 'Cormorant Garamond',
    googleFont: 'Cormorant+Garamond:wght@400;600;700',
    fontFamily: '"Cormorant Garamond", serif',
    category: 'serif',
  },
  {
    id: 'cinzel',
    name: 'Cinzel',
    googleFont: 'Cinzel:wght@400;700',
    fontFamily: '"Cinzel", serif',
    category: 'serif',
  },
  {
    id: 'crimson-text',
    name: 'Crimson Text',
    googleFont: 'Crimson+Text:wght@400;600;700',
    fontFamily: '"Crimson Text", serif',
    category: 'serif',
  },
  {
    id: 'eb-garamond',
    name: 'EB Garamond',
    googleFont: 'EB+Garamond:wght@400;600;700',
    fontFamily: '"EB Garamond", serif',
    category: 'serif',
  },
  {
    id: 'alegreya',
    name: 'Alegreya',
    googleFont: 'Alegreya:wght@400;600;700',
    fontFamily: '"Alegreya", serif',
    category: 'serif',
  },
  {
    id: 'vollkorn',
    name: 'Vollkorn',
    googleFont: 'Vollkorn:wght@400;600;700',
    fontFamily: '"Vollkorn", serif',
    category: 'serif',
  },
  // Sans-serif fonts
  {
    id: 'montserrat',
    name: 'Montserrat',
    googleFont: 'Montserrat:wght@400;600;700',
    fontFamily: '"Montserrat", sans-serif',
    category: 'sans',
  },
  {
    id: 'poppins',
    name: 'Poppins',
    googleFont: 'Poppins:wght@400;500;600;700',
    fontFamily: '"Poppins", sans-serif',
    category: 'sans',
  },
  {
    id: 'raleway',
    name: 'Raleway',
    googleFont: 'Raleway:wght@400;600;700',
    fontFamily: '"Raleway", sans-serif',
    category: 'sans',
  },
  {
    id: 'lato',
    name: 'Lato',
    googleFont: 'Lato:wght@300;400;700',
    fontFamily: '"Lato", sans-serif',
    category: 'sans',
  },
  {
    id: 'open-sans',
    name: 'Open Sans',
    googleFont: 'Open+Sans:wght@400;600;700',
    fontFamily: '"Open Sans", sans-serif',
    category: 'sans',
  },
  {
    id: 'nunito',
    name: 'Nunito',
    googleFont: 'Nunito:wght@400;600;700',
    fontFamily: '"Nunito", sans-serif',
    category: 'sans',
  },
  {
    id: 'source-sans-3',
    name: 'Source Sans 3',
    googleFont: 'Source+Sans+3:wght@400;600;700',
    fontFamily: '"Source Sans 3", sans-serif',
    category: 'sans',
  },
  {
    id: 'work-sans',
    name: 'Work Sans',
    googleFont: 'Work+Sans:wght@400;600;700',
    fontFamily: '"Work Sans", sans-serif',
    category: 'sans',
  },
  {
    id: 'rubik',
    name: 'Rubik',
    googleFont: 'Rubik:wght@400;500;700',
    fontFamily: '"Rubik", sans-serif',
    category: 'sans',
  },
  {
    id: 'ubuntu',
    name: 'Ubuntu',
    googleFont: 'Ubuntu:wght@400;500;700',
    fontFamily: '"Ubuntu", sans-serif',
    category: 'sans',
  },
  {
    id: 'mulish',
    name: 'Mulish',
    googleFont: 'Mulish:wght@400;600;700',
    fontFamily: '"Mulish", sans-serif',
    category: 'sans',
  },
  {
    id: 'manrope',
    name: 'Manrope',
    googleFont: 'Manrope:wght@400;600;700',
    fontFamily: '"Manrope", sans-serif',
    category: 'sans',
  },
  // Display fonts
  {
    id: 'abril-fatface',
    name: 'Abril Fatface',
    googleFont: 'Abril+Fatface',
    fontFamily: '"Abril Fatface", cursive',
    category: 'display',
  },
  {
    id: 'bebas-neue',
    name: 'Bebas Neue',
    googleFont: 'Bebas+Neue',
    fontFamily: '"Bebas Neue", sans-serif',
    category: 'display',
  },
  {
    id: 'oswald',
    name: 'Oswald',
    googleFont: 'Oswald:wght@400;600;700',
    fontFamily: '"Oswald", sans-serif',
    category: 'display',
  },
  {
    id: 'anton',
    name: 'Anton',
    googleFont: 'Anton',
    fontFamily: '"Anton", sans-serif',
    category: 'display',
  },
  {
    id: 'fredoka',
    name: 'Fredoka',
    googleFont: 'Fredoka:wght@400;600;700',
    fontFamily: '"Fredoka", sans-serif',
    category: 'display',
  },
  {
    id: 'righteous',
    name: 'Righteous',
    googleFont: 'Righteous',
    fontFamily: '"Righteous", cursive',
    category: 'display',
  },
  {
    id: 'lobster-two',
    name: 'Lobster Two',
    googleFont: 'Lobster+Two:wght@400;700',
    fontFamily: '"Lobster Two", cursive',
    category: 'display',
  },
  {
    id: 'yeseva-one',
    name: 'Yeseva One',
    googleFont: 'Yeseva+One',
    fontFamily: '"Yeseva One", serif',
    category: 'display',
  },
  {
    id: 'alfa-slab-one',
    name: 'Alfa Slab One',
    googleFont: 'Alfa+Slab+One',
    fontFamily: '"Alfa Slab One", serif',
    category: 'display',
  },
  {
    id: 'bungee',
    name: 'Bungee',
    googleFont: 'Bungee',
    fontFamily: '"Bungee", cursive',
    category: 'display',
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
