import React, { useState } from 'react';
import type { Room, Reservation, BankInfo, PaymentMethod } from '../types';
import { ArrowLeft, ChevronLeft, ChevronRight, Calendar, Clock, User, Phone, Check, CreditCard, QrCode, Landmark, CheckCircle2 } from 'lucide-react';
import { getTodayDateString, getOffsetDateString } from '../utils/mockData';

interface SchedulerProps {
  room: Room;
  reservations: Reservation[];
  bankInfo: BankInfo;
  onBack: () => void;
  onAddReservations: (
    slots: Array<{ date: string; start: string; end: string }>,
    userName: string,
    userPhone: string,
    paymentMethod: PaymentMethod
  ) => { success: boolean; createdReservations?: Reservation[]; message?: string };
}

// 06:00 ~ 24:00 (30분 단위) 슬롯 목록 생성
const generateTimeSlots = () => {
  const slots: { start: string; end: string }[] = [];
  for (let hour = 6; hour < 24; hour++) {
    const hStr = String(hour).padStart(2, '0');
    slots.push({ start: `${hStr}:00`, end: `${hStr}:30` });
    slots.push({ start: `${hStr}:30`, end: `${String(hour + 1).padStart(2, '0')}:00` });
  }
  return slots;
};

const TIME_SLOTS = generateTimeSlots();

