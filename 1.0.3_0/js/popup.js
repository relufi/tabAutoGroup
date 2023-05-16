const NoGroup = chrome.tabGroups.TAB_GROUP_ID_NONE,
  QueryInWindow = { windowId: chrome.windows.WINDOW_ID_CURRENT },
  NoName = chrome.i18n.getMessage("NoName");
function createColorSpan(a) {
  let b = document.createElement("span");
  b.className = "d-inline-block rounded-circle size-18 align-text-bottom me-2";
  a ? (b.style.backgroundColor = ColorMap[a]) : b.classList.add("border");
  return b;
}
function createFavicon(a) {
  let b = document.createElement("img");
  b.className = "size-18 align-text-bottom mr-10";
  a
    ? requestIdleCallback(
        () => {
          b.src = `/_favicon/?pageUrl=${encodeURIComponent(a)}&size=36`;
        },
        { timeout: 1e4 }
      )
    : (b.src = "img/tab-24px.svg");
  return b;
}
function escForBlur(a) {
  27 === a.keyCode && (a.stopPropagation(), a.preventDefault(), this.blur());
}
function delay(a, b) {
  let d = 0;
  return function (...c) {
    clearTimeout(d);
    d = setTimeout(a.bind(this, ...c), b);
  };
}
const successTip = new bootstrap.Toast(document.getElementById("successTip"), {
  animation: !0,
  autohide: !0,
  delay: 1e3,
});
function showSuccessTip(a) {
  a || (a = chrome.i18n.getMessage("Saved"));
  document.getElementById("successTip").firstElementChild.textContent = a;
  successTip.show();
}
class Group {
  static init() {
    Group.container = document.getElementById("current-tab-list");
    Group.collapseAll = document.getElementById("current-collapse-all");
    Group.collapseAll.addEventListener("click", Group.toggleCollpaseAll);

    document
      .getElementById("remove-all-group")
      .addEventListener("click", function() {
        chrome.tabs.query(QueryInWindow, function (d) {
            d.forEach((c) => {
                if(c.groupId !== NoGroup) {
                    chrome.tabs.remove(c.id);
                }
            });
          });
      });

    Group.setupCurrentTabs();
    chrome.tabGroups.onRemoved.addListener(Group.onGroupRemoved);
    chrome.tabs.onUpdated.addListener(Group.onTabUpdated);
    chrome.tabs.onCreated.addListener(Group.onTabCreated);
    chrome.tabs.onRemoved.addListener(Group.onTabRemoved);
    Group.delayRefresh = delay(Group.setupCurrentTabs, 500);
    Group.initMoveMenu();
  }
  static initMoveMenu() {
    Group.dropdownMoveMenu = document.getElementById("dropdown-move-to");
    Group.dropdownMoveMenu.children[1].firstElementChild.addEventListener(
      "click",
      Group.onMoveMenuItemClick
    );
    chrome.windows.getCurrent({ windowTypes: ["normal"] }, function (a) {
      Group.currentWindowId = a.id;
    });
  }
  static refreshMoveMenu() {
    chrome.windows.getAll(
      { windowTypes: ["normal"], populate: !0 },
      function (a) {
        a = a.filter((e) => e.id != Group.currentWindowId);
        let [, , b, d, ...c] = Group.dropdownMoveMenu.children;
        for (let e of c) e.remove();
        0 < a.length
          ? (b.classList.remove("d-none"),
            d.classList.remove("d-none"),
            a.forEach(Group.createMoveMenuItem))
          : (b.classList.add("d-none"), d.classList.add("d-none"));
      }
    );
  }
  static createMoveMenuItem(a) {
    let b = document.createElement("li"),
      d = document.createElement("button");
    d.type = "button";
    d.className = "dropdown-item text-truncate";
    d.dataset.target = a.id;
    d.addEventListener("click", Group.onMoveMenuItemClick);
    for (let c of a.tabs)
      (a = createFavicon(c.url)), (a.title = c.title), d.appendChild(a);
    b.appendChild(d);
    Group.dropdownMoveMenu.appendChild(b);
  }
  static setupCurrentTabs() {
    chrome.tabGroups.query(QueryInWindow, function (a) {
      const b = new Map(a.map((d) => [d.id, d]));
      chrome.tabs.query(QueryInWindow, function (d) {
        var c = [];
        let e = -1;
        for (let g of d)
          (d = g.groupId),
            d === NoGroup
              ? c.push(Group.createTab(g, !1))
              : (d !== e &&
                  ((e = d), (d = b.get(d)) && c.push(Group.createGroup(d))),
                c.push(Group.createTab(g, !0)));
        Group.container.replaceChildren(...c);
        c = Group.container.querySelectorAll('img[src="img/expand.svg"]');
        for (let g of c) Group.setUICollpase(g, !0);
        0 == c.length && Group.updateCollpaseAllBtn();
      });
    });
  }
  static createMoveWindowTD() {
    let a = document.createElement("td"),
      b = document.createElement("a"),
      d = document.createElement("img");
    d.src = "img/move_to_window.svg";
    d.className = "pointer size-24";
    b.href = "#";
    b.addEventListener("click", Group.onMoveMenuClick);
    a.className = "dropdown dropstart";
    b.appendChild(d);
    a.appendChild(b);
    return a;
  }
  static createCloseTD() {
    let a = document.createElement("td"),
      b = document.createElement("img");
    b.src = "img/close.svg";
    b.className = "pointer size-24";
    b.addEventListener("click", Group.onCloseClick);
    a.appendChild(b);
    return a;
  }
  static createTab(a, b) {
    let d = document.createElement("tr"),
      c = document.createElement("td");
    var e = createFavicon(a.url);
    let g = document.createElement("span"),
      h = Group.createMoveWindowTD(),
      k = document.createElement("td"),
      f = Group.createCloseTD();
    d.id = "ctab-" + a.id;
    b && c.classList.add("tab-in-group");
    g.textContent = a.title;
    b = document.createElement("div");
    b.className = "text-truncate pointer";
    b.appendChild(e);
    b.appendChild(g);
    b.addEventListener("click", Group.onTabClick);
    b.title = a.url;
    c.appendChild(b);
    c.colSpan = 3;
    e = document.createElement("img");
    e.src = "img/camera_alt-24px.svg";
    e.className = "pointer";
    e.addEventListener("click", Group.onTabSnapshotClick);
    k.appendChild(e);
    Group.setTabState(a, c);
    d.appendChild(c);
    d.appendChild(h);
    d.appendChild(k);
    d.appendChild(f);
    return d;
  }
  static setTabState(a, b) {
    a.active && b.classList.add("active-indicator");
    let d = !1;
    if (a.mutedInfo?.muted) var c = "img/volume_off.svg";
    else
      a.audible
        ? ((d = !0), (c = "img/volume_down.svg"))
        : a.pinned && (c = "img/push_pin.svg");
    c &&
      ((a = document.createElement("img")),
      (a.src = c),
      (a.className = "state-indicator"),
      b.classList.add("position-relative"),
      b.appendChild(a),
      d &&
        ((c = document.createElement("img")),
        (c.src = "img/volume_up.svg"),
        (c.className = "state-indicator audible-animate"),
        b.appendChild(c)));
  }
  static onTabUpdated(a, b, d) {
    if ((a = document.getElementById("ctab-" + a))) {
      let e = a.firstElementChild.firstElementChild;
      if (1 == e.childElementCount) var c = e.firstElementChild;
      else (c = e.firstElementChild), (c = c.nextElementSibling);
      b.url && (e.title = b.url);
      b.title && (c.textContent = b.title);
      if (void 0 !== b.audible || void 0 !== b.mutedInfo || void 0 !== b.pinned)
        a.querySelectorAll(".state-indicator").forEach((g) => g.remove()),
          Group.setTabState(d, a.firstElementChild);
    }
    0 < b.groupId && Group.delayRefresh();
  }
  static onTabCreated(a) {
    a.windowId === Group.currentWindowId && Group.delayRefresh();
  }
  static createGroup(a) {
    let b = document.createElement("tr"),
      d = document.createElement("td"),
      c = Group.createMoveWindowTD(),
      e = document.createElement("td"),
      g = Group.createCloseTD(),
      h = document.createElement("td"),
      k = document.createElement("td");
    b.id = "cgroup-" + a.id;
    d.className = "text-truncate";
    var f = document.createElement("span");
    f.className = "group-name text-truncate";
    f.dataset.placeholder = NoName;
    a.title && (f.textContent = a.title);
    f.addEventListener("click", Group.spanToInput);
    let l = document.createElement("input");
    l.type = "text";
    l.spellcheck = !1;
    l.className = "d-none group-name";
    l.placeholder = NoName;
    a.title && (l.value = a.title);
    var m = delay(function () {
      let p = this.value,
        q = parseInt(this.closest("tr").id.split("-")[1], 10);
      chrome.tabGroups.update(q, { title: p });
    }, 800);
    l.addEventListener("input", m);
    l.addEventListener("blur", Group.inputToSpan);
    l.addEventListener("keydown", escForBlur);
    m = createColorSpan(a.color);
    m.classList.add("pointer");
    m.addEventListener("click", Group.onColorClick);
    let n = document.createElement("img");
    n.src = "img/chevron_right_black.svg";
    n.className = "size-18 mx-1 align-text-bottom d-none";
    d.appendChild(m);
    d.appendChild(f);
    d.appendChild(l);
    d.appendChild(n);
    f = document.createElement("img");
    f.src = "img/add_black.svg";
    f.className = "pointer size-24";
    f.addEventListener("click", Group.onNewtabClick);
    e.appendChild(f);
    f = document.createElement("img");
    f.className = "pointer size-24";
    Group.setCollpaseBtn(f, a.collapsed);
    f.addEventListener("click", Group.onCollapseClick);
    h.className = "expand";
    h.appendChild(f);
    a = document.createElement("img");
    a.src = "img/camera_alt-24px.svg";
    a.className = "pointer";
    a.addEventListener("click", Group.onGroupSnapshotClick);
    k.appendChild(a);
    b.appendChild(d);
    b.appendChild(h);
    b.appendChild(e);
    b.appendChild(c);
    b.appendChild(k);
    b.appendChild(g);
    return b;
  }
  static spanToInput(a) {
    this.classList.add("d-none");
    a = this.nextElementSibling;
    a.classList.remove("d-none");
    a.focus();
  }
  static inputToSpan(a) {
    this.classList.add("d-none");
    a = this.previousElementSibling;
    a.textContent = this.value;
    a.classList.remove("d-none");
  }
  static updateCollpaseAllBtn() {
    let a = Group.container.querySelectorAll(
        'img[src="img/expand.svg"]'
      ).length,
      b = Group.container.querySelectorAll('img[src="img/shrink.svg"]').length;
    Group.collapseAll.src =
      0 == a + b || 0 < b ? "img/shrink.svg" : "img/expand.svg";
  }
  static toggleCollpaseAll(a) {
    a = this.src.endsWith("img/expand.svg")
      ? Group.container.querySelectorAll('img[src="img/expand.svg"]')
      : Group.container.querySelectorAll('img[src="img/shrink.svg"]');
    for (let b of a) b.click();
  }
  static setCollpaseBtn(a, b) {
    a.src = b ? "img/expand.svg" : "img/shrink.svg";
  }
  static setUICollpase(a, b) {
    const d = a.closest("tr");
    a = d.firstElementChild;
    const c = a.firstElementChild,
      e = c.nextElementSibling.nextElementSibling.nextElementSibling;
    "DIV" == a.lastElementChild.tagName && a.lastElementChild.remove();
    if (b)
      for (
        c.classList.add("group"),
          e.classList.remove("d-none"),
          b = d.nextElementSibling;
        b && b.firstElementChild.classList.contains("tab-in-group");

      )
        a.appendChild(b.firstElementChild.firstElementChild.firstElementChild),
          b.classList.add("d-none"),
          (b = b.nextElementSibling);
    else
      for (
        c.classList.remove("group"),
          e.classList.add("d-none"),
          b = d.nextElementSibling;
        b && b.firstElementChild.classList.contains("tab-in-group");

      )
        b.firstElementChild.firstElementChild.prepend(e.nextElementSibling),
          b.classList.remove("d-none"),
          (b = b.nextElementSibling);
    Group.updateCollpaseAllBtn();
  }
  static onCollapseClick(a) {
    a.preventDefault();
    const b = this,
      d = parseInt(this.closest("tr").id.split("-")[1], 10);
    chrome.tabGroups.get(d, (c) => {
      chrome.tabGroups.update(d, { collapsed: !c.collapsed }, (e) => {
        Group.setCollpaseBtn(b, e.collapsed);
        Group.setUICollpase(b, e.collapsed);
      });
    });
  }
  static onColorClick(a) {
    a = this.parentElement;
    if ("DIV" == a.lastElementChild.tagName) a.lastElementChild.remove();
    else {
      var b = parseInt(this.closest("tr").id.split("-")[1], 10),
        d = document.createElement("div");
      d.className = "mt-1";
      for (let c of Object.keys(ColorMap)) {
        let e = createColorSpan(c);
        e.classList.add("pointer");
        e.addEventListener("click", (g) => {
          chrome.tabGroups.update(b, { color: c });
          this.style.backgroundColor = ColorMap[c];
        });
        d.appendChild(e);
      }
      a.appendChild(d);
    }
  }
  static onCloseClick(a) {
    a = this.closest("tr").id.split("-");
    const b = parseInt(a[1], 10);
    "ctab" == a[0]
      ? chrome.tabs.remove(b)
      : chrome.tabs.query(QueryInWindow, function (d) {
          d = d.filter((c) => c.groupId === b).map((c) => c.id);
          chrome.tabs.remove(d);
        });
  }
  static onGroupRemoved(a) {
    (a = document.getElementById("cgroup-" + a.id)) && a.remove();
  }
  static onTabRemoved(a, b) {
    (a = document.getElementById("ctab-" + a)) && a.remove();
  }
  static onTabClick(a) {
    a = this.closest("tr").id.split("-");
    "ctab" == a[0] && chrome.tabs.update(parseInt(a[1], 10), { active: !0 });
  }
  static async onGroupSnapshotClick(a) {
    a = parseInt(this.closest("tr").id.split("-")[1], 10);
    (await GroupStore.snapshotGroup(a)) &&
      (SavedGroup.refresh(), showSuccessTip());
  }
  static async onTabSnapshotClick(a) {
    a = parseInt(this.closest("tr").id.split("-")[1], 10);
    (await GroupStore.snapshotTab(a)) &&
      (SavedGroup.refresh(), showSuccessTip());
  }
  static onMoveMenuClick(a) {
    a.preventDefault();
    a = this.closest("tr").id.split("-");
    Group.dropdownMoveMenu.dataset.targetId = parseInt(a[1], 10);
    Group.dropdownMoveMenu.dataset.targetType =
      "ctab" == a[0] ? "tab" : "group";
    this.nextElementSibling !== Group.dropdownMoveMenu &&
      this.parentElement.appendChild(Group.dropdownMoveMenu);
    this.dataset.bsToggle ||
      ((this.dataset.bsToggle = "dropdown"),
      this.addEventListener("show.bs.dropdown", Group.refreshMoveMenu),
      new bootstrap.Dropdown(this, { display: "static" }).show());
  }
  static onMoveMenuItemClick(a) {
    a = parseInt(Group.dropdownMoveMenu.dataset.targetId, 10);
    a = {
      type: "MoveToWindow",
      moveType: Group.dropdownMoveMenu.dataset.targetType,
      id: a,
    };
    this.dataset.target && (a.windowId = parseInt(this.dataset.target, 10));
    chrome.runtime.sendMessage(a);
  }
  static onNewtabClick(a) {
    const b = parseInt(this.closest("tr").id.split("-")[1], 10);
    chrome.tabs.create({ active: !1 }, function (d) {
      chrome.tabs.group({ groupId: b, tabIds: d.id }, function () {
        chrome.tabs.update(d.id, { active: !0 });
      });
    });
  }
}
var isMacOS = !1;
class SavedGroup {
  static init() {
    SavedGroup.container = document.getElementById("saved-group-list");
    SavedGroup.timeFormat = new Intl.DateTimeFormat(void 0, {
      dateStyle: "short",
      timeStyle: "medium",
    });
    SavedGroup.collapseAll = document.getElementById("saved-collapse-all");
    SavedGroup.collapseAll.addEventListener(
      "click",
      SavedGroup.toggleCollpaseAll
    );
    document
      .getElementById("saved-delete-all")
      .addEventListener("click", SavedGroup.deleteAll);
    
    document
      .getElementById("saved-merge-all")
      .addEventListener("click", SavedGroup.onMergeAllClick);
    SavedGroup.tabEditor = new bootstrap.Modal(
      document.getElementById("saved-editor")
    );
    document
      .getElementById("saved-edit-save")
      .addEventListener("click", SavedGroup.saveEdit);
    SavedGroup.tabEditTitle = document.getElementById("saved-edit-title");
    SavedGroup.tabEditUrl = document.getElementById("saved-edit-url");
    SavedGroup.initAddMenu();
    SavedGroup.fileInput = document.querySelector("input[type=file]");
    SavedGroup.fileInput.addEventListener("change", SavedGroup.importJson);
    let [a, b, d] = document.querySelectorAll("#saved-data-menu button");
    a.addEventListener("click", (c) => SavedGroup.fileInput.click());
    b.addEventListener("click", (c) => GroupStore.exportJson());
    d.addEventListener("click", (c) => GroupStore.exportHtml());
    chrome.storage.sync.get(
      { "max-snapshots": 5, "s-expand": "expand" },
      function (c) {
        SavedGroup.maxSnapshots = c["max-snapshots"];
        let e = document.getElementById("max-snapshots");
        e.value = SavedGroup.maxSnapshots;
        let g = delay(SavedGroup.saveMaxSnapshots, 900);
        e.addEventListener("input", g);
        SavedGroup.defaultCollapse = "collapse" === c["s-expand"];
        c = document.getElementById("saved-expand-state");
        c.checked = SavedGroup.defaultCollapse;
        c.addEventListener("click", SavedGroup.saveDefaultExpand);
        SavedGroup.setupSavedGroups();
      }
    );
    chrome.runtime.getPlatformInfo(function (c) {
      if ((isMacOS = "mac" === c.os)) {
        c = ["pT2Tip", "kb-ctrl-enter", "kb-ctrl-o"];
        for (let e of c)
          (c = document.getElementById(e)),
            (c.innerHTML = c.innerHTML.replace("Ctrl", "\u2318"));
      }
    });
  }
  static initAddMenu() {
    SavedGroup.dropdownAddMenu = document.getElementById("dropdown-add-to");
    SavedGroup.dropdownAddMenu
      .querySelector("button")
      .addEventListener("click", SavedGroup.saveAdd);
  }
  static saveMaxSnapshots() {
    let a = parseInt(this.value, 10);
    0 < a &&
      ((SavedGroup.maxSnapshots = a),
      chrome.storage.sync.set({ "max-snapshots": a }));
  }
  static saveDefaultExpand(a) {
    SavedGroup.defaultCollapse = this.checked;
    chrome.storage.sync.set({
      "s-expand": this.checked ? "collapse" : "expand",
    });
  }
  static refresh() {
    SavedGroup.setupSavedGroups();
  }
  static setNoRecord() {
    let a = document.getElementById("no-saved-groups").content.cloneNode(!0);
    initMsg(a);
    SavedGroup.container.appendChild(a);
  }
  static async setupSavedGroups() {
    var a = await GroupStore.getAll();
    let b = [];
    for (let d of a)
      if ("group" === d.type) {
        b.push(SavedGroup.createGroup(d));
        for (let c of d.tabs) b.push(SavedGroup.createTab(c, d));
      } else "tab" === d.type && b.push(SavedGroup.createTab(d, !1));
    SavedGroup.container.replaceChildren(...b);
    if (0 == a.length) SavedGroup.setNoRecord();
    else if (SavedGroup.defaultCollapse) {
      a = SavedGroup.container.querySelectorAll(
        'img[src="img/expand_less_black.svg"]'
      );
      for (let d of a) d.click();
    } else SavedGroup.updateCollpaseAllBtn();
  }
  static createDeleteBtn() {
    let a = document.createElement("img");
    a.src = "img/delete-24px.svg";
    a.className = "pointer";
    return a;
  }
  static createTab(a, b) {
    let d = document.createElement("tr"),
      c = document.createElement("td");
    var e = document.createElement("div"),
      g = createFavicon(a.url);
    let h = document.createElement("span"),
      k = document.createElement("td"),
      f = SavedGroup.createDeleteBtn();
    const l = a.url;
    e.className = "text-truncate pointer";
    h.textContent = a.title;
    e.appendChild(g);
    e.appendChild(h);
    e.title = l;
    f.addEventListener("click", SavedGroup.deleteTab);
    k.appendChild(f);
    b
      ? (c.classList.add("tab-in-group"),
        e.addEventListener("click", (m) => {
          chrome.runtime.sendMessage({
            type: "OpenTab",
            url: l,
            mode: SavedGroup.getOpenMode(m),
            groupName: b.title,
            groupColor: b.color,
          });
        }))
      : ((d.id = a.id),
        e.addEventListener("click", (m) => SavedGroup.openTab(m, l)));
    c.colSpan = 3;
    c.appendChild(e);
    e = document.createElement("td");
    g = document.createElement("img");
    g.src = "img/edit_black.svg";
    g.className = "pointer";
    g.addEventListener("click", (m) => SavedGroup.showEdit(d, a));
    e.appendChild(g);
    d.appendChild(c);
    d.appendChild(e);
    d.appendChild(k);
    return d;
  }
  static createGroup(a) {
    let b = document.createElement("tr"),
      d = document.createElement("td"),
      c = document.createElement("td"),
      e = document.createElement("td"),
      g = document.createElement("td");
    var h = SavedGroup.createDeleteBtn();
    b.id = a.id;
    d.className = "text-truncate pointer";
    d.title = chrome.i18n.getMessage("pT2GroupTitle");
    var k = document.createElement("span");
    k.title = "";
    k.className = "group-name text-truncate";
    k.dataset.placeholder = NoName;
    a.title && (k.textContent = a.title);
    k.addEventListener("click", SavedGroup.spanToInput);
    var f = document.createElement("input");
    f.title = "";
    f.type = "text";
    f.spellcheck = !1;
    f.className = "d-none group-name";
    f.placeholder = NoName;
    a.title && (f.value = a.title);
    var l = delay(async function () {
      let m = this.value,
        n = this.closest("tr").id;
      (await GroupStore.updateGroupName(n, m)) && showSuccessTip();
    }, 800);
    f.addEventListener("click", (m) => m.stopPropagation());
    f.addEventListener("input", l);
    f.addEventListener("blur", SavedGroup.inputToSpan);
    f.addEventListener("keydown", escForBlur);
    a = createColorSpan(a.color);
    a.title = "";
    a.classList.add("pointer");
    a.addEventListener("click", SavedGroup.onColorClick);
    l = document.createElement("img");
    l.src = "img/chevron_right_black.svg";
    l.className = "size-18 mx-1 align-text-bottom d-none";
    d.appendChild(a);
    d.appendChild(k);
    d.appendChild(f);
    d.appendChild(l);
    d.addEventListener("click", SavedGroup.openGroup);
    k = document.createElement("td");
    f = document.createElement("img");
    f.src = "img/call_merge_black.svg";
    f.className = "pointer size-24";
    f.addEventListener("click", SavedGroup.onMergeClick);
    k.appendChild(f);
    f = document.createElement("img");
    f.src = "img/expand_less_black.svg";
    f.className = "pointer size-24";
    f.addEventListener("click", SavedGroup.onCollapseClick);
    e.className = "expand";
    e.appendChild(f);
    h.addEventListener("click", SavedGroup.deleteGroup);
    g.appendChild(h);
    h = document.createElement("img");
    f = document.createElement("a");
    h.src = "img/add_black.svg";
    h.className = "pointer size-24";
    f.href = "#";
    f.addEventListener("click", SavedGroup.showAdd);
    c.className = "dropdown dropstart";
    f.appendChild(h);
    c.appendChild(f);
    b.appendChild(d);
    b.appendChild(e);
    b.appendChild(c);
    b.appendChild(k);
    b.appendChild(g);
    return b;
  }
  static spanToInput(a) {
    a.stopPropagation();
    this.classList.add("d-none");
    a = this.nextElementSibling;
    a.classList.remove("d-none");
    a.focus();
  }
  static inputToSpan(a) {
    a.stopPropagation();
    this.classList.add("d-none");
    a = this.previousElementSibling;
    a.textContent = this.value;
    a.classList.remove("d-none");
  }
  static onColorClick(a) {
    a.stopPropagation();
    a = this.parentElement;
    if ("DIV" == a.lastElementChild.tagName) a.lastElementChild.remove();
    else {
      var b = this.closest("tr").id,
        d = document.createElement("div");
      d.className = "mt-1";
      for (let c of Object.keys(ColorMap)) {
        let e = createColorSpan(c);
        e.title = "";
        e.classList.add("pointer");
        e.addEventListener("click", async (g) => {
          g.stopPropagation();
          (await GroupStore.updateGroupColor(b, c)) && showSuccessTip();
          this.style.backgroundColor = ColorMap[c];
        });
        d.appendChild(e);
      }
      a.appendChild(d);
    }
  }
  static updateCollpaseAllBtn() {
    let a = SavedGroup.container.querySelectorAll(
        'img[src="img/expand_more_black.svg"]'
      ).length,
      b = SavedGroup.container.querySelectorAll(
        'img[src="img/expand_less_black.svg"]'
      ).length;
    SavedGroup.collapseAll.src =
      0 == a + b || 0 < b
        ? "img/expand_less_black.svg"
        : "img/expand_more_black.svg";
  }
  static toggleCollpaseAll(a) {
    a = this.src.endsWith("img/expand_more_black.svg")
      ? SavedGroup.container.querySelectorAll(
          'img[src="img/expand_more_black.svg"]'
        )
      : SavedGroup.container.querySelectorAll(
          'img[src="img/expand_less_black.svg"]'
        );
    for (let b of a) b.click();
  }
  static onCollapseClick(a) {
    a.preventDefault();
    const b = this.closest("tr");
    a = b.firstElementChild;
    const d = a.firstElementChild;
    var c = d.nextElementSibling.nextElementSibling.nextElementSibling;
    "DIV" == a.lastElementChild.tagName && a.lastElementChild.remove();
    if (this.src.endsWith("img/expand_more_black.svg"))
      for (
        this.src = "img/expand_less_black.svg",
          d.classList.remove("group"),
          c.classList.add("d-none"),
          a = b.nextElementSibling;
        a && !a.id;

      )
        a.firstElementChild.firstElementChild.prepend(c.nextElementSibling),
          a.classList.remove("d-none"),
          (a = a.nextElementSibling);
    else
      for (
        this.src = "img/expand_more_black.svg",
          d.classList.add("group"),
          c.classList.remove("d-none"),
          c = b.nextElementSibling;
        c && !c.id;

      )
        a.appendChild(c.firstElementChild.firstElementChild.firstElementChild),
          c.classList.add("d-none"),
          (c = c.nextElementSibling);
    SavedGroup.updateCollpaseAllBtn();
  }
  static getOpenMode(a) {
    return (isMacOS && a.metaKey) || (!isMacOS && a.ctrlKey)
      ? "background"
      : a.shiftKey
      ? "newWindow"
      : "default";
  }
  static openTab(a, b) {
    a = SavedGroup.getOpenMode(a);
    "background" == a
      ? chrome.tabs.create({ active: !1, url: b })
      : "newWindow" == a
      ? chrome.windows.create({ url: b })
      : chrome.tabs.create({ url: b });
  }
  static openGroup(a) {
    let b = this.closest("tr").id;
    chrome.runtime.sendMessage({
      type: "OpenGroup",
      id: b,
      mode: SavedGroup.getOpenMode(a),
    });
  }
  static async deleteTab(a) {
    a.preventDefault();
    a = this.closest("tr");
    if (a.id) GroupStore.delete(a.id), a.remove();
    else {
      var b = a.previousElementSibling,
        d = a.nextElementSibling;
      if (b.id && ((d && d.id) || !d))
        GroupStore.delete(b.id), b.remove(), a.remove();
      else {
        b = a.firstElementChild.firstElementChild.title;
        d = a.previousElementSibling;
        let c = 0;
        for (; !d.id; ) c++, (d = d.previousElementSibling);
        (await GroupStore.deleteTabInGroup(d.id, c, b)) && a.remove();
      }
    }
    0 == SavedGroup.container.childElementCount && SavedGroup.setNoRecord();
  }
  static deleteGroup(a) {
    a.preventDefault();
    a = this.closest("tr");
    GroupStore.delete(a.id);
    let b = a.nextElementSibling;
    for (; b && !b.id; ) b.remove(), (b = a.nextElementSibling);
    a.remove();
    0 == SavedGroup.container.childElementCount && SavedGroup.setNoRecord();
  }
  static async deleteAll(a) {
    await GroupStore.deleteAll();
    SavedGroup.container.innerHTML = "";
    SavedGroup.setNoRecord();
    this.previousElementSibling.click();
  }
  static async importJson(a) {
    if ((a = this.files[0]))
      if (((this.value = null), a.name.endsWith(".json")))
        if (5e6 < a.size) console.log("file size > 5MB");
        else
          try {
            await GroupStore.importJson(a), SavedGroup.refresh();
          } catch (b) {
            console.log(b);
          }
      else console.log("file type is not json");
  }
  static async onMergeClick(a) {
    a.preventDefault();
    (a = this.closest("tr").querySelector("input").value) &&
      (await GroupStore.mergeGroup(a)) &&
      (SavedGroup.refresh(),
      showSuccessTip(chrome.i18n.getMessage("pT2MergeSuccess")));
  }
  static async onMergeAllClick(a) {
    a.preventDefault();
    (await GroupStore.mergeAllGroups()) &&
      (SavedGroup.refresh(),
      showSuccessTip(chrome.i18n.getMessage("pT2MergeSuccess")));
  }
  static clearEditorInvalid() {
    SavedGroup.tabEditTitle.classList.remove("is-invalid");
    SavedGroup.tabEditUrl.classList.remove("is-invalid");
  }
  static showEdit(a, b) {
    SavedGroup.clearEditorInvalid();
    SavedGroup.editTarget = a;
    SavedGroup.tabEditTitle.value = b.title;
    SavedGroup.tabEditUrl.value = b.url;
    SavedGroup.tabEditor.show();
  }
  static async saveEdit(a) {
    a = SavedGroup.editTarget;
    var b = SavedGroup.tabEditTitle.value.trim();
    const d = SavedGroup.tabEditUrl.value.trim();
    b || SavedGroup.tabEditTitle.classList.add("is-invalid");
    d || SavedGroup.tabEditUrl.classList.add("is-invalid");
    if (b && d) {
      SavedGroup.clearEditorInvalid();
      if (a.id) {
        var c = await GroupStore.updateTab(a.id, b, d);
        c &&
          ((c = SavedGroup.createTab(c, !1)),
          SavedGroup.container.replaceChild(c, a));
      } else {
        let e = a.previousElementSibling;
        for (c = 0; !e.id; ) c++, (e = e.previousElementSibling);
        if ((b = await GroupStore.updateTabInGroup(e.id, c, b, d)))
          (c = SavedGroup.createTab(b.tabs[c], b)),
            SavedGroup.container.replaceChild(c, a);
      }
      SavedGroup.tabEditor.hide();
    }
  }
  static setupAddMenu() {
    let a = SavedGroup.dropdownAddMenu.lastElementChild,
      b = SavedGroup.dropdownAddMenu.firstElementChild,
      d = b.nextElementSibling;
    for (; d !== a; ) d.remove(), (d = b.nextElementSibling);
    chrome.tabs.query(QueryInWindow, function (c) {
      for (let e of c) {
        c = document.createElement("li");
        let g = document.createElement("label"),
          h = document.createElement("input"),
          k = document.createTextNode(e.title);
        g.className = "dropdown-item-text text-truncate";
        g.title = e.title;
        g.dataset.url = e.url;
        g.dataset.icon = e.favIconUrl;
        h.type = "checkbox";
        h.className = "me-1";
        g.appendChild(h);
        g.appendChild(k);
        c.appendChild(g);
        a.before(c);
      }
    });
  }
  static showAdd(a) {
    a.preventDefault();
    SavedGroup.dropdownAddMenu.dataset.targetId = this.closest("tr").id;
    this.nextElementSibling !== SavedGroup.dropdownAddMenu &&
      this.parentElement.appendChild(SavedGroup.dropdownAddMenu);
    this.dataset.bsToggle ||
      ((this.dataset.bsToggle = "dropdown"),
      this.addEventListener("show.bs.dropdown", SavedGroup.setupAddMenu),
      new bootstrap.Dropdown(this, {
        autoClose: "outside",
        display: "static",
      }).show());
  }
  static async saveAdd(a) {
    a = SavedGroup.dropdownAddMenu.dataset.targetId;
    var b = SavedGroup.dropdownAddMenu.querySelectorAll("input:checked");
    let d = [];
    for (let c of b)
      (b = c.parentElement),
        d.push({
          title: b.title ?? "",
          url: b.dataset.url,
          favIconUrl: b.dataset.icon,
        });
    bootstrap.Dropdown.getInstance(
      SavedGroup.dropdownAddMenu.previousElementSibling
    ).hide();
    0 < d.length &&
      (await GroupStore.addTabsInGroup(a, d)) &&
      SavedGroup.refresh();
  }
}
class RuleList {
  static async init() {
    document
      .getElementById("rule-edit")
      .addEventListener("click", RuleList.openEditor);
    var a = await RuleStore.getRuleOptions(),
      b = document.getElementById("rule-scope");
    b.addEventListener("click", RuleList.updateRuleScope);
    b.checked = "all" === a["r-scope"];
    b = document.getElementById("rule-oneGroupInAll");
    b.addEventListener("click", RuleList.updateOneInAll);
    b.checked = a["r-oneGroupInAll"];
    
    b = document.getElementById("rule-autoCollapse");
    b.addEventListener("click", RuleList.updateAutoCollapse);
    b.checked = a["r-autoCollapse"];

    b = document.getElementById("rule-groupByDomain");
    b.addEventListener("click", RuleList.updateGroupByDomain);
    b.checked = a["r-groupByDomain"];
    RuleList.container = document.getElementById("rules-list");
    a = await RuleStore.getAll();
    for (var d of a) RuleList.add(d);
    0 == a.length &&
      ((d = document.getElementById("no-rules").content.cloneNode(!0)),
      initMsg(d),
      RuleList.container.appendChild(d));
  }
  static add(a) {
    let b = document.createElement("tr"),
      d = document.createElement("td"),
      c = document.createElement("span"),
      e = createColorSpan(a.groupColor);
    c.textContent = `${a.ruleName} (${a.groupName})`;
    d.appendChild(e);
    d.appendChild(c);
    (a.enabled ?? !0) ||
      ((a = document.createElement("span")),
      (a.className = "float-end text-muted"),
      (a.textContent = chrome.i18n.getMessage("pT3Disabled")),
      d.appendChild(a));
    b.appendChild(d);
    RuleList.container.appendChild(b);
  }
  static openEditor(a) {
    a.preventDefault();
    chrome.tabs.create({ url: "rules.html" });
  }
  static updateRuleScope(a) {
    RuleStore.updateRuleScope(this.checked);
  }
  static updateOneInAll(a) {
    RuleStore.updateOneInAll(this.checked);
  }
  static updateAutoCollapse(a) {
    RuleStore.updateAutoCollapse(this.checked);
  }
  static updateGroupByDomain(a) {
    RuleStore.updateGroupByDomain(this.checked);
  }
}
class Shortcut {
  static async init() {
    chrome.commands.getAll(function (a) {
      for (let b of a) Shortcut.create(b);
    });
    Shortcut.tabTransitionEnd = !0;
    document.querySelectorAll("#nav-tabs button").forEach(function (a) {
      new bootstrap.Tab(a);
      a.addEventListener("shown.bs.tab", function (b) {
        Shortcut.tabTransitionEnd = !0;
      });
    });
    document.addEventListener("keydown", Shortcut.keyboardListener);
    document
      .getElementById("shortcut-edit")
      .addEventListener("click", Shortcut.openEditor);
    Shortcut.notifyPermCheckbox = document.getElementById(
      "require-notification"
    );
    Shortcut.notifyPermCheckbox.addEventListener(
      "click",
      Shortcut.requireNotification
    );
    Shortcut.notifyPermCheckbox.checked = await chrome.permissions.contains({
      permissions: ["notifications"],
    });
  }
  static create(a) {
    let b = document.getElementById(`cmd-${a.name}`);
    if (b) {
      var d = document.createElement("th");
      d.scope = "row";
      var c = document.createElement("td");
      c.textContent = a.description;
      var e = a.shortcut;
      if (e) {
        var g = e.split("+");
        2 > g.length && (g = e);
        for (e = 0; e < g.length; e++) {
          if (0 != e) {
            var h = document.createTextNode(" + ");
            d.appendChild(h);
          }
          h = document.createElement("kbd");
          h.textContent = g[e];
          d.appendChild(h);
        }
      }
      g = document.createElement("td");
      e = document.createElement("img");
      e.src = "img/edit_black.svg";
      e.className = "pointer size-24";
      g.appendChild(e);
      e.addEventListener("click", (k) => {
        k.preventDefault();
        k =
          "edge://extensions/shortcuts#:~:text=" +
          encodeURIComponent(a.description);
        chrome.tabs.create({ url: k });
      });
      b.appendChild(d);
      b.appendChild(c);
      b.appendChild(g);
    } else console.log("not found cmd tr " + a.name);
  }
  static openEditor(a) {
    a.preventDefault();
    a = chrome.i18n.getMessage("extName");
    a = "edge://extensions/shortcuts#:~:text=" + encodeURIComponent(a);
    chrome.tabs.create({ url: a });
  }
  static async requireNotification() {
    const a = { permissions: ["notifications"] };
    Shortcut.notifyPermCheckbox.checked
      ? (await chrome.permissions.request(a)) ||
        (Shortcut.notifyPermCheckbox.checked = !1)
      : await chrome.permissions.remove(a);
  }
  static keyboardListener(a) {
    if ("INPUT" !== a.target.tagName) {
      var b = a.code,
        d = a.key;
      if (
        !(a.ctrlKey || a.altKey || a.metaKey) ||
        "Enter" === d ||
        "KeyO" === b
      )
        if ("ArrowRight" === b)
          a.preventDefault(), Shortcut.activeNextNavTab(!0);
        else if ("ArrowLeft" === b)
          a.preventDefault(), Shortcut.activeNextNavTab(!1);
        else if ("Backquote" === b)
          a.preventDefault(),
            a.shiftKey
              ? Shortcut.activeNextNavTab(!1)
              : Shortcut.activeNextNavTab(!0);
        else {
          var c = document.querySelector(".tab-pane.active.show"),
            e,
            g;
          "current-tabs" === c.id
            ? (e = c)
            : "saved-groups" === c.id && (g = c);
          if (e || g)
            if ("KeyJ" === b || "ArrowDown" === b)
              a.preventDefault(), Shortcut.activeNextRow(c, !0, a.shiftKey);
            else if ("KeyK" === b || "ArrowUp" === b)
              a.preventDefault(), Shortcut.activeNextRow(c, !1, a.shiftKey);
            else {
              var h = c.querySelector(".active-indicator");
              if (h) {
                const k = "DIV" === h.firstElementChild.tagName;
                if ("Enter" === d || "KeyO" === b) {
                  a.preventDefault();
                  let f;
                  k
                    ? (f = h.firstElementChild)
                    : "Enter" === d
                    ? (f = h.nextElementSibling.firstElementChild)
                    : "KeyO" === b && g && (f = h);
                  f &&
                    ((a = new MouseEvent("click", {
                      shiftKey: a.shiftKey,
                      metaKey: a.metaKey,
                      ctrlKey: a.ctrlKey,
                    })),
                    f.dispatchEvent(a));
                } else
                  (("KeyC" === b || "KeyX" === b) && e) ||
                  (("#" === d || "Delete" === b || "Backspace" === b) && g)
                    ? (a.preventDefault(),
                      Shortcut.activeNextRow(
                        c,
                        !0,
                        "DIV" !== h.firstElementChild.tagName
                      ),
                      h.parentElement.lastElementChild.firstElementChild.click())
                    : "KeyS" === b && e
                    ? (a.preventDefault(),
                      h.parentElement.lastElementChild.previousElementSibling.firstElementChild.click())
                    : "KeyR" === b &&
                      (a.preventDefault(), Shortcut.editGroupName(c));
              }
            }
        }
    }
  }
  static activeNextNavTab(a) {
    var b = document.querySelector("#nav-tabs .nav-link.active");
    b &&
      Shortcut.tabTransitionEnd &&
      ((b = b.parentElement),
      (a = a
        ? b.nextElementSibling
          ? b.nextElementSibling
          : b.parentElement.firstElementChild
        : b.previousElementSibling
        ? b.previousElementSibling
        : b.parentElement.lastElementChild),
      (Shortcut.tabTransitionEnd = !1),
      (a = a.firstElementChild),
      a.focus(),
      bootstrap.Tab.getInstance(a).show());
  }
  static editGroupName(a) {
    (a = a.querySelector(".active-indicator span.group-name:not(.d-none)")) &&
      a.click();
  }
  static activeNextRow(a, b, d = !1) {
    var c = a.querySelector(".active-indicator");
    if (c) {
      c = a = c.parentElement;
      do
        b
          ? ((c = c.nextElementSibling),
            c || (c = a.parentElement.firstElementChild))
          : ((c = c.previousElementSibling),
            c || (c = a.parentElement.lastElementChild));
      while (
        c.classList.contains("d-none") ||
        (d && c.firstElementChild.classList.contains("tab-in-group"))
      );
      c !== a &&
        (a.firstElementChild.classList.remove("active-indicator"),
        c.firstElementChild.classList.add("active-indicator"),
        c.scrollIntoViewIfNeeded(!0));
    } else
      (b = a.querySelector("tbody>tr:first-child")) &&
        "pT2NoRecord" != b.firstElementChild.dataset.i18n &&
        (b.firstElementChild.classList.add("active-indicator"),
        b.scrollIntoViewIfNeeded(!0));
  }
}
function initMsg(a = document) {
  a = a.querySelectorAll("[data-i18n]");
  for (const b of a) b.textContent = chrome.i18n.getMessage(b.dataset.i18n);
}
function initMsgHtml(a = document) {
  a = a.querySelectorAll("[data-i18n-html]");
  for (const b of a) b.innerHTML = chrome.i18n.getMessage(b.dataset.i18nHtml);
}
function init() {
  initMsg();
  initMsgHtml();
  Group.init();
  SavedGroup.init();
  RuleList.init();
  Shortcut.init();
  document.body.classList.remove("d-none");
}
init();
