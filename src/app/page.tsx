import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/AppShell";
import type { Centro } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("v_centros")
    .select("*")
    .eq("estado", "verificado")
    .order("created_at", { ascending: false });

  const centros = (data ?? []) as Centro[];

  return <AppShell initialCentros={centros} loadError={!!error} />;
}
