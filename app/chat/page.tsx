'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Send, Loader2, ChevronDown, ChevronRight, Upload, X, FileText } from 'lucide-react';

// Ana bölümler verisi
const mainSections = [
  {
    letter: 'A',
    title: 'Genel Bilgiler',
    subsections: [
      { code: 'A.1.1', title: 'Girişimcinin Tanıtımı' },
      { code: 'A.1.2', title: 'İş Fikri' },
      { code: 'A.2.1', title: 'Misyon, Vizyon ve Değerler' },
      { code: 'A.2.2', title: 'Şirket Tanımı' },
    ],
  },
  {
    letter: 'B',
    title: 'Pazar ve Rekabet Analizi',
    subsections: [
      { code: 'B.1.1', title: 'Hedef Pazar' },
      { code: 'B.1.2', title: 'Pazar Büyüklüğü' },
      { code: 'B.2.1', title: 'Rekabet Analizi' },
      { code: 'B.2.2', title: 'Rekabet Avantajları' },
    ],
  },
  {
    letter: 'C',
    title: 'İş Modeli ve Operasyonlar',
    subsections: [
      { code: 'C.1.1', title: 'İş Modeli' },
      { code: 'C.1.2', title: 'Gelir Modelleri' },
      { code: 'C.2.1', title: 'Operasyonel Süreçler' },
      { code: 'C.2.2', title: 'Tedarik Zinciri' },
    ],
  },
  {
    letter: 'D',
    title: 'Pazarlama ve Satış',
    subsections: [
      { code: 'D.1.1', title: 'Pazarlama Stratejisi' },
      { code: 'D.1.2', title: 'Satış Kanalı' },
      { code: 'D.2.1', title: 'Müşteri Kazanımı' },
    ],
  },
  {
    letter: 'E',
    title: 'Finansal Planlama',
    subsections: [
      { code: 'E.1.1', title: 'Gelir Projeksiyonları' },
      { code: 'E.1.2', title: 'Maliyet Yapısı' },
      { code: 'E.2.1', title: 'Finansal İhtiyaçlar' },
    ],
  },
];

interface SectionAccordionProps {
  section: typeof mainSections[0];
  isOpen: boolean;
  onToggle: () => void;
  onSectionClick: (code: string) => void;
}

