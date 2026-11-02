# GÖREV: İş Planı Danışmanı uygulamasını 10 haftalık rastgeleleştirilmiş eğitim araştırmasına uygun platforma dönüştür

## 0. Okunacak dosyalar ve genel kurallar
- docs/HAFTALIK_ICERIK.md: 10 haftalık içerik ve öğrenci formu alanları.
- docs/BUTCE_VE_LLM.md: LLM değerlendirici yapılandırması ve kesin 50 USD bütçe kontrolü. Bu belgenin tamamı bu görevin parçasıdır. Aşağıdaki kararlarla çelişirse çelişkiyi bana raporla ve karar bekle.
- Depoyu sıfırdan yazma. Önce mevcut mimariyi, kimlik doğrulamayı, API rotalarını, Qdrant kullanımını ve Google Sheets entegrasyonunu incele. Çalışan işlevleri koru.
- Hiçbir bilgiyi, model tanımlayıcısını, fiyatı veya kütüphane davranışını uydurma. Emin değilsen "bilmiyorum" de ve resmi dokümantasyonla ya da çalıştırarak doğrula.
- Araştırma içeriklerini (rubrik tanımları, onam metni, vaka metinleri, davranışsal çapa ifadeleri) kendin yazıp kesinleşmiş gibi sunma. Taslak ve yer tutucu üret ve "ONAY BEKLİYOR" olarak işaretle.
- Gizli anahtarları koda yazma. Ortam değişkenleri ve .env.example kullan.
- Küçük ve geri alınabilir commit'ler yap. Her aşama sonunda: değişiklikler, dosya listesi, testler ve sonuçları, doğrulayamadıkların, benden beklenen kararlar.
- Büyük kod değişikliğine başlamadan önce Bölüm 14'teki raporu ver ve onayımı bekle.

## 1. Araştırma tasarımı özeti
- Yaklaşık 100 öğrenci. İki koşul: CONTROL ve RAG_ASSISTED. Atama ön test puanına göre tabakalı rastgele yapılır. Atamayı yalnızca araştırmacı yapar.
- 10 hafta boyunca tek bir bütünleşik iş planı geliştirilir.
- Her iki koşul aynı dersi ve aynı haftalık görevleri alır. Fark yalnızca RAG yardımcısına erişimdir.
- Ana çıktılar: haftalık değerlendirmeler, Hafta 1, 5 ve 9 için V0 ve V1 karşılaştırması, final iş planı kalitesi, yapay zekasız transfer testi.

## 2. Veritabanı: Supabase
- Veritabanını Supabase (PostgreSQL) olarak kur. Google Sheets bağımlılığını kaldır. Mevcut Sheets verisi için aktarım betiği yaz.
- Row Level Security ve rol tabanlı erişim kullan. Roller: STUDENT, INSTRUCTOR, ADMIN, EXPERT_EVALUATOR, RESEARCH_ANALYST.
- Hizmet anahtarı yalnızca sunucuda kalsın. İstemciye hiçbir gizli anahtar veya gizli puan gitmesin.
- Para birimi hesapları tam sayı mikro USD ile yapılsın. Kayan nokta kullanma.
- Kimlik eşleşmesi (öğrenci kimliği ile araştırma kodu) ayrı ve kısıtlı bir tabloda dursun.
- Supabase bölgesi ve veri aktarımı konusunda Bölüm 13'teki engelleyici karara bak.
- Olay, puan ve sürüm kayıtları ekleme tabanlı ve değiştirilemez olsun. Güncelleme ve silme yerine yeni kayıt ve durum alanı kullan.

## 3. Kimlik doğrulama ve oturum
- Mevcut yalnızca eposta girişi ve localStorage oturumu yetersizdir. Güçlü bir yöntem öner (Supabase Auth ile tek kullanımlık kod veya bağlantı) ve onayımı al.
- İstemciden gelen eposta başlığına güvenme. Her API rotasında kimliği ve rolü sunucuda oturumdan doğrula.
- Kontrol grubunun RAG ve yapay zeka rotalarına erişimi yalnızca arayüzde değil sunucuda da engellensin.

## 4. İsimlendirme çakışmasını çöz
Mevcut iş planı yönergesi A ile F bölümlerini kullanıyor (A Genel Bilgiler, B Pazar, C Teknik, D Organizasyon, E Finans, F Sonuç). Haftalık değerlendirme döngüsü de A ile F harflerini kullanıyor (Soruyu tanımla, Kanıt topla, Kararı gerekçelendir, Bölümü geliştir, Tutarlılığı ve revizyonu denetle, Değerlendir ve geri bildirim ver). Veri modelinde ve arayüzde bunları kesin biçimde ayır. Örneğin PLAN_A ile PLAN_F ve CYCLE_A ile CYCLE_F gibi ayrı öneklerle. Önerini bana sun.

