# Proje durumu

## V0 ve V1 süre kilidi

Hafta 1, 5 ve 9 için süre kilidi ve soru hakkı sayacı yazıldı. Dakika uydurulmadı. Kota sayısı uydurulmadı. Kaynak listesinin içeriği yazılmadı.

Veritabanı: `supabase/migrations/20261011220000_v0_v1_lock.sql`. Bu dosya barındırılan `is_plani` projesine uygulanmadı.

- `weeks.v0_minutes` ve `weeks.v1_minutes` boş başlar. İkisi birlikte boşsa veya eşit değilse aşama açılmaz. Eşit ve pozitif olmaları gerekir. Giriş yeri `/ogretim`. Yalnız `INSTRUCTOR` ve `ADMIN` kaydeder. V1, V0 ile aynı dakikayı kullanır.
- `participant_week_stages` katılımcı, hafta, aşama (`V0_OPEN`, `V0_LOCKED`, `V1_OPEN`, `V1_LOCKED`), açılış ve bitiş zamanını tutar. Güncelleme yoktur; her geçiş yeni satırdır. Saat `now()` ile ölçülür. İstemci saati yazılmaz.
- `ai_request_quotas` katılımcı, hafta, limit ve kullanılan sayıyı tutar. Limit `MAX_RAG_REQUESTS_PER_STUDENT_PER_WEEK` ayarından gelir. Ayar boşsa hak gösterilmez ve `/api/chat` “Soru hakkı ayarı yok” der. `.env.example` anahtarı boştur.

Davranış:

- V0 gönderilince kilitlenir ve aynı dakikayla V1 açılır. Özet boşsa gönderim kabul edilmez.
- V0 aşamasında RAG ve yapay zeka geri bildirimi sunucuda kapalıdır. Kota düşülmez.
- V1 aşamasında sohbet yalnız `RAG_ASSISTED` öğrenciye açılır. `CONTROL` sohbet bileşenini görmez; onaylı kaynak listesi yer tutucusunu görür. Liste içeriği bekleniyor.
- Süre bitince taslak varsa gönderim olarak kilitlenir ve durumu `TIMED_OUT` olur. V0 taslağı V1’i açar. Taslak yoksa `missing_data_log` içine `NOT_SUBMITTED` yazılır ve V1 açılmaz. Puan satırı yazılmaz; puan sıfıra çevrilmez.
- Her gönderimde `revision_duration_seconds` ve `ai_interaction_count` sunucuda hesaplanır. `revision_summary` öğrencinin kısa metnidir. Süre bitiminde özet boş kalır.
- Sohbet isteği `consume_rag_quota` ile atomik düşer. Hak bitince `/api/chat` reddeder. Öğrenci arayüzü kalan hakkı bu sayıyla gösterir. Para tutarı yoktur.
- V0 veya V1 metni yoksa karşılaştırma ekranı “Eksik sürüm olduğu için fark hesaplanmaz” der. Sayısal fark üretilmez.

Test: `npm test` 40 testi geçti. Süre, kota ve erişim testleri `lib/research/stages.test.ts`, `lib/research/access.test.ts` ve `supabase/stages.test.ts` içindedir. SQL testi PGlite üzerinde iki migration’ı uygular. V0 sohbet reddi, kilitli satırın değişmemesi, kontrol grubunun V1 sohbetine girmemesi, limit 1 iken ikinci düşüşün boş dönmesi, taslaklı sürenin `TIMED_OUT` yazıp puan satırı açmaması ve taslaksız sürenin `NOT_SUBMITTED` yazıp V1 açmaması geçti. `npx tsc --noEmit` temiz bitti.

Test edilemedi:

- Barındırılan veritabanında yeni migration çalıştırılmadı. Aktif hafta açılırsa uygulama bu tabloları arar; migration uygulanmadan o sorgular hata verir.
- Giriş yapmış öğrencide süre, kilit, kota ve kontrol listesi tarayıcıda tıklanmadı. Genel anahtarlar tarayıcıya gelmediği için oturum açılamadı.
- İki eşzamanlı veritabanı bağlantısı kurulmadı. Kota sınırı tek bağlantıda art arda iki çağrıyla görüldü.
- Canlı sohbet modeli çağrılmadı.

