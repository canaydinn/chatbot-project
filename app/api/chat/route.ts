import { openai } from '@ai-sdk/openai';
import { streamText } from 'ai';
import { QdrantClient } from '@qdrant/js-client-rest';
import OpenAI from 'openai';

// Qdrant client'ı oluştur
function getQdrantClient() {
  if (!process.env.QDRANT_URL) {
    throw new Error('QDRANT_URL environment variable is required');
  }

  return new QdrantClient({
    url: process.env.QDRANT_URL,
    apiKey: process.env.QDRANT_API_KEY, // Opsiyonel
  });
}

// OpenAI client'ı oluştur
function getOpenAIClient() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY environment variable is required');
  }

  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
}

// Metni embedding'e çevir
async function createEmbedding(text: string, openaiClient: OpenAI): Promise<number[]> {
  const response = await openaiClient.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  });

  return response.data[0].embedding;
}

// Qdrant'ta benzerlik araması yap
async function searchSimilarChunks(
  queryVector: number[],
  qdrantClient: QdrantClient,
  collectionName: string = 'is_plani_rehberi',
  limit: number = 3
) {
  const searchResult = await qdrantClient.search(collectionName, {
    vector: queryVector,
    limit: limit,
    with_payload: true,
  });

  return searchResult.map((result) => ({
    score: result.score,
    sectionCode: result.payload?.sectionCode as string,
    title: result.payload?.title as string,
    purpose: result.payload?.purpose as string,
    searchedElements: result.payload?.searchedElements as string,
    scoringLogic: result.payload?.scoringLogic as string,
    originalText: result.payload?.originalText as string,
  }));
}

// Context metnini oluştur
function buildContextText(
  guidelineChunks: Awaited<ReturnType<typeof searchSimilarChunks>>,
  userFileChunks: Array<{ score: number; text: string; fileName?: string; chunkIndex?: number }> = []
): string {
  const parts: string[] = [];

  // Kullanıcı dosyası parçaları - EN BAŞTA (öncelikli)
  if (userFileChunks.length > 0) {
    parts.push('═══════════════════════════════════════════════════════════');
    parts.push('║  KULLANICI İŞ PLANI DOSYASI - TAM İÇERİK                ║');
    parts.push('═══════════════════════════════════════════════════════════');
    parts.push('');
    parts.push('⚠️ ÇOK ÖNEMLİ: AŞAĞIDA KULLANICININ YÜKLEDİĞİ İŞ PLANI DOSYASININ TAM İÇERİĞİ BULUNMAKTADIR.');
    parts.push('BU İÇERİĞİ MUTLAKA KULLANARAK DEĞERLENDİRME YAPMALISIN.');
    parts.push('ASLA "dosya yükleyemedim" veya "içerik göremiyorum" gibi mesajlar verme.');
    parts.push('');
    parts.push('───────────────────────────────────────────────────────────');
    parts.push('');
    
    const userFileText = userFileChunks
      .map((chunk, index) => {
        const chunkNum = chunk.chunkIndex !== undefined ? chunk.chunkIndex + 1 : index + 1;
        return `[BÖLÜM ${chunkNum}/${userFileChunks.length}${chunk.fileName ? ` - ${chunk.fileName}` : ''}]
${chunk.text}`;
      })
      .join('\n\n───────────────────────────────────────────────────────────\n\n');
    
    parts.push(userFileText);
    parts.push('');
    parts.push('═══════════════════════════════════════════════════════════');
    parts.push('║  KULLANICI İŞ PLANI DOSYASI SONU                       ║');
    parts.push('═══════════════════════════════════════════════════════════');
    parts.push('');
  }

  // Yönerge parçaları
  if (guidelineChunks.length > 0) {
    parts.push('═══════════════════════════════════════════════════════════');
    parts.push('║  YÖNERGE PARÇALARI (Değerlendirme Kriterleri)         ║');
    parts.push('═══════════════════════════════════════════════════════════');
    parts.push('');
    const guidelineText = guidelineChunks
      .map((chunk) => {
        const chunkParts = [
          `## ${chunk.sectionCode} - ${chunk.title}`,
          chunk.purpose && `**Amaç:** ${chunk.purpose}`,
          chunk.searchedElements && `**Aranan Unsurlar:**\n${chunk.searchedElements}`,
          chunk.scoringLogic && `**Puanlama Mantığı:**\n${chunk.scoringLogic}`,
        ]
          .filter(Boolean)
          .join('\n\n');
        return chunkParts;
      })
      .join('\n\n───────────────────────────────────────────────────────────\n\n');
    parts.push(guidelineText);
    parts.push('');
  }

  if (parts.length === 0) {
    return 'Yönerge parçası veya kullanıcı dosyası bulunamadı.';
  }

  return parts.join('\n');
}

