# Uygulamayı Çalıştırma Rehberi

## 🚀 Hızlı Başlangıç

### 1️⃣ Environment Variables Dosyası Oluştur

Proje kök dizininde `.env.local` dosyası oluşturun ve aşağıdaki içeriği ekleyin:

**Windows'ta:**
- Notepad veya herhangi bir metin editörü ile `.env.local` dosyası oluşturun
- Dosyayı proje kök dizinine kaydedin (package.json ile aynı yerde)

**İçerik:**
```env
OPENAI_API_KEY=sk-your-openai-api-key-here
QDRANT_URL=https://your-qdrant-url.com
QDRANT_API_KEY=your-qdrant-api-key-here
```

**Önemli:** 
- `OPENAI_API_KEY` ve `QDRANT_URL` değerlerini kendi değerlerinizle değiştirin
- `QDRANT_API_KEY` sadece cloud Qdrant kullanıyorsanız gereklidir

### 2️⃣ Dependencies Yükle (İlk Kez Çalıştırıyorsanız)

Terminal'de proje dizininde:

```bash
npm install
```

### 3️⃣ Development Server'ı Başlat

```bash
npm run dev
```

### 4️⃣ Tarayıcıda Aç

Tarayıcınızda şu adrese gidin:
```
http://localhost:3000
```

---

## 📝 İlk Kullanım - Yönerge Verilerini Yükleme

Chatbot'un çalışması için Qdrant'a yönerge verilerini yüklemeniz gerekiyor:

### Adım 1: YÖNERGE.docx Dosyasını Hazırla

`YÖNERGE.docx` dosyasını proje kök dizinine koyun.

### Adım 2: Yükleme Script'ini Çalıştır

```bash
npm run process-yonerge
```

veya dosya yolunu belirtin:

```bash
npm run process-yonerge "C:\path\to\YÖNERGE.docx"
```

Bu işlem:
- ✅ Word dosyasını okur
- ✅ Hiyerarşik başlıklara göre parse eder
- ✅ OpenAI ile vektörleştirir
- ✅ Qdrant'a yükler

**Not:** Bu işlem sadece bir kez yapılması yeterlidir. Veriler Qdrant'ta saklanır.

---

## 🎯 Kullanım

1. Tarayıcıda `http://localhost:3000` açın
2. Chatbot arayüzü görünecek
3. Sağ tarafta yönerge bölümlerini görebilirsiniz
4. Soru sorun veya bölüm seçin
5. Asistan yanıt verecektir

---

## ⚠️ Sorun Giderme

### Uygulama Başlamıyor

- ✅ `.env.local` dosyası var mı?
- ✅ Environment variables doğru mu?
- ✅ `npm install` çalıştırdınız mı?
- ✅ Port 3000 kullanımda mı? (Farklı port: `npm run dev -- -p 3001`)

### API Çalışmıyor

- ✅ Browser console'da hata var mı?
- ✅ Network tab'ında request başarılı mı?
- ✅ Environment variables doğru tanımlı mı?

### Qdrant Bağlantı Hatası

- ✅ `QDRANT_URL` doğru mu?
- ✅ Qdrant instance'ınıza erişilebiliyor mu?
- ✅ Cloud Qdrant kullanıyorsanız `QDRANT_API_KEY` tanımlı mı?

---

## 📦 Komutlar

```bash
# Development server başlat
npm run dev

# Production build
npm run build

# Production server başlat
npm start

# Yönerge dosyasını Qdrant'a yükle
npm run process-yonerge
```

---

## 🌐 Vercel Deployment

Vercel'de environment variables'ları eklediyseniz:

1. GitHub'a push yapın
2. Vercel otomatik deploy eder
3. Veya manuel: `vercel` komutu ile

**Not:** Vercel'de de yönerge verilerini yüklemek için `process-yonerge` script'ini local'de çalıştırmanız yeterli (veriler Qdrant'ta saklanır).

