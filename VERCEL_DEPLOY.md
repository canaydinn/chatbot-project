# Vercel Deployment Adımları

## 🚀 Hızlı Deployment (Vercel CLI ile)

### Adım 1: Vercel CLI Kurulumu (Eğer yoksa)

```bash
npm install -g vercel
```

### Adım 2: Vercel'e Giriş Yapın

```bash
vercel login
```

### Adım 3: Projeyi Deploy Edin

```bash
vercel
```

İlk deploy'da sorular sorulacak:
- **Set up and deploy?** → `Y`
- **Which scope?** → Vercel hesabınızı seçin
- **Link to existing project?** → `N` (yeni proje)
- **Project name?** → `chatbot-project` (veya istediğiniz isim)
- **Directory?** → `.` (mevcut dizin)

### Adım 4: Environment Variables Ekleme

Vercel CLI ile:

```bash
vercel env add OPENAI_API_KEY
vercel env add QDRANT_URL
vercel env add QDRANT_API_KEY
```

Veya Vercel Dashboard'dan:
1. Vercel Dashboard → Projenizi seçin
2. **Settings** → **Environment Variables**
3. Aşağıdaki variables'ları ekleyin:

| Variable Name | Value |
|--------------|-------|
| `OPENAI_API_KEY` | `sk-your-openai-key` |
| `QDRANT_URL` | `https://your-qdrant-url.com` |
| `QDRANT_API_KEY` | `your-qdrant-key` (opsiyonel) |

**Önemli:** Her variable için **Production**, **Preview** ve **Development** ortamlarını seçin.

### Adım 5: Production Deploy

```bash
vercel --prod
```

---

## 🌐 GitHub ile Otomatik Deployment

### Adım 1: GitHub Repository Oluştur

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/yourusername/chatbot-project.git
git push -u origin main
```

### Adım 2: Vercel'de Projeyi Import Et

1. [Vercel Dashboard](https://vercel.com/dashboard) → **Add New** → **Project**
2. GitHub repository'nizi seçin
3. **Import** butonuna tıklayın

### Adım 3: Environment Variables Ekle

Vercel Dashboard'da:
- **Settings** → **Environment Variables**
- Variables'ları ekleyin (yukarıdaki tabloya bakın)

### Adım 4: Deploy

Vercel otomatik olarak deploy edecektir. Her push'ta otomatik deploy yapılır.

---

## ✅ Deployment Sonrası Kontroller

1. **Build Logs**: Vercel dashboard'unda build loglarını kontrol edin
2. **Live URL**: Vercel size bir URL verecek (örn: `https://chatbot-project.vercel.app`)
3. **API Test**: `/api/chat` endpoint'ini test edin
4. **Qdrant Bağlantısı**: Qdrant instance'ınızın Vercel'den erişilebilir olduğundan emin olun

---

## 📝 Önemli Notlar

- ✅ Veriler zaten Qdrant cloud'da yüklü, Vercel'de ekstra bir şey yapmanıza gerek yok
- ✅ Environment variables'ları mutlaka ekleyin
- ✅ Production deploy'dan sonra test edin
- ✅ Vercel Function Logs'u kontrol ederek hataları görebilirsiniz

---

## 🔧 Sorun Giderme

### Build Hatası
- Environment variables'ların doğru tanımlandığından emin olun
- Build loglarını kontrol edin

### Runtime Hatası
- Vercel Function Logs'u kontrol edin
- Environment variables'ların tüm ortamlar için tanımlı olduğundan emin olun

### API Route Çalışmıyor
- `/api/chat` endpoint'ini test edin
- Qdrant bağlantısını kontrol edin

