import React, { useState } from 'react';
import type { Room, Reservation, BankInfo } from '../types';
import { ChevronRight, QrCode, Calendar } from 'lucide-react';


interface UserDashboardProps {
  rooms: Room[];
  reservations: Reservation[];
  bankInfo: BankInfo;
  onSelectRoom: (roomId: string) => void;
}

export const UserDashboard: React.FC<UserDashboardProps> = ({
  rooms,
  reservations,
  bankInfo,
  onSelectRoom,
}) => {
  const [showMyReservationsModal, setShowMyReservationsModal] = useState(false);

  return (
    <div className="flex-1 flex flex-col overflow-y-auto p-4 space-y-5">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-base font-bold text-[#b09168]">공부방 선택 및 실시간 예약</h2>
          <p className="text-xs text-[#8e8e93]">원하시는 공부방을 선택하여 스케줄을 확인하고 예약을 진행하세요.</p>
        </div>

        <button
          onClick={() => setShowMyReservationsModal(true)}
          className="gold-btn-outline text-xs py-2 px-3 rounded-xl font-bold flex items-center gap-1.5 shrink-0"
        >
          <QrCode size={15} /> 내 바코드 / 예약 현황
        </button>
      </div>

      {/* 공부방 카드 목록 */}
      <div className="space-y-3">
        {rooms.length === 0 ? (
          <div className="text-center py-12 text-[#8e8e93] border border-dashed border-[#e5e5ea] rounded-xl bg-white">
            현재 이용 가능한 공부방이 없습니다.
          </div>
        ) : (
          rooms.map((room, index) => (
            <div
              key={room.id}
              onClick={() => onSelectRoom(room.id)}
              className="bg-[#f8f9fa] hover:bg-[#ffffff] border border-[#e5e5ea] hover:border-[#b09168]/50 rounded-xl p-4 flex justify-between items-center cursor-pointer transition-all duration-200 hover:-translate-y-0.5 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <span className="text-sm font-extrabold text-[#b09168] tracking-wider shrink-0">
                  ROOM {index + 1}
                </span>
                <span className="text-[#e5e5ea]">|</span>
                <div>
                  <h3 className="text-sm font-bold text-[#1c1c1e]">{room.name}</h3>
                  <p className="text-[11px] text-[#8e8e93]">{room.description}</p>
                </div>
              </div>

              <div className="text-[#8e8e93] hover:text-[#b09168] transition-colors shrink-0">
                <ChevronRight size={20} />
              </div>
            </div>
          ))
        )}
      </div>

      {/* 르하임 스터디카페 이용 안내 배너 */}
      <div className="bg-[#f8f9fa] border border-[#e5e5ea] rounded-xl p-4 space-y-2 text-xs text-[#8e8e93] leading-relaxed">
        <h4 className="font-bold text-[#b09168] text-xs">르하임 이용 안내</h4>
        <ul className="list-disc pl-4 space-y-1 text-[11px]">
          <li>공부방 예약은 **30분 단위**로 신청할 수 있습니다.</li>
          <li>스케줄에서 원하는 시간 슬롯을 터치하시면 예약을 진행할 수 있습니다.</li>
          <li>무통장 입금 선택 시 아래 안내 계좌로 입금해 주시면 확인 후 승인됩니다.</li>
          <li>입금 계좌: <strong>{bankInfo.bankName} {bankInfo.accountNumber} (예금주: {bankInfo.accountHolder})</strong></li>
        </ul>
      </div>

      {/* 내 예약 현황 & 바코드 모달 */}
      {showMyReservationsModal && (
        <div className="modal-overlay" onClick={() => setShowMyReservationsModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-bold text-[#1c1c1e] flex items-center gap-1.5">
                <QrCode size={18} className="text-[#b09168]" /> 내 예약 내역 및 출입 바코드
              </h3>
              <button onClick={() => setShowMyReservationsModal(false)} className="text-[#8e8e93] text-xl">&times;</button>
            </div>

            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
              {reservations.length === 0 ? (
                <p className="text-xs text-[#8e8e93] text-center py-8 border border-dashed border-[#e5e5ea] rounded-xl">
                  등록된 예약 내역이 없습니다.
                </p>
              ) : (
                reservations.map((res) => {
                  const room = rooms.find((r) => r.id === res.roomId);
                  return (
                    <div key={res.id} className="border border-[#e5e5ea] rounded-xl p-3.5 bg-[#f8f9fa] space-y-2.5">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-xs font-bold text-[#1c1c1e]">{res.userName}님</span>
                          <span className="text-[10px] text-[#8e8e93] ml-2">({room?.name})</span>
                        </div>
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                            res.paymentStatus === 'paid'
                              ? 'bg-[#34c759]/10 text-[#34c759]'
                              : 'bg-[#ff9500]/10 text-[#ff9500]'
                          }`}
                        >
                          {res.paymentStatus === 'paid' ? '결제 완료' : '무통장 입금 대기'}
                        </span>
                      </div>

                      {/* 바코드 비주얼 패널 */}
                      <div className="bg-white p-2.5 rounded-lg border border-[#e5e5ea] text-center space-y-1">
                        <div className="font-mono text-xs tracking-widest text-[#1c1c1e] font-extrabold">
                          {res.barcodeId}
                        </div>
                        <div className="flex justify-center items-center gap-0.5 h-7 px-4 opacity-85">
                          {Array.from({ length: 28 }).map((_, i) => (
                            <div
                              key={i}
                              style={{ width: i % 3 === 0 ? '3px' : '1px' }}
                              className="bg-[#1c1c1e] h-full"
                            />
                          ))}
                        </div>
                      </div>

                      <div className="text-[10px] text-[#8e8e93] flex justify-between items-center pt-0.5">
                        <span className="flex items-center gap-1">
                          <Calendar size={11} /> {res.date} ({res.startTime} ~ {res.endTime})
                        </span>
                        <span className="text-[#b09168] font-bold">
                          {res.paymentMethod === 'points' ? '포인트 결제' : '무통장 입금'}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <button
              onClick={() => setShowMyReservationsModal(false)}
              className="gold-btn-outline w-full py-2.5 text-xs font-bold mt-4"
            >
              닫기
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
