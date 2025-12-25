# 🚀 Vercel'e Deploy Etme - Hızlı Rehber

## Adım 1: Vercel'e Giriş Yapın

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

Deploy'dan sonra Vercel size bir URL verecek. Şimdi environment variables ekleyin:

### Yöntem 1: Vercel CLI ile (Önerilen)

```bash
vercel env add OPENAI_API_KEY production
# Değeri girin: sk-your-openai-key

vercel env add QDRANT_URL production
# Değeri girin: https://your-qdrant-url.com

vercel env add QDRANT_API_KEY production
# Değeri girin: your-qdrant-key (opsiyonel)
```

Her variable için **production**, **preview** ve **development** ortamlarını ayrı ayrı ekleyin:

```bash
# Production için
vercel env add OPENAI_API_KEY production

# Preview için
vercel env add OPENAI_API_KEY preview

# Development için
vercel env add OPENAI_API_KEY development
```

### Yöntem 2: Vercel Dashboard'dan

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

## ✅ Kontrol

1. Vercel size bir URL verecek (örn: `https://chatbot-project.vercel.app`)
2. Bu URL'yi tarayıcıda açın
3. Chatbot'u test edin

---

## 📝 Önemli Notlar

- ✅ Veriler zaten Qdrant cloud'da yüklü (61 chunk)
- ✅ Environment variables'ları mutlaka ekleyin
- ✅ Her ortam için (production, preview, development) ayrı ayrı ekleyin
- ✅ Deploy'dan sonra test edin

---

## 🔧 Sorun Giderme

### Environment Variables Eksik
- Vercel Dashboard → Settings → Environment Variables kontrol edin
- Tüm ortamlar için tanımlı olduğundan emin olun

### API Route Çalışmıyor
- Vercel Dashboard → Functions → Logs kontrol edin
- Qdrant bağlantısını test edin

