/*
 * ingest.mjs — تحويل نص «بداية المجتهد» (صيغة OpenITI) إلى بيانات الموقع.
 *
 * المصادر: الأقسام المسجَّلة في tools/aqsam.mjs، كلٌّ من ملفّه في masdar/.
 * الخرج:   data/nusus.js — نصّ ابن رشد بحروفه، لا يُحرَّر باليد أبدًا.
 *
 * التشغيل: node tools/ingest.mjs
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { AQSAM, MASDAR, muarrifWahda, tahaqqaqMinSijill } from "./aqsam.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = resolve(ROOT, "data/nusus.js");

/* ————— أدوات ————— */

const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";
export const raqamAr = (n) => String(n).replace(/\d/g, (d) => AR_DIGITS[+d]);

/** إزالة علامات الميلستون واختزال الفراغات */
const nazzif = (s) =>
  s
    .replace(/ms\d{4}/g, " ")
    .replace(/[ \t ]+/g, " ")
    .trim();

/** موضع النص: ج١ ص١٤ أو ج١ ص١٤-١٥ */
const mawdiNass = (juz, from, to) =>
  from === to
    ? `ج${raqamAr(juz)} ص${raqamAr(from)}`
    : `ج${raqamAr(juz)} ص${raqamAr(from)}-${raqamAr(to)}`;

/* ————— المرحلة ١: تفكيك الملف إلى فقرات مرقَّمة الصفحات ————— */

/**
 * علامة الصفحة في OpenITI توضع في *آخر* الصفحة، فصفحة الفقرة تُحسب هكذا:
 *   صفحة البداية = (صفحة آخر علامة قبلها) + ١
 *   صفحة النهاية = صفحة أول علامة بعدها
 */
