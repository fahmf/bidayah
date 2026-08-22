/*
 * verify.mjs — التحقق من سلامة البيانات وحرفية الاقتباس.
 *
 * أهم ما يفعله: يتأكد أن كل نصٍّ نُسِب إلى ابن رشد في data/tahlil.js
 * موجودٌ بحروفه في المصدر masdar/bidayah-thaharah.txt. فإن اختلف حرفٌ
 * واحد سقط البناء، فليست دعوى الحرفية وعدًا بل شرطًا يفحصه الحاسوب.
 *
 * التشغيل: node tools/verify.mjs
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/* ————— تحميل البيانات ————— */

const win = {};
const tahmil = (masar) => {
  const src = readFileSync(resolve(ROOT, masar), "utf8");
  new Function("window", src)(win);
};

tahmil("data/nusus.js");
tahmil("data/tahlil.js");

const { nusus, fahras, tahlil } = win.BIDAYAH;
const MASDAR = readFileSync(resolve(ROOT, "masdar/bidayah-thaharah.txt"), "utf8");

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

const MASDAR_MUSAWWA = sawwi(nassKhalis(MASDAR));

/* ————— جمع الأخطاء ————— */

const akhta = [];
const khata = (mawdi, bayan) => akhta.push({ mawdi, bayan });

/* ————— ١: حرفية كل نصٍّ منسوب ————— */

/** الحقول التي تُنسب إلى ابن رشد ويجب أن تكون بحروفه */
const HUQUL_NASS = new Set(["nass", "matn", "jawab"]);

let adadIqtibas = 0;

function tafahhas(qima, masar) {
  if (qima == null) return;

  if (Array.isArray(qima)) {
    qima.forEach((q, i) => tafahhas(q, `${masar}[${i}]`));
    return;
  }

  if (typeof qima === "object") {
    for (const [miftah, q] of Object.entries(qima)) {
      // العقد في شجرة الاستنباط صياغةُ محرِّرٍ لا نصُّ كتاب
      if (miftah === "uqad" || miftah === "mustalahat" || miftah === "tadrib") continue;
      tafahhas(q, `${masar}.${miftah}`);
    }
    return;
  }

  if (typeof qima !== "string") return;

  const miftah = masar.split(".").pop().replace(/\[\d+\]$/, "");
  if (!HUQUL_NASS.has(miftah)) return;

  adadIqtibas++;
  if (!MASDAR_MUSAWWA.includes(sawwi(qima)))
    khata(masar, `اقتباس غير موجود بحروفه في المصدر:\n      «${qima.slice(0, 120)}…»`);
}

for (const [id, t] of Object.entries(tahlil)) tafahhas(t, id);

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
  for (const f of m.fiqar || [])
    if (!MASDAR_MUSAWWA.includes(sawwi(f.matn)))
      khata(m.id, `فقرة مولَّدة لا تطابق المصدر: «${f.matn.slice(0, 80)}…»`);
}

const muarrifatFahras = new Set(
  fahras.flatMap((k) => k.abwab.flatMap((b) => b.masail)),
);
for (const m of nusus)
  if (!muarrifatFahras.has(m.id)) khata(m.id, "غير مذكور في الفهرس");

/* ————— التقرير ————— */

const raqm = (n) => String(n).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[+d]);

console.log("");
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