## Düzeltmeler

Yeni özellik eklenmedi. Beş karar uygulandı.

- `/chat` ve `/hafta` sunucuda `readActor` ile bakılır. Oturum yoksa girişe dönülür. Araştırma kodu yoksa form açılmaz; “Araştırma kodunuz yok” mesajı gösterilir. Kod varsa `/chat` yine `/hafta` adresine gider.
- `decideAiAccess` RAG ve gömme çağrısını yalnız `STUDENT` rolüne açar. Diğer koşullar durur. `AI_FEEDBACK` bu rol kuralının dışındadır.
- `studentSessionPayload` gelen rolü olduğu gibi döndürür.
- `/api/chat` hata gövdesi sabit bir cümledir. İleti ve yığın izi yalnız sunucu günlüğüne yazılır.
- Kaldır düğmesi öğrencinin `plan_<kod>` arama dizinini siler. `submissions` satırlarına dokunmaz. Aynı ayrım onam yer tutucusunda yazılıdır.
- Gömme yüklemesi yeni dosyadan önce aynı kodun dizinini silip yeniden kurar. Parça sayısı düşünce eski yüksek indeksler kalmaz. Metin çıkaran `/api/student/file` noktası yazmaz.

Test: `npm test` 28 testi geçti. Sayfa kararı, rol kapısı, gerçek rol, hata gövdesi, dizin silme ve yüksek indeks temizliği bu sayıdadır.

Test edilemedi:

- Giriş yapmış oturum ve kodsuz kullanıcı tarayıcıda denenemedi. Genel anahtarlar olmadığı için sayfalar “Oturum hizmeti yapılandırılmamış” dedi. `/hafta` ve `/chat` bu mesajı sunucuda bastı; form açılmadı.
- Canlı Qdrant koleksiyonu silinmedi ve yeni dosyayla değiştirilmedi.
- Canlı sohbet hatası üretilmedi. Gövdenin ileti taşımadığı birim testiyle görüldü.
- Gönderim satırlarının durduğu canlı veritabanında çalıştırılmadı. Silme işlevi gönderim tablosu almaz ve `submissions: "keep"` döner.

## Öğrenci arayüzü

Veritabanı katmanı bu işe başlarken duruyordu. Şema, RLS ve testler yerindeydi. Arayüz o katmana bağlandı. V0/V1 süre kilidi sonraki bölümde yazıldı.

Ekranlar:

- `/` e-posta ve altı haneli kod. Doğrulama sonrası `/onam`.
- `/onam` yer tutucu bilgilendirme. Katılmayan öğrenci ders ekranına gider. Onam satırı, etik alanlar boşken veritabanı tetiği yüzünden yazılamaz; ekran bunu söyler ve dersi kapatmaz.
- `/ana` aktif haftanın başlığı ve görev etiketleri, kalan süre, önceki hafta özetleri.
- `/hafta` `weekly_form_fields` alanları. Yazarken taslak önce tarayıcıda, araştırma kodu varsa `events` içinde `FORM_DRAFT` olarak durur. V0/V1 haftasında gönderim sunucudaki aşama işlevine gider ve kısa revizyon özeti ister. Diğer haftalarda gönder, boşsa V0, o doluysa V1 satırı ekler.
- Sohbet paneli yalnızca sunucu `coachPanel` alanını `true` döndürünce yüklenir. Bu alan `RAG_ASSISTED` ve açık V1 aşamasında doğrudur. Kontrol grubu V1’de kaynak listesi yer tutucusunu görür. `/api/chat` grubu ve aşamayı sunucuda reddeder. Kalan soru hakkı, kota satırı veya ayar varsa gerçek sayıdır. Ayar yoksa “Soru hakkı ayarı yok” yazar.
- Nitel kart: güçlü yönler, eksik kanıt, desteksiz varsayım, tutarsızlık, önerilen revizyon. Kaynak tablo yok; hepsi boş durumdadır.
- `/karsilastirma` öğrencinin kendi V0 ve V1 metinleri. Dar ekranda alt alta, geniş ekranda yan yana.
- İş planı dosyası `/api/student/file` ile okunur. Metin çıkmazsa Türkçe hata gösterilir. Bu uç gömme yapmaz. Eski `/api/upload` gömmesi durur ve RAG kapısından geçer; yeni ekran onu çağırmaz.

