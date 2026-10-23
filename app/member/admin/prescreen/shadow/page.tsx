import {requireAdmin} from "@/lib/guards";
import ShadowLibraryAdmin from "@/components/admin/ShadowLibraryAdmin";
export default async function ShadowLibraryPage(){
 await requireAdmin();
 return <ShadowLibraryAdmin/>;
}
