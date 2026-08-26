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
import { FA_CREATE_RESERVATIONS } from './atoms/reservation/FA_create_reservations';
import type { AuthContext, RoleCode, RoleGrant } from './atoms/auth/DA_auth';
import { ROLE_SCOPE_LEVEL } from './atoms/auth/CA_auth';
import {
  RA_AUTH_CAN_ACCESS_ADMIN_CONSOLE,
  RA_AUTH_CAN_GRANT_ROLE,
  RA_AUTH_GRANTS_FROM_LEGACY_ROLE,
} from './atoms/auth/RA_auth';
import {
  QA_AUTH_FETCH_ALL_ROLES,
  QA_AUTH_FETCH_USER_ROLES,
} from './atoms/auth/QA_fetch_user_roles';
import { FA_AUTH_GRANT_ROLE, FA_AUTH_REVOKE_ROLE } from './atoms/auth/FA_manage_role';

import {
  supabase,
  fetchDbUsers,
  insertDbUser,
  updateDbUser,
  fetchDbReservations,
  saveDbReservations,
  deleteDbReservationsByRoom,
  fetchDbRooms,
  saveDbRooms,
  deleteDbRoom,
  fetchDbMasterBarcode,
  saveDbMasterBarcode,
  fetchDbAdminBarcodes,
  saveDbAdminBarcodes,
  deleteDbAdminBarcode,
  fetchDbBankInfo,
  saveDbBankInfo,
  fetchDbPointTransactions,
  saveDbPointTransaction,
} from './lib/supabase';
import type { DbResult } from './lib/supabase';

// 르하임 v1 2개 지점 목록 정의 (멀티테넌트 확장 지점)
export interface Branch {
  id: string;
  name: string;
  fullName: string;
  address: string;
  description: string;
  badge: string;
}

