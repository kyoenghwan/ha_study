import React, { useState, useEffect } from 'react';
import type { Branch } from '../App';
import { Search, MapPin, Check, X, Building2 } from 'lucide-react';

interface BranchSelectModalProps {
  isOpen: boolean;
  branches: Branch[];
  selectedBranchId: string;
  onSelectBranch: (branchId: string) => void;
  onClose: () => void;
}

export const BranchSelectModal: React.FC<BranchSelectModalProps> = ({
  isOpen,
  branches,
  selectedBranchId,
  onSelectBranch,
  onClose,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedId, setSelectedId] = useState<string>(selectedBranchId);

  useEffect(() => {
    if (isOpen) {
      setSelectedId(selectedBranchId);
      setSearchTerm('');
    }
  }, [isOpen, selectedBranchId]);

  if (!isOpen) return null;

  // 검색어 필터링
  const filteredBranches = branches.filter((branch) => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return true;
    return (
      branch.name.toLowerCase().includes(term) ||
      branch.fullName.toLowerCase().includes(term) ||
      branch.address.toLowerCase().includes(term)
    );
  });

  const handleCardClick = (branchId: string) => {
    setSelectedId(branchId);
  };

  const handleConfirm = () => {
    onSelectBranch(selectedId);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className="modal-content max-w-md w-full p-5 space-y-4 max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 모달 헤더 */}
        <div className="flex justify-between items-center pb-3 border-b border-[#e5e8eb] shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#a67c48]/10 text-[#a67c48] flex items-center justify-center">
              <Building2 size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#191f28]">이용 지점 선택</h3>
              <p className="text-xs text-[#8b95a1]">방문하실 스터디카페 지점을 검색하고 선택하세요.</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-[#8b95a1] hover:text-[#191f28] p-1.5 rounded-lg hover:bg-[#f1f3f5] transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* 상단: 지점 검색창 (autoFocus 제거로 모바일 키보드 자동 팝업 방지) */}
        <div className="flex items-center bg-[#f8f9fc] border border-[#e5e8eb] focus-within:border-[#a67c48] focus-within:ring-2 focus-within:ring-[#a67c48]/20 rounded-xl px-3.5 py-1 transition-all shrink-0">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="지점명 또는 주소를 검색하세요 (예: 여의도, 마포)"
            className="flex-1 bg-transparent text-sm text-[#191f28] placeholder-[#8b95a1] outline-none py-2.5 pr-2"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="text-[#8b95a1] hover:text-[#191f28] p-1 mr-1 transition-colors"
              title="검색어 지우기"
            >
              <X size={16} />
            </button>
          )}
          <Search size={19} className="text-[#a67c48] shrink-0" />
        </div>

        {/* 하단: 지점 그리드 목록 (선택 시 확실한 골드 풀 채움 배경색 적용) */}
        <div className="flex-1 overflow-y-auto pr-1">
          {filteredBranches.length === 0 ? (
            <div className="text-center py-12 text-[#8b95a1] space-y-2 border border-dashed border-[#e5e8eb] rounded-2xl bg-[#f8f9fc]">
              <MapPin size={28} className="mx-auto text-[#b0b8c1]" />
              <p className="text-sm font-semibold text-[#191f28]">검색 결과가 없습니다</p>
              <p className="text-xs text-[#8b95a1]">다른 검색어로 다시 시도해 주세요.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2.5">
              {filteredBranches.map((branch) => {
                const isSelected = selectedId === branch.id;
                return (
                  <div
                    key={branch.id}
                    onClick={() => handleCardClick(branch.id)}
                    className={`p-3.5 rounded-xl cursor-pointer flex flex-col justify-between transition-all duration-200 relative group ${
                      isSelected
                        ? 'bg-gradient-to-br from-[#a67c48] to-[#8a6230] text-white border-2 border-[#7a5426] shadow-lg shadow-[#a67c48]/30 -translate-y-0.5 ring-2 ring-[#a67c48]/40'
                        : 'border border-[#e5e8eb] bg-[#f8f9fc] text-[#191f28] hover:bg-white hover:border-[#a67c48]/50 hover:shadow-sm'
                    }`}
                  >
                    {/* 지점명 & 선택 상태 */}
                    <div className="text-left">
                      <div className="flex justify-between items-start">
                        <p className={`text-[11px] font-semibold ${isSelected ? 'text-[#faecd8]' : 'text-[#8b95a1]'}`}>
                          르하임 스터디카페
                        </p>
                        {isSelected ? (
                          <span className="px-2 py-0.5 rounded-md bg-white text-[#8a6230] text-[10px] font-extrabold flex items-center gap-1 shadow-sm">
                            <Check size={11} strokeWidth={3.5} /> 선택됨
                          </span>
                        ) : (
                          <span className="w-4 h-4 rounded-full border border-[#d1d6db] bg-white group-hover:border-[#a67c48]/50" />
                        )}
                      </div>
                      <h4 className={`text-base tracking-tight transition-colors mt-1 ${
                        isSelected 
                          ? 'font-black text-white' 
                          : 'font-bold text-[#191f28] group-hover:text-[#a67c48]'
                      }`}>
                        {branch.name}
                      </h4>
                    </div>

                    {/* 하단: 주소 정보 */}
                    <div className={`text-left pt-2 mt-2.5 border-t ${
                      isSelected ? 'border-white/20' : 'border-[#e5e8eb]/70'
                    }`}>
                      <p className={`text-xs line-clamp-2 leading-snug ${
                        isSelected ? 'text-[#f5e7d6] font-medium' : 'text-[#8b95a1]'
                      }`}>
                        {branch.address}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 모달 푸터 */}
        <div className="pt-2 border-t border-[#e5e8eb] shrink-0">
          <button
            onClick={handleConfirm}
            className="gold-btn w-full py-3.5 text-xs font-bold rounded-xl shadow transition-transform active:scale-[0.99]"
          >
            선택 완료
          </button>
        </div>
      </div>
    </div>
  );
};
