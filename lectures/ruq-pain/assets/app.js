/* RUQ Atlas | No frameworks, no build step, RTL-first and GitHub Pages compatible. */
(() => {
'use strict';
const $=(s,root=document)=>root.querySelector(s);
const $$=(s,root=document)=>Array.from(root.querySelectorAll(s));
const store={get(k,fall=null){try{const v=localStorage.getItem(`ruq-v2-${k}`);return v===null?fall:JSON.parse(v)}catch{return fall}},set(k,v){try{localStorage.setItem(`ruq-v2-${k}`,JSON.stringify(v))}catch{}}};
const normalize=(v)=>String(v||'').toLowerCase().normalize('NFKD').replace(/[\u064b-\u065f\u0670\u0640]/g,'').replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/[^\u0621-\u064a\w\s]/g,' ').replace(/\s+/g,' ').trim();
const cards=$$('.card[data-card-index]');
const sectionNames={top:'نظرة عامة',history:'القصة المرضية',exam:'الفحص السريري',pathophys:'الفيزيولوجيا المرضية',algorithm:'الخوارزميات الأربع',practice:'المختبر السريري',cards:'مكتبة التشخيصات',refs:'المراجع العلمية'};
const ranges={core:[1,12],surgical:[13,16],medical:[17,20],emergency:[21,25],elective:[26,30]};
let activeFilter='all', bookmarksOnly=false, savedCards=new Set(store.get('bookmarks',[])),collapsedCards=new Set(store.get('collapsed',[])),presenting=false,slideIndex=0,slides=[],timerId=null,timerStart=0;
let overlayRestoreFocus=null;

// Theme toggling: respects saved preference and OS default.
const userTheme=store.get('theme');
const osDark=window.matchMedia?.('(prefers-color-scheme: dark)').matches;
function setTheme(theme){document.documentElement.setAttribute('data-theme',theme);store.set('theme',theme);$('#toggleTheme').textContent=theme==='dark'?'☀':'☾';$('#toggleTheme').setAttribute('aria-label',theme==='dark'?'تفعيل الوضع الفاتح':'تفعيل الوضع الداكن')}
setTheme(userTheme||(osDark?'dark':'light'));
$('#toggleTheme').addEventListener('click',()=>setTheme(document.documentElement.getAttribute('data-theme')==='dark'?'light':'dark'));
$('#printLecture').addEventListener('click',()=>window.print());

// Sidebar and reading progress.
function closeMenu(){ $('#sidebar').classList.remove('is-open');$('#mobileScrim').hidden=true;document.body.classList.remove('menu-open') }
$('#openMenu').addEventListener('click',()=>{$('#sidebar').classList.add('is-open');$('#mobileScrim').hidden=false});
$('#closeMenu').addEventListener('click',closeMenu);
$('#mobileScrim').addEventListener('click',closeMenu);
$$('.sidebar-link').forEach(a=>a.addEventListener('click',closeMenu));
const chapters=[['top',$('header.hero')],['history',$('#history')],['exam',$('#exam')],['pathophys',$('#pathophys')],['algorithm',$('#algorithm')],['practice',$('#practice')],['cards',$('#cards')],['refs',$('#refs')]];
function readingState(){
 if(presenting)return;
 const max=Math.max(1,document.documentElement.scrollHeight-window.innerHeight);
 const value=Math.max(0,Math.min(100,Math.round(window.scrollY/max*100)));
 $('#readingProgress').style.width=`${value}%`;$('#sidebarPercent').textContent=`${value}%`;$('#sidebarMeter').style.width=`${value}%`;
 $('#backToTop').classList.toggle('show',window.scrollY>560);
 let current='top';for(const [id,node] of chapters){if(node?.getBoundingClientRect().top<180)current=id}
 $$('[data-nav]').forEach(n=>{const active=n.dataset.nav===current;n.classList.toggle('is-active',active);if(active)n.setAttribute('aria-current','location');else n.removeAttribute('aria-current')});
 $('#currentChapter').textContent=sectionNames[current];
 return value;
}
let rafPending=false,savePending=0;
window.addEventListener('scroll',()=>{if(rafPending)return;rafPending=true;requestAnimationFrame(()=>{rafPending=false;readingState();if(!presenting&&Date.now()-savePending>800){store.set('scrollY',Math.round(window.scrollY));savePending=Date.now()}})},{passive:true});
window.addEventListener('resize',readingState);
readingState();
$('#resumeReading').addEventListener('click',()=>{const pos=store.get('scrollY',0);window.scrollTo({top:Number(pos)||0,behavior:'smooth'});closeMenu()});
$('#backToTop').addEventListener('click',()=>window.scrollTo({top:0,behavior:'smooth'}));

// Diagnostic cards: bookmark, collapse, targeted filtering and deep links.
cards.forEach(card=>{
 const i=Number(card.dataset.cardIndex),label=String(i).padStart(2,'0');
 const category=i<=12?'core':i<=16?'surgical':i<=20?'medical':i<=25?'emergency':'elective';
 card.dataset.category=category;
 card.dataset.search=normalize(card.innerText||card.textContent);
 const tool=document.createElement('div');tool.className='card-tools';
 const bookmark=document.createElement('button');bookmark.type='button';bookmark.className='card-tool bookmark-btn';bookmark.dataset.bookmark=i;bookmark.setAttribute('aria-label',`حفظ البطاقة ${label}`);bookmark.textContent=savedCards.has(i)?'★ محفوظة':'☆ حفظ';bookmark.classList.toggle('is-saved',savedCards.has(i));bookmark.setAttribute('aria-pressed',String(savedCards.has(i)));
 const fold=document.createElement('button');fold.type='button';fold.className='card-tool fold-btn';fold.dataset.fold=i;fold.textContent=collapsedCards.has(i)?'↓ التفاصيل':'↑ طيّ';fold.setAttribute('aria-expanded',String(!collapsedCards.has(i)));
 const link=document.createElement('button');link.type='button';link.className='card-tool copy-btn';link.dataset.copy=i;link.textContent='↗ نسخ الرابط';link.setAttribute('aria-label',`نسخ رابط البطاقة ${label}`);
 tool.append(bookmark,fold,link);$('.card-head',card).append(tool);
 card.classList.toggle('is-collapsed',collapsedCards.has(i));
 bookmark.addEventListener('click',()=>{if(savedCards.has(i))savedCards.delete(i);else savedCards.add(i);store.set('bookmarks',[...savedCards]);bookmark.classList.toggle('is-saved',savedCards.has(i));bookmark.setAttribute('aria-pressed',String(savedCards.has(i)));bookmark.textContent=savedCards.has(i)?'★ محفوظة':'☆ حفظ';updateCatalog()});
 fold.addEventListener('click',()=>toggleCard(i));
 link.addEventListener('click',async()=>{const url=new URL(`#diagnosis-${label}`,location.href).href;try{await navigator.clipboard.writeText(url);link.textContent='✓ نُسخ الرابط'}catch{const tmp=document.createElement('textarea');tmp.value=url;document.body.append(tmp);tmp.select();document.execCommand('copy');tmp.remove();link.textContent='✓ نُسخ الرابط'}setTimeout(()=>link.textContent='↗ نسخ الرابط',1900)});
});
function toggleCard(i,force){const el=cards[i-1],collapse=force===undefined?!el.classList.contains('is-collapsed'):force;el.classList.toggle('is-collapsed',collapse);if(collapse)collapsedCards.add(i);else collapsedCards.delete(i);store.set('collapsed',[...collapsedCards]);const btn=$('[data-fold]',el);btn.textContent=collapse?'↓ التفاصيل':'↑ طيّ';btn.setAttribute('aria-expanded',String(!collapse))}
function showCard(i){if(i<1||i>30)return;activeFilter='all';bookmarksOnly=false;$('#catalogSearch').value='';$('#bookmarksOnly').setAttribute('aria-pressed','false');$$('[data-filter]').forEach(n=>n.classList.toggle('is-selected',n.dataset.filter==='all'));updateCatalog();toggleCard(i,false);cards[i-1].scrollIntoView({behavior:'smooth',block:'start'});history.replaceState(null,'',`#diagnosis-${String(i).padStart(2,'0')}`)}
function updateCatalog(){const q=normalize($('#catalogSearch').value);let visible=0;cards.forEach(card=>{const i=Number(card.dataset.cardIndex);const okCategory=activeFilter==='all'||card.dataset.category===activeFilter;const okBookmark=!bookmarksOnly||savedCards.has(i);const okText=!q||q.split(' ').every(token=>card.dataset.search.includes(token));const show=okCategory&&okBookmark&&okText;card.hidden=!show;if(show)visible++});$('#visibleCount').textContent=String(visible);$('#catalogEmpty').hidden=visible!==0}
$('#catalogSearch').addEventListener('input',updateCatalog);
$$('[data-filter]').forEach(btn=>btn.addEventListener('click',()=>{activeFilter=btn.dataset.filter;$$('[data-filter]').forEach(n=>n.classList.toggle('is-selected',n===btn));updateCatalog()}));
$('#bookmarksOnly').addEventListener('click',()=>{bookmarksOnly=!bookmarksOnly;$('#bookmarksOnly').setAttribute('aria-pressed',String(bookmarksOnly));$('#bookmarksOnly').textContent=bookmarksOnly?'★ عرض المحفوظات':'☆ المحفوظات';updateCatalog()});
$('#clearFilters').addEventListener('click',()=>{$('#catalogSearch').value='';activeFilter='all';bookmarksOnly=false;$('#bookmarksOnly').setAttribute('aria-pressed','false');$('#bookmarksOnly').textContent='☆ المحفوظات';$$('[data-filter]').forEach(n=>n.classList.toggle('is-selected',n.dataset.filter==='all'));updateCatalog()});
$('#expandCards').addEventListener('click',()=>cards.forEach(c=>toggleCard(Number(c.dataset.cardIndex),false)));
$('#collapseCards').addEventListener('click',()=>cards.forEach(c=>toggleCard(Number(c.dataset.cardIndex),true)));
updateCatalog();

// Find chapters and diagnoses; searches content, not just headings.
const searchIndex=[
 ...chapters.map(([id,node],i)=>({id,name:sectionNames[id],text:node?.textContent.slice(0,4000)||'',tag:i===0?'⌂':String(i).padStart(2,'0'),excerpt:'قسم من المحاضرة'})),
 ...cards.map((card,i)=>({id:card.id,name:$('.card-title',card).innerText.replace(/\n/g,' · '),text:card.dataset.search,tag:String(i+1).padStart(2,'0'),excerpt:$('.key-diff p',card)?.innerText.slice(0,150)||'بطاقة تشخيصية مفصّلة',cardIndex:i+1}))
];
searchIndex.forEach(item=>item.haystack=normalize(`${item.name} ${item.text}`));
const searchModal=$('#searchModal'),diagramModal=$('#diagramModal');
function openModal(modal){overlayRestoreFocus=document.activeElement;modal.hidden=false;modal.setAttribute('aria-hidden','false');document.body.style.overflow='hidden'}
function closeModal(modal){modal.hidden=true;modal.setAttribute('aria-hidden','true');if(searchModal.hidden&&diagramModal.hidden)document.body.style.overflow='';overlayRestoreFocus?.focus?.()}
function openSearch(){openModal(searchModal);$('#globalSearch').value='';renderSearch('');$('#globalSearch').focus()}
$('#openSearch').addEventListener('click',openSearch);
$$('[data-close-modal]').forEach(b=>b.addEventListener('click',()=>closeModal(b.closest('.modal-overlay'))));
[searchModal,diagramModal].forEach(m=>m.addEventListener('click',e=>{if(e.target===m)closeModal(m)}));
function renderSearch(query){const normalized=normalize(query),target=$('#searchResults');target.replaceChildren();if(!normalized){const hint=document.createElement('div');hint.className='search-hint';hint.textContent='جرّب: مورفي، TG18، اليرقان، خراج، Pyelonephritis…';target.append(hint);return}
 const terms=normalized.split(' '),found=searchIndex.filter(i=>terms.every(term=>i.haystack.includes(term))).sort((a,b)=>{const an=normalize(a.name),bn=normalize(b.name);return (Number(bn.startsWith(normalized))-Number(an.startsWith(normalized)))||Number(Boolean(b.cardIndex))-Number(Boolean(a.cardIndex))}).slice(0,18);
 if(!found.length){const empty=document.createElement('div');empty.className='search-hint';empty.textContent='لا توجد نتائج مطابقة؛ جرّب مصطلحاً مختلفاً.';target.append(empty);return}
 found.forEach(item=>{const link=document.createElement('a');link.href=`#${item.id}`;link.className='search-result';const badge=document.createElement('span');badge.className='search-result-index';badge.textContent=item.tag;const data=document.createElement('span');const title=document.createElement('strong');title.textContent=item.name;const desc=document.createElement('small');desc.textContent=item.excerpt;data.append(title,desc);link.append(badge,data);link.addEventListener('click',e=>{e.preventDefault();closeModal(searchModal);if(item.cardIndex)showCard(item.cardIndex);else{document.getElementById(item.id)?.scrollIntoView({behavior:'smooth',block:'start'});history.replaceState(null,'',`#${item.id}`)}});target.append(link)})
}
$('#globalSearch').addEventListener('input',e=>renderSearch(e.target.value));
$('#globalSearch').addEventListener('keydown',e=>{if(e.key==='Enter'){const first=$('.search-result',$('#searchResults'));if(first){e.preventDefault();first.click()}}});

// Four original Mermaid charts. A readable source remains if third-party CDN unavailable.
const diagramSources=JSON.parse($('#diagramData').textContent);
async function renderDiagrams(){
 if(!window.mermaid){$$('.diagram-host').forEach(host=>{const note=document.createElement('div');note.className='diagram-status';note.textContent='يتطلب العرض الرسومي اتصالاً بالإنترنت لتحميل Mermaid؛ النص الأصلي للخوارزمية متاح أدناه.';host.prepend(note)});return}
 try{window.mermaid.initialize({startOnLoad:false,securityLevel:'loose',theme:'base',themeVariables:{fontFamily:'Tajawal, Arial, sans-serif',primaryColor:'#f1f7f3',primaryBorderColor:'#18695d',primaryTextColor:'#143c37',lineColor:'#52776b',tertiaryColor:'#fff9e9'},flowchart:{htmlLabels:true,useMaxWidth:false,curve:'basis',nodeSpacing:35,rankSpacing:52}})}catch(e){console.warn('Mermaid init',e)}
 for(let i=0;i<diagramSources.length;i++){
  const host=$(`#diagram-${i}`);
  try{
   const result=await window.mermaid.render(`ruq-chart-${i}`,diagramSources[i]);
   const htmlStr=result.svg||result;
   const render=document.createElement('div');render.className='mermaid-render';render.innerHTML=htmlStr;
   host.prepend(render);host.classList.add('is-rendered');
   // Explicit SVG intrinsic sizing prevents tall decision trees being clipped by auto max-width.
   const svg=$('svg',render);if(svg){svg.removeAttribute('height');svg.style.maxWidth='none';svg.setAttribute('role','img');svg.setAttribute('aria-label',`الخوارزمية ${['0','A','B','C'][i]}`)}
  }catch(e){console.error('Diagram render failed',i,e);const note=document.createElement('p');note.className='diagram-status';note.textContent='تعذر رسم هذا المخطط آلياً؛ المخطط الأصلي متاح كنص أدناه.';host.prepend(note)}
 }
}
renderDiagrams();

// Native, dependency-free interactive explorer of the SAME Mermaid graph edges.
// This also makes the decision pathways usable without an online Mermaid renderer.
function buildGraph(source){
 const nodes={},edges=[];
 const expression=/^\s*([\w-]+)(?:\["(.*?)"\]|\{"(.*?)"\})?\s*-->\s*(?:\|(.*?)\|\s*)?([\w-]+)(?:\["(.*?)"\]|\{"(.*?)"\})?/;
 for(const line of source.split('\n')){
  const match=line.match(expression);if(!match)continue;
  const [_,from,fromBox,fromDecision,edgeText,to,toBox,toDecision]=match;
  if(fromBox||fromDecision)nodes[from]={id:from,text:fromBox||fromDecision,decision:Boolean(fromDecision)};
  if(toBox||toDecision)nodes[to]={id:to,text:toBox||toDecision,decision:Boolean(toDecision)};
  edges.push({from,to,label:edgeText||'متابعة'});
 }
 return {nodes,edges,start:edges[0]?.from};
}
function plainGraphLabel(value){const el=document.createElement('span');el.innerHTML=String(value||'').replace(/<br\s*\/?\s*>/gi,' — ').replace(/\\n/g,' ');return el.textContent.replace(/\s+/g,' ').trim()}
function setupDecisionExplorers(){
 diagramSources.forEach((source,index)=>{
  const graph=buildGraph(source);if(!graph.start||!Object.keys(graph.nodes).length)return;
  const details=document.createElement('details');details.className='decision-explorer';
  const summary=document.createElement('summary');summary.innerHTML='<span class="explorer-symbol">↳</span><span>جرّب الخوارزمية خطوة بخطوة <small>مسار قرار تفاعلي · يعمل دون اتصال</small></span><span class="explorer-chevron">⌄</span>';details.append(summary);
  const body=document.createElement('div');body.className='explorer-body';details.append(body);
  const crumb=document.createElement('div');crumb.className='explorer-breadcrumb';
  const current=document.createElement('div');current.className='explorer-node';
  const options=document.createElement('div');options.className='explorer-options';
  const actions=document.createElement('div');actions.className='explorer-actions';
  const back=document.createElement('button');back.type='button';back.textContent='→ رجوع خطوة';
  const reset=document.createElement('button');reset.type='button';reset.textContent='↺ البداية';
  const note=document.createElement('span');note.textContent='محاكاة تعليمية لمسارات الرسم الأصلي، وليست خوارزمية لاتخاذ قرار طبي مباشر.';
  actions.append(back,reset,note);body.append(crumb,current,options,actions);
  $(`#diagram-${index}`).insertAdjacentElement('afterend',details);
  let trail=[graph.start];
  function draw(){
   const key=trail[trail.length-1],node=graph.nodes[key];if(!node)return;
   crumb.replaceChildren();trail.forEach((id,j)=>{const part=document.createElement('span');part.textContent=j===0?'البداية':(j===trail.length-1?'الخطوة الحالية':`الخطوة ${j}`);part.className=j===trail.length-1?'is-current':'';crumb.append(part)});
   current.replaceChildren();const tag=document.createElement('span');tag.className='explorer-node-tag';tag.textContent=node.decision?'نقطة قرار':'محطة / نتيجة';const title=document.createElement('h4');title.textContent=plainGraphLabel(node.text);current.classList.toggle('is-decision',node.decision);current.append(tag,title);
   options.replaceChildren();const outgoing=graph.edges.filter(e=>e.from===key);
   if(outgoing.length){const tip=document.createElement('p');tip.className='explorer-prompt';tip.textContent='اختر فرعاً من الرسم الأصلي لمتابعة المسار:';options.append(tip);
    outgoing.forEach(edge=>{const btn=document.createElement('button');btn.type='button';btn.className='explorer-option';const sign=document.createElement('span');sign.className='explorer-option-label';sign.textContent=plainGraphLabel(edge.label);const to=document.createElement('span');to.textContent=plainGraphLabel(graph.nodes[edge.to]?.text||edge.to).slice(0,145);const arrow=document.createElement('b');arrow.textContent='←';btn.append(sign,to,arrow);btn.addEventListener('click',()=>{trail.push(edge.to);draw()});options.append(btn)});
   }else{const done=document.createElement('p');done.className='explorer-end';done.textContent='وصلت إلى نهاية هذا المسار في الرسم التعليمي. يمكنك الرجوع لتجربة فرع آخر.';options.append(done);
    const destination={ALGOA:1,ALGOB:2,ALGOC:3}[key];if(destination!==undefined){const a=document.createElement('a');a.href=`#diagram-${destination}`;a.className='explorer-jump';a.textContent=`↗ انتقل إلى الخوارزمية ${['0','A','B','C'][destination]}`;a.addEventListener('click',()=>{$(`#diagram-${destination}`).scrollIntoView({behavior:'smooth',block:'center'})});options.append(a)}
   }
   back.disabled=trail.length===1;
  }
  back.addEventListener('click',()=>{if(trail.length>1)trail.pop();draw()});reset.addEventListener('click',()=>{trail=[graph.start];draw()});draw();
 });
}
setupDecisionExplorers();
let zoom=1,panX=0,panY=0;
function syncZoom(){const canvas=$('#diagramCanvas');canvas.style.transform=`translate(${panX}px, ${panY}px) scale(${zoom})`;$('#zoomLevel').textContent=`${Math.round(zoom*100)}%`}
function openDiagram(i){const host=$(`#diagram-${i}`);$('#diagramModalTitle').textContent=`الخوارزمية (${['0','A','B','C'][i]}) — عرض تفصيلي`;const canvas=$('#diagramCanvas');canvas.replaceChildren();const item=$('.mermaid-render',host)||$('.diagram-fallback',host);if(item){const copy=item.cloneNode(true);copy.removeAttribute('id');canvas.append(copy)}zoom=1;panX=0;panY=0;syncZoom();openModal(diagramModal)}
$$('[data-zoom]').forEach(b=>b.addEventListener('click',()=>openDiagram(Number(b.dataset.zoom))));
$$('[data-source]').forEach(b=>b.addEventListener('click',()=>{const host=$(`#diagram-${b.dataset.source}`);const rendered=host.classList.contains('is-rendered');if(!rendered)return;host.classList.toggle('is-rendered');b.innerHTML=host.classList.contains('is-rendered')?'⌘ <span>النص</span>':'◈ <span>الرسم</span>'}));
$('#zoomIn').addEventListener('click',()=>{zoom=Math.min(3.5,zoom+.2);syncZoom()});
$('#zoomOut').addEventListener('click',()=>{zoom=Math.max(.35,zoom-.2);syncZoom()});
$('#zoomReset').addEventListener('click',()=>{zoom=1;panX=0;panY=0;syncZoom()});
const viewer=$('#diagramViewer');let dragging=false,prevPoint=null;
viewer.addEventListener('pointerdown',e=>{if(e.button!==0)return;dragging=true;prevPoint={x:e.clientX,y:e.clientY};viewer.setPointerCapture(e.pointerId)});
viewer.addEventListener('pointermove',e=>{if(!dragging||!prevPoint)return;panX+=e.clientX-prevPoint.x;panY+=e.clientY-prevPoint.y;prevPoint={x:e.clientX,y:e.clientY};syncZoom()});
viewer.addEventListener('pointerup',()=>{dragging=false;prevPoint=null});viewer.addEventListener('pointercancel',()=>{dragging=false;prevPoint=null});
viewer.addEventListener('wheel',e=>{e.preventDefault();zoom=Math.max(.35,Math.min(3.5,zoom+(e.deltaY>0?-.1:.1)));syncZoom()},{passive:false});

// Source-grounded single-best-answer challenge. Cases are educational simplifications.
const cases=[
 {q:'مريض يشكو ألماً مستمراً في المراق الأيمن منذ 9 ساعات، مع حمى وعلامة مورفي إيجابية. ما التشخيص الأكثر ترجيحاً؟',o:['المغص الصفراوي البسيط','التهاب المرارة الحاد','الهربس النطاقي','احتقان الكبد'],a:1,n:'استمرار الألم أكثر من ست ساعات مع الحمى وعلامة مورفي يدعم التهاب المرارة الحاد، ويحتاج تأكيداً بالتصوير وفق TG18.',c:1},
 {q:'ألم مراقي أيمن يترافق مع حمى وقشعريرة ويرقان وارتفاع إنزيمات الركود الصفراوي. أي تشخيص يجب التفكير فيه أولاً؟',o:['التهاب الأقنية الصفراوية الصاعد','التهاب الحويضة والكلية','المغص الصفراوي البسيط','الهربس النطاقي'],a:0,n:'ألم + حمى + يرقان هو ثالوث شاركو؛ ومعايير TG18 تجمع الالتهاب الجهازي والركود الصفراوي والتصوير.',c:2},
 {q:'مريض يعاني حمى متقطعة وتعرقاً ليلياً ونقص وزن وألماً مبهماً في المراق الأيمن، مع آفة كبدية سائلة بالتصوير. ما الأرجح؟',o:['خلل الحركة الصفراوية','المرارة الخزفية','خراج الكبد','متلازمة ميريزي'],a:2,n:'الحمى المطوّلة مع أعراض جهازية وآفة قيحية بالكبد تدعم الخراج الكبدي؛ يجب البحث عن سبب قيحي أو أميبي.',c:4},
 {q:'شابة لديها ألم حاد بالمراق الأيمن يزداد مع الشهيق، مع ألم حوضي وعلامات التهاب حوض. ما التشخيص المرتبط بالتهاب محفظة الكبد؟',o:['متلازمة فيتز-هيو-كورتس','احتقان كبدي','التهاب زائدة مرتفعة','بنكرياس حاد'],a:0,n:'متلازمة فيتز-هيو-كورتس تعني التهاباً حول الكبد مرتبطاً بالتهاب الحوض، وقد يقلّد الألم الصفراوي.',c:6},
 {q:'حمى وألم خلفي أيمن مع إيلام زاوية الضلع الفقرية وأعراض بولية سابقة. ما المصدر الأكثر احتمالاً للألم؟',o:['المرارة','الكلية اليمنى / التهاب الحويضة والكلية','الجنبة','المريء'],a:1,n:'الأعراض البولية مع إيلام الزاوية الضلعية الفقرية توجّه إلى التهاب الحويضة والكلية اليمنى.',c:11},
 {q:'ألم حارق أحادي الجانب على شكل حزام عصبي في أسفل الصدر الأيمن، دون طفح جلدي بعد. ما الاحتمال؟',o:['التهاب الكبد الحاد','المغص الكلوي','الهربس النطاقي قبل الطفح','التهاب الأقنية الصفراوية'],a:2,n:'قد يسبق الألم العصبي الحزامي ظهور حويصلات الهربس النطاقي بعدة أيام، فيبدو كأنه ألم بطني.',c:12},
 {q:'نوبات صفراوية متكررة مع يرقان انسدادي تدريجي، ويُشتبه بانحشار حصاة في عنق المرارة تضغط على القناة الكبدية. ما الاسم؟',o:['متلازمة ميريزي','التهاب المرارة اللاحصوي','متلازمة بود-كياري','سرطان الكبد'],a:0,n:'متلازمة ميريزي تنجم عن ضغط الحصاة المحشورة في عنق المرارة أو القناة المرارية على مجرى الصفراء المجاور.',c:14},
 {q:'ألم شرسوفي شديد منتشر نحو الظهر مع ارتفاع الليباز، وقد يتركز جزئياً بالمراق الأيمن عندما يتأثر رأس البنكرياس. ما التشخيص؟',o:['التهاب المرارة المزمن','التهاب البنكرياس الحاد','المرارة الخزفية','التهاب الحويضة والكلية'],a:1,n:'انتشار الألم للظهر وارتفاع الإنزيمات البنكرياسية يدعم التهاب البنكرياس الحاد الذي قد يظهر بصورة تتركز يميناً.',c:17},
 {q:'ألم مراقي أيمن يزداد بالشهيق، مع ضيق نفس مفاجئ وعوامل خطورة خثارية، والفحص البطني قليل الموجودات. ما الخطر؟',o:['تضخم الكبد الحميد','الانصمام الرئوي','التهاب المرارة المزمن','الهربس النطاقي'],a:1,n:'قد يسبّب الانصمام الرئوي السفلي ألماً منعكساً بالمراق الأيمن مع ضيق نفس مفاجئ وألم جنبي.',c:18},
 {q:'سكري معروف مع ألم بطني وغثيان، عطش وبوال شديدان وتنفس كوسمول. ما الفحص/الاحتمال الذي لا يجوز تفويته؟',o:['الحماض الكيتوني السكري','متلازمة ميريزي','المرارة الخزفية','التهاب كبد فيروسي'],a:0,n:'الحماض الكيتوني السكري قد يسبّب ألماً بطنياً شديداً؛ يجب فحص السكر والكيتونات والحالة الحمضية.',c:20},
 {q:'مريض في العناية المركزة بعد حروق وصدمة، مع حمى وألم مراقي أيمن وتصوير لا يُظهر حصيات. ما الحالة المهمة؟',o:['المغص الصفراوي البسيط','التهاب المرارة الحاد اللاحصوي','خلل الحركة الصفراوية','الهربس النطاقي'],a:1,n:'التهاب المرارة اللاحصوي أكثر ارتباطاً بالمرض الحرج والصدمة والحروق وقد يحدث دون حصيات.',c:21},
 {q:'مريض سكري مع أعراض التهاب مرارة شديد، يُظهر التصوير غازاً داخل جدار المرارة. ما المضاعفة المرعبة؟',o:['التهاب المرارة الغازي','المرارة الخزفية','التهاب المرارة المزمن','الركود الكبدي'],a:0,n:'وجود الغاز في جدار المرارة مع السياق الالتهابي يُشير إلى التهاب المرارة الغازي الذي يحتاج تقييماً إسعافياً.',c:22},
 {q:'ألم مستمر وحمى بعد خمسة أيام من استئصال المرارة، مع سائل صفراوي ظاهر عبر أنبوب التصريف. ما أول ما يجب استقصاؤه؟',o:['متلازمة بود-كياري','التسرب الصفراوي بعد الاستئصال','التهاب حويضة وكلية','أزمة كبد منجلية'],a:1,n:'خروج الصفراء أو تجمع سائل بعد استئصال المرارة يدفع إلى البحث عن تسرب صفراوي وتحديد موقع الإصابة.',c:16},
 {q:'اكتشاف تكلس بجدار المرارة عرضياً لدى مريض دون أعراض، مع نمط تكلس بقعي غير منتظم. ما الحالة؟',o:['التهاب الكبد الحاد','المغص الصفراوي','المرارة الخزفية','خراج تحت حجابي'],a:2,n:'التكلس الجداري للمرارة يُسمّى المرارة الخزفية، وتختلف خطة التعامل بحسب نمط التكلس والمخاطر الجراحية.',c:27}
];
let caseOrder=cases.map((_,i)=>i),casePosition=-1,correctCount=0,answeredCount=0,answered=false;
function renderCase(){
 const total=cases.length;
 $('#quizTracker').textContent=casePosition<0?`14 حالة تعليمية`:`الحالة ${String(casePosition+1).padStart(2,'0')} / ${total}`;
 $('#quizMeter').style.width=`${casePosition<0?0:(casePosition+1)/total*100}%`;
 $('#quizChoices').replaceChildren();$('#quizFeedback').hidden=true;$('#quizFeedback').classList.remove('incorrect');
 $('#quizScore').textContent=`النتيجة: ${correctCount} / ${answeredCount}`;
 if(casePosition<0){$('#quizQuestion').textContent='14 حالة سريرية تعليمية. اقرأ كل سيناريو واختر التشخيص الأرجح ثم راجع تفسير الإجابة.';$('#quizNext').textContent='ابدأ التحدي ←';$('#quizNext').disabled=false;return}
 if(casePosition>=total){const percent=Math.round(correctCount/total*100);$('#quizQuestion').textContent=`أكملت التحدي! حصلت على ${correctCount} من ${total} (${percent}%). راجع بطاقات الحالات التي تحتاج إلى تثبيت.`;$('#quizTracker').textContent='نهاية التحدي';$('#quizNext').textContent='ابدأ مجدداً ←';$('#quizNext').disabled=false;return}
 const item=cases[caseOrder[casePosition]];$('#quizQuestion').textContent=item.q;$('#quizNext').textContent=casePosition===total-1?'عرض النتيجة ←':'الحالة التالية ←';$('#quizNext').disabled=true;
 item.o.forEach((option,i)=>{const btn=document.createElement('button');btn.type='button';btn.className='quiz-choice';btn.dataset.choice=String(i);const letter=document.createElement('span');letter.className='choice-letter';letter.textContent=['A','B','C','D'][i];const name=document.createElement('span');name.textContent=option;btn.append(letter,name);btn.addEventListener('click',()=>chooseCase(i));$('#quizChoices').append(btn)})
}
function chooseCase(i){if(answered||casePosition<0||casePosition>=cases.length)return;answered=true;answeredCount++;const item=cases[caseOrder[casePosition]],correct=i===item.a;if(correct)correctCount++;
 $$('.quiz-choice').forEach(btn=>{const index=Number(btn.dataset.choice);btn.disabled=true;btn.classList.toggle('is-correct',index===item.a);btn.classList.toggle('is-wrong',index===i&&!correct)});
 const f=$('#quizFeedback');f.replaceChildren();f.hidden=false;f.classList.toggle('incorrect',!correct);
 const strong=document.createElement('strong');strong.textContent=correct?'✓ إجابة صحيحة':'↗ للتصحيح والتثبيت';const p=document.createElement('div');p.textContent=item.n;const a=document.createElement('a');a.href=`#diagnosis-${String(item.c).padStart(2,'0')}`;a.textContent='راجع البطاقة العلمية المرتبطة ←';a.addEventListener('click',e=>{e.preventDefault();if(presenting)leavePresentation();showCard(item.c)});f.append(strong,p,a);
 $('#quizScore').textContent=`النتيجة: ${correctCount} / ${answeredCount}`;$('#quizNext').disabled=false;
}
$('#quizNext').addEventListener('click',()=>{if(casePosition===cases.length){casePosition=-1;correctCount=0;answeredCount=0}casePosition++;answered=false;renderCase()});
$('#quizRestart').addEventListener('click',()=>{casePosition=-1;correctCount=0;answeredCount=0;answered=false;renderCase()});
renderCase();

// Presenter: chapter-by-chapter and one diagnostic card / algorithm per slide.
function createSlides(){slides=[{chapter:'top',node:$('header.hero'),title:'المحاضرة: نظرة عامة'},{chapter:'history',node:$('#history'),title:'القصة المرضية'},{chapter:'exam',node:$('#exam'),title:'الفحص السريري'},{chapter:'pathophys',node:$('#pathophys'),title:'الفيزيولوجيا المرضية'}];
 for(let i=0;i<4;i++)slides.push({chapter:'algorithm',node:$('#algorithm'),algo:i,title:`الخوارزمية ${['0','A','B','C'][i]}`});
 slides.push({chapter:'practice',node:$('#practice'),title:'المختبر السريري'});
 cards.forEach((c,i)=>slides.push({chapter:'cards',node:$('#cards'),card:i+1,title:`التشخيص ${String(i+1).padStart(2,'0')} · ${$('.card-title',c).innerText.split('\n')[0]}`}));
 slides.push({chapter:'refs',node:$('#refs'),title:'المراجع العلمية'});
}
createSlides();
function applySlide(){const slide=slides[slideIndex];$$('.site-main>.hero,.site-main>.toc,.site-main>section.block,.site-main>.final').forEach(e=>e.classList.remove('present-active'));slide.node.classList.add('present-active');
 cards.forEach((c,i)=>c.classList.toggle('present-card-active',i+1===slide.card));
 const wraps=$$('#algorithm .algo-wrap'),heads=$$('#algorithm h3');wraps.forEach((node,i)=>node.classList.toggle('present-algo-active',i===slide.algo));heads.forEach((node,i)=>node.classList.toggle('present-algo-active',i===slide.algo));
 if(slide.card)toggleCard(slide.card,false);
 $('#presentationTitle').textContent=slide.title;$('#presentationCount').textContent=`${String(slideIndex+1).padStart(2,'0')} / ${slides.length}`;
 $('#presentPrev').disabled=slideIndex===0;$('#presentNext').disabled=slideIndex===slides.length-1;
 window.scrollTo({top:0,behavior:'instant'});
}
function enterPresentation(){if(presenting)return;presenting=true;const hash=location.hash.replace('#','');let idx=slides.findIndex(s=>s.chapter===hash||s.node.id===hash);
 if(hash.startsWith('diagnosis-'))idx=slides.findIndex(s=>s.card===Number(hash.split('-')[1]));
 slideIndex=Math.max(0,idx);document.body.classList.add('presentation-mode');$('#presentationToolbar').hidden=false;timerStart=Date.now();$('#presentationTimer').textContent='00:00';clearInterval(timerId);timerId=setInterval(()=>{const sec=Math.floor((Date.now()-timerStart)/1000);$('#presentationTimer').textContent=`${String(Math.floor(sec/60)).padStart(2,'0')}:${String(sec%60).padStart(2,'0')}`},1000);applySlide()}
function leavePresentation(){if(!presenting)return;presenting=false;clearInterval(timerId);document.body.classList.remove('presentation-mode');$('#presentationToolbar').hidden=true;$$('.present-active,.present-card-active,.present-algo-active').forEach(e=>e.classList.remove('present-active','present-card-active','present-algo-active'));window.scrollTo({top:0,behavior:'instant'});readingState()}
function changeSlide(delta){slideIndex=Math.max(0,Math.min(slides.length-1,slideIndex+delta));applySlide()}
$$('[data-action="present"]').forEach(b=>b.addEventListener('click',enterPresentation));
$('#leavePresentation').addEventListener('click',leavePresentation);
$('#presentPrev').addEventListener('click',()=>changeSlide(-1));$('#presentNext').addEventListener('click',()=>changeSlide(1));
window.addEventListener('keydown',e=>{
 const tag=document.activeElement?.tagName?.toLowerCase(),typing=tag==='input'||tag==='textarea';
 if(e.key==='Escape'){if(!diagramModal.hidden)closeModal(diagramModal);else if(!searchModal.hidden)closeModal(searchModal);else if(presenting)leavePresentation();else closeMenu();return}
 if(e.key==='/'&&!typing&&searchModal.hidden&&!presenting){e.preventDefault();openSearch();return}
 if(presenting&&searchModal.hidden&&diagramModal.hidden&&!typing){if(e.key==='ArrowLeft'||e.key==='PageDown'){e.preventDefault();changeSlide(1)}if(e.key==='ArrowRight'||e.key==='PageUp'){e.preventDefault();changeSlide(-1)}}
});
if(location.hash?.startsWith('#diagnosis-')){const i=Number(location.hash.split('-')[1]);if(i>=1&&i<=30){toggleCard(i,false);setTimeout(()=>cards[i-1].scrollIntoView({block:'start'}),200)}}

// Offline support after an initial online load. Mermaid is a CDN asset and may require network on first use.
if('serviceWorker' in navigator && location.protocol!=='file:')window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
})();
