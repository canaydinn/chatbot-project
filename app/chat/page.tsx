'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Send, Loader2, Upload, X, FileText } from 'lucide-react';

// Ana bölümler verisi
const mainSections = [
  {
    letter: 'A',
    title: 'GENEL BİLGİLER',
    subsections: [
      { code: 'A.1.1', title: 'Girişimcinin Tanıtımı' },
      { code: 'A.1.2', title: 'İş Fikri' },
      { code: 'A.2.1', title: 'Misyon, Vizyon ve Değerler' },
      { code: 'A.2.2', title: 'Şirket Tanımı' },
    ],
  },
  {
    letter: 'B',
    title: 'PAZAR ANALİZİ',
    subsections: [
      { code: 'B.1.1', title: 'Hedef Pazar' },
      { code: 'B.1.2', title: 'Pazar Büyüklüğü' },
      { code: 'B.2.1', title: 'Rekabet Analizi' },
      { code: 'B.2.2', title: 'Rekabet Avantajları' },
    ],
  },
  {
    letter: 'C',
    title: 'TEKNİK ANALİZ',
    subsections: [
      { code: 'C.1.1', title: 'İş Modeli' },
      { code: 'C.1.2', title: 'Gelir Modelleri' },
      { code: 'C.2.1', title: 'Operasyonel Süreçler' },
      { code: 'C.2.2', title: 'Tedarik Zinciri' },
    ],
  },
  {
    letter: 'D',
    title: 'ORGANİZASYONEL ANALİZ',
    subsections: [
      { code: 'D.1.1', title: 'Pazarlama Stratejisi' },
      { code: 'D.1.2', title: 'Satış Kanalı' },
      { code: 'D.2.1', title: 'Müşteri Kazanımı' },
    ],
  },
  {
    letter: 'E',
    title: 'FİNANSAL ANALİZ',
    subsections: [
      { code: 'E.1.1', title: 'Gelir Projeksiyonları' },
      { code: 'E.1.2', title: 'Maliyet Yapısı' },
      { code: 'E.2.1', title: 'Finansal İhtiyaçlar' },
    ],
  },
  {
    letter: 'F',
    title: 'SONUÇ',
    subsections: [
      { code: 'F.1', title: 'Genel Değerlendirme ve Yatırımcı Özeti' },
      { code: 'F.2', title: 'SWOT Analizi (Yatırımcı Perspektifiyle)' },
    ],
  },
];

