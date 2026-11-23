# Brif K<görev>: <bir satırda iş>

<!-- Bu bir şablon. <...> yerlerini doldur, bu yorum satırını sil, dosyayı koşu kökünde BRIF.md adıyla kaydet. -->

Ham malzeme: `ham/` içinde <ne olduğu: ör. bir oyunun içinden çekilmiş 9 klip / 5 yayıncının aynı andaki kayıtları>, toplam ~<saniye> sn. <Boyut ve fps: ör. hepsi dikey 1080x1920, 30 fps>. <Ses var mı: ör. klipler **sessiz** / yayıncıların kendi sesi var>.

Önce şu dosyaları oku:
- `KONU.md`: <konu ne, izleyici neyi bilmeli, hangi klip neyi gösteriyor, söylenmemesi gerekenler>.
- `KLIPLER.md`: her klipte hangi saniyede ne olduğu.

İş: <ne üretilecek: ör. bu oyun için dikey bir tanıtım videosu>. İzleyen kişi <hedef izleyici>. Videoyu bitirince <izleyicinin ne anlaması ve ne demesi gerektiği>. Dosyaların sırası yalnız çekim sırası; videonun sırası senin kararın.

Süre serbest. Ham toplam ~<saniye> sn; <ör. 30-45 sn> civarı doğal bir hedef ama kesin değil. Her saniye yerini hak etsin.

Ses: <seslerin durumu>. `ortak/` içinde müzikler ve ses efektleri var<, meme kataloğu da elinde>. Hiçbiri zorunlu değil; kullanıp kullanmamak, ne kadar ve nerede kullanmak senin kurgu kararın. Bunların dışında bir şey indirme.

Zorunluluklar:
- Ekrandaki yazı <dil> olsun.
- `KONU.md` içindeki "Söylenmemesi gerekenler" bölümüne uy. <Uydurulmaması gereken bilgiler: ör. çıkış tarihi, fiyat, kişi adı>. <Varsa doğru olan tek cümle>.

Serbest bıraktıkların: kanca, sıra, hangi klipleri ne kadar kullanacağın, yazılar, hız, renk, ses.

---

## Koşu kökünün düzeni

```text
<KÖK>\<KOD>\
  YARISMACI-KURALLARI.md   (yaris/ klasöründen kopya)
  BRIF.md                  (bu şablondan)
  KONU.md                  (konu, izleyici, söylenmemesi gerekenler)
  KLIPLER.md               (klip klip saniye notları)
  kurgu-plani.md           (yaris/kurgu-plani.md kopyası)
  ham\                     (ham klipler; yarışan model değiştirmez)
  ortak\                   (isteğe bağlı: müzik, ses efekti; yalnız haklarını bildiğin dosyalar)
  cikti\                   (HyperFrames koşusu mp4'ü buraya yazar)
```

Aynı görevin bütün koşuları aynı ham dosyaları, aynı brifi ve aynı `ortak/` klasörünü alır. Fark yalnız model ve araçtır.