Puan kolonları öğrenci yanıtına seçilmez. İstemci, oturum ve hafta JSON'undan izinli alanları ayıklar. `questionsRemaining` ve `timeRemaining` negatif olmayan tam sayıysa durur; bozuk veya eksik değerde `null` kalır. Eski A–F düğmeleri ve bölüm puanı satırı kalktı. `/chat` `/hafta` adresine gider.

Kalan süre, açık aşamanın bitişinden sunucu saatiyle saniye olarak gelir. Dakika boşsa “Süre henüz girilmedi” denir.

Test: `npm test` 22 testi geçti. Öğrenci görünümü, puan anahtarının istemci durumuna girmemesi ve dosya hata metinleri bu sayıya dahildir.

Tarayıcı: giriş sayfası, `/ana`, `/hafta`, `/onam`, `/karsilastirma` ve `/chat` açıldı. `/chat` haftalık forma döndü. Oturumsuz API çağrıları 503 ve `Oturum hizmeti yapılandırılmamış` döndürdü; yanıtta puan alanı yoktu. 390 piksel genişlikte kabuk taşmadı. Genel Supabase anahtarları tarayıcıya gelmediği için kod gönderilemedi. Giriş yapmış öğrencide form, onam, sohbet, dosya ve sürüm ekranları tıklanarak denenemedi.

## Veritabanı katmanı

Şema `supabase/migrations/20261011180000_research_schema.sql` içindedir. Bu dosya, önceki migration’daki eski tablo adlarını kaldırıp aşağıdaki tabloları kurar. Hafta 5, verilen kararla V0/V1 haftasıdır. Form alanları `docs/HAFTALIK_ICERIK.md` metninden yazıldı. Etik onay değerleri boş bırakıldı.

Tablolar: `profiles`, `research_identity_map`, `participants`, `consents`, `ethics_settings`, `weeks`, `weekly_form_fields`, `submissions`, `events`, `scores`, `missing_data_log`, `legacy_sheet_import`. Hepsinin Row Level Security ayarı ve `FORCE ROW LEVEL SECURITY` açık.

Kimlik: Supabase Auth e-posta tek kullanımlık kodu `app/page.tsx` içinde duruyor. Arayüz bu aşamada değiştirilmedi. `lib/auth/actor.ts` oturumu çerezdeki `sub` ile okur; e-posta başlığına bakmaz. Profil, `research_identity_map`, `participants`, `consents` ve aktif `weeks` satırını sunucudaki `SUPABASE_SECRET_KEY` ile okur. Aktif hafta yoksa veya aktif hafta V0/V1 ise faz `V0` kalır. Ayrı bir `ai_phase` kolonu yok.

`research_identity_map` satırını yalnız `ADMIN` rolü okuyabilir. `scores` satırını `STUDENT` ve `EXPERT_EVALUATOR` okuyamaz. Okuma `ADMIN`, `INSTRUCTOR` ve `RESEARCH_ANALYST` ile sınırlı. Gönderim, olay, puan, onam, eksik veri ve sayfa aktarım kayıtları güncellenemez ve silinemez. Eksik gözlem kaydı varken aynı gönderime puan yazılamaz. Puan toplamı veritabanında tam sayı binlik puandır; `100000` yüz puana karşılık gelir. Para kolonu yok. Bütçe hesabı `lib/budget` içinde mikro USD tam sayısı olarak duruyor.

Kayıt kapısı: `ethics_settings.enrollment_open` ancak kurul adı, onay tarihi, onay numarası, protokol sürümü, onam sürümü, saklama süresi, veri sorumlusu, araştırma iletişimi, başlangıç ve bitiş tarihleri, yetkili işleyenler ve yapay zeka sağlayıcıları doluyken true olabilir. Bu alanlar boşken katılımcı, kimlik eşlemesi ve onam eklenemez.

