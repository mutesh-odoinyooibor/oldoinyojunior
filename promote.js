/* Year-end promotion for ElimuHub. Shared by the portal (browser) and by the GitHub Actions runner (Node). */
(function (root) {
  var CL = [
    "Grade 1",
    "Grade 2",
    "Grade 3",
    "Grade 4 Red",
    "Grade 4 Blue",
    "Grade 5 Red",
    "Grade 5 Blue",
    "Grade 6 Red",
    "Grade 6 Blue",
    "Grade 7 North",
    "Grade 7 South",
    "Grade 8 North",
    "Grade 8 South",
    "Grade 9 North",
    "Grade 9 South",
  ];
  var MAP = {
    "Grade 1": "Grade 2",
    "Grade 4 Red": "Grade 5 Red",
    "Grade 4 Blue": "Grade 5 Blue",
    "Grade 5 Red": "Grade 6 Red",
    "Grade 5 Blue": "Grade 6 Blue",
    "Grade 7 North": "Grade 8 North",
    "Grade 7 South": "Grade 8 South",
    "Grade 8 North": "Grade 9 North",
    "Grade 8 South": "Grade 9 South",
    "Grade 3": "Grade 4 Red" /* awaiting sorting */,
    "Grade 6 Red": "Grade 7 South",
    "Grade 6 Blue": "Grade 7 South" /* awaiting sorting */,
  };
  var ARCH = [
    "Grade 9 North",
    "Grade 9 South",
  ]; /* kept in the Archive for one year */
  var WAIT = ["Grade 3", "Grade 6 Red", "Grade 6 Blue"];
  var DEL = [
    "Grade 2",
  ]; /* deleted: they register again in Grade 3 with assessment numbers */
  function pid(n) {
    return String(n).replace(/[\/\s]/g, "_");
  }
  var DAY = 864e5;
  function slug(c) {
    return "c_" + c.replace(/\W/g, "_");
  }
  function empty() {
    return { learners: [], archive: [], bin: [], scores: {}, rem: {}, pub: {} };
  }
  async function plan(io) {
    var docs = {};
    for (var i = 0; i < CL.length; i++) {
      docs[CL[i]] = (await io.get("cls/" + slug(CL[i]))) || empty();
    }
    return docs;
  }
  function preview(docs) {
    return CL.map(function (c) {
      return {
        from: c,
        n: (docs[c].learners || []).length,
        to:
          MAP[c] ||
          (ARCH.indexOf(c) >= 0
            ? "Archive (kept 1 year)"
            : DEL.indexOf(c) >= 0
            ? "Deleted (register again in Grade 3)"
            : ""),
        wait: WAIT.indexOf(c) >= 0,
      };
    });
  }
  async function run(io, opts) {
    opts = opts || {};
    var now = opts.now || new Date(),
      Y = now.getUTCFullYear(),
      ts = now.getTime();
    var meta = await io.get("meta/promotion");
    if (!opts.force && meta && meta.lastYear >= Y)
      return { skipped: true, reason: "already done for " + Y };
    var docs = await plan(io),
      nd = {},
      jobs = [],
      moved = 0,
      arch = 0,
      wait = 0,
      deleted = 0,
      gone = [];
    CL.forEach(function (c) {
      var d = docs[c];
      nd[c] = {
        learners: [],
        archive: (d.archive || []).filter(function (x) {
          return !(x.exp && x.exp < ts);
        }),
        bin: d.bin || [],
        scores: {},
        rem: {},
        pub: {},
      };
    });
    CL.forEach(function (c) {
      /* keep every class's score sheets for 2 years */ var d = docs[c],
        ks = Object.keys(d.scores || {}).filter(function (k) {
          return Object.keys(d.scores[k] || {}).length;
        });
      ks.forEach(function (k, i) {
        var sc = {},
          rm = {};
        sc[k] = d.scores[k];
        rm[k] = (d.rem || {})[k] || {};
        jobs.push([
          "sheets/" + slug(c) + "_" + ts + "_" + i,
          {
            cls: c,
            ts: ts,
            exp: ts + 730 * DAY,
            key: k,
            learners: d.learners || [],
            scores: sc,
            rem: rm,
          },
        ]);
      });
    });
    CL.forEach(function (c) {
      var L = docs[c].learners || [];
      if (MAP[c]) {
        var dest = nd[MAP[c]],
          ids = {};
        dest.learners.forEach(function (l) {
          ids[l.n] = 1;
        });
        L.forEach(function (l) {
          if (ids[l.n]) return;
          ids[l.n] = 1;
          var x = Object.assign({}, l);
          delete x.w;
          if (WAIT.indexOf(c) >= 0) {
            x.w = 1;
            wait++;
          }
          dest.learners.push(x);
          moved++;
        });
      } else if (DEL.indexOf(c) >= 0) {
        L.forEach(function (l) {
          deleted++;
          gone.push(l.n);
        });
      } else if (ARCH.indexOf(c) >= 0) {
        L.forEach(function (l) {
          var x = Object.assign({}, l);
          delete x.w;
          x.ts = ts;
          x.exp = ts + 365 * DAY;
          x.from = c;
          x.year = Y;
          nd[c].archive.push(x);
          arch++;
        });
      }
    });
    if (opts.dry)
      return {
        dry: true,
        moved: moved,
        arch: arch,
        wait: wait,
        deleted: deleted,
        sheets: jobs.length,
        preview: preview(docs),
      };
    var bk = {};
    CL.forEach(function (c) {
      bk[c] = docs[c].learners || [];
    });
    await io.set("meta/promotion-backup-" + Y, {
      at: ts,
      learners: bk,
    }); /* safety copy of every class list */
    for (var j = 0; j < jobs.length; j++) await io.set(jobs[j][0], jobs[j][1]);
    for (var k = 0; k < CL.length; k++)
      await io.set("cls/" + slug(CL[k]), nd[CL[k]]);
    if (io.del) {
      for (var g = 0; g < gone.length; g++) {
        try {
          await io.del("pub/" + pid(gone[g]));
        } catch (e) {}
      }
    } /* retire the old registration numbers */
    await io.set("meta/promotion", {
      lastYear: Y,
      at: ts,
      moved: moved,
      arch: arch,
      wait: wait,
      deleted: deleted,
    });
    return {
      done: true,
      moved: moved,
      arch: arch,
      wait: wait,
      deleted: deleted,
      sheets: jobs.length,
    };
  }
  var api = {
    CL: CL,
    MAP: MAP,
    ARCH: ARCH,
    WAIT: WAIT,
    DEL: DEL,
    slug: slug,
    plan: plan,
    preview: preview,
    run: run,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.ehPromote = api;
})(typeof window !== "undefined" ? window : globalThis);