## 5. Haftalık program
docs/HAFTALIK_ICERIK.md dosyasındaki on hafta, her haftanın teslim edilecekleri ve form alanlarıyla birlikte yapılandırılabilir içerik olarak veritabanına girsin. Araştırmacı panelinden aktif hafta belirlenebilsin. Öğrenci yalnızca aktif haftayı görsün.

V0 ve V1 haftaları: yalnızca Hafta 1, 5 ve 9.
UYARI: Benim kararım Hafta 5 için "Rekabet, alternatifler ve konumlandırma" ve Hafta 9 için "Finansal model ve ekonomik fizibilite" diyor. Dosyada rekabet Hafta 4'te ve tek müşteri anketi Hafta 5'te. Finansal model Hafta 8'de ve finansal fizibilite Hafta 9'da. Bu farkı bana göster ve V0 ve V1 haftalarının kesin içeriğini benden onayla. Kendi başına seçim yapma.

## 6. Haftalık değerlendirme rubriği
İki düzeyli analitik rubrik sistemi kur.

A) Haftalık değerlendirme boyutları:
- CYCLE_A Soruyu tanımla: 15 puan
- CYCLE_B Kanıt topla: 25 puan
- CYCLE_C Kararı gerekçelendir: 20 puan
- CYCLE_D İş planı bölümünü geliştir: 25 puan
- CYCLE_E Tutarlılığı ve revizyonları denetle: 15 puan
- CYCLE_F Değerlendir ve geri bildirim ver: puanlanan boyut değil bir iş akışı aşamasıdır.
Her boyut 0 ile 4 arası davranışsal çapalı ölçek kullanır. Ölçütler her haftanın öğrenme hedeflerine ve beklenen çıktılarına uyarlanır. Henüz öğretilmemiş bölümler için öğrenci cezalandırılmaz. Haftalık puanları, boyut puanlarını, gerekçeleri, rubrik sürümünü ve gönderim sürümünü sakla.
Haftalık ve boyutsal ölçüt metinlerini ben onaylayana kadar taslak olarak tut.

B) Final iş planı rubriği (8 ölçüt):
- Problem ve değer mantığı: yüzde 15
- Kanıt kalitesi: yüzde 15
- Pazar gerçekçiliği: yüzde 15
- Ticarileşme ve gelir modeli: yüzde 15
- Operasyonel uygulanabilirlik: yüzde 10
- Finansal uygulanabilirlik: yüzde 15
- Risk ve varsayım yönetimi: yüzde 5
- Bölümler arası tutarlılık: yüzde 10
0 ile 4 arası davranışsal çapalı ölçek. Final değerlendirme haftalık puanların ortalaması değildir. Toplam puan arka uçta deterministik hesaplanır. LLM'in aritmetiğine güvenme.

C) Bütünlük:
- Haftalık biçimlendirici değerlendirme ile final toplam değerlendirme ayrı tutulur.
- RAG koçunun kendi biçimlendirici puanı bağımsız final çıktı olarak kullanılmaz.
- Rubrik tanımları ve ağırlıkları veri toplama başlamadan önce yapılandırılabilir ve veri toplama sırasında dondurulur.
- Üretim kullanımından önce pilot rubrik kalibrasyonu prosedürü uygula (küçük bir örnek üzerinde LLM ve insan puanlarını karşılaştıran betik ve rapor).

