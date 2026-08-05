import React, { useState } from 'react';
import type { UserAccount, Role } from '../types';
import { User, Shield, LogIn, UserPlus, Phone, Lock, Sparkles, CheckCircle2 } from 'lucide-react';
import logoImg from '../assets/르하임로고.jfif';

interface AuthModalProps {
  onLoginSuccess: (user: UserAccount) => void;
  onRegisterUser: (newUser: Omit<UserAccount, 'id'>) => { success: boolean; message?: string };
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
  const [regName, setRegName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regRole, setRegRole] = useState<Role>('user');
  const [regError, setRegError] = useState('');
  const [regSuccessMsg, setRegSuccessMsg] = useState('');

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    if (!loginUserId.trim() || !loginPassword.trim()) {
      setLoginError('아이디와 비밀번호를 모두 입력해 주세요.');
      return;
    }

    const found = existingUsers.find(
      (u) => u.userId === loginUserId.trim() && (u.password === loginPassword || u.password === '123')
    );

    if (found) {
      onLoginSuccess(found);
    } else {
      setLoginError('아이디 또는 비밀번호가 일치하지 않습니다.');
    }
  };

  const handleRegisterSubmit = (e: React.FormEvent) => {
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
      role: regRole,
      points: regRole === 'user' ? 20000 : 999000,
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
  };

  return (
    <div className="w-full max-w-sm mx-auto p-2 space-y-6">
      {/* 르하임 브랜드 로고 & 타이틀 */}
      <div className="text-center space-y-2">
        <img
          src={logoImg}
          alt="르하임 로고"
          className="mx-auto"
          style={{ width: '160px', height: 'auto' }}
        />
        <h2 className="text-lg font-extrabold text-[#1c1c1e] tracking-wide pt-1">
          스터디카페 여의도점
        </h2>
        <p className="text-xs text-[#8e8e93]">
          로그인 후 공부방 예약 및 시스템을 이용하세요.
        </p>
      </div>

      {/* 탭 메뉴 (로그인 / 회원가입) */}
      <div className="flex border-b border-[#e5e5ea]">
        <button
          onClick={() => {
            setTab('login');
            setLoginError('');
          }}
          className={`flex-1 py-3 text-xs font-bold transition-all flex items-center justify-center gap-1.5 relative ${
            tab === 'login'
              ? 'text-[#b09168] border-b-2 border-[#b09168]'
              : 'text-[#8e8e93] hover:text-[#1c1c1e]'
          }`}
        >
          <LogIn size={15} /> 로그인
        </button>
        <button
          onClick={() => {
            setTab('register');
            setRegError('');
          }}
          className={`flex-1 py-3 text-xs font-bold transition-all flex items-center justify-center gap-1.5 relative ${
            tab === 'register'
              ? 'text-[#b09168] border-b-2 border-[#b09168]'
              : 'text-[#8e8e93] hover:text-[#1c1c1e]'
          }`}
        >
          <UserPlus size={15} /> 회원가입
        </button>
      </div>

      {/* 1. 로그인 폼 (왼쪽 라벨 - 오른쪽 입력필드 수평 레이아웃) */}
      {tab === 'login' && (
        <form onSubmit={handleLoginSubmit} className="space-y-4 pt-2">
          <div className="space-y-3">
            {/* 아이디 Row */}
            <div className="flex items-center gap-2">
              <label className="w-16 shrink-0 text-xs font-bold text-[#1c1c1e] text-right pr-1">
                아이디
              </label>
              <div className="flex-1 relative">
                <User size={15} className="absolute left-3 top-3 text-[#8e8e93]" />
                <input
                  type="text"
                  value={loginUserId}
                  onChange={(e) => setLoginUserId(e.target.value)}
                  placeholder="아이디 입력 (user1 / admin)"
                  className="form-input text-xs w-full pl-9 py-2.5"
                />
              </div>
            </div>

            {/* 비밀번호 Row */}
            <div className="flex items-center gap-2">
              <label className="w-16 shrink-0 text-xs font-bold text-[#1c1c1e] text-right pr-1">
                비밀번호
              </label>
              <div className="flex-1 relative">
                <Lock size={15} className="absolute left-3 top-3 text-[#8e8e93]" />
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="비밀번호 입력 (테스트: 123)"
                  className="form-input text-xs w-full pl-9 py-2.5"
                />
              </div>
            </div>
          </div>

          {loginError && (
            <p className="text-xs text-[#ff3b30] font-bold bg-[#ff3b30]/10 p-2.5 rounded-xl text-center">
              {loginError}
            </p>
          )}

          <button type="submit" className="gold-btn w-full py-3 text-xs font-bold rounded-xl shadow mt-2">
            로그인하기
          </button>

          {/* 테스트 빠른 접속 가이드 */}
          <div className="bg-[#f8f9fa] p-3 rounded-2xl border border-[#e5e5ea] text-[11px] text-[#8e8e93] space-y-1 mt-4">
            <p className="font-bold text-[#b09168] flex items-center gap-1">
              <Sparkles size={12} /> 빠른 테스트 계정
            </p>
            <div className="flex justify-between items-center text-[10px] pt-0.5">
              <span>이용자: <strong>user1</strong> (비밀번호: 123)</span>
              <button
                type="button"
                onClick={() => {
                  setLoginUserId('user1');
                  setLoginPassword('123');
                }}
                className="text-[#b09168] font-bold underline"
              >
                입력
              </button>
            </div>
            <div className="flex justify-between items-center text-[10px]">
              <span>관리자: <strong>admin</strong> (비밀번호: 123)</span>
              <button
                type="button"
                onClick={() => {
                  setLoginUserId('admin');
                  setLoginPassword('123');
                }}
                className="text-[#b09168] font-bold underline"
              >
                입력
              </button>
            </div>
          </div>
        </form>
      )}

      {/* 2. 회원가입 폼 (수평 레이아웃) */}
      {tab === 'register' && (
        <form onSubmit={handleRegisterSubmit} className="space-y-3 pt-2">
          {/* 가입 유형 선택 Row */}
          <div className="flex items-center gap-2">
            <label className="w-16 shrink-0 text-xs font-bold text-[#1c1c1e] text-right pr-1">
              가입 유형
            </label>
            <div className="flex-1 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setRegRole('user')}
                className={`py-2 px-2 rounded-xl border text-[11px] font-bold flex items-center justify-center gap-1 ${
                  regRole === 'user'
                    ? 'border-[#b09168] bg-[#b09168]/10 text-[#b09168]'
                    : 'border-[#e5e5ea] text-[#8e8e93]'
                }`}
              >
                <User size={13} /> 일반 이용자
              </button>
              <button
                type="button"
                onClick={() => setRegRole('admin')}
                className={`py-2 px-2 rounded-xl border text-[11px] font-bold flex items-center justify-center gap-1 ${
                  regRole === 'admin'
                    ? 'border-[#b09168] bg-[#b09168]/10 text-[#b09168]'
                    : 'border-[#e5e5ea] text-[#8e8e93]'
                }`}
              >
                <Shield size={13} /> 지점 관리자
              </button>
            </div>
          </div>

          {/* 아이디 Row */}
          <div className="flex items-center gap-2">
            <label className="w-16 shrink-0 text-xs font-bold text-[#1c1c1e] text-right pr-1">
              아이디
            </label>
            <input
              type="text"
              value={regUserId}
              onChange={(e) => setRegUserId(e.target.value)}
              placeholder="아이디 입력"
              className="form-input text-xs flex-1 py-2"
            />
          </div>

          {/* 비밀번호 Row */}
          <div className="flex items-center gap-2">
            <label className="w-16 shrink-0 text-xs font-bold text-[#1c1c1e] text-right pr-1">
              비밀번호
            </label>
            <input
              type="password"
              value={regPassword}
              onChange={(e) => setRegPassword(e.target.value)}
              placeholder="비밀번호 입력"
              className="form-input text-xs flex-1 py-2"
            />
          </div>

          {/* 이름 Row */}
          <div className="flex items-center gap-2">
            <label className="w-16 shrink-0 text-xs font-bold text-[#1c1c1e] text-right pr-1">
              이름
            </label>
            <input
              type="text"
              value={regName}
              onChange={(e) => setRegName(e.target.value)}
              placeholder="예: 홍길동"
              className="form-input text-xs flex-1 py-2"
            />
          </div>

          {/* 휴대폰 번호 Row */}
          <div className="flex items-center gap-2">
            <label className="w-16 shrink-0 text-xs font-bold text-[#1c1c1e] text-right pr-1">
              연락처
            </label>
            <div className="flex-1 relative">
              <Phone size={14} className="absolute left-3 top-2.5 text-[#8e8e93]" />
              <input
                type="text"
                value={regPhone}
                onChange={(e) => setRegPhone(e.target.value)}
                placeholder="예: 010-1234-5678"
                className="form-input text-xs w-full pl-8 py-2"
              />
            </div>
          </div>

          {regError && (
            <p className="text-xs text-[#ff3b30] font-bold bg-[#ff3b30]/10 p-2.5 rounded-xl text-center">
              {regError}
            </p>
          )}

          {regSuccessMsg && (
            <p className="text-xs text-[#34c759] font-bold bg-[#34c759]/10 p-2.5 rounded-xl text-center flex items-center justify-center gap-1">
              <CheckCircle2 size={15} /> {regSuccessMsg}
            </p>
          )}

          <button type="submit" className="gold-btn w-full py-3 text-xs font-bold rounded-xl shadow mt-2">
            회원가입 완료
          </button>
        </form>
      )}
    </div>
  );
};
