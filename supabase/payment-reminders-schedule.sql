-- Violet Ledger: daily payment reminders
-- Run once in Supabase -> SQL Editor AFTER deploying payment-reminders.
-- Replace REPLACE_WITH_LONG_RANDOM_SECRET with the SAME value that you save
-- in Edge Functions secrets as PAYMENT_CRON_SECRET.
-- The schedule below runs every day at 06:00 UTC.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Create or update the encrypted cron secret in Supabase Vault.
do $$
declare
  secret_id uuid;
begin
  select id into secret_id
  from vault.secrets
  where name = 'payment_cron_secret'
  order by created_at desc
  limit 1;

  if secret_id is null then
    perform vault.create_secret(
      'REPLACE_WITH_LONG_RANDOM_SECRET',
      'payment_cron_secret',
      'Secret used by pg_cron to invoke payment-reminders'
    );
  else
    perform vault.update_secret(
      secret_id,
      'REPLACE_WITH_LONG_RANDOM_SECRET',
      'payment_cron_secret',
      'Secret used by pg_cron to invoke payment-reminders'
    );
  end if;
end
$$;

-- Replace the existing job when this file is run again.
do $$
declare
  existing_job bigint;
begin
  select jobid into existing_job
  from cron.job
  where jobname = 'payment-reminders-daily'
  limit 1;

  if existing_job is not null then
    perform cron.unschedule(existing_job);
  end if;
end
$$;

select cron.schedule(
  'payment-reminders-daily',
  '0 6 * * *',
  $job$
    select net.http_post(
      url := 'https://ewecfqgjkihlhftstbuu.supabase.co/functions/v1/payment-reminders',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', (
          select decrypted_secret
          from vault.decrypted_secrets
          where name = 'payment_cron_secret'
          order by created_at desc
          limit 1
        )
      ),
      body := '{}'::jsonb
    ) as request_id;
  $job$
);

-- Check that the job exists:
select jobid, jobname, schedule, active
from cron.job
where jobname = 'payment-reminders-daily';
