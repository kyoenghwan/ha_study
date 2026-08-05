import { createClient } from '@supabase/supabase-js';
import type { UserAccount, Reservation, MasterBarcode } from '../types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://aonpiwzphpngucrtrnmq.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFvbnBpd3pwaHBuZ3VjcnRybm1xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU5MzM2NTksImV4cCI6MjEwMTUwOTY1OX0.A2W5VENnUQL6GDROVzNtK3orR6OX8GupKRTfts4e4PI';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// --- DB API 서비스 ---

// 1. 회원 목록 조회 & 가입/수정
export const fetchDbUsers = async (): Promise<UserAccount[]> => {
  try {
    const { data, error } = await supabase.from('users').select('*');
    if (error || !data) return [];
    return data.map((u) => ({
      id: u.id,
      userId: u.user_id,
      password: u.password,
      name: u.name,
      phone: u.phone,
      role: u.role as any,
      points: u.points,
    }));
  } catch (err) {
    console.warn('Supabase users fetch failed, falling back to local:', err);
    return [];
  }
};

export const saveDbUser = async (user: Omit<UserAccount, 'id'>) => {
  const { data, error } = await supabase
    .from('users')
    .insert({
      user_id: user.userId,
      password: user.password,
      name: user.name,
      phone: user.phone,
      role: user.role,
      points: user.points,
    })
    .select()
    .single();

  if (error) console.error('Supabase user save error:', error);
  return data;
};

// 2. 예약 목록 조회 & 저장/수정
export const fetchDbReservations = async (): Promise<Reservation[]> => {
  try {
    const { data, error } = await supabase.from('reservations').select('*').order('created_at', { ascending: false });
    if (error || !data) return [];
    return data.map((r) => ({
      id: r.id,
      roomId: r.room_id,
      date: r.date,
      startTime: r.start_time,
      endTime: r.end_time,
      userName: r.user_name,
      userPhone: r.user_phone,
      costPoints: r.cost_points,
      costAmount: r.cost_amount,
      paymentMethod: r.payment_method as any,
      paymentStatus: r.payment_status as any,
      barcodeId: r.barcode_id,
      barcodeStatus: r.barcode_status as any,
      isLongTerm: r.is_long_term,
    }));
  } catch (err) {
    console.warn('Supabase reservations fetch failed:', err);
    return [];
  }
};

export const saveDbReservations = async (newResList: Reservation[]) => {
  try {
    const payload = newResList.map((r) => ({
      id: r.id,
      room_id: r.roomId,
      date: r.date,
      start_time: r.startTime,
      end_time: r.endTime,
      user_name: r.userName,
      user_phone: r.userPhone,
      cost_points: r.costPoints || 4000,
      cost_amount: r.costAmount || 4000,
      payment_method: r.paymentMethod,
      payment_status: r.paymentStatus,
      barcode_id: r.barcodeId,
      barcode_status: r.barcodeStatus,
      is_long_term: r.isLongTerm || false,
    }));

    const { error } = await supabase.from('reservations').upsert(payload);
    if (error) console.error('Supabase reservation save error:', error);
  } catch (err) {
    console.error('Supabase reservations upsert failed:', err);
  }
};

// 3. 대표 바코드 조회 & 저장
export const fetchDbMasterBarcode = async (): Promise<MasterBarcode | null> => {
  try {
    const { data, error } = await supabase.from('master_barcodes').select('*').limit(1).single();
    if (error || !data) return null;
    return {
      type: data.type as any,
      value: data.value,
      updatedAt: data.updated_at,
    };
  } catch (err) {
    return null;
  }
};

export const saveDbMasterBarcode = async (master: MasterBarcode) => {
  try {
    const { data } = await supabase.from('master_barcodes').select('id').limit(1);
    if (data && data.length > 0) {
      await supabase.from('master_barcodes').update({
        type: master.type,
        value: master.value,
        updated_at: new Date().toISOString(),
      }).eq('id', data[0].id);
    } else {
      await supabase.from('master_barcodes').insert({
        type: master.type,
        value: master.value,
      });
    }
  } catch (err) {
    console.error('Supabase master barcode save error:', err);
  }
};
