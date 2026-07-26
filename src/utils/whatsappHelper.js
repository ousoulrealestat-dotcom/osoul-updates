/**
 * مساعد أتمتة رسائل الواتساب وتنسيق الأرقام لبرنامج أصول العقاري
 */

/**
 * تنظيف وتنسيق رقم الهاتف ليتناسب مع روابط WhatsApp المباشرة (wa.me)
 * يحول الأرقام مثل 0501234567 إلى 966501234567
 */
export function formatPhoneNumber(phone) {
  if (!phone) return "";
  
  // إزالة كل الحروف والرموز المسافات والزائد
  let cleaned = String(phone).replace(/\D/g, "");
  
  // إذا كان الرقم يبدأ بـ 05 (الرقم المحلي السعودي)
  if (/^05\d{8}$/.test(cleaned)) {
    cleaned = "966" + cleaned.substring(1);
  }
  // إذا كان يبدأ بـ 5 فقط وبطول 9 أرقام
  else if (/^5\d{8}$/.test(cleaned)) {
    cleaned = "966" + cleaned;
  }
  
  return cleaned;
}

/**
 * فتح رابط الواتساب المباشر عبر الإلكترون أو المتصفح
 */
export function openWhatsAppLink(phone, message) {
  const formattedPhone = formatPhoneNumber(phone);
  const encodedText = encodeURIComponent(message || "");
  const url = formattedPhone 
    ? `https://wa.me/${formattedPhone}?text=${encodedText}`
    : `https://api.whatsapp.com/send?text=${encodedText}`;

  if (window.api && typeof window.api.openExternal === "function") {
    window.api.openExternal(url);
  } else {
    window.open(url, "_blank");
  }
}

/**
 * صياغة رسالة تذكير بـ (استحقاق دفعة إيجارية)
 */
export function generateRentDueTemplate({ tenantName, propertyName, unitNumber, contractNumber, amount, dueDate, companySettings }) {
  const companyName = companySettings?.companyName || "أصول العقاري";
  const companyPhone = companySettings?.companyPhone || "";

  return `السلام عليكم ورحمة الله وبركاته 🌹
عزيزنا المستأجر: *${tenantName || "العميل المحترم"}*

نحيطكم علماً بطلب سداد الدفعة الإيجارية المستحقة للعقد رقم: *(${contractNumber || "---"})*
🏢 *العقار:* ${propertyName || "العقار"} - وحدة: ${unitNumber || "---"}
💰 *المبلغ المستحق:* ${Number(amount || 0).toLocaleString()} ريال سعودي
📅 *تاريخ الاستحقاق:* ${dueDate || "اليوم"}

نرجو السداد عبر القنوات المعتمدة. لمزيد من التفاصيل يسعدنا تواصلكم.
شكراً لتعاونكم معنا ✨

--
*${companyName}*
${companyPhone ? `📞 ${companyPhone}` : ""}`;
}

/**
 * صياغة رسالة إشعار (سند قبض إلكتروني)
 */
export function generateReceiptTemplate({ tenantName, receiptId, amount, date, reason, contractNumber, companySettings }) {
  const companyName = companySettings?.companyName || "أصول العقاري";

  return `السلام عليكم ورحمة الله وبركاته 💐
عزيزنا المستأجر: *${tenantName || "العميل المحترم"}*

تم استلام مبلغ إيجاري وتم إصدار *سند قبض إلكتروني* بنجاح ✅

🧾 *رقم السند:* ${receiptId || "---"}
💵 *المبلغ المستلم:* ${Number(amount || 0).toLocaleString()} ريال سعودي
📅 *التاريخ:* ${date || new Date().toLocaleDateString('ar-SA')}
📝 *البيان:* ${reason || `دفعة إيجارية لعقد رقم ${contractNumber || ""}`}

نشكر لكم التزامكم وسدادكم في الموعد المحدد 🌟

--
*${companyName}*`;
}

/**
 * صياغة رسالة تذكير (قرب انتهاء العقد للتجديد)
 */
export function generateContractRenewalTemplate({ tenantName, propertyName, unitNumber, contractNumber, endDate, companySettings }) {
  const companyName = companySettings?.companyName || "أصول العقاري";
  const companyPhone = companySettings?.companyPhone || "";

  return `السلام عليكم ورحمة الله وبركاته 🌷
عزيزنا المستأجر: *${tenantName || "العميل المحترم"}*

نود تذكيركم بقرب انتهاء مدة عقد الإيجار الخاص بكم:
📜 *رقم العقد:* ${contractNumber || "---"}
🏢 *العقار:* ${propertyName || "العقار"} (وحدة ${unitNumber || "---"})
⏳ *تاريخ انتهاء العقد:* ${endDate || "---"}

يرجى التواصل معنا لتأكيد رغبتكم في *تجديد العقد* وتحديث البيانات.
يسعدنا دائماً خدمتكم ✨

--
*${companyName}*
${companyPhone ? `📞 التواصل: ${companyPhone}` : ""}`;
}

/**
 * صياغة رسالة إشعار (تحديث طلب صيانة)
 */
export function generateMaintenanceTemplate({ tenantName, ticketId, title, status, notes, companySettings }) {
  const companyName = companySettings?.companyName || "أصول العقاري";

  const statusText = {
    "قيد الانتظار": "⏳ قيد المراجعة والانتظار",
    "قيد التنفيذ": "🛠️ جاري التنفيذ والعمل عليها",
    "مكتملة": "✅ تم إنجاز طلب الصيانة بنجاح",
    "ملغاة": "❌ تم إلغاء الطلب"
  }[status] || status;

  return `السلام عليكم ورحمة الله وبركاته 🛠️
عزيزنا المستأجر: *${tenantName || "العميل المحترم"}*

تم تحديث حالة طلب الصيانة الخاص بكم:
🔧 *طلب رقم:* ${ticketId || "---"}
📌 *عنوان البلاغ:* ${title || "طلب صيانة"}
📊 *الحالة الجديدة:* *${statusText}*
${notes ? `💬 *ملاحظات الفني:* ${notes}` : ""}

نشكركم على تواصلكم معنا 🌟

--
*${companyName}*`;
}
