/*
 * verify.mjs — التحقق من سلامة البيانات وحرفية الاقتباس.
 *
 * أهم ما يفعله: يتأكد أن كل نصٍّ نُسِب إلى ابن رشد في data/tahlil.js
 * موجودٌ بحروفه في مصدر قسمِه المسجَّل في tools/aqsam.mjs. فإن اختلف حرفٌ
 * واحد سقط البناء، فليست دعوى الحرفية وعدًا بل شرطًا يفحصه الحاسوب.
 *
 * والمقابلة تكون بمصدر القسم وحدَه لا بمجموع المصادر: فلو قُوبل اقتباسُ
 * «كتاب الصلاة» بنصّ «كتاب الطهارة» لجاز أن يمرّ اقتباسٌ نُسب إلى موضعه
 * الخطأ ما دام لفظُه موجودًا في مكانٍ ما من الكتاب.
 *
 * التشغيل: node tools/verify.mjs
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { AQSAM, badiat, qismWahda, tahaqqaqMinSijill } from "./aqsam.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

tahaqqaqMinSijill();

/* ————— تحميل البيانات ————— */

const win = {};
const tahmil = (masar) => {
  const src = readFileSync(resolve(ROOT, masar), "utf8");
  new Function("window", src)(win);
};

tahmil("data/nusus.js");
tahmil("data/tahlil.js");

const { nusus, fahras, tahlil } = win.BIDAYAH;

/* ————— التطبيع قبل المقارنة —————
   نُسقِط علامات الاقتباس والأقواس فقط، ونوحّد الفراغات.
   ولا نمسّ الحروف ولا الحركات: فالمقصود التحقق من الحرفية. */

