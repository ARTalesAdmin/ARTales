import { supabase } from './supabase'

export type GalleryWorkItem = {
  id: string
  title: string
  slug: string
  subtitle: string | null
  summary: string
  canonical_language: string
  origin_type: 'public_domain' | 'original' | 'translation' | 'other'
  status: 'draft' | 'review' | 'published' | 'archived'
  author: {
    id: string
    name: string
    slug: string
  } | null
  collection: {
    id: string
    title: string
    slug: string
  } | null
}

export async function getWorksForGallery(): Promise<GalleryWorkItem[]> {
  const { data, error } = await supabase
    .from('works')
    .select(`
      id,
      title,
      slug,
      subtitle,
      summary,
      canonical_language,
      origin_type,
      status,
      authors:primary_author_id (
        id,
        name,
        slug
      ),
      collections:collection_id (
        id,
        title,
        slug
      )
    `)
    .eq('status', 'published')
    .order('published_at', { ascending: false })

  if (error) {
    console.error('DB error:', error)
    throw error
  }

  return (data ?? []).map((item: any) => ({
    id: item.id,
    title: item.title,
    slug: item.slug,
    subtitle: item.subtitle,
    summary: item.summary,
    canonical_language: item.canonical_language,
    origin_type: item.origin_type,
    status: item.status,
    author: item.authors
      ? {
          id: item.authors.id,
          name: item.authors.name,
          slug: item.authors.slug,
        }
      : null,
    collection: item.collections
      ? {
          id: item.collections.id,
          title: item.collections.title,
          slug: item.collections.slug,
        }
      : null,
  }))
}