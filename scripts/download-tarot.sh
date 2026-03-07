#!/bin/bash
# 타로 카드 이미지 다운로드 스크립트
# Wikimedia Commons에서 Rider-Waite-Smith 퍼블릭 도메인 이미지 다운로드

BASE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
OUT_DIR="$BASE_DIR/images/tarot"
mkdir -p "$OUT_DIR"

download_from_wiki() {
  local wiki_filename="$1"
  local output_name="$2"

  if [ -f "$OUT_DIR/$output_name" ]; then
    echo "  [SKIP] $output_name"
    return
  fi

  local encoded=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$wiki_filename'))")
  local api_url="https://commons.wikimedia.org/w/api.php?action=query&titles=File:${encoded}&prop=imageinfo&iiprop=url&format=json"

  local img_url=$(curl -s "$api_url" | python3 -c "
import json,sys
data=json.load(sys.stdin)
pages=data['query']['pages']
for p in pages.values():
    if 'imageinfo' in p:
        print(p['imageinfo'][0]['url'])
" 2>/dev/null)

  if [ -z "$img_url" ]; then
    echo "  [FAIL] $output_name"
    return
  fi

  curl -sL "$img_url" -o "$OUT_DIR/$output_name"
  echo "  [OK] $output_name"
}

echo "=== Major Arcana (22 cards) ==="
MAJOR_WIKI=("00 Fool" "01 Magician" "02 High Priestess" "03 Empress" "04 Emperor" "05 Hierophant" "06 Lovers" "07 Chariot" "08 Strength" "09 Hermit" "10 Wheel of Fortune" "11 Justice" "12 Hanged Man" "13 Death" "14 Temperance" "15 Devil" "16 Tower" "17 Star" "18 Moon" "19 Sun" "20 Judgement" "21 World")
MAJOR_KEYS=("major_00_fool" "major_01_magician" "major_02_high_priestess" "major_03_empress" "major_04_emperor" "major_05_hierophant" "major_06_lovers" "major_07_chariot" "major_08_strength" "major_09_hermit" "major_10_wheel_of_fortune" "major_11_justice" "major_12_hanged_man" "major_13_death" "major_14_temperance" "major_15_devil" "major_16_tower" "major_17_star" "major_18_moon" "major_19_sun" "major_20_judgement" "major_21_world")

for i in "${!MAJOR_WIKI[@]}"; do
  download_from_wiki "RWS Tarot ${MAJOR_WIKI[$i]}.jpg" "${MAJOR_KEYS[$i]}.jpg"
done

echo ""
echo "=== Minor Arcana (56 cards) ==="
RANKS=("ace" "two" "three" "four" "five" "six" "seven" "eight" "nine" "ten" "page" "knight" "queen" "king")

# Cups
echo "  --- Cups ---"
for j in $(seq 0 13); do
  num=$(printf "%02d" $((j+1)))
  download_from_wiki "Cups${num}.jpg" "minor_cups_${RANKS[$j]}.jpg"
done

# Pentacles
echo "  --- Pentacles ---"
for j in $(seq 0 13); do
  num=$(printf "%02d" $((j+1)))
  download_from_wiki "Pents${num}.jpg" "minor_pentacles_${RANKS[$j]}.jpg"
done

# Swords
echo "  --- Swords ---"
for j in $(seq 0 13); do
  num=$(printf "%02d" $((j+1)))
  download_from_wiki "Swords${num}.jpg" "minor_swords_${RANKS[$j]}.jpg"
done

# Wands
echo "  --- Wands ---"
for j in $(seq 0 13); do
  num=$(printf "%02d" $((j+1)))
  download_from_wiki "Wands${num}.jpg" "minor_wands_${RANKS[$j]}.jpg"
done

echo ""
echo "=== Resizing to 300px height ==="
cd "$OUT_DIR"
for f in *.jpg; do
  if [ -f "$f" ]; then
    sips -Z 300 "$f" --out "$f" >/dev/null 2>&1
  fi
done

echo ""
TOTAL=$(ls -1 "$OUT_DIR"/*.jpg 2>/dev/null | wc -l | tr -d ' ')
echo "=== Done! Total: $TOTAL images ==="
