import { works } from "./works"
import { versions } from "./versions"
import { contributors } from "./contributors"
import { sources } from "./sources"
import { rights } from "./rights"
import { relations } from "./relations"



export function getWorkBySlug(slug: string) {
  return works.find((work) => work.slug === slug) || null
}



export function getCurrentVersion(workId: string) {
  return (
    versions.find(
      (version) => version.workId === workId && version.isCurrent
    ) || null
  )
}



export function getWorkContributors(workId: string) {
  return contributors.filter((c) => c.workId === workId)
}



export function getMainAuthor(workId: string) {
  const workContribs = getWorkContributors(workId)

  return (
    workContribs.find((c) => c.roleType === "author") || null
  )
}



export function getWorkSource(workId: string) {
  return sources.find((s) => s.workId === workId) || null
}



export function getWorkRights(workId: string) {
  return rights.find((r) => r.workId === workId) || null
}



export function getParentWork(workId: string) {
  const relation = relations.find((r) => r.childWorkId === workId)

  if (!relation) return null

  return works.find((w) => w.id === relation.parentWorkId) || null
}



export function getChildWorks(workId: string) {
  const childRelations = relations.filter(
    (r) => r.parentWorkId === workId
  )

  return childRelations
    .map((relation) =>
      works.find((w) => w.id === relation.childWorkId) || null
    )
    .filter(Boolean)
}