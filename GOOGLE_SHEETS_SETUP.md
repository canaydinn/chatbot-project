# Google Sheets API Kurulum Rehberi

Bu uygulama, kullanıcı kayıtlarını Google Sheets'e kaydetmek için Google Sheets API kullanmaktadır.

## Gerekli Environment Variables

| Variable Name | Zorunlu | Açıklama | Örnek Değer |
|--------------|---------|----------|-------------|
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | ✅ Evet | Google Service Account e-posta adresi | `your-service@project.iam.gserviceaccount.com` |
| `GOOGLE_PRIVATE_KEY` | ✅ Evet | Service Account private key (JSON'dan alınan) | `-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n` |
| `GOOGLE_SPREADSHEET_ID` | ⚠️ Opsiyonel | Google Sheets dosya ID'si | `15lrjPju99gluZ0m1eG7G6ecHlr4e7UshgXC0rM7vtFA` |

**Not:** `GOOGLE_SPREADSHEET_ID` belirtilmezse varsayılan olarak `15lrjPju99gluZ0m1eG7G6ecHlr4e7UshgXC0rM7vtFA` kullanılır.

## Google Service Account Oluşturma Adımları

### 1. Google Cloud Console'a Giriş

1. [Google Cloud Console](https://console.cloud.google.com/) adresine gidin
2. Yeni bir proje oluşturun veya mevcut bir projeyi seçin

### 2. Google Sheets API'yi Etkinleştir

1. **APIs & Services** > **Library** bölümüne gidin
2. "Google Sheets API" araması yapın
3. **Enable** butonuna tıklayarak API'yi etkinleştirin

### 3. Service Account Oluştur

1. **APIs & Services** > **Credentials** bölümüne gidin
2. **Create Credentials** > **Service Account** seçin
3. Service account için bir isim girin (örn: `sheets-api-service`)
4. **Create and Continue** butonuna tıklayın
5. Role kısmını boş bırakabilirsiniz veya "Editor" seçebilirsiniz
6. **Done** butonuna tıklayın

### 4. Service Account Key Oluştur

1. Oluşturduğunuz service account'a tıklayın
2. **Keys** sekmesine gidin
3. **Add Key** > **Create new key** seçin
4. Key type olarak **JSON** seçin
5. **Create** butonuna tıklayın
6. JSON dosyası bilgisayarınıza indirilecek

### 5. JSON Dosyasından Bilgileri Çıkar

İndirdiğiniz JSON dosyasını açın. Şu bilgilere ihtiyacınız var:

```json
{
  "type": "service_account",
  "project_id": "your-project-id",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "your-service@project.iam.gserviceaccount.com",
  ...
}
```

- `client_email` → `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `private_key` → `GOOGLE_PRIVATE_KEY`

### 6. Google Sheets Dosyasını Paylaş

1. Google Sheets dosyanızı açın: https://docs.google.com/spreadsheets/d/15lrjPju99gluZ0m1eG7G6ecHlr4e7UshgXC0rM7vtFA/edit
2. **Share** butonuna tıklayın
3. Service account e-posta adresini (`your-service@project.iam.gserviceaccount.com`) ekleyin
4. **Editor** yetkisi verin
5. **Send** butonuna tıklayın

**Önemli:** Service account'un dosyaya erişebilmesi için dosyayı paylaşmanız gerekmektedir!

### 7. Sheets Yapısı

Google Sheets dosyanızda şu sütunlar olmalıdır:

| A | B | C | D |
|---|---|---|---|
| Ad | Soyad | E-posta | Kayıt Tarihi |

İlk satır başlık olabilir (opsiyonel). Uygulama otomatik olarak başlık satırını algılar.

## Environment Variables Ekleme

### Local Development (.env.local)

`.env.local` dosyanıza şunları ekleyin:

```env
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY_HERE\n-----END PRIVATE KEY-----\n"
GOOGLE_SPREADSHEET_ID=15lrjPju99gluZ0m1eG7G6ecHlr4e7UshgXC0rM7vtFA
```

**Önemli:** `GOOGLE_PRIVATE_KEY` değerini tırnak içine alın ve `\n` karakterlerini koruyun.

### Vercel Deployment

1. Vercel Dashboard'a gidin
2. Projenizi seçin
3. **Settings** > **Environment Variables** bölümüne gidin
4. Her bir variable için:
   - **Name**: Variable adı
   - **Value**: Değer
   - **Environment**: Production, Preview, Development
   - **Add** butonuna tıklayın

**Önemli:** Vercel'de `GOOGLE_PRIVATE_KEY` değerini eklerken, tüm private key'i tek satırda `\n` karakterleriyle birlikte ekleyin.

## Test Etme

1. Local'de `.env.local` dosyanızı oluşturun
2. Environment variable'ları ekleyin
3. Uygulamayı çalıştırın: `npm run dev`
4. Giriş sayfasında yeni bir e-posta ile kayıt olmayı deneyin
5. Google Sheets dosyanızı kontrol edin - yeni kayıt eklenmiş olmalı

## Sorun Giderme

### "Google Service Account credentials are missing" Hatası

- Environment variable'ların doğru tanımlandığından emin olun
- `.env.local` dosyasının proje root'unda olduğundan emin olun
- Vercel'de environment variable'ların tüm ortamlar için tanımlı olduğundan emin olun

### "Permission denied" veya "Access denied" Hatası

- Service account'un Google Sheets dosyasına erişim yetkisi olduğundan emin olun
- Dosyayı service account e-posta adresiyle paylaştığınızdan emin olun
- Service account'a **Editor** yetkisi verdiğinizden emin olun

### "Invalid credentials" Hatası

- `GOOGLE_SERVICE_ACCOUNT_EMAIL` değerinin doğru olduğundan emin olun
- `GOOGLE_PRIVATE_KEY` değerinin tam ve doğru olduğundan emin olun
- Private key'deki `\n` karakterlerinin korunduğundan emin olun

## Güvenlik Notları

⚠️ **Önemli:**
- Service account private key'inizi asla public repository'lere commit etmeyin
- `.env.local` dosyasını `.gitignore`'a ekleyin
- Vercel'de environment variable'lar otomatik olarak şifrelenir
- Service account key'inizi güvenli bir yerde saklayın

