import { getSupabase, safeSlug } from './supabase-client.js';
import { STORAGE_BUCKET } from './supabase-config.js';
const $=s=>document.querySelector(s);
function fail(msg){$('#lectureTitle').textContent='المحاضرة غير متاحة';$('#loading').textContent=msg;$('#lectureFrame').hidden=true;}
function escapeAttr(s){return String(s).replace(/[&"<>]/g,c=>({'&':'&amp;','"':'&quot;','<':'&lt;','>':'&gt;'}[c]));}
async function main(){
  const slug=new URLSearchParams(location.search).get('slug');
  if(!safeSlug(slug))return fail('رابط المحاضرة غير صالح.');
  try{
    const db=await getSupabase();
    const {data:r,error}=await db.from('medatlas_lectures').select('slug,title,subtitle,lecturer,category,status,file_type,file_path,is_visible').eq('slug',slug).single();
    if(error||!r||!r.file_path)return fail('لم يُعثر على محاضرة متاحة بهذا الرابط.');
    // RLS تمنع غير المدير من جلب مسودة مخفية. يتحقق الخادم لا الواجهة.
    $('#lectureTitle').textContent=r.title;document.title=r.title+' | GS-AUH';
    $('#lectureMeta').textContent=[r.lecturer?'تقديم: '+r.lecturer:null,r.category].filter(Boolean).join(' · ');
    $('#status').textContent=r.status;
    const {data:urlData}=db.storage.from(STORAGE_BUCKET).getPublicUrl(r.file_path);
    const publicUrl=urlData.publicUrl;
    $('#downloadLink').href=publicUrl+'?download';$('#downloadLink').hidden=false;
    const frame=$('#lectureFrame');
    if(r.file_type==='pdf'){
      frame.removeAttribute('sandbox'); // PDF viewer native; does not execute uploaded HTML
      frame.src=publicUrl;
    }else if(r.file_type==='html'){
      // Public bucket files have a public URL. Fetch it directly so guests can
      // read published HTML without needing authenticated Storage SELECT rights.
      // Supabase serves uploaded HTML as text/plain; we render it in srcdoc.
      const response=await fetch(publicUrl,{mode:'cors',credentials:'omit'});
      if(!response.ok)throw new Error('تعذر تحميل ملف HTML: HTTP '+response.status);
      const html=await response.text();
      const base=publicUrl.substring(0,publicUrl.lastIndexOf('/')+1);
      const injected=`<base href="${escapeAttr(base)}" target="_self">`;
      const withBase=/<head\b[^>]*>/i.test(html)
        ? html.replace(/<head\b[^>]*>/i,m=>m+injected)
        : /<html\b[^>]*>/i.test(html)
          ? html.replace(/<html\b[^>]*>/i,m=>m+'<head>'+injected+'</head>')
          : '<!doctype html><html><head>'+injected+'</head><body>'+html+'</body></html>';
      frame.setAttribute('sandbox','allow-scripts'); // مهم: لا تضف allow-same-origin
      frame.srcdoc=withBase;
    }else{return fail('صيغة المحاضرة غير مدعومة.');}
    $('#loading').hidden=true;frame.hidden=false;
  }catch(e){console.error(e);fail('تعذر عرض المحاضرة. قد تكون مسودة غير منشورة أو حدث خطأ في الاتصال.');}
}
main();
