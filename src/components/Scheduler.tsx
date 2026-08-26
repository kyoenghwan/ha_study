import React, { useState, useEffect, useRef } from 'react';
import type { Room, Reservation, PaymentMethod, UserAccount } from '../types';
import { ArrowLeft, ChevronLeft, ChevronRight, Calendar, Clock, Check, CheckCircle2 } from 'lucide-react';
import { getTodayDateString, getOffsetDateString } from '../utils/mockData';

interface SchedulerProps {
  currentUser?: UserAccount | null;
  room: Room;
  reservations: Reservation[];
  onBack: () => void;
  onAddReservations: (
    slots: Array<{ date: string; start: string; end: string }>,
    userName: string,
    userPhone: string,
    paymentMethod: PaymentMethod
  ) => { success: boolean; createdReservations?: Reservation[]; message?: string };
}

// 24시간 (00:00 ~ 24:00, 30분 단위 48개 슬롯) 생성
const generateTimeSlots = () => {
  const slots: { start: string; end: string }[] = [];
  for (let hour = 0; hour < 24; hour++) {
    const hStr = String(hour).padStart(2, '0');
    const nextHStr = String(hour + 1).padStart(2, '0');
    slots.push({ start: `${hStr}:00`, end: `${hStr}:30` });
    slots.push({ start: `${hStr}:30`, end: `${nextHStr}:00` });
  }
  return slots;
};

const TIME_SLOTS = generateTimeSlots();

