export interface LanguageConfig {
  code: string;
  name: string;
  nativeName: string;
  fontFamily: string;
  fontUrl: string;
}

export const SUPPORTED_LANGUAGES: LanguageConfig[] = [
  {
    code: 'en',
    name: 'English',
    nativeName: 'English',
    fontFamily: 'Roboto',
    fontUrl: 'https://fonts.gstatic.com/s/roboto/v30/KFOmCnqEu92Fr1Me5Q.ttf',
  },
  {
    code: 'hi',
    name: 'Hindi',
    nativeName: 'हिन्दी',
    fontFamily: 'Noto Sans Devanagari',
    fontUrl:
      'https://cdn.jsdelivr.net/gh/googlefonts/noto-fonts@main/hinted/ttf/NotoSansDevanagari/NotoSansDevanagari-Regular.ttf',
  },
  {
    code: 'gu',
    name: 'Gujarati',
    nativeName: 'ગુજરાતી',
    fontFamily: 'Noto Sans Gujarati',
    fontUrl:
      'https://cdn.jsdelivr.net/gh/googlefonts/noto-fonts@main/hinted/ttf/NotoSansGujarati/NotoSansGujarati-Regular.ttf',
  },
  {
    code: 'ta',
    name: 'Tamil',
    nativeName: 'தமிழ்',
    fontFamily: 'Noto Sans Tamil',
    fontUrl:
      'https://cdn.jsdelivr.net/gh/googlefonts/noto-fonts@main/hinted/ttf/NotoSansTamil/NotoSansTamil-Regular.ttf',
  },
  {
    code: 'te',
    name: 'Telugu',
    nativeName: 'తెలుగు',
    fontFamily: 'Noto Sans Telugu',
    fontUrl:
      'https://cdn.jsdelivr.net/gh/googlefonts/noto-fonts@main/hinted/ttf/NotoSansTelugu/NotoSansTelugu-Regular.ttf',
  },
  {
    code: 'kn',
    name: 'Kannada',
    nativeName: 'ಕನ್ನಡ',
    fontFamily: 'Noto Sans Kannada',
    fontUrl:
      'https://cdn.jsdelivr.net/gh/googlefonts/noto-fonts@main/hinted/ttf/NotoSansKannada/NotoSansKannada-Regular.ttf',
  },
  {
    code: 'bn',
    name: 'Bengali',
    nativeName: 'বাংলা',
    fontFamily: 'Noto Sans Bengali',
    fontUrl:
      'https://cdn.jsdelivr.net/gh/googlefonts/noto-fonts@main/hinted/ttf/NotoSansBengali/NotoSansBengali-Regular.ttf',
  },
  {
    code: 'ml',
    name: 'Malayalam',
    nativeName: 'മലയാളം',
    fontFamily: 'Noto Sans Malayalam',
    fontUrl:
      'https://cdn.jsdelivr.net/gh/googlefonts/noto-fonts@main/hinted/ttf/NotoSansMalayalam/NotoSansMalayalam-Regular.ttf',
  },
  {
    code: 'or',
    name: 'Odia',
    nativeName: 'ଓଡ଼ିଆ',
    fontFamily: 'Noto Sans Oriya',
    fontUrl:
      'https://cdn.jsdelivr.net/gh/googlefonts/noto-fonts@main/hinted/ttf/NotoSansOriya/NotoSansOriya-Regular.ttf',
  },
];

export function getLanguageConfig(code: string): LanguageConfig {
  return SUPPORTED_LANGUAGES.find((lang) => lang.code === code) || SUPPORTED_LANGUAGES[0];
}