Hizmet anahtarı `.env.example` içinde `SUPABASE_SECRET_KEY` olarak durur. `NEXT_PUBLIC_` öneki yoktur. İstemci `lib/supabase/browser.ts` yalnız yayınlanabilir anahtarı kullanır.

Aktarım betiği `scripts/import-legacy-sheets.ts`. Eski puan hücrelerini `scores` tablosuna yazmaz; `legacy_sheet_import.raw_row` içine koyar. `ALLOW_CROSS_BORDER_TRANSFER=I_HAVE_LEGAL_APPROVAL` yoksa ağ çağrısı yapmadan durur. Betik çalıştırılmadı.

Test: `npm test` 18 testi geçti. RLS testi yerel PGlite üzerinde migration’ı uyguladı. On iki tabloda RLS ve FORCE doğrulandı. Öğrenci rolüyle `scores` doğrudan sorgu, `WITH` sorgusu ve gönderim birleştirmesi sıfır satır döndürdü. Öğrencinin puan eklemesi row-level security ile reddedildi. `anon` rolünün `scores` okuması yetki hatası verdi. Hafta 5 bayrağı ve 76 form alanı sayıldı.

Doğrulanamadı:

- Barındırılan Supabase projesine bağlanılmadı. Gerçek `auth.uid()`, e-posta kodunun iletilmesi ve `service_role` anahtarının RLS davranışına karşı çalıştırma yok.
- Google Sheets okunmadı. Aktarım betiği çalıştırılmadı.
- Arayüzün tarayıcı denemesi yukarıdaki öğrenci arayüzü bölümündedir. Giriş yapmış akış, anahtarlar tarayıcıya gelmediği için denenemedi.

Aşağıdaki bölümler, bu şemadan önceki dosya okumasını anlatır. Kimlik tabloları artık `research_identity_map`, `participants`, `consents` ve `weeks` adlarını kullanır.

## Önceki dosya okuması

İki katman var. **Çalışma ağacı**, diskte okunan güncel dosyalardır. **Son commit** `1dc3b65` (`fix: move outputFileTracingIncludes out of experimental`) bu dosyaların bir kısmından farklıdır. Fark, aşağıdaki bölümlerde ayrıca yazıldı. Çalıştırma, canlı Qdrant veya canlı Sheets sonucu yoktur.

Okunan görev dosyaları: `docs/ANA_PROMPT.md` (dönüşüm talimatı), `docs/HAFTALIK_ICERIK.md` (10 haftalık içerik). İkisi de çalışan uygulama kodu değildir.

## 1. Klasör yapısı ve bağımlılıklar

Next.js App Router projesi. `src/` yok.

