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

const sectionDescriptions: Record<string, string> = {
  A: 'Genel bilgiler bölümünde girişimci profili, iş fikri, şirket yapısı, misyon-vizyon ve hedeflerin yönergeye uygunluğu değerlendirilir.',
  B: 'Pazar analizi bölümünde hedef pazar, rekabet, müşteri segmentleri, pazarlama stratejileri ve satış projeksiyonları incelenir.',
  C: 'Teknik analiz bölümünde ürün/hizmetin teknik yeterliliği, operasyon süreçleri, Ar-Ge planı ve teknik riskler değerlendirilir.',
  D: 'Organizasyonel analiz bölümünde ekip yapısı, rol dağılımı, insan kaynakları planı ve iş gücü maliyetleri ele alınır.',
  E: 'Finansal analiz bölümünde gelir-gider yapısı, birim ekonomi, karlılık, finansman ihtiyacı ve finansal riskler ölçülür.',
  F: 'Sonuç bölümünde genel yatırımcı özeti, iş planının bütünsel kalitesi ve SWOT perspektifiyle nihai değerlendirme yapılır.',
};

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
  
  const { messages, setMessages, sendMessage, status } = chat;
  const isLoading = status === 'submitted' || status === 'streaming';

  const [input, setInput] = useState('');
  const [uploadedFile, setUploadedFile] = useState<{ name: string; content: string; collectionName?: string } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [pendingScoreSectionLetter, setPendingScoreSectionLetter] = useState<string | null>(null);
  const pendingScoreSectionLetterRef = useRef<string | null>(null);
  const [latestSectionInfo, setLatestSectionInfo] = useState<{
    letter: string;
    title: string;
    description: string;
    score: number | null;
  } | null>(null);
  const [sectionScoreHistory, setSectionScoreHistory] = useState<Record<string, number[]>>({});
  const scoreSaveInFlightRef = useRef<boolean>(false);
  const lastProcessedMsgIdRef = useRef<string | null>(null);

  const getMessageText = (message: any): string => {
    if (!message) return '';
    const chunks: string[] = [];

    const parts = message.parts;
    if (Array.isArray(parts)) {
      for (const part of parts) {
        // SDK sürümüne göre type/text alanı değişebildiği için daha toleranslı okuyoruz.
        if (!part) continue;
        if (typeof part?.text === 'string') chunks.push(part.text);
        if (typeof part?.content === 'string') chunks.push(part.content);
        if (typeof part?.value === 'string') chunks.push(part.value);
      }
    }
    if (typeof message.text === 'string') chunks.push(message.text);
    if (typeof message.content === 'string') chunks.push(message.content);
    if (Array.isArray(message.content)) {
      for (const c of message.content) {
        if (typeof c === 'string') chunks.push(c);
        else if (c && typeof c?.text === 'string') chunks.push(c.text);
      }
    }

    const joined = chunks.join('').trim();
    if (joined) return joined;
    if (typeof message.text === 'string') return message.text;
    return '';
  };

  const extractSectionScore = (text: string): number | null => {
    if (!text) return null;

    // Model bazen markdown, farklı ayraçlar veya unicode slash kullanabiliyor.
    // Bu yüzden önce normalize edip, sonra birkaç yaygın formata toleranslı parse ediyoruz.
    const normalized = text
      .replace(/\r\n/g, '\n') // Windows line endings
      .replace(/\r/g, '\n')   // old Mac line endings
      .replace(/\u00a0/g, ' ') // NBSP
      .replace(/[／⁄]/g, '/') // unicode slash variants
      .replace(/[：]/g, ':') // full-width colon
      .replace(/[–—]/g, '-') // en/em dash
      .trim();

    const clampScore = (raw: string) => {
      const n = Number.parseInt(String(raw).trim(), 10);
      if (!Number.isFinite(n) || n < 0 || n > 100) return null;
      return n;
    };

    // 1) Tercih edilen: "Bölüm Puanı: XX/100" veya "Genel Puan: XX/100"
    //    Ayrıca ":" yerine "-" gelebilir, satır madde işaretiyle başlayabilir ve sayı **bold** olabilir.
    const linePrefix = String.raw`(?:^|\n)\s*(?:[-*]\s*)?\**\s*`;
    const labelWord = String.raw`(?:puan[ıi]?|skor|score)`;
    const labeledOutOf100 = new RegExp(
      `${linePrefix}(?:bölüm\\s*)?${labelWord}\\s*[:\\-]\\s*\\**\\s*(\\d{1,3})\\s*\\**\\s*\\/\\s*100\\b`,
      'gi'
    );
    const labeledGeneralOutOf100 = new RegExp(
      `${linePrefix}(?:genel\\s*)?${labelWord}\\s*[:\\-]\\s*\\**\\s*(\\d{1,3})\\s*\\**\\s*\\/\\s*100\\b`,
      'gi'
    );

    // 2) Sadece "XX/100" (etiketsiz, genelde en sonda gelir)
    const bareOutOf100 = /(?:^|\n)\s*\**\s*(\d{1,3})\s*\**\s*\/\s*100\b/gi;

    // 3) "100 üzerinden XX"
    const outOf100Words = /100\s*üzerinden\s*(\d{1,3})\b/gi;
    // 4) "Puan: XX" (bazı yanıtlarda /100 yazılmadan gelebiliyor)
    const labeledPlain = new RegExp(
      `${linePrefix}(?:bölüm\\s*)?(?:genel\\s*)?${labelWord}\\s*[:\\-]\\s*\\**\\s*(\\d{1,3})\\b`,
      'gi'
    );

    // 5) Etiketin satır başında olmadığı varyantlar:
    //    "Sonuç olarak Genel Puanı: 82/100" gibi cümle içi kullanımlar.
    const inlineLabeledOutOf100 = /\b(?:bölüm|genel)?\s*(?:puan[ıi]?|skor|score)\s*[:\-]\s*\**\s*(\d{1,3})\s*\**\s*\/\s*100\b/gi;

    // 6) Son çare: metinde geçen herhangi bir "XX/100" kalıbı.
    //    Bu en toleranslı yaklaşım; diğerleri başarısız olduğunda devreye girer.
    const anyOutOf100 = /\b(\d{1,3})\s*\/\s*100\b/g;

    const pickLastMatch = (re: RegExp) => {
      let m: RegExpExecArray | null = null;
      let last: RegExpExecArray | null = null;
      // eslint-disable-next-line no-cond-assign
      while ((m = re.exec(normalized))) last = m;
      return last?.[1] ?? null;
    };

    const candidates = [
      pickLastMatch(labeledOutOf100),
      pickLastMatch(labeledGeneralOutOf100),
      pickLastMatch(inlineLabeledOutOf100),
      pickLastMatch(outOf100Words),
      pickLastMatch(bareOutOf100),
      pickLastMatch(labeledPlain),
      pickLastMatch(anyOutOf100),
    ];

    for (const c of candidates) {
      if (!c) continue;
      const s = clampScore(c);
      if (s !== null) return s;
    }

    return null;
  };

  // Değerlendirme tamamlanınca puanı yakalayıp Sheet'e kaydet
  // isLoading ve messages bağımsız React state'leri olduğundan bazen farklı render
  // döngülerinde güncellenir. Bu yüzden "loading bitti" anına değil, mesaj ID'sine
  // bakarak işliyoruz: streaming bitmişken yeni bir asistan mesajı geldiyse skoru al.
  useEffect(() => {
    const sectionLetter = pendingScoreSectionLetterRef.current || pendingScoreSectionLetter;
    if (!sectionLetter || !userEmail) return;
    if (isLoading) return; // stream henüz bitmedi
    if (scoreSaveInFlightRef.current) return;

    const assistantMessages = messages.filter((m: any) => m?.role === 'assistant');
    if (assistantMessages.length === 0) return;
    const lastAssistantMessage = assistantMessages[assistantMessages.length - 1];
    if (!lastAssistantMessage?.id) return;

    // Aynı mesajı ikinci kez işleme
    if (lastProcessedMsgIdRef.current === lastAssistantMessage.id) return;

    const assistantText = getMessageText(lastAssistantMessage);
    if (!assistantText.trim()) return; // mesaj henüz boş, bir sonraki render'da tekrar dene

    lastProcessedMsgIdRef.current = lastAssistantMessage.id;

    const score = extractSectionScore(assistantText);

    if (score === null) {
      console.warn(
        '[Score] Puan bulunamadı. Toplam karakter:', assistantText.length,
        '\nİlk 300:', assistantText.slice(0, 300),
        '\nSon 500:', assistantText.slice(-500)
      );
      return;
    }

    const sectionMeta = mainSections.find((s) => s.letter === sectionLetter);
    const sectionTitle = sectionMeta?.title || sectionLetter;
    const sectionDescription = sectionDescriptions[sectionLetter] || '';
    setLatestSectionInfo({
      letter: sectionLetter,
      title: sectionTitle,
      description: sectionDescription,
      score,
    });
    setSectionScoreHistory((prev: Record<string, number[]>) => {
      const existing = prev[sectionLetter] || [];
      return {
        ...prev,
        [sectionLetter]: [...existing, score],
      };
    });
    alert(`${sectionTitle} puanı: ${score}/100`);

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
        // Sonraki bölüm değerlendirmesinde aynı mesaj tekrar işlenmesin diye sıfırla
        lastProcessedMsgIdRef.current = null;
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
    const sectionMeta = mainSections.find((s) => s.letter === sectionLetter);
    if (sectionMeta) {
      setLatestSectionInfo({
        letter: sectionMeta.letter,
        title: sectionMeta.title,
        description: sectionDescriptions[sectionMeta.letter] || '',
        score: null,
      });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // UZUN DETAYLI PROMPTLAR — İleride geri dönmek istersen aşağıdaki bloğun
    // başındaki /* ve sonundaki */ karakterlerini kaldır, kısa prompt bloğunu
    // yorum satırına al. Her bölüm için 4 başlık + madde madde analiz yapılır.
    // ─────────────────────────────────────────────────────────────────────────
    /*
    const evaluationPromptBySection: Record<string, string> = {
      A: `İş planını yönerge parçalarına göre detaylı olarak değerlendir ve eksik yönlerini belirle.
⚠️ Bu istekte SADECE "BÖLÜM A – GENEL BİLGİLER" (A) ana bölümünü değerlendir:
Kapsam: A.1.1 Girişimcinin Tanıtımı, A.1.2 İş Fikri, A.2 Şirket Tanıtımı,
A.2.1 Misyon-Vizyon-Değerler, A.2.2 Şirket Tanımı, A.2.3 Sahiplik Yapısı,
A.2.4 Endüstri/Konum/Tarihçe, A.3 Ürün-Hizmet Tanıtımı, A.3.1 Müşteri Değeri,
A.3.2 Yenilikçi Yönler, A.3.3 Fikri Mülkiyet, A.4 İş Modeli,
A.4.1 Gelir Modeli, A.4.2 Temel Kaynaklar, A.5 Kuruluş Süreci, A.6 Hedefler.
1. **Genel Değerlendirme** – güçlü yönler ve genel eksiklikler
2. **Bölüm Bazlı Analiz** – her alt bölüm için mevcut/yeterli mi, eksikler, öneriler
3. **Eksik Bölümler** – tamamen veya kısmen eksik alt bölümler (kod ile)
4. **Öneriler** – en kritik 5 aksiyon, iyileştirme tavsiyeleri
Lütfen detaylı ve yapılandırılmış bir değerlendirme raporu hazırla.`,

      B: `İş planını yönerge parçalarına göre detaylı olarak değerlendir ve eksik yönlerini belirle.
⚠️ Bu istekte SADECE "BÖLÜM B – PAZAR ANALİZİ" (B) ana bölümünü değerlendir:
Kapsam: B.1 Sektör Analizi, B.1.1 Pazar Büyüklüğü, B.1.2 Gelişim/Trendler,
B.2 Rekabet Analizi, B.2.1 Rakipler, B.2.2 Güçlü/Zayıf Yönler,
B.2.3 Giriş Engelleri, B.3 Müşteri Analizi, B.3.1 Doğrulama,
B.3.2 Segmentasyon, B.3.3 Profiller, B.4 Pazarlama/Satış Stratejileri,
B.4.1 Konumlandırma, B.4.2 Fiyatlandırma, B.4.3 Dağıtım,
B.4.4 Reklam/Promosyon, B.4.5 Satış Sonrası, B.4.6 Projeksiyonlar.
1. **Genel Değerlendirme** 2. **Bölüm Bazlı Analiz** 3. **Eksik Bölümler** 4. **Öneriler**
Lütfen detaylı ve yapılandırılmış bir değerlendirme raporu hazırla.`,

      C: `İş planını yönerge parçalarına göre detaylı olarak değerlendir ve eksik yönlerini belirle.
⚠️ Bu istekte SADECE "C. TEKNİK ANALİZ" (C) ana bölümünü değerlendir:
Kapsam: C.1 Teknik Tanım, C.1.1-C.1.4 Teknik Özellikler/TRL,
C.2 Üretim/Operasyon, C.2.1-C.2.6, C.3 Kuruluş Yeri, C.4 Ar-Ge Planı, C.4.1-C.4.4.
1. **Genel Değerlendirme** 2. **Bölüm Bazlı Analiz** 3. **Eksik Bölümler** 4. **Öneriler**
Lütfen detaylı ve yapılandırılmış bir değerlendirme raporu hazırla.`,

      D: `İş planını yönerge parçalarına göre detaylı olarak değerlendir ve eksik yönlerini belirle.
⚠️ Bu istekte SADECE "D. ORGANİZASYONEL ANALİZ" (D) ana bölümünü değerlendir:
Kapsam: D.1 Organizasyon Yapısı, D.1.1 Örgüt Şeması, D.1.2 İş Tanımları,
D.2 İK Planı, D.2.1 Personel İhtiyacı, D.2.2 Eğitim/İşe Alım, D.3 İşgücü Maliyetleri.
1. **Genel Değerlendirme** 2. **Bölüm Bazlı Analiz** 3. **Eksik Bölümler** 4. **Öneriler**
Lütfen detaylı ve yapılandırılmış bir değerlendirme raporu hazırla.`,

      E: `İş planını yönerge parçalarına göre detaylı olarak değerlendir ve eksik yönlerini belirle.
⚠️ Bu istekte SADECE "E. FİNANSAL ANALİZ" (E) ana bölümünü değerlendir:
Kapsam: E.1-E.9 (Varsayımlar, Birim Ekonomi, Gelirler, Giderler, Başa Baş,
Gelir-Gider Tablosu, Karlılık, Sermaye İhtiyacı, Finansal Riskler).
1. **Genel Değerlendirme** 2. **Bölüm Bazlı Analiz** 3. **Eksik Bölümler** 4. **Öneriler**
Lütfen detaylı ve yapılandırılmış bir değerlendirme raporu hazırla.`,

      F: `İş planını yönerge parçalarına göre detaylı olarak değerlendir ve eksik yönlerini belirle.
⚠️ Bu istekte SADECE "F. SONUÇ" (F) ana bölümünü değerlendir:
Kapsam: F.1 Genel Değerlendirme ve Yatırımcı Özeti, F.2 SWOT Analizi.
1. **Genel Değerlendirme** 2. **Bölüm Bazlı Analiz** 3. **Eksik Bölümler** 4. **Öneriler**
Lütfen detaylı ve yapılandırılmış bir değerlendirme raporu hazırla.`,
    };
    */

    // ─────────────────────────────────────────────────────────────────────────
    // KISA PROMPT MODU — Her bölüm için 1 paragraflık özet değerlendirme + puan.
    // Uzun moda geçmek için yukarıdaki /* */ bloğunu aç, bu bloğu yorum satırına al.
    // ─────────────────────────────────────────────────────────────────────────
    const sectionScopes: Record<string, string> = {
      A: 'BÖLÜM A – GENEL BİLGİLER (A.1.1 Girişimci Tanıtımı, A.1.2 İş Fikri, A.2 Şirket Tanıtımı, A.3 Ürün/Hizmet, A.4 İş Modeli, A.5 Kuruluş Süreci, A.6 Hedefler)',
      B: 'BÖLÜM B – PAZAR ANALİZİ (B.1 Sektör, B.2 Rekabet, B.3 Müşteri Analizi, B.4 Pazarlama & Satış)',
      C: 'BÖLÜM C – TEKNİK ANALİZ (C.1 Teknik Tanım, C.2 Üretim/Operasyon, C.3 Kuruluş Yeri, C.4 Ar-Ge Planı)',
      D: 'BÖLÜM D – ORGANİZASYONEL ANALİZ (D.1 Organizasyon, D.2 İnsan Kaynakları, D.3 İşgücü Maliyetleri)',
      E: 'BÖLÜM E – FİNANSAL ANALİZ (E.1-E.9: Varsayımlar, Gelirler, Giderler, Başa Baş, Karlılık, Sermaye, Riskler)',
      F: 'BÖLÜM F – SONUÇ (F.1 Yatırımcı Özeti, F.2 SWOT Analizi)',
    };

    const evaluationPromptBySection: Record<string, string> = Object.fromEntries(
      Object.entries(sectionScopes).map(([letter, scope]) => [
        letter,
        `İş planındaki "${scope}" kapsamını değerlendir.
Sadece bu bölüme odaklan; diğer bölümlere girme.
Yanıtın TEK bir paragraftan oluşsun: bölümün genel durumunu, en önemli güçlü yönlerini ve kritik eksikliklerini özlü biçimde özetle.
Paragrafın hemen ardına yeni bir satırda yalnızca "Bölüm Puanı: XX/100" yaz (XX bu bölüm için 0-100 arası tam sayı puan).`,
      ])
    );

    // Debug: Email kontrolü
    console.log('=== EVALUATION DEBUG ===');
    console.log('User email:', userEmail);
    console.log('Uploaded file:', uploadedFile);
    console.log('Collection name:', uploadedFile.collectionName);
    console.log('Section letter:', sectionLetter);
    console.log('=======================');

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
        // Yeni dosya yüklenince önceki sohbeti ve puan geçmişini temizle.
        // Aksi takdirde eski değerlendirme mesajları LLM context'ine karışır.
        setMessages([]);
        setLatestSectionInfo(null);
        setSectionScoreHistory({});
        lastProcessedMsgIdRef.current = null;
        pendingScoreSectionLetterRef.current = null;
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
          {latestSectionInfo && (
            <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg p-4">
              <div className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">
                {latestSectionInfo.letter}. {latestSectionInfo.title}
              </div>
              <p className="text-sm text-indigo-700 dark:text-indigo-200 mt-1 whitespace-pre-wrap">
                {latestSectionInfo.description}
              </p>
              <div className="mt-2 text-sm font-medium text-indigo-800 dark:text-indigo-200">
                {latestSectionInfo.score !== null
                  ? `Alınan Puan: ${latestSectionInfo.score}/100`
                  : 'Puan hesaplanıyor...'}
              </div>
            </div>
          )}

          {Object.keys(sectionScoreHistory).length > 0 && (
            <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-4">
              <div className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                Bölüm Puan Geçmişi
              </div>
              <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                {mainSections
                  .filter((section) => (sectionScoreHistory[section.letter] || []).length > 0)
                  .map((section) => {
                    const scores = sectionScoreHistory[section.letter];
                    const latestScore = scores[scores.length - 1];
                    return (
                      <div
                        key={`history-${section.letter}`}
                        className="rounded-md border border-emerald-200 dark:border-emerald-700 bg-white/60 dark:bg-emerald-950/30 px-3 py-2"
                      >
                        <div className="text-xs font-semibold text-emerald-800 dark:text-emerald-200">
                          {section.letter}. {section.title}
                        </div>
                        <div className="text-sm text-emerald-800 dark:text-emerald-100 mt-1">
                          Son Puan: {latestScore}/100
                        </div>
                        <div className="text-xs text-emerald-700 dark:text-emerald-300 mt-1">
                          Geçmiş: {scores.map((s: number) => `${s}/100`).join(' • ')}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

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

