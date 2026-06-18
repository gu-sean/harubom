/**
 * constants.js — 앱 전역에서 공유하는 정적 상수 모음.
 *
 * 반복 옵션(REPEAT), localStorage 키(LS), 한국 공휴일 테이블(KR_HOLIDAYS),
 * 카테고리/색상/테마 프리셋 등 값이 고정된 데이터를 export 한다.
 * 로직이 필요한 헬퍼는 utils/helpers에 두고, 여기엔 순수 데이터만 둔다.
 */

// 일정 반복 주기 → 한국어 라벨 매핑 (UI 셀렉트/뱃지 표시용)
export const REPEAT = {none:'없음',daily:'매일',weekly:'매주',monthly:'매월',yearly:'매년'};

// 하루(밀리초). 날짜 차이 계산에서 반복 사용되므로 상수로 고정.
export const MS_PER_DAY = 86400000;
// localStorage 키 모음. 오타로 인한 키 불일치를 막기 위해 한곳에 모아둠.
export const LS = { DATA:'nhr_data', THEME:'nhr_theme', DARK:'nhr_dark', LANG:'nhr_lang', TAGS:'nhr_recent_tags', ONBOARDED:'harubom_onboarded' };

// ══════════════════════════════════════
// 한국 공휴일 데이터
// ══════════════════════════════════════
// 양력 고정 공휴일은 fixed, 음력 기반(설/추석/석가탄신일 등)은 매년 양력 날짜가
// 달라지므로 연도별로 미리 변환해 lunar 테이블에 박아둔다(2024~2027 커버).
export const KR_HOLIDAYS = {
  // 고정 공휴일
  fixed: [
    { month: 1,  day: 1,  name: '신정' },
    { month: 3,  day: 1,  name: '삼일절' },
    { month: 5,  day: 5,  name: '어린이날' },
    { month: 6,  day: 6,  name: '현충일' },
    { month: 8,  day: 15, name: '광복절' },
    { month: 10, day: 3,  name: '개천절' },
    { month: 10, day: 9,  name: '한글날' },
    { month: 12, day: 25, name: '크리스마스' },
  ],
  // 음력 기반 공휴일 (양력 변환, 2024~2027)
  lunar: {
    '2024-02-09': '설날연휴', '2024-02-10': '설날', '2024-02-11': '설날연휴',
    '2024-02-12': '설날대체', '2024-04-10': '국회의원선거', '2024-05-06': '어린이날대체',
    '2024-05-15': '부처님오신날', '2024-09-16': '추석연휴', '2024-09-17': '추석',
    '2024-09-18': '추석연휴',
    '2025-01-28': '설날연휴', '2025-01-29': '설날', '2025-01-30': '설날연휴',
    '2025-05-05': '어린이날/부처님오신날', '2025-10-05': '추석연휴',
    '2025-10-06': '추석', '2025-10-07': '추석연휴', '2025-10-08': '추석대체',
    '2026-02-16': '설날연휴', '2026-02-17': '설날', '2026-02-18': '설날연휴',
    '2026-05-25': '부처님오신날', '2026-09-24': '추석연휴',
    '2026-09-25': '추석', '2026-09-26': '추석연휴',
    '2027-02-07': '설날연휴', '2027-02-08': '설날', '2027-02-09': '설날연휴',
    '2027-05-13': '부처님오신날', '2027-09-14': '추석연휴',
    '2027-09-15': '추석', '2027-09-16': '추석연휴',
  }
};

// getHoliday — 'YYYY-MM-DD' 문자열을 받아 공휴일 이름을 반환(없으면 null).
export const getHoliday = (dateStr) => {
  // 음력 기반 먼저 확인
  if (KR_HOLIDAYS.lunar[dateStr]) return KR_HOLIDAYS.lunar[dateStr];
  // 고정 공휴일
  const d = new Date(dateStr + 'T00:00:00');
  const m = d.getMonth() + 1, day = d.getDate();
  const fixed = KR_HOLIDAYS.fixed.find(h => h.month === m && h.day === day);
  return fixed ? fixed.name : null;
};

// 일정 카테고리 프리셋 (라벨/이모지/색상). id가 events에 저장되는 실제 키.
export const CATEGORIES = [
  {id:'personal',label:'개인',emoji:'👤',color:'#7EC8E3'},
  {id:'work',label:'업무',emoji:'💼',color:'#FF9A7B'},
  {id:'health',label:'건강',emoji:'💪',color:'#52B69A'},
  {id:'social',label:'약속',emoji:'🤝',color:'#FFB347'},
  {id:'study',label:'학습',emoji:'📚',color:'#9B7FD4'},
];
// 사용자 지정 색상 팔레트 (커스텀 카테고리/일정 색상 선택용)
export const COLORS = ['#FF6B6B','#FF9A7B','#FFB347','#52B69A','#7EC8E3','#9B7FD4','#FF6CAE','#4A90D9','#95D44A','#F7C59F'];
// 앱 테마 프리셋. id를 LS.THEME에 저장하고 CSS 변수로 강조색을 바꾼다.
export const THEMES = [
  {id:'pink',label:'핑크',color:'#F5604A'},
  {id:'mint',label:'민트',color:'#3DBFA0'},
  {id:'lavender',label:'라벤더',color:'#9B7FD4'},
  {id:'blue',label:'딥블루',color:'#4A90D9'},
];
