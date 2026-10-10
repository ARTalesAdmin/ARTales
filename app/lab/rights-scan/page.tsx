import { notFound } from "next/navigation"
import RightsScanLab from "./RightsScanLab"

export default function RightsScanLabPage() {
  if (process.env.VERCEL_ENV !== "preview" && process.env.NODE_ENV !== "development") notFound()
  return <RightsScanLab />
}
