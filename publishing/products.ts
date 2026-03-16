import { Product } from "./types"

export const products: Product[] = [
  {
    id: "product-dracula-pdf",
    editionId: "edition-dracula-web",
    title: "Dracula — PDF Download",
    slug: "dracula-pdf",
    productType: "digital_download",
    status: "active",
    priceCzk: 79,
    currency: "CZK",
    createdAt: "2026-03-16",
  },

  {
    id: "product-dracula-cz-pdf",
    editionId: "edition-dracula-cz-web",
    title: "Dracula — Český překlad PDF",
    slug: "dracula-cz-pdf",
    productType: "digital_download",
    status: "active",
    priceCzk: 99,
    currency: "CZK",
    createdAt: "2026-03-16",
  },

  {
    id: "product-pride-pdf",
    editionId: "edition-pride-web",
    title: "Pride and Prejudice — PDF Download",
    slug: "pride-pdf",
    productType: "digital_download",
    status: "active",
    priceCzk: 79,
    currency: "CZK",
    createdAt: "2026-03-16",
  }
]