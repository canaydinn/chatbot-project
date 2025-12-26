# Private Key Formatı Düzeltme Rehberi

"DECODER routines::unsupported" hatası, private key formatının yanlış olmasından kaynaklanır.

## Sorun

`.env.local` dosyanızdaki `GOOGLE_PRIVATE_KEY` değeri yanlış formatta.

## Çözüm Adımları

### 1. Google Service Account JSON Dosyasını Açın

İndirdiğiniz JSON key dosyasını bir metin editöründe açın (Notepad++, VS Code, vb.)

### 2. `private_key` Değerini Bulun

JSON dosyasında şuna benzer bir satır bulacaksınız:

```json
{
  "type": "service_account",
  "project_id": "your-project-id",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC7VJTUt9Us8cKjMzEfYyjiWA4R4/M2b01ZsfJ2Ac1JBpXeoDHYhw2W\n...çok uzun base64 string (2000+ karakter)...\n-----END PRIVATE KEY-----\n",
  "client_email": "your-service@project.iam.gserviceaccount.com",
  ...
}
```

### 3. `private_key` Değerini Kopyalayın

**ÖNEMLİ:** Sadece değeri kopyalayın (tırnaklar dahil değil, ama içerik tam olmalı)

Örnek:
```
-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC7VJTUt9Us8cKjMzEfYyjiWA4R4/M2b01ZsfJ2Ac1JBpXeoDHYhw2W
...çok uzun (2000+ karakter)...
-----END PRIVATE KEY-----
```

### 4. `.env.local` Dosyasını Düzenleyin

`.env.local` dosyanızda `GOOGLE_PRIVATE_KEY` satırını şu formatta güncelleyin:

```env
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service@project.iam.gserviceaccount.com

GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC7VJTUt9Us8cKjMzEfYyjiWA4R4/M2b01ZsfJ2Ac1JBpXeoDHYhw2W\n...TAMAMINI KOPYALAYIN (2000+ karakter)...\n-----END PRIVATE KEY-----\n"

GOOGLE_SPREADSHEET_ID=15lrjPju99gluZ0m1eG7G6ecHlr4e7UshgXC0rM7vtFA
```

### 5. Önemli Kontroller

✅ **Çift tırnak içinde olmalı**: `"..."`  
✅ **\n karakterleri korunmalı**: `\n` (backslash + n)  
✅ **5 tire**: `-----BEGIN` ve `-----END` (5 tire)  
✅ **Tam uzunluk**: Private key genellikle 2000+ karakter uzunluğunda olmalı  
✅ **BEGIN ve END kısımları**: Her ikisi de olmalı

### 6. Windows Notepad Kullanıyorsanız

Notepad bazen `\n` karakterlerini kaybedebilir. Şunları deneyin:

**Seçenek 1:** VS Code veya Notepad++ kullanın

**Seçenek 2:** JSON dosyasından direkt kopyalayıp `.env.local`'e yapıştırın, sonra:
- Başına ve sonuna çift tırnak ekleyin: `"`
- `\n` karakterlerinin korunduğundan emin olun

### 7. Test Edin

1. `.env.local` dosyasını kaydedin
2. Dev server'ı yeniden başlatın (Ctrl+C, sonra `npm run dev`)
3. Test endpoint'ini açın: `http://localhost:3000/api/auth/test`

## Hata Devam Ederse

Test endpoint'i artık daha detaylı bilgi verecek:
- Private key uzunluğu
- BEGIN/END kontrolü
- İlk ve son karakterler

Bu bilgileri paylaşın, birlikte çözelim.

## Örnek Doğru Format

```env
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC7VJTUt9Us8cKjMzEfYyjiWA4R4/M2b01ZsfJ2Ac1JBpXeoDHYhw2W\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC7VJTUt9Us8cKjMzEfYyjiWA4R4/M2b01ZsfJ2Ac1JBpXeoDHYhw2W\n... (çok uzun, 2000+ karakter) ...\n-----END PRIVATE KEY-----\n"
```

**Not:** Bu sadece bir örnek. Gerçek private key'iniz çok daha uzun olacak (2000+ karakter).

