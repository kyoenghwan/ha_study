import { createClient } from '@supabase/supabase-js';
import type {
  UserAccount,
  Reservation,
  MasterBarcode,
  PointTransaction,
  Room,
  AdminBarcodeItem,
  BankInfo,
} from '../types';

const DEFAULT_SUPABASE_URL = 'https://aonpiwzphpngucrtrnmq.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFvbnBpd3pwaHBuZ3VjcnRybm1xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU5MzM2NTksImV4cCI6MjEwMTUwOTY1OX0.A2W5VENnUQL6GDROVzNtK3orR6OX8GupKRTfts4e4PI';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * 쓰기 작업의 결과. 실패를 조용히 넘기지 않기 위해 항상 이 형태로 반환한다.
 * 호출부는 ok === false 를 반드시 사용자에게 알려야 한다.
 */
export type DbResult =
  | { ok: true; error?: undefined }
  | { ok: false; error: string };

const ok = (): DbResult => ({ ok: true });

const fail = (context: string, error: unknown): DbResult => {
  const message =
    typeof error === 'object' && error !== null && 'message' in error
      ? String((error as { message: unknown }).message)
      : String(error);
  console.error(`[DB] ${context} 실패:`, error);
  return { ok: false, error: message };
};

// ─────────────────────────────────────────────────────────────
// 1. users — 회원
// ─────────────────────────────────────────────────────────────

/** DB 행 -> 앱 모델 변환용. 컬럼이 추가되면 여기만 수정한다. */
interface UserRow {
  id: string;
  user_id: string;
  password: string | null;
  name: string;
  phone: string;
  role: UserAccount['role'];
  points: number | null;
}

export const fetchDbUsers = async (): Promise<UserAccount[]> => {
  try {
    const { data, error } = await supabase.from('users').select('*');
    if (error || !data) return [];
    return (data as UserRow[]).map((u) => ({
      id: u.id,
      userId: u.user_id,
      password: u.password ?? undefined,
      name: u.name,
      phone: u.phone,
      role: u.role,
      points: u.points ?? 0,
    }));
  } catch (err) {
    console.warn('[DB] users 조회 실패, 로컬 캐시로 대체합니다:', err);
    return [];
  }
};

/**
 * 신규 회원 등록. id는 호출부가 crypto.randomUUID()로 발급한 값을 그대로 쓴다.
 * DB가 별도 id를 발급하면 로컬 상태와 어긋나기 때문이다.
 */
export const insertDbUser = async (user: UserAccount): Promise<DbResult> => {
  try {
    const { error } = await supabase.from('users').insert({
      id: user.id,
      user_id: user.userId,
      password: user.password,
      name: user.name,
      phone: user.phone,
      role: user.role,
      points: user.points,
    });
    return error ? fail('회원 등록', error) : ok();
  } catch (err) {
    return fail('회원 등록', err);
  }
};

/**
 * 기존 회원 정보 갱신. user_id가 UNIQUE이므로 이를 기준으로 UPDATE 한다.
 * 이전 구현은 insert를 사용해 유니크 위반으로 항상 실패했고,
 * 그 결과 포인트 변경이 DB에 저장되지 않았다.
 */
export const updateDbUser = async (user: UserAccount): Promise<DbResult> => {
  try {
    const { error } = await supabase
      .from('users')
      .update({
        name: user.name,
        phone: user.phone,
        role: user.role,
        points: user.points,
        ...(user.password ? { password: user.password } : {}),
      })
      .eq('user_id', user.userId);
    return error ? fail('회원 정보 갱신', error) : ok();
  } catch (err) {
    return fail('회원 정보 갱신', err);
  }
};

// ─────────────────────────────────────────────────────────────
// 2. rooms — 공간
// ─────────────────────────────────────────────────────────────

interface RoomRow {
  id: string;
  name: string;
  capacity: number | null;
  description: string | null;
}

export const fetchDbRooms = async (): Promise<Room[]> => {
  try {
    const { data, error } = await supabase.from('rooms').select('*').order('id');
    if (error || !data) return [];
    return (data as RoomRow[]).map((r) => ({
      id: r.id,
      name: r.name,
      capacity: r.capacity ?? 1,
      description: r.description ?? '',
    }));
  } catch (err) {
    console.warn('[DB] rooms 조회 실패, 로컬 캐시로 대체합니다:', err);
    return [];
  }
};

export const saveDbRooms = async (rooms: Room[]): Promise<DbResult> => {
  if (rooms.length === 0) return ok();
  try {
    const { error } = await supabase.from('rooms').upsert(
      rooms.map((r) => ({
        id: r.id,
        name: r.name,
        capacity: r.capacity,
        description: r.description,
      })),
    );
    return error ? fail('공간 저장', error) : ok();
  } catch (err) {
    return fail('공간 저장', err);
  }
};

