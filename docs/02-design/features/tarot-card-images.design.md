# Design: tarot-card-images

## 1. 파일 구조

```
images/tarot/
  major_00_fool.jpg
  major_01_magician.jpg
  ...
  major_21_world.jpg
  minor_cups_ace.jpg
  minor_cups_02.jpg
  ...
  minor_wands_king.jpg
```

총 78개 파일, 각 ~150px 너비 JPG

## 2. image_key ↔ Wikimedia 파일 매핑

### Major Arcana (22장)
| image_key | Wikimedia 파일명 |
|-----------|-----------------|
| major_00_fool | RWS Tarot 00 Fool.jpg |
| major_01_magician | RWS Tarot 01 Magician.jpg |
| ... | ... |
| major_21_world | RWS Tarot 21 World.jpg |

### Minor Arcana (56장)
| Suit | Wikimedia 패턴 | image_key 패턴 |
|------|---------------|---------------|
| Cups (컵) | Cups01~14.jpg | minor_cups_ace~king |
| Pentacles (펜타클) | Pents01~14.jpg | minor_pentacles_ace~king |
| Swords (소드) | Swords01~14.jpg | minor_swords_ace~king |
| Wands (완드) | Wands01~14.jpg | minor_wands_ace~king |

Rank 매핑: 01=ace, 02~10=숫자, 11=page, 12=knight, 13=queen, 14=king

## 3. 다운로드 스크립트 (download-tarot.sh)

1. Wikimedia Commons API로 각 파일의 원본 URL 조회
2. curl로 다운로드 → `images/tarot/{image_key}.jpg`
3. macOS `sips`로 150px 너비 리사이징

## 4. 코드 변경

### 4-1. app.js — renderTarotCards() 수정

```javascript
function renderTarotCards(container, drawResult) {
  container.textContent = '';
  if (!drawResult || !drawResult.reading) return;

  drawResult.reading.forEach((item, i) => {
    const card = item.card;
    const cardEl = createEl('div', 'tarot-card-item card-flip');
    cardEl.style.animationDelay = `${i * 0.2}s`;

    // 카드 이미지
    const imgEl = document.createElement('img');
    imgEl.src = `images/tarot/${card.image_key}.jpg`;
    imgEl.alt = card.korean || card.name;
    imgEl.className = 'tarot-card-img';
    if (card.isReversed) imgEl.classList.add('reversed');
    imgEl.loading = 'lazy';
    cardEl.appendChild(imgEl);

    // 위치/이름/방향 텍스트
    cardEl.appendChild(createEl('div', 'card-position', item.position));
    const nameEl = createEl('div', `card-name ${card.isReversed ? 'reversed' : 'upright'}`,
      card.korean || card.name);
    cardEl.appendChild(nameEl);
    cardEl.appendChild(createEl('div', 'card-direction', item.direction));
    container.appendChild(cardEl);
  });
}
```

### 4-2. style.css — 이미지 스타일 추가

```css
.tarot-card-img {
  width: 120px;
  height: auto;
  border-radius: 8px;
  margin-bottom: 8px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.4);
  transition: transform 0.3s;
}

.tarot-card-img.reversed {
  transform: rotate(180deg);
}

/* 모바일 대응 */
@media (max-width: 600px) {
  .tarot-card-img {
    width: 80px;
  }
}
```

## 5. 구현 순서

1. 다운로드 스크립트 작성 + 실행 (78장 이미지)
2. `app.js` renderTarotCards() 수정
3. `style.css` 이미지 스타일 추가
4. 프리뷰 검증