- `app/layout.tsx`, `app/globals.css`, `app/page.tsx` (giriş), `app/chat/page.tsx` (sohbet)
- `app/api/auth/check/route.ts`, `register/route.ts`, `session/route.ts`, `test/route.ts`
- `app/api/chat/route.ts`, `debug/route.ts`, `test/route.ts`
- `app/api/upload/route.ts`
- `app/api/scores/route.ts`
- `app/api/admin/import-sheets/route.ts`
- `lib/auth/actor.ts`
- `lib/research/access.ts`, `access.test.ts`
- `lib/budget/manager.ts`, `manager.test.ts`, `pricing.ts`
- `lib/supabase/admin.ts`, `browser.ts`, `server.ts`
- `supabase/migrations/20261010120000_research_platform.sql`
- `scripts/process-yonerge.ts`
- `proxy.ts` (kökte; `middleware.ts` yok)
- `public/` içinde `file.svg`, `vercel.svg`, `window.svg`
- `docs/`: `ANA_PROMPT.md`, `HAFTALIK_ICERIK.md`, `BUTCE_VE_LLM.md`, bu rapor
- Kurulum notları kökte: `README.md`, `SETUP.md`, `QUICK_START.md`, `GOOGLE_SHEETS_SETUP.md`, `PRIVATE_KEY_SETUP.md`, `ENV_FORMAT_EXAMPLE.txt`, `VERCEL_*.md`, `DEPLOY_*.md`
- `next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `postcss.config.mjs`, `package.json`, `package-lock.json`

`package.json` içindeki `dependencies`:

| Paket | Sürüm alanı |
| --- | --- |
| `@ai-sdk/openai` | `^3.0.1` |
| `@ai-sdk/react` | `^3.0.3` |
| `@qdrant/js-client-rest` | `^1.16.2` |
| `@supabase/ssr` | `^0.12.7` |
| `@supabase/supabase-js` | `^2.117.3` |
| `ai` | `^6.0.3` |
| `dotenv` | `^17.2.3` |
| `googleapis` | `^169.0.0` |
| `lucide-react` | `^0.562.0` |
| `mammoth` | `^1.11.0` |
| `next` | `16.1.1` |
| `openai` | `^6.15.0` |
| `pdf-parse` | `^2.4.5` |
| `react` | `19.2.3` |
| `react-dom` | `19.2.3` |
| `zod` | `^4.2.1` |

`devDependencies`: `@tailwindcss/postcss` `^4`, `@types/node` `^20`, `@types/react` `^19`, `@types/react-dom` `^19`, `eslint` `^9`, `eslint-config-next` `16.1.1`, `tailwindcss` `^4`, `tsx` `^4.21.0`, `typescript` `^5`.

Betikler: `dev`, `build`, `start`, `lint`, `test` (`lib/budget/manager.test.ts` ve `lib/research/access.test.ts`), `process-yonerge`.

`package-lock.json` içinde `googleapis` çözümü `169.0.0`, `googleapis-common` `8.0.1`. Çalışma ağacındaki `.ts` / `.tsx` dosyalarında `googleapis` importu yok.

## 2. API rotaları

Çalışma ağacındaki davranış:

| Rota | Metot | İşlev |
| --- | --- | --- |
| `/api/auth/session` | GET | `readActor()`. Oturum yoksa 401. Varsa öğrenci oturum gövdesi. Gövde şekli veya gizli puan anahtarı denetimi hata verirse 503. |
| `/api/auth/check` | POST | 410. Gövde: e-posta ile doğrudan giriş kapatıldı. |
| `/api/auth/register` | POST | 410. Gövde: e-posta ile doğrudan kayıt kapatıldı. |
| `/api/auth/test` | GET | 404. Gövde: `Kapalı.` |
| `/api/chat` | POST | Oturum ve `gateOperation(..., "RAG")`. Geçerse son kullanıcı metnini `text-embedding-3-small` ile gömer, Qdrant arar, `gpt-4o-mini` ile `streamText` döner. |
| `/api/chat/debug` | GET | 404. `Kapalı.` |
| `/api/chat/test` | GET | 404. `Kapalı.` |
| `/api/upload` | POST | Oturum, `gateOperation(..., "EMBEDDING")` ve `researchCode`. `.txt`, `.docx`, `.pdf` metnini parçalayıp `plan_<kod>` koleksiyonuna yazar. |
| `/api/scores` | POST | 403. Gövde, istemciden puan yazımının kapatıldığını söyler. Yazma yok. |
| `/api/admin/import-sheets` | POST | `ALLOW_CROSS_BORDER_TRANSFER` değeri `I_HAVE_LEGAL_APPROVAL` değilse 409 ve ağ çağrısı yok. Eşitse 501; yanıt veri taşınmadığını söyler. |

`HEAD` üzerinde `/api/auth/check`, `/api/auth/register`, `/api/auth/test` ve `/api/scores` Google Sheets çağırır. `/api/auth/session` ve `/api/admin/import-sheets` bu commit’te yoktur. Ayrıntı 3, 5 ve 6. bölümlerde.

## 3. Kimlik doğrulama ve zayıf noktalar

### Çalışma ağacı

Giriş `app/page.tsx` içindedir. `createBrowserSupabase().auth.signInWithOtp({ email })`, ardından `verifyOtp({ email, token, type: "email" })`. İstemci, kodu göndermeden önce altı hane kontrol eder. Başarılı doğrulamadan sonra `router.push("/chat")`. `localStorage` kullanımı bu dosyalarda yok.

Sunucu kimliği `lib/auth/actor.ts` `readActor()` ile okunur. `createServerSupabase().auth.getClaims()` içinden `sub` alınır. Profil, kimlik eşlemesi, katılımcı koşulu, son durum, son onam ve `study_settings` hizmet anahtarıyla (`SUPABASE_SECRET_KEY`, `lib/supabase/admin.ts`) okunur. İstek gövdesindeki veya başlıktaki e-posta bu yolda kullanılmaz.

`/api/chat` ve `/api/upload` bu aktörü alır. `decideAiAccess` şunların hepsini ister: faz `V0` veya `TEST` olmasın, onam `ACCEPTED` olsun, durum `ACTIVE` olsun, koşul `RAG_ASSISTED` olsun. `proxy.ts` çerezleri yenilemek için `getClaims()` çağırır. Eşleşen istekleri reddetmez. `NEXT_PUBLIC_SUPABASE_URL` veya `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` yoksa proxy hiç Supabase istemcisi kurmaz.

Kodda görülen zayıflıklar:

- `/chat` sayfası sunucuda kesilmez. Yetki, tarayıcıda `/api/auth/session` 200 ise `isAuthorized = true` yapılmasıdır. Araştırma kodu veya rol bu adımda aranmaz.
- `decideAiAccess` rol okumaz. `operation` argümanı (`RAG`, `EMBEDDING`, `AI_FEEDBACK`) kararı değiştirmez. `/api/chat` rolü ayrıca kontrol etmez. `RAG_ASSISTED` koşullu, onamı kabul edilmiş ve durumu `ACTIVE` olan bir kullanıcı, profil rolü `STUDENT` olmasa da bu rotaya girebilir. Böyle bir satırın veritabanında olup olmadığı doğrulanamadı.
- `studentSessionPayload` yanıtta `role` alanını her zaman `"STUDENT"` yazar. Gerçek rol bu uçtan okunamaz. `aiCoachEnabled` ise gerçek rol `STUDENT` ise ve karar izin veriyorsa true olur.
- `readActor` hizmet anahtarı kullandığı için bu okumalar migration’daki RLS politikalarından geçmez. `identity_links` yorumu bunu açıkça yazar.
- Migration RLS açar ama authenticated politika yazmaz: `identity_links`, `blinded_plan_links`. RLS satırı hiç yok: `plan_sections`, `cycle_dimensions`, `rubric_versions`, `final_criteria`, `research_participants`, `participant_status_events`, `ai_pricing_versions`, `ai_budget_reservations`. Bu tablolara istemciden erişilip erişilemediği doğrulanamadı; migration’da bu tablolar için `GRANT` / `REVOKE` yok.
- `/api/admin/import-sheets` aktör kontrolü yapmaz. Şu anki dallar veri taşımaz.
- `/api/chat` hata gövdesinde `error.message` her ortamda döner. Geliştirmede yığın izi de eklenir.
- `signInWithOtp` çağrısı `shouldCreateUser` geçmez. Yeni `auth.users` satırı oluşursa `handle_new_user` tetikleyicisi `profiles.role = 'STUDENT'` yazar. Supabase projesinde kaydın açık olup olmadığı doğrulanamadı.

### Son commit `1dc3b65`

Oturum, Sheets’te e-posta araması ve `localStorage` anahtarları `userEmail` / `userName` üzerindedir (`app/page.tsx`, `app/chat/page.tsx`). `/api/chat` koleksiyon adını gövdedeki `email` veya `x-user-email` başlığından kurar; sunucu oturumu yok. `/api/upload` formdaki `email` alanını ister. `/api/scores` gövdedeki e-posta ve puanı, oturum kontrolü olmadan Sheets’e yazar.

## 4. Qdrant: koleksiyonlar ve parçalama

İstemci: `@qdrant/js-client-rest`. Adres `QDRANT_URL`. `QDRANT_API_KEY` koda göre opsiyoneldir. Canlı koleksiyon listesi doğrulanamadı.

### Yönerge koleksiyonu `is_plani_rehberi`

Yazan: `scripts/process-yonerge.ts`. Girdi `process.argv[2]` veya `YÖNERGE.docx`. `.txt` ve `.docx` okunur. `.pdf` bu betikte yok.

Parçalama karakter sayısına göre değildir. Satır `^([A-Z])\.(\d+(?:\.\d+)*)\.\s+(.+)$` ile eşleşince yeni bölüm açılır. Bölüm kodu `A.1.1` biçimindedir. `Amaç`, `Aranan unsurlar` ve `Puanlama Mantığı` ayrı regex ile kesilir. Üçü de boşsa parça atlanır. Amaç beş satırdan uzunsa ilk beş satır kalır.

Vektör: birleştirilmiş bölüm, amaç, aranan unsurlar ve puanlama metninin `text-embedding-3-small` gömüsü. Koleksiyon boyutu 1536, mesafe `Cosine`. Nokta kimliği dizi indeksi. Yük `sectionCode`, `title`, `purpose`, `searchedElements`, `scoringLogic`, `originalText`.

`/api/chat` bu koleksiyonda `limit: 3` arar. Koleksiyon 404 ise 500 döner.

### Kullanıcı dosyası

Çalışma ağacı: ad `plan_` + `researchCode` içindeki harf ve rakam dışı karakterler `_` yapılıp 50 karaktere kesilir. Kod yoksa yükleme 403 olur; sohbet kullanıcı koleksiyonu aramaz.

`app/api/upload/route.ts` `chunkText(text, 1000, 200)` kullanır. Satırlar birikir. Birikim artı satır 1000 karakteri aşınca parça kapanır. Örtüşme, kapanan parçanın son `Math.floor(200 / 50)` satırıdır, yani 4 satır. Yeni parça bu satırlarla devam eder. Gömü yine `text-embedding-3-small`. Koleksiyon yoksa 1536 / `Cosine` oluşturulur. Varsa silinmez; yorum “will update” der. Nokta kimliği parça indeksi `i`. Onar onar `upsert`. Yük: `text`, `fileName`, `chunkIndex`, `totalChunks`, `uploadedAt`.

Sohbet araması: soru metni `değerlendir`, `eksik` veya `iş planını` içeriyorsa limit 8, aksi halde 3.

`HEAD`: koleksiyon adı e-postanın base64 değerinden türetilir, `user_<temizlenmiş>` ve en fazla 50 karakter. E-posta istemciden gelir. Parça boyutu ve 1536 / `Cosine` aynıdır.

Dağıtım notlarındaki “61 chunk” ifadesi bu okumada yeniden sayılmadı. Doğrulanamadı.

## 5. Puanın model metninden okunması

### Çalışma ağacı

Model metninden sayısal puan çıkaran fonksiyon yok. `app/chat/page.tsx` asistan metnini `parts` içindeki `type === "text"` parçalarını birleştirerek gösterir. `/api/scores` 403 döner ve kayıt yazmaz. Qdrant alanındaki `result.score` benzerlik skorudur; değerlendirme puanı değildir.

`docs/ANA_PROMPT.md` “Bölüm Puanı: XX/100” gösteriminin ve regex okumasının kaldırılmasını ister. Bu cümle uygulama kodu değildir.

### Son commit `1dc3b65`, `app/chat/page.tsx`

`extractSectionScore` asistan metninde şunu arar:

```text
/(?:bölüm\s*puan[ıi]|genel\s*puan)\s*:\s*(\d{1,3})\s*\/\s*100/i
```

Yakalama grubu `parseInt` ile sayıya çevrilir. Sonlu değilse veya 0–100 dışında ise `null`. Eşleşme yoksa konsola uyarı yazılır ve kayıt denenmez.

Bölüm değerlendirme düğmesi, yanıt bitince bu sayıyı `POST /api/scores` gövdesine koyar: `email` (`localStorage` `userEmail`), `sectionLetter`, `score`. Aynı commit’te değerlendirme istemi, raporun sonuna `Bölüm Puanı: XX/100` satırı eklenmesini söyler.

`HEAD` `/api/scores` bu sayıyı Sheets’te yazar. Sütunlar: A `E`, B `F`, C `G`, D `H`, E `I`, F `J`. Satır, C sütunundaki e-posta ile bulunur. Başlık satırı, ilk hücresi “ad” içeren satırdır. Kullanıcı yoksa A–D aralığına boş ad, boş soyad, e-posta ve zaman damgası eklenir. Başlık varsa ve E1:J1 boşsa başlıklar `PUAN_A` … `PUAN_F` yazılır.

## 6. Google Sheets bağımlılıkları

### Çalışma ağacı

TypeScript kaynağı Sheets API çağırmaz. Kalan izler:

- `package.json` ve `package-lock.json`: `googleapis` `169.0.0`
- `ENV_FORMAT_EXAMPLE.txt`: `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY`, `GOOGLE_SPREADSHEET_ID`
- `GOOGLE_SHEETS_SETUP.md`, `PRIVATE_KEY_SETUP.md`: aynı üç değişken ve kurulum adımları
- `app/api/admin/import-sheets/route.ts`: çağrı yapmadan 409 veya 501
- `supabase/migrations/20261010120000_research_platform.sql`: `legacy_sheet_import` tablosu (`email`, `first_name`, `last_name`, `raw_row`, `imported_at`). RLS açık. Okuma politikası yalnızca `ADMIN`.

Dokümanlardaki varsayılan sayfa kimliği `15lrjPju99gluZ0m1eG7G6ecHlr4e7UshgXC0rM7vtFA`. Çalışma ağacı kodu bu kimliği kullanmaz.

### Son commit `1dc3b65`

`googleapis` importu ve `https://www.googleapis.com/auth/spreadsheets` kapsamı:

