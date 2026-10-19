import {notFound} from "next/navigation";
import {requirePrescreenAccess} from "@/lib/prescreen/access";
import RealPrescreenConsole from "@/components/admin/RealPrescreenConsole";
export default async function PrescreenPage() {
  if(process.env.VERCEL_ENV!=="preview"&&process.env.NODE_ENV!=="development")notFound();
  const access=await requirePrescreenAccess();
  return <RealPrescreenConsole fixture={access.fixture}/>;
}
