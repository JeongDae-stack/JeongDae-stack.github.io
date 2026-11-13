begin;
create table public.site_tips (
 id bigint generated always as identity primary key,
 title text not null check (char_length(btrim(title)) between 1 and 100),
 nickname text not null check (char_length(btrim(nickname)) between 1 and 30),
 body text not null check (char_length(btrim(body)) between 1 and 5000),
 created_at timestamptz not null default now()
);
create table private.tip_passwords (
 tip_id bigint primary key references public.site_tips(id) on delete cascade,
 hash text not null
);
alter table public.site_tips enable row level security;
alter table private.tip_passwords enable row level security;
revoke all on public.site_tips from public, anon, authenticated;
grant select on public.site_tips to anon, authenticated;
create policy tips_read on public.site_tips for select to anon, authenticated using (true);
create function public.add_site_tip(title text, nickname text, body text, password text)
returns void language plpgsql security definer set search_path = '' as $$
declare new_id bigint;
begin
 if password is null or char_length(password) < 8 or octet_length(password) > 72 then
  raise exception 'Invalid deletion password';
 end if;
 insert into public.site_tips(title,nickname,body)
 values (btrim(title),btrim(nickname),btrim(body)) returning id into new_id;
 insert into private.tip_passwords values (new_id,extensions.crypt(password,extensions.gen_salt('bf',10)));
end;
$$;
create function public.delete_site_tip(tip_id bigint, password text)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
 if password is null or octet_length(password) > 72 then return false; end if;
 if exists (select 1 from private.comment_delete_key k where k.hash = extensions.crypt(password,k.hash))
 or exists (select 1 from private.tip_passwords p where p.tip_id = delete_site_tip.tip_id
 and p.hash = extensions.crypt(password,p.hash)) then
  delete from public.site_tips where id = tip_id;
  return found;
 end if;
 return false;
end;
$$;
revoke all on function public.add_site_tip(text,text,text,text), public.delete_site_tip(bigint,text) from public;
grant execute on function public.add_site_tip(text,text,text,text), public.delete_site_tip(bigint,text) to anon, authenticated;
commit;