## 7. Puan görünürlüğü politikası
- Müdahale süresince öğrenciye sayısal haftalık puan ve boyut puanı gösterme.
- Öğrenciye nitel biçimlendirici geri bildirim ver: güçlü yönler, eksik kanıt, desteksiz varsayımlar, tutarsızlıklar, önerilen revizyonlar.
- Tüm sayısal puanlar yalnızca yetkili öğretim elemanı ve araştırma analizi için güvenli saklansın.
- Final LLM ve uzman puanları araştırma değerlendirme aşaması bitene kadar öğrenciden gizli kalsın.
- Resmi ders notu araştırma puanlarından tamamen ayrı yönetilsin.
- Geri bildirimin içeriğini, zaman damgasını, kaynağını, model sürümünü ve ilişkili gönderim sürümünü kaydet.
- Puan görünürlüğü çalışma aşamasına ve role göre yapılandırılabilir olsun. Varsayılan gizli.
- Aynı koşuldaki tüm öğrencilere aynı geri bildirim politikası uygulansın.
- Gizli puanlar hiçbir API yanıtında ve istemci durumunda bulunmasın. Bunu test et.
- Mevcut uygulamadaki "Bölüm Puanı: XX/100" gösterimini ve puanın model metninden regex ile okunmasını kaldır. Puanlar yapılandırılmış (JSON şemalı) çıktıyla üretilsin ve doğrulansın. Başarısız olursa hata kaydı tut ve sessizce puan yazma.
SORU: Kontrol grubuna nitel biçimlendirici geri bildirimi kim verecek (öğretim elemanı, asistan, standart kontrol listesi)? Bunu bana sor. Koşullar arasında geri bildirimin süre ve ayrıntı farkı bir karıştırıcı olabilir.

## 8. V0 ve V1 akışı (Hafta 1, 5 ve 9)
Her iki koşul için:
1. Ders sonrası yapay zekasız ilk gönderim (V0) gerekir.
2. V0 sırasında uygulama içindeki tüm yapay zeka özellikleri (RAG, sohbet, yapay zeka geri bildirimi) sunucu tarafında kapalıdır.
3. V0 gönderilince kilitlenir ve zaman damgası alır.
4. Eşit süre tanınan ikinci revizyon aşaması açılır.
5. CONTROL öğrencileri onaylı yapay zekasız kaynaklarla revize eder.
6. RAG_ASSISTED öğrencileri alan bilgisine dayalı RAG yardımcısıyla revize eder.
7. Sonuç V1 olarak saklanır.
8. V0 ve V1 değiştirilemez biçimde saklanır.
9. Aynı haftalık analitik rubrik V0 ve V1'e uygulanır.
10. Sayısal puanlar öğrenciden gizli kalır.
Kaydedilecek alanlar: student_id (araştırma kodu), study_condition, week, version, submission_timestamp, content, criterion_scores, total_score, revision_duration, revision_summary, AI_interaction_count, rubric_version.
V1 ile V0 farkı koşullar arasında karşılaştırılabilsin. Kör değerlendiricilere V0 ve V1 verileri koşul açığa çıkmadan sunulabilsin.

