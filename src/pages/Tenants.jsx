import React, { useState, useEffect } from "react";
import { api } from "../utils/apiHelper";
import { showToast, showConfirm } from "../utils/notify";
import WhatsAppModal from "../components/WhatsAppModal";

export default function Tenants() {
  const [tenants, setTenants] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [units, setUnits] = useState([]);
  const [buildings, setBuildings] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTenant, setNewTenant] = useState({ name: "", phone: "", unitId: "", documents: [] });
  const [whatsappModal, setWhatsappModal] = useState({ isOpen: false, phone: "", message: "", title: "" });

  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const isAdmin = user && user.role && typeof user.role === 'string' && user.role.trim() === "مدير نظام";

  const loadData = () => { 
    window.api.getAllData().then(d => { 
      setTenants(d.tenants || []); 
      setContracts(d.contracts || []);
      setUnits(d.units || []);
      setBuildings(d.buildings || []);
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
    if (!newTenant.name || !newTenant.phone) { showToast("يرجى تعبئة الحقول المطلوبة", "warning"); return; }
    if (isEditMode) await api.updateEntity("tenants", editingId, newTenant);
    else await api.addEntity("tenants", newTenant);
    setIsModalOpen(false); setIsEditMode(false);
    setNewTenant({ name: "", phone: "", unitId: "", documents: [] });
    loadData();
  };

  const handleEdit = (t) => {
    setNewTenant({ name: t.name, phone: t.phone, unitId: t.unitId || "", documents: t.documents || [] });
    setEditingId(t.id); setIsEditMode(true); setIsModalOpen(true);
  };

  const handleUploadDocument = async () => {
    const fileName = await window.api.uploadDocument();
    if (fileName) {
      setNewTenant({ ...newTenant, documents: [...(newTenant.documents || []), fileName] });
    }
  };
  
  const handleOpenDocument = (fileName) => {
    window.api.openDocument(fileName);
  };

  const handleDelete = async (id) => {
    if (!isAdmin) { showToast("عذراً، لا تملك صلاحية الحذف", "error"); return; }
    const relatedContracts = (contracts || []).filter(c => Number(c.tenantId) === id);
    if (relatedContracts.length > 0) {
      showToast(`لا يمكن حذف هذا المستأجر لوجود ${relatedContracts.length} عقود مسجلة باسمه. يجب حذف العقود أولاً.`, "error"); return;
    }
    if (await showConfirm("هل أنت متأكد من حذف هذا المستأجر؟", "حذف", "danger")) { await api.deleteEntity("tenants", id); loadData(); }
  };

  const filteredTenants = tenants.filter(t => {
    const name = String(t.name || "");
    const phone = String(t.phone || "");
    return name.includes(searchTerm) || phone.includes(searchTerm);
  });

  return (
    <div className="animate-fade-in">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "30px" }}>
        <div>
          <h1 style={{ fontSize: "24px", fontWeight: "800" }}>سجل المستأجرين</h1>
          <p style={{ color: "var(--text-muted)", fontSize: "14px" }}>إدارة وتتبع بيانات المستأجرين وسجل تواصلهم</p>
        </div>
        <div style={{ display: "flex", gap: "12px" }}>
          <input type="text" placeholder="بحث بالاسم أو الجوال..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="input" style={{ width: "250px" }} />
          <button onClick={() => { setIsEditMode(false); setNewTenant({ name: "", phone: "", unitId: "", documents: [] }); setIsModalOpen(true); }} className="btn btn-primary">+ إضافة مستأجر</button>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <table>
          <thead>
            <tr>
              <th>الاسم</th>
              <th>الجوال</th>
              <th>الوحدة المستأجرة حالياً</th>
              <th>تاريخ التسجيل</th>
              <th style={{ textAlign: "center" }}>إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {filteredTenants.map(t => {
              const activeTenantContracts = contracts.filter(c => Number(c.tenantId) === t.id && c.status === "نشط");
              const rentedUnitsDisplay = activeTenantContracts.map(c => {
                const unit = units.find(u => u.id === Number(c.unitId));
                const building = unit ? buildings.find(b => b.id === unit.buildingId) : null;
                return unit ? `${unit.title} ${building ? `(${building.name})` : ""}` : "";
              }).filter(Boolean).join(" ، ");

              return (
                <tr key={t.id}>
                  <td style={{ fontWeight: "700" }}>
                    {t.name}
                    {t.documents && t.documents.length > 0 && <span style={{ marginRight: "8px", fontSize: "13px" }} title={`${t.documents.length} مرفقات`}>📎</span>}
                  </td>
                  <td style={{ color: "var(--text-muted)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span>{t.phone}</span>
                      {t.phone && (
                        <button 
                          onClick={() => setWhatsappModal({
                            isOpen: true,
                            phone: t.phone,
                            message: `السلام عليكم ورحمة الله وبركاته 🌹\nعزيزنا المستأجر: *${t.name}*\n\nتواصل معك مكتب أصول العقاري ✨`,
                            title: `تواصل واتساب - ${t.name}`
                          })}
                          style={{
                            background: "none",
                            border: "1px solid #10b981",
                            color: "#059669",
                            borderRadius: "6px",
                            padding: "2px 8px",
                            fontSize: "12px",
                            fontWeight: "700",
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px"
                          }}
                          title="فتح محادثة واتساب"
                        >
                          💬 واتساب
                        </button>
                      )}
                    </div>
                  </td>
                  <td>
                    {rentedUnitsDisplay ? (
                      <span className="badge badge-success" style={{ fontSize: "12px", whiteSpace: "nowrap" }}>🏠 {rentedUnitsDisplay}</span>
                    ) : (
                      <span style={{ color: "var(--text-muted)", fontSize: "13px" }}>غير مؤجر</span>
                    )}
                  </td>
                  <td style={{ color: "var(--text-muted)", fontSize: "13px" }}>{t.createdAt ? new Date(t.createdAt).toLocaleDateString('ar-SA') : "-"}</td>
                  <td>
                    <div style={{ display: "flex", gap: "8px", justifyContent: "center" }}>
                      {t.phone && (
                        <button 
                          onClick={() => setWhatsappModal({
                            isOpen: true,
                            phone: t.phone,
                            message: `السلام عليكم ورحمة الله وبركاته 🌹\nعزيزنا المستأجر: *${t.name}*\n\nتواصل معك مكتب أصول العقاري ✨`,
                            title: `تواصل واتساب - ${t.name}`
                          })}
                          className="btn btn-outline" 
                          style={{ padding: "4px 10px", fontSize: "12px", borderColor: "#10b981", color: "#059669" }}
                        >
                          💬 مراسلة
                        </button>
                      )}
                      <button onClick={() => handleEdit(t)} className="btn btn-outline" style={{ padding: "4px 10px", fontSize: "12px" }}>تعديل</button>
                      {isAdmin && <button onClick={() => handleDelete(t.id)} className="btn" style={{ backgroundColor: "#fee2e2", color: "#ef4444", padding: "4px 10px", fontSize: "12px" }}>حذف</button>}
                    </div>
                  </td>

                </tr>
              );
            })}
            {filteredTenants.length === 0 && (
              <tr><td colSpan="5" style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>لا يوجد مستأجرين مسجلين</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ width: "400px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h2 style={{ margin: 0, fontSize: "20px" }}>{isEditMode ? "تعديل بيانات المستأجر" : "تسجيل مستأجر جديد"}</h2>
              <button onClick={() => setIsModalOpen(false)} style={{ background: "none", border: "none", fontSize: "20px", cursor: "pointer", color: "var(--text-muted)" }}>✕</button>
            </div>
            <form onSubmit={handleAddOrUpdate}>
              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", marginBottom: "8px", fontWeight: "700" }}>الاسم الكامل</label>
                <input type="text" value={newTenant.name || ""} onChange={e => setNewTenant({...newTenant, name: e.target.value})} className="input" required />
              </div>
              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", marginBottom: "8px", fontWeight: "700" }}>رقم الجوال</label>
                <input type="text" value={newTenant.phone || ""} onChange={e => setNewTenant({...newTenant, phone: e.target.value})} className="input" required />
              </div>
              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", marginBottom: "8px", fontWeight: "700" }}>المرفقات (هوية، وكالة، إلخ)</label>
                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "10px" }}>
                  {(newTenant.documents || []).map((doc, idx) => (
                    <div key={idx} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "6px 12px", backgroundColor: "#f1f5f9", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                      <span style={{ cursor: "pointer", color: "var(--primary-color)", fontWeight: "700", fontSize: "13px" }} onClick={() => handleOpenDocument(doc)}>📄 {doc}</span>
                      <button type="button" onClick={() => {
                        const newDocs = newTenant.documents.filter((_, i) => i !== idx);
                        setNewTenant({ ...newTenant, documents: newDocs });
                      }} style={{ background: "none", border: "none", color: "var(--danger-color)", cursor: "pointer", padding: "0" }}>✕</button>
                    </div>
                  ))}
                </div>
                <button type="button" onClick={handleUploadDocument} className="btn btn-outline" style={{ fontSize: "12px", padding: "6px 12px" }}>+ إضافة مرفق</button>
              </div>
              <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", borderTop: "1px solid var(--border-color)", paddingTop: "20px" }}>
                <button type="button" onClick={() => { setIsModalOpen(false); setIsEditMode(false); }} className="btn btn-outline">إلغاء</button>
                <button type="submit" className="btn btn-primary">{isEditMode ? "تحديث" : "حفظ"}</button>
              </div>
            </form>
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

