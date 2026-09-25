/* ==========================================================================
   tree.js — شجرة الاستنباط
   تعرض لكل قول مسارَه من النص إلى الحكم:
       نص  ←  دلالة  ←  قاعدة أصولية  ←  حكم
   وهي طبقة تحليل من المحرِّر مبنيّة على كلام ابن رشد، لا نصٌّ منه.
   ========================================================================== */

/* global window */

(function (BM) {
  "use strict";

  /**
   * ألوان العقد: عقدة النص تأخذ لونَ صنفها في سائر الموقع (الآيةُ بلون الآية،
   * والحديثُ بلون الحديث)، وما بعدها من دلالةٍ وقاعدةٍ محايدٌ، والحكمُ بالذهب.
   * ولا تُلوَّن المساراتُ بالمذاهب: فتلك الألوان محجوزةٌ لأصناف الأدلة، ولو
   * تقاسمها المعنيان لالتبس على الناظر أخضرُ «المالكية» بأخضر «القرآن».
   */
  const SINF_UQDA = {
    دلالة: "dalala",
    قاعدة: "qaida",
    حكم: "hukm",
  };

  const sinfUqda = (u) => {
    if (u.naw !== "نص") return SINF_UQDA[u.naw] || "dalala";
    const matn = String(u.matn || "");
    if (/[﴿{]/.test(matn)) return "nass-aya";
    if (/«/.test(matn)) return "nass-hadith";
    return "nass";
  };

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

    const aqwal = masala.aqwal || [];
    const bilId = new Map(aqwal.map((q, i) => [q.id, { q, i }]));

    const jism = masarat
      .map((masar) => {
        const { q: qawl, i } = bilId.get(masar.qawl_id) || {};
        const uqad = (masar.uqad || [])
          .map((u) => {
            const sinf = sinfUqda(u);
            return (
              `<li class="uqda uqda--${sinf}">` +
              `<div class="uqda__naw">${BM.himaya(u.naw)}</div>` +
              `<div class="uqda__matn">${BM.lawwinNusus(BM.himaya(u.matn))}</div>` +
              `</li>`
            );
          })
          .join("");

        return (
          `<div class="masar">` +
          // المسار موصولٌ ببطاقة قوله برقمه لا بلونه
          `<div class="masar__ism">` +
          (i != null ? `<span class="masar__raqm">القول ${BM.raqm(i + 1)}</span>` : "") +
          `<span>${BM.himaya(ismMasar(qawl))}</span></div>` +
          `<ol class="uqad">${uqad}</ol>` +
          `</div>`
        );
      })
      .join("");

    return `<div class="shajara-lafif"><div class="shajara">${jism}</div></div>`;
  };

})(window.BM);
