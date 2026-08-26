# -*- coding: utf-8 -*-
"""회원가입 폼 개선 — 비밀번호 확인 필드, 휴대폰 자동 하이픈, 저장 성공 후 안내."""
import io
import sys

count = 0


def load(p):
    return io.open(p, encoding='utf-8').read()


def save(p, t):
    io.open(p, 'w', encoding='utf-8', newline='\n').write(t)


def rep(text, old, new, tag=''):
    global count
    if new in text:
        print('  skip[%s]: already applied' % tag)
        return text
    c = text.count(old)
    if c != 1:
        sys.exit('FAIL[%s]: %d matches (expected 1)\n---\n%s' % (tag, c, old[:250]))
    count += 1
    return text.replace(old, new)


# =====================================================================
# 1. AuthModal.tsx
# =====================================================================
P = 'src/components/AuthModal.tsx'
s = load(P)

# 1-1) import 및 props 시그니처 (등록을 비동기로)
s = rep(s, """import { User, LogIn, UserPlus, Phone, Lock, Sparkles, CheckCircle2 } from 'lucide-react';
import logoImg from '../assets/르하임로고.jfif';

interface AuthModalProps {
  onLoginSuccess: (user: UserAccount) => void;
  onRegisterUser: (newUser: Omit<UserAccount, 'id'>) => { success: boolean; message?: string };
  existingUsers: UserAccount[];
}""",
        """import { User, LogIn, UserPlus, Phone, Lock, Sparkles, CheckCircle2 } from 'lucide-react';
import logoImg from '../assets/르하임로고.jfif';
import { RA_PHONE_FORMAT, RA_PHONE_IS_VALID } from '../atoms/common/RA_phone';

interface AuthModalProps {
  onLoginSuccess: (user: UserAccount) => void;
  /**
   * 회원 등록. DB 저장까지 끝난 뒤 결과를 반환한다.
   * 저장 실패 시 가입 완료 안내를 띄우지 않기 위해 비동기로 대기한다.
   */
  onRegisterUser: (
    newUser: Omit<UserAccount, 'id'>,
  ) => Promise<{ success: boolean; message?: string }>;
  existingUsers: UserAccount[];
}""", tag='props')

# 1-2) 비밀번호 확인 상태 + 제출 진행 상태
s = rep(s, """  const [regUserId, setRegUserId] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regName, setRegName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regError, setRegError] = useState('');
  const [regSuccessMsg, setRegSuccessMsg] = useState('');""",
        """  const [regUserId, setRegUserId] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regPasswordConfirm, setRegPasswordConfirm] = useState('');
  const [regName, setRegName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regError, setRegError] = useState('');
  const [regSuccessMsg, setRegSuccessMsg] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);""", tag='state')

# 1-3) 제출 핸들러 교체
s = rep(s, """  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setRegError('');
    setRegSuccessMsg('');

    if (!regUserId.trim() || !regPassword.trim() || !regName.trim() || !regPhone.trim()) {
      setRegError('모든 필드를 입력해 주세요.');
      return;
    }

    const res = onRegisterUser({
      userId: regUserId.trim(),
      password: regPassword.trim(),
      name: regName.trim(),
      phone: regPhone.trim(),
      role: 'user', // 관리자 계정은 가입 화면에서 생성할 수 없다 (권한 상승 방지)
      points: 20000,
    });

    if (res.success) {
      setRegSuccessMsg('회원가입이 완료되었습니다! 로그인해 주세요.');
      setTimeout(() => {
        setTab('login');
        setLoginUserId(regUserId);
        setRegUserId('');
        setRegPassword('');
        setRegName('');
        setRegPhone('');
      }, 1200);
    } else {
      setRegError(res.message || '가입에 실패했습니다.');
    }
  };""",
        """  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isRegistering) return; // 다중 제출 차단
    setRegError('');
    setRegSuccessMsg('');

    if (!regUserId.trim() || !regPassword || !regName.trim() || !regPhone.trim()) {
      setRegError('모든 필드를 입력해 주세요.');
      return;
    }

    if (regPassword !== regPasswordConfirm) {
      setRegError('비밀번호가 일치하지 않습니다. 다시 확인해 주세요.');
      return;
    }

    if (!RA_PHONE_IS_VALID(regPhone)) {
      setRegError('휴대폰 번호를 올바르게 입력해 주세요. (예: 010-1234-5678)');
      return;
    }

    setIsRegistering(true);
    try {
      const res = await onRegisterUser({
        userId: regUserId.trim(),
        password: regPassword,
        name: regName.trim(),
        // 저장 형식을 하이픈 포함으로 통일한다. 예약 검증 규칙과 동일한 형태다.
        phone: RA_PHONE_FORMAT(regPhone),
        role: 'user', // 관리자 계정은 가입 화면에서 생성할 수 없다 (권한 상승 방지)
        points: 20000,
      });

      if (!res.success) {
        setRegError(res.message || '가입에 실패했습니다.');
        return;
      }

      setRegSuccessMsg('회원가입이 완료되었습니다! 로그인해 주세요.');
      setTimeout(() => {
        setTab('login');
        setLoginUserId(regUserId);
        setRegUserId('');
        setRegPassword('');
        setRegPasswordConfirm('');
        setRegName('');
        setRegPhone('');
      }, 1200);
    } finally {
      setIsRegistering(false); // 성공/실패 무관 반드시 해제
    }
  };""", tag='submit')

