const RulePrefix = "rule-";
var Rules,
  RuleForNoGroup,
  OneGroupInAll,
  AutoCollapse,
  GroupByDomain,
  MaxSnapshots;
function prepareForUse(a) {
  let b = [];
  for (const [c, d] of Object.entries(a))
    c.startsWith(RulePrefix) && (d.enabled ?? !0) && b.push(d);
  b.sort(function (c, d) {
    return c.id.localeCompare(d.id);
  });
  Rules = b;
  RuleForNoGroup = "all" !== a["r-scope"];
  OneGroupInAll = a["r-oneGroupInAll"] ?? !1;
  AutoCollapse = a["r-autoCollapse"] ?? !1;
  GroupByDomain = a["r-groupByDomain"] ?? !1;
  MaxSnapshots = a["max-snapshots"] ?? 5;
}
async function initRules() {
  let { sync: a } = await chrome.storage.session.get("sync");
  a ? prepareForUse(a) : await loadRules();
}
async function loadRules() {
  let a = await chrome.storage.sync.get(null);
  chrome.storage.session.set({ sync: a });
  prepareForUse(a);
}
async function updateRules() {
  await InitPromise;
  InitPromise = loadRules();
}
var InitPromise = initRules(),
  regexCaches = new Map();
function matchString(a, b, c, d = !1) {
  if ("regex" === b) {
    b = d ? c + "++" : c;
    let e = regexCaches.get(b);
    e || ((e = d ? new RegExp(c, "iu") : new RegExp(c)), regexCaches.set(b, e));
    return e.test(a);
  }
  d && ((a = a.toLocaleLowerCase()), (c = c.toLocaleLowerCase()));
  return "equal" === b ? a === c : a[b](c);
}
function matchUrlRule(a) {
  a = new URL(a);
  for (let b of Rules)
    if (b.urlMatches)
      for (let c of b.urlMatches)
        if (matchString(a[c.target], c.method, c.value)) return b;
  return null;
}
function matchTitleRule(a) {
  for (let b of Rules)
    if (b.titleMatches)
      for (let c of b.titleMatches)
        if (matchString(a, c.method, c.value, c.ignoreCase)) return b;
  return null;
}
var ipv4Regex =
  /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;

function domainToName(hostname) {
  let groupName;
  if (ipv4Regex.test(hostname)) {
    // ipv4
    groupName = hostname.slice(0, hostname.lastIndexOf("."));
  } else {
    // domain
    let oneIdx = hostname.indexOf(".") + 1;
    let twoIdx = hostname.indexOf(".", oneIdx);
    if (twoIdx == -1) {
      // 1.2 or 1
      groupName = hostname;
    } else {
      // 1.2.3 to  2.3
      groupName = hostname.slice(oneIdx);
    }
  }
  return groupName;
}
function matchDomainRule(a) {
  a = new URL(a);
  if (
      (a.protocol === "edge:" || a.protocol === "chrome:") &&
      a.hostname === "newtab"
  ) {
    if (RuleForNoGroup) {
      return null;
    }
  }else if(a.protocol !== "http:" && a.protocol !== "https:"){
    return { groupName: a.protocol.slice(0,a.protocol.length - 1) };
  }
  return { groupName: domainToName(a.hostname) };
}
const NoGroup = chrome.tabGroups.TAB_GROUP_ID_NONE,
  CurrentWindow = chrome.windows.WINDOW_ID_CURRENT;
