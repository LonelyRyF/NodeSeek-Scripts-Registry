(function(){"use strict";const API=window.NodeSeekUI;if(!API){console.error("未检测到 NodeSeek UI 基座，帖子预览模块已停止加载");return;}
const MODULE_ID="post_preview";const MODULE_NAME="帖子预览";const MODULE_VERSION="1.0.0";const STYLE_ID=MODULE_ID+"_style";const TOOLTIP_ID=MODULE_ID+"_tooltip";const DEFAULT_LINK_SELECTOR=".post-list-item .post-title a[href*=\"/post-\"], .nsk-post .post-title-link[href*=\"/post-\"]";const FETCH_TIMEOUT=6000;const CACHE_TTL=10*60;const DEFAULTS={hoverDelay:450,maxWidth:680,};const SCHEMA=[{type:"section",title:"预览设置",fields:[{key:"hoverDelay",type:"number",label:"悬停延迟 (ms)",description:"鼠标停留多久后显示预览卡片。",default:DEFAULTS.hoverDelay,min:0,max:3000,step:50,},{key:"maxWidth",type:"number",label:"卡片宽度 (px)",description:"预览卡片的最大宽度。",default:DEFAULTS.maxWidth,min:420,max:960,step:20,},],},];const pendingRequests=new Map();let runtimeAPI=API;let config=normalizeConfig(DEFAULTS);let listenersAttached=false;let activeLink=null;let activeRequestId=0;let hoverTimer=null;let hideTimer=null;let positionFrame=0;let tooltip=null;let markdownRenderer;function clampNumber(value,fallback,min,max){const num=Number(value);if(!Number.isFinite(num))return fallback;if(typeof min==="number"&&num<min)return min;if(typeof max==="number"&&num>max)return max;return num;}
function normalizeConfig(raw){const data=raw&&typeof raw==="object"?raw:{};return{hoverDelay:clampNumber(data.hoverDelay,DEFAULTS.hoverDelay,0,3000),maxWidth:clampNumber(data.maxWidth,DEFAULTS.maxWidth,420,960),};}
function injectStyles(){runtimeAPI.addStyle(`
      #${TOOLTIP_ID} {
        position: fixed;
        z-index: 10019;
        width: min(calc(100vw - 24px), var(--ns-post-preview-max-width, 680px));
        box-sizing: border-box;
        color: var(--text-color);
        background-color: var(--bg-main-color);
        border: 1px solid var(--glass-color);
        border-left: 4px solid var(--main-color);
        border-radius: 4px;
        box-shadow: #0000003d 0 3px 8px;
        overflow: hidden;
        pointer-events: auto;
      }

      #${TOOLTIP_ID} * {
        box-sizing: border-box;
      }

      #${TOOLTIP_ID} .post-preview-banner {
        padding: 3px 8px;
        color: var(--gray-color);
        background-color: var(--bg-sub-color);
        border-bottom: 1px solid var(--glass-color);
        font-size: 11px;
        line-height: 18px;
      }

      #${TOOLTIP_ID} .content-item {
        border-bottom: none;
      }

      #${TOOLTIP_ID} .nsk-post .post-title h1 {
        padding-right: 48px;
      }

      #${TOOLTIP_ID} .post-content {
        max-height: min(420px, calc(100vh - 220px));
        overflow: auto;
      }

      #${TOOLTIP_ID} .post-preview-plain {
        white-space: pre-wrap;
      }

      #${TOOLTIP_ID} .signature {
        max-height: none;
        margin: 0 8px 8px;
      }

      #${TOOLTIP_ID} .post-preview-error {
        color: #d74c4c;
      }

      #${TOOLTIP_ID} .post-preview-extra {
        margin-left: 4px;
      }
    `,STYLE_ID);}
function removeStyles(){runtimeAPI.removeStyle(STYLE_ID);}
function cacheGet(key){if(runtimeAPI.cache&&typeof runtimeAPI.cache.get==="function")return runtimeAPI.cache.get(key);if(API.sharedCache&&typeof API.sharedCache.get==="function")return API.sharedCache.get(`${MODULE_ID}:${key}`);return undefined;}
function cacheSet(key,value,ttlSeconds){if(!ttlSeconds)return;if(runtimeAPI.cache&&typeof runtimeAPI.cache.set==="function"){runtimeAPI.cache.set(key,value,{ttl:ttlSeconds});return;}
if(API.sharedCache&&typeof API.sharedCache.set==="function"){API.sharedCache.set(`${MODULE_ID}:${key}`,value,{ttl:ttlSeconds});}}
function cleanText(text){return String(text||"").replace(/\u00a0/g," ").replace(/[ \t\r\n]+/g," ").trim();}
function escapeHtml(text){return String(text||"").replace(/[&<>"]/g,(char)=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[char]));}
function toAbsoluteUrl(value){if(!value)return"";try{const url=new URL(value,window.location.origin);if(url.protocol!=="http:"&&url.protocol!=="https:")return"";return url.href;}catch(e){return"";}}
function getNormalizedPostUrl(value){try{const url=new URL(value,window.location.origin);if(url.origin!==window.location.origin)return"";const match=url.pathname.match(/^\/post-(\d+)-\d+/);if(!match)return"";url.pathname=`/post-${match[1]}-1`;url.hash="";return url.href;}catch(e){return"";}}
function getText(root,selector){const el=root&&root.querySelector(selector);return cleanText(el&&el.textContent);}
function getTimeText(timeEl){if(!timeEl)return"";return cleanText(timeEl.getAttribute("title")||timeEl.textContent||timeEl.getAttribute("datetime"));}
function decodeBase64Utf8(value){try{const text=atob(String(value||"").replace(/\s+/g,""));return new TextDecoder().decode(Uint8Array.from(text,(char)=>char.charCodeAt(0)));}catch(e){return"";}}
function parseTempScriptData(html){const match=String(html||"").match(/<script id="temp-script" type="application\/json">([\s\S]*?)<\/script>/);if(!match)return null;const text=decodeBase64Utf8(match[1]);if(!text)return null;try{return JSON.parse(text);}catch(e){return null;}}
function getMarkdownRenderer(){if(markdownRenderer!==undefined)return markdownRenderer;const MarkdownIt=window.markdownit;if(typeof MarkdownIt!=="function")return(markdownRenderer=null);markdownRenderer=new MarkdownIt({breaks:true,linkify:true,highlight(code,lang){if(lang!=="ansi")return"";return escapeHtml(code).replace(/[\x00-\x1F\x7F]/g,(char)=>{return char==="\n"||char==="\r"||char==="\t"?char:`<span data-ansicode="${char.charCodeAt(0)}"></span>`;});},});return markdownRenderer;}
function parseTabsBlock(lines,startIndex){const items=[];for(let index=startIndex+1;index<lines.length;){const line=lines[index].trim();if(line==="::::")return items.length?{items,endIndex:index}:null;const match=line.match(/^:::\s*tab-item\s+(.+)$/);if(!match)return null;const body=[];for(index+=1;index<lines.length&&lines[index].trim()!==":::";index+=1)body.push(lines[index]);if(index>=lines.length)return null;items.push({title:match[1],body:body.join("\n").trim()});index+=1;}
return null;}
function renderTabsHtml(items,md){return`<div class="nsk-magic-tabs">${items.map((item) => `<div class="nsk-magic-tab-title">${escapeHtml(item.title)}</div><div class="nsk-magic-tab-body">${md.render(item.body)}</div>`).join("")}</div>`;}
function renderMarkdownContent(markdown){const md=getMarkdownRenderer();const source=String(markdown||"").replace(/\r\n?/g,"\n").trim();if(!md||!source)return"";if(!source.includes(":::: tabs"))return md.render(source);const lines=source.split("\n");const parts=[];const buffer=[];const flush=()=>{const block=buffer.join("\n").trim();buffer.length=0;if(block)parts.push(md.render(block));};for(let index=0;index<lines.length;index+=1){if(lines[index].trim()===":::: tabs"){const parsed=parseTabsBlock(lines,index);if(parsed){flush();parts.push(renderTabsHtml(parsed.items,md));index=parsed.endIndex;continue;}}
buffer.push(lines[index]);}
flush();return parts.join("\n");}
function collectListInfo(link){const url=getNormalizedPostUrl(link.href);if(!url)return null;const item=link.closest(".post-list-item");const sourceUrl=toAbsoluteUrl(link.href)||url;const info={url,sourceUrl,title:cleanText(link.textContent)||link.getAttribute("title")||"未命名帖子",author:"",authorUrl:"",avatar:"",views:"",comments:"",category:"",categoryUrl:"",lastCommenter:"",lastReplyTime:"",};if(!item)return info;const authorLink=item.querySelector(".info-author a");const avatar=item.querySelector(".avatar-normal[data-uid], a[href^=\"/space/\"] img.avatar-normal");const categoryLink=item.querySelector(".post-category");const lastCommenterLink=item.querySelector(".info-last-commenter a");const timeEl=item.querySelector(".info-last-comment-time time");info.author=cleanText(authorLink&&authorLink.textContent);info.authorUrl=toAbsoluteUrl(authorLink&&authorLink.getAttribute("href"));info.avatar=toAbsoluteUrl(avatar&&avatar.getAttribute("src"));info.views=getText(item,".info-views span");info.comments=getText(item,".info-comments-count span");info.category=cleanText(categoryLink&&categoryLink.textContent);info.categoryUrl=toAbsoluteUrl(categoryLink&&categoryLink.getAttribute("href"));info.lastCommenter=cleanText(lastCommenterLink&&lastCommenterLink.textContent);info.lastReplyTime=getTimeText(timeEl);return info;}
function extractDetailFromHtml(html,postUrl){const data=parseTempScriptData(html);const postData=data&&data.postData;const comment=postData&&Array.isArray(postData.comments)?postData.comments[0]:null;const poster=comment&&comment.poster;const time=comment&&comment.time;return{url:postUrl,title:cleanText(postData&&postData.title),author:cleanText(poster&&poster.name),authorUrl:toAbsoluteUrl(poster&&poster.profile),avatar:toAbsoluteUrl(poster&&poster.avatar),createdTime:cleanText(time&&(time.createdDateFormated||time.createdDateRel||time.createdDate)),category:cleanText(postData&&postData.categoryWord),categoryUrl:toAbsoluteUrl(postData&&postData.categoryLink),views:cleanText(postData&&postData.views),content:comment?String(comment.markdown||""):"",};}
async function fetchPostDetail(postUrl){const cacheKey=`detail:${postUrl}`;const cached=cacheGet(cacheKey);if(cached&&typeof cached==="object")return{...cached,fromCache:true};if(pendingRequests.has(cacheKey))return pendingRequests.get(cacheKey);const promise=runtimeAPI.request({url:new URL(postUrl,window.location.origin).pathname,method:"GET",timeout:FETCH_TIMEOUT}).then((response)=>{const html=response.responseText||response.response||"";const detail=extractDetailFromHtml(html,postUrl);cacheSet(cacheKey,detail,CACHE_TTL);return detail;}).finally(()=>pendingRequests.delete(cacheKey));pendingRequests.set(cacheKey,promise);return promise;}
function renderLink(url,text,className,blank){const safeText=escapeHtml(text);const cls=className?` class="${className}"`:"";if(!url)return`<span${cls}>${safeText}</span>`;return`<a${cls} href="${escapeHtml(url)}"${blank ? ' target="_blank" rel="noopener noreferrer"' : ""}>${safeText}</a>`;}
function ensureTooltip(){if(tooltip&&document.body.contains(tooltip))return tooltip;tooltip=document.createElement("div");tooltip.id=TOOLTIP_ID;tooltip.className="nsk-post-wrapper";tooltip.addEventListener("pointerenter",clearHideTimer);tooltip.addEventListener("pointerleave",scheduleHide);document.body.appendChild(tooltip);return tooltip;}
function setupMagicTabs(root){root.querySelectorAll(".nsk-magic-tabs").forEach((tabs)=>{const children=Array.from(tabs.children);const titles=children.filter((el)=>el.classList.contains("nsk-magic-tab-title"));const bodies=children.filter((el)=>el.classList.contains("nsk-magic-tab-body"));if(!titles.length||!bodies.length)return;tabs.classList.add("enabled");const activate=(index)=>{titles.forEach((title,i)=>title.classList.toggle("is-active",i===index));bodies.forEach((body,i)=>{body.style.display=i===index?"":"none";});};titles.forEach((title,index)=>{title.addEventListener("click",(event)=>{event.preventDefault();event.stopPropagation();activate(index);});});activate(0);});}
function readAnsiCodeBlock(code){let text="";code.childNodes.forEach((node)=>{if(node.nodeType===Node.TEXT_NODE){text+=node.textContent||"";}else if(node instanceof HTMLElement&&node.dataset.ansicode){text+=String.fromCharCode(parseInt(node.dataset.ansicode,10));}else{text+=node.textContent||"";}});return text.replace(/\x1B\[[0-?]*[ -/]*[@-~]/g,"").trim();}
function normalizeAnsiBlocks(root){root.querySelectorAll("code.language-ansi").forEach((code)=>{const text=readAnsiCodeBlock(code);if(text)code.textContent=text;});}
function renderTooltip(baseInfo,detail,state){const box=ensureTooltip();const data={...baseInfo,...(detail||{})};const openUrl=baseInfo.sourceUrl||data.url;const timeText=data.createdTime||data.lastReplyTime;const renderedContent=!state||(!state.loading&&!state.error)?renderMarkdownContent(data.content):"";const plainContent=escapeHtml(String(data.content||"暂无可预览内容").replace(/\r\n?/g,"\n")).replace(/\n/g,"<br>");const metaExtra=[data.views&&`浏览 ${data.views}`,data.comments&&`评论 ${data.comments}`,data.lastCommenter&&`最后回复 ${data.lastCommenter}`,].filter(Boolean).map((text)=>`<span class="post-preview-extra">${escapeHtml(text)}</span>`).join("");box.style.setProperty("--ns-post-preview-max-width",config.maxWidth+"px");box.innerHTML=`<div class="post-preview-banner">帖子预览 · 鼠标移入卡片可停留查看</div><div class="nsk-post"><div class="post-title"><h1>${renderLink(openUrl, data.title || "未命名帖子", "post-title-link", true)}</h1></div></div><div class="content-item"><div class="nsk-content-meta-info">${data.avatar ? `<div class="avatar-wrapper">${data.authorUrl?`<a href="${escapeHtml(data.authorUrl)}">`:"<span>"}<img class="avatar-normal"src="${escapeHtml(data.avatar)}"alt="${escapeHtml(data.author || "avatar")}"referrerpolicy="no-referrer">${data.authorUrl?"</a>":"</span>"}</div>` : ""}<div><div class="author-info">${renderLink(data.authorUrl, data.author || "未知作者", "author-name")}<span class="role-tag">${MODULE_NAME}</span></div><div class="content-info">${timeText ? `<span class="date-created"><time>${escapeHtml(timeText)}</time></span>` : ""}${data.category ? `<span class="content-category">in ${renderLink(data.categoryUrl,data.category)}</span>` : ""}${metaExtra}</div></div></div><article class="post-content">${state && state.loading ? "<p>正在获取首楼内容...</p>" : state && state.error ? `<p class="post-preview-error">无法获取首楼内容：${escapeHtml(state.error)}</p>` : renderedContent || `<p class="post-preview-plain">${plainContent}</p>`}</article><div class="signature"><a href="${escapeHtml(openUrl)}" target="_blank" rel="noopener noreferrer">打开帖子</a><span> | ${detail && detail.fromCache ? "来自缓存" : "悬停预览"}</span></div></div>`;const avatar=box.querySelector(".avatar-normal");if(avatar)avatar.onerror=()=>avatar.closest(".avatar-wrapper")?.remove();const article=box.querySelector("article.post-content");if(article&&renderedContent){normalizeAnsiBlocks(article);article.querySelectorAll("img").forEach((img)=>{img.replaceWith(document.createTextNode(img.alt?`[图片: ${img.alt}]`:"[图片]"));});article.querySelectorAll("a").forEach((link)=>{link.target="_blank";link.rel="noopener noreferrer";});setupMagicTabs(article);}}
function positionTooltip(){if(!tooltip||!activeLink||!document.body.contains(activeLink))return;const margin=12;const gap=10;const rect=activeLink.getBoundingClientRect();const width=tooltip.offsetWidth||config.maxWidth;const height=tooltip.offsetHeight||180;let left=rect.left;let top=rect.bottom+gap;if(top+height>window.innerHeight-margin){top=rect.top-height-gap;}
if(left+width>window.innerWidth-margin)left=window.innerWidth-width-margin;if(left<margin)left=margin;if(top<margin)top=margin;tooltip.style.left=Math.round(left)+"px";tooltip.style.top=Math.round(top)+"px";}
function schedulePosition(){if(positionFrame)return;positionFrame=requestAnimationFrame(()=>{positionFrame=0;positionTooltip();});}
function clearHoverTimer(){if(hoverTimer){clearTimeout(hoverTimer);hoverTimer=null;}}
function clearHideTimer(){if(hideTimer){clearTimeout(hideTimer);hideTimer=null;}}
function scheduleHide(){clearHideTimer();hideTimer=setTimeout(hideTooltip,140);}
function hideTooltip(){clearHoverTimer();clearHideTimer();activeLink=null;activeRequestId+=1;if(tooltip){tooltip.remove();tooltip=null;}}
function findPreviewLink(target){if(!(target instanceof Element))return null;if(target.closest(`#${TOOLTIP_ID}`))return null;const link=target.closest(DEFAULT_LINK_SELECTOR);if(!link||!getNormalizedPostUrl(link.href))return null;return link;}
function showPreview(link){const baseInfo=collectListInfo(link);if(!baseInfo)return;const requestId=++activeRequestId;renderTooltip(baseInfo,null,{loading:true});positionTooltip();fetchPostDetail(baseInfo.url).then((detail)=>{if(requestId!==activeRequestId||activeLink!==link)return;renderTooltip(baseInfo,detail,null);schedulePosition();}).catch((error)=>{if(requestId!==activeRequestId||activeLink!==link)return;const message=error&&error.message?error.message:String(error||"未知错误");renderTooltip(baseInfo,null,{error:message});schedulePosition();console.error("[NS][post_preview] 获取帖子预览失败",error);});}
function handlePointerOver(event){if(event.pointerType&&event.pointerType!=="mouse"&&event.pointerType!=="pen")return;const link=findPreviewLink(event.target);if(!link||link===activeLink)return;clearHoverTimer();clearHideTimer();hideTooltip();activeLink=link;hoverTimer=setTimeout(()=>{hoverTimer=null;if(activeLink===link&&document.body.contains(link))showPreview(link);},config.hoverDelay);}
function handlePointerOut(event){const link=findPreviewLink(event.target);if(!link||link!==activeLink)return;const related=event.relatedTarget;if(related&&(link.contains(related)||(tooltip&&tooltip.contains(related))))return;scheduleHide();}
function handleViewportChange(){if(!tooltip)return;if(!activeLink||!document.body.contains(activeLink)){hideTooltip();return;}
schedulePosition();}
function handleKeydown(event){if(event.key==="Escape")hideTooltip();}
function attachListeners(){if(listenersAttached)return;document.addEventListener("pointerover",handlePointerOver,true);document.addEventListener("pointerout",handlePointerOut,true);document.addEventListener("keydown",handleKeydown,true);window.addEventListener("scroll",handleViewportChange,true);window.addEventListener("resize",handleViewportChange);listenersAttached=true;}
function detachListeners(){if(!listenersAttached)return;document.removeEventListener("pointerover",handlePointerOver,true);document.removeEventListener("pointerout",handlePointerOut,true);document.removeEventListener("keydown",handleKeydown,true);window.removeEventListener("scroll",handleViewportChange,true);window.removeEventListener("resize",handleViewportChange);listenersAttached=false;}
function start(){stop();config=normalizeConfig(API.getConfig(MODULE_ID,SCHEMA));injectStyles();attachListeners();}
function stop(){detachListeners();hideTooltip();if(positionFrame){cancelAnimationFrame(positionFrame);positionFrame=0;}
removeStyles();}
API.register({id:MODULE_ID,name:MODULE_NAME,version:MODULE_VERSION,description:"在帖子标题悬停时显示作者、版块、统计信息与首楼摘要。",author:"_RyF",minBaseVersion:"6.0",defaults:DEFAULTS,settings:SCHEMA,execute(){runtimeAPI=this.api||API;start();if(runtimeAPI&&typeof runtimeAPI.onCleanup==="function")runtimeAPI.onCleanup(stop);},onToggle(enabledState){runtimeAPI=this.api||API;if(enabledState)start();else stop();},onConfigChange(newConfig){if(newConfig)API.store(MODULE_ID,"config",newConfig);if(listenersAttached)start();},});})();