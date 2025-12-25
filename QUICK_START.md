# Hızlı Başlangıç Rehberi

## 1. Local Development (Yerel Geliştirme)

### Adım 1: Environment Variables Dosyası Oluştur

Proje kök dizininde `.env.local` dosyası oluşturun:

```bash
# Windows (PowerShell)
New-Item .env.local

# Mac/Linux
touch .env.local
```

### Adım 2: Environment Variables'ları Ekleyin

`.env.local` dosyasına aşağıdaki değişkenleri ekleyin:

```env
OPENAI_API_KEY=sk-your-openai-api-key-here
QDRANT_URL=https://your-qdrant-url.com
QDRANT_API_KEY=your-qdrant-api-key-here  # Opsiyonel
```

**Not**: 
- `OPENAI_API_KEY`: OpenAI dashboard'dan aldığınız API key
- `QDRANT_URL`: Qdrant instance URL'iniz (cloud veya self-hosted)
- `QDRANT_API_KEY`: Sadece cloud Qdrant kullanıyorsanız gerekli

### Adım 3: Dependencies'leri Yükleyin (İlk Kez Çalıştırıyorsanız)

```bash
npm install
```

### Adım 4: Development Server'ı Başlatın

```bash
npm run dev
```

Uygulama `http://localhost:3000` adresinde çalışacaktır.

### Adım 5: Tarayıcıda Açın

Tarayıcınızda `http://localhost:3000` adresine gidin.

---

## 2. Vercel Deployment (Canlı Yayın)

### Adım 1: Vercel'de Environment Variables Ekleme

1. Vercel Dashboard → Projenizi seçin
2. **Settings** → **Environment Variables**
3. Aşağıdaki variables'ları ekleyin:
   - `OPENAI_API_KEY`
   - `QDRANT_URL`
   - `QDRANT_API_KEY` (opsiyonel)

### Adım 2: Deploy

Vercel otomatik olarak GitHub'a push yaptığınızda deploy eder. Veya manuel olarak:

```bash
# Vercel CLI ile
vercel

# veya GitHub üzerinden otomatik deploy
```

---

## 3. İlk Kullanım - Yönerge Dosyasını Yükleme

Chatbot'un çalışması için Qdrant'a yönerge verilerini yüklemeniz gerekir:

### Adım 1: YÖNERGE.docx Dosyasını Hazırlayın

`YÖNERGE.docx` dosyasını proje kök dizinine koyun.

### Adım 2: Script'i Çalıştırın

```bash
npm run process-yonerge
```

veya dosya yolunu belirtin:

```bash
npm run process-yonerge "path/to/YÖNERGE.docx"
```

Bu script:
- Word dosyasını okur
- Hiyerarşik başlıklara göre parse eder
- OpenAI ile vektörleştirir
- Qdrant'a yükler

---

## 4. Sorun Giderme

### Uygulama Çalışmıyor

1. **Environment variables kontrol edin**: `.env.local` dosyasının doğru olduğundan emin olun
2. **Port kontrolü**: 3000 portu kullanımda mı? Farklı bir port deneyin: `npm run dev -- -p 3001`
3. **Dependencies**: `npm install` çalıştırdınız mı?

### API Route Çalışmıyor

1. **Console'u kontrol edin**: Browser console'da hata var mı?
2. **Network tab**: Request/response'ları kontrol edin
3. **Environment variables**: Vercel'de veya local'de doğru tanımlı mı?

### Qdrant Bağlantı Hatası

1. **QDRANT_URL kontrolü**: URL doğru mu? Erişilebilir mi?
2. **QDRANT_API_KEY**: Cloud Qdrant kullanıyorsanız mutlaka tanımlı olmalı
3. **Network**: Qdrant instance'ınıza internet üzerinden erişilebiliyor mu?

---

## 5. Kullanım

1. Tarayıcıda `http://localhost:3000` açın
2. Chatbot arayüzü görünecek
3. Sağ tarafta yönerge bölümlerini görebilirsiniz
4. Soru sorun veya bölüm seçin
5. Asistan yanıt verecektir

---

## Hızlı Komutlar

```bash
# Development server başlat
npm run dev

# Production build
npm run build

# Production server başlat
npm start

# Yönerge dosyasını yükle
npm run process-yonerge
```

