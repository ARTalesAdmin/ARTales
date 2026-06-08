import { defaultPublicLocale, type SupportedLocale } from "./config"
import { enCommon } from "./dictionaries/en/common"
import { enPublic } from "./dictionaries/en/public"
import { enReader } from "./dictionaries/en/reader"
import { csCommon } from "./dictionaries/cs/common"
import { csPublic } from "./dictionaries/cs/public"
import { enAccount } from "./dictionaries/en/account"
import { csAccount } from "./dictionaries/cs/account"

const publicDictionaries = {
  en: {
    common: enCommon,
    public: enPublic,
    reader: enReader,
    account: enAccount,
  },
  cs: {
    common: csCommon,
    public: {
      ...enPublic,
      ...csPublic,
    },
    reader: enReader,
    account: csAccount,
  },
} as const

export function getPublicDictionary(locale: SupportedLocale = defaultPublicLocale) {
  return publicDictionaries[locale] ?? publicDictionaries[defaultPublicLocale]
}
