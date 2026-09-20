import { redirect } from "next/navigation";

export default function EntranteRedirect() {
  redirect("/dashboard/affiliation?tab=entrante");
}
