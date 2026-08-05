import { redirect } from "next/navigation";

type Props = {
  searchParams: Promise<{ product?: string }>;
};

/** Convenience URL → batches list with create modal */
export default async function NewBatchRedirect({ searchParams }: Props) {
  const params = await searchParams;
  const qs = new URLSearchParams({ new: "1" });
  if (params.product) qs.set("product", params.product);
  redirect(`/batches?${qs.toString()}`);
}
