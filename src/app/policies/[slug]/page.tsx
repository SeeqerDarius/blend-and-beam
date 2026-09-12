import { notFound } from "next/navigation";
import { InfoPage } from "@/components/info-page";
import { createClient } from "@/lib/supabase/server";

const fallback: Record<string, [string, string]> = {
  returns: ["Returns & refunds", "Return windows, eligible conditions, restocking rules, damaged-delivery evidence, and refund timelines require owner and legal approval before orders open."],
  privacy: ["Privacy policy", "The final policy must identify the operating legal entity, lawful processing purposes, retention periods, customer rights, processors, and contact details."],
  terms: ["Terms & conditions", "Commercial terms, governing law, warranty limits, delivery acceptance, pricing corrections, and dispute handling require owner and legal approval before launch."],
};

export default async function Policy({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: page } = await supabase.from("site_content").select("title,body").eq("slug", slug).eq("is_published", true).maybeSingle();

  if (page) {
    return (
      <InfoPage eyebrow="POLICY" title={page.title}>
        {page.body.split("\n\n").map((paragraph, i) => <p key={i}>{paragraph}</p>)}
      </InfoPage>
    );
  }

  const item = fallback[slug];
  if (!item) notFound();
  return (
    <InfoPage eyebrow="OWNER / LEGAL REVIEW REQUIRED" title={item[0]}>
      <p>{item[1]}</p>
      <p>This page is deliberately not presented as final legal advice.</p>
    </InfoPage>
  );
}
