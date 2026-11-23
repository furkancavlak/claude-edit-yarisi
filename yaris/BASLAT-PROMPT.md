# Başlatma metni (sekiz koşuda aynı)

Her koşu yeni ve boş bir Claude Code oturumunda, çalışma kökü koşunun klasörü olacak şekilde açılır. Yarışan modele
yalnız aşağıdaki metin yapıştırılır; `<KÖK>`, `<KOD>` ve araç adı doldurulur. Başka bir şey yazılmaz.

```text
Sen bir edit yarışmasındasın. Çalışma kökün: `<KÖK>\<KOD>\`. Önce bu kökteki `YARISMACI-KURALLARI.md` ve `BRIF.md` dosyalarını oku, sonra işi yap. Aracın: <HyperFrames | CapCut>. Koşu kodun: <KOD>. Kurgu planı: `<KÖK>\<KOD>\kurgu-plani.md`. Kökün dışındaki hiçbir dosyayı okuma. Soru sorma, kararları kendin ver.
```

Bizim yarışta `<KÖK>` = `C:\yaris` idi. Örnek: `C:\yaris\K1-O-CC\`.

## Koşu kodu

`K<görev>-<model>-<araç>`

| Parça | Değerler |
|---|---|
| görev | `1`, `2`, ... (her görevin kendi BRIF'i ve ham klasörü) |
| model | `O` = Claude Opus 5.5, `F` = Claude Fable 5.2 (kendi modellerin için kendi harfini seç) |
| araç | `HF` = HyperFrames, `CC` = CapCut (capcut-mcp) |

Örnek: `K1-F-HF` = 1. görev, Fable 5.2, HyperFrames.

## Prompt'u neden böyle yazdık

- Kurallar ve brif dosyada, prompt'ta değil: sekiz koşu harfi harfine aynı metni okusun diye.
- "Soru sorma": koşu insan beklemeden bitsin, süre adil ölçülsün.
- "Kökün dışını okuma": modeller başka koşuların çıktısına bakıp kopya çekmesin.
