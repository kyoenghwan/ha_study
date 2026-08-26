import React, { useState } from 'react';
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
    onSelectBranch(branchId);
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

        {/* 상단: 지점 검색창 (돋보기를 오른쪽 끝에 완벽 정렬) */}
        <div className="relative shrink-0">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="지점명 또는 주소를 검색하세요 (예: 여의도, 마포)"
            className="form-input w-full pl-4 pr-11 py-3 text-sm rounded-xl border border-[#e5e8eb] focus:border-[#a67c48] shadow-sm"
            autoFocus
          />
          <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-[#8b95a1]">
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="hover:text-[#191f28] p-0.5 rounded transition-colors"
                title="검색어 지우기"
              >
                <X size={15} />
              </button>
            )}
            <Search size={18} className="text-[#a67c48]" />
          </div>
        </div>

        {/* 하단: 정사각형 지점 그리드 목록 (호점 표시 제거) */}
        <div className="flex-1 overflow-y-auto pr-1">
          {filteredBranches.length === 0 ? (
            <div className="text-center py-12 text-[#8b95a1] space-y-2 border border-dashed border-[#e5e8eb] rounded-2xl bg-[#f8f9fc]">
              <MapPin size={28} className="mx-auto text-[#b0b8c1]" />
              <p className="text-sm font-semibold text-[#191f28]">검색 결과가 없습니다</p>
              <p className="text-xs text-[#8b95a1]">다른 검색어로 다시 시도해 주세요.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {filteredBranches.map((branch) => {
                const isSelected = selectedBranchId === branch.id;
                return (
                  <div
                    key={branch.id}
                    onClick={() => handleCardClick(branch.id)}
                    className={`aspect-square p-4 rounded-2xl border cursor-pointer flex flex-col justify-between transition-all duration-200 hover:-translate-y-1 relative group ${
                      isSelected
                        ? 'border-[#a67c48] bg-[#a67c48]/5 ring-2 ring-[#a67c48] shadow-md'
                        : 'border-[#e5e8eb] bg-[#f8f9fc] hover:bg-white hover:border-[#a67c48]/50 hover:shadow-sm'
                    }`}
                  >
                    {/* 상단: 지점 아이콘 & 선택 체크마크 (호점 배지 제거) */}
                    <div className="flex justify-between items-center">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                        isSelected ? 'bg-[#a67c48] text-white' : 'bg-[#a67c48]/10 text-[#a67c48]'
                      }`}>
                        <MapPin size={16} />
                      </div>
                      
                      {isSelected ? (
                        <div className="w-6 h-6 rounded-full bg-[#a67c48] text-white flex items-center justify-center shadow-sm">
                          <Check size={14} />
                        </div>
                      ) : (
                        <div className="w-6 h-6 rounded-full border border-[#e5e8eb] bg-white group-hover:border-[#a67c48]/40" />
                      )}
                    </div>

                    {/* 중앙: 지점명 */}
                    <div className="space-y-0.5 my-auto text-left">
                      <p className="text-[11px] text-[#a67c48] font-medium">르하임 스터디카페</p>
                      <h4 className="text-base font-bold text-[#191f28] tracking-tight group-hover:text-[#a67c48] transition-colors">
                        {branch.name}
                      </h4>
                    </div>

                    {/* 하단: 주소 정보 */}
                    <div className="text-left pt-2 border-t border-[#e5e8eb]/70">
                      <p className="text-xs text-[#8b95a1] line-clamp-2 leading-snug">
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
            onClick={onClose}
            className="gold-btn w-full py-3.5 text-xs font-bold rounded-xl shadow"
          >
            선택 완료
          </button>
        </div>
      </div>
    </div>
  );
};
