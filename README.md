# BLACK SPACE (React + Vite)

기존 단일 `index.html` 앱을 **디자인 변경 없이** React + Vite 구조로 감싼 버전입니다.

## 실행 방법 (로컬)

```bash
npm install
npm run dev -- --host 127.0.0.1 --port 4173 --strictPort
```

브라우저 접속:
- `http://127.0.0.1:4173/`

## 테스트 방법

전체 테스트:

```bash
npm test
```

세부 테스트:

```bash
npm run test:unit   # Vitest (React/레거시 로더)
npm run test:sync   # 기존 sync.js node 테스트
```

## 빌드 방법

```bash
npm run build
npm run preview
```

## GitHub Pages 배포 (현재 배포 안정화)

React + Vite 구조에서는 브라우저가 `src/main.jsx`를 직접 실행하면 안 되므로, **빌드 후 dist 배포**가 필요합니다.
이 저장소에는 이를 자동화한 워크플로우가 포함되어 있습니다.

- 워크플로우 파일: `.github/workflows/deploy-pages.yml`
- 동작: `main` 브랜치 푸시 시 자동으로 `npm ci` → `npm run build` → Pages 배포

### GitHub 설정 확인 (1회)

GitHub 저장소 설정에서 아래처럼 맞추면 됩니다.

1. `Settings > Pages` 이동
2. `Source`를 `GitHub Actions`로 설정

이후부터는 기존처럼 `main`에 푸시만 하면 배포가 자동 반영됩니다.

## 구조

- `src/components/LegacyApp.jsx`
  - React 컴포넌트에서 기존 앱 DOM/스크립트를 마운트
- `src/legacy/legacy-source.html`
  - 리팩터링 전 기존 원본 HTML 보관
- `src/legacy/loader.js`
  - 원본 HTML에서 `style/body/script` 분리 및 런타임 주입
- `tests/legacy-loader.test.js`
  - 로더 분리/마운트 동작 테스트
- `tests/legacy-app-react.test.jsx`
  - React 래퍼 렌더/전역 핸들러 노출 테스트
- `sync.js`, `sync.test.cjs`
  - 기존 동기화 로직 및 회귀 테스트 유지
- `public/`
  - PWA 정적 자산(`sw.js`, manifest, icons)