function onTabCreated(a) {
  a.url && autoGroup(a.url, null, a);
}
function onTabUpdated(a,b,c) {
  onAsyncTabUpdated(a,b,c);
}
async function onAsyncTabUpdated(a, b, c) {
  if (b.status === "complete") {
    if (!c.pinned && (c.url || c.title)) {
      await autoGroup(c.url, c.title, c);
    }
    if (c.active) {
      await autoCollapse({tabId: c.id,windowId: c.windowId});
    }
  }
}
async function autoCollapse(activeInfo) {
  await InitPromise;
  if (AutoCollapse) {
    let tab = await chrome.tabs.get(activeInfo.tabId);
    if (tab) {
      let tabGroupInfos = await chrome.tabGroups.query({ windowId: activeInfo.windowId });
      for (let tabGroupInfo of tabGroupInfos) {
        const nextCollapsed = tabGroupInfo.id !== tab.groupId;
        if (nextCollapsed !== tabGroupInfo.collapsed) {
          await updateTableGroup(tabGroupInfo.id, { collapsed: nextCollapsed });
        }
      }
    }
  }
}
async function updateTableGroup(id, props) {
  try {
    await chrome.tabGroups.update(id, props);
  } catch (error) {
    if (
      error ==
      "Error: Tabs cannot be edited right now (user may be dragging a tab)."
    ) {
      setTimeout(() => updateTableGroup(id, props), 50);
    }
  }
}
function onActivated(activeInfo) {
  autoCollapse(activeInfo);
}
var groupTimeoutIds = new Map();
function checkGroupUnique(a) {
  let b = groupTimeoutIds.get(a);
  b && clearTimeout(b);
  b = setTimeout(function () {
    groupTimeoutIds.set(a, 0);
    chrome.tabGroups.query({ windowId: CurrentWindow, title: a }, function (c) {
      if (1 < c.length) {
        let d = c.map((f) => f.id),
          e = d.shift();
        chrome.tabs.query({ windowId: CurrentWindow }, function (f) {
          let g = [];
          for (let h of f) d.includes(h.groupId) && g.push(h.id);
          chrome.tabs.group({ groupId: e, tabIds: g });
        });
      }
    });
  }, 500);
  groupTimeoutIds.set(a, b);
}
async function autoGroup(a, title, c) {
  await InitPromise;
  let d;
  //   if (GroupByDomain) d = b ? matchDomainRule(a) : null;
  //   else {
  //     if (RuleForNoGroup && c.groupId !== NoGroup) return;
  //     d = b ? matchUrlRule(a) : matchTitleRule(a);
  //   }
  if (RuleForNoGroup && c.groupId !== NoGroup) {
    return;
  }
  if (a) {
    d = matchUrlRule(a);
    if (GroupByDomain && !d) {
      d = matchDomainRule(a);
    }
  }
  if (title && !d) {
    d = matchTitleRule(title);
  }

  if (d) {
    const e = d.groupName;
    a = { title: e };
    OneGroupInAll || (a.windowId = CurrentWindow);
    let f = await chrome.tabGroups.query(a);
    if (0 < f.length) {
      if (c.groupId !== NoGroup) {
        for (let h of f) {
          if (c.groupId === h.id) {
            return;
          }
        }
      }
      const g = c.windowId === f[0].windowId;
      await chrome.tabs.group({ tabIds: c.id, groupId: f[0].id });
      !g &&
        c.active &&
        OneGroupInAll &&
        (chrome.tabs.update(c.id, { active: !0 }),
        chrome.windows.update(f[0].windowId, { focused: !0 }));
    } else {
      let g = await chrome.tabs.group({ tabIds: c.id });
      let h = { title: e };
      d.groupColor && (h.color = d.groupColor);
      let k = await chrome.tabGroups.update(g, h);
      chrome.runtime.lastError && console.log(chrome.runtime.lastError.message);
      checkGroupUnique(e);
    }
  }
}
class GroupStore {
  static snapshotGroup(a) {
    return new Promise(function (b, c) {
      chrome.tabGroups.get(a, function (d) {
        d
          ? chrome.tabs.query(
              { windowId: chrome.windows.WINDOW_ID_CURRENT },
              async function (e) {
                e = e.filter((f) => f.groupId === a && f.url);
                await GroupStore.saveGroup(d, e);
                b(!0);
              }
            )
          : b(!1);
      });
    });
  }
  static saveGroup(a, b) {
    return new Promise(function (c, d) {
      d = b.map((k) => ({
        title: k.title,
        url: k.url,
        favIconUrl: k.favIconUrl,
      }));
      const e = Date.now(),
        f = `group-${e.toString(36)}`,
        g = a.title ?? "",
        h = {};
      h[f] = {
        id: f,
        type: "group",
        createTime: e,
        title: g,
        color: a.color,
        tabs: d,
      };
      chrome.storage.local.set(h, function () {
        g
          ? chrome.storage.local.get(null, async function (k) {
              let m = [];
              for (var l of Object.values(k))
                "group" === l.type && l.title === g && m.push(l);
              m.sort((n, p) => p.createTime - n.createTime);
              "function" === typeof SavedGroup
                ? (k = SavedGroup.maxSnapshots)
                : (await InitPromise, (k = MaxSnapshots));
              for (l = 0; l < m.length; l++)
                l >= k && (await GroupStore.delete(m[l].id));
              c();
            })
          : c();
      });
    });
  }
  static snapshotTab(a) {
    return new Promise(function (b, c) {
      chrome.tabs.get(a, async function (d) {
        d && d.url ? (await GroupStore.saveTab(d), b(!0)) : b(!1);
      });
    });
  }
  static saveTab(a) {
    return new Promise(function (b, c) {
      c = Date.now();
      const d = `tab-${c.toString(36)}`,
        e = a.url,
        f = {};
      f[d] = {
        id: d,
        type: "tab",
        createTime: c,
        title: a.title ?? "",
        url: e,
        favIconUrl: a.favIconUrl,
      };
      chrome.storage.local.set(f, function () {
        chrome.storage.local.get(null, async function (g) {
          let h = [];
          for (let k of Object.values(g))
            "tab" === k.type && k.url === e && h.push(k);
          h.sort((k, m) => m.createTime - k.createTime);
          for (g = 0; g < h.length; g++)
            1 <= g && (await GroupStore.delete(h[g].id));
          b();
        });
      });
    });
  }
  static deleteTabInGroup(a, b, c) {
    return new Promise(function (d, e) {
      chrome.storage.local.get(a, function (f) {
        if ((f = f[a]) && f.tabs[b] && f.tabs[b].url === c) {
          f.tabs.splice(b, 1);
          let g = {};
          g[a] = f;
          chrome.storage.local.set(g, function () {
            d(!0);
          });
        } else d(!1);
      });
    });
  }
  static addTabsInGroup(a, b) {
    return new Promise(function (c, d) {
      chrome.storage.local.get(a, function (e) {
        let f = e[a];
        f && f.tabs
          ? ((f.tabs = f.tabs.concat(b)),
            chrome.storage.local.set(e, function () {
              c(!0);
            }))
          : c(!1);
      });
    });
  }
  static delete(a) {
    return new Promise(function (b, c) {
      chrome.storage.local.remove(a, b);
    });
  }
  static updateGroup(a, b, c) {
    return new Promise(function (d, e) {
      a.startsWith("group-")
        ? chrome.storage.local.get(a, function (f) {
            let g = f[a];
            g
              ? ((g[b] = c),
                chrome.storage.local.set(f, function () {
                  d(!0);
                }))
              : d(!1);
          })
        : d(!1);
    });
  }
  static updateGroupName(a, b) {
    return GroupStore.updateGroup(a, "title", b);
  }
  static updateGroupColor(a, b) {
    return GroupStore.updateGroup(a, "color", b);
  }
  static getAll() {
    return new Promise(function (a, b) {
      chrome.storage.local.get(null, function (c) {
        c = Object.values(c);
        c.sort((d, e) => e.createTime - d.createTime);
        a(c);
      });
    });
  }
  static deleteAll() {
    return new Promise(function (a, b) {
      chrome.storage.local.clear(a);
    });
  }
  static mergeGroup(a) {
    return a
      ? new Promise(async function (b, c) {
          var d = await GroupStore.getAll();
          const e = new Set();
          c = [];
          const f = [];
          for (var g of d)
            if ("group" === g.type && g.title === a) {
              f.push(g);
              for (var h of g.tabs) e.has(h.url) || (e.add(h.url), c.push(h));
            }
          if (1 < f.length && 0 < c.length) {
            g = Date.now();
            h = `group-${g.toString(36)}`;
            d = {};
            d[h] = {
              id: h,
              type: "group",
              createTime: g,
              title: a,
              color: f[0].color,
              tabs: c,
            };
            for (let k of f) await GroupStore.delete(k.id);
            chrome.storage.local.set(d, function () {
              b(!0);
            });
          } else b(!1);
        })
      : !1;
  }
  static async mergeAllGroups() {
    var a = await GroupStore.getAll();
    let b = new Map();
    for (var c of a)
      "group" === c.type &&
        c.title &&
        ((a = b.get(c.title) ?? 0), b.set(c.title, a + 1));
    c = !1;
    for (let [d, e] of b) 1 < e && (await GroupStore.mergeGroup(d), (c = !0));
    return c;
  }
  static updateTab(a, b, c) {
    return new Promise(function (d, e) {
      chrome.storage.local.get(a, function (f) {
        let g = f[a];
        g && "tab" == g.type
          ? ((g.title = b),
            (g.url = c),
            chrome.storage.local.set(f, function () {
              d(g);
            }))
          : d(!1);
      });
    });
  }
  static updateTabInGroup(a, b, c, d) {
    return new Promise(function (e, f) {
      chrome.storage.local.get(a, function (g) {
        let h = g[a];
        if (!h || !h.tabs || b >= h.tabs.length) e(!1);
        else {
          let k = h.tabs[b];
          k.title = c;
          k.url = d;
          chrome.storage.local.set(g, function () {
            e(h);
          });
        }
      });
    });
  }
  static importJson(a) {
    return new Promise(async function (b, c) {
      let d;
      try {
        d = JSON.parse(await a.text());
      } catch (f) {
        c("JSON parse failed");
        return;
      }
      if ("tab-groups" == d.meta?.name && 1 <= d.meta?.version) {
        delete d.meta;
        var e = {};
        for (const [f, g] of Object.entries(d)) {
          if ("group" === g.type) {
            if (!g.tabs || !g.color) continue;
          } else if ("tab" === g.type) {
            if (!g.url) continue;
          } else continue;
          e[f] = g;
        }
        chrome.storage.local.set(e, function () {
          chrome.runtime.lastError ? c("storage save failed") : b();
        });
      } else c("metadata validation failed");
    });
  }
  static downloadFile(a, b) {
    var c = new Date();
    const d = c.getFullYear(),
      e = `${c.getMonth() + 1}`.padStart(2, "0");
    c = `${c.getDate()}`.padStart(2, "0");
    b = `tabgroups_data_${d}${e}${c}.${b}`;
    GroupStore.exportFile ||
      (GroupStore.exportFile = document.createElement("a"));
    GroupStore.exportFile.download = b;
    GroupStore.exportFile.href = a;
    GroupStore.exportFile.click();
  }
  static exportJson() {
    chrome.storage.local.get(null, function (a) {
      a.meta = { name: "tab-groups", version: 1 };
      a =
        "data:application/json;charset=utf-8," +
        encodeURIComponent(JSON.stringify(a));
      GroupStore.downloadFile(a, "json");
    });
  }
  static generateLi(a, b) {
    b = b
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
    return `<li><a href="${a}">${b}</a></li>`;
  }
  static async exportHtml() {
    var a = await GroupStore.getAll();
    const b = ["<ul>"];
    for (let c of a)
      if ("group" === c.type) {
        b.push(`<li>\u25BC ${c.title ? c.title : "No Name Group"}<ul>`);
        for (let d of c.tabs) b.push(GroupStore.generateLi(d.url, d.title));
        b.push("</ul></li>");
      } else "tab" === c.type && b.push(GroupStore.generateLi(c.url, c.title));
    b.push("</ul>");
    a = `<!DOCTYPE html><html><head><meta charset="utf-8"><title></title><style>li{line-height:1.5;font-family:system-ui;} body>ul{list-style: none;}</style></head><body>${b.join(
      ""
    )}</body></html>`;
    a = "data:text/html;charset=utf-8," + encodeURIComponent(a);
    GroupStore.downloadFile(a, "html");
  }
}
class Shortcut {
  static toggleTabGroup(a) {
    chrome.tabs.query(
      { highlighted: !0, windowId: CurrentWindow },
      function (b) {
        b = b.map((c) => c.id);
        a.groupId === NoGroup
          ? chrome.tabs.group({ tabIds: b })
          : chrome.tabs.ungroup(b);
      }
    );
  }
  static ungroup(a) {
    const b = a.groupId;
    b !== NoGroup &&
      chrome.tabs.query({ windowId: CurrentWindow }, function (c) {
        let d = [];
        for (let e of c) e.groupId === b && d.push(e.id);
        chrome.tabs.ungroup(d);
      });
  }
  static ungroupAll() {
    chrome.tabs.query({ windowId: CurrentWindow }, function (a) {
      let b = [];
      for (let c of a) c.groupId !== NoGroup && b.push(c.id);
      0 < b.length && chrome.tabs.ungroup(b);
    });
  }
  static nextTabInGroup(a, b) {
    const c = a.groupId,
      d = a.id;
    c !== NoGroup &&
      chrome.tabs.query({ windowId: CurrentWindow }, function (e) {
        let f = [],
          g = 0;
        for (let h = 0; h < e.length; h++) {
          let k = e[h];
          k.groupId === c && (f.push(k), k.id === d && (g = f.length - 1));
        }
        1 < f.length &&
          (b
            ? (g++, g >= f.length && (g = 0))
            : (g--, 0 > g && (g = f.length - 1)),
          chrome.tabs.update(f[g].id, { active: !0 }));
      });
  }
  static toggleCollapse(a) {
    const b = a.groupId;
    b !== NoGroup &&
      chrome.tabGroups.get(b, function (c) {
        c && chrome.tabGroups.update(b, { collapsed: !c.collapsed });
      });
  }
  static toggleCollapseAll() {
    chrome.tabGroups.query({ windowId: CurrentWindow }, function (a) {
      if (0 < a.length) {
        const b = !a[0].collapsed,
          c = { collapsed: b };
        for (let d of a) d.collapsed != b && chrome.tabGroups.update(d.id, c);
      }
    });
  }
  static newtabInGroup(a) {
    const b = a.groupId;
    b !== NoGroup
      ? chrome.tabs.create({}, function (c) {
          chrome.tabs.group({ groupId: b, tabIds: c.id });
        })
      : chrome.tabs.create({});
  }
  static moveGroupToNewWindow(a) {
    const b = a.groupId;
    b !== NoGroup
      ? chrome.windows.create({ focused: !0 }, function (c) {
          chrome.tabGroups.move(b, { index: 0, windowId: c.id }, function () {
            chrome.tabs.update(a.id, { active: !0 }, function () {
              chrome.tabs.remove(c.tabs[0].id);
            });
          });
        })
      : chrome.windows.create({ tabId: a.id });
  }
  static moveGroup(a, b) {
    chrome.tabs.query({ windowId: CurrentWindow }, function (c) {
      Shortcut.jumpMove(c, a, b);
    });
  }
  static jumpMove(a, b, c) {
    let d = [],
      e = -1,
      f = 0;
    const g = b.id;
    for (let h = 0; h < a.length; h++) {
      let k = a[h];
      k.pinned
        ? d.push(-1)
        : k.groupId === NoGroup
        ? d.push(h)
        : k.groupId !== e && ((e = k.groupId), d.push(h));
      k.id === g && (f = d.length - 1);
    }
    if (c) {
      if (f == d.length - 1) return;
      b = a[d[f + 1]];
      if (void 0 === b) return;
    } else f--;
    a = d[f];
    void 0 !== a &&
      -1 !== a &&
      (b.groupId === NoGroup
        ? chrome.tabs.move(b.id, { index: a })
        : chrome.tabGroups.move(b.groupId, { index: a }));
  }
  static moveTab(a, b) {
    a.pinned ||
      chrome.tabs.query({ windowId: CurrentWindow }, function (c) {
        let d = b ? a.index + 1 : a.index - 1;
        (c = c[d]) && !c.pinned && chrome.tabs.move(a.id, { index: d });
      });
  }
  static removeGroup(a) {
    const b = a.groupId;
    b !== NoGroup &&
      chrome.tabs.query({ windowId: CurrentWindow }, function (c) {
        let d = [];
        for (let e of c) e.groupId === b && d.push(e.id);
        chrome.tabs.remove(d);
      });
  }
  static removeTabsNotInThisGroup(a) {
    const b = a.groupId;
    b !== NoGroup &&
      chrome.tabs.query({ windowId: CurrentWindow }, function (c) {
        let d = [];
        for (let e of c) e.groupId !== b && d.push(e.id);
        chrome.tabs.remove(d);
      });
  }
  static removeUngroupedTabs(a) {
    chrome.tabs.query({ windowId: CurrentWindow }, function (b) {
      let c = [];
      for (let d of b) d.groupId === NoGroup && c.push(d.id);
      chrome.tabs.remove(c);
    });
  }
  static removeOtherTabs(a) {
    chrome.tabs.query({ windowId: CurrentWindow }, function (b) {
      let c = [];
      const d = a.id;
      for (let e of b) e.id !== d && c.push(e.id);
      chrome.tabs.remove(c);
    });
  }
  static removeRightTabs(a, b) {
    chrome.tabs.query({ windowId: CurrentWindow }, function (c) {
      b && c.reverse();
      const d = a.id;
      let e = [];
      for (let f = 0; f < c.length; f++) {
        let g = c[f].id;
        if (g === d) break;
        else e.push(g);
      }
      chrome.tabs.remove(e);
    });
  }
  static async sendNotification(a, b) {
    (await chrome.permissions.contains({ permissions: ["notifications"] })) &&
      (chrome.notifications.create({
        type: "basic",
        iconUrl: "icon/128.png",
        title: a,
        message: b,
      }),
      chrome.alarms.create("clear", { delayInMinutes: 1 }));
  }
  static clearNotification() {
    chrome.notifications.getAll(function (a) {
      for (let b of Object.keys(a)) chrome.notifications.clear(b);
    });
  }
  static async saveTab(a) {
    (await GroupStore.snapshotTab(a.id)) &&
      Shortcut.sendNotification(
        "zh-CN" == navigator.language
          ? "\u6807\u7b7e\u5206\u7ec4\u6269\u5c55"
          : "Tab Groups Extension",
        "zh-CN" == navigator.language
          ? "\u6807\u7b7e\u4fdd\u5b58\u6210\u529f"
          : "Tab Saved Successfully"
      );
  }
  static async saveGroup(a) {
    a.groupId !== NoGroup &&
      (await GroupStore.snapshotGroup(a.groupId)) &&
      Shortcut.sendNotification(
        "zh-CN" == navigator.language
          ? "\u6807\u7b7e\u5206\u7ec4\u6269\u5c55"
          : "Tab Groups Extension",
        "zh-CN" == navigator.language
          ? "\u5206\u7ec4\u4fdd\u5b58\u6210\u529f"
          : "Group Saved Successfully"
      );
  }
  static addUngroupedTabInThisGroup(a, b) {
    const c = a.groupId;
    c !== NoGroup &&
      chrome.tabs.query({ windowId: CurrentWindow }, function (d) {
        b && d.reverse();
        for (let e = 0; e < d.length; e++)
          if (d[e].groupId === c) {
            (d = d[e - 1]) &&
              d.groupId === NoGroup &&
              chrome.tabs.group({ groupId: c, tabIds: d.id });
            break;
          }
      });
  }
  static groupAllUngroupedTabs() {
    chrome.tabs.query({ windowId: CurrentWindow }, function (a) {
      let b = [];
      for (let c of a) c.groupId === NoGroup && b.push(c.id);
      0 < b.length && chrome.tabs.group({ tabIds: b });
    });
  }
  static groupN(a, b) {
    chrome.tabs.query({ windowId: CurrentWindow }, function (c) {
      let d = -1,
        e = 0,
        f;
      for (let g = 0; g < c.length; g++) {
        let h = c[g].groupId;
        if (
          h !== NoGroup &&
          h !== d &&
          ((d = h), e++, (f = c[g]), 9 > a && a === e)
        ) {
          b
            ? chrome.tabs.update(f.id, { active: !0 })
            : Shortcut.toggleCollapse(f);
          return;
        }
      }
      9 === a &&
        f &&
        (b
          ? chrome.tabs.update(f.id, { active: !0 })
          : Shortcut.toggleCollapse(f));
    });
  }
  static toggleTabPin(a) {
    chrome.tabs.update(a.id, { pinned: !a.pinned });
  }
  static duplicateTab(a) {
    chrome.tabs.duplicate(a.id);
  }
  static autoGroupByDomain(a) {
    chrome.tabs.query({ windowId: CurrentWindow }, async function (b) {
      let c = new Map();
      var d = [];
      let e = [];
      for (let f of b)
        if (f.url)
          if (f.pinned) d.push(f.id);
          else {
            b = new URL(f.url);
            let g = c.get(b.hostname);
            g ? g.push(f.id) : c.set(b.hostname, [f.id]);
          }
        else e.push(f.id);
      0 < e.length && (await Shortcut.tabsMove(e, -1));
      d = d.length;
      for (let [f, g] of c)
        await Shortcut.tabsMove(g, d),
          (d += g.length),
          chrome.tabs.group({ tabIds: g }, function (h) {
            a
              ? chrome.tabGroups.update(h, {
                  collapsed: !0,
                  title: domainToName(f),
                })
              : chrome.tabGroups.update(h, { collapsed: !1, title: "" });
          });
    });
  }
  static tabsMove(a, b) {
    return new Promise(function (c, d) {
      chrome.tabs.move(a, { index: b }, c);
    });
  }
}
function onCommand(a, b) {
  b &&
    b.id &&
    b.id !== chrome.tabs.TAB_ID_NONE &&
    ("toggle-tab-group" == a
      ? Shortcut.toggleTabGroup(b)
      : "save-tab" == a
      ? Shortcut.saveTab(b)
      : "save-group" == a
      ? Shortcut.saveGroup(b)
      : "next-tab-in-group" == a
      ? Shortcut.nextTabInGroup(b, !0)
      : "previous-tab-in-group" == a
      ? Shortcut.nextTabInGroup(b, !1)
      : "toggle-group-collapse" == a
      ? Shortcut.toggleCollapse(b)
      : "toggle-all-group-collapse" == a
      ? Shortcut.toggleCollapseAll()
      : "ungroup-this-group" == a
      ? Shortcut.ungroup(b)
      : "ungroup-all-group" == a
      ? Shortcut.ungroupAll()
      : "group-by-domain-with-name" == a
      ? Shortcut.autoGroupByDomain(!0)
      : "group-by-domain-without-name" == a
      ? Shortcut.autoGroupByDomain(!1)
      : "newtab-in-group" == a
      ? Shortcut.newtabInGroup(b)
      : "move-group-window" == a
      ? Shortcut.moveGroupToNewWindow(b)
      : "move-group-right" == a
      ? Shortcut.moveGroup(b, !0)
      : "move-group-left" == a
      ? Shortcut.moveGroup(b, !1)
      : "move-tab-right" == a
      ? Shortcut.moveTab(b, !0)
      : "move-tab-left" == a
      ? Shortcut.moveTab(b, !1)
      : "remove-group" == a
      ? Shortcut.removeGroup(b)
      : "remove-ungrouped-tabs" == a
      ? Shortcut.removeUngroupedTabs(b)
      : "remove-tabs-not-in-this-group" == a
      ? Shortcut.removeTabsNotInThisGroup(b)
      : "add-right-tab-in-this-group" == a
      ? Shortcut.addUngroupedTabInThisGroup(b, !0)
      : "add-left-tab-in-this-group" == a
      ? Shortcut.addUngroupedTabInThisGroup(b, !1)
      : "toggle-tab-pin" == a
      ? Shortcut.toggleTabPin(b)
      : "duplicate-tab" == a
      ? Shortcut.duplicateTab(b)
      : "remove-other-tabs" == a
      ? Shortcut.removeOtherTabs(b)
      : "remove-left-tabs" == a
      ? Shortcut.removeRightTabs(b, !1)
      : "remove-right-tabs" == a
      ? Shortcut.removeRightTabs(b, !0)
      : "group-ungrouped-tabs" == a
      ? Shortcut.groupAllUngroupedTabs()
      : a.startsWith("active-group-")
      ? ((a = parseInt(a.charAt(a.length - 1), 10)), Shortcut.groupN(a, !0))
      : a.startsWith("collapse-group-") &&
        ((a = parseInt(a.charAt(a.length - 1), 10)), Shortcut.groupN(a, !1)));
}
class OpenUtils {
  static createTab(a, b) {
    return new Promise(function (c, d) {
      "background" == b
        ? chrome.tabs.create({ active: !1, url: a, windowId: CurrentWindow }, c)
        : "newWindow" == b
        ? chrome.windows.create({ focused: !0, url: a }, (e) => c(e.tabs[0]))
        : chrome.tabs.create(
            { active: !0, url: a, windowId: CurrentWindow },
            c
          );
    });
  }
  static createTabsInWindow(a) {
    return new Promise(function (b, c) {
      chrome.windows.create({ focused: !0, url: a }, (d) => b(d.tabs));
    });
  }
  static openGroup(a, b) {
    chrome.storage.local.get(a, async function (c) {
      let d = c[a];
      if (d && 0 < d.tabs.length)
        try {
          let e;
          if ("newWindow" == b) {
            const g = d.tabs.map((h) => h.url);
            e = await OpenUtils.createTabsInWindow(g);
          } else {
            let g = d.tabs.map((h) => OpenUtils.createTab(h.url, b));
            e = await Promise.all(g);
          }
          let f = e.map((g) => g.id);
          d.title
            ? chrome.tabGroups.query(
                { windowId: CurrentWindow, title: d.title },
                function (g) {
                  0 < g.length
                    ? chrome.tabs.group({ groupId: g[0].id, tabIds: f })
                    : chrome.tabs.group({ tabIds: f }, function (h) {
                        chrome.tabGroups.update(h, {
                          title: d.title,
                          color: d.color,
                        });
                      });
                }
              )
            : chrome.tabs.group({ tabIds: f }, function (g) {
                chrome.tabGroups.update(g, { color: d.color });
              });
        } catch (e) {
          console.error(e);
        }
    });
  }
  static async openTab(a, b, c, d) {
    let e = await OpenUtils.createTab(a, b);
    c
      ? chrome.tabGroups.query(
          { windowId: CurrentWindow, title: c },
          function (f) {
            0 < f.length
              ? chrome.tabs.group({ groupId: f[0].id, tabIds: e.id })
              : chrome.tabs.group({ tabIds: e.id }, function (g) {
                  chrome.tabGroups.update(g, { title: c, color: d });
                });
          }
        )
      : chrome.tabs.group({ tabIds: e.id }, function (f) {
          chrome.tabGroups.update(f, { color: d });
        });
  }
  static moveToWindow(a, b, c) {
    void 0 === b
      ? chrome.windows.create({ focused: !0 }, function (d) {
          const e = d.tabs[0].id;
          "group" === c
            ? chrome.tabGroups.move(
                a,
                { index: 0, windowId: d.id },
                function () {
                  chrome.tabs.remove(e);
                }
              )
            : chrome.tabs.move(a, { index: 0, windowId: d.id }, function () {
                chrome.tabs.remove(e);
              });
        })
      : "group" === c
      ? chrome.tabGroups.move(a, { index: -1, windowId: b }, function () {
          chrome.windows.update(b, { focused: !0 });
        })
      : chrome.tabs.move(a, { index: -1, windowId: b }, function () {
          chrome.tabs.update(a, { active: !0 }, function () {
            chrome.windows.update(b, { focused: !0 });
          });
        });
  }
}
function onMessage(a, b, c) {
  b = a.type;
  "OpenTab" == b
    ? OpenUtils.openTab(a.url, a.mode, a.groupName, a.groupColor)
    : "OpenGroup" == b
    ? OpenUtils.openGroup(a.id, a.mode)
    : "MoveToWindow" == b &&
      OpenUtils.moveToWindow(a.id, a.windowId, a.moveType);
}
function onInstall(a) {
  a && "install" == a.reason && chrome.tabs.create({ url: "help.html" });
}
chrome.runtime.onInstalled.addListener(onInstall);
chrome.tabs.onCreated.addListener(onTabCreated);
chrome.tabs.onUpdated.addListener(onTabUpdated);
chrome.tabs.onActivated.addListener(onActivated);
chrome.commands.onCommand.addListener(onCommand);
chrome.runtime.onMessage.addListener(onMessage);
chrome.storage.sync.onChanged.addListener(updateRules);
chrome.alarms.onAlarm.addListener(Shortcut.clearNotification);
