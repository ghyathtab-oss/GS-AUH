-- GS-AUH / نفّذ الملف كاملاً مرة واحدة من SQL Editor بمشروع Supabase.
-- لا يضيف هذا الملف حساب مدير تلقائياً؛ عيّنه يدوياً بعد إنشاء المستخدم في Auth.
create table if not exists public.medatlas_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.medatlas_admins enable row level security;
revoke all on public.medatlas_admins from anon, authenticated;
-- لا توجد سياسة لإضافة المدراء من واجهة الزائر.
create or replace function public.medatlas_is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.medatlas_admins a where a.user_id = (select auth.uid()));
$$;
revoke all on function public.medatlas_is_admin() from public;
grant execute on function public.medatlas_is_admin() to authenticated;

create table if not exists public.medatlas_lectures (
  slug text primary key check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null check (char_length(title) between 3 and 180),
  subtitle text not null default '' check (char_length(subtitle) <= 500),
  lecturer text not null default '' check (char_length(lecturer) <= 150),
  category text not null default 'عام' check (char_length(category) <= 110),
  level text not null default 'متقدم' check (level in ('تمهيدي','متوسط','متقدم','جميع المستويات')),
  status text not null default 'قيد الإعداد' check (status in ('منشورة','قيد المراجعة العلمية','قيد الإعداد','قريباً','مؤرشفة')),
  is_visible boolean not null default false,
  file_type text not null check (file_type in ('internal','html','pdf')),
  file_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint medatlas_file_path_check check (
    (file_type = 'internal' and file_path is null) or
    (file_type in ('html','pdf') and file_path ~ '^[a-f0-9-]{36}/lecture\.(html|pdf)$')
  )
);
alter table public.medatlas_lectures enable row level security;
grant select on public.medatlas_lectures to anon, authenticated;
grant insert, update, delete on public.medatlas_lectures to authenticated;
-- احذف السياسات المسماة هنا إن كنت تعيد التشغيل.
drop policy if exists "medatlas public lectures" on public.medatlas_lectures;
drop policy if exists "medatlas authenticated published" on public.medatlas_lectures;
drop policy if exists "medatlas admin select" on public.medatlas_lectures;
drop policy if exists "medatlas admin insert" on public.medatlas_lectures;
drop policy if exists "medatlas admin update" on public.medatlas_lectures;
drop policy if exists "medatlas admin delete" on public.medatlas_lectures;
create policy "medatlas public lectures" on public.medatlas_lectures for select to anon using (is_visible = true and status <> 'مؤرشفة');
create policy "medatlas authenticated published" on public.medatlas_lectures for select to authenticated using (is_visible = true and status <> 'مؤرشفة');
create policy "medatlas admin select" on public.medatlas_lectures for select to authenticated using (public.medatlas_is_admin());
create policy "medatlas admin insert" on public.medatlas_lectures for insert to authenticated with check (public.medatlas_is_admin());
create policy "medatlas admin update" on public.medatlas_lectures for update to authenticated using (public.medatlas_is_admin()) with check (public.medatlas_is_admin());
create policy "medatlas admin delete" on public.medatlas_lectures for delete to authenticated using (public.medatlas_is_admin());

-- كل الملفات عامة القراءة بعد معرفة رابطها؛ القراءة الرسمية عبر فهرس المحاضرات المنشورة.
-- لا ترفع مسودات سرية إلى هذه الحاوية العامة.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('medatlas-lectures', 'medatlas-lectures', true, 31457280, array['text/html','application/pdf'])
on conflict (id) do update set public = true, file_size_limit = 31457280,
allowed_mime_types = array['text/html','application/pdf'];
drop policy if exists "medatlas files admin insert" on storage.objects;
drop policy if exists "medatlas files admin select" on storage.objects;
drop policy if exists "medatlas files admin update" on storage.objects;
drop policy if exists "medatlas files admin delete" on storage.objects;
create policy "medatlas files admin insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'medatlas-lectures' and public.medatlas_is_admin());
create policy "medatlas files admin select" on storage.objects for select to authenticated
  using (bucket_id = 'medatlas-lectures' and public.medatlas_is_admin());
create policy "medatlas files admin update" on storage.objects for update to authenticated
  using (bucket_id = 'medatlas-lectures' and public.medatlas_is_admin())
  with check (bucket_id = 'medatlas-lectures' and public.medatlas_is_admin());
create policy "medatlas files admin delete" on storage.objects for delete to authenticated
  using (bucket_id = 'medatlas-lectures' and public.medatlas_is_admin());

-- إدراج المحاضرة الأصلية في قاعدة البيانات؛ لا تستبدل التعديلات الموجودة إن أعدت تشغيل الملف.
insert into public.medatlas_lectures
(slug, title, subtitle, lecturer, category, level, status, is_visible, file_type, file_path)
values ('ruq-pain', 'المقاربة التشخيصية لألم الربع العلوي الأيمن',
        'من القصة المرضية حتى الخوارزميات التشخيصية والتفريق بين 30 سبباً',
        '', 'الجراحة العامة', 'متقدم', 'قيد المراجعة العلمية', true, 'internal', null)
on conflict (slug) do nothing;

-- بعد إنشاء حسابك من Authentication → Users، نفّذ هذا السطر مع UUID الحقيقي (دون --):
-- insert into public.medatlas_admins (user_id) values ('YOUR-AUTH-USER-UUID') on conflict do nothing;
