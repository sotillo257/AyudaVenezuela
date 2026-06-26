"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { STATUS, OPERADOR_LABEL, freshness } from "@/lib/util";
import type { Centro } from "@/lib/types";
import type { Session } from "@supabase/supabase-js";

export default function ModerarPanel() {
  const supabase = useMemo(() => createClient(), []);
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [isMod, setIsMod] = useState<boolean | null>(null);
  const [centros, setCentros] = useState<Centro[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data: mod } = await supabase.rpc("is_moderator");
    setIsMod(!!mod);
    if (!mod) return;
    const { data } = await supabase
      .from("v_centros")
      .select("*")
      .in("estado", ["pendiente", "caducado"])
      .order("created_at", { ascending: false });
    setCentros((data ?? []) as Centro[]);
  }, [supabase]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => { if (session) load(); }, [session, load]);

  async function signIn() {
    const { error } = await supabase.auth.signInWithOtp({ email });
    if (!error) setSent(true);
  }

  async function act(fn: string, id: string, label: string) {
    const { error } = await supabase.rpc(fn, { p_centro_id: id });
    setMsg(error ? error.message : label);
    setTimeout(() => setMsg(null), 1800);
    load();
  }

  if (!session) {
    return (
      <Wrap>
        <h2 className="text-lg font-extrabold">Acceso de moderadores</h2>
        {sent ? (
          <p className="text-stone-600 text-sm mt-3">Te enviamos un enlace de acceso a <b>{email}</b>. Ábrelo en este dispositivo.</p>
        ) : (
          <>
            <p className="text-stone-500 text-[13px] mt-1">Te enviaremos un enlace mágico para entrar.</p>
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@email.com"
              className="w-full mt-3 bg-white border border-stone-200 rounded-xl px-3.5 py-2.5 text-[14px]" />
            <button onClick={signIn} className="w-full mt-2 bg-stone-900 text-white font-semibold py-3 rounded-xl text-[14px]">
              Enviar enlace
            </button>
          </>
        )}
      </Wrap>
    );
  }

  if (isMod === false) {
    return (
      <Wrap>
        <h2 className="text-lg font-extrabold">Sin permisos de moderador</h2>
        <p className="text-stone-500 text-[13px] mt-2">
          Tu cuenta ({session.user.email}) no está en la tabla <code>moderadores</code>. Añádela desde Supabase para moderar.
        </p>
        <button onClick={() => supabase.auth.signOut()} className="mt-4 text-rose-600 text-sm font-semibold">Cerrar sesión</button>
      </Wrap>
    );
  }

  return (
    <Wrap>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-extrabold">Moderación</h2>
        <button onClick={() => supabase.auth.signOut()} className="text-stone-400 text-[12px]">Salir</button>
      </div>
      <p className="text-stone-500 text-[12px] mt-1">{centros.length} pendientes / caducados</p>

      <div className="space-y-3 mt-4">
        {centros.map((c) => {
          const f = freshness(c.ultima_verificacion);
          return (
            <div key={c.id} className="bg-white border border-stone-200 rounded-2xl p-3.5">
              <span className={`inline-flex text-[10.5px] font-bold px-2 py-0.5 rounded-full ${STATUS[c.estado].pill}`}>
                {STATUS[c.estado].label}
              </span>
              <h3 className="font-bold text-[15px] mt-1.5">{c.nombre}</h3>
              <p className="text-[11.5px] text-stone-500">{OPERADOR_LABEL[c.operador]} · {c.area}</p>
              <p className="text-[11px] text-stone-400 mt-1">{f.text} · acepta: {c.acepta.join(", ") || "—"}</p>
              {c.fuente_url && (
                <a href={c.fuente_url} target="_blank" rel="noreferrer" className="text-[12px] text-sky-700 underline break-all">{c.fuente_url}</a>
              )}
              <div className="grid grid-cols-3 gap-2 mt-3">
                <button onClick={() => act("aprobar_centro", c.id, "Aprobado")} className="bg-emerald-600 text-white text-[12.5px] font-semibold py-2 rounded-lg">Aprobar</button>
                <button onClick={() => act("cerrar_centro", c.id, "Cerrado")} className="bg-stone-200 text-stone-700 text-[12.5px] font-semibold py-2 rounded-lg">Cerrar</button>
                <button onClick={() => act("rechazar_centro", c.id, "Rechazado")} className="bg-white border border-rose-200 text-rose-600 text-[12.5px] font-semibold py-2 rounded-lg">Rechazar</button>
              </div>
            </div>
          );
        })}
        {centros.length === 0 && <p className="text-stone-400 text-sm text-center py-10">Nada pendiente. Buen trabajo.</p>}
      </div>

      {msg && <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-stone-900 text-white text-[12.5px] px-4 py-2 rounded-full">{msg}</div>}
    </Wrap>
  );
}

function Wrap({ children }: { children: React.ReactNode }) {
  return (
    <main className="max-w-md mx-auto min-h-screen bg-stone-50">
      <div className="bg-white border-b border-stone-200 px-5 py-3 flex items-center justify-between">
        <h1 className="font-extrabold text-[16px]">Ayuda Venezuela · Moderar</h1>
        <Link href="/" className="text-stone-400 text-sm">Mapa</Link>
      </div>
      <div className="px-5 py-5">{children}</div>
    </main>
  );
}
