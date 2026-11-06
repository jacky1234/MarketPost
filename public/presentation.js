// 安全的 Markdown 子集：DOM text 节点构造，原始 HTML 始终按文本呈现。
export function markdown(text){
 const root=document.createElement('div');root.className='markdown';
 function inline(parent,value){
  const pattern=/(`[^`]+`|\*\*[^*]+\*\*|\[[^\]]+\]\([^\s)]+\))/g;let offset=0;
  for(const m of value.matchAll(pattern)){parent.append(document.createTextNode(value.slice(offset,m.index)));const token=m[0];let e;
   if(token.startsWith('`')){e=document.createElement('code');e.textContent=token.slice(1,-1);}
   else if(token.startsWith('**')){e=document.createElement('strong');e.textContent=token.slice(2,-2);}
   else{const parts=token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);try{const url=new URL(parts[2]);if(!['http:','https:'].includes(url.protocol))throw Error();e=document.createElement('a');e.href=url.href;e.rel='noopener noreferrer';e.target='_blank';e.textContent=parts[1];}catch{e=document.createTextNode(token);}}
   parent.append(e);offset=m.index+token.length;
  }parent.append(document.createTextNode(value.slice(offset)));
 }
 let list=null,code=null;
 for(const line of String(text??'').split(/\r?\n/)){
  if(/^```/.test(line)){if(code)code=null;else{const pre=document.createElement('pre');code=document.createElement('code');pre.append(code);root.append(pre);}list=null;continue;}
  if(code){code.textContent+=line+'\n';continue;}
  const heading=line.match(/^(#{1,6})\s+(.*)$/),li=line.match(/^\s*(?:[-*+] |\d+\. )(.*)$/);
  if(li){const kind=/^\s*\d+\./.test(line)?'ol':'ul';if(!list||list.tagName.toLowerCase()!==kind){list=document.createElement(kind);root.append(list);}const e=document.createElement('li');inline(e,li[1]);list.append(e);continue;}list=null;
  if(!line.trim())continue;const e=document.createElement(heading?'h'+heading[1].length:'p');inline(e,heading?heading[2]:line);root.append(e);
 }return root;
}
export function copyButton(label,text){const button=document.createElement('button');button.type='button';button.className='copy';button.textContent=label;let timer;
 button.onclick=async()=>{let copied=false;try{if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(text);copied=true;}}catch{}
  if(!copied){const active=document.activeElement,scroll=window.scrollY,area=document.createElement('textarea');area.value=text;area.className='clipboard-fallback';(document.querySelector('dialog[open]')||document.body).append(area);area.select();try{copied=document.execCommand('copy');}catch{}area.remove();active?.focus({preventScroll:true});window.scrollTo(0,scroll);}
  clearTimeout(timer);button.textContent=copied?'已复制':'复制失败，请重试';timer=setTimeout(()=>button.textContent=label,1500);
 };return button;}
export function signals(items){const list=document.createElement('div');list.className='signals';for(const s of items||[]){const row=document.createElement('div');row.className='signal';const level=document.createElement('span');level.className='signal-dot '+(['info','warn','strong'].includes(s.level)?s.level:'info');level.title=s.level;level.setAttribute('aria-label',s.level);row.append(level);for(const [key,label]of [['name','信号'],['condition','触发条件'],['meaning','意味着什么']]){const cell=document.createElement('div');const small=document.createElement('small');small.textContent=label;const value=document.createElement('span');value.textContent=s[key]??'';cell.append(small,value);row.append(cell);}list.append(row);}return list;}
