(() => {
  const $=selector=>document.querySelector(selector);
  const grid=$('#lectureGrid'),search=$('#lectureSearch'),filters=$('#categoryFilters');
  const counter=$('#countTag'),theme=$('#themeToggle');
  let rows=[],category='الكل';
  const normalize=s=>String(s||'').normalize('NFKC').replace(/[\u064B-\u065F\u0670]/g,'')
    .replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').toLowerCase();
  const safe=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const validSlug=slug=>/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug||'');
  const validCover=path=>typeof path==='string'&&/^lectures\/[a-z0-9_-]+\/assets\/[a-z0-9._-]+$/.test(path);
  const statusOf=r=>r.status||'محتوى تعليمي';
  function drawFilters(){
    const cats=['الكل',...new Set(rows.map(r=>r.category).filter(Boolean))];
    if(!cats.includes(category))category='الكل';filters.replaceChildren();
    cats.forEach(cat=>{const b=document.createElement('button');b.type='button';b.className='chip'+(cat===category?' is-active':'');b.textContent=cat;b.setAttribute('aria-pressed',String(cat===category));b.addEventListener('click',()=>{category=cat;drawFilters();drawCards()});filters.append(b)});
  }
  function drawCards(){
    const q=normalize(search.value.trim());
    const visible=rows.filter(r=>r.status!=='مؤرشفة');
    const filtered=visible.filter(r=>(category==='الكل'||r.category===category)&&normalize([r.title,r.subtitle,r.lecturer,r.category,r.track,...(r.keywords||[])].join(' ')).includes(q));
    counter.textContent=`${filtered.length} ${filtered.length===1?'محاضرة':'محاضرات'}`;
    $('#statLectures').textContent=String(visible.length).padStart(2,'0');grid.replaceChildren();
    if(!filtered.length){grid.innerHTML='<p class="empty-state">لا توجد محاضرات مطابقة للبحث الحالي.</p>';return;}
    filtered.forEach(r=>{
      if(!validSlug(r.slug))return;
      const href=r.file_type==='internal' ? `lectures/${r.slug}/index.html` : `lecture.html?slug=${encodeURIComponent(r.slug)}`;
      const tags=(r.features||[]).slice(0,3).map(f=>`<span>${safe(f)}</span>`).join('');
      const cover=validCover(r.cover)?`<img src="${r.cover}" loading="lazy" alt="غلاف محاضرة ${safe(r.title)}">`:`<div class="lecture-type-art" aria-hidden="true">${r.file_type==='pdf'?'PDF':'HTML'}</div>`;
      const presenter=r.lecturer?`<div class="card-presenter">✦ تقديم: ${safe(r.lecturer)}</div>`:'';
      const statusType=statusOf(r)==='منشورة'?' is-published':'';
      const art=document.createElement('article');art.className='lecture-card';
      art.innerHTML=`<div class="card-image">${cover}<span class="review-tag${statusType}">${safe(statusOf(r))}</span></div><div class="card-content"><div class="card-meta">${safe(r.category||'عام')} · ${safe(r.level||'')}</div><h3>${safe(r.title)}</h3>${presenter}<p>${safe(r.subtitle||'')}</p><div class="card-features">${tags}</div><a class="card-open" href="${href}"><span>افتح المحاضرة</span><span aria-hidden="true">↗</span></a></div>`;
      grid.append(art);
    });
  }
  async function load(){
    let configured=false;
    try{
      const { SUPABASE_CONFIGURED }=await import('./supabase-config.js');
      configured=SUPABASE_CONFIGURED;
      if(configured){
        const { getSupabase }=await import('./supabase-client.js');
        const db=await getSupabase();
        const {data,error}=await db.from('medatlas_lectures').select('slug,title,subtitle,lecturer,category,level,status,file_type,is_visible').eq('is_visible',true).order('created_at',{ascending:false});
        if(error)throw error;
        const localResponse=await fetch('data/lectures.json',{cache:'no-store'});
        const local=localResponse.ok ? await localResponse.json() : [];
        rows=(data||[]).filter(r=>validSlug(r.slug)).map(r=>{
          const original=local.find(x=>x.id===r.slug);
          return {...original,...r,features:original?.features||[r.file_type==='pdf'?'PDF':'HTML','محاضرة تعليمية'],keywords:original?.keywords||[]};
        });
      }else{
        const response=await fetch('data/lectures.json',{cache:'no-store'});
        if(!response.ok)throw Error('تعذر تحميل الفهرس المحلي');
        const local=await response.json();
        rows=local.filter(r=>r.id&&validSlug(r.id)).map(r=>({...r,slug:r.id,file_type:'internal'}));
      }
      drawFilters();drawCards();
    }catch(e){
      console.error('GS-AUH catalogue error',e);
      if(configured){rows=[];drawFilters();grid.innerHTML='<p class="empty-state">تعذر الاتصال بمكتبة المحاضرات الآن. حاول إعادة التحميل لاحقاً.</p>';}
      else grid.innerHTML='<p class="empty-state">تعذر تحميل المحاضرات. يُرجى تحديث الصفحة.</p>';
    }
  }
  search.addEventListener('input',drawCards);
  try{if(localStorage.getItem('medatlas-theme')==='dark')document.body.classList.add('dark-mode')}catch(_){}
  theme.addEventListener('click',()=>{document.body.classList.toggle('dark-mode');try{localStorage.setItem('medatlas-theme',document.body.classList.contains('dark-mode')?'dark':'light')}catch(_){}});
  document.addEventListener('keydown',e=>{if(e.key==='/'&&!/INPUT|TEXTAREA/.test(document.activeElement.tagName)){e.preventDefault();search.focus()}});
  load();
  // زر الإدارة لا يظهر إطلاقاً في واجهة الزوار؛ الدخول المباشر: admin/
})();