## 9. Ön test ve transfer testi
Eşdeğer iki form:
- FORM_A: Kampüs Yemek Siparişi Platformu
- FORM_B: Kampüs Baskı Hizmeti
Vaka metinleri ve sayısal veriler araştırmacı tarafından yönetilen ve sürümlenen içerik olarak girilecek. Ben henüz sana vermedim. Yer tutucu bırak ve metinleri uydurma.
Koşullar:
- Ön test ve transfer testi 40 dakika. Her testte beş açık uçlu soru. En yüksek puan 100.
- Test sırasında yapay zeka sohbeti, RAG ve yapay zeka geri bildirimi kapalı.
- Yalnızca protokolde belirtilen hesaplama araçları ve referans materyalleri serbest.
- Cevaplar otomatik kaydedilsin. Süre bitince gönderim kilitlensin. Gerçek gönderim süresi ve form sürümü kaydedilsin. Süre sınırı sunucu saatiyle uygulansın.
Dengelenmiş atama:
- Her koşulun içinde öğrenciler rastgele iki diziden birine atanır. Dizi AB: ön test Form A ve transfer testi Form B. Dizi BA: ön test Form B ve transfer testi Form A. Dağılım CONTROL ve RAG_ASSISTED arasında dengeli olsun. Tohum değeri kaydedilsin.
Puanlama (beş boyut, her biri 20 puan, 0 ile 4 davranışsal çapa):
1. Problem ve müşteri analizi
2. Kanıta dayalı akıl yürütme
3. İş modeli ve ekonomik akıl yürütme
4. Risk ve varsayım farkındalığı
5. Karar tutarlılığı ve gerekçelendirme
Kaydet: boyut puanları, toplam puan, kısa gerekçe, değerlendirici model, istem sürümü, rubrik sürümü, form sürümü.
Değerlendirme: anonimleştirilmiş gönderimler bağımsız bir LLM değerlendiriciyle puanlanır. Uyumu tahmin etmek için insan puanlı bir doğrulama alt kümesi eklenir. Sayısal araştırma puanları öğrenciye gösterilmez.
Dışa aktarım: araştırma kodu, koşul, dizi, ölçüm zamanı, form kimliği ve sürümü, boyut puanları, toplam, süre, gönderim durumu, değerlendirici üst verisi. Ön test, form ve dizi için düzeltilmiş transfer testi analizini destekleyecek biçimde.
SORU: Ön test ve transfer testi için hangi LLM değerlendiriciyi (belge 2'deki iki değerlendiriciden biri mi ikisi mi) kullanacağımı ve bütçeden ne kadar pay ayıracağımı bana sor.

## 10. Final değerlendirme ve uzman modülü
- Yaklaşık 100 anonimleştirilmiş final iş planı. Belgedeki iki bağımsız LLM değerlendirici (OpenAI ve Anthropic) aynı dondurulmuş rubrikle bağımsız puanlar. Birbirlerinin puanlarını, grup bilgisini, öğrenci kimliğini, sohbet geçmişini ve önceki puanları görmez.
- Uygulama içi uzman değerlendirme arayüzü ve yedek olarak Excel ve CSV dışa ve içe aktarım.
- Üç bağımsız dış uzman, aynı 40 anonim planı bağımsız puanlar.
- 40 planı önceden belirlenmiş tabakalı örnekleme protokolüyle seç (koşul ve performans düzeyi temsil edilsin). Tohum değeri ve seçim betiği kaydedilsin.
- Uzmana anonim planlar ve ekleri gösterilir. Öğrenci kimliği, koşul, yapay zeka kullanım bilgisi, LLM puanları ve diğer uzmanların puanları gizlidir.
- Boyut düzeyinde puan ve kısa gerekçe zorunlu. Taslak otomatik kaydedilsin. Tamamlanan değerlendirme kilitlensin. Değerlendirici kimliği, rubrik sürümü, zaman damgaları, puanlar ve denetim geçmişi saklansın.
- Dışa aktarım: uzman ve plan bazlı boyut puanları, ağırlıklı toplam, LLM puanları, ayrı bir anonim analiz veri seti. CSV ve XLSX uyumlu.
- Analize hazırlık: ICC, MAE, RMSE, Bland Altman ve boyut düzeyinde uyum karşılaştırması için gerekli sütunlar ve bir sütun sözlüğü. Analizin kendisini canlı uygulamaya gömme. Çevrimdışı betik olarak yaz. Python mu R mı tercihimi bana sor.
- Değerlendirici başına tekrarlanabilirlik betiği: aynı planı N kez puanlayıp dağılımı ham çıktı olarak ver. Yorum katma.

## 11. Etik, onam ve gizlilik modülü
Onam yönetimi:
- Araştırmaya kaydolmadan önce onaylı katılımcı bilgi formunu göster.
- Gönüllü katılım kararını açık biçimde kaydet.
- Araştırma katılım onamını gizlilik bildiriminden ve yasal zorunlu veri işleme metinlerinden ayrı tut.
- Öğrenci araştırmaya katılmayı reddetse bile zorunlu ders etkinliklerine erişimini kaybetmesin.
- Onam belgesi sürümünü, kararı, zaman damgasını ve geri çekme geçmişini sakla.
- Onam vermeyen öğrenciyi araştırma veri setlerine dahil etme.
- Geri çekilme talebi iş akışı sağla.
Gizlilik ve güvenlik:
- Araştırma kimliklerini takma adlandır. Kimlik eşleşmesini ayrı sakla.
- Rol tabanlı erişim. Ham sohbet kayıtlarına ve tanımlanabilir gönderimlere erişimi kısıtla.
- Dış LLM sağlayıcılarına gereksiz kişisel bilgi gönderme. Ad, eposta ve benzeri doğrudan tanımlayıcıları göndermeden önce maskele.
- Belgelenmiş veri saklama ve silme prosedürleri.
- Yasal inceleme ve güvencesi olmadan uluslararası veri aktarımı uygulama (Bölüm 13'e bak).
Etik yönetimi (yalnızca öğretim elemanı ayarları): etik kurul adı, onay tarihi, onay numarası, onaylı protokol sürümü, onaylı onam belgesi sürümü, veri sorumlusu ve araştırma iletişim bilgisi, araştırma başlangıç ve bitiş tarihleri, veri saklama süresi, yetkili veri işleyiciler ve yapay zeka sağlayıcıları.
Gerekli etik onay bilgileri ve onaylı onam belgeleri yapılandırılmadan araştırmaya kayıt alma.
Onay numarası, tarih ve metinler için yer tutucu bırak. Hiçbirini uydurma.

## 12. Çekilme ve eksik veri protokolü
Katılımcı durumları: ACTIVE, TEMPORARILY_INACTIVE, COURSE_WITHDRAWN, RESEARCH_WITHDRAWN, COMPLETED. Ders çekilmesi ile araştırma çekilmesi ayrı olaylardır. Araştırma çekilmesi, araştırmaya özgü veri toplamayı durdurur ama zorunlu derse erişimi engellemez.
Her beklenen değerlendirme veya gönderim için kaydet: participant_id, study_condition, week, assessment_type, expected_submission, actual_submission, completion_status, missing_reason, missing_reason_source, timestamp, technical_incident_id.
Standart eksiklik nedeni kodları: NOT_SUBMITTED, PARTIAL_SUBMISSION, TECHNICAL_FAILURE, ABSENT, COURSE_WITHDRAWAL, RESEARCH_WITHDRAWAL, EVALUATION_FAILURE, OTHER.
- Eksik puanı otomatik sıfıra çevirme.
- V0 ve V1: V0 bağımsız saklanır. İki sürümden biri eksikse fark hesaplama. Eksik sürümü açıkça kaydet. Yapay yedek gönderim üretme.
- Katılımcıyı devamsızlığa veya eksik gönderime göre otomatik dışlama.
- Çekilme tarihini kaydet. Sonraki araştırma toplamasını durdur. Daha önce toplanan veriye onaylı onam ve gizlilik politikasını uygula. Yasal silme veya kısıtlama talepleri için kontrollü iş akışı sağla. Silinen araştırma içeriğini gereksiz tutmadan idari denetim kaydı bırak.
Ayrı dışa aktarımlar: (1) rastgeleleştirilmiş ve onam vermiş tüm katılımcılar, (2) gözlenen haftalık gönderimler, (3) eşleşmiş V0 ve V1 gözlemleri, (4) önceden tanımlanmış yüksek katılımlı alt grup, (5) eksik veri ve çekilme olayları.
Analize hazır uzunlamasına ve katılımcı düzeyinde veri: form, rubrik sürümü, koşul, gönderim durumu, gözlenen puan, eksiklik göstergeleri. Karma etkili modeller, düzeltilmiş transfer karşılaştırması ve eksik veri duyarlılık analizi desteklensin. Öğrenciye dönük uygulamada otomatik istatistiksel yükleme (imputation) yapma.
Eksik veri tanımlarını ve analiz popülasyonu kurallarını kayıt başlamadan dondur. Protokoldeki tüm sapmaları belgele.

## 13. Engelleyici kararlar (kodlamadan önce bana sor)
- OpenAI, Anthropic ve Supabase barındırma bölgesi kaynaklı yurt dışı veri aktarımı. Etik belgem yasal inceleme olmadan uluslararası aktarıma izin vermiyor. Bu bir çelişki olabilir. Hukuki karar bende. Sen hangi verilerin sağlayıcılara gittiğini ayrıntılı listele ve maskeleme seçeneklerini sun.
- Bütçe: docs/BUTCE_VE_LLM.md içindeki 50 USD sınırının gerçekçi simülasyonu. Yeterli olmuyorsa açıkça söyle.
- GPT 5.4 ve Claude Sonnet 5.5 modellerinin varlığı, API tanımlayıcıları ve güncel fiyatları. Doğrulayamazsan söyle ve yerine koyma.

## 14. İlk çıktı (kod değiştirmeden önce)
A. Mevcut mimari denetimi.
B. Bölüm 4, 5, 7 ve 13'teki çelişki ve sorular tek listede.
C. Doğrulanmış model tanımlayıcıları ve fiyatlar ve 100 öğrencilik 10 haftalık maliyet simülasyonu.
D. Supabase şema önerisi ve geçiş planı.
E. Aşamalı uygulama planı.
F. Güvenlik ve araştırma bütünlüğü riskleri.
Onayım olmadan büyük kod değişikliğine geçme.

## 15. Testler
Gizli puanların API'de bulunmaması, kontrol grubunun RAG'a erişememesi, V0 sırasında yapay zekanın kapalı olması, V0 ve V1 değiştirilemezliği, kör değerlendirici girdilerinin tanımlayıcı içermemesi, dengelenmiş dizi ataması, eksik puanın sıfıra çevrilmemesi, çekilen katılımcıdan yeni araştırma verisi alınmaması, belge 2'deki bütçe testleri.