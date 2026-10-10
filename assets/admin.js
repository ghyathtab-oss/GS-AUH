import { SUPABASE_CONFIGURED, STORAGE_BUCKET } from './supabase-config.js';
import { getSupabase, safeSlug } from './supabase-client.js';
const $ = (s) => document.querySelector(s);
const setup = $('#setupPanel'), login = $('#loginPanel'), dashboard = $('#dashboard');
const feedback = $('#feedback'), form = $('#editForm');
let db, authorized = false, lectures = [], selected = null, saving = false;
const maxBytes = 30 * 1024 * 1024;
const field = id => document.getElementById(id);
const currentFile = () => field('lectureFile').files?.[0] ?? null;

function notify(text, isError=false) {
  feedback.textContent = text;
  feedback.className = 'feedback' + (isError ? ' error' : '');
  feedback.hidden = !text;
}
function busy(value) {
  saving = value;
  field('saveButton').disabled = value;
  field('saveButton').textContent = value ? 'جارٍ رفع الملف وحفظ المحاضرة…' : 'حفظ المحاضرة ←';
}
function show(which) {
  setup.hidden = which !== 'setup'; login.hidden = which !== 'login'; dashboard.hidden = which !== 'dashboard';
  if (which !== 'dashboard') authorized = false;
}
function formatSize(bytes) { return (bytes / 1048576).toFixed(2) + ' MB'; }
function renderFile() {
  const f = currentFile();
  field('fileDetails').textContent = f ? `${f.name} · ${formatSize(f.size)}` :
    selected?.file_type === 'internal' ? 'محاضرة داخلية مستضافة على GitHub Pages، يمكنك استبدالها بملف جديد.' :
    selected?.file_path ? `ملف ${selected.file_type.toUpperCase()} محفوظ. اختَر ملفاً فقط إذا أردت استبداله.` : 'لم يُحدَّد ملف بعد.';
}
function previewCard() {
  field('previewTitle').textContent = field('titleInput').value || 'عنوان المحاضرة';
  field('previewSubtitle').textContent = field('subtitleInput').value || 'وصف المحاضرة';
  field('previewLecturer').textContent = field('lecturerInput').value ? 'تقديم: ' + field('lecturerInput').value : '';
  field('previewCategory').textContent = field('categoryInput').value || 'تخصص طبي';
  field('previewStatus').textContent = field('statusInput').value;
}
function renderList() {
  const q = field('filterInput').value.trim().toLocaleLowerCase();
  const list = field('lectureList'); list.replaceChildren();
  const matched = lectures.filter(r => [r.title,r.slug,r.lecturer,r.category].some(x => (x || '').toLocaleLowerCase().includes(q)));
  field('sidebarCount').textContent = String(lectures.length);
  field('totalLectures').textContent = String(lectures.length).padStart(2,'0');
  field('modifiedCount').textContent = String(lectures.filter(r => r.is_visible).length).padStart(2,'0');
  field('activeLectureStat').textContent = selected?.title || 'جديدة';
  if (!matched.length) { const el=document.createElement('p');el.className='sidebar-tip';el.textContent='لا توجد نتائج';list.append(el); }
  matched.forEach(r => {
    const b = document.createElement('button'); b.type='button'; b.className='lecture-choice'+(selected?.slug===r.slug?' is-current':'');
    const t=document.createElement('span'); t.className='choice-title';t.textContent=r.title;
    const m=document.createElement('span');m.className='choice-meta';m.textContent=`${r.file_type.toUpperCase()} · ${r.is_visible?'ظاهرة للزوار':'مسودة مخفية'} · ${r.status}`;
    b.append(t,m);b.addEventListener('click',()=>selectLecture(r));list.append(b);
  });
}
function selectLecture(r=null) {
  selected = r;
  form.hidden = false; field('emptyEditor').hidden = true;
  field('editorTitle').textContent = r ? 'تعديل المحاضرة' : 'محاضرة جديدة';
  field('editingId').textContent = r ? r.slug : 'NEW LECTURE';
  field('slugField').hidden = Boolean(r);
  field('slugInput').required = !r;
  field('slugInput').value = r?.slug || '';
  for (const key of ['title','lecturer','subtitle','category','level','status']) {
    const input = field(key+'Input'); if (input) input.value = r?.[key] ?? ({level:'متقدم',status:'قيد الإعداد',category:'الجراحة العامة'}[key] || '');
  }
  field('visibleInput').checked = Boolean(r?.is_visible);
  field('lectureFile').value = '';
  field('deleteButton').hidden = !r;
  const link=field('filePreviewLink'); link.hidden=!r;
  if (r) link.href = r.file_type==='internal' ? `../lectures/${encodeURIComponent(r.slug)}/index.html` : `../lecture.html?slug=${encodeURIComponent(r.slug)}`;
  renderFile();previewCard();renderList();
  notify('');
}
async function reload(preferSlug) {
  const {data,error}=await db.from('medatlas_lectures').select('*').order('created_at',{ascending:false});
  if(error) throw error;
  lectures=data || [];
  const pick=lectures.find(r=>r.slug===preferSlug) || lectures.find(r=>r.slug===selected?.slug) || null;
  selectLecture(pick);
  if(!pick && lectures.length===0) selectLecture(null);
}
async function isAdmin() {
  const {data,error}=await db.rpc('medatlas_is_admin');
  if(error) throw error;
  return data===true;
}
async function startDashboard(user) {
  if (!await isAdmin()) { show('login');notify('هذا الحساب غير مُخوَّل بإدارة المنصة. أضف UUID الخاص به إلى جدول medatlas_admins.',true);return; }
  authorized=true;show('dashboard');field('accountName').textContent=user.email || 'المدير';
  await reload('ruq-pain');
}
async function bootstrap() {
  if(!SUPABASE_CONFIGURED){show('setup');return;}
  try {
    db=await getSupabase();
    const {data:{session},error}=await db.auth.getSession();if(error)throw error;
    if(session?.user)await startDashboard(session.user);else show('login');
    db.auth.onAuthStateChange((event,session)=>{
      if(event==='SIGNED_OUT'){show('login');selected=null;lectures=[];notify('تم تسجيل الخروج.');}
    });
  } catch(err){show('login');notify('تعذر الاتصال بـ Supabase: '+err.message,true);}
}
field('loginForm').addEventListener('submit',async e=>{
  e.preventDefault();notify(''); const button=field('loginButton');button.disabled=true;
  try{
    if(!db)db=await getSupabase();
    const {data,error}=await db.auth.signInWithPassword({email:field('email').value.trim(),password:field('password').value});
    if(error)throw error;
    field('password').value='';await startDashboard(data.user);
  }catch(err){notify('تعذر الدخول: '+err.message,true)}finally{button.disabled=false;}
});
field('logoutButton').addEventListener('click',async()=>{if(db)await db.auth.signOut();show('login');});
field('newLecture').addEventListener('click',()=>selectLecture(null));
field('cancelButton').addEventListener('click',()=>selectLecture(selected));
field('filterInput').addEventListener('input',renderList);
field('lectureFile').addEventListener('change',renderFile);
for(const key of ['title','subtitle','lecturer','status','category'])field(key+'Input').addEventListener('input',previewCard);

