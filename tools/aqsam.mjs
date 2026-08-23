/*
 * aqsam.mjs — سجلّ أقسام الكتاب المُدرَجة في الموقع.
 *
 * هذا هو الموضع الوحيد الذي يُعرَّف فيه القسم. فإذا أُريد ضمُّ كتابٍ جديد
 * («كتاب الصلاة» مثلًا) فلا يُحرَّر ingest.mjs ولا verify.mjs، بل يُضاف
 * مدخلٌ هنا ثم تُشغَّل الأدوات الثلاث بالترتيب:
 *
 *   node tools/istikhraj.mjs <الملف الكامل من OpenITI>   # يقتطع نصَّ القسم
 *   node tools/ingest.mjs                                 # يولّد data/nusus.js
 *   node tools/verify.mjs                                 # يفحص الحرفية والبنية
 *
 * حقول المدخل:
 *   muarrif  بادئة معرّفات الوحدات (th-001…). يجب أن تكون فريدة، وألا تتغير
 *            بعد كتابة التحليل، إذ عليها تقوم مفاتيح data/tahlil.js.
 *   qism     اسم القسم كما يُذكر في التوثيق.
 *   masdar   ملفّ النصّ المقتطَع، داخل masdar/.
 *   bidaya   عنوانُ أول ترويسة «### | [...]» في القسم، بلفظه في ملف OpenITI.
 *   nihaya   عنوانُ الترويسة التي يقف الاقتطاع عندها (لا تدخل في القسم).
 *            اتركه فارغًا إن كان القسم يمتدّ إلى آخر الملف.
 */

export const AQSAM = [
  {
    muarrif: "th",
    qism: "كتاب الطهارة",
    masdar: "masdar/bidayah-thaharah.txt",
    bidaya: "كتاب الطهارة من الحدث",
    nihaya: "كتاب الصلاة",
  },
];

/* بيانات النسخة المعتمَدة — واحدةٌ لجميع الأقسام */
export const MASDAR = {
  kitab: "بداية المجتهد ونهاية المقتصد",
  muallif: "أبو الوليد محمد بن أحمد بن رشد القرطبي الحفيد (ت ٥٩٥هـ)",
  tabaa: "دار الحديث — القاهرة، ١٤٢٥هـ/٢٠٠٤م",
  masdar_raqami: "المكتبة الشاملة رقم ٢١٧٣٩ عبر مدونة OpenITI المفتوحة",
  rabit:
    "https://raw.githubusercontent.com/OpenITI/0600AH/master/data/" +
    "0595IbnRushdHafid/0595IbnRushdHafid.BidayatMujtahid/" +
    "0595IbnRushdHafid.BidayatMujtahid.Shamela0021739-ara1",
};

/* ————— أدوات السجلّ ————— */

/** بادئة المعرّف: th-016 ← th */
export const badiat = (muarrifWahda) => String(muarrifWahda).split("-")[0];

/** القسم الذي ينتمي إليه معرّفُ وحدةٍ ما، أو undefined إن كانت البادئة مجهولة */
export const qismWahda = (muarrifWahda) =>
  AQSAM.find((q) => q.muarrif === badiat(muarrifWahda));

/** معرّف الوحدة رقم n في قسمٍ ما: th-001 */
export const muarrifWahda = (qism, raqm) =>
  `${qism.muarrif}-${String(raqm).padStart(3, "0")}`;

/**
 * فحص السجلّ نفسِه قبل استعماله: بادئةٌ مكررة أو ناقصةٌ تُفسد ربطَ التحليل
 * بالنصّ فسادًا صامتًا، فيُوقَف العمل عليها هنا لا بعد حين.
 */
export function tahaqqaqMinSijill() {
  const akhta = [];
  const badiat_ = new Set();
  const masadir = new Set();

  AQSAM.forEach((q, i) => {
    for (const haql of ["muarrif", "qism", "masdar", "bidaya"])
      if (!q[haql]) akhta.push(`AQSAM[${i}]: حقل «${haql}» فارغ`);

    if (q.muarrif && !/^[a-z]{2,6}$/.test(q.muarrif))
      akhta.push(`AQSAM[${i}]: البادئة «${q.muarrif}» — تُكتب حروفًا لاتينية صغيرة (٢–٦)`);

    if (badiat_.has(q.muarrif)) akhta.push(`بادئة مكررة: «${q.muarrif}»`);
    badiat_.add(q.muarrif);

    if (masadir.has(q.masdar)) akhta.push(`ملفّ مصدر مكرر: «${q.masdar}»`);
    masadir.add(q.masdar);
  });

  if (akhta.length) {
    console.error("\n  ✘ خلل في tools/aqsam.mjs:\n");
    for (const e of akhta) console.error("    • " + e);
    console.error("");
    process.exit(1);
  }
}