export const Scheduler: React.FC<SchedulerProps> = ({
  currentUser,
  room,
  reservations,
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

  // 에러 및 제출 상태
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
    return '00:00';
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

      return (
        (checkStart >= rStart && checkStart < rEnd) ||
        (checkEnd > rStart && checkEnd <= rEnd) ||
        (checkStart <= rStart && checkEnd >= rEnd)
      );
    });
  };

  // 날짜 변경 (이전/다음)
  const changeDate = (days: number) => {
    const [y, m, d] = selectedDate.split('-').map(Number);
    const target = new Date(y, m - 1, d + days);
    const yStr = target.getFullYear();
    const mStr = String(target.getMonth() + 1).padStart(2, '0');
    const dStr = String(target.getDate()).padStart(2, '0');
    setSelectedDate(`${yStr}-${mStr}-${dStr}`);
  };

  // 주별 뷰용 날짜 7일 배열
  const getWeeklyDays = () => {
    const days: Array<{ date: string; dayNum: number; dayName: string; label: string }> = [];
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

  // 예약 확정 처리 (포인트 1-클릭 즉시 결제)
  const handleBookingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setErrorMsg('');

    const bookingName = currentUser?.name || '회원';
    const bookingPhone = currentUser?.phone || '010-0000-0000';
    const userPoints = currentUser?.points || 0;

    if (userPoints < totalCost) {
      setErrorMsg(`보유 포인트(${userPoints.toLocaleString()}P)가 부족합니다. 상단에서 포인트를 먼저 충전해 주세요.`);
      return;
    }

    setIsSubmitting(true);
    try {
      const result = onAddReservations(selectedSlots, bookingName, bookingPhone, 'points');
      if (result.success && result.createdReservations) {
        setShowModal(false);
        setCompletedReservations(result.createdReservations);
        setSelectedSlots([]);
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

        {/* 일별 날짜 내비게이터 */}
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

              return (
                <div
                  key={index}
                  ref={isCurrentSlot ? currentSlotRef : null}
                  onClick={() => handleSlotToggle(selectedDate, slot.start, slot.end)}
                  className={`rounded-2xl p-3.5 flex justify-between items-center transition-all shadow-sm ${
                    existingRes || isPastSlot ? 'cursor-not-allowed' : 'cursor-pointer'
                  } ${isSelected ? 'border-2 -translate-y-0.5 shadow-md' : 'border'}`}
                  style={{
                    backgroundColor: isSelected
                      ? '#a67c48'
                      : existingRes
                      ? '#f8f9fc'
                      : isPastSlot
                      ? '#f8f9fa'
                      : isCurrentSlot
                      ? '#fcf8f2'
                      : '#f8f9fc',
                    borderColor: isSelected
                      ? '#8a6230'
                      : isCurrentSlot
                      ? '#a67c48'
                      : '#e5e8eb',
                    color: isSelected ? '#ffffff' : isPastSlot ? '#b0b8c1' : '#191f28',
                  }}
                >
                  <div className="flex items-center gap-2.5 text-sm">
                    <Clock 
                      size={16} 
                      style={{ color: isSelected ? '#ffffff' : isCurrentSlot ? '#a67c48' : '#8b95a1' }} 
                    />
                    <span className={isSelected ? 'font-extrabold text-white' : 'font-semibold'}>
                      {slot.start} ~ {slot.end}
                    </span>
                    {isCurrentSlot && (
                      <span 
                        className="text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm"
                        style={{
                          backgroundColor: isSelected ? '#ffffff' : '#a67c48',
                          color: isSelected ? '#a67c48' : '#ffffff',
                        }}
                      >
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
                      <span 
                        className="text-xs font-black px-2.5 py-1 rounded-full flex items-center gap-1 shadow-sm"
                        style={{ backgroundColor: '#ffffff', color: '#a67c48' }}
                      >
                        <Check size={13} strokeWidth={3.5} /> 선택됨
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
                {TIME_SLOTS.map((slot) => {
                  return (
                    <tr key={slot.start}>
                      <td className="weekly-grid-time-col font-medium">
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
            <span>예약 신청하기 ({totalCost.toLocaleString()} P)</span>
          </button>
        </div>
      )}

      {/* 예약 확인 & 포인트 결제 모달 (이상한 점선/결제수단선택/수동입력 완전 제거) */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-[#e5e8eb]">
              <h3 className="text-base font-bold text-[#191f28] flex items-center gap-1.5">
                <Check size={18} className="text-[#a67c48]" /> 예약 확인 및 포인트 결제
              </h3>
              <button onClick={() => setShowModal(false)} className="text-[#8b95a1] hover:text-[#191f28] text-2xl">&times;</button>
            </div>
            
            <div className="bg-[#f8f9fc] border border-[#e5e8eb] rounded-2xl p-4 mb-4 space-y-3 text-xs text-[#4e5968]">
              {/* 예약 룸 정보 & 예약자 */}
              <div className="flex justify-between items-center">
                <span className="font-bold text-sm text-[#191f28]">{room.name}</span>
                <span className="text-xs text-[#a67c48] font-bold bg-[#a67c48]/10 px-2.5 py-0.5 rounded-full">
                  {currentUser?.name || '회원'}님
                </span>
              </div>

              {/* 선택된 시간 슬롯 목록 */}
              <div className="border-t border-[#e5e8eb] pt-2">
                <p className="font-semibold text-[#a67c48] mb-1.5">선택된 시간 슬롯 ({selectedSlots.length}개):</p>
                <div className="max-h-32 overflow-y-auto space-y-1 bg-[#ffffff] p-2.5 rounded-xl border border-[#e5e8eb]">
                  {selectedSlots.map((s, idx) => (
                    <div key={idx} className="flex justify-between text-xs py-1 border-b border-[#f1f3f5] last:border-none">
                      <span className="text-[#4e5968]">{s.date} ({new Date(s.date).toLocaleDateString('ko-KR', { weekday: 'short' })})</span>
                      <strong className="text-[#191f28] font-bold">{s.start} ~ {s.end}</strong>
                    </div>
                  ))}
                </div>
              </div>

              {/* 포인트 결제 정산 요약 */}
              <div className="bg-white p-3 rounded-xl border border-[#e5e8eb] space-y-1.5">
                <div className="flex justify-between items-center text-xs text-[#8b95a1]">
                  <span>현재 보유 포인트</span>
                  <span className="font-bold text-[#191f28]">{(currentUser?.points || 0).toLocaleString()} P</span>
                </div>
                <div className="flex justify-between items-center text-sm font-bold text-[#191f28] pt-1.5 border-t border-[#f1f3f5]">
                  <span>차감 결제 포인트</span>
                  <span className="text-[#a67c48] font-extrabold text-base">-{totalCost.toLocaleString()} P</span>
                </div>
                <div className="flex justify-between items-center text-xs text-[#8b95a1] pt-1.5 border-t border-[#f1f3f5]">
                  <span>결제 후 잔여 포인트</span>
                  <span className={`font-bold ${((currentUser?.points || 0) - totalCost) < 0 ? 'text-[#e93d3d]' : 'text-[#28a745]'}`}>
                    {((currentUser?.points || 0) - totalCost).toLocaleString()} P
                  </span>
                </div>
              </div>
            </div>

            <form onSubmit={handleBookingSubmit} className="space-y-3">
              {errorMsg && (
                <div className="text-xs text-[#e93d3d] bg-[#e93d3d]/10 p-3 rounded-xl border border-[#e93d3d]/20 font-bold">
                  {errorMsg}
                </div>
              )}

              <div className="flex gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="gold-btn-outline flex-1 py-3.5 text-xs font-bold rounded-xl"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || ((currentUser?.points || 0) < totalCost)}
                  className="gold-btn flex-1 py-3.5 text-sm font-bold flex justify-center items-center gap-1.5 shadow rounded-xl whitespace-nowrap"
                >
                  <Check size={16} /> {isSubmitting ? '결제 중...' : '결제'}
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
              <h3 className="text-base font-bold text-[#191f28]">예약 및 결제가 완료되었습니다!</h3>
              <p className="text-xs text-[#8b95a1] mt-1">
                이용 시작 5분 전에 출입 바코드가 자동 활성화됩니다.
              </p>
            </div>

            <div className="bg-[#f8f9fc] border border-[#e5e8eb] rounded-2xl p-4 space-y-3">
              <div className="text-xs text-[#191f28] space-y-1">
                <p>예약 호실: <strong>{room.name}</strong></p>
                <p>예약 슬롯 수: <strong>{completedReservations.length}개 타임</strong></p>
                <p>결제 차감: <strong className="text-[#a67c48] font-bold">{(completedReservations.length * 4000).toLocaleString()} P</strong></p>
              </div>
            </div>

            <button
              onClick={() => {
                setCompletedReservations(null);
                onBack();
              }}
              className="gold-btn w-full py-3.5 font-bold text-sm rounded-xl shadow"
            >
              내 예약 현황으로 이동
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
