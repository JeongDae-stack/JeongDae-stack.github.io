begin;
alter table public.site_tips add column image_data text
 check (length(image_data) <= 450000 and image_data ~ '^data:image/jpeg;base64,[A-Za-z0-9+/]+={0,2}$');
alter table public.site_tips add column has_image boolean generated always as (image_data is not null) stored;
create function public.add_site_tip(title text, nickname text, body text, password text, image_data text)
returns void language plpgsql security definer set search_path = '' as $$
begin
 perform public.add_site_tip(title,nickname,body,password);
 update public.site_tips set image_data = add_site_tip.image_data
 where id = pg_catalog.currval('public.site_tips_id_seq'::regclass);
end;
$$;
revoke all on function public.add_site_tip(text,text,text,text,text) from public;
grant execute on function public.add_site_tip(text,text,text,text,text) to anon, authenticated;
commit;
