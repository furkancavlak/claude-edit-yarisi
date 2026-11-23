# Yarışmacı kuralları (her koşu bu dosyayı okur)

Bir edit yarışmasındasın. Sana bir ham malzeme klasörü, bir brif ve bir araç verildi. Aynı brifi başka yarışmacılar da aldı. Sonucu bir insan kör izleyip puanlayacak.

## Değişmez kurallar

1. **Yalnız sana verilen araçla üret.**
   - Aracın HyperFrames ise: HyperFrames kompozisyonu yaz ve HyperFrames ile render et.
   - Aracın CapCut ise: yalnız `capcut` MCP araçlarıyla bir CapCut taslağı kur ve kaydet. Dışa aktarmayı sen yapamazsın, insan yapacak. ffmpeg ile kesmek, birleştirmek ya da render etmek YASAK; HyperFrames kullanmak da YASAK (`capcut-reels` skill'indeki HyperFrames/ffmpeg adımları bu yarışta geçersiz).
   - CapCut taslağını `SABLON-YARIS` adlı şablondan kur: `capcut_clone_draft` ile (boşaltarak) koşu kodun adıyla yeni taslak aç. Araçta kırpma, segment kopyası (ör. yayıncı kamerası penceresi), geçiş / video efekti / filtre kataloğu, sticker, maske, yazı stili ve yazı animasyonu, yaklaşık önizleme karesi komutları var; neyi nasıl yaptıklarını araç açıklamalarından ve `capcut_list_effects` çıktısından öğren. `SABLON-YARIS` ve adı `TEST-` ile başlayan taslakları DEĞİŞTİRME ve kaydetme; başka yarışmacılar da kullanıyor. CapCut uygulaması kapalı; açma.
2. **Analiz serbest:** ffprobe, ffmpeg ile kare çıkarıp bakmak, yerel Whisper ile sesi yazıya dökmek (yalnız diskte olan model, indirme yok).
3. **Skill'ler:** yalnız aracının rehber skill'lerini kullan.
   - HyperFrames koşusunda izinli: HyperFrames'in kendi rehber skill'leri (HyperFrames, HyperFrames CLI, GSAP).
   - CapCut koşusunda izinli: capcut-mcp'nin kendi `capcut-reels` skill'i.
   - Bunların dışında HİÇBİR skill açık değil (kurgu, tarz, kısa video, hikâye anlatımı ve benzeri skill'ler dahil).
4. **Kapalı:** kredi harcayan üretim araçları (görsel, video ya da ses üreten ücretli yapay zekâ servisleri), internetten görüntü ya da müzik indirmek. Görsel gerekiyorsa kendin üret: HyperFrames'te kodla; CapCut'ta aracın yazı/şekil/sticker'ı ya da kodla çizip (PIL vb.) taslağa eklediğin PNG.
   - **İstisna (yalnız brif izin veriyorsa):** brif bir meme kataloğu ve indirme tarifi veriyorsa, oradaki sahnelerden yalnız gereken saniyeleri o tarifteki sınırlarla indirebilirsin. Bu indirme her iki araçta serbest; CapCut koşusunda da meme'yi indirip kesmek yasak sayılmaz, yasak olan videonun kendisini ffmpeg ile kurmak.
5. **Soru sorma.** Belirsiz bir şey varsa kendi kararını ver ve raporuna yaz.
6. **Süre:** en çok 45 dakika (duvar saati; render ve indirme dahil). Başlarken sistem saatini not et. Teslim edilen şey sürenin sonundaki son başarılı render / kaydedilmiş taslaktır; bu yüzden ilk oynayan sürümü erken al, kalan süre düzeltme turlarına gider.
7. **Yalnız kendi kökünde çalış.** Çalışma kökünün dışındaki hiçbir dosyayı okuma ve yazma. Ham klasördeki dosyaları değiştirme, hiçbir şey silme. Aracın kendi kurulum klasörü (HyperFrames, capcut-mcp, CapCut taslak klasörü) ve yukarıda adı geçen izinli skill dosyaları bu kuralın dışında.

## Çıta (sonuç buna göre puanlanır)

Kurgunun biçimi senin kararın; bu liste yalnız çıtayı koyar.
- İlk 1,5 saniyede izleyiciyi yakalayan güçlü bir an olsun (hareket, tepki ya da ses). Açılışta boş, durağan ya da yalnız yazıdan oluşan kare yok.
- İzleyici her saniye ne olduğunu ilk izlemede anlamalı. Hiçbir şeyin olmadığı ölü saniye yok.
- Az ama tam an, çok ama yarım andan iyidir. Her klibi ya da her yayıncıyı kullanmak zorunda değilsin. Bir anı kurulumu, olayın kendisi ve yayıncının tepkisi bitmeden kesme (ör. biri atlıyorsa düşüşü görünmeden sonuç ekranına geçme; yayıncı bir şaka kuruyorsa sonunu göster).
- O anın asıl görüntüsü (bazen oyun, bazen yayıncının yüzü) küçük kalmasın. Hiçbir kaynak 2 kattan fazla büyütülüp bulanıklaşmasın.
- Aynı kalıp (aynı kart, aynı düzen, aynı geçiş) üst üste tekrar etmesin.
- Meme kullanırsan o ana yapışık ve vuruşu kadar uzun olsun.
- İlk render'dan sonra (CapCut'ta: taslağı saniye saniye okuyarak; hangi saniyede ne var, boşluk var mı, ölçek kaç) kendi işini bu listeye göre eleştir ve en az bir düzeltme turu yap. Puan üç başlıkta verilir: ilk 3 saniye, akış, "bunu paylaşır mıyım". Sürenin tamamını kullanabilirsin; erken bitirmek artı puan değil.

## Teslim

- Biçim: dikey 1080x1920, 30 fps.
- HyperFrames: `cikti/<koşu-kodu>.mp4` (H.264 + AAC).
- CapCut: taslağın adı tam olarak `<koşu-kodu>`; kanvas 1080x1920. Kaydettikten sonra taslağı doğrula (validate).
- Her iki araçta: `rapor.md` — ne yaptın, hangi anları neden seçtin, nerede takıldın, aracın neyi yapamadığı. Kısa ve dürüst.
