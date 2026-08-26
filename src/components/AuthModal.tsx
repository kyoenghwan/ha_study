import React, { useState } from 'react';
import type { UserAccount } from '../types';
import { User, LogIn, UserPlus, Phone, Lock, Sparkles, CheckCircle2 } from 'lucide-react';
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
}

export const AuthModal: React.FC<AuthModalProps> = ({
  onLoginSuccess,
  onRegisterUser,
  existingUsers,
}) => {
  const [tab, setTab] = useState<'login' | 'register'>('login');
  
  // 로그인 폼
  const [loginUserId, setLoginUserId] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  // 회원가입 폼
  const [regUserId, setRegUserId] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regPasswordConfirm, setRegPasswordConfirm] = useState('');
  const [regName, setRegName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regError, setRegError] = useState('');
  const [regSuccessMsg, setRegSuccessMsg] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    if (!loginUserId.trim() || !loginPassword.trim()) {
      setLoginError('아이디와 비밀번호를 모두 입력해 주세요.');
      return;
    }

    const found = existingUsers.find(
      (u) => u.userId === loginUserId.trim() && u.password === loginPassword
    );

    if (found) {
      onLoginSuccess(found);
    } else {
      setLoginError('아이디 또는 비밀번호가 일치하지 않습니다.');
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
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
  };

  return (
    <div className="w-full max-w-sm mx-auto px-4 py-4 space-y-6">
      {/* 르하임 브랜드 로고 & 타이틀 */}
      <div className="text-center space-y-2">
        <img
          src={logoImg}
          alt="르하임 로고"
          className="mx-auto"
          style={{ width: '150px', height: 'auto' }}
        />
        <h2 className="text-lg font-bold text-[#1c1c1e] tracking-tight pt-1">
          르하임 스터디카페 통합 플랫폼
        </h2>
        <p className="text-xs text-[#8e8e93]">
          로그인 후 지점별 공부방 예약 및 시스템을 이용하세요.
        </p>
      </div>

      {/* 탭 메뉴 (로그인 / 회원가입) */}
      <div className="flex border-b border-[#e5e5ea] pb-0.5">
        <button
          onClick={() => {
            setTab('login');
            setLoginError('');
          }}
          className={`flex-1 py-3 text-sm font-bold transition-all flex items-center justify-center gap-1.5 ${
            tab === 'login'
              ? 'text-[#b09168] border-b-2 border-[#b09168]'
              : 'text-[#8e8e93] hover:text-[#1c1c1e]'
          }`}
        >
          <LogIn size={16} /> 로그인
        </button>
        <button
          onClick={() => {
            setTab('register');
            setRegError('');
          }}
          className={`flex-1 py-3 text-sm font-bold transition-all flex items-center justify-center gap-1.5 ${
            tab === 'register'
              ? 'text-[#b09168] border-b-2 border-[#b09168]'
              : 'text-[#8e8e93] hover:text-[#1c1c1e]'
          }`}
        >
          <UserPlus size={16} /> 회원가입
        </button>
      </div>

      {/* 1. 로그인 폼 */}
      {tab === 'login' && (
        <form onSubmit={handleLoginSubmit} className="space-y-4 pt-1">
          <div className="space-y-3.5">
            <div className="form-group">
              <label className="text-xs font-semibold text-[#1c1c1e] flex items-center gap-1">
                <User size={14} className="text-[#b09168]" /> 아이디
              </label>
              <input
                type="text"
                value={loginUserId}
                onChange={(e) => setLoginUserId(e.target.value)}
                placeholder="아이디를 입력하세요 (예: user1 / admin)"
                className="form-input text-sm w-full"
              />
            </div>

            <div className="form-group">
              <label className="text-xs font-semibold text-[#1c1c1e] flex items-center gap-1">
                <Lock size={14} className="text-[#b09168]" /> 비밀번호
              </label>
              <input
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="비밀번호를 입력하세요 (예: 123)"
                className="form-input text-sm w-full"
              />
            </div>
          </div>

          {loginError && (
            <p className="text-xs text-[#ff3b30] font-bold bg-[#ff3b30]/10 p-3 rounded-xl text-center">
              {loginError}
            </p>
          )}

          <div className="pt-2">
            <button type="submit" className="gold-btn w-full py-3.5 text-sm font-bold rounded-xl shadow">
              로그인하기
            </button>
          </div>

          {/* 테스트 빠른 접속 가이드 */}
          <div className="bg-[#f8f9fa] p-3.5 rounded-xl border border-[#e5e5ea] text-xs text-[#8e8e93] space-y-2 mt-4">
            <p className="font-bold text-[#b09168] flex items-center gap-1 text-xs">
              <Sparkles size={13} /> 빠른 테스트 계정
            </p>
            <div className="flex justify-between items-center pt-1 border-t border-[#e5e5ea]/80">
              <span>일반회원: <strong className="text-[#1c1c1e]">user1</strong> (비번: 123)</span>
              <button
                type="button"
                onClick={() => {
                  setLoginUserId('user1');
                  setLoginPassword('123');
                }}
                className="text-[#b09168] font-bold hover:underline px-2 py-0.5 rounded bg-[#b09168]/10"
              >
                자동 입력
              </button>
            </div>
            <div className="flex justify-between items-center">
              <span>관리자: <strong className="text-[#1c1c1e]">admin</strong> (비번: 123)</span>
              <button
                type="button"
                onClick={() => {
                  setLoginUserId('admin');
                  setLoginPassword('123');
                }}
                className="text-[#b09168] font-bold hover:underline px-2 py-0.5 rounded bg-[#b09168]/10"
              >
                자동 입력
              </button>
            </div>
          </div>
        </form>
      )}

      {/* 2. 회원가입 폼 */}
      {tab === 'register' && (
        <form onSubmit={handleRegisterSubmit} className="space-y-3.5 pt-1">
          <div className="form-group">
            <label className="text-xs font-semibold text-[#1c1c1e] flex items-center gap-1">
              <User size={14} className="text-[#b09168]" /> 아이디
            </label>
            <input
              type="text"
              value={regUserId}
              onChange={(e) => setRegUserId(e.target.value)}
              placeholder="사용할 아이디를 입력하세요"
              className="form-input text-sm w-full"
            />
          </div>

          <div className="form-group">
            <label className="text-xs font-semibold text-[#1c1c1e] flex items-center gap-1">
              <Lock size={14} className="text-[#b09168]" /> 비밀번호
            </label>
            <input
              type="password"
              value={regPassword}
              onChange={(e) => setRegPassword(e.target.value)}
              placeholder="비밀번호를 입력하세요"
              className="form-input text-sm w-full"
            />
          </div>

          <div className="form-group">
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
            </label>
            <input
              type="text"
              value={regName}
              onChange={(e) => setRegName(e.target.value)}
              placeholder="예: 홍길동"
              className="form-input text-sm w-full"
            />
          </div>

          <div className="form-group">
            <label className="text-xs font-semibold text-[#1c1c1e] flex items-center gap-1">
              <Phone size={14} className="text-[#b09168]" /> 휴대폰 번호
            </label>
            <input
              type="tel"
              inputMode="numeric"
              value={regPhone}
              // 숫자만 입력해도 자동으로 하이픈이 붙는다. (01012341234 -> 010-1234-1234)
              onChange={(e) => setRegPhone(RA_PHONE_FORMAT(e.target.value))}
              placeholder="010-1234-5678"
              maxLength={13}
              className="form-input text-sm w-full"
            />
          </div>

          {regError && (
            <p className="text-xs text-[#ff3b30] font-bold bg-[#ff3b30]/10 p-3 rounded-xl text-center">
              {regError}
            </p>
          )}

          {regSuccessMsg && (
            <p className="text-xs text-[#34c759] font-bold bg-[#34c759]/10 p-3 rounded-xl text-center flex items-center justify-center gap-1">
              <CheckCircle2 size={16} /> {regSuccessMsg}
            </p>
          )}

          <div className="pt-2">
            <button
              type="submit"
              disabled={isRegistering}
              className="gold-btn w-full py-3.5 text-sm font-bold rounded-xl shadow"
            >
              {isRegistering ? '가입 처리 중...' : '회원가입 완료'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
