# Vercel Deployment Rehberi

## Environment Variables

Vercel dashboard'unda aşağıdaki environment variables'ları tanımlamanız gerekmektedir:

| Variable Name | Zorunlu | Açıklama | Örnek Değer |
|--------------|---------|----------|-------------|
| `OPENAI_API_KEY` | ✅ Evet | OpenAI API anahtarı. Embedding ve chat için kullanılır. | `sk-...` |
| `QDRANT_URL` | ✅ Evet | Qdrant veritabanı URL'i. Cloud veya self-hosted Qdrant instance URL'i. | `https://your-cluster.qdrant.io` veya `http://localhost:6333` |
| `QDRANT_API_KEY` | ⚠️ Opsiyonel | Qdrant API anahtarı. Cloud Qdrant kullanıyorsanız gerekli. | `your-api-key` |

## Environment Variables Ekleme Adımları

1. Vercel Dashboard'a giriş yapın
2. Projenizi seçin
3. **Settings** > **Environment Variables** bölümüne gidin
4. Her bir variable için:
   - **Name**: Variable adını girin
   - **Value**: Değerini girin
   - **Environment**: Production, Preview ve Development için seçin (veya sadece Production)
   - **Add** butonuna tıklayın

## Önemli Notlar

- `OPENAI_API_KEY` ve `QDRANT_URL` **mutlaka** tanımlanmalıdır, aksi halde uygulama çalışmaz
- `QDRANT_API_KEY` sadece cloud Qdrant kullanıyorsanız gereklidir
- Environment variables eklendikten sonra yeni bir deployment yapmanız gerekebilir
- Production, Preview ve Development ortamları için ayrı ayrı tanımlayabilirsiniz

## Dosya Kontrolleri

### ✅ next.config.ts
- Dosya mevcut ve doğru formatta
- Vercel için ekstra ayar gerekmiyor (Next.js 16.1.1 otomatik olarak optimize edilir)

### ✅ package.json
- Build script mevcut: `"build": "next build"`
- Start script mevcut: `"start": "next start"`
- Tüm dependencies tanımlı
- `process-yonerge` script'i sadece local development için (Vercel'de çalıştırılmayacak)

## Deployment Sonrası Kontroller

1. **Build Logs**: Vercel dashboard'unda build loglarını kontrol edin
2. **Runtime Errors**: Environment variables eksikse runtime'da hata alırsınız
3. **API Route Test**: `/api/chat` endpoint'ini test edin
4. **Qdrant Bağlantısı**: Qdrant instance'ınızın Vercel'den erişilebilir olduğundan emin olun

## Qdrant Cloud Kullanımı

Eğer Qdrant Cloud kullanıyorsanız:
- `QDRANT_URL`: Cloud cluster URL'iniz (örn: `https://xxxxx-xxxxx-xxxxx.qdrant.io`)
- `QDRANT_API_KEY`: Cloud dashboard'dan aldığınız API key

## Self-Hosted Qdrant Kullanımı

Eğer kendi Qdrant instance'ınızı kullanıyorsanız:
- `QDRANT_URL`: Public erişilebilir URL (örn: `https://qdrant.yourdomain.com`)
- `QDRANT_API_KEY`: Genellikle gerekli değil (eğer authentication açıksa gerekli)

## Sorun Giderme

### Build Hatası
- Environment variables'ların doğru tanımlandığından emin olun
- Build loglarını kontrol edin

### Runtime Hatası
- Browser console'da hata mesajlarını kontrol edin
- Vercel Function Logs'u kontrol edin
- Environment variables'ların tüm ortamlar için tanımlı olduğundan emin olun

### API Route Çalışmıyor
- `/api/chat` endpoint'ini test edin
- Network tab'ında request/response'ları kontrol edin
- Qdrant bağlantısını test edin

