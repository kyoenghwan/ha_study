import React from 'react';
import type { Branch, UserAccount } from '../types';
import { Coins, ChevronRight, ArrowLeftRight, Sparkles, Building, Check } from 'lucide-react';

interface BranchPointsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserAccount | null;
  branches: Branch[];
  selectedBranchId: string;
  onSelectBranch: (branchId: string) => void;
  getBranchPoints: (user: UserAccount | null, branchId: string) => number;
  onOpenChargeModal: () => void;
  onOpenTransferModal: () => void;
}

export const BranchPointsModal: React.FC<BranchPointsModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  branches,
  selectedBranchId,
  onSelectBranch,
  getBranchPoints,
  onOpenChargeModal,
  onOpenTransferModal,
}) => {
  if (!isOpen) return null;

  const currentBranch = branches.find((b) => b.id === selectedBranchId) || branches[0];
  const currentPts = getBranchPoints(currentUser, selectedBranchId);

  // 전체 지점 포인트 합산
  const totalAllPoints = branches.reduce((sum, b) => sum + getBranchPoints(currentUser, b.id), 0);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className="modal-content max-w-md space-y-4 text-xs" 
        onClick={(e) => e.stopPropagation()}
      >
        {/* 모달 헤더 */}
        <div className="flex justify-between items-center pb-2.5 border-b border-[#e5e8eb]">
          <div className="flex items-center gap-1.5">
            <Coins size={18} className="text-[#a67c48]" />
            <h3 className="text-base font-bold text-[#191f28]">내 지점별 포인트 현황 & 관리</h3>
          </div>
          <button 
            onClick={onClose}
            className="text-[#8b95a1] hover:text-[#191f28] text-2xl font-normal leading-none"
          >
            &times;
          </button>
        </div>

        {/* 🌟 현재 접속 중인 지점 포인트 강조 카드 */}
        <div 
          className="rounded-2xl p-4 shadow-sm border border-[#8a6230] space-y-3"
          style={{
            background: 'linear-gradient(135deg, #a67c48 0%, #8a6230 100%)',
            color: '#ffffff',
          }}
        >
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#fde047]">
                <Sparkles size={13} />
                <span>현재 선택된 지점</span>
              </div>
              <h4 className="text-base font-extrabold text-white pt-0.5">
                {currentBranch?.fullName || currentBranch?.name}
              </h4>
            </div>
            <span className="text-[10px] font-bold bg-white/20 text-white px-2 py-0.5 rounded-full backdrop-blur-xs">
              이용 중
            </span>
          </div>

          <div className="flex justify-between items-end pt-1">
            <div>
              <span className="text-[11px] text-[#f8fafc] font-medium">사용 가능 보유 포인트</span>
              <p className="text-2xl font-black text-white">{currentPts.toLocaleString()} P</p>
            </div>

            {/* 빠른 액션 버튼 */}
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenTransferModal();
                }}
                className="bg-white/20 hover:bg-white/30 text-white border border-white/40 py-1.5 px-2.5 rounded-xl font-bold text-[11px] flex items-center gap-1 transition-all"
                title="타 지점으로 포인트 이전 신청"
              >
                <ArrowLeftRight size={12} /> 이전
              </button>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenChargeModal();
                }}
                className="bg-white text-[#8a6230] hover:bg-[#fdf9f4] py-1.5 px-3 rounded-xl font-black text-xs shadow flex items-center gap-1 transition-all cursor-pointer"
              >
                + 충전하기
              </button>
            </div>
          </div>
        </div>

        {/* 🏢 전체 지점별 포인트 잔액 목록 */}
        <div className="space-y-2 pt-1">
          <div className="flex justify-between items-center">
            <span className="font-bold text-[#191f28] flex items-center gap-1">
              <Building size={14} className="text-[#a67c48]" /> 지점별 보유 포인트 목록
            </span>
            <span className="text-[11px] text-[#8b95a1]">
              총 보유: <strong className="text-[#191f28] font-bold">{totalAllPoints.toLocaleString()} P</strong>
            </span>
          </div>

          <div className="space-y-2 max-h-60 overflow-y-auto pr-0.5">
            {branches.map((branch) => {
              const pts = getBranchPoints(currentUser, branch.id);
              const isSelected = branch.id === selectedBranchId;

              return (
                <div
                  key={branch.id}
                  onClick={() => {
                    if (!isSelected) {
                      onSelectBranch(branch.id);
                      onClose();
                    }
                  }}
                  className={`p-3 rounded-xl border transition-all flex justify-between items-center cursor-pointer ${
                    isSelected
                      ? 'bg-[#fcf8f2] border-[#a67c48] shadow-xs ring-1 ring-[#a67c48]/30'
                      : 'bg-[#f8f9fc] hover:bg-[#ffffff] border-[#e5e8eb] hover:border-[#a67c48]/40'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ${
                      isSelected ? 'bg-[#a67c48] text-white' : 'bg-[#e5e8eb] text-[#8b95a1]'
                    }`}>
                      {branch.name.slice(0, 1)}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <strong className="text-[#191f28] font-bold text-xs">{branch.name}</strong>
                        {isSelected && (
                          <span className="text-[9px] font-extrabold bg-[#a67c48]/15 text-[#a67c48] px-1.5 py-0.2 rounded-md flex items-center gap-0.5">
                            <Check size={10} /> 현재 지점
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-[#8b95a1]">{branch.address || '스터디룸 공간'}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-sm text-[#191f28]">
                      {pts.toLocaleString()} P
                    </span>
                    {!isSelected && (
                      <span className="text-[10px] text-[#a67c48] font-bold bg-[#a67c48]/10 px-2 py-1 rounded-lg flex items-center gap-0.5">
                        선택 <ChevronRight size={11} />
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 💡 지점 독립 포인트 안내 */}
        <div className="bg-[#f8f9fc] p-3 rounded-xl border border-[#e5e8eb] text-[11px] text-[#4e5968] space-y-1">
          <p className="font-bold text-[#191f28] flex items-center gap-1">
            💡 지점별 포인트 독립 관리 안내
          </p>
          <p className="leading-relaxed">
            르하임 스터디카페 포인트는 각 지점(사업자)별로 독립 관리됩니다. 다른 지점을 이용하실 때는 상단의 <b>[타 지점 이전]</b> 기능을 통해 원하는 지점으로 자유롭게 포인트를 이전하실 수 있습니다.
          </p>
        </div>

        {/* 하단 닫기 */}
        <button
          type="button"
          onClick={onClose}
          className="gold-btn w-full py-3 text-xs font-bold rounded-xl shadow cursor-pointer"
        >
          확인 완료
        </button>
      </div>
    </div>
  );
};
