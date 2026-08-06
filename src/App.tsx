import { useState, useEffect } from 'react';
import type { Room, Reservation, Role, BankInfo, PaymentMethod, PaymentStatus, AdminBarcodeItem, MasterBarcode, UserAccount, PointTransaction } from './types';
import { INITIAL_ROOMS, INITIAL_RESERVATIONS, INITIAL_BANK_INFO, INITIAL_ADMIN_BARCODES, INITIAL_MASTER_BARCODE, INITIAL_USERS } from './utils/mockData';
import { AdminDashboard } from './components/AdminDashboard';
import { UserDashboard } from './components/UserDashboard';
import { Scheduler } from './components/Scheduler';
import { AuthModal } from './components/AuthModal';
import { AdminAuthModal } from './components/AdminAuthModal';
import { Shield, LogOut, Coins, Plus, MapPin, Building2, ChevronRight, Check } from 'lucide-react';
import logoImg from './assets/르하임로고.jfif';

import { 
  supabase, 
  fetchDbUsers, 
  saveDbUser, 
  fetchDbReservations, 
  saveDbReservations, 
  fetchDbMasterBarcode, 
  saveDbMasterBarcode,
  fetchDbPointTransactions,
  saveDbPointTransaction
} from './lib/supabase';

function App() {
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [role, setRole] = useState<Role | null>(null);
  
  const [rooms, setRooms] = useState<Room[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [adminBarcodes, setAdminBarcodes] = useState<AdminBarcodeItem[]>([]);
  const [masterBarcode, setMasterBarcode] = useState<MasterBarcode>(INITIAL_MASTER_BARCODE);
  const [pointTransactions, setPointTransactions] = useState<PointTransaction[]>([]);
  const [bankInfo, setBankInfo] = useState<BankInfo>(INITIAL_BANK_INFO);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  
  // 관리자 전용 인증 모달 상태
  const [showAdminAuthModal, setShowAdminAuthModal] = useState<boolean>(false);

  // 지점 선택 상태
  const [selectedBranch, setSelectedBranch] = useState<string>('yeouido');

  // 포인트 충전 모달 상태
  const [showPointModal, setShowPointModal] = useState<boolean>(false);

  // 로컬 스토리지 & Supabase DB 데이터 로드 및 연동
  useEffect(() => {
    const savedRooms = localStorage.getItem('lheureux_rooms');
    const savedAdminBarcodes = localStorage.getItem('lheureux_admin_barcodes');
    const savedBankInfo = localStorage.getItem('lheureux_bank_info');
    const savedCurrentUser = localStorage.getItem('lheureux_current_user');

    if (savedCurrentUser) {
      setCurrentUser(JSON.parse(savedCurrentUser));
    }

    if (savedRooms) {
      setRooms(JSON.parse(savedRooms));
    } else {
      setRooms(INITIAL_ROOMS);
      localStorage.setItem('lheureux_rooms', JSON.stringify(INITIAL_ROOMS));
    }

    if (savedAdminBarcodes) {
      setAdminBarcodes(JSON.parse(savedAdminBarcodes));
    } else {
      setAdminBarcodes(INITIAL_ADMIN_BARCODES);
      localStorage.setItem('lheureux_admin_barcodes', JSON.stringify(INITIAL_ADMIN_BARCODES));
    }

    if (savedBankInfo) {
      setBankInfo(JSON.parse(savedBankInfo));
    } else {
      setBankInfo(INITIAL_BANK_INFO);
      localStorage.setItem('lheureux_bank_info', JSON.stringify(INITIAL_BANK_INFO));
    }

    // 🌐 Supabase 실제 DB 데이터 비동기 연동
    const loadSupabaseData = async () => {
      // 1. Users 로드
      const dbUsers = await fetchDbUsers();
      if (dbUsers.length > 0) {
        setUsers(dbUsers);
        localStorage.setItem('lheureux_users', JSON.stringify(dbUsers));
      } else {
        const savedUsers = localStorage.getItem('lheureux_users');
        setUsers(savedUsers ? JSON.parse(savedUsers) : INITIAL_USERS);
      }

      // 2. Reservations 로드
      const dbRes = await fetchDbReservations();
      if (dbRes.length > 0) {
        setReservations(dbRes);
        localStorage.setItem('lheureux_reservations', JSON.stringify(dbRes));
      } else {
        const savedRes = localStorage.getItem('lheureux_reservations');
        setReservations(savedRes ? JSON.parse(savedRes) : INITIAL_RESERVATIONS);
      }

      // 3. Master Barcode 로드
      const dbMaster = await fetchDbMasterBarcode();
      if (dbMaster) {
        setMasterBarcode(dbMaster);
        localStorage.setItem('lheureux_master_barcode', JSON.stringify(dbMaster));
      } else {
        const savedMaster = localStorage.getItem('lheureux_master_barcode');
        setMasterBarcode(savedMaster ? JSON.parse(savedMaster) : INITIAL_MASTER_BARCODE);
      }

      // 4. Point Transactions 로드
      const dbTx = await fetchDbPointTransactions();
      if (dbTx.length > 0) {
        setPointTransactions(dbTx);
        localStorage.setItem('lheureux_point_tx', JSON.stringify(dbTx));
      } else {
        const savedTx = localStorage.getItem('lheureux_point_tx');
        if (savedTx) setPointTransactions(JSON.parse(savedTx));
      }
    };

    loadSupabaseData();

    // ⚡ Supabase Realtime (실시간 리스너) 구독 설정
    const channel = supabase
      .channel('schema-db-changes')
      .on('postgres_changes', { event: '*', schema: 'public' }, () => {
        loadSupabaseData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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

  // 상태 업데이트 및 DB/로컬 스토리지 동기화 헬퍼 함수
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
    saveDbReservations(newReservations); // Supabase DB 동기화
  };

  const updatePointTransactions = (newTxList: PointTransaction[]) => {
    setPointTransactions(newTxList);
    localStorage.setItem('lheureux_point_tx', JSON.stringify(newTxList));
  };

  const updateAdminBarcodes = (newBarcodes: AdminBarcodeItem[]) => {
    setAdminBarcodes(newBarcodes);
    localStorage.setItem('lheureux_admin_barcodes', JSON.stringify(newBarcodes));
  };

  const handleUpdateMasterBarcode = (barcode: MasterBarcode) => {
    setMasterBarcode(barcode);
    localStorage.setItem('lheureux_master_barcode', JSON.stringify(barcode));
    saveDbMasterBarcode(barcode); // Supabase DB 동기화
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

  // 무통장 입금 포인트 충전 신청 처리 (이용자용)
  const handleApplyPointCharge = (amount: number) => {
    if (!currentUser) return;
    const newTx: PointTransaction = {
      id: `tx-${Date.now()}`,
      userId: currentUser.userId,
      userName: currentUser.name,
      type: 'charge_request',
      amount,
      description: `무통장 입금 포인트 충전 신청 (${amount.toLocaleString()}원)`,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    const updatedTx = [newTx, ...pointTransactions];
    updatePointTransactions(updatedTx);
    saveDbPointTransaction(newTx);
    setShowPointModal(false);
    alert(`무통장 입금 충전 신청이 완료되었습니다.\n입금계좌: ${bankInfo.bankName} ${bankInfo.accountNumber} (${bankInfo.accountHolder})\n관리자 입금 확인 후 포인트가 즉시 지급됩니다.`);
  };

  // 관리자 포인트 무통장 입금 확인 승인 처리
  const handleApprovePointCharge = (txId: string) => {
    const targetTx = pointTransactions.find(t => t.id === txId);
    if (!targetTx) return;

    // 1. 해당 유저 포인트 증액
    const targetUser = users.find(u => u.userId === targetTx.userId);
    if (targetUser) {
      const updatedUser = { ...targetUser, points: (targetUser.points || 0) + targetTx.amount };
      const updatedUsers = users.map(u => u.id === targetUser.id ? updatedUser : u);
      updateUsers(updatedUsers);
      saveDbUser(updatedUser);

      // 현재 로그인 유저라면 즉시 세션 반영
      if (currentUser?.id === targetUser.id) {
        setCurrentUser(updatedUser);
      }
    }

    // 2. 트랜잭션 상태 completed 변경
    const updatedTxList = pointTransactions.map(t => {
      if (t.id === txId) {
        return { ...t, status: 'completed' as const, type: 'charge_approved' as const };
      }
      return t;
    });

    updatePointTransactions(updatedTxList);
    saveDbPointTransaction({ ...targetTx, status: 'completed', type: 'charge_approved' });
    alert(`'${targetTx.userName}' 회원님의 ${targetTx.amount.toLocaleString()}P 입금 승인 및 포인트 적립이 완료되었습니다!`);
  };

  // 관리자 회원 포인트 수동 지급 / 차감 조율
  const handleManualAdjustPoint = (userId: string, amount: number, reason: string) => {
    const targetUser = users.find(u => u.id === userId);
    if (!targetUser) return;

    const nextPoints = Math.max(0, (targetUser.points || 0) + amount);
    const updatedUser = { ...targetUser, points: nextPoints };
    const updatedUsers = users.map(u => u.id === userId ? updatedUser : u);
    updateUsers(updatedUsers);
    saveDbUser(updatedUser);

    if (currentUser?.id === targetUser.id) {
      setCurrentUser(updatedUser);
    }

    // 히스토리 트랜잭션 기록
    const newTx: PointTransaction = {
      id: `tx-manual-${Date.now()}`,
      userId: targetUser.userId,
      userName: targetUser.name,
      type: amount > 0 ? 'charge_approved' : 'use',
      amount: Math.abs(amount),
      description: `[관리자 수동 조율] ${reason}`,
      status: 'completed',
      createdAt: new Date().toISOString(),
    };

    updatePointTransactions([newTx, ...pointTransactions]);
    saveDbPointTransaction(newTx);
    alert(`'${targetUser.name}' 회원님의 포인트가 ${amount > 0 ? '+' : ''}${amount.toLocaleString()}P 조율되었습니다. (현재 잔액: ${nextPoints.toLocaleString()}P)`);
  };

  // 예약 취소 및 포인트 자동 환불
  const handleCancelAndRefundReservation = (resId: string) => {
    const targetRes = reservations.find(r => r.id === resId);
    if (!targetRes) return;

    // 1. 예약 상태 취소 변경
    const updatedRes = reservations.map(r => r.id === resId ? { ...r, barcodeStatus: 'cancelled' as const } : r);
    updateReservations(updatedRes);

    // 2. 포인트 결제 건이었다면 포인트 자동 환불
    if (targetRes.paymentMethod === 'points') {
      const refundAmount = targetRes.costPoints || 4000;
      const targetUser = users.find(u => u.phone === targetRes.userPhone || u.name === targetRes.userName) || currentUser;
      
      if (targetUser) {
        const nextPoints = (targetUser.points || 0) + refundAmount;
        const updatedUser = { ...targetUser, points: nextPoints };
        const updatedUsers = users.map(u => u.id === targetUser.id ? updatedUser : u);
        updateUsers(updatedUsers);
        saveDbUser(updatedUser);

        if (currentUser?.id === targetUser.id) {
          setCurrentUser(updatedUser);
        }

        // 환불 트랜잭션 저장
        const refundTx: PointTransaction = {
          id: `tx-refund-${Date.now()}`,
          userId: targetUser.userId,
          userName: targetUser.name,
          type: 'refund',
          amount: refundAmount,
          description: `예약 취소에 따른 포인트 자동 환불 (${targetRes.date} ${targetRes.startTime})`,
          status: 'completed',
          createdAt: new Date().toISOString(),
        };

        updatePointTransactions([refundTx, ...pointTransactions]);
        saveDbPointTransaction(refundTx);
      }
    }

    alert('예약 취소 및 결제 포인트 환불 처리가 완료되었습니다.');
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
    saveDbUser(newUser); // Supabase DB에 회원 저장
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
    
    // 포인트 결제 시 사용 트랜잭션 기록
    if (paymentMethod === 'points') {
      handleUpdatePoints(currentPoints - totalCost);

      if (currentUser) {
        const useTx: PointTransaction = {
          id: `tx-use-${Date.now()}`,
          userId: currentUser.userId,
          userName: currentUser.name,
          type: 'use',
          amount: totalCost,
          description: `공부방 예약 포인트 차감 (${slots.length}개 슬롯)`,
          status: 'completed',
          createdAt: new Date().toISOString(),
        };

        updatePointTransactions([useTx, ...pointTransactions]);
        saveDbPointTransaction(useTx);
      }
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
    handleCancelAndRefundReservation(resId);
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
            /* 관리자인 경우: 관리자 전용 보안 접속 카드 */
            <div className="w-full max-w-sm space-y-4">
              <div className="border-2 border-[#b09168]/40 bg-[#f8f9fa] rounded-2xl p-5 text-center space-y-2">
                <div className="w-12 h-12 rounded-full bg-[#b09168]/10 text-[#b09168] flex items-center justify-center mx-auto">
                  <Shield size={26} />
                </div>
                <h3 className="text-base font-extrabold text-[#1c1c1e]">최고 관리자 통합 전용 콘솔</h3>
                <p className="text-xs text-[#8e8e93] leading-relaxed">
                  보안 로그인 후 대형 화면에서 공부방, 예약, 무통장 승인, 포인트 환불 및 매출을 관제합니다.
                </p>
              </div>

              <button
                onClick={() => setShowAdminAuthModal(true)}
                className="gold-btn w-full py-3.5 text-sm font-bold rounded-2xl shadow flex items-center justify-center gap-1.5"
              >
                <Shield size={18} />
                <span>최고 관리자 보안 인증 후 접속</span>
              </button>
            </div>
          )}
        </div>

        <p className="text-[10px] text-[#8e8e93] pt-6 shrink-0">
          © 2026 L'Heux Study Cafe. All rights reserved.
        </p>

        {/* 최고 관리자 보안 로그인 모달 */}
        {showAdminAuthModal && (
          <AdminAuthModal
            onSuccess={() => {
              setShowAdminAuthModal(false);
              setRole('admin');
            }}
            onCancel={() => setShowAdminAuthModal(false)}
          />
        )}
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
                '최고 관리자 전용 콘솔 (모바일 & 태블릿 지원)'
              ) : (
                <>
                  <span>{currentUser.name}님 반갑습니다.</span>
                  <span className="text-[9px] text-[#b09168] font-bold ml-1 flex items-center gap-0.5 bg-[#b09168]/10 px-1.5 py-0.5 rounded">
                    <Coins size={10} /> {(currentUser.points || 0).toLocaleString()}P
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
            users={users}
            pointTransactions={pointTransactions}
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
            onApprovePointCharge={handleApprovePointCharge}
            onManualAdjustPoint={handleManualAdjustPoint}
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
            pointTransactions={pointTransactions}
            onSelectRoom={(roomId) => setSelectedRoomId(roomId)}
            onApplyPointCharge={handleApplyPointCharge}
            onCancelAndRefundReservation={handleCancelAndRefundReservation}
          />
        )}
      </main>

      {/* 푸터 */}
      <footer className="p-3 bg-[#f8f9fa] border-t border-[#e5e5ea] text-center text-[10px] text-[#8e8e93] shrink-0">
        © 2026 L'Heux Study Cafe. All rights reserved.
      </footer>

      {/* 무통장 입금 포인트 충전 모달 */}
      {showPointModal && (
        <div className="modal-overlay" onClick={() => setShowPointModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-bold text-[#1c1c1e] flex items-center gap-1">
                <Coins size={18} className="text-[#b09168]" /> 무통장 입금 포인트 충전 신청
              </h3>
              <button onClick={() => setShowPointModal(false)} className="text-[#8e8e93] hover:text-[#1c1c1e] text-xl">&times;</button>
            </div>
            
            <div className="bg-[#b09168]/10 border border-[#b09168]/30 p-3.5 rounded-xl text-xs space-y-1.5 mb-4">
              <p className="font-bold text-[#b09168]">입금 계좌 안내</p>
              <p className="text-[#1c1c1e] font-mono">은행: <strong>{bankInfo.bankName}</strong></p>
              <p className="text-[#1c1c1e] font-mono">계좌번호: <strong>{bankInfo.accountNumber}</strong></p>
              <p className="text-[#1c1c1e]">예금주: <strong>{bankInfo.accountHolder}</strong></p>
              <p className="text-[10px] text-[#8e8e93] pt-1">
                * 입금 신청 후 계좌로 입금해 주시면 관리자 확인 후 포인트가 즉시 지급됩니다.
              </p>
            </div>

            <div className="space-y-3">
              <p className="text-xs font-bold text-[#1c1c1e]">충전할 포인트 금액 선택</p>
              {[10000, 30000, 50000, 100000].map((amount) => (
                <button
                  key={amount}
                  onClick={() => handleApplyPointCharge(amount)}
                  className="w-full bg-[#f8f9fa] hover:bg-[#b09168]/10 border border-[#e5e5ea] hover:border-[#b09168]/50 p-3.5 rounded-xl flex justify-between items-center text-xs font-bold text-[#1c1c1e] transition-all"
                >
                  <span>+{amount.toLocaleString()} P</span>
                  <span className="text-[11px] text-[#b09168] flex items-center gap-0.5">
                    입금 신청하기 <Plus size={12} />
                  </span>
                </button>
              ))}
            </div>

            <button
              onClick={() => setShowPointModal(false)}
              className="gold-btn-outline w-full py-2.5 mt-4 text-xs font-bold rounded-xl"
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