export default function ChatPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  
  // Global fetch'i override et (sadece /api/chat için)
  useEffect(() => {
    if (!userEmail) return;
    
    const originalFetch = window.fetch;
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      
      // Sadece /api/chat endpoint'i için email ekle
      if (url.includes('/api/chat')) {
        console.log('=== GLOBAL FETCH OVERRIDE ===');
        console.log('URL:', url);
        console.log('User email:', userEmail);
        
        // Email'i header'a ekle
        const headers = new Headers(init?.headers);
        headers.set('x-user-email', userEmail);
        console.log('Added email to header:', userEmail);
        
        // Body'ye email ekle
        if (init?.body) {
          try {
            const bodyStr = init.body as string;
            const body = JSON.parse(bodyStr);
            body.email = userEmail;
            init.body = JSON.stringify(body);
            console.log('Added email to body:', userEmail);
            console.log('Body after:', init.body.substring(0, 200));
          } catch (error) {
            console.warn('Could not parse body to add email:', error);
          }
        }
        
        console.log('============================');
        
        return originalFetch(input, {
          ...init,
          headers: headers,
        });
      }
      
      // Diğer request'ler için normal fetch kullan
      return originalFetch(input, init);
    };
    
    return () => {
      window.fetch = originalFetch;
    };
  }, [userEmail]);

  const chat = useChat({
    transport: new DefaultChatTransport({
      api: '/api/chat',
    }),
  });
  
  const { messages, sendMessage, status } = chat;
  const isLoading = status === 'submitted' || status === 'streaming';

  const [input, setInput] = useState('');
  const [uploadedFile, setUploadedFile] = useState<{ name: string; content: string; collectionName?: string } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [pendingScoreSectionLetter, setPendingScoreSectionLetter] = useState<string | null>(null);
  const pendingScoreSectionLetterRef = useRef<string | null>(null);
  const scoreSaveInFlightRef = useRef<boolean>(false);
  const prevIsLoadingRef = useRef<boolean>(false);

  const getMessageText = (message: any): string => {
    if (!message) return '';
    const parts = message.parts;
    if (Array.isArray(parts)) {
      return (
        parts
          .filter((part: any) => part?.type === 'text')
          .map((part: any) => part?.text || '')
          .join('') || ''
      );
    }
    if (typeof message.text === 'string') return message.text;
    return '';
  };

  const extractSectionScore = (text: string): number | null => {
    if (!text) return null;
    // Beklenen format:
    // - "Bölüm Puanı: XX/100" (tercih edilen)
    // - "Genel Puan: XX/100" (system prompt yüzünden gelebilir)
    const match = text.match(/(?:bölüm\s*puan[ıi]|genel\s*puan)\s*:\s*(\d{1,3})\s*\/\s*100/i);
    if (!match) return null;
    const score = Number.parseInt(match[1], 10);
    if (!Number.isFinite(score) || score < 0 || score > 100) return null;
    return score;
  };

  // Değerlendirme tamamlanınca puanı yakalayıp Sheet'e kaydet
  useEffect(() => {
    const wasLoading = prevIsLoadingRef.current;
    prevIsLoadingRef.current = isLoading;

    if (!wasLoading || isLoading) return;
    const sectionLetter = pendingScoreSectionLetterRef.current || pendingScoreSectionLetter;
    if (!sectionLetter || !userEmail) return;
    if (scoreSaveInFlightRef.current) return;

    const lastAssistantMessage = [...messages].reverse().find((m: any) => m?.role === 'assistant');
    const assistantText = getMessageText(lastAssistantMessage);
    const score = extractSectionScore(assistantText);

    if (score === null) {
      console.warn('Score not found in assistant response. Expected: "Bölüm Puanı: XX/100" or "Genel Puan: XX/100"');
      return;
    }

    // Sheet'e kaydet
    scoreSaveInFlightRef.current = true;
    fetch('/api/scores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: userEmail,
        sectionLetter,
        score,
      }),
    })
      .then(async (res) => {
        if (!res.ok) {
          let payload: any = null;
          try {
            payload = await res.json();
          } catch {
            payload = await res.text();
          }
          console.error('Score save failed:', res.status, payload);
        } else {
          console.log('Score saved successfully');
        }
      })
      .catch((err) => {
        console.error('Failed to save score to sheet:', err);
      })
      .finally(() => {
        scoreSaveInFlightRef.current = false;
        pendingScoreSectionLetterRef.current = null;
        setPendingScoreSectionLetter(null);
      });
  }, [isLoading, messages, pendingScoreSectionLetter, userEmail]);

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

  const handleEvaluateBusinessPlanSection = async (sectionLetter: string) => {
    if (!uploadedFile) {
      alert('Lütfen önce bir iş planı dosyası yükleyin.');
      return;
    }

    if (!sendMessage) return;

    // Bu tıklama için puan kaydını hazırlıyoruz (yanıt bitince Sheet'e yazacağız)
    setPendingScoreSectionLetter(sectionLetter);
    pendingScoreSectionLetterRef.current = sectionLetter;

    const evaluationPromptBySection: Record<string, string> = {
      A: `İş planını yönerge parçalarına göre detaylı olarak değerlendir ve eksik yönlerini belirle. 
⚠️ Bu istekte SADECE " BÖLÜM A – GENEL BİLGİLER" (A) ana bölümünü değerlendir:
 - Kapsam: A.* (A.1.1. Girişimcinin Tanıtımı
A.1.2. İş Fikri
A.2. Şirket Tanıtımı
A.2.1. Misyon, Vizyon ve Değerler
A.2.2. Şirket Tanımı
A.2.3. Sahiplik Yapısı
A.2.4. Endüstri, Konum, Tarihçe ve Mevcut Durum
A.3.Ürün/Hizmetin Genel Tanıtımı
A.3.1. Müşteriye Sağlanan Değer
A.3.2.Yenilikçi Yönler
A.3.3. Fikri Mülkiyet / Patent / Marka Durumu ve Süreci
A.4. İş Modeli
A.4.1. Gelir Modeli
A.4.2. Temel Kaynaklar / Yetkinlikler
A.5. Kuruluş ve Girişim Süreci
A.6. Hedefler) 
- Diğer ana bölümlere girmeden, sadece bu bölümün kalitesi/eksikleri/iyileştirmeleri üzerine odaklan. 

Lütfen şu başlıklar altında değerlendirme yap: 

1. **Genel Değerlendirme** 
- BÖLÜM A – GENEL BİLGİLER bölümünün genel yapısı ve kapsamı
 - Güçlü yönler 
- Genel eksiklikler 

2. **Bölüm Bazlı Analiz** 
İlgili alt bölüm kodları için (A.1.1. Girişimcinin Tanıtımı, A.1.2. İş Fikri, A.2. Şirket Tanıtımı, A.2.1. Misyon, Vizyon ve Değerler, A.2.2. Şirket Tanımı, A.2.3. Sahiplik Yapısı, A.2.4. Endüstri, Konum, Tarihçe ve Mevcut Durum, A.3.Ürün/Hizmetin Genel Tanıtımı, A.3.1. Müşteriye Sağlanan Değer, A.3.2.Yenilikçi Yönler, A.3.3. Fikri Mülkiyet / Patent / Marka Durumu ve Süreci, A.4. İş Modeli, A.4.1. Gelir Modeli, A.4.2. Temel Kaynaklar / Yetkinlikler, A.5. Kuruluş ve Girişim Süreci, A.6. Hedefler):
 - Bölümün mevcut olup olmadığı 
- İçeriğin yeterliliği 
- Yönergeye uygunluğu 
- Eksik unsurlar
- Bölümün geliştirilmesine yönelik somut öneriler (madde madde) 

3. **Eksik Bölümler** 
- Tamamen eksik olan alt bölümler (bölüm kodu ile) 
- Kısmen eksik olan alt bölümler (bölüm kodu ile) 

4. **Öneriler** 
- Her eksik/eksik kalan alt bölüm için öneriler (bölüm kodu ile) 
- İyileştirme tavsiyeleri 
- Öncelik sırası (en kritik 5 aksiyon) 
- Mevcut ama zayıf olan bölümler için geliştirme önerileri (bölüm kodu ile) 

Lütfen detaylı ve yapılandırılmış bir değerlendirme raporu hazırla.`,
      B: `İş planını yönerge parçalarına göre detaylı olarak değerlendir ve eksik yönlerini belirle. 
⚠️ Bu istekte SADECE " BÖLÜM B – PAZAR ANALİZİ" (B) ana bölümünü değerlendir:
 - Kapsam: B.* (B.1. Sektör Analizi, B.1.1. Pazar Büyüklüğü, B.1.2. Pazarın Gelişim Potansiyeli ve Trendleri, B.2. Rekabet Analizi, B.2.1. Doğrudan ve Dolaylı Rakipler, B.2.2. Rakiplerin Güçlü ve Zayıf Yönleri, B.2.3. Pazara Giriş Engelleri, B.3. Müşteri Analizi, B.3.1. Müşteri Doğrulama, B.3.2. Müşteri Segmentasyonu, B.3.3. Müşteri Profilleri, B.4. Pazarlama & Satış Stratejileri, B.4.1. Konumlandırma, B.4.2. Fiyatlandırma, B.4.3. Dağıtım Kanalları, B.4.4. Reklam ve Proomosyon, B.4.5. Satış Sonrası Hizmetler, B.4.6. Satış Projeksiyonları) 
- Diğer ana bölümlere girmeden, sadece bu bölümün kalitesi/eksikleri/iyileştirmeleri üzerine odaklan. 

Lütfen şu başlıklar altında değerlendirme yap: 

1. **Genel Değerlendirme** 
- BÖLÜM B – PAZAR ANALİZİ bölümünün genel yapısı ve kapsamı
 - Güçlü yönler 
- Genel eksiklikler 

2. **Bölüm Bazlı Analiz** 
İlgili alt bölüm kodları için (B.1. Sektör Analizi, B.1.1. Pazar Büyüklüğü, B.1.2. Pazarın Gelişim Potansiyeli ve Trendleri, B.2. Rekabet Analizi, B.2.1. Doğrudan ve Dolaylı Rakipler, B.2.2. Rakiplerin Güçlü ve Zayıf Yönleri, B.2.3. Pazara Giriş Engelleri, B.3. Müşteri Analizi, B.3.1. Müşteri Doğrulama, B.3.2. Müşteri Segmentasyonu, B.3.3. Müşteri Profilleri, B.4. Pazarlama & Satış Stratejileri, B.4.1. Konumlandırma, B.4.2. Fiyatlandırma, B.4.3. Dağıtım Kanalları, B.4.4. Reklam ve Proomosyon, B.4.5. Satış Sonrası Hizmetler, B.4.6. Satış Projeksiyonları):
 - Bölümün mevcut olup olmadığı 
- İçeriğin yeterliliği 
- Yönergeye uygunluğu 
- Eksik unsurlar
- Bölümün geliştirilmesine yönelik somut öneriler (madde madde) 

3. **Eksik Bölümler** 
- Tamamen eksik olan alt bölümler (bölüm kodu ile) 
- Kısmen eksik olan alt bölümler (bölüm kodu ile) 

4. **Öneriler** 
- Her eksik/eksik kalan alt bölüm için öneriler (bölüm kodu ile) 
- İyileştirme tavsiyeleri 
- Öncelik sırası (en kritik 5 aksiyon) 
- Mevcut ama zayıf olan bölümler için geliştirme önerileri (bölüm kodu ile) 

Lütfen detaylı ve yapılandırılmış bir değerlendirme raporu hazırla.`,
      C: ` İş planını yönerge parçalarına göre detaylı olarak değerlendir ve eksik yönlerini belirle. 
⚠️ Bu istekte SADECE " C. TEKNİK ANALİZ" (C) ana bölümünü değerlendir:
- Kapsam: C.* (C.1. Ürün / Hizmetin Teknik Tanımı, C.1.1. Teknik Özellikler, C.1.2. Teknolojik Üstünlükler, C.1.3. Ürün Yaşam Döngüsü, C.1.4. Prototip Durumu / TRL Seviyesi, C.2. Üretim ve Operasyon, C.2.1. Üretim Süreci ve Kapasitesi , C.2.2. Tedarikçiler, C.2.3. Makine, Hammadde vb. Kaynakların Seçimi, C.2.4. İş Akış Şeması, C.2.5. Kalite Güvence Sistemleri, C.2.6. Çevresel Etki, C.3. Kuruluş Yeri Seçimi, C.4. Ar-Ge ve Geliştirme Planı, C.4.1. Milestones, C.4.2. Gelecek Geliştirmeler, C.4.3. Ar-Ge Kaynak Planı, C.4.4.  Riskler ve Alternatif Teknik Çözümler)
- Diğer ana bölümlere girmeden, sadece bu bölümün kalitesi/eksikleri/iyileştirmeleri üzerine odaklan. 

Lütfen şu başlıklar altında değerlendirme yap: 

1. *Genel Değerlendirme* 
- C. TEKNİK ANALİZ bölümünün genel yapısı ve kapsamı
 - Güçlü yönler 
- Genel eksiklikler 

2. *Bölüm Bazlı Analiz* 
İlgili alt bölüm kodları için (C.1. Ürün / Hizmetin Teknik Tanımı, C.1.1. Teknik Özellikler, C.1.2. Teknolojik Üstünlükler, C.1.3. Ürün Yaşam Döngüsü, C.1.4. Prototip Durumu / TRL Seviyesi, C.2. Üretim ve Operasyon, C.2.1. Üretim Süreci ve Kapasitesi , C.2.2. Tedarikçiler, C.2.3. Makine, Hammadde vb. Kaynakların Seçimi, C.2.4. İş Akış Şeması, C.2.5. Kalite Güvence Sistemleri, C.2.6. Çevresel Etki, C.3. Kuruluş Yeri Seçimi, C.4. Ar-Ge ve Geliştirme Planı, C.4.1. Milestones, C.4.2. Gelecek Geliştirmeler, C.4.3. Ar-Ge Kaynak Planı, C.4.4.  Riskler ve Alternatif Teknik Çözümler):
 - Bölümün mevcut olup olmadığı 
- İçeriğin yeterliliği 
- Yönergeye uygunluğu 
- Eksik unsurlar
- Bölümün geliştirilmesine yönelik somut öneriler (madde madde) 

3. *Eksik Bölümler* 
- Tamamen eksik olan alt bölümler (bölüm kodu ile) 
- Kısmen eksik olan alt bölümler (bölüm kodu ile) 

4. *Öneriler* 
- Her eksik/eksik kalan alt bölüm için öneriler (bölüm kodu ile) 
- İyileştirme tavsiyeleri 
- Öncelik sırası (en kritik 5 aksiyon) 
- Mevcut ama zayıf olan bölümler için geliştirme önerileri (bölüm kodu ile) 

Lütfen detaylı ve yapılandırılmış bir değerlendirme raporu hazırla.`,
      D: `İş planını yönerge parçalarına göre detaylı olarak değerlendir ve eksik yönlerini belirle. 
⚠️ Bu istekte SADECE " D. ORGANİZASYONEL ANALİZ" (D) ana bölümünü değerlendir:
- Kapsam: D.* (D.1. Organizasyon Yapısı, D.1.1. Örgüt Şeması, D.1.2. İş Tanımı ve İş Şartnameleri, D.2. İnsan Kaynakları Planı, D.2.1. Personel İhtiyacı, D.2.2. Eğitim ve İşe Alım Stratejileri, D.3. İşgücü Maliyetleri)
- Diğer ana bölümlere girmeden, sadece bu bölümün kalitesi/eksikleri/iyileştirmeleri üzerine odaklan. 

Lütfen şu başlıklar altında değerlendirme yap: 

1. *Genel Değerlendirme* 
- D. ORGANİZASYONEL ANALİZ bölümünün genel yapısı ve kapsamı
 - Güçlü yönler 
- Genel eksiklikler 

2. *Bölüm Bazlı Analiz* 
İlgili alt bölüm kodları için (D.1. Organizasyon Yapısı, D.1.1. Örgüt Şeması, D.1.2. İş Tanımı ve İş Şartnameleri, D.2. İnsan Kaynakları Planı, D.2.1. Personel İhtiyacı, D.2.2. Eğitim ve İşe Alım Stratejileri, D.3. İşgücü Maliyetleri):
 - Bölümün mevcut olup olmadığı 
- İçeriğin yeterliliği 
- Yönergeye uygunluğu 
- Eksik unsurlar
- Bölümün geliştirilmesine yönelik somut öneriler (madde madde) 

3. *Eksik Bölümler* 
- Tamamen eksik olan alt bölümler (bölüm kodu ile) 
- Kısmen eksik olan alt bölümler (bölüm kodu ile) 

4. *Öneriler* 
- Her eksik/eksik kalan alt bölüm için öneriler (bölüm kodu ile) 
- İyileştirme tavsiyeleri 
- Öncelik sırası (en kritik 5 aksiyon) 
- Mevcut ama zayıf olan bölümler için geliştirme önerileri (bölüm kodu ile) 

Lütfen detaylı ve yapılandırılmış bir değerlendirme raporu hazırla.`,
      E: `İş planını yönerge parçalarına göre detaylı olarak değerlendir ve eksik yönlerini belirle. 
⚠️ Bu istekte SADECE " E. FİNANSAL ANALİZ " (E) ana bölümünü değerlendir:
- Kapsam: E.* (E.1. Temel Finansal Varsayımlar ve Birim Ekonomi, E.2. Birim Ekonomi Göstergeleri, E.3. Gelirler, E.4. Giderler Analizi, E.4.1. Kuruluş Sermayesi, E.4.2. İşletme Sermayesini Oluşturan Temel Kalemler, E.5. Başa Baş Noktası Analizi, E.6. Gelir-Gider Tablosu, E.7. Karlılık Analizi, E.8. Toplam Sermaye İhtiyacı ve Finansman Kaynakları, E.9. Finansal Riskler ve Duyarlılık Analizi)
- Diğer ana bölümlere girmeden, sadece bu bölümün kalitesi/eksikleri/iyileştirmeleri üzerine odaklan. 

Lütfen şu başlıklar altında değerlendirme yap: 

1. *Genel Değerlendirme* 
- E. FİNANSAL ANALİZ bölümünün genel yapısı ve kapsamı
 - Güçlü yönler 
- Genel eksiklikler 

2. *Bölüm Bazlı Analiz* 
İlgili alt bölüm kodları için (E.1. Temel Finansal Varsayımlar ve Birim Ekonomi, E.2. Birim Ekonomi Göstergeleri, E.3. Gelirler, E.4. Giderler Analizi, E.4.1. Kuruluş Sermayesi, E.4.2. İşletme Sermayesini Oluşturan Temel Kalemler, E.5. Başa Baş Noktası Analizi, E.6. Gelir-Gider Tablosu, E.7. Karlılık Analizi, E.8. Toplam Sermaye İhtiyacı ve Finansman Kaynakları, E.9. Finansal Riskler ve Duyarlılık Analizi):
 - Bölümün mevcut olup olmadığı 
- İçeriğin yeterliliği 
- Yönergeye uygunluğu 
- Eksik unsurlar
- Bölümün geliştirilmesine yönelik somut öneriler (madde madde) 

3. *Eksik Bölümler* 
- Tamamen eksik olan alt bölümler (bölüm kodu ile) 
- Kısmen eksik olan alt bölümler (bölüm kodu ile) 

4. *Öneriler* 
- Her eksik/eksik kalan alt bölüm için öneriler (bölüm kodu ile) 
- İyileştirme tavsiyeleri 
- Öncelik sırası (en kritik 5 aksiyon) 
- Mevcut ama zayıf olan bölümler için geliştirme önerileri (bölüm kodu ile) 

Lütfen detaylı ve yapılandırılmış bir değerlendirme raporu hazırla.`,
      F: `İş planını yönerge parçalarına göre detaylı olarak değerlendir ve eksik yönlerini belirle. 
⚠️ Bu istekte SADECE " F. SONUÇ" (F) ana bölümünü değerlendir:
 - Kapsam: F.* (F.1.Genel Değerlendirme ve Yatırımcı Özeti, F.2. SWOT Analizi (Yatırımcı Perspektifiyle))
- Diğer ana bölümlere girmeden, sadece bu bölümün kalitesi/eksikleri/iyileştirmeleri üzerine odaklan. 

Lütfen şu başlıklar altında değerlendirme yap: 

1. *Genel Değerlendirme* 
- F. SONUÇ bölümünün genel yapısı ve kapsamı
 - Güçlü yönler 
- Genel eksiklikler 

2. *Bölüm Bazlı Analiz* 
İlgili alt bölüm kodları için (F.1.Genel Değerlendirme ve Yatırımcı Özeti, F.2. SWOT Analizi (Yatırımcı Perspektifiyle)):
 - Bölümün mevcut olup olmadığı 
- İçeriğin yeterliliği 
- Yönergeye uygunluğu 
- Eksik unsurlar
- Bölümün geliştirilmesine yönelik somut öneriler (madde madde) 

3. *Eksik Bölümler* 
- Tamamen eksik olan alt bölümler (bölüm kodu ile) 
- Kısmen eksik olan alt bölümler (bölüm kodu ile) 

4. *Öneriler* 
- Her eksik/eksik kalan alt bölüm için öneriler (bölüm kodu ile) 
- İyileştirme tavsiyeleri 
- Öncelik sırası (en kritik 5 aksiyon) 
- Mevcut ama zayıf olan bölümler için geliştirme önerileri (bölüm kodu ile) 

Lütfen detaylı ve yapılandırılmış bir değerlendirme raporu hazırla.`,
    };

    // Debug: Email kontrolü
    console.log('=== EVALUATION DEBUG ===');
    console.log('User email:', userEmail);
    console.log('Uploaded file:', uploadedFile);
    console.log('Collection name:', uploadedFile.collectionName);
    console.log('Section letter:', sectionLetter);
    console.log('=======================');

    const basePrompt = evaluationPromptBySection[sectionLetter] || evaluationPromptBySection.A;
    const evaluationPrompt =
      basePrompt +
      `\n\n5. *Puan (0-100)*\n- Bu bölüm için 0-100 arası tam sayı puan ver.\n- Raporun EN SONUNA tek satır olarak "Bölüm Puanı: XX/100" ekle (XX 0-100 arası tam sayı).`;

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

    // Desteklenen dosya türleri: .txt, .pdf, .docx
    const fileName = file.name.toLowerCase();
    const isSupported =
      fileName.endsWith('.txt') || fileName.endsWith('.pdf') || fileName.endsWith('.docx');
    if (!isSupported) {
      alert('Şu anda sadece .txt, .pdf ve .docx dosyaları desteklenmektedir.');
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
        } catch {
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
        alert(`Dosya başarıyla yüklendi! ${data.chunksCount} parçaya ayrıldı ve Qdrant'a kaydedildi.`);
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
                  İş planınız hakkında sorular sorabilir veya aşağıdaki bölüm değerlendirme butonlarını kullanabilirsiniz.
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
                <div className="flex gap-2">
                  {mainSections.map((section) => (
                    <button
                      key={section.letter}
                      type="button"
                      onClick={() => handleEvaluateBusinessPlanSection(section.letter)}
                      disabled={isLoading || isUploading}
                      className="flex-1 px-2 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors text-xs font-medium"
                      title={`${section.title} bölümünü değerlendir`}
                    >
                      {section.title}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <label className="flex items-center justify-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 cursor-pointer transition-colors">
                {isUploading ? (
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                ) : (
                  <Upload className="w-5 h-5 mr-2" />
                )}
                <span className="hidden sm:inline">{isUploading ? 'Yükleniyor...' : 'Dosya'}</span>
                <input
                  type="file"
                  accept=".txt,.pdf,.docx"
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
    </div>
  );
}