function SectionAccordion({ section, isOpen, onToggle, onSectionClick }: SectionAccordionProps) {
  return (
    <div className="border-b border-gray-200 dark:border-gray-700">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="font-semibold text-blue-600 dark:text-blue-400">{section.letter}</span>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{section.title}</span>
        </div>
        {isOpen ? (
          <ChevronDown className="w-4 h-4 text-gray-500" />
        ) : (
          <ChevronRight className="w-4 h-4 text-gray-500" />
        )}
      </button>
      {isOpen && (
        <div className="pl-4 pb-2">
          {section.subsections.map((subsection) => (
            <button
              key={subsection.code}
              onClick={() => onSectionClick(subsection.code)}
              className="w-full text-left p-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 rounded transition-colors"
            >
              <span className="text-xs text-gray-500 dark:text-gray-500 mr-2">{subsection.code}</span>
              {subsection.title}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ChatPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  
  const chat = useChat({
    transport: new DefaultChatTransport({
      api: '/api/chat',
      headers: userEmail ? () => ({
        'x-user-email': userEmail,
      }) : undefined,
    }),
  });
  
  const { messages, sendMessage, status } = chat;
  const isLoading = status === 'submitted' || status === 'streaming';

  const [input, setInput] = useState('');
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(['A']));
  const [uploadedFile, setUploadedFile] = useState<{ name: string; content: string; collectionName?: string } | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Session kontrolü ve hydration
  useEffect(() => {
    setMounted(true);
    
    // Session kontrolü
    const email = localStorage.getItem('userEmail');
    if (!email) {
      // Giriş yapılmamış, login sayfasına yönlendir
      router.push('/');
      return;
    }
    
    setUserEmail(email);
    setIsAuthorized(true);
    
    // Debug: sendMessage'ın varlığını kontrol et
    if (!sendMessage) {
      console.error('sendMessage is not available from useChat hook');
    }

    // Global error handler - browser extension hatalarını yakala
    const handleError = (event: ErrorEvent) => {
      // Browser extension hatalarını filtrele
      if (event.message && event.message.includes('message channel closed')) {
        event.preventDefault();
        console.warn('Browser extension error caught and ignored:', event.message);
        return false;
      }
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      // Browser extension hatalarını filtrele
      if (event.reason && typeof event.reason === 'string' && event.reason.includes('message channel closed')) {
        event.preventDefault();
        console.warn('Browser extension promise rejection caught and ignored:', event.reason);
        return false;
      }
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, [router, sendMessage]);

  // Client mount olana kadar veya yetkilendirme kontrolü yapılana kadar hiçbir şey render etme
  if (!mounted || !isAuthorized) {
    return null;
  }

  const toggleSection = (letter: string) => {
    const newOpenSections = new Set(openSections);
    if (newOpenSections.has(letter)) {
      newOpenSections.delete(letter);
    } else {
      newOpenSections.add(letter);
    }
    setOpenSections(newOpenSections);
  };

  const handleSectionClick = async (code: string) => {
    const question = `${code} bölümü hakkında bilgi verir misin?`;
    if (sendMessage) {
      try {
        await sendMessage({ text: question });
      } catch (error) {
        console.error('Error sending message:', error);
      }
    }
  };

  const handleEvaluateBusinessPlan = async () => {
    if (!uploadedFile) {
      alert('Lütfen önce bir iş planı dosyası yükleyin.');
      return;
    }

    if (!sendMessage) return;

    // Debug: Email kontrolü
    console.log('=== EVALUATION DEBUG ===');
    console.log('User email:', userEmail);
    console.log('Uploaded file:', uploadedFile);
    console.log('Collection name:', uploadedFile.collectionName);
    console.log('=======================');

    const evaluationPrompt = `İş planını yönerge parçalarına göre detaylı olarak değerlendir ve eksik yönlerini belirle.

Lütfen şu başlıklar altında değerlendirme yap:

1. **Genel Değerlendirme**
   - İş planının genel yapısı ve kapsamı
   - Güçlü yönler
   - Genel eksiklikler

2. **Bölüm Bazlı Analiz**
   Her bölüm için (A.1.1, A.1.2, B.1.1, vb.):
   - Bölümün mevcut olup olmadığı
   - İçeriğin yeterliliği
   - Yönergeye uygunluğu
   - Eksik unsurlar

3. **Eksik Bölümler**
   - Tamamen eksik olan bölümler
   - Kısmen eksik olan bölümler

4. **Öneriler**
   - Her eksik bölüm için öneriler
   - İyileştirme tavsiyeleri
   - Öncelik sırası

Lütfen detaylı ve yapılandırılmış bir değerlendirme raporu hazırla.`;

    try {
      await sendMessage({ text: evaluationPrompt });
    } catch (error) {
      console.error('Error evaluating business plan:', error);
      alert('Değerlendirme sırasında bir hata oluştu.');
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      // Input'u temizle
      if (event.target) {
        event.target.value = '';
      }
      return;
    }

    // Dosya boyutu kontrolü (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Dosya boyutu 5MB\'dan küçük olmalıdır.');
      if (event.target) {
        event.target.value = '';
      }
      return;
    }

    // Sadece .txt dosyalarını destekle (şimdilik)
    if (!file.name.endsWith('.txt')) {
      alert('Şu anda sadece .txt dosyaları desteklenmektedir.');
      if (event.target) {
        event.target.value = '';
      }
      return;
    }

    setIsUploading(true);

    try {
      // E-posta adresini al
      const userEmail = localStorage.getItem('userEmail');
      if (!userEmail) {
        alert('Oturum bulunamadı. Lütfen tekrar giriş yapın.');
        setIsUploading(false);
        if (event.target) {
          event.target.value = '';
        }
        return;
      }

      // Dosyayı API'ye gönder ve Qdrant'a yükle
      const formData = new FormData();
      formData.append('file', file);
      formData.append('email', userEmail);

      let response: Response;
      let data: any;

      try {
        response = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        // Response'u parse et
        try {
          data = await response.json();
        } catch (parseError) {
          const text = await response.text();
          throw new Error(`API yanıtı parse edilemedi: ${text.substring(0, 200)}`);
        }
      } catch (fetchError: any) {
        // Network hatası
        if (fetchError.name === 'TypeError' && fetchError.message.includes('fetch')) {
          throw new Error('Sunucuya bağlanılamadı. Lütfen internet bağlantınızı kontrol edin.');
        }
        throw fetchError;
      }

      if (response.ok && data) {
        // Dosya başarıyla yüklendi
        setUploadedFile({
          name: file.name,
          content: `Dosya Qdrant'a yüklendi (${data.chunksCount} chunk)`,
          collectionName: data.collectionName,
        });
        // Alert yerine console log kullan (daha az rahatsız edici)
        console.log(`Dosya başarıyla yüklendi! ${data.chunksCount} parçaya ayrıldı ve Qdrant'a kaydedildi.`);
      } else {
        throw new Error(data?.error || 'Dosya yüklenirken bir hata oluştu');
      }
    } catch (error: any) {
      console.error('Error uploading file:', error);
      // Daha kullanıcı dostu hata mesajı
      const errorMessage = error?.message || 'Dosya yüklenirken bir hata oluştu';
      alert(`Hata: ${errorMessage}`);
    } finally {
      setIsUploading(false);
      // Input'u temizle - setTimeout ile geciktir (browser extension hatalarını önlemek için)
      setTimeout(() => {
        if (event.target) {
          event.target.value = '';
        }
      }, 100);
    }
  };

  const removeUploadedFile = () => {
    setUploadedFile(null);
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      {/* Ana Chat Alanı */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
          <h1 className="text-xl font-semibold text-gray-800 dark:text-gray-100">
            İş Planı Danışmanı
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Yönerge parçalarına dayalı iş planı danışmanlığı
          </p>
        </header>

        {/* Mesajlar Alanı */}
        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="max-w-md">
                <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-200 mb-2">
                  Merhaba! 👋
                </h2>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  İş planınız hakkında sorular sorabilir veya sağdaki bölümlerden birini seçerek hızlı erişim sağlayabilirsiniz.
                </p>
                <div className="text-sm text-gray-500 dark:text-gray-500">
                  <p>Örnek sorular:</p>
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    <li>Girişimci tanıtımı bölümünde neler olmalı?</li>
                    <li>İş fikrimi nasıl değerlendirebilirim?</li>
                    <li>Pazar analizi nasıl yapılır?</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-3xl rounded-lg px-4 py-3 ${
                  message.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-700'
                }`}
              >
                <div className="text-sm font-medium mb-1 opacity-70">
                  {message.role === 'user' ? 'Siz' : 'Asistan'}
                </div>
                <div className="whitespace-pre-wrap">
                  {message.parts
                    ?.filter((part: any) => part.type === 'text')
                    .map((part: any) => part.text)
                    .join('') || ''}
                </div>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-3">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
                  <span className="text-sm text-gray-500">Yanıt hazırlanıyor...</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Input Alanı */}
        <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-4 py-4">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (input.trim() && !isLoading && sendMessage) {
                try {
                  // Dosya artık Qdrant'ta, direkt soruyu gönder
                  // API otomatik olarak kullanıcının dosyasından context alacak
                  await sendMessage({ text: input });
                  setInput('');
                } catch (error) {
                  console.error('Error sending message:', error);
                }
              }
            }}
            className="flex flex-col gap-2"
          >
            {/* Yüklenen Dosya Göstergesi */}
            {uploadedFile && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span className="text-sm text-blue-700 dark:text-blue-300 flex-1 truncate">
                    {uploadedFile.name} ({uploadedFile.content.length} karakter)
                  </span>
                  <button
                    type="button"
                    onClick={removeUploadedFile}
                    className="p-1 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded transition-colors"
                    title="Dosyayı kaldır"
                  >
                    <X className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleEvaluateBusinessPlan}
                  disabled={isLoading || isUploading}
                  className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center justify-center gap-2 text-sm font-medium"
                >
                  <FileText className="w-4 h-4" />
                  İş Planını Değerlendir
                </button>
              </div>
            )}

            <div className="flex gap-2">
              <label className="flex items-center justify-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 cursor-pointer transition-colors">
                <Upload className="w-5 h-5 mr-2" />
                <span className="hidden sm:inline">Dosya</span>
                <input
                  type="file"
                  accept=".txt"
                  onChange={handleFileUpload}
                  disabled={isLoading || isUploading}
                  className="hidden"
                />
              </label>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Sorunuzu yazın..."
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isLoading || isUploading}
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim() || isUploading}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
                <span className="hidden sm:inline">Gönder</span>
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Sidebar - Ana Bölümler */}
      <aside className="w-80 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 overflow-y-auto hidden lg:block">
        <div className="p-4">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">
            Yönerge Bölümleri
          </h2>
          <div className="space-y-0">
            {mainSections.map((section) => (
              <SectionAccordion
                key={section.letter}
                section={section}
                isOpen={openSections.has(section.letter)}
                onToggle={() => toggleSection(section.letter)}
                onSectionClick={handleSectionClick}
              />
            ))}
          </div>
        </div>
      </aside>

      {/* Mobile Sidebar Toggle - Gelecekte eklenebilir */}
    </div>
  );
}

