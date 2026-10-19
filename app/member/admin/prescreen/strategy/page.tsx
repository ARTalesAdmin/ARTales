import {notFound} from "next/navigation";
import RealPrescreenConsole from "@/components/admin/RealPrescreenConsole";
import {requirePrescreenAccess} from "@/lib/prescreen/access";
export default async function PrescreenStrategy(){
 if(process.env.VERCEL_ENV!=="preview"&&process.env.NODE_ENV!=="development")notFound();
 const access=await requirePrescreenAccess();
 return <RealPrescreenConsole fixture={access.fixture} settings/>;
}
