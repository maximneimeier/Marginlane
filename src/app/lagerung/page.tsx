import { redirect } from "next/navigation";

/** Legacy German route → English root */
export default function LagerungRedirect() {
  redirect("/inventory");
}
