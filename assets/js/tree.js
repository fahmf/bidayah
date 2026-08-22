/* ==========================================================================
   tree.js — شجرة الاستنباط
   تعرض لكل قول مسارَه من النص إلى الحكم:
       نص  ←  دلالة  ←  قاعدة أصولية  ←  حكم
   وهي طبقة تحليل من المحرِّر مبنيّة على كلام ابن رشد، لا نصٌّ منه.
   ========================================================================== */

/* global window */

(function (BM) {
  "use strict";

  const ALWAN_MADHAHIB = {
    المالكية: "var(--maliki)",
    الحنفية: "var(--hanafi)",
    الشافعية: "var(--shafii)",
    الحنابلة: "var(--hanbali)",
    الظاهرية: "var(--zahiri)",
  };

  const SINF_UQDA = {
    نص: "nass",
    دلالة: "dalala",
    قاعدة: "qaida",
    حكم: "hukm",
  };

  /** لون المسار: لون مذهب أول قائل، وإلا لون محايد */
  function lawnQawl(qawl) {
    const madhhab = ((qawl && qawl.qailun) || []).map((q) => q.madhhab).find(Boolean);
    return ALWAN_MADHAHIB[madhhab] || "var(--hashiya-2)";
  }

  /** اسم مختصر للمسار: أسماء القائلين */
  function ismMasar(qawl) {
    const asma = ((qawl && qawl.qailun) || []).map((q) => q.ism);
    if (!asma.length) return "القول";
    if (asma.length <= 2) return asma.join(" و");
    return asma[0] + " ومن وافقه";
  }

  /**
   * رسم الشجرة.
   * @returns {string} HTML أو سلسلة فارغة إن لم يكن للمسألة تحليل
   */
  BM.arsimShajara = (masala) => {
    const masarat = masala.shajarat_al_istinbat || [];
    if (!masarat.length) return "";

    const aqwal = new Map((masala.aqwal || []).map((q) => [q.id, q]));

    const jism = masarat
      .map((masar) => {
        const qawl = aqwal.get(masar.qawl_id);
        const uqad = (masar.uqad || [])
          .map((u) => {
            const sinf = SINF_UQDA[u.naw] || "nass";
            return (
              `<li class="uqda uqda--${sinf}">` +
              `<div class="uqda__naw">${BM.himaya(u.naw)}</div>` +
              `<div class="uqda__matn">${BM.lawwinNusus(BM.himaya(u.matn))}</div>` +
              `</li>`
            );
          })
          .join("");

        return (
          `<div class="masar" style="--lawn-qawl:${lawnQawl(qawl)}">` +
          `<div class="masar__ism">${BM.himaya(ismMasar(qawl))}</div>` +
          `<ol class="uqad">${uqad}</ol>` +
          `</div>`
        );
      })
      .join("");

    return `<div class="shajara-lafif"><div class="shajara">${jism}</div></div>`;
  };

  BM.lawnQawl = lawnQawl;
})(window.BM);