export const deleteDbRoom = async (roomId: string): Promise<DbResult> => {
  try {
    const { error } = await supabase.from('rooms').delete().eq('id', roomId);
    return error ? fail('공간 삭제', error) : ok();
  } catch (err) {
    return fail('공간 삭제', err);
  }
};

// ─────────────────────────────────────────────────────────────
// 3. reservations — 예약
// ─────────────────────────────────────────────────────────────

interface ReservationRow {
  id: string;
  room_id: string;
  date: string;
  start_time: string;
  end_time: string;
  user_name: string;
  user_phone: string;
  cost_points: number | null;
  cost_amount: number | null;
  payment_method: Reservation['paymentMethod'];
  payment_status: Reservation['paymentStatus'];
  barcode_id: string;
  barcode_status: Reservation['barcodeStatus'];
  is_long_term: boolean | null;
}

export const fetchDbReservations = async (): Promise<Reservation[]> => {
  try {
    const { data, error } = await supabase
      .from('reservations')
      .select('*')
      .order('created_at', { ascending: false });
    if (error || !data) return [];
    return (data as ReservationRow[]).map((r) => ({
      id: r.id,
      roomId: r.room_id,
      date: r.date,
      startTime: r.start_time,
      endTime: r.end_time,
      userName: r.user_name,
      userPhone: r.user_phone,
      costPoints: r.cost_points ?? undefined,
      costAmount: r.cost_amount ?? undefined,
      paymentMethod: r.payment_method,
      paymentStatus: r.payment_status,
      barcodeId: r.barcode_id,
      barcodeStatus: r.barcode_status,
      isLongTerm: r.is_long_term ?? false,
    }));
  } catch (err) {
    console.warn('[DB] reservations 조회 실패:', err);
    return [];
  }
};

export const saveDbReservations = async (list: Reservation[]): Promise<DbResult> => {
  if (list.length === 0) return ok();
  try {
    const { error } = await supabase.from('reservations').upsert(
      list.map((r) => ({
        id: r.id,
        room_id: r.roomId,
        date: r.date,
        start_time: r.startTime,
        end_time: r.endTime,
        user_name: r.userName,
        user_phone: r.userPhone,
        cost_points: r.costPoints ?? 0,
        cost_amount: r.costAmount ?? 0,
        payment_method: r.paymentMethod || 'points',
        payment_status: r.paymentStatus || 'paid',
        barcode_id: r.barcodeId,
        barcode_status: r.barcodeStatus,
        is_long_term: r.isLongTerm ?? false,
      })),
    );
    return error ? fail('예약 저장', error) : ok();
  } catch (err) {
    return fail('예약 저장', err);
  }
};

/**
 * 공간 삭제 시 해당 공간의 예약도 DB에서 제거한다.
 * 이전에는 upsert만 했기 때문에 삭제한 예약이 다음 조회에서 되살아났다.
 */
export const deleteDbReservationsByRoom = async (roomId: string): Promise<DbResult> => {
  try {
    const { error } = await supabase.from('reservations').delete().eq('room_id', roomId);
    return error ? fail('공간 예약 삭제', error) : ok();
  } catch (err) {
    return fail('공간 예약 삭제', err);
  }
};

// ─────────────────────────────────────────────────────────────
// 4. master_barcodes — 대표 출입 바코드
// ─────────────────────────────────────────────────────────────

export const fetchDbMasterBarcode = async (): Promise<MasterBarcode | null> => {
  try {
    const { data, error } = await supabase.from('master_barcodes').select('*').limit(1).single();
    if (error || !data) return null;
    return {
      type: data.type as MasterBarcode['type'],
      value: data.value as string,
      updatedAt: data.updated_at as string,
    };
  } catch (err) {
    console.warn('[DB] master_barcodes 조회 실패:', err);
    return null;
  }
};

export const saveDbMasterBarcode = async (master: MasterBarcode): Promise<DbResult> => {
  try {
    const { data } = await supabase.from('master_barcodes').select('id').limit(1);
    if (data && data.length > 0) {
      const { error } = await supabase
        .from('master_barcodes')
        .update({ type: master.type, value: master.value, updated_at: new Date().toISOString() })
        .eq('id', data[0].id);
      return error ? fail('대표 바코드 저장', error) : ok();
    }
    const { error } = await supabase
      .from('master_barcodes')
      .insert({ type: master.type, value: master.value });
    return error ? fail('대표 바코드 저장', error) : ok();
  } catch (err) {
    return fail('대표 바코드 저장', err);
  }
};

