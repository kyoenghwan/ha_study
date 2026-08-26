import React, { useState } from 'react';
import type { UserAccount } from '../types';
import { Shield, Lock, ArrowRight, X, User } from 'lucide-react';
import logoImg from '../assets/르하임로고.jfif';

interface AdminAuthModalProps {
  /** 현재 로그인한 계정. 이 계정의 자격 증명으로만 관제 콘솔에 진입할 수 있다. */
  adminUser: UserAccount | null;
  /**
   * 관리 콘솔 접근 권한 보유 여부. user_roles(RBAC) 판정 결과를 받는다.
   * 레거시 users.role 을 직접 보지 않는다. 두 값이 어긋나면 권한을 부여받은
   * 계정이 게이트는 통과하고 이 모달에서 막히는 불일치가 생긴다.
   */
  isAuthorized: boolean;
  onSuccess: () => void;
  onCancel: () => void;
}

export const AdminAuthModal: React.FC<AdminAuthModalProps> = ({
  adminUser,
  isAuthorized,
  onSuccess,
  onCancel,
}) => {
  const [adminId, setAdminId] = useState('');
  const [adminPw, setAdminPw] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    // 로그인한 관리자 본인의 자격 증명으로만 통과시킨다.
    // 고정 계정 비교(하드코딩)는 클라이언트 번들에 노출되므로 사용하지 않는다.
    const isOwnAdminCredential =
      adminUser !== null &&
      isAuthorized &&
      adminId.trim() === adminUser.userId &&
      adminPw === adminUser.password;

    if (isOwnAdminCredential) {
      onSuccess();
    } else {
      setErrorMsg('최고 관리자 접속 권한이 없거나 계정 정보가 올바르지 않습니다.');
    }
  };

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div 
        className="modal-content max-w-sm w-full p-6 bg-white rounded-3xl shadow-2xl border border-[#b09168]/30 space-y-5" 
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center pb-3 border-b border-[#e5e5ea]">
          <div className="flex items-center gap-2">
            <Shield size={20} className="text-[#b09168]" />
            <h3 className="text-base font-bold text-[#1c1c1e]">최고 관리자 보안 인증</h3>
          </div>
          <button 
            onClick={onCancel} 
            className="text-[#8e8e93] hover:text-[#1c1c1e] p-1 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="text-center space-y-1.5 py-1">
          <img src={logoImg} alt="르하임 로고" className="mx-auto h-10 w-auto" />
          <p className="text-xs text-[#8e8e93] leading-relaxed">
            관리자 계정 확인 후 전체 통합 대시보드 콘솔로 전환됩니다.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="form-group">
            <label className="text-xs font-semibold text-[#1c1c1e] flex items-center gap-1">
              <User size={14} className="text-[#b09168]" /> 관리자 아이디
            </label>
            <input
              type="text"
              value={adminId}
              onChange={(e) => setAdminId(e.target.value)}
              placeholder="관리자 아이디"
              className="form-input text-sm w-full"
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="text-xs font-semibold text-[#1c1c1e] flex items-center gap-1">
              <Lock size={14} className="text-[#b09168]" /> 비밀번호
            </label>
            <input
              type="password"
              value={adminPw}
              onChange={(e) => setAdminPw(e.target.value)}
              placeholder="비밀번호"
              className="form-input text-sm w-full"
            />
          </div>

          {errorMsg && (
            <p className="text-xs text-[#ff3b30] font-bold bg-[#ff3b30]/10 p-3 rounded-xl text-center">
              {errorMsg}
            </p>
          )}

          <div className="flex gap-2.5 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 py-3 border border-[#e5e5ea] text-xs font-bold rounded-xl text-[#8e8e93] hover:bg-[#f8f9fa] hover:text-[#1c1c1e] transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              className="flex-1 gold-btn py-3 text-xs font-bold rounded-xl shadow flex items-center justify-center gap-1.5"
            >
              <span>인증 후 접속</span>
              <ArrowRight size={15} />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
