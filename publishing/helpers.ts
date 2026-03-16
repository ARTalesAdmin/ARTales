import { editions } from "./editions"
import { products } from "./products"

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