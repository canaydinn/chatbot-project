"use client";

import { createContext, useContext, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import type { StudentSession } from "@/lib/research/access";
import { readStudentSession } from "@/lib/student/view";

type OturumState = {
  session: StudentSession | null;
  loading: boolean;
  error: string;
};

const OturumContext = createContext<OturumState>({
  session: null,
  loading: true,
  error: "",
});

export function useOturum() {
  return useContext(OturumContext);
}

export function OgrenciKabugu({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<OturumState>({
    session: null,
    loading: true,
    error: "",
  });

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/session")
      .then(async (response) => {
        if (response.status === 401) {
          router.replace("/");
          return;
        }
        const body: unknown = await response.json();
        if (!response.ok) {
          const message =
            body && typeof body === "object" && "error" in body && typeof body.error === "string"
              ? body.error
              : "Oturum okunamadı.";
          throw new Error(message);
        }
        const session = readStudentSession(body);
        if (!cancelled) setState({ session, loading: false, error: "" });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setState({
          session: null,
          loading: false,
          error: error instanceof Error ? error.message : "Oturum okunamadı.",
        });
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function signOut() {
    const supabase = createBrowserSupabase();
    await supabase.auth.signOut();
    router.replace("/");
  }

  return (
    <OturumContext.Provider value={state}>
      <div className="min-h-screen bg-stone-50 text-stone-900">
        <header className="border-b border-stone-200 bg-white">
          <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-lg font-semibold">İş planı dersi</p>
            <nav className="flex flex-wrap gap-2 text-sm">
              <Link className="rounded-lg px-3 py-2 hover:bg-stone-100" href="/ana">
                Ana sayfa
              </Link>
              <Link className="rounded-lg px-3 py-2 hover:bg-stone-100" href="/hafta">
                Haftalık form
              </Link>
              <Link className="rounded-lg px-3 py-2 hover:bg-stone-100" href="/karsilastirma">
                Sürümler
              </Link>
              <Link className="rounded-lg px-3 py-2 hover:bg-stone-100" href="/onam">
                Onam
              </Link>
              <button
                type="button"
                onClick={signOut}
                className="rounded-lg px-3 py-2 hover:bg-stone-100"
              >
                Çıkış
              </button>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-6">
          {state.loading ? (
            <p className="text-stone-600">Oturum kontrol ediliyor…</p>
          ) : state.error ? (
            <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-800">
              {state.error}
            </p>
          ) : (
            children
          )}
        </main>
      </div>
    </OturumContext.Provider>
  );
}
