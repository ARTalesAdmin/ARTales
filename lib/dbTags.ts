import { supabase } from "./supabase"
import { createClient } from "@/lib/supabase/server"
import { getTagTypeLabel, type TagType } from "@/lib/tagTypes"
import { pickLocalizedText } from "@/lib/localizedContent"
import type { SupportedLocale } from "@/lib/i18n/config"

export type TagListItem = {
  id: string
  slug: string
  label_cs: string
  label_en: string | null
  description_cs: string | null
  description_en: string | null
  type: TagType
  canonical_tag_id: string | null
  canonical_tag_label: string | null
  is_public_visible: boolean
  sort_order: number
}

export type WorkTagItem = {
  id: string
  slug: string
  type: TagType
  label_cs: string
  label_en: string | null
  label: string
}

type RawTagRow = {
  id: unknown
  slug: unknown
  label_cs: unknown
  label_en: unknown
  description_cs: unknown
  description_en: unknown
  type: unknown
  canonical_tag_id: unknown
  is_public_visible: unknown
  sort_order: unknown
  canonical_tag?: {
    label_cs?: unknown
    label_en?: unknown
  } | null
}

function mapTagRow(row: RawTagRow): TagListItem {
  const canonical = row.canonical_tag ?? null

  return {
    id: String(row.id),
    slug: String(row.slug),
    label_cs: String(row.label_cs),
    label_en: row.label_en == null ? null : String(row.label_en),
    description_cs:
      row.description_cs == null ? null : String(row.description_cs),
    description_en:
      row.description_en == null ? null : String(row.description_en),
    type: String(row.type) as TagType,
    canonical_tag_id:
      row.canonical_tag_id == null ? null : String(row.canonical_tag_id),
    canonical_tag_label:
      canonical?.label_cs == null ? null : String(canonical.label_cs),
    is_public_visible: Boolean(row.is_public_visible),
    sort_order: Number(row.sort_order ?? 100),
  }
}

export function getTagLabel(
  tag: Pick<TagListItem, "label_cs" | "label_en">,
  locale: SupportedLocale = "cs"
): string {
  return (
    pickLocalizedText(locale, {
      cs: tag.label_cs,
      en: tag.label_en,
      fallback: tag.label_cs,
    }) ?? tag.label_cs
  )
}

export async function getTagsForMember(): Promise<TagListItem[]> {
  const supabaseServer = await createClient()

  const { data, error } = await supabaseServer
    .from("tags")
    .select(`
      id,
      slug,
      label_cs,
      label_en,
      description_cs,
      description_en,
      type,
      canonical_tag_id,
      is_public_visible,
      sort_order,
      canonical_tag:canonical_tag_id (
        label_cs,
        label_en
      )
    `)
    .order("type", { ascending: true })
    .order("sort_order", { ascending: true })
    .order("label_cs", { ascending: true })

  if (error) {
    console.error("DB error in getTagsForMember:", error)
    throw new Error(`Failed to load tags: ${error.message}`)
  }

  return ((data ?? []) as RawTagRow[]).map(mapTagRow)
}

export async function getVisibleTagsForPublic(
  locale: SupportedLocale = "en"
): Promise<WorkTagItem[]> {
  const { data, error } = await supabase
    .from("tags")
    .select(`
      id,
      slug,
      label_cs,
      label_en,
      type
    `)
    .eq("is_public_visible", true)
    .order("type", { ascending: true })
    .order("sort_order", { ascending: true })
    .order("label_cs", { ascending: true })

  if (error) {
    console.error("DB error in getVisibleTagsForPublic:", error)
    throw new Error(`Failed to load visible tags: ${error.message}`)
  }

  return ((data ?? []) as RawTagRow[]).map((row) => {
    const mapped = mapTagRow(row)
    return {
      id: mapped.id,
      slug: mapped.slug,
      type: mapped.type,
      label_cs: mapped.label_cs,
      label_en: mapped.label_en,
      label: getTagLabel(mapped, locale),
    }
  })
}

export async function getTagBySlugForEdit(
  slug: string
): Promise<TagListItem | null> {
  const supabaseServer = await createClient()

  const { data, error } = await supabaseServer
    .from("tags")
    .select(`
      id,
      slug,
      label_cs,
      label_en,
      description_cs,
      description_en,
      type,
      canonical_tag_id,
      is_public_visible,
      sort_order,
      canonical_tag:canonical_tag_id (
        label_cs,
        label_en
      )
    `)
    .eq("slug", slug)
    .maybeSingle()

  if (error) {
    console.error("DB error in getTagBySlugForEdit:", error)
    throw new Error(`Failed to load tag detail: ${error.message}`)
  }

  if (!data) return null

  return mapTagRow(data as RawTagRow)
}

export function groupTagsByType(tags: TagListItem[]) {
  const groups = new Map<string, TagListItem[]>()

  tags.forEach((tag) => {
    const key = tag.type
    const current = groups.get(key) ?? []
    current.push(tag)
    groups.set(key, current)
  })

  return Array.from(groups.entries()).map(([type, items]) => ({
    type,
    label: getTagTypeLabel(type),
    items,
  }))
}
