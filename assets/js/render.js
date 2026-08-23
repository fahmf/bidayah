/* ==========================================================================
   render.js — بناء الواجهة
   ترتيب المسألة مقصود: الدليلُ أولًا ثم القولُ، لا العكس،
   ليتعوّد الناظر أن ينظر في المأخذ قبل أن ينظر في المذهب.
   ========================================================================== */

/* global window, document, location */

(function (BM) {
  "use strict";

  const elFahras = document.getElementById("fahras");
  const elMatn = document.getElementById("matn");
  const elMarashih = document.getElementById("marashih");

  /* ————— أدوات عرض ————— */

  const SINF_ILA_TARAZ = {
    قرآن: "aya",
    آية: "aya",
    سنة: "hadith",
    حديث: "hadith",
    أثر: "hadith",
    إجماع: "ijma",
    قياس: "aqli",
    استصحاب: "aqli",
    مصلحة: "aqli",
    "دليل الخطاب": "aqli",
    "براءة أصلية": "aqli",
    عقلي: "aqli",
  };

  const tarazDalil = (d) =>
    SINF_ILA_TARAZ[d.sinf] || (d.naw === "عقلي" ? "aqli" : "hadith");

  /** نص ابن رشد: مهرَّب ثم ملوَّن الآيات والأحاديث */
  const nassIbnRushd = (s) => BM.lawwinNusus(BM.himaya(s));

  /* ————— الفهرس ————— */

  function ibniFahras() {
    const maqru = BM.khazina.maqru;
    const adad = BM.masail.length;
    const tamm = BM.masail.filter((m) => maqru[m.id]).length;
    const nisba = adad ? Math.round((tamm / adad) * 100) : 0;

    let html =
      `<div class="taqaddum">` +
      `<div class="taqaddum__satr"><span>ما قرأتَه</span>` +
      `<span>${BM.raqm(tamm)} / ${BM.raqm(adad)}</span></div>` +
      `<div class="taqaddum__shirit"><div class="taqaddum__mumtali" style="width:${nisba}%"></div></div>` +
      `</div>`;

    const hali = BM.masarHali().ajza;
    const idHali = hali[0] === "m" ? hali[1] : null;

    BM.fahras.forEach((kitab) => {
      const abwabLaha = kitab.abwab.filter((b) => b.masail.length);
      if (!abwabLaha.length) return;
      html += `<div class="fahras__kitab">${BM.himaya(kitab.unwan)}</div>`;

      abwabLaha.forEach((bab) => {
        const masail = bab.masail
          .map((id) => BM.bilMuarrif.get(id))
          .filter((m) => m && BM.tajtaz(m));
        if (!masail.length) return;

        html += `<div class="fahras__bab">${BM.himaya(bab.unwan)}</div>`;
        masail.forEach((m) => {
          const asnaf = [
            "fahras__band",
            m.id === idHali ? "fahras__band--nashit" : "",
            maqru[m.id] ? "fahras__band--maqru" : "",
          ]
            .filter(Boolean)
            .join(" ");
          html +=
            `<button class="${asnaf}" data-idhhab="#/m/${m.id}">` +
            `<span class="fahras__raqm">${BM.raqm(m.raqm)}</span>` +
            `<span>${BM.himaya(m.unwan)}</span>` +
            `</button>`;
        });
      });
    });

    elFahras.innerHTML = html;
  }

  BM.hadithFahras = ibniFahras;

  /* ————— المرشِّحات ————— */

  function ibniMarashih() {
    const q = BM.qawaimMurashshih();
    const majmua = (lafz, mafatih, qaima) => {
      if (!qaima.length) return "";
      const azrar = qaima
        .map(
          ([qima, adad]) =>
            `<button class="zir ${
              BM.murashshih[mafatih] === qima ? "zir--nashit" : ""
            }" data-murashshih="${mafatih}" data-qima="${BM.himaya(qima)}">` +
            `${BM.himaya(qima)} <small>${BM.raqm(adad)}</small></button>`,
        )
        .join("");
      return (
        `<div class="marashih__majmua">` +
        `<span class="marashih__lafz">${lafz}</span>${azrar}</div>`
      );
    };

    const lahu = BM.lahuMurashshih();
    elMarashih.innerHTML =
      majmua("صنف الدليل:", "sinf", q.asnaf) +
      majmua("المذهب:", "madhhab", q.madhahib) +
      majmua("سبب الاختلاف:", "naw_sabab", q.anwa) +
      (lahu
        ? `<div class="marashih__majmua"><button class="zir" data-murashshih="مسح">✕ مسح المرشِّحات</button></div>`
        : "") +
      (q.asnaf.length || q.madhahib.length || q.anwa.length
        ? ""
        : `<span class="marashih__lafz">المرشِّحات تعمل على المسائل المحلَّلة</span>`);
  }

  /* ————— أقسام المسألة ————— */

  function qismTahrir(m) {
    const ittifaq = m.mahall_al_ittifaq || [];
    const nizaa = m.mahall_al_nizaa;
    if (!ittifaq.length && !nizaa) return "";

    const bunud = ittifaq
      .map(
        (b) =>
          `<li class="nass-manqul">${nassIbnRushd(b.nass)}` +
          (b.mawdi ? ` <span class="faqra__mawdi">${BM.himaya(b.mawdi)}</span>` : "") +
          `</li>`,
      )
      .join("");

    return (
      `<section class="qism" id="qism-tahrir">` +
      `<h2 class="qism__unwan">تحرير محل النزاع</h2>` +
      (bunud
        ? `<div class="dalil dalil--ijma"><div class="dalil__ras">` +
          `<span class="wasm wasm--sinf">ما وقع عليه الاتفاق</span></div>` +
          `<ul style="margin:0;padding:1rem 2.2rem">${bunud}</ul></div>`
        : "") +
      (nizaa
        ? `<div class="dalil dalil--aqli"><div class="dalil__ras">` +
          `<span class="wasm wasm--sinf">موضع الخلاف</span>` +
          (nizaa.mawdi
            ? `<span class="dalil__takhrij">${BM.himaya(nizaa.mawdi)}</span>`
            : "") +
          `</div><p class="dalil__matn">${nassIbnRushd(nizaa.nass)}</p></div>`
        : "") +
      `</section>`
    );
  }

  /**
   * هل النصّان مؤدّاهما واحد؟
   * إذا صيغت الحجةُ العقلية في `sigha` فقد يكون شرحُ وجه الاستدلال معادًا
   * بلفظٍ قريب، فيُستغنى عنه لئلا يقرأ الطالبُ الشيء مرتين.
   */
  const kalimat = (s) =>
    new Set(
      BM.tanzif(String(s || ""))
        .split(/[^\u0621-\u064A]+/)
        .filter((k) => k.length > 2),
    );

  const mutashabih = (a, b) => {
    const x = kalimat(a);
    const y = kalimat(b);
    if (!x.size || !y.size) return false;
    let mushtarak = 0;
    x.forEach((k) => {
      if (y.has(k)) mushtarak++;
    });
    return mushtarak / Math.min(x.size, y.size) >= 0.72;
  };

  function bitaqatDalil(d, qawl) {
    const taraz = tarazDalil(d);
    const qail = ((qawl && qawl.qailun) || []).map((r) => r.ism).join("، ");

    const wajh = d.wajh_al_istidlal || {};
    const sharh = d.sigha && mutashabih(d.sigha, wajh.sharh) ? "" : wajh.sharh;
    const wajhHtml =
      wajh.nass || sharh
        ? `<div class="dalil__wajh">` +
          `<div class="dalil__wajh-unwan">وجه الاستدلال</div>` +
          (wajh.nass
            ? `<div class="nass-manqul">${nassIbnRushd(wajh.nass)}</div>`
            : "") +
          (sharh ? `<div class="sharh">${nassIbnRushd(sharh)}</div>` : "") +
          `</div>`
        : "";

    const itiradat = (d.itiradat || [])
      .map(
        (i) =>
          `<details class="nass-kamil" style="margin-top:.6rem">` +
          `<summary>اعتراض وجوابه</summary>` +
          `<div class="nass-kamil__jism">` +
          `<div class="nass-manqul"><strong>الاعتراض:</strong> ${nassIbnRushd(i.nass)}</div>` +
          (i.jawab
            ? `<div class="nass-manqul" style="margin-top:.5rem"><strong>الجواب:</strong> ${nassIbnRushd(
                i.jawab,
              )}</div>`
            : "") +
          `</div></details>`,
      )
      .join("");

    return (
      `<article class="dalil dalil--${taraz}">` +
      `<div class="dalil__ras">` +
      `<span class="wasm wasm--sinf">${BM.himaya(d.sinf || d.naw || "دليل")}</span>` +
      (d.naw_al_dalala
        ? `<span class="wasm wasm--dalala">${BM.himaya(d.naw_al_dalala)}</span>`
        : "") +
      (qail
        ? `<span class="wasm wasm--dalala" data-yukhfa>استدلَّ به: ${BM.himaya(qail)}</span>`
        : "") +
      (d.takhrij ? `<span class="dalil__takhrij">${BM.himaya(d.takhrij)}</span>` : "") +
      `</div>` +
      // الأدلة العقلية كثيرًا ما لا يكون لها في الكتاب متنٌ مستقل يُقتبس،
      // وإنما يصف ابن رشد الحجة وصفًا. فإن وُجدت صياغةٌ للمحرِّر عُرضت هي
      // بالخط الكبير — إذ هي المفهومة — وبقي لفظُ ابن رشد تحتها سندًا لها.
      (d.sigha
        ? `<p class="dalil__matn dalil__matn--sigha">${nassIbnRushd(d.sigha)}</p>` +
          `<div class="dalil__lafz"><span class="dalil__lafz-unwan">بلفظ ابن رشد</span>` +
          `<span class="nass-manqul">${nassIbnRushd(d.matn)}</span></div>`
        : `<p class="dalil__matn">${nassIbnRushd(d.matn)}</p>`) +
      wajhHtml +
      (itiradat ? `<div style="padding:0 1.25rem 1rem">${itiradat}</div>` : "") +
      `</article>`
    );
  }

  function qismAdilla(m) {
    const min = [];
    (m.aqwal || []).forEach((q) =>
      (q.adilla || []).forEach((d) => min.push(bitaqatDalil(d, q))),
    );

    // مسألة بلا تحليل: نعرض ما التُقط آليًا من آيات وأحاديث في كلامه
    if (!min.length) {
      const zahira = m.nusus_zahira || [];
      if (!zahira.length) return "";
      zahira.forEach((z) =>
        min.push(
          bitaqatDalil({
            sinf: z.naw === "آية" ? "قرآن" : "سنة",
            matn: z.naw === "آية" ? "﴿" + z.matn + "﴾" : "«" + z.matn + "»",
          }),
        ),
      );
      return (
        `<section class="qism" id="qism-adilla">` +
        `<h2 class="qism__unwan">الأدلة الواردة في المسألة <span class="adad">${BM.raqm(
          min.length,
        )}</span></h2>` +
        `<p class="irshad__nass" style="margin-top:-.5rem;margin-bottom:1rem">` +
        `هذه النصوص التُقطت من كلام ابن رشد في هذه المسألة، ولم تُفرَد بعدُ بتحليل ` +
        `وجه الاستدلال ونسبته إلى القائلين.</p>` +
        min.join("") +
        `</section>`
      );
    }

    return (
      `<section class="qism" id="qism-adilla">` +
      `<h2 class="qism__unwan">الأدلة <span class="adad">${BM.raqm(min.length)}</span></h2>` +
      min.join("") +
      `</section>`
    );
  }

  function qismAqwal(m) {
    const aqwal = m.aqwal || [];
    if (!aqwal.length) return "";

    const bitaqat = aqwal
      .map((q, i) => {
        const qailun = (q.qailun || [])
          .map(
            (r) =>
              `<span class="qail" data-madhhab="${BM.himaya(r.madhhab || "")}">` +
              `${BM.himaya(r.ism)}${
                r.madhhab ? ` <small>(${BM.himaya(r.madhhab)})</small>` : ""
              }</span>`,
          )
          .join("");
        return (
          `<article class="qawl" style="--lawn-qawl:${BM.lawnQawl(q)}">` +
          `<div class="qawl__raqm">القول ${BM.raqm(i + 1)}</div>` +
          `<p class="qawl__nass">${nassIbnRushd(q.nass)}</p>` +
          `<div class="qailun">${qailun}</div>` +
          `</article>`
        );
      })
      .join("");

    const talkhis = m.talkhis_al_aqwal
      ? `<div class="dalil dalil--ijma" style="margin-bottom:1rem">` +
        `<div class="dalil__ras"><span class="wasm wasm--sinf">تلخيص ابن رشد للأقوال</span>` +
        (m.talkhis_al_aqwal.mawdi
          ? `<span class="dalil__takhrij">${BM.himaya(m.talkhis_al_aqwal.mawdi)}</span>`
          : "") +
        `</div><div class="nass-manqul" style="padding:1rem 1.25rem">${nassIbnRushd(
          m.talkhis_al_aqwal.nass,
        )}</div></div>`
      : "";

    return (
      `<section class="qism" id="qism-aqwal" data-yukhfa>` +
      `<h2 class="qism__unwan">الأقوال والقائلون <span class="adad">${BM.raqm(
        aqwal.length,
      )}</span></h2>` +
      talkhis +
      `<div class="aqwal">${bitaqat}</div>` +
      `</section>`
    );
  }

  function qismJadwal(m) {
    const aqwal = m.aqwal || [];
    if (aqwal.length < 2) return "";

    const sufuf = aqwal
      .map((q) => {
        const abraz = (q.adilla || [])[0] || {};
        return (
          `<tr>` +
          `<td class="khaness">${nassIbnRushd(q.nass)}</td>` +
          `<td>${BM.himaya((q.qailun || []).map((r) => r.ism).join("، "))}</td>` +
          `<td class="khaness">${abraz.matn ? nassIbnRushd(abraz.matn) : "—"}</td>` +
          `<td>${BM.himaya(abraz.sinf || "—")}</td>` +
          `<td>${BM.himaya(abraz.naw_al_dalala || "—")}</td>` +
          `</tr>`
        );
      })
      .join("");

    return (
      `<section class="qism" id="qism-jadwal" data-yukhfa>` +
      `<h2 class="qism__unwan">جدول المقارنة</h2>` +
      `<div class="jadwal-lafif"><table class="jadwal">` +
      `<thead><tr><th>القول</th><th>القائلون</th><th>أبرز دليله</th>` +
      `<th>صنف الدليل</th><th>وجه الدلالة</th></tr></thead>` +
      `<tbody>${sufuf}</tbody></table></div>` +
      `</section>`
    );
  }

  function qismSabab(m) {
    const s = m.sabab;
    if (!s) return "";

    const anwa = (s.anwa || [])
      .map(
        (n) =>
          `<button class="naw-chip" data-idhhab="#/naw/${encodeURIComponent(n)}">` +
          `${BM.himaya(n)}</button>`,
      )
      .join("");

    return (
      `<section class="qism" id="qism-sabab" data-yukhfa>` +
      `<h2 class="qism__unwan">سبب الاختلاف</h2>` +
      `<div class="sabab">` +
      `<p class="sabab__nass">${nassIbnRushd(s.nass)}</p>` +
      (s.mawdi
        ? `<div class="masala__mawdi">${BM.himaya(s.mawdi)}</div>`
        : "") +
      (s.sharh ? `<div class="sharh">${nassIbnRushd(s.sharh)}</div>` : "") +
      (anwa
        ? `<div class="anwa"><span class="marashih__lafz">نوع السبب — اضغط لترى نظائره:</span>${anwa}</div>`
        : "") +
      `</div></section>`
    );
  }

  function qismShajara(m) {
    const html = BM.arsimShajara(m);
    if (!html) return "";
    return (
      `<section class="qism" id="qism-shajara" data-yukhfa>` +
      `<h2 class="qism__unwan">شجرة الاستنباط</h2>` +
      `<p class="irshad__nass" style="margin-top:-.5rem;margin-bottom:1rem">` +
      `ترتيبٌ من المحرِّر لمسلك كل فريق: من النص، إلى وجه دلالته، ` +
      `إلى القاعدة الأصولية، إلى الحكم.</p>` +
      html +
      `</section>`
    );
  }

  function qismTarjih(m) {
    if (!m.tarjih) return "";
    return (
      `<section class="qism" id="qism-tarjih" data-yukhfa>` +
      `<h2 class="qism__unwan">الترجيح</h2>` +
      `<div class="dalil dalil--ijma">` +
      `<div class="dalil__ras"><span class="wasm wasm--sinf">${BM.himaya(
        m.tarjih.qail || "ابن رشد",
      )}</span>` +
      (m.tarjih.mawdi
        ? `<span class="dalil__takhrij">${BM.himaya(m.tarjih.mawdi)}</span>`
        : "") +
      `</div>` +
      `<p class="dalil__matn">${nassIbnRushd(m.tarjih.nass)}</p>` +
      `</div></section>`
    );
  }

  function qismNassKamil(m) {
    const fiqar = (m.fiqar || [])
      .map(
        (f) =>
          `<p class="faqra">${nassIbnRushd(f.matn)}` +
          `<span class="faqra__mawdi">${BM.himaya(f.mawdi)}</span></p>`,
      )
      .join("");

    return (
      `<section class="qism" id="qism-nass">` +
      `<h2 class="qism__unwan">نصّ ابن رشد كاملًا</h2>` +
      `<details class="nass-kamil"${BM.wadTadrib ? "" : " open"}>` +
      `<summary>كلامه في هذه المسألة بحروفه — ${BM.himaya(m.mawdi_kamil || m.mawdi)}` +
      `<span></span></summary>` +
      `<div class="nass-kamil__jism">${fiqar}</div>` +
      `</details></section>`
    );
  }

  function qismTadrib(m) {
    const html = BM.arsimTadrib(m);
    if (!html) return "";
    return (
      `<section class="qism" id="qism-tadrib">` +
      `<h2 class="qism__unwan">تدريب</h2>` +
      html +
      `</section>`
    );
  }

  function tanaqqul(m) {
    const i = BM.masail.findIndex((x) => x.id === m.id);
    const sabiq = BM.masail[i - 1];
    const lahiq = BM.masail[i + 1];
    const zir = (x, lafz) =>
      x
        ? `<button class="tanaqqul__zir" data-idhhab="#/m/${x.id}">` +
          `<span class="tanaqqul__lafz">${lafz}</span>` +
          `<span class="tanaqqul__unwan">${BM.himaya(x.unwan)}</span></button>`
        : `<button class="tanaqqul__zir" disabled><span class="tanaqqul__lafz">${lafz}</span>` +
          `<span class="tanaqqul__unwan">—</span></button>`;
    return (
      `<nav class="tanaqqul">${zir(sabiq, "المسألة السابقة")}${zir(
        lahiq,
        "المسألة التالية",
      )}</nav>`
    );
  }

  /* ————— الصفحات ————— */

  function safhaMasala(id) {
    const m = BM.bilMuarrif.get(id);
    if (!m) return safhaKhata();

    BM.sajjilQiraa(m.id);

    const html =
      `<article>` +
      `<header class="masala__ras">` +
      `<div class="masala__satr-alwan">` +
      `<span class="wasm wasm--${m.naw === "مسألة" ? "masala" : "mabhath"}">` +
      `${BM.himaya(m.naw)} ${BM.raqm(m.raqm)}</span>` +
      `<span>${BM.himaya(m.kitab)}</span><span>·</span><span>${BM.himaya(m.bab)}</span>` +
      (m.lahu_tahlil ? "" : `<span class="wasm wasm--mabhath">نصٌّ بلا تحليل بعد</span>`) +
      `</div>` +
      `<h1 class="masala__unwan">${nassIbnRushd(m.unwan)}</h1>` +
      `<div class="masala__mawdi">${BM.himaya(m.mawdi_kamil || m.mawdi)}</div>` +
      `</header>` +
      `<div class="tanbih-tadrib">` +
      `<span aria-hidden="true">✎</span>` +
      `<span>وضع التدريب مفعَّل: أُخفيت الأقوالُ وسببُ الاختلاف والترجيح، ` +
      `فانظر في الأدلة أولًا واستخرج الحكم بنفسك، ثم اكشف الجواب.</span></div>` +
      qismTahrir(m) +
      qismAdilla(m) +
      qismAqwal(m) +
      qismJadwal(m) +
      qismSabab(m) +
      qismShajara(m) +
      qismTarjih(m) +
      qismNassKamil(m) +
      qismTadrib(m) +
      tanaqqul(m) +
      `</article>`;

    elMatn.innerHTML = html;
    BM.arbitTadrib(m, elMatn);
    document.title = `${m.unwan} — بداية المجتهد`;
  }

  function safhaUla() {
    const adad = BM.masail.length;
    const muhallala = BM.masail.filter((m) => m.lahu_tahlil).length;
    const asbab = new Set();
    BM.masail.forEach((m) => (m.sabab ? (m.sabab.anwa || []).forEach((n) => asbab.add(n)) : null));
    const adilla = BM.masail.reduce(
      (a, m) => a + (m.aqwal || []).reduce((s, q) => s + (q.adilla || []).length, 0),
      0,
    );

    const ihsaiya = (r, l) =>
      `<div class="ihsaiya"><div class="ihsaiya__raqm">${BM.raqm(r)}</div>` +
      `<div class="ihsaiya__lafz">${l}</div></div>`;

    const irshad = (u, n) =>
      `<div class="irshad__band"><div class="irshad__unwan">${u}</div>` +
      `<div class="irshad__nass">${n}</div></div>`;

    elMatn.innerHTML =
      `<div class="bidaya">` +
      `<h1 class="bidaya__unwan">بداية المجتهد ونهاية المقتصد</h1>` +
      `<p class="bidaya__fari">` +
      `كتابُ الخلاف الذي لم يُقصد به حفظُ الأقوال، بل معرفةُ مآخذها. ` +
      `وهذا العرض مبنيٌّ على ذلك: يُقدَّم الدليل على القول، ويُبرز سببُ الاختلاف، ` +
      `ويُكشف مسلكُ كل فريق من النص إلى الحكم — ليُبنى بذلك ملكةُ النظر لا حفظُ المسائل.` +
      `</p>` +
      `<div class="ihsaiyat">` +
      ihsaiya(adad, "مسألة ومبحث") +
      ihsaiya(muhallala, "مسألة محلَّلة") +
      ihsaiya(adilla, "دليلًا مفصَّلًا") +
      ihsaiya(asbab.size, "نوعًا من أسباب الاختلاف") +
      `</div>` +
      `<div class="irshad">` +
      irshad(
        "ابدأ بالدليل",
        "في كل مسألة تُعرض الأدلةُ أولًا بخطٍّ كبير: الآيةُ بلون، والحديثُ بلون، " +
          "والدليلُ العقلي (القياس والاستصحاب) بلون ثالث، مع وجه الاستدلال.",
      ) +
      irshad(
        "ثم انظر في سبب الاختلاف",
        "هو مقصود ابن رشد الأول. وقد صُنِّف كل سبب بنوعه، فإذا ضغطت على نوعه " +
          "رأيتَ نظائره في سائر المسائل — وبهذا تنكشف لك قوانين الخلاف المتكررة.",
      ) +
      irshad(
        "ثم درِّب نفسك",
        "شغِّل «وضع التدريب» فتُخفى الأقوالُ والأسبابُ والترجيح، ولا يبقى إلا " +
          "الدليل، فتستنبط الحكم بنفسك ثم تكشف الجواب.",
      ) +
      `</div>` +
      `<div class="tanaqqul" style="margin-top:2.5rem">` +
      `<button class="tanaqqul__zir" data-idhhab="#/m/${BM.masail[0] ? BM.masail[0].id : ""}">` +
      `<span class="tanaqqul__lafz">ابدأ من أول الكتاب</span>` +
      `<span class="tanaqqul__unwan">${BM.himaya(
        BM.masail[0] ? BM.masail[0].unwan : "",
      )}</span></button></div>` +
      `</div>`;

    document.title = "بداية المجتهد — الأدلة وطرق الاستنباط";
  }

  function safhaBahth(talab) {
    const nataij = BM.ibhath(talab).filter(BM.tajtaz);
    elMatn.innerHTML =
      `<h1 class="masala__unwan" style="margin-bottom:1rem">نتائج البحث عن «${BM.himaya(
        talab,
      )}»</h1>` +
      `<p class="masala__mawdi" style="margin-bottom:1.5rem">${BM.raqm(
        nataij.length,
      )} من ${BM.raqm(BM.masail.length)} مسألة</p>` +
      (nataij.length
        ? `<div class="nataij">` +
          nataij
            .map(
              (m) =>
                `<button class="natija-band" data-idhhab="#/m/${m.id}">` +
                `<div class="natija-band__unwan">${BM.himaya(m.unwan)}</div>` +
                `<div class="natija-band__mawdi">${BM.himaya(m.kitab)} · ${BM.himaya(
                  m.bab,
                )} · ${BM.himaya(m.mawdi_kamil || m.mawdi)}</div>` +
                `<div class="nass-manqul" style="font-size:1.05rem;margin-top:.5rem">${BM.muqtataf(
                  m,
                  talab,
                )}</div>` +
                `</button>`,
            )
            .join("") +
          `</div>`
        : `<p class="irshad__nass">لم نعثر على شيء. جرّب كلمة أقصر أو بلا حركات.</p>`);
    document.title = `بحث: ${talab} — بداية المجتهد`;
  }

  function safhaNaw(naw) {
    const nataij = BM.masailBiNaw(naw);
    elMatn.innerHTML =
      `<h1 class="masala__unwan" style="margin-bottom:.5rem">نظائر سبب الاختلاف</h1>` +
      `<p class="bidaya__fari" style="margin:0 0 1.5rem;text-align:start">` +
      `المسائل التي دار خلافُها على: <strong>${BM.himaya(naw)}</strong>. ` +
      `والنظر في النظائر هو الذي يُولِّد الملكة: فإن الخلاف في الفروع يرجع إلى ` +
      `أصولٍ قليلةٍ متكررة.</p>` +
      (nataij.length
        ? `<div class="nataij">` +
          nataij
            .map(
              (m) =>
                `<button class="natija-band" data-idhhab="#/m/${m.id}">` +
                `<div class="natija-band__unwan">${BM.himaya(m.unwan)}</div>` +
                `<div class="natija-band__mawdi">${BM.himaya(m.kitab)} · ${BM.himaya(
                  m.mawdi_kamil || m.mawdi,
                )}</div>` +
                `<div class="nass-manqul" style="font-size:1.05rem;margin-top:.5rem">${nassIbnRushd(
                  m.sabab.nass.slice(0, 240),
                )}…</div></button>`,
            )
            .join("") +
          `</div>`
        : `<p class="irshad__nass">لا نظائر مسجَّلة بعد لهذا النوع.</p>`);
    document.title = `${naw} — بداية المجتهد`;
  }

  function safhaKhata() {
    elMatn.innerHTML =
      `<h1 class="masala__unwan">لم نجد هذه الصفحة</h1>` +
      `<p class="irshad__nass"><a href="#/">العودة إلى الصفحة الأولى</a></p>`;
  }

  /* ————— المُوجِّه ————— */

  BM.arsim = function () {
    const { ajza, bahth } = BM.masarHali();

    if (!ajza.length) safhaUla();
    else if (ajza[0] === "m" && ajza[1]) safhaMasala(ajza[1]);
    else if (ajza[0] === "bahth") safhaBahth(bahth.get("q") || "");
    else if (ajza[0] === "naw" && ajza[1]) safhaNaw(ajza.slice(1).join("/"));
    else safhaKhata();

    ibniFahras();
    ibniMarashih();
  };

  /* ————— الأحداث ————— */

  // التنقل بالضغط على أي عنصر يحمل data-idhhab
  document.addEventListener("click", (e) => {
    const hadaf = e.target.closest("[data-idhhab]");
    if (hadaf) {
      BM.idhhab(hadaf.dataset.idhhab);
      ighliqFahras();
      return;
    }

    const mur = e.target.closest("[data-murashshih]");
    if (mur) {
      const miftah = mur.dataset.murashshih;
      if (miftah === "مسح") {
        BM.murashshih = { sinf: null, madhhab: null, naw_sabab: null };
      } else {
        const qima = mur.dataset.qima;
        BM.murashshih[miftah] = BM.murashshih[miftah] === qima ? null : qima;
      }
      BM.arsim();
    }
  });

  const zirFahras = document.getElementById("zir-fahras");
  const hijab = document.getElementById("hijab");

  function iftahFahras() {
    elFahras.classList.add("fahras--maftuh");
    hijab.classList.add("hijab--zahir");
    zirFahras.setAttribute("aria-expanded", "true");
  }
  function ighliqFahras() {
    elFahras.classList.remove("fahras--maftuh");
    hijab.classList.remove("hijab--zahir");
    zirFahras.setAttribute("aria-expanded", "false");
  }

  zirFahras.addEventListener("click", () =>
    elFahras.classList.contains("fahras--maftuh") ? ighliqFahras() : iftahFahras(),
  );
  hijab.addEventListener("click", ighliqFahras);

  document.getElementById("zir-sima").addEventListener("click", BM.qallibSima);
  document.getElementById("zir-hajm").addEventListener("click", BM.qallibHajm);
  document.getElementById("zir-tadrib").addEventListener("click", BM.qallibTadrib);

  document.getElementById("zir-marashih").addEventListener("click", (e) => {
    const maftuh = elMarashih.classList.toggle("marashih--maftuh");
    e.currentTarget.setAttribute("aria-expanded", String(maftuh));
    e.currentTarget.classList.toggle("zir--nashit", maftuh);
  });

  const haql = document.getElementById("haql-bahth");
  let muhlat = null;
  haql.addEventListener("input", () => {
    clearTimeout(muhlat);
    muhlat = setTimeout(() => {
      const q = haql.value.trim();
      if (q.length >= 2) BM.idhhab("#/bahth?q=" + encodeURIComponent(q));
      else if (location.hash.startsWith("#/bahth")) BM.idhhab("#/");
    }, 220);
  });

  // اختصارات: / للبحث، j و k للتنقل بين المسائل
  document.addEventListener("keydown", (e) => {
    if (e.target.matches("input, textarea")) {
      if (e.key === "Escape") e.target.blur();
      return;
    }
    if (e.key === "/") {
      e.preventDefault();
      haql.focus();
      return;
    }
    if (e.key !== "j" && e.key !== "k") return;
    const ajza = BM.masarHali().ajza;
    if (ajza[0] !== "m") return;
    const i = BM.masail.findIndex((x) => x.id === ajza[1]);
    const tali = BM.masail[e.key === "j" ? i + 1 : i - 1];
    if (tali) BM.idhhab("#/m/" + tali.id);
  });

  /* ————— الانطلاق ————— */

  BM.arsim();
})(window.BM);
