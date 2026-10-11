'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, LogIn, Mail } from 'lucide-react';
import { createBrowserSupabase } from '@/lib/supabase/browser';

const configured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
);

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const sendCode = async () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setError('Geçerli bir e-posta adresi girin.');
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      const supabase = createBrowserSupabase();
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
      });
      if (otpError) {
        setError(otpError.message);
        return;
      }
      setCodeSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kod gönderilemedi.');
    } finally {
      setIsLoading(false);
    }
  };

  const verifyCode = async () => {
    if (!/^\d{6}$/.test(code.trim())) {
      setError('Altı haneli kodu girin.');
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      const supabase = createBrowserSupabase();
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: code.trim(),
        type: 'email',
      });
      if (verifyError) {
        setError(verifyError.message);
        return;
      }
      router.push('/onam');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kod doğrulanamadı.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-full mb-4">
              <LogIn className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100 mb-2">
              İş Planı Danışmanı
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              E-postanıza gelen altı haneli kod ile giriş yapın
            </p>
          </div>

          {!configured && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm text-amber-800">
                E-posta kodu gönderilemiyor. Tarayıcıya açık Supabase anahtarları tanımlı değil.
              </p>
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                E-posta adresi
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  disabled={isLoading || codeSent || !configured}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                />
              </div>
            </div>

            {codeSent && (
              <div>
                <label htmlFor="code" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Altı haneli kod
                </label>
                <input
                  id="code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  disabled={isLoading}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                />
              </div>
            )}

            <button
              type="button"
              onClick={codeSent ? verifyCode : sendCode}
              disabled={isLoading || !configured}
              className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium flex items-center justify-center gap-2"
            >
              {isLoading && <Loader2 className="w-5 h-5 animate-spin" />}
              {codeSent ? 'Kodu doğrula' : 'Kod gönder'}
            </button>
          </div>

          <p className="mt-6 text-xs text-gray-500 dark:text-gray-400">
            Kodun gelmesi için Supabase sihirli bağlantı şablonunda {'{{ .Token }}'} bulunmalıdır.
            Şablon değişmezse e-posta bağlantı gönderir.
          </p>
        </div>
      </div>
    </div>
  );
}
