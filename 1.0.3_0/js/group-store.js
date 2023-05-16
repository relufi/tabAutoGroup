class GroupStore{static snapshotGroup(a){return new Promise(function(c,b){chrome.tabGroups.get(a,function(d){d?chrome.tabs.query({windowId:chrome.windows.WINDOW_ID_CURRENT},async function(g){g=g.filter(f=>f.groupId===a&&f.url);await GroupStore.saveGroup(d,g);c(!0)}):c(!1)})})}static saveGroup(a,c){return new Promise(function(b,d){d=c.map(k=>({title:k.title,url:k.url,favIconUrl:k.favIconUrl}));const g=Date.now(),f=`group-${g.toString(36)}`,e=a.title??"",h={};h[f]={id:f,type:"group",createTime:g,title:e,
color:a.color,tabs:d};chrome.storage.local.set(h,function(){e?chrome.storage.local.get(null,async function(k){let m=[];for(var l of Object.values(k))"group"===l.type&&l.title===e&&m.push(l);m.sort((n,p)=>p.createTime-n.createTime);"function"===typeof SavedGroup?k=SavedGroup.maxSnapshots:(await InitPromise,k=MaxSnapshots);for(l=0;l<m.length;l++)l>=k&&await GroupStore.delete(m[l].id);b()}):b()})})}static snapshotTab(a){return new Promise(function(c,b){chrome.tabs.get(a,async function(d){d&&d.url?(await GroupStore.saveTab(d),
c(!0)):c(!1)})})}static saveTab(a){return new Promise(function(c,b){b=Date.now();const d=`tab-${b.toString(36)}`,g=a.url,f={};f[d]={id:d,type:"tab",createTime:b,title:a.title??"",url:g,favIconUrl:a.favIconUrl};chrome.storage.local.set(f,function(){chrome.storage.local.get(null,async function(e){let h=[];for(let k of Object.values(e))"tab"===k.type&&k.url===g&&h.push(k);h.sort((k,m)=>m.createTime-k.createTime);for(e=0;e<h.length;e++)1<=e&&await GroupStore.delete(h[e].id);c()})})})}static deleteTabInGroup(a,
c,b){return new Promise(function(d,g){chrome.storage.local.get(a,function(f){if((f=f[a])&&f.tabs[c]&&f.tabs[c].url===b){f.tabs.splice(c,1);let e={};e[a]=f;chrome.storage.local.set(e,function(){d(!0)})}else d(!1)})})}static addTabsInGroup(a,c){return new Promise(function(b,d){chrome.storage.local.get(a,function(g){let f=g[a];f&&f.tabs?(f.tabs=f.tabs.concat(c),chrome.storage.local.set(g,function(){b(!0)})):b(!1)})})}static delete(a){return new Promise(function(c,b){chrome.storage.local.remove(a,c)})}static updateGroup(a,
c,b){return new Promise(function(d,g){a.startsWith("group-")?chrome.storage.local.get(a,function(f){let e=f[a];e?(e[c]=b,chrome.storage.local.set(f,function(){d(!0)})):d(!1)}):d(!1)})}static updateGroupName(a,c){return GroupStore.updateGroup(a,"title",c)}static updateGroupColor(a,c){return GroupStore.updateGroup(a,"color",c)}static getAll(){return new Promise(function(a,c){chrome.storage.local.get(null,function(b){b=Object.values(b);b.sort((d,g)=>g.createTime-d.createTime);a(b)})})}static deleteAll(){return new Promise(function(a,
c){chrome.storage.local.clear(a)})}static mergeGroup(a){return a?new Promise(async function(c,b){var d=await GroupStore.getAll();const g=new Set;b=[];const f=[];for(var e of d)if("group"===e.type&&e.title===a){f.push(e);for(var h of e.tabs)g.has(h.url)||(g.add(h.url),b.push(h))}if(1<f.length&&0<b.length){e=Date.now();h=`group-${e.toString(36)}`;d={};d[h]={id:h,type:"group",createTime:e,title:a,color:f[0].color,tabs:b};for(let k of f)await GroupStore.delete(k.id);chrome.storage.local.set(d,function(){c(!0)})}else c(!1)}):
!1}static async mergeAllGroups(){var a=await GroupStore.getAll();let c=new Map;for(var b of a)"group"===b.type&&b.title&&(a=c.get(b.title)??0,c.set(b.title,a+1));b=!1;for(let [d,g]of c)1<g&&(await GroupStore.mergeGroup(d),b=!0);return b}static updateTab(a,c,b){return new Promise(function(d,g){chrome.storage.local.get(a,function(f){let e=f[a];e&&"tab"==e.type?(e.title=c,e.url=b,chrome.storage.local.set(f,function(){d(e)})):d(!1)})})}static updateTabInGroup(a,c,b,d){return new Promise(function(g,f){chrome.storage.local.get(a,
function(e){let h=e[a];if(!h||!h.tabs||c>=h.tabs.length)g(!1);else{let k=h.tabs[c];k.title=b;k.url=d;chrome.storage.local.set(e,function(){g(h)})}})})}static importJson(a){return new Promise(async function(c,b){let d;try{d=JSON.parse(await a.text())}catch(f){b("JSON parse failed");return}if("tab-groups"==d.meta?.name&&1<=d.meta?.version){delete d.meta;var g={};for(const [f,e]of Object.entries(d)){if("group"===e.type){if(!e.tabs||!e.color)continue}else if("tab"===e.type){if(!e.url)continue}else continue;
g[f]=e}chrome.storage.local.set(g,function(){chrome.runtime.lastError?b("storage save failed"):c()})}else b("metadata validation failed")})}static downloadFile(a,c){var b=new Date;const d=b.getFullYear(),g=`${b.getMonth()+1}`.padStart(2,"0");b=`${b.getDate()}`.padStart(2,"0");c=`tabgroups_data_${d}${g}${b}.${c}`;GroupStore.exportFile||(GroupStore.exportFile=document.createElement("a"));GroupStore.exportFile.download=c;GroupStore.exportFile.href=a;GroupStore.exportFile.click()}static exportJson(){chrome.storage.local.get(null,
function(a){a.meta={name:"tab-groups",version:1};a="data:application/json;charset=utf-8,"+encodeURIComponent(JSON.stringify(a));GroupStore.downloadFile(a,"json")})}static generateLi(a,c){c=c.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");return`<li><a href="${a}">${c}</a></li>`}static async exportHtml(){var a=await GroupStore.getAll();const c=["<ul>"];for(let b of a)if("group"===b.type){c.push(`<li>\u25BC ${b.title?b.title:"No Name Group"}<ul>`);
for(let d of b.tabs)c.push(GroupStore.generateLi(d.url,d.title));c.push("</ul></li>")}else"tab"===b.type&&c.push(GroupStore.generateLi(b.url,b.title));c.push("</ul>");a=`<!DOCTYPE html><html><head><meta charset="utf-8"><title></title><style>li{line-height:1.5;font-family:system-ui;} body>ul{list-style: none;}</style></head><body>${c.join("")}</body></html>`;a="data:text/html;charset=utf-8,"+encodeURIComponent(a);GroupStore.downloadFile(a,"html")}};
