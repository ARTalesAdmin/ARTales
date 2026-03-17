import { editions } from "./editions"
import { products } from "./products"
import { collections } from "./collections"
import { collectionLinks } from "./collectionLinks"

export function getEditionsByWorkId(workId: string) {
  return editions.filter((edition) => edition.workId === workId)
}

export function getProductsByEditionId(editionId: string) {
  return products.filter((product) => product.editionId === editionId)
}

export function getProductsByWorkId(workId: string) {
  const workEditions = getEditionsByWorkId(workId)
  const editionIds = workEditions.map((edition) => edition.id)

  return products.filter((product) => editionIds.includes(product.editionId))
}

export function getEditionsWithProductsByWorkId(workId: string) {
  const workEditions = getEditionsByWorkId(workId)

  return workEditions.map((edition) => ({
    edition,
    products: getProductsByEditionId(edition.id),
})) 
}

export function getCollectionBySlug(slug: string) {
  return collections.find((collection) => collection.slug === slug) || null
}

export function getCollectionsByWorkId(workId: string) {
  const matchedCollectionIds = collectionLinks
    .filter((link) => link.workId === workId)
    .map((link) => link.collectionId)

  return collections.filter((collection) =>
    matchedCollectionIds.includes(collection.id)
  )
}

export function getWorksByCollectionId(collectionId: string) {
  const { works } = require("@/core/works")

  const matchedWorkIds = collectionLinks
    .filter((link: any) => link.collectionId === collectionId)
    .map((link: any) => link.workId)

  return works.filter((work: any) => matchedWorkIds.includes(work.id))
}