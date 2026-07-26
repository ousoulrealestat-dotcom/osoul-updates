import React, { useState, useEffect } from "react";
import { useCurrency } from "../utils/currency";
import { api } from "../utils/apiHelper";
import PaymentPrint from "../components/PaymentPrint";
import { showToast, showConfirm } from "../utils/notify";
import WhatsAppModal from "../components/WhatsAppModal";
import { generateMaintenanceTemplate } from "../utils/whatsappHelper";

export default function Maintenance() {
  const [tasks, setTasks] = useState([]);
  const [units, setUnits] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTask, setNewTask] = useState({ unitId: "", unit: "", task: "", status: "قيد التنفيذ", cost: 0, date: new Date().toISOString().split("T")[0], invoice: "", category: "أخرى" });
  const [printingTask, setPrintingTask] = useState(null);
  const [settings, setSettings] = useState({});
  const [whatsappModal, setWhatsappModal] = useState({ isOpen: false, phone: "", message: "", title: "" });
  const { formatCurrency, currencySymbol } = useCurrency(settings);
  // فلاتر البحث
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");

  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const isAdmin = user && user.role && typeof user.role === 'string' && user.role.trim() === "مدير نظام";

  const loadData = () => { window.api.getAllData().then(d => { 
    setTasks(d.maintenance || []); 
    setUnits(d.units || []); 
    setContracts(d.contracts || []);
    setTenants(d.tenants || []);
    setSettings(d.settings || {});
  }); };

  const handleOpenWhatsApp = (taskItem) => {
    // العثور على المستأجر المرتبط بالوحدة
    const contract = contracts.find(c => Number(c.unitId) === Number(taskItem.unitId) && c.status === "نشط");
    const tenant = contract ? tenants.find(t => t.id === Number(contract.tenantId)) : null;

    const msg = generateMaintenanceTemplate({
      tenantName: tenant ? tenant.name : "",
      ticketId: taskItem.id || "---",
      title: taskItem.task,
      status: taskItem.status,
      notes: taskItem.category ? `تصنيف البلاغ: ${taskItem.category}` : "",
      companySettings: settings
    });

    setWhatsappModal({
      isOpen: true,
      phone: tenant?.phone || "",
      message: msg,
      title: `تحديث بلاغ الصيانة - ${tenant ? tenant.name : taskItem.unit}`
    });
  };

  useEffect(() => {
    loadData();
    const handleSync = () => { loadData(); };
    window.addEventListener("database-synced", handleSync);
    return () => { window.removeEventListener("database-synced", handleSync); };
  }, []);

  const handleAddOrUpdate = async (e) => {
    e.preventDefault();
    if (!newTask.unitId || !newTask.task) { showToast("يرجى اختيار الوحدة وتعبئة الوصف", "warning"); return; }
    const unit = units.find(u => u.id === Number(newTask.unitId));
    const dataToSave = { ...newTask, unit: unit ? unit.title : newTask.unit };
    if (isEditMode) await api.updateEntity("maintenance", editingId, dataToSave);
    else await api.addEntity("maintenance", dataToSave);
    setIsModalOpen(false); setIsEditMode(false);
    setNewTask({ unitId: "", unit: "", task: "", status: "قيد التنفيذ", cost: 0, date: new Date().toISOString().split("T")[0], invoice: "", category: "أخرى" });
    loadData();
  };

  const handleEdit = (t) => {
    setNewTask({ unitId: t.unitId || "", unit: t.unit, task: t.task, status: t.status, cost: t.cost, date: t.date || new Date().toISOString().split("T")[0], invoice: t.invoice || "", category: t.category || "أخرى" });
    setEditingId(t.id); setIsEditMode(true); setIsModalOpen(true);
  };

  const handleUploadInvoice = async () => {
    const fileName = await window.api.uploadDocument();
    if (fileName) { setNewTask({ ...newTask, invoice: fileName }); showToast("تم إرفاق فاتورة الصيانة بنجاح", "success"); }
  };

  const handleDelete = async (id) => {
    if (!isAdmin) { showToast("عذراً، لا تملك صلاحية الحذف", "error"); return; }
    if (await showConfirm("هل أنت متأكد من حذف هذا الطلب؟", "حذف", "danger")) { await api.deleteEntity("maintenance", id); loadData(); }
  };

  const handleUpdateStatus = async (id, currentStatus) => {
    const newStatus = currentStatus === "مكتمل" ? "قيد التنفيذ" : "مكتمل";
    await api.updateEntity("maintenance", id, { status: newStatus });
    loadData();
  };

  // تطبيق الفلاتر
  const filteredTasks = tasks.filter(t => {
    const term = searchTerm.trim().toLowerCase();
    const matchSearch = !term || (t.unit || "").toLowerCase().includes(term) || (t.task || "").toLowerCase().includes(term) || (t.category || "").toLowerCase().includes(term);
    const matchStatus = filterStatus === "all" || t.status === filterStatus;
    const matchCategory = filterCategory === "all" || (t.category || "أخرى") === filterCategory;
    const tDate = (t.date || "").split("T")[0];
    const matchDateFrom = !filterDateFrom || tDate >= filterDateFrom;
    const matchDateTo = !filterDateTo || tDate <= filterDateTo;
    return matchSearch && matchStatus && matchCategory && matchDateFrom && matchDateTo;
  });
  const filteredTotalCost = filteredTasks.reduce((s, t) => s + Number(t.cost || 0), 0);
  const pendingCount = filteredTasks.filter(t => t.status !== "مكتمل").length;
  const completedCount = filteredTasks.filter(t => t.status === "مكتمل").length;

  return (
    <div className="animate-fade-in">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "30px" }}>
        <div>
          <h1 style={{ fontSize: "24px", fontWeight: "800" }}>إدارة الصيانة والمصروفات</h1>
          <p style={{ color: "var(--text-muted)", fontSize: "14px" }}>تتبع جميع مهام الصيانة وسندات الصرف الخاصة بالوحدات</p>
        </div>
        <button onClick={() => { setIsEditMode(false); setNewTask({ unitId: "", unit: "", task: "", status: "قيد التنفيذ", cost: 0, date: new Date().toISOString().split("T")[0], invoice: "", category: "أخرى" }); setIsModalOpen(true); }} className="btn btn-primary">+ طلب صيانة جديد</button>
      </div>

      {/* شريط الفلاتر */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", alignItems: "center", marginBottom: "20px", backgroundColor: "#f8fafc", padding: "16px", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
        <input
          type="text" placeholder="🔍 بحث بالوحدة أو المهمة..."
          value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
          className="input" style={{ width: "200px" }}
        />
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="input" style={{ width: "150px" }}>
          <option value="all">كل الحالات</option>
          <option value="قيد التنفيذ">قيد التنفيذ</option>
          <option value="مكتمل">مكتمل</option>
        </select>
        <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="input" style={{ width: "150px" }}>
          <option value="all">كل التصنيفات</option>
          <option value="سباكة">سباكة</option>
          <option value="كهرباء">كهرباء</option>
          <option value="تكييف">تكييف</option>
          <option value="نظافة">نظافة</option>
          <option value="دهانات">دهانات</option>
          <option value="نجارة">نجارة</option>
          <option value="أعمال إنشائية">أعمال إنشائية</option>
          <option value="رسوم حكومية">رسوم حكومية</option>
          <option value="أخرى">أخرى</option>
        </select>
        <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} className="input" style={{ width: "150px" }} title="من تاريخ" />
        <input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} className="input" style={{ width: "150px" }} title="إلى تاريخ" />
        {(searchTerm || filterStatus !== "all" || filterCategory !== "all" || filterDateFrom || filterDateTo) && (
          <button onClick={() => { setSearchTerm(""); setFilterStatus("all"); setFilterCategory("all"); setFilterDateFrom(""); setFilterDateTo(""); }}
            style={{ background: "none", border: "none", color: "var(--danger-color)", fontSize: "13px", fontWeight: "700", cursor: "pointer" }}>✕ مسح الفلاتر</button>
        )}
        <div style={{ marginRight: "auto", display: "flex", gap: "20px", fontSize: "13px", fontWeight: "700" }}>
          <span style={{ color: "#f59e0b" }}>⏳ قيد التنفيذ: {pendingCount}</span>
          <span style={{ color: "#10b981" }}>✅ مكتمل: {completedCount}</span>
          <span style={{ color: "var(--danger-color)" }}>💰 الإجمالي: {formatCurrency(filteredTotalCost)}</span>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <table>
          <thead>
            <tr>
              <th>الوحدة</th>
              <th>التصنيف</th>
              <th>نوع المهمة</th>
              <th>الحالة</th>
              <th>التكلفة</th>
              <th style={{ textAlign: "center" }}>إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {filteredTasks.map(t => (
              <tr key={t.id}>
                <td>
                  <div style={{ fontWeight: "800" }}>{t.unit}</div>
                  <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>📅 {t.date || "-"}</div>
                </td>
                <td style={{ fontSize: "13px", fontWeight: "700", color: "var(--primary-color)" }}>{t.category || "أخرى"}</td>
                <td style={{ fontSize: "14px" }}>{t.task}</td>
                <td>
                  <span className={`badge ${t.status === "مكتمل" ? "badge-success" : "badge-warning"}`}>{t.status}</span>
                </td>
                <td style={{ fontWeight: "800", color: "var(--danger-color)" }}>{formatCurrency(t.cost)}</td>
                <td>
                  <div style={{ display: "flex", gap: "8px", justifyContent: "center" }}>
                    <button onClick={() => handleOpenWhatsApp(t)} className="btn btn-outline" style={{ padding: "4px 10px", fontSize: "12px", borderColor: "#10b981", color: "#059669" }} title="إرسال تحديث البلاغ للمستأجر عبر الواتساب">💬 واتساب</button>
                    <button onClick={() => handleUpdateStatus(t.id, t.status)} className="btn btn-outline" style={{ padding: "4px 10px", fontSize: "12px", border: t.status === "مكتمل" ? "1px solid #ef4444" : "1px solid #10b981", color: t.status === "مكتمل" ? "#ef4444" : "#10b981" }}>
                      {t.status === "مكتمل" ? "إعادة فتح" : "إكمال"}
                    </button>
                    <button onClick={() => handleEdit(t)} className="btn btn-outline" style={{ padding: "4px 10px", fontSize: "12px" }}>تعديل</button>
                    <button onClick={() => setPrintingTask(t)} className="btn btn-outline" style={{ padding: "4px 10px", fontSize: "12px" }}>🖨️ طباعة</button>

                    {t.invoice && (
                      <button onClick={() => window.api.openDocument(t.invoice)} className="btn" style={{ backgroundColor: "#f1f5f9", color: "#64748b", padding: "4px 10px", fontSize: "12px" }}>🧾 فاتورة</button>
                    )}
                    {isAdmin && <button onClick={() => handleDelete(t.id)} className="btn" style={{ backgroundColor: "#fee2e2", color: "#ef4444", padding: "4px 10px", fontSize: "12px" }}>حذف</button>}
                  </div>
                </td>
              </tr>
            ))}
            {filteredTasks.length === 0 && (
              <tr><td colSpan="6" style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>{tasks.length === 0 ? "لا توجد طلبات صيانة حالياً" : "لا توجد نتائج مطابقة للفلتر"}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ width: "450px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h2 style={{ margin: 0, fontSize: "20px" }}>{isEditMode ? "تعديل سند الصرف" : "إصدار سند صرف جديد"}</h2>
              <button onClick={() => setIsModalOpen(false)} style={{ background: "none", border: "none", fontSize: "20px", cursor: "pointer", color: "var(--text-muted)" }}>✕</button>
            </div>
            <form onSubmit={handleAddOrUpdate}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px", marginBottom: "20px" }}>
                <div>
                  <label style={{ display: "block", marginBottom: "8px", fontWeight: "700" }}>اختر الوحدة</label>
                  <select value={newTask.unitId} onChange={e => setNewTask({...newTask, unitId: e.target.value})} className="input" required>
                    <option value="">اختر الوحدة...</option>
                    {units.map(u => <option key={u.id} value={u.id}>{u.title}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: "8px", fontWeight: "700" }}>تاريخ الصرف</label>
                  <input type="date" value={newTask.date} onChange={e => setNewTask({...newTask, date: e.target.value})} className="input" required />
                </div>
              </div>

              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", marginBottom: "8px", fontWeight: "700" }}>وصف المهمة</label>
                <input type="text" value={newTask.task} onChange={e => setNewTask({...newTask, task: e.target.value})} className="input" placeholder="مثال: إصلاح تكييف الصالة" required />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px", marginBottom: "20px" }}>
                <div>
                  <label style={{ display: "block", marginBottom: "8px", fontWeight: "700" }}>تصنيف المصروف</label>
                  <select value={newTask.category} onChange={e => setNewTask({...newTask, category: e.target.value})} className="input">
                    <option value="سباكة">سباكة</option>
                    <option value="كهرباء">كهرباء</option>
                    <option value="تكييف">تكييف</option>
                    <option value="نظافة">نظافة</option>
                    <option value="دهانات">دهانات</option>
                    <option value="نجارة">نجارة</option>
                    <option value="أعمال إنشائية">أعمال إنشائية</option>
                    <option value="رسوم حكومية">رسوم حكومية</option>
                    <option value="أخرى">أخرى</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: "8px", fontWeight: "700" }}>القيمة ({currencySymbol})</label>
                  <input type="number" value={newTask.cost} onChange={e => setNewTask({...newTask, cost: e.target.value})} className="input" required />
                </div>
              </div>

              <div style={{ marginBottom: "30px" }}>
                <label style={{ display: "block", marginBottom: "8px", fontWeight: "700" }}>فاتورة الصيانة</label>
                <button type="button" onClick={handleUploadInvoice} className="btn btn-outline" style={{ width: "100%" }}>
                  {newTask.invoice ? "✅ تم الإرفاق" : "📎 إرفاق فاتورة"}
                </button>
              </div>

              <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end", borderTop: "1px solid var(--border-color)", paddingTop: "20px" }}>
                <button type="button" onClick={() => { setIsModalOpen(false); setIsEditMode(false); }} className="btn btn-outline">إلغاء</button>
                <button type="submit" className="btn btn-primary">{isEditMode ? "تحديث السند" : "اعتماد الصرف"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {printingTask && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setPrintingTask(null) }}>
          <div className="modal-content" style={{ width: "230mm", maxWidth: "95vw", padding: "20px", display: "flex", flexDirection: "column" }}>
            <div className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <div>
                <h2 style={{ margin: 0 }}>معاينة سند الصرف</h2>
                <p style={{ margin: "5px 0 0 0", color: "var(--text-muted)", fontSize: "13px" }}>مراجعة سند صرف الصيانة قبل الطباعة</p>
              </div>
              <div style={{ display: "flex", gap: "10px" }}>
                 <button onClick={() => window.print()} className="btn btn-primary" style={{ padding: "10px 20px" }}>🖨️ طباعة السند</button>
                 <button onClick={() => setPrintingTask(null)} className="btn btn-outline">إغلاق</button>
              </div>
            </div>
            <div style={{ overflow: "auto", maxHeight: "75vh", backgroundColor: "#f8fafc", padding: "20px", borderRadius: "8px", border: "1px solid var(--border-color)" }}>
              <PaymentPrint 
                task={printingTask} 
                companySettings={settings} 
                isPreview={true} 
              />
            </div>
          </div>
        </div>
      )}

      <WhatsAppModal 
        isOpen={whatsappModal.isOpen}
        onClose={() => setWhatsappModal({ ...whatsappModal, isOpen: false })}
        defaultPhone={whatsappModal.phone}
        defaultMessage={whatsappModal.message}
        title={whatsappModal.title}
      />
    </div>
  );
}

