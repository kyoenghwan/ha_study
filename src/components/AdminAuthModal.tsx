import React, { useState } from 'react';
import { Shield, Lock, ArrowRight, X } from 'lucide-react';
import logoImg from '../assets/르하임로고.jfif';

interface AdminAuthModalProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export const AdminAuthModal: React.FC<AdminAuthModalProps> = ({
  onSuccess,
  onCancel,
}) => {
  const [adminId, setAdminId] = useState('');
  const [adminPw, setAdminPw] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    // 최고 관리자 인증 검증 (기본: admin / 123)
    if (adminId.trim() === 'admin' && adminPw === '123') {
      onSuccess();
    } else {
      setErrorMsg('최고 관리자 접속 권한이 없거나 계정 정보가 올바르지 않습니다.');
    }
  };

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content max-w-sm w-full p-6 bg-white rounded-3xl shadow-2xl border-2 border-[#b09168]/40 space-y-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center pb-2 border-b border-[#e5e5ea]">
          <div className="flex items-center gap-2">
            <Shield size={20} className="text-[#b09168]" />
            <h3 className="text-sm font-extrabold text-[#1c1c1e]">최고 관리자 보안 인증</h3>
          </div>
          <button onClick={onCancel} className="text-[#8e8e93] hover:text-[#1c1c1e] text-lg font-bold">
            <X size={18} />
          </button>
        </div>

        <div className="text-center space-y-1">
          <img src={logoImg} alt="르하임 로고" className="mx-auto h-9 w-auto" />
          <p className="text-xs text-[#8e8e93] pt-1">
            최고 관리자 계정 아이디와 비밀번호를 입력하면 전체 통합 제어 화면으로 전환됩니다.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div className="flex items-center gap-2">
            <label className="w-16 shrink-0 text-xs font-bold text-[#1c1c1e] text-right pr-1">아이디</label>
            <input
              type="text"
              value={adminId}
              onChange={(e) => setAdminId(e.target.value)}
              placeholder="관리자 ID (테스트: admin)"
              className="form-input text-xs flex-1 py-2"
              autoFocus
            />
          </div>

          <div className="flex items-center gap-2">
            <label className="w-16 shrink-0 text-xs font-bold text-[#1c1c1e] text-right pr-1">비밀번호</label>
            <div className="flex-1 relative">
              <Lock size={14} className="absolute left-3 top-2.5 text-[#8e8e93]" />
              <input
                type="password"
                value={adminPw}
                onChange={(e) => setAdminPw(e.target.value)}
                placeholder="비밀번호 (테스트: 123)"
                className="form-input text-xs w-full pl-8 py-2"
              />
            </div>
          </div>

          {errorMsg && (
            <p className="text-xs text-[#ff3b30] font-bold bg-[#ff3b30]/10 p-2.5 rounded-xl text-center">
              {errorMsg}
            </p>
          )}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 py-2.5 border border-[#e5e5ea] text-xs font-bold rounded-xl text-[#8e8e93] hover:bg-[#f8f9fa]"
            >
              취소
            </button>
            <button
              type="submit"
              className="flex-1 gold-btn py-2.5 text-xs font-bold rounded-xl shadow flex items-center justify-center gap-1"
            >
              <span>인증 승인 접속</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