export const BRANCHES: Branch[] = [
  {
    id: 'yeouido',
    name: '여의도점',
    fullName: '르하임 스터디카페 여의도점',
    address: '서울특별시 영등포구 여의도동 24번지',
    description: '화이트보드 완비 4인실 & 그룹 스터디 6인실 집중존',
    badge: '1호점 (운영중)',
  },
  {
    id: 'mapo',
    name: '마포점',
    fullName: '르하임 스터디카페 마포점',
    address: '서울특별시 마포구 도화동 18번지',
    description: '대형 빔프로젝터 세미나룸 & 몰입형 프리미엄 스터디존',
    badge: '2호점 (운영중)',
  },
];

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

  // 지점 선택 상태 (기본: 여의도점)
  const [selectedBranch, setSelectedBranch] = useState<string>('yeouido');

  // 포인트 충전 모달 상태
  const [showPointModal, setShowPointModal] = useState<boolean>(false);

  // 권한(user_roles) 상태. 로그인 계정의 활성 권한과 전체 계정의 권한 맵.
  const [authGrants, setAuthGrants] = useState<RoleGrant[]>([]);
  const [allUserGrants, setAllUserGrants] = useState<Record<string, RoleGrant[]>>({});

  /**
   * DB 쓰기를 실행하고 실패를 사용자에게 알린다.
   * 이전에는 결과를 확인하지 않아(fire-and-forget) 저장 실패가 조용히 묻혔고,
   * Realtime 재조회가 화면 값을 옛 DB 값으로 되돌렸다.
   */
  const persist = (label: string, op: () => Promise<DbResult>) => {
    void op().then((res) => {
      if (!res.ok) {
        alert(
          label + '을 서버에 저장하지 못했습니다.\n\n' + res.error + '\n\n' +
            '화면에 보이는 값은 아직 저장되지 않았습니다. 새로고침하면 사라질 수 있습니다.',
        );
      }
    });
  };

  // 권한 로드 effect 의 의존성. currentUser 객체는 포인트 변경마다 새 참조가 되므로
  // 실제로 바뀌었을 때만 재조회하도록 원시값으로 분리한다.
  const currentUserId = currentUser?.id ?? null;
  const currentUserLegacyRole = currentUser?.role ?? null;

  /**
   * 실제 판정에 사용할 권한 목록.
   *
   * user_roles 조회는 비동기이므로 로그인 직후 authGrants 가 잠시 빈 배열이다.
   * 그 사이 예약이 PERMISSION_DENIED 로 거부되는 것을 막기 위해,
   * 조회 결과가 도착하기 전에는 users.role 을 fallback 으로 해석한다.
   *
   * 주의: 이 fallback 은 DB 조회가 실패한 경우에도 적용된다. RLS 적용 후에는
   * 서버가 최종 판정을 하므로 문제가 없지만, 그 전까지는 화면 분기만의 근거다.
   */
  const effectiveGrants: RoleGrant[] =
    authGrants.length > 0
      ? authGrants
      : currentUserId
        ? RA_AUTH_GRANTS_FROM_LEGACY_ROLE(currentUserId, currentUserLegacyRole ?? 'user')
        : [];

  /** 요청자의 권한 컨텍스트. 모든 FA 호출에 전달한다. */
  const authContext: AuthContext = {
    userId: currentUser?.id ?? '',
    grants: effectiveGrants,
  };

  /** 관리 콘솔 접근 가능 여부. users.role 직접 비교를 대체한다. */
  const canAccessAdminConsole = RA_AUTH_CAN_ACCESS_ADMIN_CONSOLE(effectiveGrants);

  /** 요청자가 특정 권한을 부여·회수할 수 있는지. */
  const canManageRole = (roleCode: RoleCode): boolean =>
    RA_AUTH_CAN_GRANT_ROLE(
      authContext,
      roleCode,
      ROLE_SCOPE_LEVEL[roleCode],
      ROLE_SCOPE_LEVEL[roleCode] === 'platform' ? null : selectedBranch,
    );

  /** 권한 변경 후 화면 상태를 DB 기준으로 다시 맞춘다. */
  const refreshRoleGrants = async () => {
    setAllUserGrants(await QA_AUTH_FETCH_ALL_ROLES());
    if (currentUserId) {
      const mine = await QA_AUTH_FETCH_USER_ROLES(currentUserId);
      if (mine.length > 0) setAuthGrants(mine);
    }
  };

  const handleGrantRole = async (targetUserId: string, roleCode: RoleCode) => {
    const scopeType = ROLE_SCOPE_LEVEL[roleCode];
    const result = await FA_AUTH_GRANT_ROLE({
      authContext,
      targetUserId,
      roleCode,
      scopeType,
      scopeId: scopeType === 'platform' ? null : selectedBranch,
    });
    if (result.success) await refreshRoleGrants();
    return { success: result.success, message: result.message };
  };

  const handleRevokeRole = async (grantId: string, targetUserId: string, roleCode: RoleCode) => {
    const scopeType = ROLE_SCOPE_LEVEL[roleCode];
    const result = await FA_AUTH_REVOKE_ROLE({
      authContext,
      grantId,
      targetUserId,
      roleCode,
      scopeType,
      scopeId: scopeType === 'platform' ? null : selectedBranch,
    });
    if (result.success) await refreshRoleGrants();
    return { success: result.success, message: result.message };
  };

  // 로컬 스토리지 & Supabase DB 데이터 로드 및 연동
  useEffect(() => {
    const savedRooms = localStorage.getItem('lheureux_rooms');
    const savedAdminBarcodes = localStorage.getItem('lheureux_admin_barcodes');
    const savedBankInfo = localStorage.getItem('lheureux_bank_info');
    const savedCurrentUser = localStorage.getItem('lheureux_current_user');
    const savedBranch = localStorage.getItem('lheureux_selected_branch');

    if (savedCurrentUser) {
      setCurrentUser(JSON.parse(savedCurrentUser));
    }

    if (savedBranch) {
      setSelectedBranch(savedBranch);
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

      // 5. Rooms 로드 (DB를 SSOT로 사용, 비어 있으면 로컬 캐시 유지)
      const dbRooms = await fetchDbRooms();
      if (dbRooms.length > 0) {
        setRooms(dbRooms);
        localStorage.setItem('lheureux_rooms', JSON.stringify(dbRooms));
      }

      // 6. Admin Barcodes 로드
      const dbBarcodes = await fetchDbAdminBarcodes();
      if (dbBarcodes.length > 0) {
        setAdminBarcodes(dbBarcodes);
        localStorage.setItem('lheureux_admin_barcodes', JSON.stringify(dbBarcodes));
      }

      // 7. Bank Info 로드
      const dbBank = await fetchDbBankInfo();
      if (dbBank) {
        setBankInfo(dbBank);
        localStorage.setItem('lheureux_bank_info', JSON.stringify(dbBank));
      }

      // 8. 전체 계정의 활성 권한 로드 (관리자 회원 목록 표시용)
      setAllUserGrants(await QA_AUTH_FETCH_ALL_ROLES());
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

  // 로그인 계정의 활성 권한 로드.
  // user_roles 에 행이 없는 레거시 계정은 users.role 을 fallback 으로 해석한다.
  // setState 는 async 콜백 안에서만 호출한다 (effect 본문 동기 호출은 연쇄 렌더를 유발).
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!currentUserId) {
        if (!cancelled) setAuthGrants([]);
        return;
      }
      const grants = await QA_AUTH_FETCH_USER_ROLES(currentUserId);
      if (cancelled) return;
      setAuthGrants(
        grants.length > 0
          ? grants
          : RA_AUTH_GRANTS_FROM_LEGACY_ROLE(currentUserId, currentUserLegacyRole ?? 'user'),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [currentUserId, currentUserLegacyRole]);

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
    persist('공간 정보', () => saveDbRooms(newRooms));
  };

  const updateReservations = (newReservations: Reservation[]) => {
    setReservations(newReservations);
    localStorage.setItem('lheureux_reservations', JSON.stringify(newReservations));
    persist('예약 정보', () => saveDbReservations(newReservations));
  };

  const updatePointTransactions = (newTxList: PointTransaction[]) => {
    setPointTransactions(newTxList);
    localStorage.setItem('lheureux_point_tx', JSON.stringify(newTxList));
  };

  const updateAdminBarcodes = (newBarcodes: AdminBarcodeItem[]) => {
    setAdminBarcodes(newBarcodes);
    localStorage.setItem('lheureux_admin_barcodes', JSON.stringify(newBarcodes));
    persist('바코드 정보', () => saveDbAdminBarcodes(newBarcodes));
  };

  const handleUpdateMasterBarcode = (barcode: MasterBarcode) => {
    setMasterBarcode(barcode);
    localStorage.setItem('lheureux_master_barcode', JSON.stringify(barcode));
    persist('대표 바코드', () => saveDbMasterBarcode(barcode));
  };

  const handleUpdateBankInfo = (newInfo: BankInfo) => {
    setBankInfo(newInfo);
    localStorage.setItem('lheureux_bank_info', JSON.stringify(newInfo));
    persist('입금 계좌 정보', () => saveDbBankInfo(newInfo));
  };

  const handleSelectBranch = (branchId: string) => {
    setSelectedBranch(branchId);
    localStorage.setItem('lheureux_selected_branch', branchId);
  };

  const handleUpdatePoints = (nextPoints: number) => {
    if (!currentUser) return;
    const updatedUser = { ...currentUser, points: nextPoints };
    updateCurrentUser(updatedUser);
    
    const updatedUsers = users.map(u => u.id === currentUser.id ? updatedUser : u);
    updateUsers(updatedUsers);
    // 이전에는 DB 저장 호출이 아예 없어 예약 시 차감된 포인트가 저장되지 않았다.
    persist('포인트 잔액', () => updateDbUser(updatedUser));
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
    persist('포인트 충전 신청', () => saveDbPointTransaction(newTx));
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
      persist('회원 정보', () => updateDbUser(updatedUser));

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
    persist('충전 승인 이력', () =>
      saveDbPointTransaction({ ...targetTx, status: 'completed', type: 'charge_approved' }));
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
    persist('회원 정보', () => updateDbUser(updatedUser));

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
    persist('수동 조율 이력', () => saveDbPointTransaction(newTx));
    alert(`'${targetUser.name}' 회원님의 포인트가 ${amount > 0 ? '+' : ''}${amount.toLocaleString()}P 조율되었습니다. (현재 잔액: ${nextPoints.toLocaleString()}P)`);
  };

  // 신규 회원가입 처리.
  // DB 저장 결과를 기다린 뒤 반환한다. 저장이 실패했는데 화면에 "가입 완료"가
  // 뜨는 모순을 막기 위해 persist() 대신 결과를 직접 확인한다.
  const handleRegisterUser = async (
    newUser: Omit<UserAccount, 'id'>,
  ): Promise<{ success: boolean; message?: string }> => {
    // 1. 실시간 DB 최신 회원 목록 조회 및 동기화
    const dbUsers = await fetchDbUsers();
    const currentUsers = dbUsers.length > 0 ? dbUsers : users;

    const exists = currentUsers.some(u => u.userId.toLowerCase() === newUser.userId.trim().toLowerCase());
    if (exists) {
      return { success: false, message: '이미 존재하는 아이디입니다.' };
    }

    // users.id는 UUID 컬럼이다. DB와 로컬이 같은 id를 갖도록 클라이언트에서 발급한다.
    const createdUser: UserAccount = {
      ...newUser,
      userId: newUser.userId.trim(),
      id: crypto.randomUUID(),
    };

    const res = await insertDbUser(createdUser);
    if (!res.ok) {
      // Supabase UNIQUE 제약 조건 위반인 경우
      if (res.error?.includes('duplicate key') || res.error?.includes('users_user_id_uniq')) {
        return { success: false, message: '이미 존재하는 아이디입니다.' };
      }
      return {
        success: false,
        message: '회원 정보를 서버에 저장하지 못했습니다.\n\n' + res.error,
      };
    }

    // DB 저장 성공 시에만 로컬 상태 및 localStorage 갱신
    updateUsers([...currentUsers.filter(u => u.userId !== createdUser.userId), createdUser]);
    return { success: true };
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
        persist('회원 정보', () => updateDbUser(updatedUser));

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
        persist('환불 이력', () => saveDbPointTransaction(refundTx));
      }
    }

    alert('예약 취소 및 결제 포인트 환불 처리가 완료되었습니다.');
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
    const remaining = adminBarcodes.filter(b => b.id !== id);
    setAdminBarcodes(remaining);
    localStorage.setItem('lheureux_admin_barcodes', JSON.stringify(remaining));
    persist('바코드 삭제', () => deleteDbAdminBarcode(id));
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

    setRooms(filteredRooms);
    localStorage.setItem('lheureux_rooms', JSON.stringify(filteredRooms));
    setReservations(filteredReservations);
    localStorage.setItem('lheureux_reservations', JSON.stringify(filteredReservations));

    // upsert만 하면 삭제된 행이 DB에 남아 다음 조회에서 되살아난다.
    // 예약을 먼저 지운 뒤 공간을 지운다 (참조 순서).
    persist('공간 삭제', async () => {
      const removed = await deleteDbReservationsByRoom(roomId);
      if (!removed.ok) return removed;
      return deleteDbRoom(roomId);
    });
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

    const currentPoints = currentUser?.points ?? 0;
    const flowResult = FA_CREATE_RESERVATIONS({
      authContext,
      roomId: targetRoomId,
      slots,
      reservations,
      userName: currentUser?.name || userName,
      userPhone: currentUser?.phone || userPhone,
      paymentMethod,
      availablePoints: currentPoints,
      barcodeId: masterBarcode?.value || '*M091063684*',
    });
    if (!flowResult.success || !flowResult.data) {
      return { success: false, message: flowResult.message };
    }
    const { reservations: newReservations, totalCost } = flowResult.data;

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
        persist('포인트 사용 이력', () => saveDbPointTransaction(useTx));
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
      if (r.barcodeStatus === 'cancelled') return false;
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

  const currentBranchObj = BRANCHES.find((b) => b.id === selectedBranch) || BRANCHES[0];
  const selectedRoom = rooms.find((r) => r.id === selectedRoomId);

  // 1. 미로그인 상태: 회원가입 / 로그인 화면
  if (!currentUser) {
    return (
      <div className="flex-1 flex items-center justify-center p-4 bg-[#eef0f4] overflow-y-auto">
        <AuthModal
          onLoginSuccess={handleLoginSuccess}
          onRegisterUser={handleRegisterUser}
          existingUsers={users}
        />
      </div>
    );
  }

  // 2. 로그인 완료 후 진입 게이트 화면 (2개 지점 선택 & 역할 분기)
  if (role === null) {
    return (
      <div className="flex-1 flex flex-col justify-between p-5 bg-[#ffffff] overflow-y-auto">
        {/* 상단 프로필 헤더 */}
        <div className="w-full flex justify-between items-center pb-4 border-b border-[#e5e8eb] shrink-0">
          <div>
            <p className="text-sm font-bold text-[#191f28]">{currentUser.name}님 환영합니다</p>
            <p className="text-xs text-[#8b95a1]">
              {canAccessAdminConsole ? '관리자' : '일반 회원'} ({currentUser.userId})
            </p>
          </div>

          <button
            onClick={handleLogout}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-[#e5e8eb] text-[#8b95a1] hover:text-[#e93d3d] hover:border-[#e93d3d]/30 transition-colors"
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
              style={{ width: '150px', height: 'auto' }}
            />
            <h1 className="text-lg font-bold text-[#191f28] tracking-tight">
              르하임 스터디카페 플랫폼
            </h1>
            <p className="text-xs text-[#8b95a1]">
              {canAccessAdminConsole
                ? '관리자 전용 대시보드 콘솔에 접속하여 지점 운영 현황을 관리합니다.'
                : '방문하실 지점을 선택하고 실시간 스케줄을 확인하여 예약하세요.'}
            </p>
          </div>

          {/* 일반 이용자인 경우: 2개 지점 선택 뷰 */}
          {!canAccessAdminConsole ? (
            <div className="w-full max-w-sm space-y-4">
              <div className="space-y-2.5">
                <label className="block text-xs font-bold text-[#191f28] flex items-center gap-1">
                  <Building2 size={15} className="text-[#a67c48]" /> 이용하실 지점 선택 (2개 지점 운영 중)
                </label>

                {/* 르하임 2개 지점 카드 목록 */}
                <div className="space-y-2">
                  {BRANCHES.map((branch) => {
                    const isSelected = selectedBranch === branch.id;
                    return (
                      <div
                        key={branch.id}
                        onClick={() => handleSelectBranch(branch.id)}
                        className={`p-3.5 rounded-2xl border cursor-pointer flex justify-between items-center transition-all ${
                          isSelected
                            ? 'border-[#a67c48] bg-[#a67c48]/5 shadow-sm ring-1 ring-[#a67c48]'
                            : 'border-[#e5e8eb] bg-[#f8f9fc] hover:border-[#a67c48]/50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl flex justify-center items-center font-bold ${
                            isSelected ? 'bg-[#a67c48] text-white' : 'bg-[#a67c48]/10 text-[#a67c48]'
                          }`}>
                            <MapPin size={20} />
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <h4 className="text-sm font-bold text-[#191f28]">
                                {branch.fullName}
                              </h4>
                              <span className="text-[11px] font-semibold text-[#a67c48] bg-[#a67c48]/10 px-1.5 py-0.5 rounded">
                                {branch.badge}
                              </span>
                            </div>
                            <p className="text-xs text-[#8b95a1] pt-0.5">{branch.address}</p>
                          </div>
                        </div>
                        {isSelected && (
                          <div className="w-6 h-6 rounded-full bg-[#a67c48] text-white flex items-center justify-center shrink-0">
                            <Check size={14} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <button
                onClick={() => setRole('user')}
                className="gold-btn w-full py-3.5 text-sm font-bold rounded-2xl shadow flex items-center justify-center gap-1.5 mt-2"
              >
                <span>{currentBranchObj.name} 공부방 예약하기</span>
                <ChevronRight size={18} />
              </button>
            </div>
          ) : (
            /* 관리자인 경우: 관리자 전용 보안 접속 카드 */
            <div className="w-full max-w-sm space-y-4">
              <div className="border border-[#a67c48]/30 bg-[#f8f9fc] rounded-2xl p-5 text-center space-y-2.5">
                <div className="w-12 h-12 rounded-full bg-[#a67c48]/10 text-[#a67c48] flex items-center justify-center mx-auto">
                  <Shield size={26} />
                </div>
                <h3 className="text-base font-bold text-[#191f28]">최고 관리자 통합 관제 콘솔</h3>
                <p className="text-xs text-[#8b95a1] leading-relaxed">
                  보안 로그인 후 대형 화면에서 공부방, 예약, 무통장 승인, 포인트 환불 및 매출 분석을 통합 관제합니다.
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

        <p className="text-xs text-[#8b95a1] text-center pt-4 shrink-0">
          © 2026 HA-STUDY Platform. L'Heux Study Cafe.
        </p>

        {/* 최고 관리자 보안 로그인 모달 */}
        {showAdminAuthModal && (
          <AdminAuthModal
            adminUser={currentUser}
            isAuthorized={canAccessAdminConsole}
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
      <header className="p-4 bg-[#ffffff] border-b border-[#e5e8eb] flex items-center justify-between z-10 shrink-0">
        <div className="flex items-center gap-2.5">
          <img 
            src={logoImg} 
            alt="르하임 로고" 
            style={{ height: '36px', width: 'auto' }}
          />
          <div>
            <h1 className="text-sm font-bold text-[#191f28] flex items-center gap-1.5">
              르하임 <span className="text-[#a67c48] text-xs font-semibold bg-[#a67c48]/10 border border-[#a67c48]/20 px-1.5 py-0.5 rounded">{currentBranchObj.name}</span>
            </h1>
            <div className="text-xs text-[#8b95a1] flex items-center gap-1.5 pt-0.5">
              {role === 'admin' ? (
                <span className="text-[#a67c48] font-semibold">최고 관리자 통합 콘솔</span>
              ) : (
                <>
                  <span>{currentUser.name}님</span>
                  <span className="text-xs text-[#a67c48] font-bold flex items-center gap-1 bg-[#a67c48]/10 px-2 py-0.5 rounded-full">
                    <Coins size={12} /> {(currentUser.points || 0).toLocaleString()}P
                    <button 
                      onClick={() => setShowPointModal(true)} 
                      className="ml-1 text-xs bg-[#a67c48] text-[#ffffff] px-1.5 py-0.2 rounded hover:bg-[#8f6735] transition-colors"
                    >
                      충전
                    </button>
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* 로그아웃 및 역할/지점 전환 */}
        <button
          onClick={() => {
            setRole(null);
            setSelectedRoomId(null);
          }}
          className="flex items-center gap-1 text-xs font-semibold py-2 px-3 rounded-lg border border-[#e5e8eb] text-[#8b95a1] hover:text-[#191f28] hover:bg-[#f8f9fc] transition-all"
          title="처음 게이트 화면으로 이동"
        >
          <LogOut size={14} /> 지점/역할 변경
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
            userGrants={allUserGrants}
            canManageRole={canManageRole}
            onGrantRole={handleGrantRole}
            onRevokeRole={handleRevokeRole}
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
            onCancelAndRefundReservation={handleCancelAndRefundReservation}
          />
        )}
      </main>

      {/* 푸터 */}
      <footer className="py-2.5 px-4 bg-[#f8f9fc] border-t border-[#e5e8eb] text-center text-xs text-[#8b95a1] shrink-0">
        © 2026 HA-STUDY Platform. L'Heux Study Cafe.
      </footer>

      {/* 무통장 입금 포인트 충전 모달 */}
      {showPointModal && (
        <div className="modal-overlay" onClick={() => setShowPointModal(false)}>
          <div className="modal-content max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-bold text-[#191f28] flex items-center gap-1.5">
                <Coins size={20} className="text-[#a67c48]" /> 무통장 입금 포인트 충전
              </h3>
              <button onClick={() => setShowPointModal(false)} className="text-[#8b95a1] hover:text-[#191f28] text-2xl">&times;</button>
            </div>
            
            <div className="bg-[#a67c48]/10 border border-[#a67c48]/30 p-4 rounded-xl text-xs space-y-1.5 mb-4">
              <p className="font-bold text-[#a67c48] text-sm">입금 계좌 안내</p>
              <p className="text-[#191f28]">은행명: <strong>{bankInfo.bankName}</strong></p>
              <p className="text-[#191f28]">계좌번호: <strong className="font-mono text-[#a67c48] text-sm">{bankInfo.accountNumber}</strong></p>
              <p className="text-[#191f28]">예금주: <strong>{bankInfo.accountHolder}</strong></p>
              <p className="text-xs text-[#8b95a1] pt-1">
                * 충전 금액 선택 후 계좌로 입금해 주시면 관리자 확인 즉시 포인트가 적립됩니다.
              </p>
            </div>

            <div className="space-y-2.5">
              <p className="text-xs font-bold text-[#191f28]">충전할 포인트 금액 선택</p>
              {[10000, 30000, 50000, 100000].map((amount) => (
                <button
                  key={amount}
                  onClick={() => handleApplyPointCharge(amount)}
                  className="w-full bg-[#f8f9fc] hover:bg-[#a67c48]/10 border border-[#e5e8eb] hover:border-[#a67c48]/50 p-3.5 rounded-xl flex justify-between items-center text-sm font-bold text-[#191f28] transition-all"
                >
                  <span>+{amount.toLocaleString()} P</span>
                  <span className="text-xs text-[#a67c48] flex items-center gap-1 font-semibold">
                    충전 신청 <Plus size={14} />
                  </span>
                </button>
              ))}
            </div>

            <button
              onClick={() => setShowPointModal(false)}
              className="gold-btn-outline w-full py-3 mt-4 text-xs font-bold rounded-xl"
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