function faqqirNass(raw) {
  const lines = raw.split("\n");
  const bidaya = lines.findIndex((l) => l.startsWith("#META#Header#End#"));
  const body = lines.slice(bidaya + 1);

  const items = []; // { naw: "unwan" | "faqra", matn, juz, min, max }
  let juz = 1;
  let akhirSafha = null; // آخر علامة صفحة مرّت
  let jari = null; // الفقرة الجارية

  const ikhtim = () => {
    if (jari && nazzif(jari.matn)) {
      jari.matn = nazzif(jari.matn);
      items.push(jari);
    }
    jari = null;
  };

  for (const line of body) {
    const safha = line.match(/^# PageV(\d+)P(\d+)/);
    if (safha) {
      juz = +safha[1] || juz;
      const raqm = +safha[2];
      // كل فقرة لم تُغلق صفحتها بعدُ تنتهي عند هذه العلامة
      for (const it of items) if (it.max === null) it.max = raqm;
      if (jari && jari.max === null) jari.max = raqm;
      akhirSafha = raqm;
      continue;
    }

    const unwan = line.match(/^### \|+\s*(.+?)\s*$/);
    if (unwan) {
      ikhtim();
      const matn = nazzif(unwan[1]).replace(/^\[|\]$/g, "").replace(/\s*[:.]\s*$/, "");
      items.push({
        naw: "unwan",
        matn,
        juz,
        min: (akhirSafha ?? 0) + 1,
        max: null,
      });
      continue;
    }

    if (line.startsWith("~~")) {
      if (jari) jari.matn += " " + line.slice(2);
      continue;
    }

    if (line.startsWith("# ")) {
      ikhtim();
      jari = {
        naw: "faqra",
        matn: line.slice(2),
        juz,
        min: (akhirSafha ?? 0) + 1,
        max: null,
      };
      continue;
    }
  }
  ikhtim();

  // ما بقي بلا علامة نهاية يأخذ صفحة بدايته
  for (const it of items) if (it.max === null) it.max = it.min;
  for (const it of items) it.mawdi = mawdiNass(it.juz, it.min, it.max);
  return items;
}

/* ————— المرحلة ٢: بناء الشجرة (كتاب ← باب ← مسألة) ————— */

const huwaKitab = (t) => /^كتاب\s/.test(t);
// ملاحظة: \b لا تعمل مع الحروف العربية، فنستعمل النظر الأمامي بدلًا منها
const huwaMasala = (t) => /^(?:و)?(?:المسألة|مسألة)(?=[\s:،.]|$)/.test(t);
const fihiSabab = (t) => /(?:و)?(?:السبب في اختلافهم|سبب اختلافهم|سبب الخلاف|وسبب الخلاف)/.test(t);

/**
 * في الأبواب التي لم يصرّح فيها ابن رشد بلفظ «المسألة» في صدر الفقرة
 * لا نخترع حدودًا للمسائل، بل نقتصر على ما نصّ هو عليه: «وأما المسألة الأولى…».
 * فإن لم يكن في الباب شيء من ذلك جُعل الباب كلُّه مبحثًا واحدًا،
 * حفاظًا على سياق كلامه وعدم تقطيعه بغير دليل.
 */
const yabtadiMabhath = (t) => /^(?:و)?أما المسألة/.test(t);

/** هل في الفقرة أثر خلاف يستحق أن تُفرد بمبحث؟ */
const fihiKhilaf = (t) => /(?:اختلف|الخلاف|خلاف|أجمع|اتفق)/.test(t);

/** عدد الحروف العربية — لا يصح استعمال \w و \W مع العربية */
const adadHuruf = (s) => (s.match(/[ء-ي]/g) || []).length;
/** هل العنوان كافٍ للدلالة على المسألة؟ */
const unwanKafin = (s) => adadHuruf(s) >= 12;

/** عنوان مختصر للمسألة من أول جملة فيها */
function unwanMukhtasar(matn) {
  let t = matn
    .replace(/^(?:و)?(?:المسألة|مسألة)\s*/, "")
    .replace(/^(?:ف|و)?أما\s+/, "")
    .replace(
      /^(?:الأولى|الثانية|الثالثة|الرابعة|الخامسة|السادسة|السابعة|الثامنة|التاسعة|الحادية|العاشرة)?\s*(?:عشرة)?\s*/,
      "",
    )
    .replace(/^(?:من الشروط|من الأحكام|من الأركان|من التحديد|من تحديد المحال|من الأعداد|من تعيين المحال|من الصفات)\s*:?\s*/, "")
    // «المسألة الأولى فأما الجواز…»: الرتبة تسبق أداة الاستئناف، فنعيد الحذف
    .replace(/^(?:ف|و)?أما\s+/, "")
    .replace(/^[:：]\s*/, "");
  // اقتطاع عند أول فاصل طبيعي
  const qat = t.search(/[.،؟]|(?:\s(?:فذهب|فقال|فاختلف|وذهب|وقال|واختلف)\s)/);
  if (qat > 20) t = t.slice(0, qat);
  t = t.trim();
  if (t.length > 90) t = t.slice(0, 88).replace(/\s\S*$/, "") + "…";
  return t || "مسألة";
}

/** استخراج الأدلة النصية الظاهرة: {آية} و«حديث» */
function istakhrijNusus(matn) {
  const out = [];
  for (const m of matn.matchAll(/\{([^{}]{4,200})\}/g))
    out.push({ naw: "آية", matn: nazzif(m[1]) });
  for (const m of matn.matchAll(/«([^«»]{4,300})»/g))
    out.push({ naw: "حديث", matn: nazzif(m[1]) });
  return out;
}

function ibniShajara(items, qism) {
  const kutub = [];
  let kitab = null;
  let bab = null;
  let masala = null;

  const kitabJadid = (matn, mawdi) => {
    kitab = { unwan: matn, mawdi, abwab: [] };
    kutub.push(kitab);
    bab = null;
    masala = null;
  };
  const babJadid = (matn, mawdi) => {
    if (!kitab) kitabJadid(qism.qism, mawdi);
    bab = { unwan: matn, mawdi, tamhid: [], masail: [] };
    kitab.abwab.push(bab);
    masala = null;
  };

  for (const it of items) {
    if (it.naw === "unwan") {
      if (huwaKitab(it.matn)) kitabJadid(it.matn, it.mawdi);
      else babJadid(it.matn, it.mawdi);
      continue;
    }

    if (!bab) babJadid(kitab ? kitab.unwan : "تمهيد", it.mawdi);

    if (huwaMasala(it.matn)) {
      masala = {
        naw: "مسألة",
        unwan: unwanMukhtasar(it.matn),
        sadr: it.matn,
        mawdi: it.mawdi,
        fiqar: [it],
        nusus_zahira: istakhrijNusus(it.matn),
        sabab: fihiSabab(it.matn) ? { nass: it.matn, mawdi: it.mawdi } : null,
      };
      bab.masail.push(masala);
      continue;
    }

    if (masala) {
      masala.fiqar.push(it);
      masala.nusus_zahira.push(...istakhrijNusus(it.matn));
      if (!masala.sabab && fihiSabab(it.matn))
        masala.sabab = { nass: it.matn, mawdi: it.mawdi };
    } else {
      bab.tamhid.push(it);
    }
  }

  // الأبواب التي لا مسائل مصرَّحة فيها: نقسّم فقراتها إلى مباحث
  for (const kitab of kutub)
    for (const bab of kitab.abwab) {
      if (bab.masail.length || !bab.tamhid.length) continue;

      const lahuMasail = bab.tamhid.some((f) => yabtadiMabhath(f.matn));

      // لا مسائل منصوصة: إن كان في الباب خلاف فهو مبحث واحد، وإلا فتمهيد محض
      if (!lahuMasail) {
        if (!bab.tamhid.some((f) => fihiKhilaf(f.matn))) continue;
        bab.masail.push({
          naw: "مبحث",
          unwan: bab.unwan.replace(/^الباب [^:]*:?\s*/, "").trim() || bab.unwan,
          sadr: bab.tamhid[0].matn,
          mawdi: bab.tamhid[0].mawdi,
          fiqar: bab.tamhid.slice(),
          nusus_zahira: dedupe(bab.tamhid.flatMap((f) => istakhrijNusus(f.matn))),
          sabab: (() => {
            const f = bab.tamhid.find((x) => fihiSabab(x.matn));
            return f ? { nass: f.matn, mawdi: f.mawdi } : null;
          })(),
        });
        bab.tamhid = [];
        continue;
      }

      const tamhidJadid = [];
      let jari = null;
      for (const f of bab.tamhid) {
        if (yabtadiMabhath(f.matn)) {
          jari = {
            naw: "مبحث",
            unwan: unwanMukhtasar(f.matn),
            sadr: f.matn,
            mawdi: f.mawdi,
            fiqar: [f],
            nusus_zahira: istakhrijNusus(f.matn),
            sabab: fihiSabab(f.matn) ? { nass: f.matn, mawdi: f.mawdi } : null,
          };
          bab.masail.push(jari);
        } else if (jari) {
          jari.fiqar.push(f);
          jari.nusus_zahira.push(...istakhrijNusus(f.matn));
          if (!jari.sabab && fihiSabab(f.matn))
            jari.sabab = { nass: f.matn, mawdi: f.mawdi };
        } else {
          tamhidJadid.push(f); // ما قبل أول مبحث يبقى تمهيدًا للباب
        }
      }
      bab.tamhid = tamhidJadid;
    }

  return kutub;
}

/* ————— المرحلة ٣: تسوية الخرج ————— */

function sawwi(kutub, qism) {
  const masail = [];
  let raqm = 0;
  for (const kitab of kutub)
    for (const bab of kitab.abwab)
      for (const m of bab.masail) {
        m.raqm = ++raqm; // ترقيم متسلسل على ترتيب الكتاب
        const fiqar = m.fiqar.map((f) => ({ matn: f.matn, mawdi: f.mawdi }));
        // بعض المسائل صدرها ترويسة مجردة («المسألة الثانية من الأحكام»)
        // فيُلتمس العنوان من الفقرة التالية
        for (let i = 1; i < fiqar.length && !unwanKafin(m.unwan); i++)
          m.unwan = unwanMukhtasar(fiqar[i].matn);
        masail.push({
          id: muarrifWahda(qism, m.raqm),
          raqm: m.raqm,
          naw: m.naw,
          qism: qism.qism,
          unwan: m.unwan,
          kitab: kitab.unwan,
          bab: bab.unwan,
          mawdi: m.mawdi,
          mawdi_kamil: `${fiqar[0].mawdi} — ${fiqar[fiqar.length - 1].mawdi}`,
          fiqar,
          nass_kamil: fiqar.map((f) => f.matn).join("\n"),
          nusus_zahira: dedupe(m.nusus_zahira),
          sabab: m.sabab,
        });
      }

  const fahras = kutub.map((k) => ({
    unwan: k.unwan,
    qism: qism.qism,
    abwab: k.abwab.map((b) => ({
      unwan: b.unwan,
      mawdi: b.mawdi,
      tamhid: b.tamhid.map((f) => ({ matn: f.matn, mawdi: f.mawdi })),
      masail: b.masail.map((m) => muarrifWahda(qism, m.raqm)),
    })),
  }));

  return { fahras, masail };
}

const dedupe = (arr) => {
  const seen = new Set();
  return arr.filter((x) => {
    const k = x.naw + "|" + x.matn;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
};

/* ————— التشغيل ————— */

tahaqqaqMinSijill();

const fahras = [];
const masail = [];

for (const qism of AQSAM) {
  const src = resolve(ROOT, qism.masdar);
  if (!existsSync(src)) {
    console.error(
      `\n  ✘ ${qism.muarrif}: لا يوجد ${qism.masdar}\n` +
        `    اقتطعه أولًا: node tools/istikhraj.mjs <ملف OpenITI الكامل> ${qism.muarrif}\n`,
    );
    process.exit(1);
  }

  const shajara = ibniShajara(faqqirNass(readFileSync(src, "utf8")), qism);
  const data = sawwi(shajara, qism);

  if (!data.masail.length) {
    console.error(`\n  ✘ ${qism.muarrif}: لم تُستخرج أي وحدة من ${qism.masdar}\n`);
    process.exit(1);
  }

  fahras.push(...data.fahras);
  masail.push(...data.masail);

  const bilaSabab = data.masail.filter((m) => !m.sabab).length;
  console.log(
    `  ✔ ${qism.muarrif.padEnd(4)} ${qism.qism.padEnd(18)} ` +
      `${String(data.masail.length).padStart(3)} وحدة | ` +
      `${data.fahras.length} كتاب | ` +
      `${data.fahras.reduce((a, k) => a + k.abwab.length, 0)} باب | ` +
      `بلا فقرة «سبب اختلافهم»: ${bilaSabab}`,
  );
}

/* المعرّفات هي مفاتيح data/tahlil.js، فتكرارُها يُسقط تحليلًا كاملًا بلا ضجيج */
const mukarrar = masail.map((m) => m.id).filter((id, i, a) => a.indexOf(id) !== i);
if (mukarrar.length) {
  console.error(`\n  ✘ معرّفات مكررة بين الأقسام: ${[...new Set(mukarrar)].join(", ")}\n`);
  process.exit(1);
}

const masdar = {
  ...MASDAR,
  aqsam: AQSAM.map((q) => ({ muarrif: q.muarrif, qism: q.qism, masdar: q.masdar })),
};

writeFileSync(
  OUT,
  `/* مولَّد آليًا بواسطة tools/ingest.mjs — لا يُحرَّر باليد.
   نصّ ابن رشد بحروفه من ${masdar.masdar_raqami}. */
window.BIDAYAH = window.BIDAYAH || {};
window.BIDAYAH.masdar = ${JSON.stringify(masdar, null, 2)};
window.BIDAYAH.fahras = ${JSON.stringify(fahras, null, 1)};
window.BIDAYAH.nusus = ${JSON.stringify(masail, null, 1)};
`,
  "utf8",
);

console.log(
  `\n✔ ${masail.length} وحدة من ${AQSAM.length} قسم → ${OUT.replace(ROOT + "/", "")}\n`,
);