- `app/api/auth/check/route.ts`: A:C okur. C sütunu e-posta. Varsa A ve B ad-soyad döner.
- `app/api/auth/register/route.ts`: aynı aralıkta e-posta arar. Yoksa A:D satırı ekler: ad, soyad, e-posta, zaman damgası.
- `app/api/auth/test/route.ts`: sayfa üst verisi ve değer okur.
- `app/api/scores/route.ts`: 5. bölümdeki puan yazımı.

Üç ortam değişkeni ortaktır. `GOOGLE_SPREADSHEET_ID` yoksa kod `15lrjPju99gluZ0m1eG7G6ecHlr4e7UshgXC0rM7vtFA` kullanır. Sayfa adı, A1:D1 başlığında “ad” ve “e-posta” veya “eposta” geçen ilk sayfadır. Bulunamazsa ilk sayfa, o da yoksa `Sheet1`.

Bu commit’te Sheets’e yazılan veya okunan alanlar: ad, soyad, e-posta, kayıt zamanı, `PUAN_A` … `PUAN_F`.

## 7. Kaldır düğmesi

Çalışma ağacı ve `HEAD` aynı işlevi gösterir.

`app/chat/page.tsx` içinde `removeUploadedFile` yalnızca `setUploadedFile(null)` çağırır. Düğme, yüklenen dosya şeridindeki X’tir; `title` değeri “Dosyayı kaldır”.

Yapmadığı işler, bu fonksiyonda ve ona bağlı bir çağrıda yoktur:

- API isteği yok.
- Qdrant noktalarını veya koleksiyonu silen bir çağrı yok.
- Sohbet mesajlarını silmez.

Dosya yüklendikten sonra sohbet, arayüzdeki `uploadedFile` durumuna bakmadan koleksiyon arar. Çalışma ağacında ad `plan_<araştırma kodu>` ve aktörden gelir. `HEAD` içinde ad istemcinin gönderdiği e-postadan gelir. Düğme bu kaydı kaldırmaz.

Yükleme de eski noktaları silmez. Aynı indeksle `upsert` edilir. Yeni dosyanın parça sayısı eskisinden azsa, daha yüksek indekslerin durup durmadığı bu depodan doğrulanamadı; silme kodu yoktur.