# 1-4) 비밀번호 확인 입력 필드 추가
s = rep(s, """          <div className="form-group">
            <label className="text-xs font-semibold text-[#1c1c1e] flex items-center gap-1">
              <User size={14} className="text-[#b09168]" /> 성함
            </label>""",
        """          <div className="form-group">
            <label className="text-xs font-semibold text-[#1c1c1e] flex items-center gap-1">
              <Lock size={14} className="text-[#b09168]" /> 비밀번호 확인
            </label>
            <input
              type="password"
              value={regPasswordConfirm}
              onChange={(e) => setRegPasswordConfirm(e.target.value)}
              placeholder="비밀번호를 다시 입력하세요"
              className="form-input text-sm w-full"
            />
            {regPasswordConfirm.length > 0 && regPassword !== regPasswordConfirm && (
              <p className="text-[11px] text-[#ff3b30] font-bold pt-1">
                비밀번호가 일치하지 않습니다.
              </p>
            )}
            {regPasswordConfirm.length > 0 && regPassword === regPasswordConfirm && (
              <p className="text-[11px] text-[#34c759] font-bold pt-1">
                비밀번호가 일치합니다.
              </p>
            )}
          </div>

          <div className="form-group">
            <label className="text-xs font-semibold text-[#1c1c1e] flex items-center gap-1">
              <User size={14} className="text-[#b09168]" /> 성함
            </label>""", tag='confirmField')

# 1-5) 휴대폰 입력에 자동 하이픈 적용
s = rep(s, """            <input
              type="tel"
              value={regPhone}
              onChange={(e) => setRegPhone(e.target.value)}
              placeholder="010-1234-5678"
              className="form-input text-sm w-full"
            />""",
        """            <input
              type="tel"
              inputMode="numeric"
              value={regPhone}
              // 숫자만 입력해도 자동으로 하이픈이 붙는다. (01012341234 -> 010-1234-1234)
              onChange={(e) => setRegPhone(RA_PHONE_FORMAT(e.target.value))}
              placeholder="010-1234-5678"
              maxLength={13}
              className="form-input text-sm w-full"
            />""", tag='phoneInput')

# 1-6) 제출 버튼: 진행 중 비활성화
s = rep(s, """            <button type="submit" className="gold-btn w-full py-3.5 text-sm font-bold rounded-xl shadow">
              회원가입 완료
            </button>""",
        """            <button
              type="submit"
              disabled={isRegistering}
              className="gold-btn w-full py-3.5 text-sm font-bold rounded-xl shadow"
            >
              {isRegistering ? '가입 처리 중...' : '회원가입 완료'}
            </button>""", tag='submitButton')

save(P, s)

# =====================================================================
# 2. App.tsx — handleRegisterUser 를 비동기로 (DB 저장 결과를 기다린다)
# =====================================================================
P = 'src/App.tsx'
s = load(P)

s = rep(s, """  // 신규 회원가입 처리
  const handleRegisterUser = (newUser: Omit<UserAccount, 'id'>): { success: boolean; message?: string } => {
    const exists = users.some(u => u.userId === newUser.userId);
    if (exists) {
      return { success: false, message: '이미 존재하는 아이디입니다.' };
    }

    // users.id는 UUID 컬럼이다. DB와 로컬이 같은 id를 갖도록 클라이언트에서 발급한다.
    const createdUser: UserAccount = {
      ...newUser,
      id: crypto.randomUUID(),
    };

    updateUsers([...users, createdUser]);
    persist('회원 등록', () => insertDbUser(createdUser));
    return { success: true };
  };""",
        """  // 신규 회원가입 처리.
  // DB 저장 결과를 기다린 뒤 반환한다. 저장이 실패했는데 화면에 "가입 완료"가
  // 뜨는 모순을 막기 위해 persist() 대신 결과를 직접 확인한다.
  const handleRegisterUser = async (
    newUser: Omit<UserAccount, 'id'>,
  ): Promise<{ success: boolean; message?: string }> => {
    const exists = users.some(u => u.userId === newUser.userId);
    if (exists) {
      return { success: false, message: '이미 존재하는 아이디입니다.' };
    }

    // users.id는 UUID 컬럼이다. DB와 로컬이 같은 id를 갖도록 클라이언트에서 발급한다.
    const createdUser: UserAccount = {
      ...newUser,
      id: crypto.randomUUID(),
    };

    const res = await insertDbUser(createdUser);
    if (!res.ok) {
      return {
        success: false,
        message: '회원 정보를 서버에 저장하지 못했습니다.\\n\\n' + res.error,
      };
    }

    updateUsers([...users, createdUser]);
    return { success: true };
  };""", tag='handleRegisterUser')

save(P, s)
print('회원가입 폼 개선 완료: %d개 블록 교체' % count)
