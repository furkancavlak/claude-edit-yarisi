#!/usr/bin/env bash
# release-videolar.sh: MAINTAINER ONLY. Puts the 8 race videos on GitHub Releases (tag v1, "8 edit").
# The videos are never committed to git (GitHub blocks files over 100 MB and media does not belong in history).
#
# Usage (Git Bash):
#   bash scripts/release-videolar.sh "<sonuc folder that contains K1/ and K2/>" [temp folder]
# Needs: gh CLI logged in as the repo owner account (GH_ACCOUNT, default furkancavlak).
# Uploads about 380 MB. The originals are only read; renamed copies go to the temp folder.
set -euo pipefail

SRC="${1:?give the sonuc folder (it must contain K1/ and K2/)}"
TMP="${2:-${TMPDIR:-/tmp}/edit-yarisi-release}"
ACCOUNT="${GH_ACCOUNT:-furkancavlak}"
REPO="${GH_REPO:-furkancavlak/claude-edit-yarisi}"
TAG="${TAG:-v1}"

# source file -> asset name (first attempts only; no *-fable51* or *-revize* files)
PAIRS=(
  "K2/K2-O-HF.mp4|gorev1-gta-opus55-hyperframes.mp4"
  "K2/K2-F-HF.mp4|gorev1-gta-fable52-hyperframes.mp4"
  "K2/K2-O-CC.mp4|gorev1-gta-opus55-capcut.mp4"
  "K2/K2-F-CC.mp4|gorev1-gta-fable52-capcut.mp4"
  "K1/K1-O-HF.mp4|gorev2-tiktok-opus55-hyperframes.mp4"
  "K1/K1-F-HF.mp4|gorev2-tiktok-fable52-hyperframes.mp4"
  "K1/K1-O-CC.mp4|gorev2-tiktok-opus55-capcut.mp4"
  "K1/K1-F-CC.mp4|gorev2-tiktok-fable52-capcut.mp4"
)

# 1) check every source exists before copying anything
for p in "${PAIRS[@]}"; do
  s="${p%%|*}"
  [ -f "$SRC/$s" ] || { echo "missing: $SRC/$s" >&2; exit 1; }
done

# 2) copy with clear names (cp never touches the originals)
mkdir -p "$TMP"
FILES=()
for p in "${PAIRS[@]}"; do
  s="${p%%|*}"; d="${p##*|}"
  cp -f "$SRC/$s" "$TMP/$d"
  FILES+=("$TMP/$d")
  echo "copied $s -> $TMP/$d"
done

# 3) create the release with all 8 assets (retry later with: gh release upload v1 <files> --clobber)
export GH_TOKEN
GH_TOKEN="$(gh auth token -u "$ACCOUNT")"
NOTES='Sekiz edit: Claude Opus 5.5 ve Claude Fable 5.2, HyperFrames ve CapCut MCP ile, iki görev. Hepsi ilk deneme.
Ölçüm tablosu: SONUCLAR.md. GTA editlerinde başka yayıncıların yayın görüntüleri var; haklar onlarındır.
CapCut videoları CapCut varsayılan bit hızıyla dışa aktarıldı.'
if gh release view "$TAG" --repo "$REPO" >/dev/null 2>&1; then
  gh release upload "$TAG" "${FILES[@]}" --repo "$REPO" --clobber
else
  gh release create "$TAG" "${FILES[@]}" --repo "$REPO" --title "8 edit" --notes "$NOTES"
fi

# 4) verify on GitHub
gh release view "$TAG" --repo "$REPO" --json assets --jq '.assets[] | "\(.name)  \(.size)  \(.state)"'
echo "done. Temp copies are in $TMP (delete them yourself when you are sure the release is complete)."
