import Link from "next/link";
import AddCenterForm from "@/components/AddCenterForm";

export const metadata = { title: "Proponer un centro · Ayuda Venezuela" };

export default function AnadirPage() {
  return (
    <main className="max-w-md lg:max-w-3xl mx-auto min-h-screen bg-stone-50">
      <div className="bg-white border-b border-stone-200 px-5 py-3 lg:px-8 lg:py-4 flex items-center justify-between">
        <h1 className="font-extrabold text-[16px] lg:text-[20px]">Proponer un centro</h1>
        <Link href="/" className="text-stone-400 text-sm lg:text-base">Cerrar</Link>
      </div>
      <AddCenterForm />
    </main>
  );
}
