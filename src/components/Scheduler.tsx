import React, { useState, useEffect, useRef } from 'react';
import type { Room, Reservation, BankInfo, PaymentMethod } from '../types';
import { ArrowLeft, ChevronLeft, ChevronRight, Calendar, Clock, User, Phone, Check, CreditCard, Landmark, CheckCircle2, Navigation } from 'lucide-react';
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
  
  // 스크롤 컨테이너 및 현재 시간 슬롯 ref
  const timelineContainerRef = useRef<HTMLDivElement>(null);
  const currentSlotRef = useRef<HTMLDivElement>(null);

  // 다중 슬롯 선택 상태
  const [selectedSlots, setSelectedSlots] = useState<Array<{ date: string; start: string; end: string }>>([]);

  // 예약자 폼 상태
  const [userName, setUserName] = useState('');
  const [userPhone, setUserPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('points');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 예약 완료 결과 팝업 상태
  const [completedReservations, setCompletedReservations] = useState<Reservation[] | null>(null);

  const isToday = selectedDate === getTodayDateString();

  // HH:MM -> minutes (충돌 및 시간 비교용)
  const timeToMinutes = (timeStr: string) => {
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
  };

  // 현재 시간(분 단위)
  const now = new Date();
  const currentTotalMinutes = now.getHours() * 60 + now.getMinutes();

  // 현재 시간 슬롯 찾기 (현재 시각이 포함되거나 바로 직전/직후 슬롯)
  const getCurrentSlotStart = () => {
    const matching = TIME_SLOTS.find((s) => {
      const sStart = timeToMinutes(s.start);
      const sEnd = timeToMinutes(s.end);
      return currentTotalMinutes >= sStart && currentTotalMinutes < sEnd;
    });
    if (matching) return matching.start;
    // 현재 시각이 06:00 이전이면 06:00, 24:00 이후면 마지막 슬롯
    if (currentTotalMinutes < 360) return '06:00';
    return '23:30';
  };

  const currentSlotStart = getCurrentSlotStart();

  // 현재 시간으로 자동 스크롤 함수
  const scrollToCurrentTime = (behavior: ScrollBehavior = 'smooth') => {
    if (!timelineContainerRef.current) return;

    if (isToday) {
      if (currentSlotRef.current) {
        const container = timelineContainerRef.current;
        const target = currentSlotRef.current;
        const topOffset = target.offsetTop - container.offsetTop - 12; // 상단 여백 12px
        container.scrollTo({ top: Math.max(0, topOffset), behavior });
      }
    } else {
      timelineContainerRef.current.scrollTo({ top: 0, behavior });
    }
  };

  // 날짜 변경 또는 뷰 모드 전환 시 자동 스크롤
  useEffect(() => {
    // 렌더링 후 DOM 위치가 확정된 뒤 스크롤 실행
    const timer = setTimeout(() => {
      scrollToCurrentTime('auto');
    }, 100);
    return () => clearTimeout(timer);
  }, [selectedDate, viewMode]);

  // 특정 시간대의 예약 겹침 검사
  const findReservation = (date: string, startT: string, endT: string) => {
    const checkStart = timeToMinutes(startT);
    const checkEnd = timeToMinutes(endT);

    return reservations.find((r) => {
      if (r.barcodeStatus === 'cancelled' || r.roomId !== room.id || r.date !== date) return false;
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

    // 오늘 날짜의 지난 시간(현재 시각 이전 종료 슬롯)은 선택 방지
    if (date === getTodayDateString()) {
      const slotEndMin = timeToMinutes(end);
      if (slotEndMin <= currentTotalMinutes) {
        alert('이미 지난 시간대는 예약할 수 없습니다.');
        return;
      }
    }

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
    if (isSubmitting) return;
    setErrorMsg('');

    if (!userName.trim() || !userPhone.trim()) {
      setErrorMsg('예약자 성함과 연락처를 모두 입력해 주세요.');
      return;
    }

    setIsSubmitting(true);
    try {
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
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#ffffff] relative">
      {/* 헤더 컨트롤 영역 */}
      <div className="p-4 border-b border-[#e5e8eb] bg-[#ffffff] space-y-3 shrink-0">
        <div className="flex justify-between items-center">
          <button
            onClick={onBack}
            className="flex items-center gap-1 text-xs font-semibold text-[#8b95a1] hover:text-[#191f28] transition-colors"
          >
            <ArrowLeft size={16} /> 방 목록으로 이동
          </button>
          
          <div className="flex bg-[#f8f9fc] border border-[#e5e8eb] rounded-xl p-1 text-xs font-bold">
            <button
              onClick={() => setViewMode('daily')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                viewMode === 'daily'
                  ? 'bg-[#ffffff] text-[#a67c48] shadow-sm font-bold'
                  : 'text-[#8b95a1] hover:text-[#191f28]'
              }`}
            >
              일별 뷰
            </button>
            <button
              onClick={() => setViewMode('weekly')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                viewMode === 'weekly'
                  ? 'bg-[#ffffff] text-[#a67c48] shadow-sm font-bold'
                  : 'text-[#8b95a1] hover:text-[#191f28]'
              }`}
            >
              주별 뷰 (7일)
            </button>
          </div>
        </div>

        {/* 공부방 제목 및 인원 정보 */}
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-base font-bold text-[#191f28]">{room.name}</h2>
            <p className="text-xs text-[#8b95a1] pt-0.5">{room.description}</p>
          </div>
          <span className="text-xs text-[#a67c48] bg-[#a67c48]/10 font-bold px-2.5 py-1 rounded-full shrink-0">
            정원 {room.capacity}명
          </span>
        </div>

        {/* 일별 날짜 내비게이터 & 현재 시간 바로가기 */}
        {viewMode === 'daily' && (
          <div className="flex justify-between items-center bg-[#f8f9fc] border border-[#e5e8eb] rounded-2xl p-2.5 text-sm font-bold text-[#191f28]">
            <button onClick={() => changeDate(-1)} className="p-1 hover:text-[#a67c48] transition-colors" title="이전 날짜">
              <ChevronLeft size={20} />
            </button>
            
            <div className="flex items-center gap-2">
              <Calendar size={16} className="text-[#a67c48]" />
              <span>{selectedDate}</span>
              <span className="text-xs text-[#8b95a1] font-normal">
                ({new Date(selectedDate).toLocaleDateString('ko-KR', { weekday: 'short' })})
              </span>
              {isToday && (
                <span className="text-[11px] font-bold text-[#a67c48] bg-[#a67c48]/15 px-2 py-0.5 rounded-full ml-1">
                  오늘
                </span>
              )}
            </div>

            <div className="flex items-center gap-1">
              {isToday && (
                <button
                  onClick={() => scrollToCurrentTime('smooth')}
                  className="text-xs font-semibold text-[#a67c48] bg-[#a67c48]/10 hover:bg-[#a67c48]/20 px-2 py-1 rounded-lg flex items-center gap-1 transition-colors"
                  title="현재 시간 위치로 스크롤 이동"
                >
                  <Navigation size={12} /> 지금
                </button>
              )}
              <button onClick={() => changeDate(1)} className="p-1 hover:text-[#a67c48] transition-colors" title="다음 날짜">
                <ChevronRight size={20} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 스케줄 타임라인 표출 영역 */}
      <div ref={timelineContainerRef} className="flex-1 overflow-y-auto p-4 scroll-smooth">
        {viewMode === 'daily' ? (
          /* 일별 스케줄 타임라인 */
          <div className="space-y-2 pb-20">
            {TIME_SLOTS.map((slot, index) => {
              const existingRes = findReservation(selectedDate, slot.start, slot.end);
              const isSelected = isSlotSelected(selectedDate, slot.start, slot.end);
              
              // 현재 시간 슬롯 여부
              const isCurrentSlot = isToday && slot.start === currentSlotStart;
              // 오늘 날짜에서 이미 종료된 과거 슬롯 여부
              const isPastSlot = isToday && timeToMinutes(slot.end) <= currentTotalMinutes;

              let slotClass = 'bg-[#f8f9fc] border-[#e5e8eb] hover:border-[#a67c48]/50 text-[#191f28] cursor-pointer';
              if (existingRes) {
                slotClass = 'bg-[#f1f3f5] border-[#e5e8eb] text-[#8b95a1] cursor-not-allowed opacity-80';
              } else if (isPastSlot) {
                slotClass = 'bg-[#f8f9fa] border-[#f1f3f5] text-[#b0b8c1] cursor-not-allowed opacity-60';
              } else if (isSelected) {
                slotClass = 'bg-[#a67c48]/10 border-[#a67c48] text-[#a67c48] font-bold shadow-sm ring-1 ring-[#a67c48]';
              }

              return (
                <div
                  key={index}
                  ref={isCurrentSlot ? currentSlotRef : null}
                  onClick={() => handleSlotToggle(selectedDate, slot.start, slot.end)}
                  className={`border rounded-2xl p-3.5 flex justify-between items-center transition-all ${slotClass} ${
                    isCurrentSlot ? 'ring-2 ring-[#a67c48] bg-[#a67c48]/5' : ''
                  }`}
                >
                  <div className="flex items-center gap-2.5 text-sm">
                    <Clock size={16} className={isCurrentSlot ? 'text-[#a67c48]' : isSelected ? 'text-[#a67c48]' : 'text-[#8b95a1]'} />
                    <span className="font-semibold">{slot.start} ~ {slot.end}</span>
                    {isCurrentSlot && (
                      <span className="text-[11px] font-bold bg-[#a67c48] text-white px-2 py-0.5 rounded-full flex items-center gap-1">
                        🔴 현재 시간
                      </span>
                    )}
                  </div>

                  <div className="text-xs">
                    {existingRes ? (
                      <span className="text-xs text-[#e93d3d] font-bold bg-[#e93d3d]/10 px-2.5 py-1 rounded-full">
                        예약 완료 ({existingRes.userName})
                      </span>
                    ) : isPastSlot ? (
                      <span className="text-xs text-[#8b95a1] font-medium bg-[#f1f3f5] px-2.5 py-1 rounded-full">
                        시간 경과
                      </span>
                    ) : isSelected ? (
                      <span className="text-xs text-[#a67c48] font-bold flex items-center gap-1 bg-[#a67c48]/10 px-2.5 py-1 rounded-full">
                        <Check size={14} /> 선택됨
                      </span>
                    ) : (
                      <span className="text-xs text-[#8b95a1] font-medium">예약 가능 (4,000P)</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* 주별 스케줄 타임라인 테이블 */
          <div className="weekly-grid-wrapper pb-16">
            <table className="weekly-grid-table">
              <thead>
                <tr>
                  <th className="weekly-grid-time-col">시간</th>
                  {WEEKLY_DAYS.map((day) => {
                    const isDayToday = day.date === getTodayDateString();
                    return (
                      <th key={day.date} className={isDayToday ? 'bg-[#a67c48]/10 text-[#a67c48]' : ''}>
                        <div className="font-bold flex items-center justify-center gap-0.5">
                          {day.dayName}
                          {isDayToday && <span className="text-[9px] bg-[#a67c48] text-white px-1 rounded">오늘</span>}
                        </div>
                        <div className={`text-xs ${isDayToday ? 'text-[#a67c48] font-bold' : 'text-[#8b95a1] font-normal'}`}>
                          {day.dayNum}일
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {TIME_SLOTS.map((slot, sIdx) => {
                  const isCurrentTimeSlot = slot.start === currentSlotStart;
                  return (
                    <tr key={sIdx} className={isCurrentTimeSlot ? 'bg-[#a67c48]/5' : ''}>
                      <td className={`weekly-grid-time-col font-mono ${isCurrentTimeSlot ? 'font-bold text-[#a67c48]' : ''}`}>
                        {slot.start}
                      </td>
                      {WEEKLY_DAYS.map((day) => {
                        const isDayToday = day.date === getTodayDateString();
                        const existingRes = findReservation(day.date, slot.start, slot.end);
                        const isSelected = isSlotSelected(day.date, slot.start, slot.end);
                        const isPast = isDayToday && timeToMinutes(slot.end) <= currentTotalMinutes;

                        if (existingRes) {
                          return (
                            <td
                              key={day.date}
                              className="weekly-cell-booked"
                              title={`예약자: ${existingRes.userName}`}
                            >
                              마감
                            </td>
                          );
                        }

                        if (isPast) {
                          return (
                            <td
                              key={day.date}
                              className="text-[11px] text-[#b0b8c1] bg-[#f8f9fa] cursor-not-allowed text-center"
                              title="지난 시간대"
                            >
                              -
                            </td>
                          );
                        }

                        return (
                          <td
                            key={day.date}
                            onClick={() => handleSlotToggle(day.date, slot.start, slot.end)}
                            className={isSelected ? 'weekly-cell-selected' : 'weekly-cell-available'}
                          >
                            {isSelected ? '선택' : '예약'}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 하단 플로팅 예약 신청 버튼 (FAB) */}
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
            <span>예약 신청하기 ({totalCost.toLocaleString()}원 / P)</span>
          </button>
        </div>
      )}

      {/* 예약 신청 & 결제 수단 선택 모달 */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-[#e5e8eb]">
              <h3 className="text-base font-bold text-[#191f28] flex items-center gap-1.5">
                <Check size={18} className="text-[#a67c48]" /> 예약 신청 및 결제 방식
              </h3>
              <button onClick={() => setShowModal(false)} className="text-[#8b95a1] hover:text-[#191f28] text-2xl">&times;</button>
            </div>
            
            <div className="bg-[#f8f9fc] border border-[#e5e8eb] rounded-2xl p-3.5 mb-4 space-y-2 text-xs text-[#4e5968]">
              <p className="font-bold text-sm text-[#191f28]">{room.name}</p>
              <div className="border-t border-[#e5e8eb] pt-2">
                <p className="font-semibold text-[#a67c48] mb-1">선택된 시간 슬롯 ({selectedSlots.length}개):</p>
                <div className="max-h-28 overflow-y-auto space-y-1 bg-[#ffffff] p-2.5 rounded-xl border border-[#e5e8eb]">
                  {selectedSlots.map((s, idx) => (
                    <div key={idx} className="flex justify-between text-xs py-0.5 border-b border-[#f1f3f5] last:border-none">
                      <span className="text-[#4e5968]">{s.date} ({new Date(s.date).toLocaleDateString('ko-KR', { weekday: 'short' })})</span>
                      <strong className="text-[#191f28]">{s.start} ~ {s.end}</strong>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex justify-between items-center pt-2 text-sm font-bold border-t border-dashed border-[#e5e8eb]">
                <span>결제 예정 금액</span>
                <span className="text-[#a67c48] text-base">{totalCost.toLocaleString()} 원</span>
              </div>
            </div>

            <form onSubmit={handleBookingSubmit} className="space-y-3.5">
              {/* 결제 수단 선택 */}
              <div className="form-group">
                <label className="text-xs font-bold text-[#191f28]">결제 수단 선택</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('points')}
                    className={`p-3 rounded-2xl border text-xs font-bold flex flex-col items-center gap-1.5 transition-all ${
                      paymentMethod === 'points'
                        ? 'border-[#a67c48] bg-[#a67c48]/10 text-[#a67c48] ring-1 ring-[#a67c48]'
                        : 'border-[#e5e8eb] bg-[#f8f9fc] text-[#8b95a1]'
                    }`}
                  >
                    <CreditCard size={18} />
                    <span>포인트 결제 (즉시)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('bank_transfer')}
                    className={`p-3 rounded-2xl border text-xs font-bold flex flex-col items-center gap-1.5 transition-all ${
                      paymentMethod === 'bank_transfer'
                        ? 'border-[#a67c48] bg-[#a67c48]/10 text-[#a67c48] ring-1 ring-[#a67c48]'
                        : 'border-[#e5e8eb] bg-[#f8f9fc] text-[#8b95a1]'
                    }`}
                  >
                    <Landmark size={18} />
                    <span>무통장 입금</span>
                  </button>
                </div>
              </div>

              {/* 무통장 입금 계좌 안내 */}
              {paymentMethod === 'bank_transfer' && (
                <div className="bg-[#a67c48]/10 border border-[#a67c48]/30 rounded-2xl p-3.5 space-y-1 text-xs text-[#191f28]">
                  <div className="font-bold text-[#a67c48] flex items-center gap-1">
                    <Landmark size={14} /> 입금 계좌 안내
                  </div>
                  <div className="text-xs space-y-0.5 pt-1">
                    <p>• 은행명: <strong>{bankInfo.bankName}</strong></p>
                    <p>• 계좌번호: <strong className="text-[#a67c48] font-mono">{bankInfo.accountNumber}</strong></p>
                    <p>• 예금주: <strong>{bankInfo.accountHolder}</strong></p>
                  </div>
                  <p className="text-xs text-[#8b95a1] pt-1">
                    * 입금 완료 후 관리자 확인 시 '결제 완료' 상태로 전환되며 출입 바코드가 활성화됩니다.
                  </p>
                </div>
              )}

              <div className="form-group">
                <label className="text-xs font-bold flex items-center gap-1 text-[#191f28]">
                  <User size={13} className="text-[#a67c48]" /> 예약자 성함
                </label>
                <input
                  type="text"
                  required
                  placeholder="예: 홍길동"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  className="form-input text-sm"
                />
              </div>

              <div className="form-group">
                <label className="text-xs font-bold flex items-center gap-1 text-[#191f28]">
                  <Phone size={13} className="text-[#a67c48]" /> 연락처
                </label>
                <input
                  type="tel"
                  required
                  placeholder="예: 010-1234-5678"
                  value={userPhone}
                  onChange={(e) => setUserPhone(e.target.value)}
                  className="form-input text-sm"
                />
              </div>

              {errorMsg && (
                <div className="text-xs text-[#e93d3d] bg-[#e93d3d]/10 p-3 rounded-xl border border-[#e93d3d]/20">
                  {errorMsg}
                </div>
              )}

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="gold-btn-outline flex-1 py-3 text-xs font-bold"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="gold-btn flex-1 py-3 text-xs font-bold flex justify-center items-center gap-1.5 shadow"
                >
                  <Check size={15} /> {isSubmitting ? '처리 중...' : paymentMethod === 'points' ? '포인트 결제 완료' : '무통장 예약 신청'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 예약 완료 및 출입 바코드 발급 결과 모달 */}
      {completedReservations && (
        <div className="modal-overlay" onClick={() => setCompletedReservations(null)}>
          <div className="modal-content text-center space-y-4 max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="w-12 h-12 rounded-full bg-[#28a745]/10 text-[#28a745] mx-auto flex items-center justify-center">
              <CheckCircle2 size={30} />
            </div>

            <div>
              <h3 className="text-base font-bold text-[#191f28]">예약 신청이 완료되었습니다!</h3>
              <p className="text-xs text-[#8b95a1] mt-1">
                발급된 출입 바코드를 통해 현장 입장이 가능합니다.
              </p>
            </div>

            {/* 발급된 바코드 대표 카드 표출 */}
            <div className="bg-[#f8f9fc] border border-[#e5e8eb] rounded-2xl p-4 space-y-3">
              <div className="text-xs font-bold text-[#a67c48] uppercase tracking-wider flex justify-center items-center gap-1">
                출입증 바코드 (Pass Card)
              </div>

              <div className="bg-white p-3 rounded-xl border border-[#e5e8eb] space-y-1 shadow-sm">
                <div className="font-mono text-sm tracking-widest text-[#191f28] font-bold">
                  {completedReservations[0].barcodeId}
                </div>
                <div className="flex justify-center items-center gap-0.5 h-8 px-6 opacity-90">
                  {Array.from({ length: 32 }).map((_, i) => (
                    <div
                      key={i}
                      style={{ width: i % 3 === 0 ? '3px' : '1px' }}
                      className="bg-[#191f28] h-full"
                    />
                  ))}
                </div>
              </div>

              <div className="text-xs text-[#191f28] space-y-1.5 text-left bg-white p-3 rounded-xl border border-[#e5e8eb]">
                <p>• 공간 명칭: <strong>{room.name}</strong></p>
                <p>• 예약자: <strong>{completedReservations[0].userName}</strong></p>
                <p>• 총 예약 슬롯: <strong>{completedReservations.length}개 타임</strong></p>
                <p>• 결제 상태: <strong className={completedReservations[0].paymentStatus === 'paid' ? 'text-[#28a745]' : 'text-[#f59e0b]'}>
                  {completedReservations[0].paymentStatus === 'paid' ? '결제 완료 (출입가능)' : '무통장 입금 확인 대기'}
                </strong></p>
              </div>

              {completedReservations[0].paymentMethod === 'bank_transfer' && (
                <div className="bg-[#f59e0b]/10 border border-[#f59e0b]/30 rounded-xl p-3 text-xs text-[#4e5968] text-left space-y-1 font-medium">
                  <p className="font-bold text-[#f59e0b]">• 입금 계좌:</p>
                  <p>{bankInfo.bankName} {bankInfo.accountNumber} (예금주: {bankInfo.accountHolder})</p>
                </div>
              )}
            </div>

            <button
              onClick={() => setCompletedReservations(null)}
              className="gold-btn w-full py-3.5 text-sm font-bold rounded-xl shadow"
            >
              확인 및 스케줄로 돌아가기
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
