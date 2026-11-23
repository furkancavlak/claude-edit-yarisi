# Claude Edit Yarışı

> **Kullanım şartı:** Kullanmak, kodu alıp geliştirmek ve üstüne kendi işini yapmak serbest. Alıp "ben yaptım"
> diye sahiplenmek, kendi sisteminmiş gibi tanıtmak yasak. Video çekerken ya da paylaşırken kaynağı göster:
> Claude Edit Yarışı, Furkan Cavlak, github.com/furkancavlak/claude-edit-yarisi (ayrıntı `LICENSE` dosyasında).

Aynı ham görüntüyü iki yapay zekâ modeli, iki farklı yolla editledi:

- **Modeller:** Claude Opus 5.5 ve Claude Fable 5.2
- **Yol 1, HyperFrames:** model videoyu kod olarak yazıyor ve mp4'ü kendisi çıkarıyor.
- **Yol 2, CapCut:** model, açık kaynak [capcut-mcp](https://github.com/JmsLdrn/capcut-mcp) aracıyla CapCut taslağını
  komut komut kuruyor; dışa aktarmayı insan yapıyor.

İki görev (GTA yayıncı kesitleri ve bir TikTok oyunu tanıtımı) × iki model × iki yol = **8 edit**. Her koşu aynı
başlatma metni, aynı kurallar ve 45 dakika sınırıyla yapıldı.

Videosu: [youtube.com/@furkancavlak](https://youtube.com/@furkancavlak)

## Sonuç

Kazanan: **Opus 5.5 + HyperFrames.** CapCut MCP ile çıkan editler daha zayıf kaldı; CapCut yolu koşu başına 3 kattan
fazla araç çağrısı istedi. Opus 5.5 her koşuda Fable 5.2'den hızlı bitti ve API fiyatıyla yaklaşık yarı maliyete geldi.
Süre, token ve maliyet tablosu: [SONUCLAR.md](SONUCLAR.md). (Maliyet API fiyatıyla karşılıktır; koşular sabit ücretli
abonelikle yapıldı.)

Yarış sırasında capcut-mcp'de 4 hata bulup düzelttik ve 10 yeni komut ekledik (kırpma, kamera penceresi, efekt listesi,
geçiş/efekt/filtre, sticker, maske, yazı stili, iki tür yazı animasyonu, önizleme karesi); taslağı okuma komutu da artık
ölçeği, kırpmayı ve efektleri gösteriyor. Liste: [capcut-mcp/CHANGES.md](capcut-mcp/CHANGES.md).

## Videolar

**Videolar yakında Releases bölümünde:** [Releases](https://github.com/furkancavlak/claude-edit-yarisi/releases) (sürüm `v1`, "8 edit").

| Görev | Model | Yol | Dosya |
|---|---|---|---|
| 1 GTA | Opus 5.5 | HyperFrames | `gorev1-gta-opus55-hyperframes.mp4` |
| 1 GTA | Fable 5.2 | HyperFrames | `gorev1-gta-fable52-hyperframes.mp4` |
| 1 GTA | Opus 5.5 | CapCut MCP | `gorev1-gta-opus55-capcut.mp4` |
| 1 GTA | Fable 5.2 | CapCut MCP | `gorev1-gta-fable52-capcut.mp4` |
| 2 TikTok | Opus 5.5 | HyperFrames | `gorev2-tiktok-opus55-hyperframes.mp4` |
| 2 TikTok | Fable 5.2 | HyperFrames | `gorev2-tiktok-fable52-hyperframes.mp4` |
| 2 TikTok | Opus 5.5 | CapCut MCP | `gorev2-tiktok-opus55-capcut.mp4` |
| 2 TikTok | Fable 5.2 | CapCut MCP | `gorev2-tiktok-fable52-capcut.mp4` |

- Hepsi ilk deneme. İki GTA HyperFrames videosu da ilk denemedir; Opus 5.5'in GTA videosundaki birkaç donma modelden
  değil, ikinci bilgisayardaki ham kliplerden kaynaklandı.
- CapCut videoları CapCut'ın varsayılan bit hızıyla dışa aktarıldı (dosyaları bu yüzden küçük).
- GTA editlerinde başka yayıncıların yayın görüntüleri var; haklar o yayıncılarındır.

## Kendin kurmak istersen

Kod bilmen gerekmiyor. Bilgisayarında bir yapay zekâ kodlama ajanı (Claude Code ya da Codex) açıkken ona şunu söyle:

```text
Bu repoyu kur: https://github.com/furkancavlak/claude-edit-yarisi
```

Ajan `AGENTS.md` dosyasını okur, gerekenleri kontrol eder, kurar ve çalıştığını dener. Senden yalnız bir şey ister:
CapCut'ta bir kez "şablon taslak" hazırlamanı (içine iki kısa video, bir geçiş, bir efekt, bir filtre, bir yazı ve bir
ses koyacaksın; ajan adım adım anlatır).

Gerekenler: Windows ya da macOS, CapCut masaüstü uygulaması, Node.js ve ffmpeg (ajan yoksa söyler).

## İçinde ne var

| Klasör / dosya | Ne işe yarar |
|---|---|
| `capcut-mcp/` | CapCut'ı yapay zekâya yönettiren araç; düzeltilmiş ve genişletilmiş sürüm |
| `yaris/` | yarışı kendin yapmak için: kurallar, başlatma metni, brif şablonu, ölçüm araçları |
| `SONUCLAR.md` | 8 koşunun süre, token ve maliyet tablosu |
| `AGENTS.md`, `CLAUDE.md` | ajan için kurulum ve kullanım talimatı (İngilizce) |

Depoda video, CapCut taslağı ya da CapCut verisi yok. Efekt listesi kurulumda senin kendi CapCut'ından çıkarılır ve
senin bilgisayarında kalır.

## Teşekkür

capcut-mcp'nin aslı [James Aldrin Boncales](https://jmsldrn.com)'ın işidir (MIT lisansı). Bu depodaki sürüm onun
üstüne kuruldu; özgün lisansı `capcut-mcp/LICENSE-upstream` dosyasında duruyor.

## Lisans

Bu deponun kendi kodu, MIT lisansına bir atıf şartı eklenmiş hâliyle dağıtılır. Kullanmak, değiştirmek, geliştirmek
ve üstüne yeni iş yapmak serbesttir. Depoyu ya da ondan türeyen bir işi kendi yaptığın bir sistem gibi sunmak
yasaktır; videoda, gönderide ya da depoda paylaşırken kaynak gösterilir. Tam metin `LICENSE` dosyasında.
capcut-mcp'nin özgün kodu kendi MIT lisansıyla gelir (`capcut-mcp/LICENSE-upstream`).

CapCut ve ByteDance ile bir bağı yoktur. Reklam değildir.