async function inspectFile(file) {
  if(!file) return null;
  const extension=(file.name.split('.').pop() || '').toLowerCase();
  if(!['html','htm','pdf'].includes(extension))throw Error('نوع الملف غير مدعوم. استخدم HTML أو PDF فقط.');
  if(file.size===0 || file.size>maxBytes)throw Error('حجم الملف يجب أن يكون أكبر من صفر ولا يزيد عن 30 MB.');
  const type=extension==='pdf'?'pdf':'html';
  const header=await file.slice(0,1024).text();
  if(type==='pdf' && !header.startsWith('%PDF-'))throw Error('الملف لا يبدو PDF صالحاً.');
  if(type==='html' && !/<(?:!doctype\s+html|html\b|head\b|body\b)/i.test(header))throw Error('الملف لا يبدو صفحة HTML صالحة.');
  return {type,contentType:type==='pdf'?'application/pdf':'text/html'};
}
form.addEventListener('submit',async e=>{
  e.preventDefault();if(saving||!authorized)return;
  let newPath=null;
  busy(true);notify('');
  try{
    const slug=selected?.slug || field('slugInput').value.trim();
    if(!safeSlug(slug)||slug.length>80)throw Error('رمز المحاضرة يجب أن يتكون من أحرف إنجليزية صغيرة وأرقام وشرطة فقط.');
    const file=currentFile();const inspected=await inspectFile(file);
    if(!selected && !file)throw Error('يرجى رفع ملف HTML أو PDF لإنشاء محاضرة جديدة.');
    const type=inspected?.type || selected?.file_type;
    if(!type)throw Error('نوع الملف غير معروف.');
    if(inspected){
      newPath=`${crypto.randomUUID()}/lecture.${type}`;
      const {error:uploadError}=await db.storage.from(STORAGE_BUCKET).upload(newPath,file,{contentType:inspected.contentType,upsert:false,cacheControl:'3600'});
      if(uploadError)throw uploadError;
    }
    const payload={slug,title:field('titleInput').value.trim(),subtitle:field('subtitleInput').value.trim(),
      lecturer:field('lecturerInput').value.trim(),category:field('categoryInput').value.trim(),
      level:field('levelInput').value,status:field('statusInput').value,is_visible:field('visibleInput').checked,
      file_type:type,file_path:newPath || selected?.file_path || null,updated_at:new Date().toISOString()};
    const {data,error}=await db.from('medatlas_lectures').upsert(payload,{onConflict:'slug'}).select().single();
    if(error)throw error;
    const obsolete=selected?.file_path && newPath ? selected.file_path : null;
    await reload(data.slug);
    notify('تم حفظ المحاضرة بنجاح.'+(data.is_visible?' وهي ظاهرة الآن للزوار.':' بقيت مخفية كمسودة.'));
    if(obsolete){const {error:oldError}=await db.storage.from(STORAGE_BUCKET).remove([obsolete]);if(oldError)console.warn('Old file cleanup failed',oldError);}
    newPath=null;
  }catch(err){
    if(newPath){const {error:cleanupError}=await db.storage.from(STORAGE_BUCKET).remove([newPath]);if(cleanupError)console.warn('New file cleanup failed',cleanupError);}
    notify('تعذّر الحفظ: '+(err.message||String(err)),true);
  }finally{busy(false);}
});
field('deleteButton').addEventListener('click',async()=>{
  if(!selected||!authorized||saving)return;
  if(!window.confirm(`هل تريد حذف «${selected.title}» نهائياً من فهرس المنصة؟`))return;
  const old={...selected};notify('');
  try{
    const {error}=await db.from('medatlas_lectures').delete().eq('slug',old.slug);if(error)throw error;
    if(old.file_path){const {error:fileError}=await db.storage.from(STORAGE_BUCKET).remove([old.file_path]);if(fileError)console.warn('File deletion failed',fileError);}
    selected=null;await reload(null);notify('حُذفت المحاضرة من الفهرس.');
  }catch(err){notify('فشل الحذف: '+err.message,true);}
});
bootstrap();
