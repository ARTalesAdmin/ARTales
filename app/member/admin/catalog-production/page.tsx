import Link from "next/link"
import { notFound } from "next/navigation"
import { requireAdmin } from "@/lib/guards"
import CatalogProductionConsole from "@/components/admin/CatalogProductionConsole"

export default async function CatalogProductionPage(){
  if(process.env.VERCEL_ENV!=="preview" && process.env.NODE_ENV!=="development") notFound()
  await requireAdmin()
  return <>
    <div style={{maxWidth:1150,margin:"auto",padding:"18px 22px 0"}}>
      <Link href="/member/admin/dashboard">← Admin dashboard</Link>
    </div>
    <CatalogProductionConsole/>
  </>
}
