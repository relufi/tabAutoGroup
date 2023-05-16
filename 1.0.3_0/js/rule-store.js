const ColorMap = {
    grey: "#54585D",
    blue: "#1B68DE",
    red: "#D22C28",
    yellow: "#FCD065",
    green: "#21823D",
    pink: "#FD80C2",
    purple: "#872FDB",
    cyan: "#6FD3E7",
    orange: "#F88542",
  },
  RulePrefix = "rule-";
class RuleStore {
  static get(a) {
    return new Promise(function (b, c) {
      a.startsWith(RulePrefix)
        ? chrome.storage.sync.get(a, function (d) {
            b(d[a]);
          })
        : b(null);
    });
  }
  static getAll() {
    return new Promise(function (a, b) {
      chrome.storage.sync.get(null, function (c) {
        let d = [];
        for (const [e, f] of Object.entries(c))
          e.startsWith(RulePrefix) && d.push(f);
        d.sort(function (e, f) {
          return e.id.localeCompare(f.id);
        });
        a(d);
      });
    });
  }
  static generateId() {
    return RulePrefix + new Date().getTime().toString(36);
  }
  static save(a) {
    a.id || (a.id = RuleStore.generateId());
    let b = {};
    b[a.id] = a;
    return new Promise(function (c, d) {
      chrome.storage.sync.set(b, function () {
        chrome.runtime.lastError ? d(chrome.runtime.lastError.message) : c(a);
      });
    });
  }
  static remove(a) {
    return new Promise(function (b, c) {
      chrome.storage.sync.remove(a, function () {
        chrome.runtime.lastError ? c(chrome.runtime.lastError.message) : b(a);
      });
    });
  }
  static getRuleOptions() {
    return new Promise(function (a, b) {
      chrome.storage.sync.get(
        { "r-scope": "nogroup", "r-oneGroupInAll": !1, "r-autoCollapse": !1, "r-groupByDomain": !1 },
        a
      );
    });
  }
  static updateRuleScope(a) {
    chrome.storage.sync.set({ "r-scope": a ? "all" : "nogroup" });
  }
  static updateOneInAll(a) {
    chrome.storage.sync.set({ "r-oneGroupInAll": a });
  }
  
  static updateAutoCollapse(a) {
    chrome.storage.sync.set({ "r-autoCollapse": a });
  }
  static updateGroupByDomain(a) {
    chrome.storage.sync.set({ "r-groupByDomain": a });
  }
  static setEnabled(a, b) {
    chrome.storage.sync.get(a, function (c) {
      let d = c[a];
      d && ((d.enabled = b), chrome.storage.sync.set(c));
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
      if ("tab-groups-rules" == d.meta?.name && 1 <= d.meta?.version) {
        delete d.meta;
        var e = {};
        for (const [f, g] of Object.entries(d))
          f.startsWith(RulePrefix) &&
            (g.urlMatches || g.titleMatches) &&
            (e[f] = g);
        chrome.storage.sync.set(e, function () {
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
    b = `tabgroups_rules_${d}${e}${c}.${b}`;
    RuleStore.exportFile ||
      (RuleStore.exportFile = document.createElement("a"));
    RuleStore.exportFile.download = b;
    RuleStore.exportFile.href = a;
    RuleStore.exportFile.click();
  }
  static exportJson() {
    chrome.storage.sync.get(null, function (a) {
      for (const b of Object.keys(a)) b.startsWith(RulePrefix) || delete a[b];
      a.meta = { name: "tab-groups-rules", version: 1 };
      a =
        "data:application/json;charset=utf-8," +
        encodeURIComponent(JSON.stringify(a));
      RuleStore.downloadFile(a, "json");
    });
  }
}
