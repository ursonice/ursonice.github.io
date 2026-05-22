# Woojae Joo — Developer Note

GitHub Pages로 운영하는 개인 기술 개발 블로그이자 포트폴리오입니다. 글과 About(이력)은 노션에서 작성하고, 정적 데이터(`data/notion-posts.json`)로 동기화해서 홈페이지에서 빠르게 보여주는 구조입니다. 방문자는 노션 페이지로 이동하지 않고 홈페이지 안에서 본문을 그대로 읽습니다.

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

데이터소스의 속성 이름이 기본값(`이름`, `Tag`, `Summary`, `Slug`)과 다르면 위 "옵션 환경 변수"로 맞춰주세요. 결과물(`data/notion-posts.json`, `assets/notion/`)만 커밋하고 토큰은 커밋하지 않습니다. 자동화는 GitHub Secrets에 같은 값을 넣으면 12시간마다 워크플로가 동기화합니다.

## 지원하는 노션 블록

본문·제목·리스트·체크리스트(to-do)·인용·콜아웃·토글·코드(언어 라벨)·이미지(캡션)·표·다단(columns)·구분선·북마크/임베드·파일/영상 링크, 그리고 **수식**(인라인·블록)을 렌더링합니다. 수식은 글 페이지에서 KaTeX(CDN)로 표시되므로 표시에는 인터넷 연결이 필요합니다.

## 직접 바꾸기 쉬운 곳

- 이름·이메일·GitHub 링크: `index.html`의 `.profile-card`와 `.footer-links`
- 색/폰트/간격 등 디자인 토큰: `assets/css/styles.css` 상단의 `:root`
- 연결된 노션 데이터소스 목록: `notion.sources.json`
