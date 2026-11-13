begin;
create extension if not exists pgcrypto with schema extensions;
create schema if not exists private;
create table private.comment_admins (user_id uuid primary key references auth.users(id) on delete cascade);
create table public.site_comments (
 id bigint generated always as identity primary key,
 nickname text not null check (char_length(btrim(nickname)) between 1 and 30),
 body text not null check (char_length(btrim(body)) between 1 and 1000),
 created_at timestamptz not null default now()
);
create table private.comment_passwords (
 comment_id bigint primary key references public.site_comments(id) on delete cascade,
 hash text not null
);
alter table public.site_comments enable row level security;
revoke all on public.site_comments from public, anon, authenticated;
grant select on public.site_comments to anon, authenticated;
create policy comments_read on public.site_comments for select to anon, authenticated using (true);
create function public.add_site_comment(nickname text, body text, password text)
returns void language plpgsql security definer set search_path = '' as $$
declare new_id bigint;
begin
 if password is null or char_length(password) < 8 or octet_length(password) > 72 then
  raise exception 'Invalid deletion password';
 end if;
 insert into public.site_comments(nickname,body) values (btrim(nickname),btrim(body)) returning id into new_id;
 insert into private.comment_passwords values (new_id,extensions.crypt(password,extensions.gen_salt('bf',10)));
end;
$$;
create function public.is_comment_admin()
returns boolean language sql stable security definer set search_path = '' as $$
 select exists (select 1 from private.comment_admins where user_id = auth.uid());
$$;
create function public.delete_site_comment(comment_id bigint, password text default null)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
 if public.is_comment_admin() or (
  password is not null and octet_length(password) <= 72 and exists (
   select 1 from private.comment_passwords p where p.comment_id = delete_site_comment.comment_id
   and p.hash = extensions.crypt(password,p.hash)
  )
 ) then
  delete from public.site_comments where id = comment_id;
  return found;
 end if;
 return false;
end;
$$;
revoke all on function public.add_site_comment(text,text,text), public.delete_site_comment(bigint,text), public.is_comment_admin() from public;
grant execute on function public.add_site_comment(text,text,text), public.delete_site_comment(bigint,text) to anon, authenticated;
grant execute on function public.is_comment_admin() to authenticated;
commit;