const sawwi = (s) =>
  String(s)
    .replace(/ms\d{4}/g, " ")
    .replace(/[{}«»﴿﴾]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** تجريد المصدر من علامات صيغة OpenITI حتى يبقى النصُّ وحده */
const nassKhalis = (raw) =>
  raw
    .split("\n")
    .filter((l) => !/^# PageV/.test(l) && !/^#META#/.test(l) && !/^######/.test(l))
    .map((l) => l.replace(/^### \|+\s*/, " ").replace(/^# /, " ").replace(/^~~/, " "))
    .join(" ");

/* مصدرُ كل قسمٍ على حدة، مسوّىً مرةً واحدة */
const MASADIR = new Map();
for (const qism of AQSAM) {
  const masar = resolve(ROOT, qism.masdar);
  if (!existsSync(masar)) {
    console.error(`\n  ✘ ${qism.muarrif}: لا يوجد ${qism.masdar}\n`);
    process.exit(1);
  }
  MASADIR.set(qism.muarrif, sawwi(nassKhalis(readFileSync(masar, "utf8"))));
}

/** مصدر القسم الذي ينتمي إليه معرّفُ الوحدة، أو null إن كانت البادئة مجهولة */
const masdarWahda = (muarrif) => {
  const qism = qismWahda(muarrif);
  return qism ? MASADIR.get(qism.muarrif) : null;
};

/* ————— جمع الأخطاء ————— */

const akhta = [];
const khata = (mawdi, bayan) => akhta.push({ mawdi, bayan });

/* ————— ١: حرفية كل نصٍّ منسوب ————— */

/** الحقول التي تُنسب إلى ابن رشد ويجب أن تكون بحروفه */
const HUQUL_NASS = new Set(["nass", "matn", "jawab"]);

let adadIqtibas = 0;

function tafahhas(qima, masar, nassMasdar) {
  if (qima == null) return;

  if (Array.isArray(qima)) {
    qima.forEach((q, i) => tafahhas(q, `${masar}[${i}]`, nassMasdar));
    return;
  }

  if (typeof qima === "object") {
    for (const [miftah, q] of Object.entries(qima)) {
      // صياغةُ المحرِّر وعقدُ شجرة الاستنباط ليست نصَّ كتابٍ فلا تُقابَل به
      if (
        miftah === "uqad" ||
        miftah === "mustalahat" ||
        miftah === "tadrib" ||
        miftah === "sigha"
      )
        continue;
      tafahhas(q, `${masar}.${miftah}`, nassMasdar);
    }
    return;
  }

  if (typeof qima !== "string") return;

  const miftah = masar.split(".").pop().replace(/\[\d+\]$/, "");
  if (!HUQUL_NASS.has(miftah)) return;

  adadIqtibas++;
  if (!nassMasdar.includes(sawwi(qima)))
    khata(masar, `اقتباس غير موجود بحروفه في مصدر القسم:\n      «${qima.slice(0, 120)}…»`);
}

for (const [id, t] of Object.entries(tahlil)) {
  const nassMasdar = masdarWahda(id);
  if (!nassMasdar) {
    khata(id, `بادئة «${badiat(id)}» ليست في سجلّ الأقسام tools/aqsam.mjs`);
    continue;
  }
  tafahhas(t, id, nassMasdar);
}

/* ————— ٢: سلامة البنية ————— */

const bilMuarrif = new Map(nusus.map((n) => [n.id, n]));

for (const [id, t] of Object.entries(tahlil)) {
  const asl = bilMuarrif.get(id);
  if (!asl) {
    khata(id, "معرّف لا يقابله نصٌّ في data/nusus.js");
    continue;
  }

  const aqwal = t.aqwal || [];
  if (!aqwal.length) khata(id, "لا أقوال");

  const muarrifat = new Set(aqwal.map((q) => q.id));
  if (muarrifat.size !== aqwal.length) khata(id, "معرّفات الأقوال متكررة");

  aqwal.forEach((q, i) => {
    if (!q.qailun || !q.qailun.length) khata(`${id}.aqwal[${i}]`, "قولٌ بلا قائل");
    if (!q.adilla || !q.adilla.length) khata(`${id}.aqwal[${i}]`, "قولٌ بلا دليل");
    (q.adilla || []).forEach((d, j) => {
      if (!d.matn) khata(`${id}.aqwal[${i}].adilla[${j}]`, "دليلٌ بلا متن");
      if (!d.naw) khata(`${id}.aqwal[${i}].adilla[${j}]`, "دليلٌ بلا نوع (نقلي/عقلي)");
      const wajh = d.wajh_al_istidlal;
      if (!wajh || (!wajh.nass && !wajh.sharh))
        khata(`${id}.aqwal[${i}].adilla[${j}]`, "دليلٌ بلا وجه استدلال");
    });
  });

  (t.shajarat_al_istinbat || []).forEach((m, i) => {
    if (!muarrifat.has(m.qawl_id))
      khata(`${id}.shajarat_al_istinbat[${i}]`, `qawl_id مجهول: ${m.qawl_id}`);
    if (!m.uqad || m.uqad.length < 2)
      khata(`${id}.shajarat_al_istinbat[${i}]`, "مسارٌ أقل من عقدتين");
  });

  // المباحث التي حكى فيها ابن رشد اتفاقًا لا خلافًا لا سببَ لها،
  // فلا يُطلب السبب إلا حيث تعددت الأقوال
  if (!t.sabab || !t.sabab.nass) {
    if (aqwal.length >= 2) khata(id, "أقوالٌ متعددة بلا سبب اختلاف");
  } else if (!(t.sabab.anwa || []).length) khata(id, "سببٌ بلا تصنيف (anwa)");

  const tadrib = t.tadrib || [];
  if (tadrib.length < 2) khata(id, "أقل من سؤالي تدريب");
  tadrib.forEach((s, i) => {
    if (!s.khiyarat || s.khiyarat.length < 2)
      khata(`${id}.tadrib[${i}]`, "سؤالٌ بأقل من خيارين");
    if (typeof s.sahih !== "number" || !s.khiyarat || !s.khiyarat[s.sahih])
      khata(`${id}.tadrib[${i}]`, "رقم الجواب الصحيح خارج الخيارات");
  });
}

/* ————— ٣: سلامة النصوص المولَّدة ————— */

let fiqarKull = 0;
for (const m of nusus) {
  if (!m.unwan) khata(m.id, "بلا عنوان");
  if (!m.fiqar || !m.fiqar.length) khata(m.id, "بلا فقرات");
  fiqarKull += (m.fiqar || []).length;

  const nassMasdar = masdarWahda(m.id);
  if (!nassMasdar) {
    khata(m.id, `بادئة «${badiat(m.id)}» ليست في سجلّ الأقسام tools/aqsam.mjs`);
    continue;
  }
  for (const f of m.fiqar || [])
    if (!nassMasdar.includes(sawwi(f.matn)))
      khata(m.id, `فقرة مولَّدة لا تطابق مصدر القسم: «${f.matn.slice(0, 80)}…»`);
}

const muarrifatFahras = new Set(
  fahras.flatMap((k) => k.abwab.flatMap((b) => b.masail)),
);
for (const m of nusus)
  if (!muarrifatFahras.has(m.id)) khata(m.id, "غير مذكور في الفهرس");

/* ————— التقرير ————— */

const raqm = (n) => String(n).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[+d]);

console.log("");
if (AQSAM.length > 1)
  for (const qism of AQSAM) {
    const wahdat = nusus.filter((m) => badiat(m.id) === qism.muarrif);
    const muhallala = wahdat.filter((m) => tahlil[m.id]).length;
    console.log(
      `  ${qism.muarrif.padEnd(4)} ${qism.qism.padEnd(18)} ` +
        `${raqm(wahdat.length)} وحدة، محلَّلة منها ${raqm(muhallala)}`,
    );
  }
if (AQSAM.length > 1) console.log("");
console.log("  المسائل والمباحث   : " + raqm(nusus.length));
console.log("  منها محلَّلة        : " + raqm(Object.keys(tahlil).length));
console.log("  الفقرات المولَّدة   : " + raqm(fiqarKull) + " (كلها مطابقة للمصدر)");
console.log("  الاقتباسات المفحوصة: " + raqm(adadIqtibas));
console.log("");

if (akhta.length) {
  console.error(`  ✘ ${raqm(akhta.length)} خطأ:\n`);
  for (const e of akhta) console.error(`    • ${e.mawdi}\n      ${e.bayan}`);
  console.error("");
  process.exit(1);
}

console.log("  ✔ كل اقتباس منسوب إلى ابن رشد موجودٌ بحروفه في المصدر.");
console.log("");
