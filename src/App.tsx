import { useState, useEffect } from 'react';
import type { Room, Reservation, Role, BankInfo, PaymentMethod, PaymentStatus, AdminBarcodeItem, MasterBarcode, UserAccount } from './types';
import { INITIAL_ROOMS, INITIAL_RESERVATIONS, INITIAL_BANK_INFO, INITIAL_ADMIN_BARCODES, INITIAL_MASTER_BARCODE, INITIAL_USERS } from './utils/mockData';
import { AdminDashboard } from './components/AdminDashboard';
import { UserDashboard } from './components/UserDashboard';
import { Scheduler } from './components/Scheduler';
import { AuthModal } from './components/AuthModal';
import { Shield, LogOut, Coins, Plus, MapPin, Building2, ChevronRight, Check } from 'lucide-react';
import logoImg from './assets/르하임로고.jfif';

function App() {
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [role, setRole] = useState<Role | null>(null);
  
  const [rooms, setRooms] = useState<Room[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [adminBarcodes, setAdminBarcodes] = useState<AdminBarcodeItem[]>([]);
  const [masterBarcode, setMasterBarcode] = useState<MasterBarcode>(INITIAL_MASTER_BARCODE);
  const [bankInfo, setBankInfo] = useState<BankInfo>(INITIAL_BANK_INFO);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  
  // 지점 선택 상태
  const [selectedBranch, setSelectedBranch] = useState<string>('yeouido');

  // 포인트 충전 모달 상태
  const [showPointModal, setShowPointModal] = useState<boolean>(false);

  // 로컬 스토리지 데이터 동기화
  useEffect(() => {
    const savedUsers = localStorage.getItem('lheureux_users');
    const savedCurrentUser = localStorage.getItem('lheureux_current_user');
    const savedRooms = localStorage.getItem('lheureux_rooms');
    const savedReservations = localStorage.getItem('lheureux_reservations');
    const savedAdminBarcodes = localStorage.getItem('lheureux_admin_barcodes');
    const savedMasterBarcode = localStorage.getItem('lheureux_master_barcode');
    const savedBankInfo = localStorage.getItem('lheureux_bank_info');

    if (savedUsers) {
      setUsers(JSON.parse(savedUsers));
    } else {
      setUsers(INITIAL_USERS);
      localStorage.setItem('lheureux_users', JSON.stringify(INITIAL_USERS));
    }

    if (savedCurrentUser) {
      setCurrentUser(JSON.parse(savedCurrentUser));
    }

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

    if (savedBankInfo) {
      setBankInfo(JSON.parse(savedBankInfo));
    } else {
      setBankInfo(INITIAL_BANK_INFO);
      localStorage.setItem('lheureux_bank_info', JSON.stringify(INITIAL_BANK_INFO));
    }
  }, []);

  // 관리자 반응형 레이아웃 토글 (#root 엘리먼트 클래스 조절)
  useEffect(() => {
    const rootEl = document.getElementById('root');
    if (rootEl) {
      if (role === 'admin') {
        rootEl.classList.add('admin-mode');
      } else {
        rootEl.classList.remove('admin-mode');
      }
    }
  }, [role]);

  // 상태 업데이트 및 로컬 스토리지 동기화 헬퍼 함수
  const updateUsers = (newUsers: UserAccount[]) => {
    setUsers(newUsers);
    localStorage.setItem('lheureux_users', JSON.stringify(newUsers));
  };

  const updateCurrentUser = (user: UserAccount | null) => {
    setCurrentUser(user);
    if (user) {
      localStorage.setItem('lheureux_current_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('lheureux_current_user');
      setRole(null);
    }
  };

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
    if (!currentUser) return;
    const updatedUser = { ...currentUser, points: nextPoints };
    updateCurrentUser(updatedUser);
    
    const updatedUsers = users.map(u => u.id === currentUser.id ? updatedUser : u);
    updateUsers(updatedUsers);
  };

  // 신규 회원가입 처리
  const handleRegisterUser = (newUser: Omit<UserAccount, 'id'>): { success: boolean; message?: string } => {
    const exists = users.some(u => u.userId === newUser.userId);
    if (exists) {
      return { success: false, message: '이미 존재하는 아이디입니다.' };
    }

    const createdUser: UserAccount = {
      ...newUser,
      id: `user-${Date.now()}`,
    };

    updateUsers([...users, createdUser]);
    return { success: true };
  };

  // 로그인 성공 처리
  const handleLoginSuccess = (user: UserAccount) => {
    updateCurrentUser(user);
  };

  // 로그아웃
  const handleLogout = () => {
    updateCurrentUser(null);
    setSelectedRoomId(null);
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
    const currentPoints = currentUser?.points || 20000;
    
    // 포인트 결제 시 포인트 잔액 검사
    if (paymentMethod === 'points' && currentPoints < totalCost) {
      alert(`보유 포인트가 부족합니다. (필요: ${totalCost.toLocaleString()}P / 보유: ${currentPoints.toLocaleString()}P)`);
      return { success: false, message: '보유 포인트가 부족합니다.' };
    }

    const newReservations: Reservation[] = slots.map((slot, index) => {
      const resId = `res-${Date.now()}-${index}`;
      const assignedBarcode = masterBarcode?.value || '*M091063684*';
      
      return {
        id: resId,
        roomId: targetRoomId,
        date: slot.date,
        startTime: slot.start,
        endTime: slot.end,
        userName: currentUser?.name || userName,
        userPhone: currentUser?.phone || userPhone,
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
      handleUpdatePoints(currentPoints - totalCost);
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
    const currentPoints = currentUser?.points || 20000;
    handleUpdatePoints(currentPoints + amount);
    setShowPointModal(false);
    alert(`${amount.toLocaleString()} 포인트가 충전되었습니다!`);
  };

  const selectedRoom = rooms.find((r) => r.id === selectedRoomId);

  // 1. 미로그인 상태: 회원가입 / 로그인 화면
  if (!currentUser) {
    return (
      <div className="flex-1 flex items-center justify-center p-4 bg-[#f4f4f7] overflow-y-auto">
        <AuthModal
          onLoginSuccess={handleLoginSuccess}
          onRegisterUser={handleRegisterUser}
          existingUsers={users}
        />
      </div>
    );
  }

  // 2. 로그인 완료 후 진입 게이트 화면 (지점 선택 & 역할 분기)
  if (role === null) {
    return (
      <div className="flex-1 flex flex-col items-center p-6 bg-[#ffffff]">
        {/* 상단 프로필 헤더 */}
        <div className="w-full flex justify-between items-center pb-4 border-b border-[#e5e5ea] shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-[#b09168]/10 text-[#b09168] flex items-center justify-center font-bold text-xs">
              {currentUser.name[0]}
            </div>
            <div>
              <p className="text-xs font-bold text-[#1c1c1e]">{currentUser.name}님 환영합니다</p>
              <p className="text-[10px] text-[#8e8e93]">
                {currentUser.role === 'admin' ? '지점 관리자' : '일반 회원'} ({currentUser.userId})
              </p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="text-[11px] font-semibold px-2.5 py-1 rounded-lg border border-[#e5e5ea] text-[#8e8e93] hover:text-[#ff3b30]"
          >
            로그아웃
          </button>
        </div>

        {/* 메인 비주얼 세션 */}
        <div className="w-full flex flex-col items-center my-auto py-6">
          <div className="text-center space-y-2 mb-6">
            <img 
              src={logoImg} 
              alt="르하임 로고" 
              className="mx-auto"
              style={{ width: '160px', height: 'auto' }}
            />
            <h1 className="text-lg font-extrabold text-[#1c1c1e] tracking-wide pt-1">
              르하임 스터디카페 서비스
            </h1>
            <p className="text-xs text-[#8e8e93]">
              {currentUser.role === 'admin' 
                ? '관리자 전용 멀티 반응형 콘솔에 접속합니다.' 
                : '원하시는 지점을 선택하고 스케줄을 확인하여 예약을 신청하세요.'}
            </p>
          </div>

          {/* 일반 이용자인 경우: 지점 선택 뷰 */}
          {currentUser.role === 'user' ? (
            <div className="w-full max-w-sm space-y-4">
              <div className="space-y-2">
                <label className="block text-xs font-bold text-[#1c1c1e] flex items-center gap-1">
                  <Building2 size={14} className="text-[#b09168]" /> 이용할 스터디카페 지점 선택
                </label>

                {/* 지점 선택 리스트 카드 */}
                <div 
                  onClick={() => setSelectedBranch('yeouido')}
                  className={`p-4 rounded-2xl border cursor-pointer flex justify-between items-center transition-all ${
                    selectedBranch === 'yeouido'
                      ? 'border-[#b09168] bg-[#b09168]/5 shadow-sm'
                      : 'border-[#e5e5ea] hover:border-[#b09168]/50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#b09168]/10 text-[#b09168] flex justify-center items-center font-bold">
                      <MapPin size={20} />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-[#1c1c1e] flex items-center gap-1">
                        르하임 스터디카페 <span className="text-[#b09168]">여의도점</span>
                      </h4>
                      <p className="text-[11px] text-[#8e8e93]">서울특별시 영등포구 여의도동 24번지</p>
                    </div>
                  </div>
                  {selectedBranch === 'yeouido' && (
                    <div className="w-6 h-6 rounded-full bg-[#b09168] text-white flex items-center justify-center">
                      <Check size={14} />
                    </div>
                  )}
                </div>
              </div>

              <button
                onClick={() => setRole('user')}
                className="gold-btn w-full py-3 text-sm font-bold rounded-2xl shadow flex items-center justify-center gap-1"
              >
                <span>지점 선택 후 공부방 예약하기</span>
                <ChevronRight size={18} />
              </button>
            </div>
          ) : (
            /* 관리자인 경우: 관리자 시스템 접속 카드 */
            <div className="w-full max-w-sm space-y-4">
              <div className="border-2 border-[#b09168]/40 bg-[#f8f9fa] rounded-2xl p-5 text-center space-y-2">
                <div className="w-12 h-12 rounded-full bg-[#b09168]/10 text-[#b09168] flex items-center justify-center mx-auto">
                  <Shield size={26} />
                </div>
                <h3 className="text-base font-extrabold text-[#1c1c1e]">지점 관리자 통합 시스템</h3>
                <p className="text-xs text-[#8e8e93] leading-relaxed">
                  모바일 및 태블릿/PC 대형 화면에서 자유롭게 공부방, 예약, 출입 바코드 및 매출을 관제합니다.
                </p>
              </div>

              <button
                onClick={() => setRole('admin')}
                className="gold-btn w-full py-3.5 text-sm font-bold rounded-2xl shadow flex items-center justify-center gap-1.5"
              >
                <Shield size={18} />
                <span>관리자 멀티 반응형 콘솔 접속</span>
              </button>
            </div>
          )}
        </div>

        <p className="text-[10px] text-[#8e8e93] pt-6 shrink-0">
          © 2026 L'Heux Study Cafe. All rights reserved.
        </p>
      </div>
    );
  }

  // 3. 메인 애플리케이션 대시보드 화면
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
                '관리자 멀티 콘솔 (모바일 & 태블릿 지원)'
              ) : (
                <>
                  <span>{currentUser.name}님 반갑습니다.</span>
                  <span className="text-[9px] text-[#b09168] font-bold ml-1 flex items-center gap-0.5 bg-[#b09168]/10 px-1.5 py-0.5 rounded">
                    <Coins size={10} /> {(currentUser.points || 20000).toLocaleString()}P
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

        {/* 로그아웃 및 역할 전환 */}
        <button
          onClick={() => {
            setRole(null);
            setSelectedRoomId(null);
          }}
          className="flex items-center gap-1 text-[11px] font-semibold py-1.5 px-3 rounded-lg border border-[#e5e5ea] text-[#8e8e93] hover:text-[#1c1c1e] hover:bg-[#f8f9fa] transition-all"
          title="처음 게이트 화면으로 이동"
        >
          <LogOut size={13} /> 지점/역할 변경
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
              현재 보유 포인트: <strong className="text-[#b09168]">{(currentUser?.points || 20000).toLocaleString()}P</strong>
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
