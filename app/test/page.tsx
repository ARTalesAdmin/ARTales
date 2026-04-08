import { getWorksForGallery } from '@/lib/dbWorks'

export default async function TestPage() {
  const works = await getWorksForGallery()

  return (
    <pre>
      {JSON.stringify(works, null, 2)}
    </pre>
  )
}