# 캥거루 대리의 바나나 연구소

**주소: https://banana-lab.pages.dev/**
<br>

바나나 시세, 원산지, 메이커, TMI를 보여주는 정적 사이트예요. Astro로 만들고 Cloudflare Pages에 무료로 배포해요.

데이터는 GitHub Actions가 매일 공공데이터로 갱신해요. 처음 받았을 땐 예시 데이터가 들어 있고, 첫 수집 때 실제 값으로 바뀌어요.

---

## 1. 실행하기

Node.js 18.20 이상(가능하면 22)이 필요해요.

```bash
npm install        # 처음 한 번만
npm run dev        # 개발 서버 → http://localhost:4321
npm run build      # 배포용 파일을 dist/ 폴더에 생성
npm run preview    # 빌드 결과를 로컬에서 확인
```

`npm run dev`를 켜두고 파일을 저장하면 브라우저가 바로 바뀌어요.

---

## 2. 폴더 구조

```
banana-lab/
├─ astro.config.mjs        # Astro 설정
├─ wrangler.toml           # Cloudflare 설정 (D1 연결)
├─ functions/api/          # 서버 API (랭킹) - Cloudflare Pages Functions
├─ server/lib.js           # API 공통 코드 (닉네임, 한도, 순위 계산)
├─ migrations/             # D1 테이블 생성 SQL
├─ scripts/                # 공공데이터 수집 스크립트
├─ public/                 # 그대로 복사되는 파일 (favicon 등)
└─ src/
   ├─ pages/               # 파일 하나 = 주소 하나
   │  └─ index.astro       #   → "/"
   ├─ layouts/
   │  └─ BaseLayout.astro  # <html><head> 공통 뼈대
   ├─ components/          # 화면 조각 (캥거루, 시세 카드, 차트...)
   ├─ data/                # JSON 데이터 (나중에 배치가 자동 갱신)
   └─ styles/global.css    # 색, 글꼴 같은 공통 스타일
```

Spring으로 비유하면 이래요.

| Astro | Spring Boot 비유 |
|---|---|
| `src/pages/*.astro` | `@GetMapping` 컨트롤러 + 뷰 |
| `src/layouts/` | 공통 레이아웃 템플릿 (Thymeleaf layout) |
| `src/components/` | 재사용 fragment |
| `src/data/*.json` | DB 대신 쓰는 정적 데이터 |
| `npm run build` | `./gradlew build` → 결과물은 HTML 파일들 |

가장 큰 차이는 **페이지를 미리 만들어둔다**는 거예요. 빌드할 때 모든 페이지를 HTML로 만들어두고, 그 파일만 올려요. 사람마다 달라야 하는 랭킹만 작은 API(`functions/`)가 처리해요.

---

## 3. `.astro` 파일 문법

`.astro` 파일은 위아래 두 부분으로 나뉘어요.

```astro
---
// ① 위쪽 (frontmatter): 빌드할 때 서버에서 한 번 실행되는 JS/TS
import price from '../data/price.json';
const latest = price.history.at(-1);
---

<!-- ② 아래쪽: HTML 템플릿. {} 안에 JS 값을 넣어요 -->
<p>오늘 바나나 {latest.price}원</p>

<style>
  /* 이 컴포넌트에만 적용되는 CSS (자동으로 범위가 좁혀져요) */
  p { font-weight: 700; }
</style>
```

### 자주 쓰는 패턴

**반복 출력** (`th:each` 같은 것)
```astro
{makers.map((m) => <MakerCard {...m} />)}
```

**조건 출력** (`th:if` 같은 것)
```astro
{price.isSample && <span>예시 데이터</span>}
```

**컴포넌트에 값 넘기기 (Props)**
```astro
---
// RipenessScale.astro
interface Props { stage: number }
const { stage } = Astro.props;
---
<!-- 쓰는 쪽 -->
<RipenessScale stage={6} />
```

**레이아웃으로 감싸기 (`<slot />`)**
```astro
<BaseLayout title="바나나 연구소">
  <main>이 내용이 BaseLayout의 <slot /> 자리에 들어가요</main>
</BaseLayout>
```

**브라우저에서 돌아가는 JS**
frontmatter는 빌드 때만 돌아요. 버튼 클릭 같은 건 `<script>`에 써요.
```astro
<script is:inline define:vars={{ facts }}>
  // define:vars로 빌드 시점 데이터(facts)를 브라우저에 넘길 수 있어요
  document.getElementById('tmi-next').addEventListener('click', () => { ... });
</script>
```

---

