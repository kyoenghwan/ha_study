import { useState, useEffect } from 'react';
import type { Room, Reservation, Role, BankInfo, PaymentMethod, PaymentStatus, AdminBarcodeItem, MasterBarcode } from './types';
import { INITIAL_ROOMS, INITIAL_RESERVATIONS, INITIAL_BANK_INFO, INITIAL_ADMIN_BARCODES, INITIAL_MASTER_BARCODE } from './utils/mockData';
import { AdminDashboard } from './components/AdminDashboard';
import { UserDashboard } from './components/UserDashboard';
import { Scheduler } from './components/Scheduler';
import { Shield, User, LogOut, Coins, Plus } from 'lucide-react';
import logoImg from './assets/르하임로고.jfif';

function App() {
  const [role, setRole] = useState<Role | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [adminBarcodes, setAdminBarcodes] = useState<AdminBarcodeItem[]>([]);
  const [masterBarcode, setMasterBarcode] = useState<MasterBarcode>(INITIAL_MASTER_BARCODE);
  const [bankInfo, setBankInfo] = useState<BankInfo>(INITIAL_BANK_INFO);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  
  // 가상 포인트 시스템 상태
  const [userPoints, setUserPoints] = useState<number>(20000);
  const [showPointModal, setShowPointModal] = useState<boolean>(false);

  // 로컬 스토리지로부터 데이터 로드
  useEffect(() => {
    const savedRooms = localStorage.getItem('lheureux_rooms');
    const savedReservations = localStorage.getItem('lheureux_reservations');
    const savedAdminBarcodes = localStorage.getItem('lheureux_admin_barcodes');
    const savedMasterBarcode = localStorage.getItem('lheureux_master_barcode');
    const savedPoints = localStorage.getItem('lheureux_user_points');
    const savedBankInfo = localStorage.getItem('lheureux_bank_info');

    if (savedRooms) {
      setRooms(JSON.parse(savedRooms));
    } else {
      setRooms(INITIAL_ROOMS);
      localStorage.setItem('lheureux_rooms', JSON.stringify(INITIAL_ROOMS));
    }

    if (savedReservations) {
      setReservations(JSON.parse(savedReservations));
    } else {
      setReservations(INITIAL_RESERVATIONS);
      localStorage.setItem('lheureux_reservations', JSON.stringify(INITIAL_RESERVATIONS));
    }

    if (savedAdminBarcodes) {
      setAdminBarcodes(JSON.parse(savedAdminBarcodes));
    } else {
      setAdminBarcodes(INITIAL_ADMIN_BARCODES);
      localStorage.setItem('lheureux_admin_barcodes', JSON.stringify(INITIAL_ADMIN_BARCODES));
    }

    if (savedMasterBarcode) {
      setMasterBarcode(JSON.parse(savedMasterBarcode));
    } else {
      setMasterBarcode(INITIAL_MASTER_BARCODE);
      localStorage.setItem('lheureux_master_barcode', JSON.stringify(INITIAL_MASTER_BARCODE));
    }

    if (savedPoints) {
      setUserPoints(Number(savedPoints));
    } else {
      setUserPoints(20000);
      localStorage.setItem('lheureux_user_points', '20000');
    }

    if (savedBankInfo) {
      setBankInfo(JSON.parse(savedBankInfo));
    } else {
      setBankInfo(INITIAL_BANK_INFO);
      localStorage.setItem('lheureux_bank_info', JSON.stringify(INITIAL_BANK_INFO));
    }
  }, []);

  // 상태 업데이트 및 로컬 스토리지 동기화 헬퍼 함수
  const updateRooms = (newRooms: Room[]) => {
    setRooms(newRooms);
    localStorage.setItem('lheureux_rooms', JSON.stringify(newRooms));
  };

  const updateReservations = (newReservations: Reservation[]) => {
    setReservations(newReservations);
    localStorage.setItem('lheureux_reservations', JSON.stringify(newReservations));
  };

  const updateAdminBarcodes = (newBarcodes: AdminBarcodeItem[]) => {
    setAdminBarcodes(newBarcodes);
    localStorage.setItem('lheureux_admin_barcodes', JSON.stringify(newBarcodes));
  };

  const handleUpdateMasterBarcode = (barcode: MasterBarcode) => {
    setMasterBarcode(barcode);
    localStorage.setItem('lheureux_master_barcode', JSON.stringify(barcode));
  };

  const handleUpdateBankInfo = (newInfo: BankInfo) => {
    setBankInfo(newInfo);
    localStorage.setItem('lheureux_bank_info', JSON.stringify(newInfo));
  };

  const handleUpdatePoints = (nextPoints: number) => {
    setUserPoints(nextPoints);
    localStorage.setItem('lheureux_user_points', String(nextPoints));
  };

  // 관리자 사전 등록 바코드 추가 (레거시/향후용)
  const handleAddAdminBarcode = (barcodeStr: string) => {
    const formatted = barcodeStr.startsWith('*') ? barcodeStr : `*${barcodeStr}*`;
    const newItem: AdminBarcodeItem = {
      id: `bc-${Date.now()}`,
      barcodeId: formatted,
      status: 'available',
      createdAt: new Date().toISOString().split('T')[0],
    };
    updateAdminBarcodes([...adminBarcodes, newItem]);
  };

  // 관리자 바코드 삭제 (레거시/향후용)
  const handleDeleteAdminBarcode = (id: string) => {
    updateAdminBarcodes(adminBarcodes.filter(b => b.id !== id));
  };

  // 예약 건의 바코드 수동 변경
  const handleUpdateReservationBarcode = (resId: string, newBarcodeId: string) => {
    const formatted = newBarcodeId.startsWith('*') ? newBarcodeId : `*${newBarcodeId}*`;
    const updated = reservations.map(r => {
      if (r.id === resId) {
        return { ...r, barcodeId: formatted };
      }
      return r;
    });
    updateReservations(updated);
  };

  // 공부방 생성
  const handleAddRoom = (roomData: Omit<Room, 'id'>) => {
    const newRoom: Room = {
      ...roomData,
      id: `room-${Date.now()}`,
    };
    updateRooms([...rooms, newRoom]);
  };

  // 공부방 삭제
  const handleDeleteRoom = (roomId: string) => {
    const filteredRooms = rooms.filter((r) => r.id !== roomId);
    const filteredReservations = reservations.filter((res) => res.roomId !== roomId);
    updateRooms(filteredRooms);
    updateReservations(filteredReservations);
  };

  /* [향후 확장용] 레거시 유저 1:1 바코드 풀 할당 헬퍼 (현재는 단순화 모드)
  const getNextAvailableAdminBarcode = (userName: string, reservationId: string): string => {
    const available = adminBarcodes.find(b => b.status === 'available');
    if (available) {
      const updatedBarcodes = adminBarcodes.map(b => 
        b.id === available.id 
          ? { ...b, status: 'assigned' as const, assignedToUserName: userName, assignedReservationId: reservationId }
          : b
      );
      updateAdminBarcodes(updatedBarcodes);
      return available.barcodeId;
    }
    const num = Math.floor(1000 + Math.random() * 9000);
    const newBarcodeStr = `*M091063${num}*`;
    const newBarcodeObj: AdminBarcodeItem = {
      id: `bc-${Date.now()}`,
      barcodeId: newBarcodeStr,
      status: 'assigned',
      assignedToUserName: userName,
      assignedReservationId: reservationId,
      createdAt: new Date().toISOString().split('T')[0],
    };
    updateAdminBarcodes([...adminBarcodes, newBarcodeObj]);
    return newBarcodeStr;
  };
  */

  // 신규 예약 신청 (단일/다중 슬롯, 결제 수단 지원)
  const handleAddReservations = (
    slots: Array<{ date: string; start: string; end: string }>,
    userName: string,
    userPhone: string,
    paymentMethod: PaymentMethod = 'points',
    roomIdOverride?: string
  ): { success: boolean; createdReservations?: Reservation[]; message?: string } => {
    const targetRoomId = roomIdOverride || selectedRoomId;
    if (!targetRoomId) {
      return { success: false, message: '선택된 공부방이 없습니다.' };
    }

    const totalCost = slots.length * 4000;
    
    // 포인트 결제 시 포인트 잔액 검사
    if (paymentMethod === 'points' && userPoints < totalCost) {
      alert(`보유 포인트가 부족합니다. (필요: ${totalCost.toLocaleString()}P / 보유: ${userPoints.toLocaleString()}P)`);
      return { success: false, message: '보유 포인트가 부족합니다.' };
    }

    const newReservations: Reservation[] = slots.map((slot, index) => {
      const resId = `res-${Date.now()}-${index}`;
      // 유저별 개별 할당 대신 대표 바코드 적용 (단순 모드)
      const assignedBarcode = masterBarcode?.value || '*M091063684*';
      
      return {
        id: resId,
        roomId: targetRoomId,
        date: slot.date,
        startTime: slot.start,
        endTime: slot.end,
        userName,
        userPhone,
        costPoints: 4000,
        costAmount: 4000,
        paymentMethod,
        paymentStatus: paymentMethod === 'points' ? 'paid' : 'deposit_pending',
        barcodeId: assignedBarcode,
        barcodeStatus: 'valid',
      };
    });

    updateReservations([...reservations, ...newReservations]);
    
    if (paymentMethod === 'points') {
      handleUpdatePoints(userPoints - totalCost);
    }

    return { success: true, createdReservations: newReservations };
  };

  // 장기/반복 일괄 예약 추가 (관리자용)
  const handleAddBulkReservations = (newResList: Reservation[]) => {
    updateReservations([...reservations, ...newResList]);
  };

  // 예약 수정 (관리자 전용)
  const handleEditReservation = (
    resId: string,
    updated: { roomId: string; date: string; startTime: string; endTime: string; userName: string; userPhone: string }
  ): { success: boolean; message?: string } => {
    const toMinutes = (t: string) => {
      const [h, m] = t.split(':').map(Number);
      return h * 60 + m;
    };

    const editStartMin = toMinutes(updated.startTime);
    const editEndMin = toMinutes(updated.endTime);

    const conflict = reservations.find((r) => {
      if (r.id === resId) return false;
      if (r.roomId !== updated.roomId || r.date !== updated.date) return false;
      const rStart = toMinutes(r.startTime);
      const rEnd = toMinutes(r.endTime);
      return rStart < editEndMin && rEnd > editStartMin;
    });

    if (conflict) {
      const roomObj = rooms.find(r => r.id === updated.roomId);
      return {
        success: false,
        message: `'${roomObj?.name || '해당 룸'}'의 ${updated.date} ${updated.startTime}~${updated.endTime} 시간대에 이미 예약(${conflict.userName}님)이 존재합니다.`,
      };
    }

    const updatedReservations = reservations.map((r) => {
      if (r.id === resId) {
        return {
          ...r,
          ...updated,
        };
      }
      return r;
    });

    updateReservations(updatedReservations);
    return { success: true };
  };

  // 무통장 입금 상태 변경 (입금대기 <-> 결제완료)
  const handleTogglePaymentStatus = (resId: string) => {
    const updated = reservations.map((r) => {
      if (r.id === resId) {
        const nextStatus: PaymentStatus = r.paymentStatus === 'deposit_pending' ? 'paid' : 'deposit_pending';
        return { ...r, paymentStatus: nextStatus };
      }
      return r;
    });
    updateReservations(updated);
  };

  // 바코드 검증 및 입장 처리
  const handleVerifyBarcode = (barcodeId: string): { success: boolean; message: string; reservation?: Reservation } => {
    const cleanId = barcodeId.trim().toUpperCase();
    const res = reservations.find((r) => 
      r.barcodeId.toUpperCase() === cleanId || 
      r.barcodeId.replace(/\*/g, '').toUpperCase() === cleanId.replace(/\*/g, '') ||
      (masterBarcode.value && masterBarcode.value.replace(/\*/g, '').toUpperCase() === cleanId.replace(/\*/g, ''))
    );

    if (!res) {
      return { success: false, message: '존재하지 않거나 올바르지 않은 바코드 번호입니다.' };
    }

    if (res.barcodeStatus === 'cancelled') {
      return { success: false, message: '취소된 예약의 바코드입니다.' };
    }

    if (res.barcodeStatus === 'used') {
      return { success: false, message: `이미 입장/사용 완료 처리된 바코드입니다. (${res.userName}님)` };
    }

    const updated = reservations.map((r) => {
      if (r.id === res.id) {
        return { ...r, barcodeStatus: 'used' as const };
      }
      return r;
    });

    updateReservations(updated);

    const room = rooms.find((r) => r.id === res.roomId);
    return {
      success: true,
      message: `'${res.userName}'님 입장 확인이 완료되었습니다! [${room?.name || ''} / ${res.date} ${res.startTime}~${res.endTime}]`,
      reservation: { ...res, barcodeStatus: 'used' },
    };
  };

  // 예약 취소 (관리자 전용)
  const handleCancelReservation = (resId: string) => {
    const filteredReservations = reservations.map((r) => {
      if (r.id === resId) {
        return { ...r, barcodeStatus: 'cancelled' as const };
      }
      return r;
    }).filter((r) => r.id !== resId);
    
    updateReservations(filteredReservations);
  };

  // 포인트 가상 충전 처리
  const handleChargePoints = (amount: number) => {
    handleUpdatePoints(userPoints + amount);
    setShowPointModal(false);
    alert(`${amount.toLocaleString()} 포인트가 가상 충전되었습니다!`);
  };

  const selectedRoom = rooms.find((r) => r.id === selectedRoomId);

  // 1. 역할 선택 화면 (게이트 화면)
  if (role === null) {
    return (
      <div className="flex-1 flex flex-col items-center p-6 pb-6 bg-[#ffffff]">
        <div className="w-full flex flex-col items-center" style={{ marginTop: 'auto', marginBottom: 'auto' }}>
          <div className="text-center space-y-3">
            <img 
              src={logoImg} 
              alt="르하임 로고" 
              className="mx-auto"
              style={{ width: '180px', height: 'auto' }}
            />
            <div>
              <h1 className="text-lg font-bold tracking-wide text-[#1c1c1e]">
                여의도점 예약 관리 시스템
              </h1>
            </div>
          </div>

          <div className="w-full space-y-4 mx-auto" style={{ maxWidth: '300px', marginTop: '36px' }}>
            <div 
              onClick={() => setRole('user')}
              className="entrance-card"
            >
              <div className="w-12 h-12 rounded-full bg-[#b09168]/10 flex justify-center items-center text-[#b09168]">
                <User size={24} />
              </div>
              <div className="text-center">
                <h3 className="text-base font-bold text-[#1c1c1e]">이용자 예약하기</h3>
                <p className="text-xs text-[#8e8e93] mt-1">실시간 공부방 스케줄을 확인하고 예약을 진행합니다.</p>
              </div>
            </div>

            <div 
              onClick={() => setRole('admin')}
              className="entrance-card"
            >
              <div className="w-12 h-12 rounded-full bg-[#b09168]/10 flex justify-center items-center text-[#b09168]">
                <Shield size={24} />
              </div>
              <div className="text-center">
                <h3 className="text-base font-bold text-[#1c1c1e]">관리자 시스템</h3>
                <p className="text-xs text-[#8e8e93] mt-1">공부방 생성, 출입 바코드 사진/번호 등록 및 매출을 관리합니다.</p>
              </div>
            </div>
          </div>
        </div>

        <p className="text-[10px] text-[#8e8e93] pt-6 shrink-0">
          © 2026 L'Heux Study Cafe.
        </p>
      </div>
    );
  }

  // 2. 메인 애플리케이션 화면
  return (
    <>
      {/* 헤더 바 */}
      <header className="p-4 bg-[#ffffff] border-b border-[#e5e5ea] flex items-center justify-between z-10 shrink-0">
        <div className="flex items-center gap-2">
          <img 
            src={logoImg} 
            alt="르하임 로고" 
            style={{ height: '36px', width: 'auto' }}
          />
          <div>
            <h1 className="text-sm font-bold tracking-wide text-[#1c1c1e] flex items-center gap-1">
              르하임 <span className="text-[#b09168] text-[9px] font-semibold border border-[#b09168]/30 px-1 rounded">여의도점</span>
            </h1>
            <p className="text-[10px] text-[#8e8e93] flex items-center gap-1">
              {role === 'admin' ? (
                '관리자 통합 콘솔'
              ) : (
                <>
                  <span>TEST1님 반갑습니다.</span>
                  <span className="text-[9px] text-[#b09168] font-bold ml-1 flex items-center gap-0.5 bg-[#b09168]/10 px-1.5 py-0.5 rounded">
                    <Coins size={10} /> {userPoints.toLocaleString()}P
                    <button 
                      onClick={() => setShowPointModal(true)} 
                      className="ml-1 text-[8px] bg-[#b09168] text-[#ffffff] px-1 rounded hover:bg-[#987b54]"
                    >
                      충전
                    </button>
                  </span>
                </>
              )}
            </p>
          </div>
        </div>

        {/* 로그아웃 */}
        <button
          onClick={() => {
            setRole(null);
            setSelectedRoomId(null);
          }}
          className="flex items-center gap-1 text-[11px] font-semibold py-1.5 px-3 rounded-lg border border-[#e5e5ea] text-[#8e8e93] hover:text-[#1c1c1e] hover:bg-[#f8f9fa] transition-all"
          title="로그아웃 / 역할 변경"
        >
          <LogOut size={13} /> 로그아웃
        </button>
      </header>

      {/* 메인 콘텐츠 영역 */}
      <main className="flex-1 flex flex-col overflow-hidden bg-[#ffffff]">
        {role === 'admin' ? (
          <AdminDashboard
            rooms={rooms}
            reservations={reservations}
            bankInfo={bankInfo}
            adminBarcodes={adminBarcodes}
            masterBarcode={masterBarcode}
            onAddRoom={handleAddRoom}
            onDeleteRoom={handleDeleteRoom}
            onCancelReservation={handleCancelReservation}
            onEditReservation={handleEditReservation}
            onAddBulkReservations={handleAddBulkReservations}
            onTogglePaymentStatus={handleTogglePaymentStatus}
            onVerifyBarcode={handleVerifyBarcode}
            onUpdateBankInfo={handleUpdateBankInfo}
            onAddAdminBarcode={handleAddAdminBarcode}
            onDeleteAdminBarcode={handleDeleteAdminBarcode}
            onUpdateReservationBarcode={handleUpdateReservationBarcode}
            onUpdateMasterBarcode={handleUpdateMasterBarcode}
          />
        ) : selectedRoomId && selectedRoom ? (
          <Scheduler
            room={selectedRoom}
            reservations={reservations}
            bankInfo={bankInfo}
            onBack={() => setSelectedRoomId(null)}
            onAddReservations={handleAddReservations}
          />
        ) : (
          <UserDashboard
            rooms={rooms}
            reservations={reservations}
            bankInfo={bankInfo}
            masterBarcode={masterBarcode}
            onSelectRoom={(roomId) => setSelectedRoomId(roomId)}
          />
        )}
      </main>

      {/* 푸터 */}
      <footer className="p-3 bg-[#f8f9fa] border-t border-[#e5e5ea] text-center text-[10px] text-[#8e8e93] shrink-0">
        © 2026 L'Heux Study Cafe. All rights reserved.
      </footer>

      {/* 가상 포인트 충전 모달 */}
      {showPointModal && (
        <div className="modal-overlay" onClick={() => setShowPointModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-base font-bold text-[#1c1c1e] flex items-center gap-1">
                <Coins size={18} className="text-[#b09168]" /> 가상 포인트 충전
              </h3>
              <button onClick={() => setShowPointModal(false)} className="text-[#8e8e93] hover:text-[#1c1c1e] text-xl">&times;</button>
            </div>
            
            <p className="text-xs text-[#8e8e93] mb-4 leading-relaxed">
              원하시는 충전 금액을 선택하시면 즉시 테스트 포인트가 적립됩니다.<br/>
              현재 보유 포인트: <strong className="text-[#b09168]">{userPoints.toLocaleString()}P</strong>
            </p>

            <div className="space-y-3">
              {[10000, 30000, 50000].map((amount) => (
                <button
                  key={amount}
                  onClick={() => handleChargePoints(amount)}
                  className="w-full bg-[#f8f9fa] hover:bg-[#b09168]/10 border border-[#e5e5ea] hover:border-[#b09168]/50 p-4 rounded-xl flex justify-between items-center text-sm font-bold text-[#1c1c1e] transition-all"
                >
                  <span>+{amount.toLocaleString()} P</span>
                  <span className="text-xs text-[#b09168] flex items-center gap-0.5">
                    충전하기 <Plus size={12} />
                  </span>
                </button>
              ))}
            </div>

            <button
              onClick={() => setShowPointModal(false)}
              className="gold-btn-outline w-full py-3 mt-5"
            >
              닫기
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default App;
