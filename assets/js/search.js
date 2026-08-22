/* ==========================================================================
   search.js — البحث والتصفية
   تطبيع عربي: إسقاط الحركات والتطويل، وتوحيد الهمزات والألف المقصورة
   والتاء المربوطة، حتى يجد الباحث «الوضوء» بكتابة «الوضو».
   ========================================================================== */

/* global window */

(function (BM) {
  "use strict";

  const HARAKAT = /[ً-ْـٰۖ-ۭ]/g;

  /** تطبيع الكلمة العربية للمقارنة */
  BM.tanzif = (s) =>
    String(s || "")
      .replace(HARAKAT, "")
      .replace(/[أإآٱ]/g, "ا")
      .replace(/ى/g, "ي")
      .replace(/ة/g, "ه")
      .replace(/[ؤئ]/g, "ء")
      .replace(/[«»﴿﴾{}()\[\]"'،؛:.؟!ـ-]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  /** النص الذي يشمله البحث في مسألة واحدة */
  function fahrasMasala(m) {
    const qita = [m.unwan, m.kitab, m.bab, m.nass_kamil];
    if (m.sabab) qita.push(m.sabab.nass, (m.sabab.anwa || []).join(" "), m.sabab.sharh);
    (m.aqwal || []).forEach((q) => {
      qita.push(q.nass);
      (q.qailun || []).forEach((r) => qita.push(r.ism, r.madhhab));
      (q.adilla || []).forEach((d) => {
        qita.push(d.matn, d.takhrij, d.naw_al_dalala, d.sinf);
        if (d.wajh_al_istidlal)
          qita.push(d.wajh_al_istidlal.nass, d.wajh_al_istidlal.sharh);
      });
    });
    return BM.tanzif(qita.filter(Boolean).join(" \n "));
  }

  // فهرس محسوب مرة واحدة
  const FAHRAS = new Map();
  BM.fahrasBahth = (m) => {
    if (!FAHRAS.has(m.id)) FAHRAS.set(m.id, fahrasMasala(m));
    return FAHRAS.get(m.id);
  };

  /** بحث نصي: كل كلمات الطلب يجب أن ترد في المسألة */
  BM.ibhath = (talab) => {
    const kalimat = BM.tanzif(talab).split(" ").filter((k) => k.length > 1);
    if (!kalimat.length) return [];
    return BM.masail
      .map((m) => {
        const nass = BM.fahrasBahth(m);
        if (!kalimat.every((k) => nass.includes(k))) return null;
        // ترجيح: ورود الكلمة في العنوان أثقل
        const fiUnwan = kalimat.filter((k) => BM.tanzif(m.unwan).includes(k)).length;
        return { m, wazn: fiUnwan * 10 + kalimat.length };
      })
      .filter(Boolean)
      .sort((a, b) => b.wazn - a.wazn || a.m.raqm - b.m.raqm)
      .map((x) => x.m);
  };

  /** مقتطف حول أول موضع ورد فيه الطلب، مع تظليله */
  BM.muqtataf = (m, talab) => {
    const kalimat = BM.tanzif(talab).split(" ").filter((k) => k.length > 1);
    const asl = m.nass_kamil || "";
    if (!kalimat.length) return BM.himaya(asl.slice(0, 160)) + "…";

    // نبحث في النص المطبَّع مع تتبع الإزاحة إلى النص الأصلي
    const kalimatAsl = asl.split(/\s+/);
    let mawqi = -1;
    for (let i = 0; i < kalimatAsl.length; i++) {
      if (BM.tanzif(kalimatAsl[i]).includes(kalimat[0])) {
        mawqi = i;
        break;
      }
    }
    if (mawqi < 0) return BM.himaya(asl.slice(0, 160)) + "…";

    const min = Math.max(0, mawqi - 12);
    const max = Math.min(kalimatAsl.length, mawqi + 16);
    const qita = kalimatAsl.slice(min, max).map((k) => {
      const n = BM.tanzif(k);
      return kalimat.some((q) => n.includes(q))
        ? "<mark>" + BM.himaya(k) + "</mark>"
        : BM.himaya(k);
    });
    return (min ? "… " : "") + qita.join(" ") + (max < kalimatAsl.length ? " …" : "");
  };

  /* ————— المرشِّحات ————— */

  BM.murashshih = { sinf: null, madhhab: null, naw_sabab: null };

  /** جمع القيم المتاحة للمرشحات من كل المسائل */
  BM.qawaimMurashshih = () => {
    const asnaf = new Map();
    const madhahib = new Map();
    const anwa = new Map();
    const zid = (m, k) => m.set(k, (m.get(k) || 0) + 1);

    BM.masail.forEach((m) => {
      (m.aqwal || []).forEach((q) => {
        (q.qailun || []).forEach((r) => r.madhhab && zid(madhahib, r.madhhab));
        (q.adilla || []).forEach((d) => d.sinf && zid(asnaf, d.sinf));
      });
      if (m.sabab && m.sabab.anwa) m.sabab.anwa.forEach((n) => zid(anwa, n));
    });

    const rattib = (m) =>
      Array.from(m.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ar"));
    return { asnaf: rattib(asnaf), madhahib: rattib(madhahib), anwa: rattib(anwa) };
  };

  /** هل تجتاز المسألة المرشِّحات الحالية؟ */
  BM.tajtaz = (m) => {
    const f = BM.murashshih;
    if (f.sinf) {
      const lahu = (m.aqwal || []).some((q) =>
        (q.adilla || []).some((d) => d.sinf === f.sinf),
      );
      if (!lahu) return false;
    }
    if (f.madhhab) {
      const lahu = (m.aqwal || []).some((q) =>
        (q.qailun || []).some((r) => r.madhhab === f.madhhab),
      );
      if (!lahu) return false;
    }
    if (f.naw_sabab) {
      const anwa = (m.sabab && m.sabab.anwa) || [];
      if (!anwa.includes(f.naw_sabab)) return false;
    }
    return true;
  };

  BM.lahuMurashshih = () =>
    Boolean(BM.murashshih.sinf || BM.murashshih.madhhab || BM.murashshih.naw_sabab);

  /** المسائل المشتركة في نوع سبب اختلاف واحد */
  BM.masailBiNaw = (naw) =>
    BM.masail.filter((m) => m.sabab && (m.sabab.anwa || []).includes(naw));
})(window.BM);
