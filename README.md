# Woojae Joo — Developer Note

GitHub Pages로 운영하는 개인 기술 개발 블로그이자 포트폴리오입니다. 글과 About(이력)은 노션에서 작성하고, 정적 데이터(`data/notion-posts.json`)로 동기화해서 홈페이지에서 빠르게 보여주는 구조입니다. 방문자는 노션 페이지로 이동하지 않고 홈페이지 안에서 본문을 그대로 읽습니다.

프레임워크 없는 정적 사이트(바닐라 JS + CSS)이며, 현재 **글 162개 · 토픽 11개**(Kubernetes, AI/Deep Learning, Coding Test, Application, AI/Theory, Python, C/C++, Tools, ONNX-MLIR, Robotics, Reinforcement Learning)로 구성되어 있습니다. 페이지는 홈(`index.html`), 글(`post.html` → 정적 `/posts/<slug>/`), 토픽(`/topics/<slug>/`), 아카이브(`archive.html`), CV(`cv.html`), 404(`404.html`)로 나뉩니다.

## 주요 기능

현재 사이트에 적용되어 있는 기능 전체 목록입니다. 노션에 글만 쓰면 되도록 하면서, 읽기 경험·탐색·공유·SEO까지 챙기는 것을 목표로 했습니다.

### 콘텐츠 · 동기화

- **노션으로 글 작성** → 정적 JSON으로 동기화. 방문자는 사이트 안에서 본문을 그대로 읽습니다(노션 이동 없음).
- **실시간 반영** — 노션에서 추가/삭제/수정하면 약 1분 내 사이트에 반영됩니다(노션 웹훅 → val.town 릴레이 → `repository_dispatch`). 15분 cron은 안전망(fallback)입니다.
- **이미지 정적화** — 노션의 만료되는 이미지 URL 대신 `assets/notion/` 아래로 내려받아 저장합니다.
- **다양한 노션 블록 지원** — 문단·제목·리스트·체크리스트·인용·콜아웃·토글·코드(언어 라벨)·이미지(캡션)·표·다단(columns)·구분선·북마크/임베드, 그리고 **수식**(KaTeX).
- **RSS 피드**(`feed.xml`)와 **사이트맵**(`sitemap.xml`)을 매 동기화마다 자동 생성합니다.

### 홈 · 탐색

- **히어로** — "trade-off frontier" SVG 아트(인터랙티브 노드: Best for A / Balanced / Best for B).
- **글 목록** — 작성일 최신순 카드(카테고리 · 태그 · 요약 · 날짜).
- **전체 검색** — 제목 · 요약 · 카테고리 · 태그 · **본문**까지 즉시 필터링.
- **토픽 필터** — 카테고리별 칩(각 글 수 표시).
- **태그 필터** — 카드의 태그 칩을 누르면 해당 태그만 모아보기(`?tag=` URL 지원, 해제 버튼).
- **더 보기** — 12개씩 페이지네이션(검색/필터 시 초기화).
- **토픽별 모아보기** — `Browse by topic` + 정적 `/topics/<slug>/` 페이지(11개).
- **아카이브** — 모든 글을 연도별로 모아보기(`/archive.html`).
- **⌘K / Ctrl+K 명령 팔레트** — 어느 페이지에서나 글을 빠르게 검색·이동(방향키 · Enter · Esc).

### 글 페이지

