'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Send, Loader2, ChevronDown, ChevronRight } from 'lucide-react';

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
  
  const chat = useChat({
    transport: new DefaultChatTransport({
      api: '/api/chat',
    }),
  });
  
  const { messages, sendMessage, status } = chat;
  const isLoading = status === 'submitted' || status === 'streaming';

  const [input, setInput] = useState('');
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(['A']));

  // Session kontrolü ve hydration
  useEffect(() => {
    setMounted(true);
    
    // Session kontrolü
    const userEmail = localStorage.getItem('userEmail');
    if (!userEmail) {
      // Giriş yapılmamış, login sayfasına yönlendir
      router.push('/');
      return;
    }
    
    setIsAuthorized(true);
    
    // Debug: sendMessage'ın varlığını kontrol et
    if (!sendMessage) {
      console.error('sendMessage is not available from useChat hook');
    }
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
                  await sendMessage({ text: input });
                  setInput('');
                } catch (error) {
                  console.error('Error sending message:', error);
                }
              }
            }}
            className="flex gap-2"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Sorunuzu yazın..."
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
              <span className="hidden sm:inline">Gönder</span>
            </button>
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

