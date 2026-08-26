/**
 * RA (Rule Atom) — 휴대전화 번호 포맷·검증 순수 함수.
 *
 * 외부 의존성(DB, fetch, window, localStorage)을 포함하지 않는다.
 * 입력 폼과 도메인 검증이 같은 규칙을 쓰도록 여기에만 규칙을 둔다.
 */

/** 국내 휴대전화 번호 최대 자릿수 (하이픈 제외). */
const MAX_DIGITS = 11;

/** 하이픈·공백 등을 제거하고 숫자만 남긴다. 최대 11자리로 자른다. */
export const RA_PHONE_DIGITS = (input: string): string =>
  input.replace(/\D/g, '').slice(0, MAX_DIGITS);

/**
 * 입력 중에도 자연스럽게 하이픈을 넣는다.
 *
 *   01012341234 -> 010-1234-1234
 *   0111234567  -> 011-123-4567
 *   0101234     -> 010-1234        (입력 중)
 *
 * 숫자만 추출해 다시 조립하므로 백스페이스로 하이픈을 지워도 어긋나지 않는다.
 */
export const RA_PHONE_FORMAT = (input: string): string => {
  const d = RA_PHONE_DIGITS(input);
  if (d.length <= 3) return d;
  if (d.length <= 7) return `${d.slice(0, 3)}-${d.slice(3)}`;
  // 10자리는 3-3-4, 11자리는 3-4-4 로 나눈다.
  if (d.length <= 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
};

/**
 * 국내 휴대전화 번호로 유효한지.
 * `01`로 시작하는 10자리 또는 11자리만 인정한다.
 * FA_CREATE_RESERVATIONS 의 검증 규칙과 동일한 범위를 커버한다.
 */
export const RA_PHONE_IS_VALID = (input: string): boolean => {
  const d = RA_PHONE_DIGITS(input);
  return /^01\d{8,9}$/.test(d);
};