- **목차(TOC) + 스크롤 스파이** — 현재 보고 있는 섹션을 자동 하이라이트하고 목차를 중앙에 맞춥니다.
- **글 안에서 검색** — 본문에서 일치하는 부분을 하이라이트하고 Enter로 순회.
- **읽기 진행률 바**(상단) + **맨 위로** 버튼.
- **글자 크기 조절**(작게 / 보통 / 크게, 저장됨).
- **코드 블록** — 문법 하이라이트(highlight.js) + 언어 라벨 + 줄 번호 + 복사 버튼, 라이트/다크 테마 대응.
- **Mermaid 다이어그램** 렌더링(테마 연동).
- **수식(KaTeX)** — 인라인 · 블록.
- **이미지 라이트박스** — 클릭하면 전체화면으로 확대(Esc로 닫기).
- **제목 앵커(#)** — 섹션 링크 복사.
- **각주** — 부드러운 스크롤 + 잠깐 강조(각주가 있는 글에서만 동작).
- **브레드크럼** — 홈 › 카테고리.
- **관련 글** — 같은 토픽/태그 글 추천(최대 3개).
- **이전 / 다음 글** 네비게이션.
- **시리즈 박스** — 노션 `Series` 속성을 쓰면 연재 목차가 자동으로 표시됩니다.
- **저자 박스** — 사진 · 소개 · 프로필 링크.
- **공유 바** — 링크 복사 · X · LinkedIn · 카카오톡.
- **인용(Cite)** — BibTeX + 인용 문구를 모달에서 복사.
- **조회수** — val.town 카운터(브라우저 세션당 1회 집계).
- **글 하단 CTA** — RSS 구독 / 이메일 보내기.
- **댓글(Giscus)** — GitHub Discussions 기반, 테마 동기화, "댓글로 이동" 플로팅 버튼.

### CV 페이지 (`/cv.html`)

- 노션 About 페이지 본문 + 프로필 카드(사진 · 이름 · GitHub/LinkedIn/Email).
- **Writing about** — 주제별 글 수를 보여주는 칩.
- **마지막 업데이트** — 노션 About 페이지의 수정일을 글래스 알약(pill)으로 표시.
- 글 수 · 토픽 수 통계.

### 디자인 · 공통 UX

- **리퀴드 글래스 헤더** + **슬라이딩 글래스 내비** — 현재 메뉴 항목으로 미끄러지는 프로스티드 캡슐(Apple dock 스타일).
- **다크 / 라이트 테마** — 토글 + 시스템 설정 따름, 깜빡임 없는 사전 적용, 선택값 저장.
- **키보드 단축키 + `?` 도움말** — ⌘K·`/`(검색), `T`(테마), `G`→`H`(홈), `Esc`(닫기).
- **hover 프리페치 + 페이지 전환 애니메이션(View Transitions)** — 글 링크에 마우스만 올려도 미리 로딩해 이동이 즉각적으로 느껴집니다.
- **인쇄 / PDF 스타일** 최적화.
- **반응형** 레이아웃 + 접근성(스킵 링크, ARIA, `prefers-reduced-motion` 존중).

### SEO · 성능 · 인프라

- **정적 per-post 페이지**(`/posts/<slug>/`) — JS를 실행하지 않는 링크 미리보기 스크래퍼(카카오톡 · 슬랙 등)를 위해 글마다 정확한 OG/Twitter 태그를 정적 `<head>`에 심습니다.
- **구조화 데이터(JSON-LD)** — `BlogPosting` + `BreadcrumbList`.
- **페이지별 메타** — description · canonical · Open Graph · Twitter Card.
- **PWA** — `manifest.json` + 서비스 워커(`sw.js`).
- **Google Analytics(GA4)** — 모든 페이지 `<head>`에 gtag.
- **캐시 버스팅** — CSS/JS에 `?v=` 버전을 붙여 배포마다 갱신.

## 로컬 확인

```bash
npm run serve
```

브라우저에서 `http://localhost:4173`을 열면 됩니다. (`data/notion-posts.json`의 샘플 데이터로 미리 볼 수 있습니다.)

## Notion 연동

브라우저에서 노션 토큰을 직접 쓰지 않습니다. GitHub Actions가 서버 쪽에서 노션 API를 호출하고 결과 JSON과 이미지만 커밋합니다. 노션 파일 이미지는 만료 URL 대신 `assets/notion/` 아래로 내려받아 정적으로 저장합니다.

### 필요한 GitHub Secrets

- `NOTION_TOKEN`: 노션 integration token
- `NOTION_DATA_SOURCE_IDS`: 쉼표로 구분한 노션 data source ID 목록. 비워두면 `notion.sources.json`의 목록을 사용합니다.
- `NOTION_ABOUT_PAGE_ID`: About 섹션으로 보여줄 노션 페이지 ID. 비워두면 About 본문은 비어 있고 안내 문구가 표시됩니다.

### About(이력) 페이지 연결

1. 노션에서 자기소개 · 경력 · 학력 · 기술 스택을 정리한 페이지를 하나 만듭니다.
2. 그 페이지를 노션 integration과 공유합니다.
3. 페이지 URL 끝의 ID(32자리)를 `NOTION_ABOUT_PAGE_ID` secret에 넣거나, `notion.sources.json`의 `about.pageId`에 적습니다.
4. 다음 동기화부터 About 섹션 본문이 자동으로 채워집니다. 문단/제목/리스트/인용 등은 그대로 스타일이 적용됩니다.

### 옵션 환경 변수

- `NOTION_TITLE_PROPERTY`: 제목 속성명. 기본값 `이름`
- `NOTION_TAG_PROPERTY`: 태그 속성명. 기본값 `Tag`
- `NOTION_SUMMARY_PROPERTY`: 요약 속성명. 기본값 `Summary`
- `NOTION_SLUG_PROPERTY`: slug 속성명. 기본값 `Slug`
- `NOTION_STATUS_PROPERTY`: 공개 상태 속성명. 비워두면 전체 공개
- `NOTION_PUBLISHED_STATUS`: 공개 상태 값. 기본값 `Published`
- `NOTION_ASSET_DIR`: 노션 이미지 저장 위치. 기본값 `assets/notion`

## 처음 한 번 동기화하기 (로컬)

```bash
export NOTION_TOKEN=ntn_여기에토큰          # 절대 커밋하지 마세요
export NOTION_ABOUT_PAGE_ID=...            # About 페이지가 있으면 (선택)
npm run sync:notion                        # data/notion-posts.json + assets/notion/ 갱신
npm run serve                              # http://localhost:4173 에서 확인
```

데이터소스의 속성 이름이 기본값(`이름`, `Tag`, `Summary`, `Slug`)과 다르면 위 "옵션 환경 변수"로 맞춰주세요. 결과물(`data/notion-posts.json`, `assets/notion/`)만 커밋하고 토큰은 커밋하지 않습니다.

## 동기화가 도는 방식

워크플로(`.github/workflows/sync-notion.yml`)는 세 가지로 실행됩니다.

1. `repository_dispatch` (type `notion-sync`) — **실시간**. 노션에서 글을 추가/삭제/수정하면 곧바로 실행됩니다(아래 설정 필요).
2. `schedule` (`*/15`) — **fallback**. GitHub의 cron은 정시 보장이 없는 best-effort라 실시간 용도로는 못 씁니다. 실시간 트리거가 빠뜨린 경우의 안전망입니다.
3. `workflow_dispatch` — Actions 탭에서 수동 실행.

## 실시간 동기화 (노션 → GitHub 즉시 반영)

노션 웹훅은 GitHub의 dispatch API가 요구하는 본문(`{"event_type":"notion-sync"}`)을 직접 만들 수 없어서, 사이에 작은 릴레이(`scripts/notion-relay.ts`) 하나를 둡니다. 노션 **integration 웹훅**은 `page.created`/`page.deleted`/`page.undeleted`/`page.moved`/`page.content_updated`/`page.properties_updated`를 보내므로 추가·삭제 모두 즉시 반영됩니다.

1. **GitHub 토큰**: github.com/settings/tokens → Fine-grained token → 저장소 `ursonice/ursonice.github.io`, 권한 **Contents: Read and write**.
2. **릴레이 배포**: [val.town](https://www.val.town)에서 새 HTTP val을 만들고 `scripts/notion-relay.ts` 내용을 붙여넣습니다. val의 환경변수에 `GITHUB_TOKEN`=위 토큰을 등록하고, 공개 URL(`https://<유저>-<val>.web.val.run`)을 확인합니다.
3. **노션 웹훅 구독**: notion.so → Settings → Connections(또는 `notion.so/profile/integrations`) → `NOTION_TOKEN`을 발급한 integration → **Webhooks** 탭 → **Create a subscription** → Webhook URL에 위 val URL 입력 → 이벤트 선택(위 6종).
4. **검증**: 노션이 릴레이로 `verification_token`을 한 번 POST합니다. val의 Logs에 찍힌 토큰을 복사해 노션 Webhooks 탭의 **Verify** 버튼에 붙여넣으면 구독이 활성화됩니다.

이후 노션에서 글을 올리거나 지우면 수십 초 내 사이트에 반영됩니다. 토큰은 릴레이 호스트의 환경변수에만 두고, 저장소에는 절대 커밋하지 않습니다.

## 공유 카드(OG 이미지)

링크를 공유했을 때(카카오톡 · 슬랙 · X) 본문 첫 이미지 대신 **글 제목이 박힌 카드**가 뜨도록, OG 이미지를 실시간 생성하는 작은 val을 둡니다. 켜기 전까지는 기존처럼 본문 첫 이미지/기본 이미지를 씁니다(끄면 아무 변화 없음).

1. **val 배포**: [val.town](https://www.val.town)에서 새 HTTP val을 만들고 `scripts/og-image.tsx` 내용을 붙여넣습니다. 저장 후 공개 URL에 테스트 쿼리를 붙여 PNG가 뜨는지 확인합니다 — 예: `https://<유저>-ogimage.web.val.run/?title=테스트%20제목&cat=AI` (첫 요청은 폰트를 받느라 느립니다).
2. **사이트에 연결**: 위 base URL(쿼리 제외)을 두 곳에 넣습니다.
   - `scripts/gen-post-pages.mjs` — `OG_IMAGE_URL` 환경변수(GitHub Actions의 repository **Variable** `OG_IMAGE_URL`로 두는 게 가장 깔끔)
   - `assets/js/post.js` — 상단 `const OG_IMAGE_URL = ""` 값
3. 다음 동기화부터 `/posts/<slug>/` 페이지의 `og:image`가 생성 카드로 바뀝니다. (정적 페이지의 태그가 스크래퍼에 실제로 쓰이는 값입니다.)

`og:image` 카드 디자인(색·레이아웃·폰트)은 `scripts/og-image.tsx`에서 바꿀 수 있습니다. 한글 폰트는 Pretendard(OFL)를 받아 쓰며, URL이 막히면 다른 한글 TTF/OTF로 교체하면 됩니다.

## 지원하는 노션 블록

본문·제목·리스트·체크리스트(to-do)·인용·콜아웃·토글·코드(언어 라벨)·이미지(캡션)·표·다단(columns)·구분선·북마크/임베드·파일/영상 링크, 그리고 **수식**(인라인·블록)을 렌더링합니다. 수식은 글 페이지에서 KaTeX(CDN)로 표시되므로 표시에는 인터넷 연결이 필요합니다.

## 직접 바꾸기 쉬운 곳

- 이름·이메일·GitHub 링크: `index.html`의 `.profile-card`와 `.footer-links`
- 색/폰트/간격 등 디자인 토큰: `assets/css/styles.css` 상단의 `:root`
- 연결된 노션 데이터소스 목록: `notion.sources.json`
