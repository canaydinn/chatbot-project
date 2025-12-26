'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Mail, User, LogIn } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [showRegisterForm, setShowRegisterForm] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Sayfa yüklendiğinde session kontrolü yap
    const sessionEmail = localStorage.getItem('userEmail');
    if (sessionEmail) {
      // Session varsa direkt chat sayfasına yönlendir
      console.log('Session found, redirecting to chat');
      router.push('/chat');
    } else {
      console.log('No session found, showing login form');
    }
  }, [router]);

  const handleCheckEmail = async () => {
    if (!email.trim()) {
      setError('Lütfen e-posta adresinizi girin.');
      return;
    }

    // Basit e-posta format kontrolü
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Lütfen geçerli bir e-posta adresi girin.');
      return;
    }

    setIsChecking(true);
    setError('');
    setShowRegisterForm(false); // Önce kayıt formunu kapat

    try {
      console.log('Checking email:', email);
      const response = await fetch('/api/auth/check', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });

      const data = await response.json();
      console.log('Email check response:', { 
        status: response.status, 
        ok: response.ok, 
        data 
      });

      if (response.ok) {
        // Response'un yapısını kontrol et
        if (typeof data.exists === 'boolean') {
          if (data.exists === true) {
            // E-posta kayıtlı, direkt giriş yap
            console.log('Email exists, redirecting to chat');
            localStorage.setItem('userEmail', email.trim().toLowerCase());
            localStorage.setItem('userName', data.name || '');
            router.push('/chat');
            return; // Yönlendirme yapıldı, fonksiyondan çık
          } else {
            // E-posta kayıtlı değil, kayıt formunu göster
            console.log('Email does not exist, showing register form');
            setIsChecking(false);
            setShowRegisterForm(true);
            return;
          }
        } else {
          // Beklenmeyen response formatı
          console.error('Unexpected response format - exists is not boolean:', data);
          setError('Beklenmeyen bir yanıt alındı. Lütfen tekrar deneyin.');
          setIsChecking(false);
          setShowRegisterForm(false);
        }
      } else {
        // API hatası
        const errorMessage = data.error || 'Bir hata oluştu. Lütfen tekrar deneyin.';
        const hint = data.hint ? `\n\n${data.hint}` : '';
        const details = data.details ? `\n\nDetay: ${data.details}` : '';
        setError(errorMessage + hint + details);
        setIsChecking(false);
        setShowRegisterForm(false);
      }
    } catch (err) {
      console.error('Error checking email:', err);
      setError('Bağlantı hatası. Lütfen tekrar deneyin.');
      setIsChecking(false);
      setShowRegisterForm(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!firstName.trim() || !lastName.trim() || !email.trim()) {
      setError('Lütfen tüm alanları doldurun.');
      return;
    }

    // Basit e-posta format kontrolü
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Lütfen geçerli bir e-posta adresi girin.');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim().toLowerCase(),
        }),
      });

      const data = await response.json();

      if (response.ok) {
        // Başarılı kayıt, session oluştur ve chat sayfasına yönlendir
        localStorage.setItem('userEmail', email.trim().toLowerCase());
        localStorage.setItem('userName', `${firstName.trim()} ${lastName.trim()}`);
        router.push('/chat');
      } else {
        const errorMessage = data.error || 'Kayıt sırasında bir hata oluştu. Lütfen tekrar deneyin.';
        const hint = data.hint ? `\n\n${data.hint}` : '';
        const details = data.details ? `\n\nDetay: ${data.details}` : '';
        setError(errorMessage + hint + details);
        setIsLoading(false);
      }
    } catch (err) {
      console.error('Error registering:', err);
      setError('Bağlantı hatası. Lütfen tekrar deneyin.');
      setIsLoading(false);
    }
  };

  if (!mounted) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
          {/* Logo/Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-full mb-4">
              <LogIn className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100 mb-2">
              İş Planı Danışmanı
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Devam etmek için giriş yapın
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          {/* E-posta Kontrol Formu */}
          {!isChecking && !showRegisterForm && (
            <div className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  E-posta Adresi
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ornek@email.com"
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={isLoading}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        handleCheckEmail();
                      }
                    }}
                  />
                </div>
              </div>

              <button
                onClick={handleCheckEmail}
                disabled={isLoading || !email.trim()}
                className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Kontrol ediliyor...</span>
                  </>
                ) : (
                  <span>Devam Et</span>
                )}
              </button>
            </div>
          )}

          {/* Kayıt Formu */}
          {showRegisterForm && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Ad
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      id="firstName"
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="Adınız"
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      disabled={isLoading}
                      required
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Soyad
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      id="lastName"
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Soyadınız"
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      disabled={isLoading}
                      required
                    />
                  </div>
                </div>
              </div>

              <div>
                <label htmlFor="emailForm" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  E-posta Adresi
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    id="emailForm"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ornek@email.com"
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={isLoading}
                    required
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowRegisterForm(false);
                    setFirstName('');
                    setLastName('');
                    setError('');
                  }}
                  disabled={isLoading}
                  className="flex-1 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  Geri
                </button>
                <button
                  type="submit"
                  disabled={isLoading || !firstName.trim() || !lastName.trim() || !email.trim()}
                  className="flex-1 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Kaydediliyor...</span>
                    </>
                  ) : (
                    <span>Kayıt Ol</span>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* Footer */}
          <div className="mt-6 text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Giriş yaparak{' '}
              <a href="#" className="text-blue-600 hover:underline">
                Kullanım Koşulları
              </a>
              {' '}ve{' '}
              <a href="#" className="text-blue-600 hover:underline">
                Gizlilik Politikası
              </a>
              'nı kabul etmiş olursunuz.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
