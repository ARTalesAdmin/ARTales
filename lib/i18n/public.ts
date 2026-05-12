import { defaultPublicLocale, type SupportedLocale } from "./config"
import { enCommon } from "./dictionaries/en/common"
import { enPublic } from "./dictionaries/en/public"
import { enReader } from "./dictionaries/en/reader"
import { csCommon } from "./dictionaries/cs/common"
import { csPublic } from "./dictionaries/cs/public"

const publicDictionaries = {
  en: {
    common: enCommon,
    public: enPublic,
    reader: enReader,
  },
  cs: {
    common: csCommon,
    public: {
      ...enPublic,
      ...csPublic,
    },
    reader: enReader,
  },
} as const

export function getPublicDictionary(locale: SupportedLocale = defaultPublicLocale) {
  return publicDictionaries[locale] ?? publicDictionaries[defaultPublicLocale]
}
