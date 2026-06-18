# ✿ 하루봄 (Harubom)

> 일정·습관·목표·기분·추억을 한 곳에서 기록하는 하루 플래너

하루봄은 하루를 더 알차게 보낼 수 있도록 도와주는 **Android 앱**입니다.  
캘린더 기반의 일정 관리부터 습관 트래커, 목표 달성, 기분 기록, 포토 갤러리까지 일상의 모든 기록을 하나의 앱에서 관리합니다.

---

## 주요 기능

| 기능 | 설명 |
|------|------|
| **캘린더** | 월간·주간 뷰, 반복 일정, 멀티데이 일정, 우선순위·카테고리·색상 태그 |
| **D-Day** | 카운트다운/카운트업, 매년 반복, 7일 이내 알림 배너 |
| **목표** | 횟수·습관·일정 연동 진행도, 달성 축하 카드 공유 |
| **습관** | 주간·월간 히트맵, 연속 달성 스트릭, 색상 커스터마이징 |
| **통계** | 월별 달성률 추이, 카테고리 분포, 주간 리포트 |
| **갤러리** | 사진 업로드·편집(밝기·채도·필터·회전), 포토 캘린더, 드래그 정렬 |
| **기분** | 이모지 기반 하루 기분 기록 + 하루 되돌아보기 |
| **문의** | 인앱 피드백 제출 및 운영자 답변 확인 |
| **다국어** | 한국어·영어·중국어·일본어 |
| **클라우드 동기화** | Firebase 로그인 시 Firestore 백업/복원 |
| **다크모드·테마** | 핑크·민트·라벤더·딥블루 4가지 테마 + 다크모드 |

---

## 기술 스택

| 분류 | 내용 |
|------|------|
| **프론트엔드** | React 18, Vite 8, `@vitejs/plugin-react` |
| **UI 방식** | `React.createElement` (JSX 빌드 타임 변환) |
| **앱 패키징** | Capacitor 6 — Android 전용 |
| **백엔드** | Firebase Auth · Firestore · Storage · FCM |
| **서버리스** | Vercel Serverless Functions (`api/send-notifications.js`) |
| **푸시 알림** | FCM + Vercel Cron (매일 KST 09:00 발송) |
| **로컬 저장소** | localStorage (상태 영속화) + IndexedDB (사진 원본) |
| **린트** | ESLint (`no-undef`, `unused-imports`, `react-hooks`) |
| **스크린샷** | Playwright (Headless Chromium) |

---

## 디렉터리 구조

```
naharu-app/
│
├── index.html                  # Vite 진입점 · Firebase를 window._FB로 초기화
├── vite.config.js              # Vite 설정 (React 플러그인, dist 출력)
├── eslint.config.mjs           # ESLint flat config
├── capacitor.config.json       # Capacitor 설정 (webDir: dist, Android 전용)
├── vercel.json                 # Vercel 배포 · Cron 스케줄 설정
├── firebase.json               # Firebase 프로젝트 설정
├── firestore.rules             # Firestore 보안 규칙
├── storage.rules               # Firebase Storage 보안 규칙
│
├── public/                     # Vite가 dist/ 루트에 그대로 복사하는 정적 자산
│   ├── sw.js                   #   서비스 워커 (오프라인 캐시 · FCM 백그라운드 알림)
│   ├── manifest.json           #   PWA 매니페스트
│   ├── privacy.html            #   개인정보처리방침
│   ├── icons/                  #   앱 아이콘 (72 ~ 512px)
│   └── .well-known/
│       └── assetlinks.json     #   Android App Links 검증 파일
│
├── src/
│   ├── main.jsx                # React 루트 마운트
│   ├── App.jsx                 # 루트 컴포넌트 · 전역 상태·탭·모달 오케스트레이션
│   ├── store.js                # useReducer 전역 스토어 · localStorage 영속화
│   ├── constants.js            # 전역 상수 (LS 키, 공휴일, 카테고리/색상/테마)
│   ├── helpers.js              # 목표 진행률 계산 · 정렬 · 공유 카드 렌더
│   ├── hooks.jsx               # 커스텀 훅 (useUndo · useSwipeCal · useDragSort)
│   ├── utils.js                # 순수 유틸 (날짜 · 토스트 · 진동 · IndexedDB)
│   ├── i18n.jsx                # 언어 컨텍스트 · 번역 훅 (useT, useDateI18n)
│   ├── translations.js         # 다국어 사전 (ko / en / zh / ja)
│   │
│   └── components/             # 기능별 컴포넌트 (각 폴더 index.jsx)
│       ├── common/             #   Header · BottomNav · OfflineBanner · EmptyState
│       ├── calendar/           #   캘린더 탭 · 일정 목록 · 기분 · 하루 되돌아보기
│       ├── dday/               #   D-Day 탭 + 편집 모달
│       ├── goals/              #   목표 탭 + 편집 모달 + 달성 축하
│       ├── habits/             #   습관 탭 + 편집 모달
│       ├── stats/              #   통계 탭 · 주간 리포트 · 추이 차트
│       ├── gallery/            #   갤러리 · 포토 캘린더 · 사진 편집기
│       ├── modals/             #   일정 · 기분 · 검색 모달
│       ├── settings/           #   테마 · 언어 · 알림 설정
│       ├── account/            #   로그인 / 회원가입 / 클라우드 동기화
│       ├── feedback/           #   인앱 문의 + 관리자 패널
│       └── onboarding/         #   첫 실행 온보딩 슬라이드
│
├── api/
│   └── send-notifications.js   # Vercel Serverless · Firestore 순회 → FCM 발송
│
└── android/                    # Capacitor Android 네이티브 프로젝트 (Gradle)
```


