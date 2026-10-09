import { notFound } from "next/navigation"
import CandidatePromotionLab from "./CandidatePromotionLab"

// This lab contains only synthetic data and has no DB read/write endpoints.
// It deliberately does not exist on the live production deployment.
export default function CandidatePromotionLabPage() {
  if (process.env.VERCEL_ENV !== "preview" && process.env.NODE_ENV !== "development") {
    notFound()
  }
  return <CandidatePromotionLab />
}
