/**
 * lib/languages.ts
 * All 22 Indian scheduled languages + English with metadata
 */

export interface Language {
  code: string;          // BCP-47 / ISO code
  deepgramCode: string;  // Deepgram STT language code
  name: string;          // English name
  nativeName: string;    // Name in the language itself
  script: string;        // Script/writing system
  region: string;        // Primary region in India
}

export const LANGUAGES: Language[] = [
  { code: "en",    deepgramCode: "en-IN",  name: "English",    nativeName: "English",      script: "Latin",    region: "Pan-India" },
  { code: "hi",    deepgramCode: "hi",     name: "Hindi",      nativeName: "हिन्दी",         script: "Devanagari", region: "North India" },
  { code: "bn",    deepgramCode: "bn",     name: "Bengali",    nativeName: "বাংলা",          script: "Bengali",  region: "West Bengal, Assam" },
  { code: "te",    deepgramCode: "te",     name: "Telugu",     nativeName: "తెలుగు",         script: "Telugu",   region: "Andhra Pradesh, Telangana" },
  { code: "mr",    deepgramCode: "mr",     name: "Marathi",    nativeName: "मराठी",          script: "Devanagari", region: "Maharashtra" },
  { code: "ta",    deepgramCode: "ta",     name: "Tamil",      nativeName: "தமிழ்",          script: "Tamil",    region: "Tamil Nadu" },
  { code: "ur",    deepgramCode: "hi",     name: "Urdu",       nativeName: "اردو",           script: "Nastaliq", region: "North India" },
  { code: "gu",    deepgramCode: "gu",     name: "Gujarati",   nativeName: "ગુજરાતી",       script: "Gujarati", region: "Gujarat" },
  { code: "kn",    deepgramCode: "kn",     name: "Kannada",    nativeName: "ಕನ್ನಡ",          script: "Kannada",  region: "Karnataka" },
  { code: "ml",    deepgramCode: "ml",     name: "Malayalam",  nativeName: "മലയാളം",         script: "Malayalam", region: "Kerala" },
  { code: "pa",    deepgramCode: "pa",     name: "Punjabi",    nativeName: "ਪੰਜਾਬੀ",         script: "Gurmukhi", region: "Punjab" },
  { code: "or",    deepgramCode: "hi",     name: "Odia",       nativeName: "ଓଡ଼ିଆ",          script: "Odia",     region: "Odisha" },
  { code: "as",    deepgramCode: "hi",     name: "Assamese",   nativeName: "অসমীয়া",        script: "Bengali",  region: "Assam" },
  { code: "mai",   deepgramCode: "hi",     name: "Maithili",   nativeName: "मैथिली",         script: "Devanagari", region: "Bihar, Jharkhand" },
  { code: "kok",   deepgramCode: "hi",     name: "Konkani",    nativeName: "कोंकणी",         script: "Devanagari", region: "Goa, Karnataka" },
  { code: "ne",    deepgramCode: "hi",     name: "Nepali",     nativeName: "नेपाली",         script: "Devanagari", region: "Sikkim, West Bengal" },
  { code: "sa",    deepgramCode: "hi",     name: "Sanskrit",   nativeName: "संस्कृतम्",      script: "Devanagari", region: "Pan-India" },
  { code: "sd",    deepgramCode: "hi",     name: "Sindhi",     nativeName: "سنڌي",           script: "Perso-Arabic", region: "Rajasthan, Gujarat" },
  { code: "mni",   deepgramCode: "hi",     name: "Manipuri",   nativeName: "মৈতৈলোন্",       script: "Meitei",   region: "Manipur" },
  { code: "sat",   deepgramCode: "hi",     name: "Santali",    nativeName: "ᱥᱟᱱᱛᱟᱲᱤ",      script: "Ol Chiki", region: "Jharkhand, West Bengal" },
  { code: "bodo",  deepgramCode: "hi",     name: "Bodo",       nativeName: "बड़ो",            script: "Devanagari", region: "Assam" },
  { code: "doi",   deepgramCode: "hi",     name: "Dogri",      nativeName: "डोगरी",          script: "Devanagari", region: "Jammu" },
  { code: "ks",    deepgramCode: "hi",     name: "Kashmiri",   nativeName: "کٲشُر",          script: "Nastaliq", region: "Jammu & Kashmir" },
];

export const LANGUAGE_MAP = new Map(LANGUAGES.map((l) => [l.code, l]));

/** Get language by code */
export function getLanguage(code: string): Language | undefined {
  return LANGUAGE_MAP.get(code);
}

/** Languages that Deepgram can transcribe natively */
export const DEEPGRAM_SUPPORTED = LANGUAGES.filter((l) =>
  ["en", "hi", "bn", "te", "mr", "ta", "gu", "kn", "ml", "pa"].includes(l.code)
);

/** All languages available for translation (via GPT-4o) */
export const TRANSLATION_LANGUAGES = LANGUAGES;

/** Common language pairs for quick-select */
export const POPULAR_PAIRS = [
  { from: "hi", to: "en" },
  { from: "ta", to: "en" },
  { from: "bn", to: "en" },
  { from: "mr", to: "en" },
  { from: "te", to: "en" },
  { from: "kn", to: "en" },
  { from: "ml", to: "en" },
  { from: "gu", to: "en" },
];
