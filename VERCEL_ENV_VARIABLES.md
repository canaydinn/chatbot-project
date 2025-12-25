# Vercel Environment Variables Tablosu

## Zorunlu Environment Variables

| Variable Name | Zorunlu | Kullanım Yeri | Açıklama | Örnek Değer |
|--------------|---------|---------------|----------|-------------|
| `OPENAI_API_KEY` | ✅ **ZORUNLU** | `app/api/chat/route.ts`<br>`scripts/process-yonerge.ts` | OpenAI API anahtarı. Embedding modeli (`text-embedding-3-small`) ve chat modeli (`gpt-4o-mini`) için kullanılır. | `sk-proj-...` |
| `QDRANT_URL` | ✅ **ZORUNLU** | `app/api/chat/route.ts`<br>`scripts/process-yonerge.ts` | Qdrant veritabanı URL'i. Vector search için kullanılır. | `https://xxxxx.qdrant.io`<br>veya<br>`http://your-domain.com:6333` |

## Opsiyonel Environment Variables

| Variable Name | Zorunlu | Kullanım Yeri | Açıklama | Örnek Değer |
|--------------|---------|---------------|----------|-------------|
| `QDRANT_API_KEY` | ⚠️ **OPSİYONEL** | `app/api/chat/route.ts`<br>`scripts/process-yonerge.ts` | Qdrant API anahtarı. Sadece cloud Qdrant kullanıyorsanız veya authentication açıksa gereklidir. | `your-api-key-here` |

## Vercel'de Tanımlama Adımları

1. **Vercel Dashboard** → Projenizi seçin
2. **Settings** → **Environment Variables**
3. Her variable için:
   - **Name**: Variable adı (yukarıdaki tablodan)
   - **Value**: Değer (gizli tutulur)
   - **Environment**: 
     - ✅ Production
     - ✅ Preview  
     - ✅ Development (opsiyonel)
   - **Add** butonuna tıklayın

## Önemli Notlar

⚠️ **Dikkat**: Environment variables eklendikten sonra yeni bir deployment yapmanız gerekir.

✅ **Qdrant Cloud Kullanımı**: 
- `QDRANT_URL`: Cloud cluster URL'iniz
- `QDRANT_API_KEY`: Mutlaka tanımlanmalı

✅ **Self-Hosted Qdrant**: 
- `QDRANT_URL`: Public erişilebilir URL
- `QDRANT_API_KEY`: Genellikle gerekli değil (authentication açıksa gerekli)

## Dosya Kontrol Sonuçları

### ✅ next.config.ts
- **Durum**: Sorunsuz
- **Not**: Next.js 16.1.1 Vercel için otomatik optimize edilir

### ✅ package.json
- **Build Script**: ✅ Mevcut (`next build`)
- **Start Script**: ✅ Mevcut (`next start`)
- **Dependencies**: ✅ Tüm paketler tanımlı
- **Not**: `process-yonerge` script'i sadece local development için (Vercel'de çalıştırılmayacak)

## Deployment Sonrası Test

1. Ana sayfayı açın
2. Chatbot arayüzünün yüklendiğini kontrol edin
3. Bir soru sorun ve yanıtın geldiğini kontrol edin
4. Vercel Function Logs'u kontrol edin (hata varsa)

