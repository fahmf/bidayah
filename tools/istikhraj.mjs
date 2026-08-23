/*
 * istikhraj.mjs — اقتطاع نصّ قسمٍ من ملفّ OpenITI الكامل إلى masdar/.
 *
 * هذه كانت أخطرَ خطوةٍ يدويةٍ في العمل: خطأُ سطرٍ واحدٍ في حدّ القسم يُسقط
 * مسألةً بتمامها أو يُدخل فيها ما ليس منها، ولا يكشفه المدقّق لأن النصّ
 * المقتطَع يبقى مطابقًا لنفسه. فصارت آليةً محكومةً بعناوين ابن رشد نفسِها.
 *
 * التشغيل:
 *   node tools/istikhraj.mjs <ملف OpenITI الكامل> [بادئة القسم]
 *
 * ويُنزَّل الملف الكامل من الرابط المذكور في tools/aqsam.mjs.
 * فإن أُغفلت البادئةُ اقتُطعت أقسامُ السجلّ كلُّها.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { AQSAM, tahaqqaqMinSijill } from "./aqsam.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

tahaqqaqMinSijill();

/* ————— قراءة المعطيات ————— */

const [masarKamil, badia] = process.argv.slice(2);

if (!masarKamil) {
  console.error(
    "\n  الاستعمال: node tools/istikhraj.mjs <ملف OpenITI الكامل> [بادئة القسم]\n",
  );
  process.exit(1);
}
if (!existsSync(masarKamil)) {
  console.error(`\n  ✘ لا يوجد ملف: ${masarKamil}\n`);
  process.exit(1);
}

const matlub = badia ? AQSAM.filter((q) => q.muarrif === badia) : AQSAM;
if (!matlub.length) {
  console.error(`\n  ✘ لا قسم في السجلّ ببادئة «${badia}»\n`);
  process.exit(1);
}

/* ————— التحليل ————— */

const lines = readFileSync(masarKamil, "utf8").split("\n");

/** نصُّ الترويسة مجرَّدًا من علاماتها: «### | [كتاب الصلاة] » ← «كتاب الصلاة» */
const nassUnwan = (line) => {
  const m = line.match(/^### \|+\s*(.+?)\s*$/);
  if (!m) return null;
  return m[1]
    .replace(/ms\d{4}/g, " ")
    .replace(/^\[|\]$/g, "")
    .replace(/\s*[:.]\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();
};

/** فهرس سطر الترويسة التي نصُّها كذا */
const satrUnwan = (unwan) => lines.findIndex((l) => nassUnwan(l) === unwan);

/** نهاية ترويسة #META# — كل ما قبلها إسنادُ النسخة، ويُنقل مع كل قسم */
const nihayatTurra = lines.findIndex((l) => l.startsWith("#META#Header#End#"));
if (nihayatTurra < 0) {
  console.error("\n  ✘ الملف ليس بصيغة OpenITI: لا سطر #META#Header#End#\n");
  process.exit(1);
}
const turra = lines.slice(0, nihayatTurra + 1);

/**
 * علامةُ الصفحة في OpenITI توضع في *آخر* الصفحة، فصفحةُ أول فقرةٍ في القسم
 * تُحسب من آخر علامةٍ سبقته. فلو بدأ الاقتطاع عند الترويسة تمامًا لضاع
 * المرجع وبدأ الترقيم من الصفحة الأولى خطأً — فنضمّ آخر علامةٍ قبلها.
 */
const akhirSafhaQabl = (satr) => {
  for (let i = satr - 1; i > nihayatTurra; i--)
    if (/^# PageV\d+P\d+/.test(lines[i])) return i;
  return -1;
};

/* ————— الاقتطاع ————— */

let khalal = 0;

for (const qism of matlub) {
  const bidaya = satrUnwan(qism.bidaya);
  if (bidaya < 0) {
    console.error(`  ✘ ${qism.muarrif}: لا ترويسة نصُّها «${qism.bidaya}»`);
    khalal++;
    continue;
  }

  let nihaya = lines.length;
  if (qism.nihaya) {
    nihaya = satrUnwan(qism.nihaya);
    if (nihaya < 0) {
      console.error(`  ✘ ${qism.muarrif}: لا ترويسة نصُّها «${qism.nihaya}»`);
      khalal++;
      continue;
    }
    if (nihaya <= bidaya) {
      console.error(
        `  ✘ ${qism.muarrif}: «${qism.nihaya}» يسبق «${qism.bidaya}» في الملف`,
      );
      khalal++;
      continue;
    }
  }

  const marja = akhirSafhaQabl(bidaya);
  const jism = lines.slice(bidaya, nihaya);
  // سطرٌ خالٍ بعد الترويسة، على عادة صيغة OpenITI في الفصل بين الإسناد والمتن
  const khuruj = [...turra, "", ...(marja > 0 ? [lines[marja]] : []), ...jism].join("\n");

  const masar = resolve(ROOT, qism.masdar);
  writeFileSync(masar, khuruj.endsWith("\n") ? khuruj : khuruj + "\n", "utf8");

  const safahat = jism.filter((l) => /^# PageV/.test(l)).length;
  const anawin = jism.filter((l) => nassUnwan(l)).length;
  console.log(
    `  ✔ ${qism.muarrif.padEnd(4)} ${qism.qism.padEnd(18)} ` +
      `أسطر ${bidaya + 1}–${nihaya} | ${anawin} ترويسة | ${safahat} صفحة | ` +
      `${(Buffer.byteLength(khuruj) / 1024).toFixed(0)} ك.ب → ${qism.masdar}`,
  );
}

console.log("");
if (khalal) {
  console.error(
    "  راجع حقلَي bidaya وnihaya في tools/aqsam.mjs: يجب أن يطابقا نصَّ\n" +
      "  الترويسة في ملفّ OpenITI بعد تجريدها من الأقواس المعقوفة.\n",
  );
  process.exit(1);
}
console.log("  ثم: node tools/ingest.mjs && node tools/verify.mjs\n");