export async function POST(req: Request) {
  try {
    // Environment variables kontrolü - erken kontrol
    if (!process.env.OPENAI_API_KEY) {
      console.error('OPENAI_API_KEY is missing');
      return new Response(
        JSON.stringify({ error: 'OPENAI_API_KEY environment variable is required' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    if (!process.env.QDRANT_URL) {
      console.error('QDRANT_URL is missing');
      return new Response(
        JSON.stringify({ error: 'QDRANT_URL environment variable is required' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Request body'yi parse et
    const body = await req.json();
    const { messages, email } = body;
    
    // Tüm header'ları logla (debug için)
    const allHeaders: Record<string, string> = {};
    req.headers.forEach((value, key) => {
      allHeaders[key] = value;
    });
    console.log('All request headers:', JSON.stringify(allHeaders, null, 2));
    
    // E-posta bilgisini header'dan da alabilir (fallback)
    const headerEmail = req.headers.get('x-user-email');
    const userEmail = email || headerEmail;
    console.log('=== EMAIL DEBUG ===');
    console.log('Email from body:', email);
    console.log('Email from header (x-user-email):', headerEmail);
    console.log('Final userEmail:', userEmail);
    console.log('==================');

    console.log('Received request body:', JSON.stringify(body, null, 2));

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response('Messages array is required', { status: 400 });
    }

    // Son kullanıcı mesajını al
    const lastMessage = messages[messages.length - 1];
    console.log('Last message:', JSON.stringify(lastMessage, null, 2));
    
    // UIMessage formatında text parts'dan metni çıkar
    // Eğer parts yoksa, direkt text property'sini kontrol et
    let userQuestion = '';
    if (lastMessage.parts && Array.isArray(lastMessage.parts)) {
      const textParts = lastMessage.parts.filter((part: any) => part.type === 'text') || [];
      userQuestion = textParts.map((part: any) => part.text).join('') || '';
    } else if (lastMessage.text) {
      // Eğer direkt text property'si varsa onu kullan
      userQuestion = lastMessage.text;
    } else if (typeof lastMessage === 'string') {
      // Eğer mesaj direkt string ise
      userQuestion = lastMessage;
    }

    console.log('Extracted user question:', userQuestion);
    console.log('User question type:', typeof userQuestion);
    console.log('User question length:', userQuestion?.length);

    if (!userQuestion || typeof userQuestion !== 'string' || userQuestion.trim() === '') {
      console.error('Invalid user question:', { userQuestion, type: typeof userQuestion });
      return new Response(
        JSON.stringify({ 
          error: 'User question is required and must be a non-empty string',
          received: userQuestion,
          type: typeof userQuestion
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // OpenAI ve Qdrant client'larını oluştur
    console.log('Creating OpenAI and Qdrant clients...');
    let openaiClient: OpenAI;
    let qdrantClient: QdrantClient;
    
    try {
      openaiClient = getOpenAIClient();
      console.log('OpenAI client created successfully');
    } catch (error) {
      console.error('Failed to create OpenAI client:', error);
      throw error;
    }
    
    try {
      qdrantClient = getQdrantClient();
      console.log('Qdrant client created successfully');
      
      // Collection'ın varlığını kontrol et
      try {
        const collectionInfo = await qdrantClient.getCollection('is_plani_rehberi');
        console.log('Collection found:', 'is_plani_rehberi', 'Points:', collectionInfo.points_count);
      } catch (error: any) {
        if (error.status === 404 || error.message?.includes('not found')) {
          console.error('Collection "is_plani_rehberi" not found in Qdrant');
          return new Response(
            JSON.stringify({ 
              error: 'Qdrant collection "is_plani_rehberi" not found. Please run the data upload script first.',
              hint: 'Run: npm run process-yonerge'
            }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
          );
        }
        throw error;
      }
    } catch (error) {
      console.error('Failed to create Qdrant client:', error);
      throw error;
    }

    // Kullanıcı sorusunu embedding'e çevir
    console.log('Creating embedding for user question...');
    let queryEmbedding: number[];
    try {
      queryEmbedding = await createEmbedding(userQuestion, openaiClient);
      console.log('Embedding created, vector size:', queryEmbedding.length);
    } catch (error) {
      console.error('Error creating embedding:', error);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to create embedding',
          details: error instanceof Error ? error.message : 'Unknown error'
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Kullanıcı e-postasını kullan
    let userCollectionName = null;
    if (userEmail) {
      try {
        const emailHash = Buffer.from(userEmail).toString('base64').replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
        userCollectionName = `user_${emailHash}`;
        console.log('=== COLLECTION NAME DEBUG ===');
        console.log('User email:', userEmail);
        console.log('Email hash (base64):', Buffer.from(userEmail).toString('base64'));
        console.log('Email hash (cleaned):', emailHash);
        console.log('User collection name:', userCollectionName);
        console.log('=============================');
      } catch (error) {
        console.error('Error creating collection name:', error);
      }
    } else {
      console.log('⚠️ WARNING: No user email found, skipping user file search');
      console.log('This means the user file chunks will not be retrieved.');
      console.log('Check if email is being sent in request body or headers.');
    }

    // Değerlendirme isteği olup olmadığını ERKEN kontrol et
    const isEvaluationRequest = userQuestion && (
      userQuestion.toLowerCase().includes('değerlendir') || 
      userQuestion.toLowerCase().includes('eksik') ||
      userQuestion.toLowerCase().includes('iş planını')
    );
    console.log('Is evaluation request:', isEvaluationRequest);

    // Qdrant'ta benzerlik araması yap (top 3 - genel yönerge)
    console.log('Searching Qdrant for similar chunks from guideline...');
    let similarChunks: Awaited<ReturnType<typeof searchSimilarChunks>> = [];
    try {
      similarChunks = await searchSimilarChunks(
        queryEmbedding,
        qdrantClient,
        'is_plani_rehberi',
        3
      );
      console.log('Found', similarChunks.length, 'similar chunks from guideline');
    } catch (error) {
      console.error('Error searching Qdrant guideline:', error);
      console.warn('Continuing without guideline context');
    }

    // Kullanıcının yüklediği dosyadan da arama yap (varsa)
    let userFileChunks: Array<{
      score: number;
      text: string;
      fileName?: string;
      chunkIndex?: number;
    }> = [];
    
    if (userCollectionName) {
      try {
        // Collection'ın varlığını kontrol et
        const collectionInfo = await qdrantClient.getCollection(userCollectionName);
        console.log('User collection found:', userCollectionName, 'Points:', collectionInfo.points_count);
        
        if (isEvaluationRequest) {
          // Değerlendirme için: TÜM chunk'ları al
          console.log('Evaluation request detected - fetching ALL chunks from user file');
          const totalPoints = collectionInfo.points_count || 0;
          
          if (totalPoints > 0) {
            // Tüm chunk'ları almak için scroll kullan (sayfalama ile)
            let allPoints: any[] = [];
            let nextPageOffset: any = null;
            const scrollLimit = 100; // Her seferde 100 point al
            
            do {
              const scrollResult = await qdrantClient.scroll(userCollectionName, {
                limit: scrollLimit,
                offset: nextPageOffset,
                with_payload: true,
                with_vector: false,
              });
              
              if (scrollResult.points && scrollResult.points.length > 0) {
                allPoints = allPoints.concat(scrollResult.points);
                nextPageOffset = scrollResult.next_page_offset;
                console.log(`Fetched ${allPoints.length}/${totalPoints} points so far...`);
              } else {
                break;
              }
            } while (nextPageOffset !== null && allPoints.length < totalPoints);
            
            // Chunk'ları işle
            userFileChunks = allPoints
              .map((point: any) => {
                const text = (point.payload?.text as string) || (point.payload?.originalText as string) || '';
                // Boş chunk'ları filtrele
                if (!text || text.trim().length === 0) {
                  console.warn('Found empty chunk at index:', point.payload?.chunkIndex);
                  return null;
                }
                return {
                  score: 1.0, // Tüm chunk'lar eşit önemde
                  text: text,
                  fileName: point.payload?.fileName as string,
                  chunkIndex: point.payload?.chunkIndex as number,
                };
              })
              .filter((chunk): chunk is NonNullable<typeof chunk> => chunk !== null);
            
            // Chunk'ları index'e göre sırala (dosya sırasını koru)
            userFileChunks.sort((a, b) => {
              const indexA = a.chunkIndex !== undefined ? a.chunkIndex : 0;
              const indexB = b.chunkIndex !== undefined ? b.chunkIndex : 0;
              return indexA - indexB;
            });
            
            console.log('Found', userFileChunks.length, 'chunks from user file (ALL chunks for evaluation)');
            if (userFileChunks.length > 0) {
              console.log('First chunk preview:', userFileChunks[0].text.substring(0, 100) + '...');
              console.log('Last chunk preview:', userFileChunks[userFileChunks.length - 1].text.substring(0, 100) + '...');
            }
          } else {
            console.log('User collection is empty');
          }
        } else {
          // Normal sorgu için: Benzer chunk'ları ara
          console.log('Normal query - searching for similar chunks');
          const userSearchResult = await qdrantClient.search(userCollectionName, {
            vector: queryEmbedding,
            limit: 3,
            with_payload: true,
          });

          userFileChunks = userSearchResult.map((result) => ({
            score: result.score,
            text: (result.payload?.text as string) || (result.payload?.originalText as string) || '',
            fileName: result.payload?.fileName as string,
            chunkIndex: result.payload?.chunkIndex as number,
          }));
          
          console.log('Found', userFileChunks.length, 'similar chunks from user file');
        }
      } catch (error: any) {
        if (error.status === 404) {
          console.log('User collection not found:', userCollectionName);
        } else {
          console.error('Error accessing user file:', error);
        }
        // Collection yoksa veya hata varsa devam et
        console.log('Continuing without user file context');
      }
    }

    // Context metnini oluştur (hem yönerge hem kullanıcı dosyası)
    const contextText = buildContextText(similarChunks, userFileChunks);
    
    // Kullanıcı dosyası varsa, bunu belirt
    const hasUserFile = userFileChunks.length > 0;
    console.log('=== CONTEXT SUMMARY ===');
    console.log('Guideline chunks:', similarChunks.length);
    console.log('User file chunks:', userFileChunks.length);
    console.log('Has user file:', hasUserFile);
    console.log('Is evaluation request:', isEvaluationRequest);
    console.log('Context length:', contextText.length);
    console.log('Context preview (first 500 chars):', contextText.substring(0, 500));
    console.log('Context contains "KULLANICI İŞ PLANI":', contextText.includes('KULLANICI İŞ PLANI'));
    console.log('Context contains user file chunks:', userFileChunks.length > 0 && contextText.includes(userFileChunks[0]?.text?.substring(0, 50) || ''));
    console.log('========================');

    let systemPrompt = `Sen bir iş planı danışmanısın. Sana verilen yönerge parçalarına dayanarak kullanıcının sorularını yanıtla veya taslaklarını değerlendir. Yönerge dışına çıkma.

${hasUserFile ? `🚨🚨🚨 ÇOK ÖNEMLİ - MUTLAKA OKU - KULLANICI DOSYASI MEVCUT 🚨🚨🚨

AŞAĞIDAKİ BAĞLAMDA "KULLANICI İŞ PLANI DOSYASI" BÖLÜMÜNDE KULLANICININ YÜKLEDİĞİ İŞ PLANININ TAM İÇERİĞİ BULUNMAKTADIR. 
BU İÇERİK BAĞLAMIN EN BAŞINDA YER ALMAKTADIR.

BU İÇERİĞİ MUTLAKA KULLANMALISIN VE DEĞERLENDİRME YAPMALISIN.

ASLA ŞUNLARI SÖYLEME:
- "dosya yükleyemedim"
- "içerik göremiyorum" 
- "içerik paylaşın"
- "dosyaya erişimim yok"
- "görünüşe göre dosyanıza erişimim yok"
- "benim için sağlanan iş planını değerlendiremediğim için"
- "spesifik içerik üzerinde çalışamam"

İÇERİK ZATEN AŞAĞIDA MEVCUT. BAĞLAMIN BAŞINA BAK - "KULLANICI İŞ PLANI DOSYASI" BAŞLIĞINI ARA VE İÇERİĞİ KULLAN.

🚨🚨🚨 YUKARIDAKİ UYARIYI MUTLAKA DİKKATE AL - İÇERİK MEVCUT 🚨🚨🚨

` : 'NOT: Kullanıcı henüz bir dosya yüklememiş görünüyor.\n\n'}Bağlam:
${contextText}`;

    if (isEvaluationRequest) {
      systemPrompt += `

🚨🚨🚨 DEĞERLENDİRME İSTEĞİ - ÇOK ÖNEMLİ 🚨🚨🚨

Kullanıcı bir iş planı değerlendirmesi istiyor. 

${hasUserFile ? `🚨🚨🚨 KULLANICI DOSYASI MEVCUT - MUTLAKA KULLAN 🚨🚨🚨

YUKARIDAKİ BAĞLAMDA "KULLANICI İŞ PLANI DOSYASI" BÖLÜMÜNDE KULLANICININ YÜKLEDİĞİ İŞ PLANININ TAM İÇERİĞİ BULUNMAKTADIR.

BU İÇERİĞİ MUTLAKA KULLANARAK DEĞERLENDİRME YAPMALISIN.

Kullanıcının dosyasındaki bölümleri yönerge parçalarıyla karşılaştır ve eksiklikleri belirle.

ASLA ŞUNLARI SÖYLEME:
- "dosya yükleyemedim"
- "içerik göremiyorum"
- "içerik paylaşın"
- "dosyaya erişimim yok"
- "görünüşe göre dosyanıza erişimim yok"
- "benim için sağlanan iş planını değerlendiremediğim için"
- "spesifik içerik üzerinde çalışamam"

İÇERİK ZATEN YUKARIDAKİ BAĞLAMDA MEVCUT. BAĞLAMIN BAŞINA BAK - "KULLANICI İŞ PLANI DOSYASI" BAŞLIĞINI BUL VE İÇERİĞİ KULLAN.

Eğer bağlamda "KULLANICI İŞ PLANI DOSYASI" başlığını görüyorsan, içeriği kullanarak değerlendirme yap.` : '⚠️ UYARI: Kullanıcı henüz bir dosya yüklememiş görünüyor. Sadece yönerge parçalarına göre genel bilgi verebilirsin.'}

Lütfen şu yapıda detaylı bir değerlendirme yap:

1. **Genel Değerlendirme**
   - İş planının genel yapısı ve kapsamı
   - Güçlü yönler
   - Genel eksiklikler

2. **Bölüm Bazlı Analiz**
   Her bölüm için (A.1.1, A.1.2, B.1.1, vb.):
   - Bölümün mevcut olup olmadığı
   - İçeriğin yeterliliği
   - Yönergeye uygunluğu
   - Eksik unsurlar (amaç, aranan unsurlar, puanlama mantığı açısından)
   - Bölümün geliştirilmesine yönelik somut öneriler (madde madde)

3. **Eksik Bölümler**
   - Tamamen eksik olan bölümler (bölüm kodu ile)
   - Kısmen eksik olan bölümler

4. **Öneriler**
   - Her eksik bölüm için öneriler
   - İyileştirme tavsiyeleri
   - Öncelik sırası
   - Mevcut ama zayıf olan bölümler için geliştirme önerileri (bölüm kodu ile)

5. **Genel Puan (0-100)**
   - İş planını 100 üzerinden puanla
   - Puanın kısa gerekçesini (2-4 madde) belirt
   - Raporun EN SONUNA tek satır olarak **Genel Puan: XX/100** ekle (XX 0-100 arası tam sayı)

Yönerge parçalarındaki her bölüm için (A.1.1, A.1.2, B.1.1, vb.):
- Bölüm başlığını kontrol et
- Amaç kısmının olup olmadığını kontrol et
- Aranan unsurların belirtilip belirtilmediğini kontrol et
- Puanlama mantığının açıklanıp açıklanmadığını kontrol et

${hasUserFile ? `🚨 SON HATIRLATMA 🚨

Yukarıdaki bağlamda kullanıcının iş planı dosyasının TAM İÇERİĞİ mevcuttur. 
Bağlamın başında "KULLANICI İŞ PLANI DOSYASI" başlığını bulabilirsin.
Bu içeriği kullanarak detaylı değerlendirme yap.

ASLA "dosya yükleyemedim", "içerik göremiyorum", "içerik paylaşın", "dosyaya erişimim yok" veya "görünüşe göre dosyanıza erişimim yok" gibi mesajlar verme.

İçerik zaten bağlamda mevcut. Bağlamın başına bak ve içeriği kullan.` : ''}

Lütfen detaylı, yapılandırılmış ve ölçülebilir bir değerlendirme raporu hazırla.`;
    } else {
      systemPrompt += `

Kullanıcının sorusunu yanıtlarken yukarıdaki bağlama dayan. ${hasUserFile ? 'Bu bağlam hem genel yönerge hem de kullanıcının yüklediği iş planı dosyasından alınmıştır. Kullanıcının dosyasındaki içeriği kullanabilirsin.' : ''} Eğer soru yönerge kapsamında değilse, bunu nazikçe belirt.`;
    }

    // Önceki mesajları context'e uygun şekilde hazırla
    // UIMessage formatından ModelMessage formatına çevir
    const previousMessages = messages.slice(0, -1).map((msg: any) => {
      let text = '';
      if (msg.parts && Array.isArray(msg.parts)) {
        const textParts = msg.parts.filter((part: any) => part.type === 'text') || [];
        text = textParts.map((part: any) => part.text).join('');
      } else if (msg.text) {
        text = msg.text;
      } else if (typeof msg === 'string') {
        text = msg;
      }
      return {
        role: msg.role || 'user',
        content: text,
      };
    });

    const formattedMessages = [
      {
        role: 'system' as const,
        content: systemPrompt,
      },
      ...previousMessages,
      {
        role: 'user' as const,
        content: userQuestion,
      },
    ];

    // Stream yanıt oluştur
    console.log('Creating stream response with', formattedMessages.length, 'messages');
    const result = await streamText({
      model: openai('gpt-4o-mini'), // veya 'gpt-4o' kullanabilirsiniz
      messages: formattedMessages,
    });

    // Stream'i döndür - yeni AI SDK formatı
    // originalMessages parametresini ekleyerek mesaj ID'lerini koruyoruz
    console.log('Converting to UI message stream response...');
    return result.toUIMessageStreamResponse({
      originalMessages: messages,
    });
  } catch (error: any) {
    console.error('Error in chat API:', error);
    const errorMessage = error instanceof Error ? error.message : 'An error occurred';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    // Vercel'de logları görmek için detaylı loglama
    console.error('=== API Error ===');
    console.error('Message:', errorMessage);
    console.error('Stack:', errorStack);
    console.error('Error object:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
    console.error('Environment check:', {
      hasOpenAIKey: !!process.env.OPENAI_API_KEY,
      hasQdrantUrl: !!process.env.QDRANT_URL,
      hasQdrantKey: !!process.env.QDRANT_API_KEY,
      nodeEnv: process.env.NODE_ENV,
    });
    
    // Production'da daha güvenli error mesajı
    const isDevelopment = process.env.NODE_ENV === 'development';
    const responseError: any = {
      error: errorMessage,
    };
    
    // Development'ta stack trace ekle
    if (isDevelopment) {
      responseError.stack = errorStack;
      responseError.fullError = error?.toString();
    }
    
    // Environment variable eksikliği kontrolü
    if (!process.env.OPENAI_API_KEY) {
      responseError.hint = 'OPENAI_API_KEY environment variable is missing. Please add it in Vercel Settings > Environment Variables.';
    } else if (!process.env.QDRANT_URL) {
      responseError.hint = 'QDRANT_URL environment variable is missing. Please add it in Vercel Settings > Environment Variables.';
    }
    
    return new Response(
      JSON.stringify(responseError),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }
}

