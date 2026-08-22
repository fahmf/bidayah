/* ==========================================================================
   core.js — الحالة والتخزين والتوجيه وأدوات مشتركة
   ========================================================================== */

/* global window, document, localStorage */

window.BM = window.BM || {};

(function (BM) {
  "use strict";

  /* ————— البيانات ————— */

  const D = window.BIDAYAH || {};
  BM.masdar = D.masdar || {};
  BM.fahras = D.fahras || [];
  BM.nusus = D.nusus || [];
  BM.tahlil = D.tahlil || {};

  /** دمج النص الآلي بطبقة التحليل اليدوية */
  BM.masail = BM.nusus.map((n) => {
    const t = BM.tahlil[n.id];
    return t ? Object.assign({}, n, t, { lahu_tahlil: true }) : n;
  });

  BM.bilMuarrif = new Map(BM.masail.map((m) => [m.id, m]));

  /* ————— أدوات عامة ————— */

  const ARQAM = "٠١٢٣٤٥٦٧٨٩";
  /** تحويل الأرقام إلى الهندية المستعملة في المشرق والمغرب العربي */
  BM.raqm = (n) => String(n).replace(/\d/g, (d) => ARQAM[+d]);

  /** تهريب المحارف قبل الإدراج في HTML */
  BM.himaya = (s) =>
    String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  /** بناء عنصر من HTML نصي */
  BM.unsur = (html) => {
    const t = document.createElement("template");
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  };

  BM.$ = (sel, jidhr) => (jidhr || document).querySelector(sel);
  BM.$$ = (sel, jidhr) => Array.from((jidhr || document).querySelectorAll(sel));

  /**
   * تلوين الآيات {…} والأحاديث «…» داخل نص جارٍ.
   * يُستدعى بعد التهريب، فالمدخل آمن.
   */
  BM.lawwinNusus = (matnMuharrab) =>
    matnMuharrab
      .replace(
        /\{([^{}]{2,300})\}/g,
        '<span class="aya-satr">﴿$1﴾</span>',
      )
      .replace(
        /«([^«»]{2,400})»/g,
        '<span class="hadith-satr">«$1»</span>',
      );

  /* ————— التخزين ————— */

  const MIFTAH = "bidayah:v1";

  const khazinaIftiradiya = () => ({
    maqru: {}, // { [id]: true }
    natij: {}, // { [id]: { sahih, kull } }
    sima: null, // "light" | "dark" | null (تبع النظام)
    hajm: "m", // s | m | l
  });

  function iqra() {
    try {
      const raw = localStorage.getItem(MIFTAH);
      if (!raw) return khazinaIftiradiya();
      return Object.assign(khazinaIftiradiya(), JSON.parse(raw));
    } catch (e) {
      return khazinaIftiradiya();
    }
  }

  function uktub() {
    try {
      localStorage.setItem(MIFTAH, JSON.stringify(BM.khazina));
    } catch (e) {
      /* التصفح الخاص أو منع التخزين: نتابع بلا حفظ */
    }
  }

  BM.khazina = iqra();
  BM.ihfaz = uktub;

  BM.sajjilQiraa = (id) => {
    if (BM.khazina.maqru[id]) return;
    BM.khazina.maqru[id] = true;
    uktub();
  };

  BM.sajjilNatija = (id, sahih, kull) => {
    BM.khazina.natij[id] = { sahih, kull };
    uktub();
  };

  /* ————— السِّمة وحجم الخط ————— */

  BM.tabbiqSima = (sima) => {
    const nizam =
      window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    document.documentElement.setAttribute("data-theme", sima || nizam);
  };

  BM.qallibSima = () => {
    const hali = document.documentElement.getAttribute("data-theme");
    BM.khazina.sima = hali === "dark" ? "light" : "dark";
    BM.tabbiqSima(BM.khazina.sima);
    uktub();
  };

  const AHJAM = ["s", "m", "l"];
  BM.tabbiqHajm = (h) => document.documentElement.setAttribute("data-hajm", h);
  BM.qallibHajm = () => {
    const i = AHJAM.indexOf(BM.khazina.hajm);
    BM.khazina.hajm = AHJAM[(i + 1) % AHJAM.length];
    BM.tabbiqHajm(BM.khazina.hajm);
    uktub();
  };

  /* ————— وضع التدريب ————— */

  BM.wadTadrib = false;
  BM.qallibTadrib = () => {
    BM.wadTadrib = !BM.wadTadrib;
    document.body.setAttribute("data-tadrib", BM.wadTadrib ? "1" : "0");
    const z = document.getElementById("zir-tadrib");
    if (z) {
      z.classList.toggle("zir--nashit", BM.wadTadrib);
      z.setAttribute("aria-pressed", String(BM.wadTadrib));
    }
    BM.wajjih();
  };

  /* ————— التوجيه ————— */

  /**
   * المسارات:
   *   #/                    الصفحة الأولى
   *   #/m/th-002            مسألة بعينها
   *   #/bahth?q=…           نتائج البحث
   *   #/naw/تردد اللفظ      المسائل المشتركة في سبب اختلاف واحد
   */
  BM.masarHali = () => {
    const h = decodeURIComponent(location.hash.replace(/^#/, "")) || "/";
    const [tariq, istifham] = h.split("?");
    const ajza = tariq.split("/").filter(Boolean);
    const bahth = new URLSearchParams(istifham || "");
    return { ajza, bahth };
  };

  BM.idhhab = (masar) => {
    location.hash = masar;
  };

  BM.wajjih = () => {
    if (typeof BM.arsim === "function") BM.arsim();
  };

  window.addEventListener("hashchange", () => {
    BM.wajjih();
    const matn = document.getElementById("matn");
    if (matn) {
      matn.focus({ preventScroll: true });
      window.scrollTo({ top: 0, behavior: "auto" });
    }
  });

  /* ————— التهيئة الأولى ————— */

  BM.tabbiqSima(BM.khazina.sima);
  BM.tabbiqHajm(BM.khazina.hajm);
  document.body.setAttribute("data-tadrib", "0");

  if (window.matchMedia) {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const rad = () => {
      if (!BM.khazina.sima) BM.tabbiqSima(null);
    };
    if (mq.addEventListener) mq.addEventListener("change", rad);
  }
})(window.BM);
