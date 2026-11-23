# Sonuçlar: 8 edit

İki model (Claude Opus 5.5, Claude Fable 5.2) × iki araç (HyperFrames, CapCut MCP) × iki görev = 8 koşu.
Her koşu aynı başlatma metniyle, aynı kurallarla, kendi boş oturumunda yapıldı. Yarışan sürüm her koşunun
**ilk denemesi**; revize turu yok.

- **Görev 1:** GTA yayıncı kesitleri (birkaç yayıncının kayıtlarından dikey kısa video). Koşu kodu `K2`.
- **Görev 2:** bir TikTok canlı yayın oyununun tanıtımı (sessiz oyun klipleri). Koşu kodu `K1`.

(Kodlar çekim sırasından kaldı: GTA görevi videoda 1. görev, kodu K2.)

## Furkan'ın kararı

Kazanan: **Opus 5.5 + HyperFrames**. CapCut MCP ile çıkan editler iki modelde de daha zayıf kaldı.

## Ölçüm

Süre duvar saati (ilk mesajdan teslimden önceki son asistan mesajına). Token ve araç çağrısı Claude Code
transkriptlerinden sayıldı (`yaris/araclar/cc-olcum.cjs`). Ham veri: [`yaris/sonuc/olcum.json`](yaris/sonuc/olcum.json).

> **Maliyet sütunu gerçek fatura değildir.** API fiyatıyla karşılığıdır. Koşular sabit ücretli Claude aboneliğiyle
> yapıldı; bu sekiz koşu için ayrıca para ödenmedi. Fiyatlar 23.11.2026 tarihli Claude API fiyat sayfasından:
> Opus 5.5 giriş $4 / çıkış $20 / cache yazma (1 sa) $8 / cache okuma $0,20; Fable 5.2 giriş $8 / çıkış $40 /
> cache yazma (1 sa) $16 / cache okuma $0,20 (milyon token başına).

| Görev | Model | Araç | Kod | Dakika | Tur | Araç çağrısı | Çıkış token | Toplam token | API karşılığı |
|---|---|---|---|---:|---:|---:|---:|---:|---:|
| 1 GTA | Opus 5.5 | HyperFrames | K2-O-HF | 26,6 | 67 | 83 | 75.642 | 10.858.877 | $5,17 |
| 1 GTA | Fable 5.2 | HyperFrames | K2-F-HF | 44,7 | 73 | 121 | 148.758 | 20.548.887 | $15,90 |
| 1 GTA | Opus 5.5 | CapCut MCP | K2-O-CC | 21,7 | 97 | 366 | 112.782 | 21.905.334 | $9,04 |
| 1 GTA | Fable 5.2 | CapCut MCP | K2-F-CC | 26,3 | 60 | 292 | 130.619 | 14.900.408 | $13,50 |
| 2 TikTok | Opus 5.5 | HyperFrames | K1-O-HF | 16,8 | 53 | 62 | 68.811 | 7.487.994 | $4,15 |
| 2 TikTok | Fable 5.2 | HyperFrames | K1-F-HF | 25,5 | 47 | 86 | 104.442 | 8.468.544 | $9,77 |
| 2 TikTok | Opus 5.5 | CapCut MCP | K1-O-CC | 17,9 | 90 | 253 | 87.840 | 17.642.735 | $7,19 |
| 2 TikTok | Fable 5.2 | CapCut MCP | K1-F-CC | 24,8 | 76 | 264 | 110.173 | 16.762.256 | $11,95 |

Toplamlar:

| | Dakika | Araç çağrısı | API karşılığı |
|---|---:|---:|---:|
| Opus 5.5 (4 koşu) | 83,0 | 764 | $25,55 |
| Fable 5.2 (4 koşu) | 121,4 | 763 | $51,12 |
| HyperFrames (4 koşu) | 113,6 | 352 | $34,99 |
| CapCut MCP (4 koşu) | 90,7 | 1.175 | $41,68 |
| Hepsi | 204,3 | 1.527 | $76,67 |

Göze çarpanlar:
- CapCut koşuları HyperFrames'e göre 3 kattan fazla araç çağrısı yaptı (koşu başına ~294'e ~88): taslağı parça parça
  komutla kurmak, videoyu kod olarak tek seferde yazmaktan çok daha fazla adım istiyor.
- Opus 5.5 her koşuda Fable 5.2'den hızlı ve ucuz bitirdi (API karşılığı toplamda yaklaşık yarısı).
- Toplam tokenın büyük kısmı cache okuması; asıl fark çıkış tokenında ve birim fiyatta.

## Videolar

**Videolar yakında Releases bölümünde:** [github.com/furkancavlak/claude-edit-yarisi/releases](https://github.com/furkancavlak/claude-edit-yarisi/releases) (sürüm `v1`, "8 edit").
Videolar git geçmişinde değil, yalnız Releases'te durur.

| Görev | Model | Araç | Süre | Dosya (Releases `v1`) |
|---|---|---|---:|---|
| 1 GTA | Opus 5.5 | HyperFrames | 69 sn | `gorev1-gta-opus55-hyperframes.mp4` |
| 1 GTA | Fable 5.2 | HyperFrames | 59 sn | `gorev1-gta-fable52-hyperframes.mp4` |
| 1 GTA | Opus 5.5 | CapCut MCP | 67 sn | `gorev1-gta-opus55-capcut.mp4` |
| 1 GTA | Fable 5.2 | CapCut MCP | 59 sn | `gorev1-gta-fable52-capcut.mp4` |
| 2 TikTok | Opus 5.5 | HyperFrames | 30 sn | `gorev2-tiktok-opus55-hyperframes.mp4` |
| 2 TikTok | Fable 5.2 | HyperFrames | 29 sn | `gorev2-tiktok-fable52-hyperframes.mp4` |
| 2 TikTok | Opus 5.5 | CapCut MCP | 27 sn | `gorev2-tiktok-opus55-capcut.mp4` |
| 2 TikTok | Fable 5.2 | CapCut MCP | 33 sn | `gorev2-tiktok-fable52-capcut.mp4` |

Notlar:
- İki GTA HyperFrames videosu da ilk denemedir. Opus 5.5'in GTA videosundaki birkaç donma modelden değil, ikinci
  bilgisayardaki ham kliplerden kaynaklandı.
- CapCut videoları, modelin kurduğu taslağı bir insanın CapCut'ta açıp **varsayılan bit hızıyla** dışa aktarmasıyla
  çıktı (bu yüzden dosyaları HyperFrames çıktılarından çok küçük). Model dışa aktaramaz; kurallar bunu yasaklıyor.
- GTA editlerinde başka yayıncıların yayın görüntüleri var; haklar o yayıncılarındır. Videolar karşılaştırma ve
  inceleme amacıyla paylaşılıyor.