// ─────────────────────────────────────────────────────────────
// 5. admin_barcodes — 관리자 사전 등록 바코드
// ─────────────────────────────────────────────────────────────

interface AdminBarcodeRow {
  id: string;
  barcode_id: string;
  status: AdminBarcodeItem['status'];
  assigned_to_user_name: string | null;
  assigned_reservation_id: string | null;
  created_at: string;
}

export const fetchDbAdminBarcodes = async (): Promise<AdminBarcodeItem[]> => {
  try {
    const { data, error } = await supabase
      .from('admin_barcodes')
      .select('*')
      .order('created_at', { ascending: true });
    if (error || !data) return [];
    return (data as AdminBarcodeRow[]).map((b) => ({
      id: b.id,
      barcodeId: b.barcode_id,
      status: b.status,
      assignedToUserName: b.assigned_to_user_name ?? undefined,
      assignedReservationId: b.assigned_reservation_id ?? undefined,
      createdAt: b.created_at,
    }));
  } catch (err) {
    console.warn('[DB] admin_barcodes 조회 실패:', err);
    return [];
  }
};

export const saveDbAdminBarcodes = async (list: AdminBarcodeItem[]): Promise<DbResult> => {
  if (list.length === 0) return ok();
  try {
    const { error } = await supabase.from('admin_barcodes').upsert(
      list.map((b) => ({
        id: b.id,
        barcode_id: b.barcodeId,
        status: b.status,
        assigned_to_user_name: b.assignedToUserName ?? null,
        assigned_reservation_id: b.assignedReservationId ?? null,
        created_at: b.createdAt,
      })),
    );
    return error ? fail('바코드 저장', error) : ok();
  } catch (err) {
    return fail('바코드 저장', err);
  }
};

export const deleteDbAdminBarcode = async (id: string): Promise<DbResult> => {
  try {
    const { error } = await supabase.from('admin_barcodes').delete().eq('id', id);
    return error ? fail('바코드 삭제', error) : ok();
  } catch (err) {
    return fail('바코드 삭제', err);
  }
};

// ─────────────────────────────────────────────────────────────
// 6. app_settings — 입금 계좌 등 단일값 설정
// ─────────────────────────────────────────────────────────────

const BANK_INFO_KEY = 'bank_info';

export const fetchDbBankInfo = async (): Promise<BankInfo | null> => {
  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', BANK_INFO_KEY)
      .maybeSingle();
    if (error || !data) return null;
    return data.value as BankInfo;
  } catch (err) {
    console.warn('[DB] app_settings(bank_info) 조회 실패:', err);
    return null;
  }
};

export const saveDbBankInfo = async (info: BankInfo): Promise<DbResult> => {
  try {
    const { error } = await supabase.from('app_settings').upsert({
      key: BANK_INFO_KEY,
      value: info,
      updated_at: new Date().toISOString(),
    });
    return error ? fail('입금 계좌 저장', error) : ok();
  } catch (err) {
    return fail('입금 계좌 저장', err);
  }
};

// ─────────────────────────────────────────────────────────────
// 7. point_transactions — 포인트 입출금·환불 이력
// ─────────────────────────────────────────────────────────────

interface PointTransactionRow {
  id: string;
  user_id: string;
  user_name: string;
  type: PointTransaction['type'];
  amount: number;
  description: string | null;
  status: PointTransaction['status'];
  created_at: string;
}

export const fetchDbPointTransactions = async (): Promise<PointTransaction[]> => {
  try {
    const { data, error } = await supabase
      .from('point_transactions')
      .select('*')
      .order('created_at', { ascending: false });
    if (error || !data) return [];
    return (data as PointTransactionRow[]).map((t) => ({
      id: t.id,
      userId: t.user_id,
      userName: t.user_name,
      type: t.type,
      amount: t.amount,
      description: t.description ?? '',
      status: t.status,
      createdAt: t.created_at,
    }));
  } catch (err) {
    console.warn('[DB] point_transactions 조회 실패:', err);
    return [];
  }
};

export const saveDbPointTransaction = async (tx: PointTransaction): Promise<DbResult> => {
  try {
    const { error } = await supabase.from('point_transactions').upsert({
      id: tx.id,
      user_id: tx.userId,
      user_name: tx.userName,
      type: tx.type,
      amount: tx.amount,
      description: tx.description,
      status: tx.status,
      created_at: tx.createdAt,
    });
    return error ? fail('포인트 이력 저장', error) : ok();
  } catch (err) {
    return fail('포인트 이력 저장', err);
  }
};
