/* eslint-disable no-useless-assignment */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type UserMeta = {
  role?: string;
  branchIds?: string[];
  telegramChatId?: string;
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const escapeHtml = (value: unknown) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;');

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ success: false, error: 'POST 요청만 허용됩니다.' }, 405);

  const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!botToken || !supabaseUrl || !serviceRoleKey) {
    return json({ success: false, error: '서버 Telegram 환경변수가 설정되지 않았습니다.' }, 500);
  }

  const body = await request.json().catch(() => ({}));
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const eventType = String(body.type || '');
  let eventId = '';
  let chatId = '';
  let text = '';

  if (eventType === 'test') {
    chatId = String(body.chatId || '').trim();
    text = String(body.text || '르하임 Telegram 연결 테스트').trim();
    eventId = crypto.randomUUID();
  } else if (eventType === 'charge_request') {
    eventId = String(body.transactionId || '').trim();
    if (!eventId) return json({ success: false, error: 'transactionId가 필요합니다.' }, 400);

    const { data: existing } = await supabase
      .from('notification_deliveries')
      .select('status')
      .eq('event_type', eventType)
      .eq('event_id', eventId)
      .eq('channel', 'telegram')
      .maybeSingle();
    if (existing?.status === 'sent' || existing?.status === 'processing') {
      return json({ success: true, duplicate: true });
    }

    let { data: tx, error: txError } = await supabase
      .from('point_transactions')
      .select('id,user_id,user_name,branch_id,description,amount,status,created_at')
      .eq('id', eventId)
      .eq('type', 'charge_request')
      .single();
    if (txError && /branch_id/u.test(txError.message || '')) {
      const legacyResult = await supabase
        .from('point_transactions')
        .select('id,user_id,user_name,description,amount,status,created_at')
        .eq('id', eventId)
        .eq('type', 'charge_request')
        .single();
      tx = legacyResult.data ? { ...legacyResult.data, branch_id: null } : null;
      txError = legacyResult.error;
    }
    const branchId = tx?.branch_id || tx?.description?.match(/__branch_id=([^_]+)__/u)?.[1];
    if (txError || !tx || tx.status !== 'pending' || !branchId) {
      return json({ success: false, error: '유효한 지점 충전 신청을 찾지 못했습니다.' }, 404);
    }

    const [{ data: metaRow }, { data: branchRow }, { data: userRow }] = await Promise.all([
      supabase.from('app_settings').select('value').eq('key', 'lheureux_users_meta').maybeSingle(),
      supabase.from('app_settings').select('value').eq('key', 'lheureux_branches').maybeSingle(),
      supabase.from('users').select('phone').eq('user_id', tx.user_id).maybeSingle(),
    ]);
    const metaMap = (metaRow?.value || {}) as Record<string, UserMeta>;
    const manager = Object.values(metaMap).find((meta) =>
      meta.role === 'admin' && meta.branchIds?.includes(branchId) && Boolean(meta.telegramChatId?.trim()),
    );
    chatId = manager?.telegramChatId?.trim() || '';
    if (!chatId) {
      await supabase.from('notification_deliveries').upsert({
        event_type: eventType,
        event_id: eventId,
        channel: 'telegram',
        status: 'skipped',
        error_message: '담당 지점 관리자의 Telegram Chat ID가 없습니다.',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'event_type,event_id,channel' });
      return json({ success: false, error: '담당 지점 관리자의 Telegram Chat ID가 없습니다.' }, 422);
    }

    const branches = Array.isArray(branchRow?.value) ? branchRow.value : [];
    const branch = branches.find((item: { id?: string }) => item.id === branchId);
    const branchName = branch?.fullName || branch?.name || branchId;
    text = `🔔 <b>[르하임 스터디카페] 포인트 충전 신청</b>\n\n` +
      `🏢 <b>지점</b>: ${escapeHtml(branchName)}\n` +
      `👤 <b>회원</b>: ${escapeHtml(tx.user_name)} (${escapeHtml(tx.user_id)})\n` +
      `📞 <b>연락처</b>: ${escapeHtml(userRow?.phone || '-')}\n` +
      `💰 <b>신청 금액</b>: <b>${Number(tx.amount).toLocaleString('ko-KR')} P</b>\n` +
      `⏰ <b>신청 일시</b>: ${new Date(tx.created_at).toLocaleString('ko-KR')}\n\n` +
      `👉 <i>관리자 콘솔에서 입금 확인 후 승인해 주세요.</i>`;

    await supabase.from('notification_deliveries').upsert({
      event_type: eventType,
      event_id: eventId,
      channel: 'telegram',
      recipient: chatId,
      status: 'processing',
      error_message: null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'event_type,event_id,channel' });
  } else if (eventType === 'transfer_request') {
    eventId = String(body.requestId || crypto.randomUUID());
    const toBranchId = String(body.toBranchId || '').trim();
    const { data: metaRow } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'lheureux_users_meta')
      .maybeSingle();
    const metaMap = (metaRow?.value || {}) as Record<string, UserMeta>;
    const manager = Object.values(metaMap).find((meta) =>
      meta.role === 'admin' && meta.branchIds?.includes(toBranchId) && Boolean(meta.telegramChatId?.trim()),
    );
    chatId = manager?.telegramChatId?.trim() || '';
    if (!chatId) return json({ success: false, error: '도착 지점 담당자의 Telegram Chat ID가 없습니다.' }, 422);
    text = `🔄 <b>[르하임 스터디카페] 지점 간 포인트 이전 신청</b>\n\n` +
      `👤 <b>회원</b>: ${escapeHtml(body.userName)} (${escapeHtml(body.userId)})\n` +
      `🏢 <b>이전</b>: ${escapeHtml(body.fromBranchName)} → <b>${escapeHtml(body.toBranchName)}</b>\n` +
      `💰 <b>금액</b>: <b>${Number(body.amount || 0).toLocaleString('ko-KR')} P</b>\n` +
      `📝 <b>사유</b>: ${escapeHtml(body.reason || '사유 없음')}`;
  } else {
    return json({ success: false, error: '지원하지 않는 알림 유형입니다.' }, 400);
  }

  if (!chatId || !text) return json({ success: false, error: '수신자 또는 메시지가 비어 있습니다.' }, 400);

  const telegramResponse = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
  });
  const telegramResult = await telegramResponse.json().catch(() => ({}));
  const success = telegramResponse.ok && telegramResult.ok === true;

  if (eventType === 'charge_request') {
    await supabase.from('notification_deliveries').upsert({
      event_type: eventType,
      event_id: eventId,
      channel: 'telegram',
      recipient: chatId,
      status: success ? 'sent' : 'failed',
      error_message: success ? null : String(telegramResult.description || 'Telegram 전송 실패'),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'event_type,event_id,channel' });
  }

  return json({ success, error: success ? undefined : telegramResult.description || 'Telegram 전송 실패' }, success ? 200 : 502);
});
