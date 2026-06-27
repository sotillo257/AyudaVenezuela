import { createClient } from "@/lib/supabase/server";
import { STATUS, OPERADOR_LABEL, mapsUrl, freshness } from "@/lib/util";
import type { Centro } from "@/lib/types";
import type { Metadata } from "next";
import Link from "next/link";

async function getCentro(id: string): Promise<Centro | null> {
  const supabase = createClient();
  const { data } = await supabase.from("v_centros").select("*").eq("id", id).maybeSingle();
  return (data as Centro) ?? null;
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const c = await getCentro(params.id);
  if (!c) return { title: "Centro no disponible · Ayuda Venezuela" };
  const desc = `${OPERADOR_LABEL[c.operador]} en ${c.area}. Recibe ${c.acepta.join(", ")}.` +
    (c.horario ? ` Horario: ${c.horario}.` : "");
  return {
    title: `${c.nombre} · Ayuda Venezuela`,
    description: desc,
    openGraph: { title: c.nombre, description: desc, type: "article" },
    twitter: { card: "summary", title: c.nombre, description: desc },
  };
}

export default async function CentroPage({ params }: { params: { id: string } }) {
  const c = await getCentro(params.id);

  if (!c) {
    return (
      <main className="max-w-md lg:max-w-2xl mx-auto min-h-screen bg-stone-50 p-6 flex flex-col justify-center text-center">
        <h1 className="text-xl font-extrabold lg:text-2xl">Centro no disponible</h1>
        <p className="text-stone-500 text-sm mt-2 lg:text-base">
          Puede estar en revisión o haber caducado. Solo mostramos centros verificados públicamente.
        </p>
        <Link href="/" className="mt-5 inline-block text-emerald-700 font-semibold lg:text-lg">← Ver el mapa</Link>
      </main>
    );
  }

  const f = freshness(c.ultima_verificacion);
  const s = STATUS[c.estado];

  return (
    <main className="max-w-md lg:max-w-2xl mx-auto min-h-screen bg-stone-50">
      <div className="bg-white border-b border-stone-200 px-5 py-3 lg:px-8 lg:py-4">
        <Link href="/" className="text-emerald-700 font-semibold text-sm lg:text-base">← Ayuda Venezuela</Link>
      </div>
      <div className="px-5 py-5 lg:px-8 lg:py-7">
        <span className={`inline-flex items-center text-[11px] font-bold px-2.5 py-1 rounded-full lg:text-[12px] ${s.pill}`}>
          {s.label}
        </span>
        <h1 className="text-2xl font-extrabold leading-tight mt-2 lg:text-3xl">{c.nombre}</h1>
        <p className="text-stone-500 text-[13px] mt-1 lg:text-[15px]">{OPERADOR_LABEL[c.operador]} · {c.area}</p>

        <p className="text-[12px] text-stone-500 mt-3 lg:text-[14px]">{f.text}.</p>

        {c.acepta.length > 0 && (
          <div className="mt-4">
            <p className="text-[11px] font-bold uppercase tracking-wide text-stone-400 lg:text-[12px]">Qué reciben</p>
            <div className="flex flex-wrap gap-1.5 mt-1.5 lg:gap-2">
              {c.acepta.map((a) => (
                <span key={a} className="text-[12px] bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-1 rounded-md lg:text-[13px] lg:px-3">{a}</span>
              ))}
            </div>
          </div>
        )}

        <dl className="mt-4 space-y-2.5 text-[13px] lg:text-[15px] lg:mt-6 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0">
          {c.horario && <Field label="Horario" value={c.horario} />}
          {c.proxima_salida && <Field label="Próxima salida a Venezuela" value={c.proxima_salida} />}
          {c.contacto && <Field label="Contacto" value={c.contacto} />}
          {c.fuente_url && <Field label="Fuente" value={c.fuente_url} link />}
        </dl>

        <a href={mapsUrl(c.lat, c.lon)} target="_blank" rel="noreferrer"
          className="mt-5 w-full flex items-center justify-center gap-1.5 bg-stone-900 text-white font-semibold py-3 rounded-xl text-[14px] lg:text-[15px] lg:py-3.5 lg:max-w-sm lg:mt-7">
          Cómo llegar
        </a>
      </div>
    </main>
  );
}

function Field({ label, value, link }: { label: string; value: string; link?: boolean }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wide text-stone-400 font-bold">{label}</dt>
      <dd className="text-stone-700 mt-0.5">
        {link ? <a href={value.startsWith("http") ? value : `https://${value}`} className="text-sky-700 underline break-all">{value}</a> : value}
      </dd>
    </div>
  );
}
