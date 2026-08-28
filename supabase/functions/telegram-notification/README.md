# Telegram 알림 Edge Function

배포 전에 Supabase 프로젝트 Secret에 새 Bot Token을 등록합니다.

```bash
supabase secrets set TELEGRAM_BOT_TOKEN=새로_발급한_토큰
supabase functions deploy telegram-notification
```

기존 프론트엔드에 노출되었던 토큰은 BotFather에서 반드시 폐기해야 합니다.
