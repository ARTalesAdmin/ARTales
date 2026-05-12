import { defaultInternalLocale, type SupportedLocale } from "./config"
import { csCommon } from "./dictionaries/cs/common"
import { csMember } from "./dictionaries/cs/member"
import { enCommon } from "./dictionaries/en/common"

const internalDictionaries = {
  cs: {
    common: csCommon,
    member: csMember,
  },
  en: {
    common: enCommon,
    member: csMember,
  },
} as const

export function getInternalDictionary(locale: SupportedLocale = defaultInternalLocale) {
  return internalDictionaries[locale] ?? internalDictionaries[defaultInternalLocale]
}
