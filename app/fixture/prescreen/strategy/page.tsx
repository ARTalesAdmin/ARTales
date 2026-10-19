import {notFound} from "next/navigation";
import RealPrescreenConsole from "@/components/admin/RealPrescreenConsole";
import {isPrescreenFixture} from "@/lib/prescreen/access";
export const dynamic="force-dynamic";
export default function FixtureStrategy(){
 if(process.env.VERCEL_ENV!=="preview"&&process.env.NODE_ENV!=="development")notFound();
 if(!isPrescreenFixture())notFound();
 return <RealPrescreenConsole fixture settings/>;
}
