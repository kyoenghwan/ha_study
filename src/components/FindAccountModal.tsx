import React, { useState } from 'react';
import type { UserAccount } from '../types';
import { Search, KeyRound, Check, ArrowRight, CheckCircle2, User, Phone, Lock } from 'lucide-react';
import { RA_PHONE_FORMAT } from '../atoms/common/RA_phone';

interface FindAccountModalProps {
  isOpen: boolean;
  initialTab?: 'findId' | 'resetPw';
  existingUsers: UserAccount[];
  onClose: () => void;
  onSelectFoundId: (userId: string) => void;
  onUpdatePassword: (userId: string, newPassword: string) => Promise<{ success: boolean; message?: string }>;
}

export const FindAccountModal: React.FC<FindAccountModalProps> = ({
  isOpen,
  initialTab = 'findId',
  existingUsers,
  onClose,
  onSelectFoundId,
  onUpdatePassword,
}) => {
  const [tab, setTab] = useState<'findId' | 'resetPw'>(initialTab);

  // 1. 아이디 찾기 상태
  const [findName, setFindName] = useState('');
  const [findPhone, setFindPhone] = useState('');
  const [foundUserId, setFoundUserId] = useState<string | null>(null);
  const [findError, setFindError] = useState('');

  // 2. 비밀번호 재설정 상태
  const [step, setStep] = useState<1 | 2>(1);
  const [resetUserId, setResetUserId] = useState('');
  const [resetName, setResetName] = useState('');
  const [resetPhone, setResetPhone] = useState('');
  const [verifiedUser, setVerifiedUser] = useState<UserAccount | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
  const [resetError, setResetError] = useState('');
  const [resetSuccess, setResetSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  // 전화번호 클린 비교 (하이픈 유무 무관)
  const cleanPhone = (p: string) => p.replace(/[^0-9]/g, '');

  // 🔍 아이디 찾기 실행
  const handleFindIdSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFindError('');
    setFoundUserId(null);

    if (!findName.trim() || !findPhone.trim()) {
      setFindError('이름과 휴대폰 번호를 모두 입력해 주세요.');
      return;
    }

    const matched = existingUsers.find(
      (u) =>
        u.name.trim().toLowerCase() === findName.trim().toLowerCase() &&
        cleanPhone(u.phone) === cleanPhone(findPhone)
    );

    if (matched) {
      setFoundUserId(matched.userId);
    } else {
      setFindError('일치하는 회원 정보를 찾을 수 없습니다. 입력하신 정보를 다시 확인해 주세요.');
    }
  };

  // 🔑 비밀번호 재설정 - 1단계 본인 확인
  const handleVerifyUserSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setResetError('');

    if (!resetUserId.trim() || !resetName.trim() || !resetPhone.trim()) {
      setResetError('아이디, 이름, 휴대폰 번호를 모두 입력해 주세요.');
      return;
    }

    const matched = existingUsers.find(
      (u) =>
        u.userId.trim().toLowerCase() === resetUserId.trim().toLowerCase() &&
        u.name.trim().toLowerCase() === resetName.trim().toLowerCase() &&
        cleanPhone(u.phone) === cleanPhone(resetPhone)
    );

    if (matched) {
      setVerifiedUser(matched);
      setStep(2);
    } else {
      setResetError('일치하는 회원 계정이 없습니다. 정보를 올바르게 입력해 주세요.');
    }
  };

  // 🔑 비밀번호 재설정 - 2단계 새 비밀번호 저장
  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifiedUser || isSubmitting) return;
    setResetError('');

    if (!newPassword.trim()) {
      setResetError('새 비밀번호를 입력해 주세요.');
      return;
    }

    if (newPassword !== newPasswordConfirm) {
      setResetError('새 비밀번호가 일치하지 않습니다.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await onUpdatePassword(verifiedUser.userId, newPassword.trim());
      if (res.success) {
        setResetSuccess(true);
      } else {
        setResetError(res.message || '비밀번호 재설정 중 오류가 발생했습니다.');
      }
    } catch {
      setResetError('비밀번호 재설정 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content max-w-sm space-y-4" onClick={(e) => e.stopPropagation()}>
        {/* 상단 헤더 & 닫기 */}
        <div className="flex justify-between items-center pb-2 border-b border-[#e5e8eb]">
          <h3 className="text-base font-bold text-[#191f28] flex items-center gap-1.5">
            {tab === 'findId' ? <Search size={18} className="text-[#a67c48]" /> : <KeyRound size={18} className="text-[#a67c48]" />}
            <span>{tab === 'findId' ? '아이디 찾기' : '비밀번호 재설정'}</span>
          </h3>
          <button onClick={onClose} className="text-[#8b95a1] hover:text-[#191f28] text-2xl">&times;</button>
        </div>

        {/* 탭 전환 버튼 */}
        <div className="grid grid-cols-2 bg-[#f8f9fc] border border-[#e5e8eb] p-1 rounded-xl text-xs font-bold">
          <button
            type="button"
            onClick={() => {
              setTab('findId');
              setFindError('');
              setFoundUserId(null);
            }}
            className={`py-2 rounded-lg transition-all ${
              tab === 'findId'
                ? 'bg-[#ffffff] text-[#a67c48] shadow-sm font-bold'
                : 'text-[#8b95a1] hover:text-[#191f28]'
            }`}
          >
            아이디 찾기
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('resetPw');
              setStep(1);
              setResetError('');
              setResetSuccess(false);
              setNewPassword('');
              setNewPasswordConfirm('');
            }}
            className={`py-2 rounded-lg transition-all ${
              tab === 'resetPw'
                ? 'bg-[#ffffff] text-[#a67c48] shadow-sm font-bold'
                : 'text-[#8b95a1] hover:text-[#191f28]'
            }`}
          >
            비밀번호 재설정
          </button>
        </div>

        {/* ──────────────────────────────────────────────────────── */}
        {/* 1. 아이디 찾기 탭 */}
        {/* ──────────────────────────────────────────────────────── */}
        {tab === 'findId' && (
          <div>
            {!foundUserId ? (
              <form onSubmit={handleFindIdSubmit} className="space-y-3 pt-1">
                <p className="text-xs text-[#8b95a1]">
                  가입 시 등록하신 성함과 휴대폰 번호를 입력해 주세요.
                </p>

                <div className="form-group space-y-1">
                  <label className="text-xs font-semibold text-[#191f28] flex items-center gap-1">
                    <User size={13} className="text-[#a67c48]" /> 성함
                  </label>
                  <input
                    type="text"
                    required
                    value={findName}
                    onChange={(e) => setFindName(e.target.value)}
                    placeholder="예: 홍길동"
                    className="form-input text-xs py-2.5 px-3 rounded-xl w-full border border-[#e5e8eb] focus:border-[#a67c48] outline-none"
                  />
                </div>

                <div className="form-group space-y-1">
                  <label className="text-xs font-semibold text-[#191f28] flex items-center gap-1">
                    <Phone size={13} className="text-[#a67c48]" /> 휴대폰 번호
                  </label>
                  <input
                    type="tel"
                    inputMode="numeric"
                    required
                    value={findPhone}
                    onChange={(e) => setFindPhone(RA_PHONE_FORMAT(e.target.value))}
                    placeholder="010-1234-5678"
                    maxLength={13}
                    className="form-input text-xs py-2.5 px-3 rounded-xl w-full border border-[#e5e8eb] focus:border-[#a67c48] outline-none"
                  />
                </div>

                {findError && (
                  <div className="text-xs text-[#e93d3d] bg-[#e93d3d]/10 p-3 rounded-xl font-bold">
                    {findError}
                  </div>
                )}

                <button
                  type="submit"
                  className="gold-btn w-full py-3.5 text-xs font-bold rounded-xl shadow mt-2"
                >
                  아이디 찾기
                </button>
              </form>
            ) : (
              /* 찾기 완료 화면 */
              <div className="space-y-4 pt-2 text-center">
                <div className="w-12 h-12 rounded-full bg-[#28a745]/10 text-[#28a745] flex items-center justify-center mx-auto">
                  <CheckCircle2 size={26} />
                </div>
                
                <div className="bg-[#f8f9fc] border border-[#a67c48]/30 rounded-2xl p-4 space-y-1.5">
                  <p className="text-xs text-[#4e5968]">{findName} 회원님의 아이디</p>
                  <p className="text-lg font-extrabold text-[#a67c48] font-mono tracking-wider">{foundUserId}</p>
                </div>

                <button
                  onClick={() => {
                    onSelectFoundId(foundUserId);
                    onClose();
                  }}
                  className="gold-btn w-full py-3.5 text-xs font-bold rounded-xl shadow flex items-center justify-center gap-1.5"
                >
                  <span>이 아이디로 로그인하기</span>
                  <ArrowRight size={15} />
                </button>
              </div>
            )}
          </div>
        )}

        {/* ──────────────────────────────────────────────────────── */}
        {/* 2. 비밀번호 재설정 탭 */}
        {/* ──────────────────────────────────────────────────────── */}
        {tab === 'resetPw' && (
          <div>
            {resetSuccess ? (
              /* 재설정 완료 화면 */
              <div className="space-y-4 pt-2 text-center">
                <div className="w-12 h-12 rounded-full bg-[#28a745]/10 text-[#28a745] flex items-center justify-center mx-auto">
                  <CheckCircle2 size={26} />
                </div>
                
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-[#191f28]">비밀번호가 성공적으로 변경되었습니다!</h4>
                  <p className="text-xs text-[#8b95a1]">새로운 비밀번호로 로그인해 주세요.</p>
                </div>

                <button
                  onClick={() => {
                    if (verifiedUser) onSelectFoundId(verifiedUser.userId);
                    onClose();
                  }}
                  className="gold-btn w-full py-3.5 text-xs font-bold rounded-xl shadow"
                >
                  로그인하러 가기
                </button>
              </div>
            ) : step === 1 ? (
              /* 1단계: 본인 인증 */
              <form onSubmit={handleVerifyUserSubmit} className="space-y-3 pt-1">
                <p className="text-xs text-[#8b95a1]">
                  비밀번호를 재설정할 계정의 정보를 입력해 주세요.
                </p>

                <div className="form-group space-y-1">
                  <label className="text-xs font-semibold text-[#191f28] flex items-center gap-1">
                    <User size={13} className="text-[#a67c48]" /> 아이디
                  </label>
                  <input
                    type="text"
                    required
                    value={resetUserId}
                    onChange={(e) => setResetUserId(e.target.value)}
                    placeholder="아이디 입력"
                    className="form-input text-xs py-2.5 px-3 rounded-xl w-full border border-[#e5e8eb] focus:border-[#a67c48] outline-none"
                  />
                </div>

                <div className="form-group space-y-1">
                  <label className="text-xs font-semibold text-[#191f28] flex items-center gap-1">
                    <User size={13} className="text-[#a67c48]" /> 성함
                  </label>
                  <input
                    type="text"
                    required
                    value={resetName}
                    onChange={(e) => setResetName(e.target.value)}
                    placeholder="예: 홍길동"
                    className="form-input text-xs py-2.5 px-3 rounded-xl w-full border border-[#e5e8eb] focus:border-[#a67c48] outline-none"
                  />
                </div>

                <div className="form-group space-y-1">
                  <label className="text-xs font-semibold text-[#191f28] flex items-center gap-1">
                    <Phone size={13} className="text-[#a67c48]" /> 휴대폰 번호
                  </label>
                  <input
                    type="tel"
                    inputMode="numeric"
                    required
                    value={resetPhone}
                    onChange={(e) => setResetPhone(RA_PHONE_FORMAT(e.target.value))}
                    placeholder="010-1234-5678"
                    maxLength={13}
                    className="form-input text-xs py-2.5 px-3 rounded-xl w-full border border-[#e5e8eb] focus:border-[#a67c48] outline-none"
                  />
                </div>

                {resetError && (
                  <div className="text-xs text-[#e93d3d] bg-[#e93d3d]/10 p-3 rounded-xl font-bold">
                    {resetError}
                  </div>
                )}

                <button
                  type="submit"
                  className="gold-btn w-full py-3.5 text-xs font-bold rounded-xl shadow mt-2"
                >
                  본인 확인 및 다음 단계
                </button>
              </form>
            ) : (
              /* 2단계: 새 비밀번호 입력 */
              <form onSubmit={handleResetPasswordSubmit} className="space-y-3 pt-1">
                <div className="bg-[#f8f9fc] p-3 rounded-xl border border-[#e5e8eb] text-xs text-[#4e5968] flex justify-between items-center">
                  <span>대상 계정: <strong>{verifiedUser?.name} ({verifiedUser?.userId})</strong></span>
                  <span className="text-[11px] font-bold text-[#28a745]">본인인증 완료 ✓</span>
                </div>

                <div className="form-group space-y-1">
                  <label className="text-xs font-semibold text-[#191f28] flex items-center gap-1">
                    <Lock size={13} className="text-[#a67c48]" /> 새로운 비밀번호
                  </label>
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="새로운 비밀번호 입력"
                    className="form-input text-xs py-2.5 px-3 rounded-xl w-full border border-[#e5e8eb] focus:border-[#a67c48] outline-none"
                  />
                </div>

                <div className="form-group space-y-1">
                  <label className="text-xs font-semibold text-[#191f28] flex items-center gap-1">
                    <Lock size={13} className="text-[#a67c48]" /> 새로운 비밀번호 확인
                  </label>
                  <input
                    type="password"
                    required
                    value={newPasswordConfirm}
                    onChange={(e) => setNewPasswordConfirm(e.target.value)}
                    placeholder="비밀번호 다시 입력"
                    className="form-input text-xs py-2.5 px-3 rounded-xl w-full border border-[#e5e8eb] focus:border-[#a67c48] outline-none"
                  />
                  {newPasswordConfirm.length > 0 && newPassword !== newPasswordConfirm && (
                    <p className="text-[11px] text-[#e93d3d] font-bold pt-0.5">비밀번호가 일치하지 않습니다.</p>
                  )}
                  {newPasswordConfirm.length > 0 && newPassword === newPasswordConfirm && (
                    <p className="text-[11px] text-[#28a745] font-bold pt-0.5">비밀번호가 일치합니다 ✓</p>
                  )}
                </div>

                {resetError && (
                  <div className="text-xs text-[#e93d3d] bg-[#e93d3d]/10 p-3 rounded-xl font-bold">
                    {resetError}
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="gold-btn-outline flex-1 py-3 text-xs font-bold rounded-xl"
                  >
                    이전으로
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="gold-btn flex-1 py-3 text-xs font-bold rounded-xl shadow flex items-center justify-center gap-1"
                  >
                    <Check size={14} /> {isSubmitting ? '변경 중...' : '비밀번호 변경 완료'}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
