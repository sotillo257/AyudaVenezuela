import Link from "next/link";
import AddCenterForm from "@/components/AddCenterForm";

export const metadata = { title: "Proponer un centro · Ayuda Venezuela" };

export default function AnadirPage() {
  return (
    <main className="max-w-md mx-auto min-h-screen bg-stone-50">
      <div className="bg-white border-b border-stone-200 px-5 py-3 flex items-center justify-between">
        <h1 className="font-extrabold text-[16px]">Proponer un centro</h1>
        <Link href="/" className="text-stone-400 text-sm">Cerrar</Link>
      </div>
      <AddCenterForm />
    </main>
  );
}
