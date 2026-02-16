import { useState, useEffect, useRef, useMemo } from 'react';
import opentype from 'opentype.js';
import { getLanguageConfig } from '../data/languages';

interface UseFontResult {
  font: opentype.Font | null;
  loading: boolean;
  error: string | null;
}

interface UseFontsResult {
  fonts: Map<string, opentype.Font>;
  loading: boolean;
}

// Global font cache to avoid re-downloading
const fontCache = new Map<string, opentype.Font>();

// Fallback font URLs for English (Roboto)
const FALLBACK_FONT_URLS = [
  'https://fonts.gstatic.com/s/roboto/v30/KFOmCnqEu92Fr1Me5Q.ttf',
  'https://cdn.jsdelivr.net/gh/nicktimko/font-roboto@master/roboto/Roboto-Regular.ttf',
];

// Helper function to load a single font
async function loadSingleFont(
  languageCode: string,
  fontUrl: string
): Promise<opentype.Font | null> {
  // Check cache first
  if (fontCache.has(fontUrl)) {
    return fontCache.get(fontUrl)!;
  }

  const loadFromUrls = async (urls: string[], index = 0): Promise<opentype.Font | null> => {
    if (index >= urls.length) {
      // All URLs failed, try fallback for non-English languages
      if (languageCode !== 'en' && FALLBACK_FONT_URLS.length > 0) {
        console.log(`All ${languageCode} font URLs failed, trying English fallback...`);
        return loadFromUrls(FALLBACK_FONT_URLS, 0);
      }
      return null;
    }

    try {
      const loadedFont = await new Promise<opentype.Font>((resolve, reject) => {
        opentype.load(urls[index], (err, font) => {
          if (err || !font) {
            reject(err || new Error('Font load failed'));
          } else {
            resolve(font);
          }
        });
      });

      // Cache the loaded font
      fontCache.set(urls[index], loadedFont);
      console.log(`Font loaded successfully for ${languageCode}`);
      return loadedFont;
    } catch {
      console.log(`Font URL ${index + 1} failed, trying next...`);
      return loadFromUrls(urls, index + 1);
    }
  };

  return loadFromUrls([fontUrl]);
}

export function useFont(languageCode: string): UseFontResult {
  const [font, setFont] = useState<opentype.Font | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadingRef = useRef<string | null>(null);

  useEffect(() => {
    const langConfig = getLanguageConfig(languageCode);
    const fontUrl = langConfig.fontUrl;

    // Prevent duplicate loads
    if (loadingRef.current === fontUrl) return;
    loadingRef.current = fontUrl;

    // Check cache first - setState is intentional as we're synchronizing with external cache
    if (fontCache.has(fontUrl)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFont(fontCache.get(fontUrl)!);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    loadSingleFont(languageCode, fontUrl).then((loadedFont) => {
      if (loadedFont) {
        setFont(loadedFont);
        setError(null);
      } else {
        setError('Failed to load font from all sources');
      }
      setLoading(false);
    });
  }, [languageCode]);

  return { font, loading, error };
}

// Hook to load multiple fonts for different languages
export function useFonts(languageCodes: string[]): UseFontsResult {
  const [fonts, setFonts] = useState<Map<string, opentype.Font>>(new Map());
  const [loading, setLoading] = useState(true);
  const loadingRef = useRef<string>('');

  // Create a stable key from language codes
  const languageKey = useMemo(() => [...languageCodes].sort().join(','), [languageCodes]);

  useEffect(() => {
    // Prevent duplicate loads for the same set of languages
    if (loadingRef.current === languageKey && fonts.size > 0) return;
    loadingRef.current = languageKey;

    const uniqueLanguages = [...new Set(languageCodes)];

    // Check if all fonts are already cached
    const allCached = uniqueLanguages.every((code) => {
      const config = getLanguageConfig(code);
      return fontCache.has(config.fontUrl);
    });

    if (allCached) {
      const cachedFonts = new Map<string, opentype.Font>();
      uniqueLanguages.forEach((code) => {
        const config = getLanguageConfig(code);
        cachedFonts.set(code, fontCache.get(config.fontUrl)!);
      });
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFonts(cachedFonts);
      setLoading(false);
      return;
    }

    setLoading(true);

    // Load all fonts in parallel
    Promise.all(
      uniqueLanguages.map(async (code) => {
        const config = getLanguageConfig(code);
        const font = await loadSingleFont(code, config.fontUrl);
        return { code, font };
      })
    ).then((results) => {
      const newFonts = new Map<string, opentype.Font>();
      results.forEach(({ code, font }) => {
        if (font) {
          newFonts.set(code, font);
        }
      });
      setFonts(newFonts);
      setLoading(false);
    });
  }, [languageKey, languageCodes, fonts.size]);

  return { fonts, loading };
}
