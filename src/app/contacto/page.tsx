"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Heart, Send } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function ContactoPage() {
  const supabase = useMemo(() => createClient(), []);
  const [form, setForm] = useState({ nombre: "", email: "", asunto: "", mensaje: "" });
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setError(null);

    const { error: err } = await supabase.from("contactos").insert({
      nombre: form.nombre.trim(),
      email: form.email.trim(),
      asunto: form.asunto,
      mensaje: form.mensaje.trim(),
    });

    setSending(false);
    if (err) {
      setError("No se pudo enviar. Intenta de nuevo.");
      return;
    }
    setDone(true);
  }

  const inputCls = "w-full rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 text-[14px] text-stone-800 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100";

  if (done) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-stone-50 px-5">
        <div className="max-w-sm text-center">
          <Heart size={40} className="mx-auto fill-emerald-600 text-emerald-600" />
          <h2 className="mt-4 text-xl font-extrabold">¡Mensaje enviado!</h2>
          <p className="mt-2 text-sm text-stone-500">Gracias por escribirnos. Te responderemos lo antes posible.</p>
          <Link href="/" className="mt-5 inline-block rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white">
            Volver al inicio
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-md bg-stone-50 lg:max-w-3xl">
      <div className="flex items-center justify-between border-b border-stone-200 bg-white px-5 py-3 lg:px-8 lg:py-4">
        <h1 className="text-[16px] font-extrabold lg:text-[20px]">Contacto</h1>
        <Link href="/" className="text-sm text-stone-400 lg:text-base">Cerrar</Link>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 px-5 py-6 lg:px-8">
        <p className="text-[13px] leading-relaxed text-stone-500">
          ¿Tienes dudas, sugerencias o quieres colaborar con Acopios Venezuela? Escríbenos.
        </p>

        <div>
          <label className="mb-1 block text-[12px] font-semibold uppercase tracking-wide text-stone-500">Nombre</label>
          <input type="text" required value={form.nombre} onChange={set("nombre")} className={inputCls} placeholder="Tu nombre" />
        </div>

        <div>
          <label className="mb-1 block text-[12px] font-semibold uppercase tracking-wide text-stone-500">Correo electrónico</label>
          <input type="email" required value={form.email} onChange={set("email")} className={inputCls} placeholder="tu@email.com" />
        </div>

        <div>
          <label className="mb-1 block text-[12px] font-semibold uppercase tracking-wide text-stone-500">Asunto</label>
          <select required value={form.asunto} onChange={set("asunto")} className={inputCls}>
            <option value="">Selecciona un asunto</option>
            <option value="Colaborar">Quiero colaborar</option>
            <option value="Sugerencia">Sugerencia</option>
            <option value="Problema">Reportar un problema</option>
            <option value="Prensa">Prensa / Medios</option>
            <option value="Otro">Otro</option>
          </select>
        </div>

        <div>
          <label className="mb-1 block text-[12px] font-semibold uppercase tracking-wide text-stone-500">Mensaje</label>
          <textarea required rows={5} value={form.mensaje} onChange={set("mensaje")} className={inputCls} placeholder="Escribe tu mensaje aquí…" />
        </div>

        {error && <p className="text-[13px] text-rose-600">{error}</p>}

        <button
          type="submit"
          disabled={sending}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-[14px] font-semibold text-white disabled:opacity-50"
        >
          <Send size={15} /> {sending ? "Enviando…" : "Enviar mensaje"}
        </button>
      </form>
    </main>
  );
}
