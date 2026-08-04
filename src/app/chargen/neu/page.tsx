import { redirect } from "next/navigation";

type Props = {
  searchParams: Promise<{ product?: string }>;
};

/** Alte Direkt-URL → Chargen-Liste mit Modal */
export default async function NeueChargeRedirect({ searchParams }: Props) {
  const params = await searchParams;
  const qs = new URLSearchParams({ new: "1" });
  if (params.product) qs.set("product", params.product);
  redirect(`/chargen?${qs.toString()}`);
}
