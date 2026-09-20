export interface Language {
  code: string;       // BCP-47 tag for Speech API
  isoCode: string;    // Short code for Translation
  name: string;
  nativeName: string;
}

export const SUPPORTED_LANGUAGES: Language[] = [
  { code: 'auto', isoCode: 'auto', name: 'Auto Detect', nativeName: 'Auto Detect' },
  { code: 'en-IN', isoCode: 'en', name: 'English', nativeName: 'English' },
  { code: 'hi-IN', isoCode: 'hi', name: 'Hindi', nativeName: 'हिंदी' },
  { code: 'bn-IN', isoCode: 'bn', name: 'Bengali', nativeName: 'বাংলা' },
  { code: 'ta-IN', isoCode: 'ta', name: 'Tamil', nativeName: 'தமிழ்' },
  { code: 'te-IN', isoCode: 'te', name: 'Telugu', nativeName: 'తెలుగు' },
  { code: 'mr-IN', isoCode: 'mr', name: 'Marathi', nativeName: 'मराठी' },
  { code: 'gu-IN', isoCode: 'gu', name: 'Gujarati', nativeName: 'ગુજરાતી' },
  { code: 'kn-IN', isoCode: 'kn', name: 'Kannada', nativeName: 'ಕನ್ನಡ' },
  { code: 'ml-IN', isoCode: 'ml', name: 'Malayalam', nativeName: 'മലയാളം' },
  { code: 'pa-IN', isoCode: 'pa', name: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ' },
  { code: 'or-IN', isoCode: 'or', name: 'Odia', nativeName: 'ଓଡ଼ିଆ' },
  { code: 'as-IN', isoCode: 'as', name: 'Assamese', nativeName: 'অসমীয়া' },
  { code: 'ur-IN', isoCode: 'ur', name: 'Urdu', nativeName: 'اردو' },
  { code: 'sa-IN', isoCode: 'sa', name: 'Sanskrit', nativeName: 'संस्कृतम्' },
  { code: 'ne-NP', isoCode: 'ne', name: 'Nepali', nativeName: 'नेपाली' },
  { code: 'ks-IN', isoCode: 'ks', name: 'Kashmiri', nativeName: 'कॉशुर' },
  { code: 'sd-IN', isoCode: 'sd', name: 'Sindhi', nativeName: 'सिन्धी' },
  { code: 'doi-IN', isoCode: 'doi', name: 'Dogri', nativeName: 'डोगरी' },
  { code: 'kok-IN', isoCode: 'kok', name: 'Konkani', nativeName: 'कोंकणी' },
  { code: 'mai-IN', isoCode: 'mai', name: 'Maithili', nativeName: 'मैथिली' },
  { code: 'mni-IN', isoCode: 'mni', name: 'Manipuri', nativeName: 'मइतैलोन्' },
  { code: 'brx-IN', isoCode: 'brx', name: 'Bodo', nativeName: 'बर' },
  { code: 'sat-IN', isoCode: 'sat', name: 'Santali', nativeName: 'संथाली' }
];

export const LANGUAGE_MAP = new Map<string, Language>(
  SUPPORTED_LANGUAGES.map((l) => [l.code, l])
);

export function getLanguageByCode(code: string): Language | undefined {
  return (
    LANGUAGE_MAP.get(code) ||
    SUPPORTED_LANGUAGES.find((l) => l.isoCode === code || l.name.toLowerCase() === code.toLowerCase())
  );
}
