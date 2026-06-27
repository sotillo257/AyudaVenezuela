"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { STATUS, OPERADOR_LABEL, freshness } from "@/lib/util";
import type { Centro } from "@/lib/types";
import type { Session } from "@supabase/supabase-js";

type EditFormState = {
  nombre: string;
  area: string;
  direccion: string;
  contacto: string;
  fuente_url: string;
  acepta: string;
};

export default function ModerarPanel() {
  const supabase = useMemo(() => createClient(), []);
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isMod, setIsMod] = useState<boolean | null>(null);
  const [centros, setCentros] = useState<Centro[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditFormState | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  const showMsg = useCallback((text: string) => {
    setMsg(text);
    window.setTimeout(() => setMsg(null), 1800);
  }, []);

  const load = useCallback(async () => {
    const { data: mod } = await supabase.rpc("is_moderator");
    setIsMod(!!mod);
    if (!mod) return;
    const { data } = await supabase
      .from("v_centros")
      .select("*")
      .in("estado", ["pendiente", "caducado", "verificado", "cerrado"])
      .order("created_at", { ascending: false });
    setCentros((data ?? []) as Centro[]);
  }, [supabase]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    if (session) load();
  }, [session, load]);

  async function signIn() {
    setLoginError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setLoginError(error.message || "No se pudo iniciar sesión.");
  }

  async function act(fn: string, id: string, label: string) {
    const { error } = await supabase.rpc(fn, { p_centro_id: id });
    showMsg(error ? error.message : label);
    load();
  }

  function startEdit(c: Centro) {
    setEditingId(c.id);
    setEditForm({
      nombre: c.nombre,
      area: c.area ?? "",
      direccion: c.direccion ?? "",
      contacto: c.contacto ?? "",
      fuente_url: c.fuente_url ?? "",
      acepta: c.acepta.join(", "),
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditForm(null);
  }

  async function saveEdit(id: string) {
    if (!editForm) return;
    setSavingId(id);
    const payload = {
      nombre: editForm.nombre.trim(),
      area: normalizeNullable(editForm.area),
      direccion: normalizeNullable(editForm.direccion),
      contacto: normalizeNullable(editForm.contacto),
      fuente_url: normalizeNullable(editForm.fuente_url),
      acepta: parseAccepts(editForm.acepta),
    };
    const { error } = await supabase.from("centros").update(payload).eq("id", id);
    setSavingId(null);
    if (error) {
      showMsg(error.message);
      return;
    }
    cancelEdit();
    showMsg("Cambios guardados");
    load();
  }

  async function removeCenter(id: string, nombre: string) {
    if (!window.confirm(`¿Seguro que quieres eliminar "${nombre}"?`)) return;
    const { error } = await supabase.from("centros").delete().eq("id", id);
    showMsg(error ? error.message : "Centro eliminado");
    if (!error) {
      if (editingId === id) cancelEdit();
      load();
    }
  }

  const pendingCount = centros.filter((c) => c.estado === "pendiente" || c.estado === "caducado").length;

  if (!session) {
    return (
      <Wrap>
        <h2 className="text-lg font-extrabold">Acceso de moderadores</h2>
        <p className="text-stone-500 text-[13px] mt-1">Entra con el usuario y contraseña creados en Supabase.</p>
        <label className="block mt-3 text-[12px] font-bold text-stone-500" htmlFor="moderator-email">Email</label>
        <input id="moderator-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@email.com"
          className="w-full mt-1 bg-white border border-stone-200 rounded-xl px-3.5 py-2.5 text-[14px]" />
        <label className="block mt-3 text-[12px] font-bold text-stone-500" htmlFor="moderator-password">Contraseña</label>
        <input id="moderator-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••"
          className="w-full mt-1 bg-white border border-stone-200 rounded-xl px-3.5 py-2.5 text-[14px]" />
        {loginError && <p className="text-rose-600 text-[12px] mt-2">{loginError}</p>}
        <button onClick={signIn} className="w-full mt-3 bg-stone-900 text-white font-semibold py-3 rounded-xl text-[14px]">
          Entrar
        </button>
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
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold">Moderación</h2>
          <p className="text-stone-500 text-[12px] mt-1">{pendingCount} por revisar · {centros.length} en total</p>
        </div>
        <button onClick={() => supabase.auth.signOut()} className="text-stone-400 text-[12px]">Salir</button>
      </div>

      <div className="space-y-3 mt-4">
        {centros.map((c) => {
          const f = freshness(c.ultima_verificacion);
          const isEditing = editingId === c.id && editForm;
          return (
            <div key={c.id} className="bg-white border border-stone-200 rounded-2xl p-3.5">
              <span className={`inline-flex text-[10.5px] font-bold px-2 py-0.5 rounded-full ${STATUS[c.estado].pill}`}>
                {STATUS[c.estado].label}
              </span>

              {isEditing ? (
                <form
                  className="space-y-3 mt-3"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    await saveEdit(c.id);
                  }}
                >
                  <Field label="Nombre del centro">
                    <input
                      value={editForm.nombre}
                      onChange={(e) => setEditForm((prev) => prev ? { ...prev, nombre: e.target.value } : prev)}
                      className="w-full mt-1 bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-[14px]"
                    />
                  </Field>
                  <Field label="Zona o ciudad">
                    <input
                      value={editForm.area}
                      onChange={(e) => setEditForm((prev) => prev ? { ...prev, area: e.target.value } : prev)}
                      className="w-full mt-1 bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-[14px]"
                    />
                  </Field>
                  <Field label="Dirección">
                    <input
                      value={editForm.direccion}
                      onChange={(e) => setEditForm((prev) => prev ? { ...prev, direccion: e.target.value } : prev)}
                      className="w-full mt-1 bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-[14px]"
                    />
                  </Field>
                  <Field label="Contacto">
                    <input
                      value={editForm.contacto}
                      onChange={(e) => setEditForm((prev) => prev ? { ...prev, contacto: e.target.value } : prev)}
                      className="w-full mt-1 bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-[14px]"
                    />
                  </Field>
                  <Field label="Evidencia URL">
                    <input
                      value={editForm.fuente_url}
                      onChange={(e) => setEditForm((prev) => prev ? { ...prev, fuente_url: e.target.value } : prev)}
                      className="w-full mt-1 bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-[14px]"
                    />
                  </Field>
                  <Field label="Qué acepta">
                    <input
                      value={editForm.acepta}
                      onChange={(e) => setEditForm((prev) => prev ? { ...prev, acepta: e.target.value } : prev)}
                      className="w-full mt-1 bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-[14px]"
                    />
                  </Field>
                  <div className="grid grid-cols-2 gap-2">
                    <button type="submit" disabled={savingId === c.id} className="bg-stone-900 text-white text-[12.5px] font-semibold py-2 rounded-lg disabled:opacity-60">
                      {savingId === c.id ? "Guardando..." : "Guardar cambios"}
                    </button>
                    <button type="button" onClick={cancelEdit} className="bg-stone-100 text-stone-700 text-[12.5px] font-semibold py-2 rounded-lg">
                      Cancelar
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <h3 className="font-bold text-[15px] mt-1.5">{c.nombre}</h3>
                  <p className="text-[11.5px] text-stone-500">{OPERADOR_LABEL[c.operador]} · {c.area ?? "Sin zona"}</p>
                  <p className="text-[11px] text-stone-400 mt-1">{f.text} · acepta: {c.acepta.join(", ") || "—"}</p>
                  {c.fuente_url && (
                    <a href={c.fuente_url} target="_blank" rel="noreferrer" className="text-[12px] text-sky-700 underline break-all">{c.fuente_url}</a>
                  )}
                  <div className="grid grid-cols-2 gap-2 mt-3">
                    {c.estado !== "verificado" ? (
                      <button onClick={() => act("aprobar_centro", c.id, "Aprobado")} className="bg-emerald-600 text-white text-[12.5px] font-semibold py-2 rounded-lg">Aprobar</button>
                    ) : (
                      <button onClick={() => act("cerrar_centro", c.id, "Cerrado")} className="bg-stone-200 text-stone-700 text-[12.5px] font-semibold py-2 rounded-lg">Cerrar</button>
                    )}
                    <button onClick={() => startEdit(c)} className="bg-sky-50 border border-sky-200 text-sky-700 text-[12.5px] font-semibold py-2 rounded-lg">Editar</button>
                    {c.estado !== "cerrado" ? (
                      <button onClick={() => act("cerrar_centro", c.id, "Cerrado")} className="bg-stone-200 text-stone-700 text-[12.5px] font-semibold py-2 rounded-lg">Marcar cerrado</button>
                    ) : (
                      <button onClick={() => act("aprobar_centro", c.id, "Reabierto como confiable")} className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-[12.5px] font-semibold py-2 rounded-lg">Reabrir</button>
                    )}
                    <button onClick={() => removeCenter(c.id, c.nombre)} className="bg-white border border-rose-200 text-rose-600 text-[12.5px] font-semibold py-2 rounded-lg">Eliminar</button>
                  </div>
                </>
              )}
            </div>
          );
        })}
        {centros.length === 0 && <p className="text-stone-400 text-sm text-center py-10">No hay centros todavía.</p>}
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

function Field({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <label className="block text-[12px] font-bold text-stone-500">
      {label}
      {children}
    </label>
  );
}

function normalizeNullable(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function parseAccepts(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}
