# 🚀 Vercel'e Deploy Adımları

## Adım 1: Vercel'e Giriş Yapın

Terminal'de şu komutu çalıştırın:

```bash
vercel login
```

Tarayıcı açılacak, Vercel hesabınızla giriş yapın.

## Adım 2: Projeyi Deploy Edin

```bash
vercel
```

Sorular sorulacak:
- **Set up and deploy?** → `Y` yazın
- **Which scope?** → Vercel hesabınızı seçin
- **Link to existing project?** → `N` (yeni proje için)
- **Project name?** → `chatbot-project` (veya istediğiniz isim)
- **Directory?** → `.` (nokta) yazın

## Adım 3: Environment Variables Ekleme

Deploy'dan sonra environment variables ekleyin:

### Vercel CLI ile (Önerilen):

```bash
# Production için
vercel env add OPENAI_API_KEY production
vercel env add QDRANT_URL production
vercel env add QDRANT_API_KEY production

# Preview için
vercel env add OPENAI_API_KEY preview
vercel env add QDRANT_URL preview
vercel env add QDRANT_API_KEY preview

# Development için
vercel env add OPENAI_API_KEY development
vercel env add QDRANT_URL development
vercel env add QDRANT_API_KEY development
```

Her komutta değeri girmeniz istenecek.

### Veya Vercel Dashboard'dan:

1. [Vercel Dashboard](https://vercel.com/dashboard) → Projenizi seçin
2. **Settings** → **Environment Variables**
3. Her variable için:
   - **Name**: Variable adı
   - **Value**: Değer
   - **Environment**: Production, Preview, Development seçin
   - **Add**

## Adım 4: Production Deploy

Environment variables eklendikten sonra:

```bash
vercel --prod
```

Veya Vercel Dashboard'dan **Redeploy** butonuna tıklayın.

## ✅ Tamamlandı!

Vercel size bir URL verecek (örn: `https://chatbot-project.vercel.app`)

Bu URL'yi tarayıcıda açın ve chatbot'u test edin!

---

## 📝 Önemli Notlar

- ✅ Veriler zaten Qdrant cloud'da yüklü (61 chunk)
- ✅ Environment variables'ları mutlaka ekleyin
- ✅ Her ortam için (production, preview, development) ayrı ayrı ekleyin