## 4. 페이지 추가하기

`src/pages/makers.astro` 파일을 만들면 `/makers` 주소가 생겨요. 라우터 설정이 따로 없어요.

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
---
<BaseLayout title="바나나 메이커 도감">
  <h1>메이커 도감</h1>
</BaseLayout>
```

---

## 5. 데이터 자동 갱신 구조

```
GitHub Actions (평일 18:00 KST)
  ├─ scripts/fetch-price.mjs    → KAMIS에서 바나나 소매가 → src/data/price.json
  └─ scripts/fetch-imports.mjs  → 관세청에서 국가별 수입량 → src/data/imports.json
        ↓ 바뀐 게 있으면 main에 커밋
Cloudflare Pages가 커밋을 보고 자동 빌드·배포
```

- 시세·통계는 DB를 안 써요. **데이터 = 저장소 안의 JSON 파일**이고, 커밋 기록이 곧 가격 이력이에요.
- 휴일이나 API 오류 때는 기존 JSON을 그대로 둬서 사이트가 깨지지 않아요.
- 세계 생산량은 1년에 한 번 바뀌어서 `npm run data:faostat`으로 손으로 한 번 넣어요.

| 명령 | 하는 일 |
|---|---|
| `npm run data:price` | 오늘 시세 받아서 저장 |
| `npm run data:price -- --dry` | 저장 없이 받아온 바나나 데이터만 출력 (테스트용) |
| `npm run data:imports` | 최근 12개월 수입 원산지 저장 |
| `npm run data:faostat` | `data/raw/faostat.csv`로 생산량 저장 |

---

## 6. 처음부터 배포까지 체크리스트

### ① 키 발급
- [ ] **KAMIS 오픈API**: kamis.or.kr 회원가입 → 오픈API 신청 → `인증키(cert_key)`와 `요청자 ID(cert_id)` 확인
  - 키가 나오기 전에도 `TEST`/`TEST`로 일별 시세 조회는 돼요.
- [ ] **공공데이터포털**: "관세청_품목별 국가별 수출입실적(GW)" 활용신청 → 마이페이지에서 **일반 인증키(Decoding)** 복사
  - 이미 있는 공공데이터포털 계정의 키를 그대로 써요.

### ② 로컬에서 확인
```bash
cp .env.example .env          # 키 채우기
npm install
npm run data:price -- --dry   # 바나나 행이 나오는지 확인
npm run data:price            # 저장
npm run data:imports -- --dry # 국가별 kg 합계가 나오는지 확인
npm run data:imports
npm run dev                   # 화면 확인
```

### ③ 세계 생산량 (한 번만)
1. https://www.fao.org/faostat/en/#data/QCL
2. Countries: **All**, Elements: **Production Quantity**, Items: **Bananas**, Years: **최신 연도**
3. Download → CSV → `data/raw/faostat.csv`로 저장
4. `npm run data:faostat`

### ④ GitHub
```bash
git init && git add . && git commit -m "init: 바나나 연구소"
git branch -M main
git remote add origin https://github.com/<아이디>/banana-lab.git
git push -u origin main
```
- [ ] 저장소 **Settings → Secrets and variables → Actions → New repository secret**에 3개 등록
  - `KAMIS_CERT_KEY`, `KAMIS_CERT_ID`, `DATA_GO_KR_KEY`
- [ ] **Actions 탭 → Update banana data → Run workflow**로 한 번 수동 실행해서 초록불 확인

### ⑤ Cloudflare Pages
1. Cloudflare 대시보드 → **Workers & Pages → Create → Pages → Connect to Git**
2. 저장소 선택, 빌드 설정:
   - Framework preset: **Astro**
   - Build command: `npm run build`
   - Build output directory: `dist`
   - 환경변수 `NODE_VERSION` = `22`
3. 배포가 끝나면 `https://<프로젝트명>.pages.dev` 주소가 나와요.
4. `astro.config.mjs`의 `site`를 그 주소로 바꿔서 커밋해요.

이후로는 Actions가 데이터를 커밋할 때마다 자동으로 다시 배포돼요.

### ⑥ 랭킹용 데이터베이스 (D1)
```bash
npx wrangler login                  # 브라우저로 Cloudflare 로그인
npx wrangler d1 create banana-lab   # 출력된 database_id를 wrangler.toml에 붙여넣기
npm run db:migrate:remote           # 테이블 생성
```
- `wrangler.toml`을 커밋하면 Pages가 거기 적힌 D1 연결(`DB`)을 그대로 써요.
- 연결이 안 잡히면 Cloudflare 대시보드 → Pages 프로젝트 → **Settings → Bindings → D1 database**에서 변수 이름 `DB`로 `banana-lab`을 직접 연결하고 다시 배포해요.
- 배포 후 `https://<주소>/api/ranking`을 열어서 JSON이 나오면 성공이에요.

