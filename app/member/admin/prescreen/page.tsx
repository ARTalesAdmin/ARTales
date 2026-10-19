import {notFound} from "next/navigation";
import {requireAdmin} from "@/lib/guards";
import RealPrescreenConsole from "@/components/admin/RealPrescreenConsole";
export default async function PrescreenPage() {
  if(process.env.VERCEL_ENV!=="preview"&&process.env.NODE_ENV!=="development")notFound();
  await requireAdmin();
  return <RealPrescreenConsole/>;
}