export const Scheduler: React.FC<SchedulerProps> = ({
  room,
  reservations,
  bankInfo,
  onBack,
  onAddReservations,
}) => {
  const [viewMode, setViewMode] = useState<'daily' | 'weekly'>('daily');
  const [selectedDate, setSelectedDate] = useState<string>(getTodayDateString());
  const [showModal, setShowModal] = useState(false);
  
  // 다중 슬롯 선택 상태
  const [selectedSlots, setSelectedSlots] = useState<Array<{ date: string; start: string; end: string }>>([]);

  // 예약자 폼 상태
  const [userName, setUserName] = useState('');
  const [userPhone, setUserPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('points');
  const [errorMsg, setErrorMsg] = useState('');

  // 예약 완료 결과 팝업 상태
  const [completedReservations, setCompletedReservations] = useState<Reservation[] | null>(null);

  // HH:MM -> minutes (충돌 확인용)
  const timeToMinutes = (timeStr: string) => {
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
  };

  // 특정 시간대의 예약 겹침 검사
  const findReservation = (date: string, startT: string, endT: string) => {
    const checkStart = timeToMinutes(startT);
    const checkEnd = timeToMinutes(endT);

    return reservations.find((r) => {
      if (r.roomId !== room.id || r.date !== date) return false;
      const rStart = timeToMinutes(r.startTime);
      const rEnd = timeToMinutes(r.endTime);
      return rStart < checkEnd && rEnd > checkStart;
    });
  };

  // 날짜 제어 (일별 뷰)
  const changeDate = (offset: number) => {
    const current = new Date(selectedDate);
    current.setDate(current.getDate() + offset);
    const year = current.getFullYear();
    const month = String(current.getMonth() + 1).padStart(2, '0');
    const day = String(current.getDate()).padStart(2, '0');
    setSelectedDate(`${year}-${month}-${day}`);
  };

  // 오늘부터 7일간의 날짜 배열 생성
  const getWeeklyDays = () => {
    const days = [];
    const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
    for (let i = 0; i < 7; i++) {
      const dateStr = getOffsetDateString(i);
      const d = new Date(dateStr);
      days.push({
        date: dateStr,
        dayNum: d.getDate(),
        dayName: weekdays[d.getDay()],
        label: `${d.getDate()}(${weekdays[d.getDay()]})`,
      });
    }
    return days;
  };

  const WEEKLY_DAYS = getWeeklyDays();

  // 슬롯 다중 선택 토글 핸들러
  const handleSlotToggle = (date: string, start: string, end: string) => {
    if (findReservation(date, start, end)) return;

    const existsIndex = selectedSlots.findIndex(
      (s) => s.date === date && s.start === start && s.end === end
    );

    if (existsIndex > -1) {
      setSelectedSlots(selectedSlots.filter((_, idx) => idx !== existsIndex));
    } else {
      setSelectedSlots([...selectedSlots, { date, start, end }]);
    }
  };

  const isSlotSelected = (date: string, start: string, end: string) => {
    return selectedSlots.some((s) => s.date === date && s.start === start && s.end === end);
  };

  const totalCost = selectedSlots.length * 4000;

  // 예약 확정 처리
  const handleBookingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!userName.trim() || !userPhone.trim()) {
      setErrorMsg('예약자 성함과 연락처를 모두 입력해 주세요.');
      return;
    }

    const result = onAddReservations(selectedSlots, userName, userPhone, paymentMethod);
    if (result.success && result.createdReservations) {
      setShowModal(false);
      setCompletedReservations(result.createdReservations);
      setSelectedSlots([]);
      setUserName('');
      setUserPhone('');
    } else {
      setErrorMsg(result.message || '예약 처리 중 오류가 발생했습니다.');
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#ffffff] relative">
      {/* 헤더 컨트롤 영역 */}
      <div className="p-4 border-b border-[#e5e5ea] bg-[#ffffff] space-y-3 shrink-0">
        <div className="flex justify-between items-center">
          <button
            onClick={onBack}
            className="flex items-center gap-1 text-xs font-semibold text-[#8e8e93] hover:text-[#1c1c1e] transition-colors"
          >
            <ArrowLeft size={16} /> 방 선택으로 이동
          </button>
          
          <div className="flex bg-[#f8f9fa] border border-[#e5e5ea] rounded-lg p-0.5 text-xs font-bold">
            <button
              onClick={() => setViewMode('daily')}
              className={`px-3 py-1 rounded-md transition-all ${
                viewMode === 'daily'
                  ? 'bg-[#ffffff] text-[#b09168] shadow-sm'
                  : 'text-[#8e8e93] hover:text-[#1c1c1e]'
              }`}
            >
              일별 뷰
            </button>
            <button
              onClick={() => setViewMode('weekly')}
              className={`px-3 py-1 rounded-md transition-all ${
                viewMode === 'weekly'
                  ? 'bg-[#ffffff] text-[#b09168] shadow-sm'
                  : 'text-[#8e8e93] hover:text-[#1c1c1e]'
              }`}
            >
              주별 뷰 (7일)
            </button>
          </div>
        </div>

        {/* 공부방 제목 및 인원 정보 */}
        <div className="flex justify-between items-end">
          <div>
            <h2 className="text-base font-bold text-[#1c1c1e]">{room.name}</h2>
            <p className="text-xs text-[#8e8e93]">{room.description}</p>
          </div>
          <span className="text-[10px] text-[#b09168] bg-[#b09168]/10 font-bold px-2 py-0.5 rounded">
            정원 {room.capacity}명
          </span>
        </div>

        {/* 일별 날짜 내비게이터 */}
        {viewMode === 'daily' && (
          <div className="flex justify-between items-center bg-[#f8f9fa] border border-[#e5e5ea] rounded-xl p-2 text-xs font-bold text-[#1c1c1e]">
            <button onClick={() => changeDate(-1)} className="p-1 hover:text-[#b09168]">
              <ChevronLeft size={18} />
            </button>
            <div className="flex items-center gap-1.5">
              <Calendar size={14} className="text-[#b09168]" />
              <span>{selectedDate}</span>
              <span className="text-xs text-[#8e8e93]">
                ({new Date(selectedDate).toLocaleDateString('ko-KR', { weekday: 'short' })})
              </span>
            </div>
            <button onClick={() => changeDate(1)} className="p-1 hover:text-[#b09168]">
              <ChevronRight size={18} />
            </button>
          </div>
        )}
      </div>

      {/* 스케줄 타임라인 표출 영역 */}
      <div className="flex-1 overflow-y-auto p-4">
        {viewMode === 'daily' ? (
          /* 일별 스케줄 타임라인 */
          <div className="space-y-1.5">
            {TIME_SLOTS.map((slot, index) => {
              const existingRes = findReservation(selectedDate, slot.start, slot.end);
              const isSelected = isSlotSelected(selectedDate, slot.start, slot.end);

              let slotClass = 'bg-[#f8f9fa] border-[#e5e5ea] hover:border-[#b09168]/50 text-[#1c1c1e] cursor-pointer';
              if (existingRes) {
                slotClass = 'bg-[#f0f0f2] border-[#e5e5ea] text-[#8e8e93] cursor-not-allowed opacity-75';
              } else if (isSelected) {
                slotClass = 'bg-[#b09168]/10 border-[#b09168] text-[#b09168] font-bold shadow-sm';
              }

              return (
                <div
                  key={index}
                  onClick={() => handleSlotToggle(selectedDate, slot.start, slot.end)}
                  className={`border rounded-xl p-3 flex justify-between items-center transition-all ${slotClass}`}
                >
                  <div className="flex items-center gap-2 text-xs">
                    <Clock size={14} className={isSelected ? 'text-[#b09168]' : 'text-[#8e8e93]'} />
                    <span>{slot.start} ~ {slot.end}</span>
                  </div>

                  <div className="text-xs">
                    {existingRes ? (
                      <span className="text-[11px] text-[#ff3b30] font-semibold">
                        예약 완료 ({existingRes.userName})
                      </span>
                    ) : isSelected ? (
                      <span className="text-[11px] text-[#b09168] font-bold flex items-center gap-1">
                        <Check size={14} /> 선택됨
                      </span>
                    ) : (
                      <span className="text-[11px] text-[#8e8e93]">예약 가능 (4,000P)</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* 주별 스케줄 타임라인 테이블 */
          <div className="overflow-x-auto border border-[#e5e5ea] rounded-xl bg-[#ffffff]">
            <table className="w-full text-xs text-center border-collapse">
              <thead>
                <tr className="bg-[#f8f9fa] border-b border-[#e5e5ea] text-[#1c1c1e]">
                  <th className="p-2 border-r border-[#e5e5ea] w-16">시간</th>
                  {WEEKLY_DAYS.map((day) => (
                    <th key={day.date} className="p-2 border-r border-[#e5e5ea] min-w-[70px]">
                      <div>{day.dayName}</div>
                      <div className="text-[10px] text-[#8e8e93]">{day.dayNum}일</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {TIME_SLOTS.map((slot, sIdx) => (
                  <tr key={sIdx} className="border-b border-[#f0f0f2]">
                    <td className="p-1.5 border-r border-[#e5e5ea] font-mono text-[10px] text-[#8e8e93] bg-[#f8f9fa]">
                      {slot.start}
                    </td>
                    {WEEKLY_DAYS.map((day) => {
                      const existingRes = findReservation(day.date, slot.start, slot.end);
                      const isSelected = isSlotSelected(day.date, slot.start, slot.end);

                      if (existingRes) {
                        return (
                          <td
                            key={day.date}
                            className="p-1 border-r border-[#e5e5ea] bg-[#f0f0f2] text-[#ff3b30] text-[9px] font-bold cursor-not-allowed"
                            title={`예약자: ${existingRes.userName}`}
                          >
                            예약완료
                          </td>
                        );
                      }

                      return (
                        <td
                          key={day.date}
                          onClick={() => handleSlotToggle(day.date, slot.start, slot.end)}
                          className={`p-1 border-r border-[#e5e5ea] cursor-pointer text-[10px] transition-all ${
                            isSelected
                              ? 'bg-[#b09168] text-white font-bold'
                              : 'hover:bg-[#b09168]/10 text-[#8e8e93]'
                          }`}
                        >
                          {isSelected ? '선택' : '가능'}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 플로팅 예약 신청 버튼 */}
      {selectedSlots.length > 0 && (
        <div className="fab-container">
          <button
            onClick={() => {
              setErrorMsg('');
              setShowModal(true);
            }}
            className="fab-button"
          >
            <span className="fab-badge">{selectedSlots.length}</span>
            <span>예약 신청 ({totalCost.toLocaleString()}원 / P)</span>
          </button>
        </div>
      )}

      {/* 예약 신청 & 결제 수단 선택 모달 */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-bold text-[#1c1c1e] flex items-center gap-1.5">
                <Check size={18} className="text-[#b09168]" /> 예약 신청 및 결제 방식 선택
              </h3>
              <button onClick={() => setShowModal(false)} className="text-[#8e8e93] hover:text-[#1c1c1e] text-xl">&times;</button>
            </div>
            
            <div className="bg-[#f8f9fa] border border-[#e5e5ea] rounded-xl p-3 mb-4 space-y-2 text-xs text-[#48484a]">
              <p className="font-bold text-[#1c1c1e]">{room.name}</p>
              <div className="border-t border-[#e5e5ea] pt-2">
                <p className="font-semibold text-[#b09168] mb-1">선택된 시간 슬롯 ({selectedSlots.length}개):</p>
                <div className="max-h-24 overflow-y-auto space-y-1 bg-[#ffffff] p-2 rounded border border-[#e5e5ea]">
                  {selectedSlots.map((s, idx) => (
                    <div key={idx} className="flex justify-between text-[10px]">
                      <span>{s.date} ({new Date(s.date).toLocaleDateString('ko-KR', { weekday: 'short' })})</span>
                      <strong className="text-[#1c1c1e]">{s.start} ~ {s.end}</strong>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex justify-between items-center pt-2 text-xs font-bold border-t border-dashed border-[#e5e5ea]">
                <span>결제 예정 금액</span>
                <span className="text-[#b09168] text-sm">{totalCost.toLocaleString()} 원</span>
              </div>
            </div>

            <form onSubmit={handleBookingSubmit} className="space-y-3">
              {/* 결제 수단 라디오 버튼 */}
              <div className="form-group">
                <label className="text-xs font-bold text-[#1c1c1e] mb-1 block">결제 수단 선택</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('points')}
                    className={`p-3 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition-all ${
                      paymentMethod === 'points'
                        ? 'border-[#b09168] bg-[#b09168]/10 text-[#b09168]'
                        : 'border-[#e5e5ea] bg-[#f8f9fa] text-[#8e8e93]'
                    }`}
                  >
                    <CreditCard size={16} />
                    <span>포인트 결제 (즉시)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('bank_transfer')}
                    className={`p-3 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition-all ${
                      paymentMethod === 'bank_transfer'
                        ? 'border-[#b09168] bg-[#b09168]/10 text-[#b09168]'
                        : 'border-[#e5e5ea] bg-[#f8f9fa] text-[#8e8e93]'
                    }`}
                  >
                    <Landmark size={16} />
                    <span>무통장 입금</span>
                  </button>
                </div>
              </div>

              {/* 무통장 입금 계좌 안내 카드 */}
              {paymentMethod === 'bank_transfer' && (
                <div className="bg-[#b09168]/5 border border-[#b09168]/30 rounded-xl p-3 space-y-1 text-xs text-[#1c1c1e]">
                  <div className="font-bold text-[#b09168] flex items-center gap-1">
                    <Landmark size={14} /> 입금 계좌 안내
                  </div>
                  <div className="text-[11px] space-y-0.5 pt-1">
                    <p>• 은행명: <strong>{bankInfo.bankName}</strong></p>
                    <p>• 계좌번호: <strong className="text-[#b09168] font-mono">{bankInfo.accountNumber}</strong></p>
                    <p>• 예금주: <strong>{bankInfo.accountHolder}</strong></p>
                  </div>
                  <p className="text-[9px] text-[#8e8e93] pt-1">
                    * 입금 완료 후 관리자 확인 시 '결제 완료' 상태로 전환되며, 출입 바코드가 활성화됩니다.
                  </p>
                </div>
              )}

              <div className="form-group">
                <label className="text-xs font-bold flex items-center gap-1">
                  <User size={12} /> 예약자 성함
                </label>
                <input
                  type="text"
                  required
                  placeholder="예: 홍길동"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  className="form-input text-xs"
                />
              </div>

              <div className="form-group">
                <label className="text-xs font-bold flex items-center gap-1">
                  <Phone size={12} /> 연락처
                </label>
                <input
                  type="tel"
                  required
                  placeholder="예: 010-1234-5678"
                  value={userPhone}
                  onChange={(e) => setUserPhone(e.target.value)}
                  className="form-input text-xs"
                />
              </div>

              {errorMsg && (
                <div className="text-xs text-[#ff3b30] bg-[#ff3b30]/10 p-3 rounded-lg border border-[#ff3b30]/20">
                  {errorMsg}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="gold-btn-outline flex-1 py-3 text-xs font-bold"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="gold-btn flex-1 py-3 text-xs font-bold flex justify-center items-center gap-1.5"
                >
                  <Check size={14} /> {paymentMethod === 'points' ? '포인트 결제 완료' : '무통장 예약 신청'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 예약 완료 및 출입 바코드 발급 결과 모달 */}
      {completedReservations && (
        <div className="modal-overlay" onClick={() => setCompletedReservations(null)}>
          <div className="modal-content text-center space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="w-12 h-12 rounded-full bg-[#34c759]/10 text-[#34c759] mx-auto flex items-center justify-center">
              <CheckCircle2 size={28} />
            </div>

            <div>
              <h3 className="text-base font-bold text-[#1c1c1e]">예약 신청이 정상 완료되었습니다!</h3>
              <p className="text-xs text-[#8e8e93] mt-1">
                발급된 출입 바코드를 통해 입장이 가능합니다.
              </p>
            </div>

            {/* 발급된 바코드 대표 카드 표출 */}
            <div className="bg-[#f8f9fa] border border-[#e5e5ea] rounded-xl p-4 space-y-3">
              <div className="text-xs font-bold text-[#b09168] uppercase tracking-wider flex justify-center items-center gap-1">
                <QrCode size={16} /> 출입증 바코드 (Pass Card)
              </div>

              <div className="bg-white p-3 rounded-lg border border-[#e5e5ea] space-y-1">
                <div className="font-mono text-sm tracking-widest text-[#1c1c1e] font-extrabold">
                  {completedReservations[0].barcodeId}
                </div>
                <div className="flex justify-center items-center gap-0.5 h-8 px-6 opacity-90">
                  {Array.from({ length: 32 }).map((_, i) => (
                    <div
                      key={i}
                      style={{ width: i % 3 === 0 ? '3px' : '1px' }}
                      className="bg-[#1c1c1e] h-full"
                    />
                  ))}
                </div>
              </div>

              <div className="text-xs text-[#1c1c1e] space-y-1 text-left bg-white p-2.5 rounded-lg border border-[#e5e5ea]">
                <p>• 룸 명칭: <strong>{room.name}</strong></p>
                <p>• 예약자: <strong>{completedReservations[0].userName}</strong></p>
                <p>• 총 예약 건수: <strong>{completedReservations.length}개 타임 슬롯</strong></p>
                <p>• 결제 상태: <strong className={completedReservations[0].paymentStatus === 'paid' ? 'text-[#34c759]' : 'text-[#ff9500]'}>
                  {completedReservations[0].paymentStatus === 'paid' ? '결제 완료' : '무통장 입금 대기'}
                </strong></p>
              </div>

              {completedReservations[0].paymentMethod === 'bank_transfer' && (
                <div className="bg-[#ff9500]/10 border border-[#ff9500]/30 rounded-lg p-2.5 text-xs text-[#ff9500] text-left space-y-1 font-medium">
                  <p className="font-bold">• 무통장 입금 계좌:</p>
                  <p>{bankInfo.bankName} {bankInfo.accountNumber} (예금주: {bankInfo.accountHolder})</p>
                </div>
              )}
            </div>

            <button
              onClick={() => setCompletedReservations(null)}
              className="gold-btn w-full py-3 text-xs font-bold rounded-xl"
            >
              확인 및 스케줄로 돌아가기
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
