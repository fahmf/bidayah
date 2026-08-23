/* ==========================================================================
   tadrib.js — وضع التدريب
   المقصود بناء الملكة: يُعرض الدليل أولًا، ثم يُسأل الطالب عن الحكم
   أو القائل أو سبب الاختلاف، ثم يُكشف له وجه الصواب مع تفسيره.
   ========================================================================== */

/* global window, document */

(function (BM) {
  "use strict";

  const HURUF = "أبجدهـوز";

  /**
   * ترتيب الخيارات:
   * كُتبت الأجوبة الصحيحة في البيانات على نسقٍ واحد غالبًا، فلو عُرضت على
   * ترتيبها لأمكن أن يُصاب الجواب بالعادة لا بالنظر — وذلك ينقض مقصود التدريب.
   * فتُخلط الخيارات بترتيبٍ مشتقٍّ من معرّف المسألة ورقم السؤال، فهو ثابتٌ
   * للمسألة الواحدة (لا يتبدّل عند كل تحميل) ومختلفٌ بين المسائل.
   */
  const bidhra = (nass) => {
    let h = 2166136261;
    for (let i = 0; i < nass.length; i++) {
      h ^= nass.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return () => {
      h ^= h << 13;
      h ^= h >>> 17;
      h ^= h << 5;
      return ((h >>> 0) % 1000) / 1000;
    };
  };

  /** يعيد ترتيب العرض: مصفوفة من الفهارس الأصلية */
  const rattib = (masalaId, raqmSual, adad) => {
    const rand = bidhra(masalaId + ":" + raqmSual);
    const tartib = Array.from({ length: adad }, (_, i) => i);
    for (let i = adad - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [tartib[i], tartib[j]] = [tartib[j], tartib[i]];
    }
    return tartib;
  };

  /** رسم أسئلة مسألة واحدة */
  BM.arsimTadrib = (masala) => {
    const asila = masala.tadrib || [];
    if (!asila.length) return "";

    const bitaqat = asila
      .map((s, i) => {
        const tartib = rattib(masala.id, i, (s.khiyarat || []).length);
        const khiyarat = tartib
          .map(
            (asl, j) =>
              `<button class="khiyar" data-sual="${i}" data-khiyar="${asl}">` +
              `<span class="khiyar__harf">${HURUF[j] || j + 1}</span>` +
              `<span>${BM.lawwinNusus(BM.himaya(s.khiyarat[asl]))}</span>` +
              `</button>`,
          )
          .join("");

        return (
          `<div class="tadrib" data-bitaqa="${i}">` +
          `<p class="tadrib__sual">${BM.raqm(i + 1)}. ${BM.lawwinNusus(BM.himaya(s.suaal))}</p>` +
          `<div class="khiyarat">${khiyarat}</div>` +
          `<div class="tafsir" hidden>${BM.lawwinNusus(BM.himaya(s.tafsir || ""))}</div>` +
          `</div>`
        );
      })
      .join("");

    const sabiq = BM.khazina.natij[masala.id];
    const natija =
      `<div class="natija" id="natija-tadrib">` +
      `<span>${
        sabiq
          ? `نتيجتك السابقة: ${BM.raqm(sabiq.sahih)} من ${BM.raqm(sabiq.kull)}`
          : "أجب عن الأسئلة لتقيس فهمك للمسألة"
      }</span>` +
      `<button class="zir" id="zir-kashf">كشف الجواب كاملًا</button>` +
      `</div>`;

    return bitaqat + natija;
  };

  /** ربط الأحداث بعد الإدراج في الصفحة */
  BM.arbitTadrib = (masala, jidhr) => {
    const asila = masala.tadrib || [];
    if (!asila.length) return;

    const mujab = new Map(); // رقم السؤال ← أصاب؟

    BM.$$(".khiyar", jidhr).forEach((zir) => {
      zir.addEventListener("click", () => {
        const i = +zir.dataset.sual;
        const j = +zir.dataset.khiyar;
        if (mujab.has(i)) return; // لا يُجاب مرتين

        const sual = asila[i];
        const bitaqa = zir.closest(".tadrib");
        mujab.set(i, j === sual.sahih);

        BM.$$(".khiyar", bitaqa).forEach((k) => {
          const kj = +k.dataset.khiyar;
          k.disabled = true;
          if (kj === sual.sahih) k.classList.add("khiyar--sahih");
          else if (kj === j) k.classList.add("khiyar--khata");
        });

        const tafsir = BM.$(".tafsir", bitaqa);
        if (tafsir && tafsir.textContent.trim()) tafsir.hidden = false;

        const sahih = Array.from(mujab.values()).filter(Boolean).length;
        BM.sajjilNatija(masala.id, sahih, asila.length);

        const natija = BM.$("#natija-tadrib span", jidhr);
        if (natija)
          natija.textContent = `أصبتَ في ${BM.raqm(sahih)} من ${BM.raqm(
            mujab.size,
          )} مما أجبتَ عنه (المجموع ${BM.raqm(asila.length)})`;

        if (mujab.size === asila.length) BM.hadithFahras();
      });
    });

    const kashf = BM.$("#zir-kashf", jidhr);
    if (kashf)
      kashf.addEventListener("click", () => {
        if (BM.wadTadrib) BM.qallibTadrib();
        else {
          document
            .querySelectorAll("[data-yukhfa]")
            .forEach((el) => el.removeAttribute("data-yukhfa"));
        }
      });
  };
})(window.BM);