> 무료 플랜 조건은 바뀔 수 있으니 시작할 때 Cloudflare(Pages, D1)와 GitHub Actions 요금 페이지를 한 번 확인하세요.

---

## 바나나 랭킹 구조

```
브라우저                                Cloudflare Pages Functions        D1 (SQLite)
처음 접속 ── POST /api/register ──────▶ 랜덤 ID + 이름 발급 ─────────────▶ users
바나나 클릭 (1초 모아서) ─ POST /api/feed ▶ 한도 확인 후 오늘 개수 더하기 ──▶ daily_feeds
20초마다 ── GET /api/ranking ─────────▶ 오늘 TOP10, 어제 TOP3, 내 순위
```

- **이름:** 서버가 형용사 + 동물 조합으로 지어줘요 ("꿈꾸는 하마"). 사용자가 직접 못 정해서 이상한 이름 걱정이 없어요.
- **신원:** 로그인 없이, 브라우저 저장소(localStorage)에 ID를 저장해요. 다른 브라우저나 시크릿 창에선 새 사람이 돼요.
- **하루 기준:** 한국 시간 자정에 초기화. 같은 개수면 먼저 도달한 사람이 위예요.
- **어제 TOP3 기믹:** 다음 날 접속하면 하루 한 번 환영 배너가 뜨고, 캥거루 대리가 왕관을 써요. 1위는 바나나 비, 2위는 적은 바나나 비, 3위는 배너만.
- **매크로 방지:** 요청당 최대 30개, 0.7초 간격 제한, 하루 최대 3000개. `server/lib.js`의 `LIMITS`에서 바꿀 수 있어요.
- **서버가 없을 때:** `npm run dev`나 미리보기처럼 `/api`가 없으면 자동으로 "예시 랭킹" 데모 모드가 돼요.

**로컬에서 진짜 서버로 테스트하기**
```bash
npm run db:migrate:local
npm run dev:full        # http://localhost:8788
```
브라우저 창 두 개(일반 + 시크릿)로 열면 두 사람이 경쟁하는 걸 볼 수 있어요.

---

## 7. 문제 생기면

| 증상 | 확인할 것 |
|---|---|
| `data:price`가 "바나나 가격이 없어요" | 주말·공휴일이거나 집계 전이에요. `PRICE_DATE=2026-10-12 npm run data:price -- --dry`처럼 평일 날짜로 확인 |
| KAMIS 응답 필드가 예상과 다름 | `--dry` 출력 보고 `fetch-price.mjs`의 `dpr1`, `day2` 부분 수정 |
| `data:imports` 합계 0 | 활용신청 승인 여부, Decoding 키를 넣었는지 확인. `SERVICE_KEY_IS_NOT_REGISTERED_ERROR`는 승인 직후 1~2시간 지나면 풀려요 |
| Actions가 push 실패 | Settings → Actions → General → Workflow permissions를 **Read and write**로 |
| 예약 실행이 멈춤 | GitHub는 오래 활동이 없는 저장소의 예약 실행을 끌 수 있어요. Actions 탭에서 다시 켜면 돼요 |
| 배포 사이트에서 랭킹이 "예시 랭킹" | `/api/ranking`이 JSON을 안 주는 상태예요. D1 연결(`DB`)과 `db:migrate:remote` 실행 여부 확인 |
| `/api/...`가 500 오류 | 대시보드 → Pages 프로젝트 → 배포 → Functions 로그 확인. 대부분 테이블 미생성 |

---

## 8. 나중에 할 것

- [ ] 바나나 효능 섹션 (출처 필수, 과장 금지)
- [ ] 커스텀 도메인 연결 (Cloudflare Pages → Custom domains)
- [ ] 광고를 붙인다면 개인정보처리방침 페이지 추가
- [ ] 실제 인물 이름·사진은 본인 동의 없이 넣지 않기

## 데이터 출처

- 국내 가격: 한국농수산식품유통공사 KAMIS
- 세계 생산량: FAO FAOSTAT
- 수입 원산지: 관세청 수출입무역통계

공공데이터를 쓸 때는 각 출처의 이용 조건에 맞춰 출처를 표시해요. 화면 하단에 출처가 자동으로 표시돼요.
