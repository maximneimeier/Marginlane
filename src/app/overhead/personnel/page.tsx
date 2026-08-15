import { redirect } from "next/navigation";
import { FEATURES } from "@/lib/features";
import OverheadPageClient from "../OverheadPageClient";

type PageProps = {
  params: Promise<Record<string, never>>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function OverheadPersonnelPage({
  params,
  searchParams,
}: PageProps) {
  await Promise.all([params, searchParams]);
  if (!FEATURES.overheadTopLevelNav) {
    redirect("/overview");
  }
  return <OverheadPageClient section="personnel" />;
}
