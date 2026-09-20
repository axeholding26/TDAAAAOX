import { redirect } from "next/navigation";

export default function RetoursRedirect() {
  redirect("/dashboard/logistique?tab=retours");
}
