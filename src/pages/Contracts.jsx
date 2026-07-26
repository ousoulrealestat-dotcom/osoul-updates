import React, { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useCurrency } from "../utils/currency";
import ReceiptPrint from "../components/ReceiptPrint";
import TenantStatementPrint from "../components/TenantStatementPrint";
import ContractPrint from "../components/ContractPrint";
import { api } from "../utils/apiHelper";
import { showToast, showConfirm } from "../utils/notify";
import ContractFormModal from "./contracts/ContractFormModal";
import WhatsAppModal from "../components/WhatsAppModal";
import { generateRentDueTemplate, generateReceiptTemplate, generateContractRenewalTemplate } from "../utils/whatsappHelper";


// دالة مساعدة لتحليل التواريخ كـ "تاريخ محلي بمنتصف الليل تماماً" دون ترحيل للمناطق الزمنية
const parseLocalDate = (dateStr) => {
  if (!dateStr) return new Date();
  const [year, month, day] = String(dateStr).split("T")[0].split("-").map(Number);
  if (isNaN(year) || isNaN(month) || isNaN(day)) return new Date();
  return new Date(year, month - 1, day, 0, 0, 0, 0);
};

export default function Contracts() {
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedContract, setSelectedContract] = useState(null);
  const [newPayment, setNewPayment] = useState({ amount: "", date: new Date().toISOString().split("T")[0], note: "" });
  const [editingPaymentId, setEditingPaymentId] = useState(null);

  const [isEditMode, setIsEditMode] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [data, setData] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState("نشط");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newContract, setNewContract] = useState({});
  const [printingReceipt, setPrintingReceipt] = useState(null);
  const [printingStatement, setPrintingStatement] = useState(null);
  const [printingContract, setPrintingContract] = useState(null);
  const [statementStartDate, setStatementStartDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-01-01`;
  });
  const [statementEndDate, setStatementEndDate] = useState(() => {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${mm}-${dd}`;
  });
  const [noteModal, setNoteModal] = useState({ isOpen: false, contractId: null, text: "" });
  const [whatsappModal, setWhatsappModal] = useState({ isOpen: false, phone: "", message: "", title: "" });

  const { formatCurrency, currencySymbol } = useCurrency(data?.settings);
  const [transferModal, setTransferModal] = useState({ isOpen: false, contract: null, newTenantId: "", newTenantName: "", transferDate: new Date().toISOString().split("T")[0], note: "", quickTenantPhone: "" });
  const [terminateModal, setTerminateModal] = useState({ isOpen: false, contract: null, terminationDate: new Date().toISOString().split("T")[0], penaltyAmount: "", newContractTotal: "", unitStatusAfter: "متاح", reason: "" });

  const openWhatsAppRentDue = (c, tenant, unit, remaining) => {
    const msg = generateRentDueTemplate({
      tenantName: tenant ? tenant.name : "",
      propertyName: unit ? unit.buildingTitle || unit.title : "",
      unitNumber: unit ? unit.title : "",
      contractNumber: c.contractNumber,
      amount: remaining > 0 ? remaining : c.amount,
      dueDate: c.endDate || "مستحق",
      companySettings: data?.settings || {}
    });
    setWhatsappModal({
      isOpen: true,
      phone: tenant?.phone || "",
      message: msg,
      title: `تذكير إيجار - ${tenant ? tenant.name : ""}`
    });
  };

  const openWhatsAppReceipt = (payment, c, tenant) => {
    const msg = generateReceiptTemplate({
      tenantName: tenant ? tenant.name : "",
      receiptId: payment.id || "0000",
      amount: payment.amount,
      date: payment.date,
      reason: payment.note,
      contractNumber: c ? c.contractNumber : "",
      companySettings: data?.settings || {}
    });
    setWhatsappModal({
      isOpen: true,
      phone: tenant?.phone || "",
      message: msg,
      title: `إشعار سند قبض - ${tenant ? tenant.name : ""}`
    });
  };

  const openWhatsAppRenewal = (c, tenant, unit) => {
    const msg = generateContractRenewalTemplate({
      tenantName: tenant ? tenant.name : "",
      propertyName: unit ? unit.title : "",
      unitNumber: unit ? unit.title : "",
      contractNumber: c.contractNumber,
      endDate: c.endDate,
      companySettings: data?.settings || {}
    });
    setWhatsappModal({
      isOpen: true,
      phone: tenant?.phone || "",
      message: msg,
      title: `تذكير تجديد عقد - ${tenant ? tenant.name : ""}`
    });
  };

  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const isAdmin = user && user.role && typeof user.role === 'string' && user.role.trim() === "مدير نظام";

  const loadContracts = () => {
    window.api.getAllData().then(setData);
  };

  const generateNextContractNumber = (existingContracts) => {
    if (!existingContracts || existingContracts.length === 0) return "1001";
    const numbers = existingContracts.map(c => {
      const match = String(c.contractNumber || "").match(/\d+/);
      return match ? parseInt(match[0], 10) : 0;
    });
    const max = Math.max(...numbers);
    return (max + 1).toString();
  };

  const openNewContractModal = () => {
    setIsEditMode(false);
    setNewContract(null);
    setIsModalOpen(true);
  };

  const location = useLocation();
  useEffect(() => { 
    const loadData = () => {
      window.api.getAllData().then(d => {
        setData(d);
        const params = new URLSearchParams(location.search);
        const search = params.get("search");
        const contractId = params.get("contractId");
        const action = params.get("action");
        if (search) setSearchTerm(search);
        if (contractId) {
          const contract = d.contracts?.find(c => c.id === Number(contractId));
          if (contract) {
            setSearchTerm(contract.contractNumber);
            if (action === "pay") {
              setSelectedContract(contract);
              setIsPaymentModalOpen(true);
            }
          }
        }
      });
    };
    loadData();

    const handleSync = () => { loadContracts(); };
    window.addEventListener("database-synced", handleSync);
    return () => { window.removeEventListener("database-synced", handleSync); };
  }, [location.search]);

  const handleAddOrUpdateFromModal = async (modalData) => {
    try {
      let finalTenantId = modalData.tenantId;
      
      // إضافة مستأجر جديد إذا لم يكن موجوداً
      if (!finalTenantId && modalData.tenantName) {
        if (!modalData.quickTenantPhone) {
          return showToast("يرجى إدخال رقم جوال المستأجر الجديد", "warning");
        }
        const createdTenant = await api.addEntity("tenants", { name: modalData.tenantName, phone: modalData.quickTenantPhone });
        if (createdTenant && createdTenant.id) {
          finalTenantId = createdTenant.id;
        } else {
          return showToast("فشل في إضافة المستأجر الجديد", "error");
        }
      }

      if (!modalData.contractNumber || !finalTenantId || !modalData.unitId || !modalData.amount) {
        return showToast("يرجى تعبئة الحقول المطلوبة الأساسية", "warning");
      }
      
      const unit = units.find(u => u.id === Number(modalData.unitId));
      let calculatedPrice = Number(modalData.amount);
      
      if (unit && modalData.amount && modalData.duration) {
        calculatedPrice = Math.round((Number(modalData.amount) / Number(modalData.duration)) * 12);
      }

      const contractData = { 
        ...modalData, 
        tenantId: finalTenantId, 
        unitId: Number(modalData.unitId),
        amount: Number(modalData.amount),
        rentAmount: Number(modalData.rentAmount || modalData.amount),
        waterAmount: Number(modalData.waterAmount || 0),
        adminFees: Number(modalData.adminFees || 0),
        brokerageFees: Number(modalData.brokerageFees || 0)
      };
      
      delete contractData.tenantName;
      delete contractData.recordFirstPayment;
      delete contractData.firstPaymentAmount;
      delete contractData.quickTenantPhone;

      if (isEditMode) {
        if (!isAdmin) {
          const oldContract = contracts.find(c => c.id === editingId);
          await api.addEntity("approvals", {
            actionType: "تعديل",
            contractId: editingId,
            contractNumber: oldContract ? oldContract.contractNumber : "",
            requestedBy: `${user.name || user.username || "موظف"} (${user.role || "صلاحية محدودة"})`,
            requestDate: new Date().toISOString().split("T")[0],
            details: contractData,
            status: "معلق"
          });
          setIsModalOpen(false);
          setIsEditMode(false);
          loadContracts();
          return showToast("تم إرسال طلب التعديل للمدير العام", "info");
        } else {
          await api.updateEntity("contracts", editingId, contractData);
          if (modalData.unitId) await api.updateEntity("units", Number(modalData.unitId), { price: calculatedPrice });
        }
      } else {
        const createdContract = await api.addEntity("contracts", contractData);
        if (modalData.recordFirstPayment && modalData.firstPaymentAmount) {
          await api.addEntity("payments", { 
            contractId: createdContract.id, 
            amount: Number(modalData.firstPaymentAmount), 
            date: new Date().toISOString().split("T")[0], 
            note: "الدفعة الأولى عند إنشاء العقد" 
          });
        }
        await api.updateEntity("units", Number(modalData.unitId), { status: "مؤجر", price: calculatedPrice });
      }
      
      setIsModalOpen(false);
      setIsEditMode(false);
      loadContracts();
      showToast("تم حفظ بيانات العقد بنجاح", "success");
    } catch (err) {
      console.error(err);
      showToast("حدث خطأ أثناء حفظ العقد", "error");
    }
  };

  const handleEdit = (c) => {
    const tenant = data?.tenants?.find(t => t.id === Number(c.tenantId));
    setNewContract({ ...c, tenantName: tenant ? tenant.name : "" });
    setEditingId(c.id);
    setIsEditMode(true);
    setIsModalOpen(true);
  };

  const handleRenewContract = (c) => {
    const tenant = data?.tenants?.find(t => t.id === Number(c.tenantId));
    const nextNum = generateNextContractNumber(data?.contracts || []);
    
    let nextStartDate = new Date().toISOString().split("T")[0];
    if (c.endDate) {
      const oldEnd = new Date(c.endDate);
      if (!isNaN(oldEnd.getTime())) {
        oldEnd.setDate(oldEnd.getDate() + 1);
        nextStartDate = oldEnd.toISOString().split("T")[0];
      }
    }

    setNewContract({
      ...c,
      id: undefined, // حتى يتم إنشاء عقد جديد بدلاً من تعديل القديم
      contractNumber: nextNum,
      ejarNumber: "",
      startDate: nextStartDate,
      endDate: "", // ليقوم المستخدم بتحديده أو حسابه
      status: "نشط",
      tenantName: tenant ? tenant.name : "",
      notes: `[تجديد / تحديث عقد] هذا العقد هو تجديد وتحديث للعقد السابق رقم ${c.contractNumber}.`,
      recordFirstPayment: false,
      firstPaymentAmount: ""
    });
    setIsEditMode(false);
    setIsModalOpen(true);
  };

  const handleRecordPayment = async (e) => {
    e.preventDefault();
    if (!newPayment.amount) return showToast("يرجى إدخال المبلغ", "warning");
    
    if (editingPaymentId) {
      if (!isAdmin && !user?.permissions?.includes("vouchers_manage")) return showToast("عفواً، لا تملك صلاحية تعديل السندات", "warning");
      await api.updateEntity("payments", editingPaymentId, { amount: Number(newPayment.amount), date: newPayment.date, note: newPayment.note });
      setEditingPaymentId(null);
      showToast("تم تعديل السداد بنجاح", "success");
    } else {
      await api.addEntity("payments", { ...newPayment, contractId: selectedContract.id, amount: Number(newPayment.amount) });
      showToast("تم تسجيل السداد بنجاح", "success");
    }
    
    setNewPayment({ amount: "", date: new Date().toISOString().split("T")[0], note: "" });
    loadContracts();
  };

  const handleDeletePayment = async (paymentId) => {
    if (!isAdmin && !user?.permissions?.includes("vouchers_manage")) return showToast("عفواً، لا تملك صلاحية حذف السندات", "warning");
    if (await showConfirm("هل أنت متأكد من حذف هذه الدفعة نهائياً؟", "حذف الدفعة", "danger")) {
      await api.deleteEntity("payments", paymentId);
      loadContracts();
      showToast("تم حذف الدفعة بنجاح", "success");
    }
  };

  const handleUpdateNote = (id, currentNote) => { setNoteModal({ isOpen: true, contractId: id, text: currentNote || "" }); };
  const handleSaveNote = async () => {
    if (noteModal.contractId) {
      await api.updateEntity("contracts", noteModal.contractId, { notes: noteModal.text });
      setNoteModal({ isOpen: false, contractId: null, text: "" });
      loadContracts();
    }
  };

  const handleTransferContract = async (e) => {
    e.preventDefault();
    const { contract, newTenantName, transferDate, note, quickTenantPhone } = transferModal;
    let finalTenantId = transferModal.newTenantId;

    if (!finalTenantId && newTenantName) {
      if (!quickTenantPhone) {
        return showToast("يرجى إدخال رقم جوال المستأجر الجديد", "warning");
      }
      const createdTenant = await api.addEntity("tenants", { name: newTenantName, phone: quickTenantPhone });
      if (createdTenant && createdTenant.id) {
        finalTenantId = createdTenant.id;
      } else {
        return showToast("فشل في إضافة المستأجر الجديد", "error");
      }
    }

    if (!finalTenantId) return showToast("يرجى تحديد المستأجر الجديد", "warning");
    if (Number(finalTenantId) === Number(contract.tenantId)) return showToast("المستأجر المحدد هو نفس المستأجر الحالي", "warning");

    const oldTenant = tenants.find(t => t.id === Number(contract.tenantId));
    const oldTenantName = oldTenant ? oldTenant.name : "غير معروف";
    const newTenant = tenants.find(t => t.id === Number(finalTenantId)) || { name: newTenantName };

    const assignmentNote = `[تنازل عن العقد] تم التنازل عن هذا العقد من المستأجر السابق (${oldTenantName}) إلى المستأجر الحالي (${newTenant.name}) بتاريخ ${transferDate}. ${note ? `تفاصيل: ${note}` : ""}`;
    const updatedNotes = contract.notes ? `${contract.notes}\n\n${assignmentNote}` : assignmentNote;

    if (!isAdmin) {
      await api.addEntity("approvals", {
        actionType: "تنازل",
        contractId: contract.id,
        contractNumber: contract.contractNumber,
        requestedBy: `${user.name || user.username || "موظف"} (${user.role || "صلاحية محدودة"})`,
        requestDate: new Date().toISOString().split("T")[0],
        details: {
          finalTenantId,
          updatedNotes
        },
        status: "معلق"
      });
      setTransferModal({ isOpen: false, contract: null, newTenantId: "", newTenantName: "", transferDate: new Date().toISOString().split("T")[0], note: "", quickTenantPhone: "" });
      loadContracts();
      return showToast("تم إرسال طلب التنازل للمدير العام", "info");
    }

    await api.updateEntity("contracts", contract.id, {
      tenantId: finalTenantId,
      notes: updatedNotes
    });

    setTransferModal({ isOpen: false, contract: null, newTenantId: "", newTenantName: "", transferDate: new Date().toISOString().split("T")[0], note: "", quickTenantPhone: "" });
    loadContracts();
    showToast("تم التنازل عن العقد بنجاح", "success");
  };

  const handleTerminateContract = async (e) => {
    e.preventDefault();
    const { contract, terminationDate, penaltyAmount, newContractTotal, unitStatusAfter, reason } = terminateModal;
    if (!contract) return;

    const penaltyNum = Number(penaltyAmount || 0);
    const updatedTotal = newContractTotal !== "" ? Number(newContractTotal) : Number(contract.amount);

    const termNote = `[إنهاء مبكر / فسخ عقد] تم إنهاء هذا العقد مبكراً وإخلاء الطرف بتاريخ ${terminationDate}. ${reason ? `السبب: ${reason}. ` : ""}${penaltyNum > 0 ? `غرامة/رسوم الإنهاء: ${formatCurrency(penaltyNum)}. ` : ""}${newContractTotal !== "" ? `تم تعديل إجمالي العقد ليصبح ${formatCurrency(updatedTotal)} بعد التسوية.` : ""}`;
    const updatedNotes = contract.notes ? `${contract.notes}\n\n${termNote}` : termNote;

    if (!isAdmin) {
      await api.addEntity("approvals", {
        actionType: "إنهاء",
        contractId: contract.id,
        contractNumber: contract.contractNumber,
        requestedBy: `${user.name || user.username || "موظف"} (${user.role || "صلاحية محدودة"})`,
        requestDate: new Date().toISOString().split("T")[0],
        details: {
          terminationDate,
          updatedTotal,
          updatedNotes,
          unitId: contract.unitId,
          unitStatusAfter
        },
        status: "معلق"
      });
      setTerminateModal({ isOpen: false, contract: null, terminationDate: new Date().toISOString().split("T")[0], penaltyAmount: "", newContractTotal: "", unitStatusAfter: "متاح", reason: "" });
      loadContracts();
      return showToast("تم إرسال طلب الإنهاء للمدير العام", "info");
    }

    await api.updateEntity("contracts", contract.id, {
      status: "منتهي",
      endDate: terminationDate,
      amount: updatedTotal,
      notes: updatedNotes
    });

    if (contract.unitId) {
      await api.updateEntity("units", Number(contract.unitId), { status: unitStatusAfter });
    }

    setTerminateModal({ isOpen: false, contract: null, terminationDate: new Date().toISOString().split("T")[0], penaltyAmount: "", newContractTotal: "", unitStatusAfter: "متاح", reason: "" });
    loadContracts();
    showToast("تم إنهاء العقد مبكراً بنجاح", "success");
  };

  const handleDelete = async (id) => {
    const relatedPayments = (data.payments || []).filter(p => p.contractId === id);
    if (relatedPayments.length > 0) {
      return showToast(`لا يمكن الحذف — يوجد ${relatedPayments.length} دفعات مسجلة على هذا العقد`, "error");
    }

    if (!isAdmin) {
      const contractToDelete = contracts.find(c => c.id === id);
      if (await showConfirm("لا تملك صلاحية الحذف المباشر. هل ترغب في إرسال طلب حذف هذا العقد إلى المدير العام للاعتماد؟", "إرسال طلب الحذف", "primary")) {
        await api.addEntity("approvals", {
          actionType: "حذف",
          contractId: id,
          contractNumber: contractToDelete ? contractToDelete.contractNumber : "",
          requestedBy: `${user.name || user.username || "موظف"} (${user.role || "صلاحية محدودة"})`,
          requestDate: new Date().toISOString().split("T")[0],
          details: { unitId: contractToDelete?.unitId },
          status: "معلق"
        });
        loadContracts();
        showToast("تم إرسال طلب الحذف للمدير العام", "info");
      }
      return;
    }

    if (await showConfirm("هل أنت متأكد من حذف هذا العقد؟", "حذف العقد", "danger")) {
      const contractToDelete = contracts.find(c => c.id === id);
      if (contractToDelete && contractToDelete.unitId) {
        await api.updateEntity("units", Number(contractToDelete.unitId), { status: "متاح" });
      }
      await api.deleteEntity("contracts", id);
      loadContracts();
    }
  };

  const handleApproveRequest = async (a) => {
    try {
      if (a.actionType === "تعديل") {
        await api.updateEntity("contracts", a.contractId, a.details);
        if (a.details.unitId) {
          const unit = units.find(u => u.id === Number(a.details.unitId));
          let calculatedPrice = Number(a.details.amount);
          if (unit && a.details.amount && a.details.duration) {
            calculatedPrice = Math.round((Number(a.details.amount) / Number(a.details.duration)) * 12);
          }
          await api.updateEntity("units", Number(a.details.unitId), { price: calculatedPrice });
        }
      } else if (a.actionType === "تنازل") {
        await api.updateEntity("contracts", a.contractId, {
          tenantId: a.details.finalTenantId,
          notes: a.details.updatedNotes
        });
      } else if (a.actionType === "إنهاء") {
        await api.updateEntity("contracts", a.contractId, {
          status: "منتهي",
          endDate: a.details.terminationDate,
          amount: a.details.updatedTotal,
          notes: a.details.updatedNotes
        });
        if (a.details.unitId) {
          await api.updateEntity("units", Number(a.details.unitId), { status: a.details.unitStatusAfter });
        }
      } else if (a.actionType === "حذف") {
        if (a.details.unitId) {
          await api.updateEntity("units", Number(a.details.unitId), { status: "متاح" });
        }
        await api.deleteEntity("contracts", a.contractId);
      }

      await api.updateEntity("approvals", a.id, { status: "موافق عليه" });
      loadContracts();
      showToast(`تم اعتماد طلب الـ ${a.actionType} بنجاح`, "success");
    } catch (err) {
      console.error(err);
      showToast("حدث خطأ أثناء تطبيق الاعتماد", "error");
    }
  };

  const handleRejectRequest = async (id) => {
    if (await showConfirm("هل أنت متأكد من رفض هذا الطلب؟", "رفض الطلب", "danger")) {
      await api.updateEntity("approvals", id, { status: "مرفوض" });
      loadContracts();
    }
  };

  if (!data) return <div style={{ padding: "20px", textAlign: "center" }}>جاري التحميل...</div>;
  const contracts = data.contracts || [];
  const tenants = data.tenants || [];
  const units = data.units || [];
  const allPayments = data.payments || [];

  const filteredContracts = contracts.filter(c => {
    const params = new URLSearchParams(location.search);
    const urlId = params.get("contractId");
    if (urlId && Number(c.id) !== Number(urlId)) return false;
    
    const today = new Date(); today.setHours(0,0,0,0);
    const isExpired = parseLocalDate(c.endDate) < today || c.status === "منتهي";
    if (viewMode === "نشط" && isExpired) return false;
    if (viewMode === "أرشيف" && !isExpired) return false;
    const tenant = tenants.find(t => t.id === Number(c.tenantId));
    const unit = units.find(u => u.id === Number(c.unitId));
    const searchStr = searchTerm.toLowerCase();
    
    const contractNumber = String(c.contractNumber || "").toLowerCase();
    const ejarNumber = String(c.ejarNumber || "").toLowerCase();
    const tenantName = tenant ? String(tenant.name || "").toLowerCase() : "";
    const unitTitle = unit ? String(unit.title || "").toLowerCase() : "";
    const amountStr = String(c.amount || "");
    
    return (
      contractNumber.includes(searchStr) || 
      ejarNumber.includes(searchStr) ||
      tenantName.includes(searchStr) || 
      unitTitle.includes(searchStr) || 
      amountStr.includes(searchStr)
    );
  });

  const getRemainingContractTime = (endDate) => {
    if (!endDate) return { text: "تاريخ غير محدد", color: "var(--text-muted)" };
    const end = parseLocalDate(endDate);
    const today = new Date();
    today.setHours(0,0,0,0);
    if (end < today) return { text: "منتهي", color: "var(--danger-color)" };
    const diffDays = Math.round((end - today) / (1000 * 60 * 60 * 24)); // حساب دقيق بالأيام خالي من فروقات التوقيت الصيفي DST والـ Timezone
    const m = Math.floor(diffDays / 30);
    const d = diffDays % 30;
    let timeStr = m > 0 ? `${m} شهر ` : "";
    if (d > 0) timeStr += `و ${d} يوم`;
    return { text: `المتبقي: ${timeStr || "اليوم"}`, color: diffDays <= 30 ? "var(--danger-color)" : "var(--text-muted)" };
  };

  const getNextPaymentInfo = (contract, totalPaid) => {
    if (totalPaid >= Number(contract.amount)) return { text: "مكتمل السداد", color: "var(--success-color)", days: 0 };
    const start = parseLocalDate(contract.startDate);
    const end = parseLocalDate(contract.endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return { text: "بيانات دفع غير مكتملة", color: "var(--text-muted)", days: 0 };
    
    let totalInstallments = 1;
    if (contract.paymentTerms === "شهري") totalInstallments = Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24 * 30.44)));
    else if (contract.paymentTerms === "4 دفعات") totalInstallments = 4;
    else if (contract.paymentTerms === "دفعتين") totalInstallments = 2;
    const installmentAmount = Number(contract.amount) / totalInstallments;
    // السماح بتفاوت بسيط (10 ريال) لتجنب تنبيهات التأخير في حال وجود فروقات كسور أو نقص ريال واحد
    const paidInstallmentsCount = Math.floor((totalPaid + 10) / Math.max(1, installmentAmount));
    const monthsPerInstallment = (Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24 * 30.44)))) / totalInstallments;
    const nextDate = new Date(start);
    nextDate.setMonth(nextDate.getMonth() + Math.round(paidInstallmentsCount * monthsPerInstallment));
    
    const today = new Date(); today.setHours(0,0,0,0);
    const diffDays = Math.round((nextDate - today) / (1000 * 60 * 60 * 24)); // حساب دقيق الفروق خالي تماماً من فروق الساعات
    if (diffDays < 0) return { text: `متأخر منذ ${Math.abs(diffDays)} يوم`, color: "var(--danger-color)", days: diffDays };
    return { text: `التحصيل القادم: ${diffDays === 0 ? "اليوم" : `بعد ${diffDays} يوم`}`, color: diffDays <= 15 ? "var(--danger-color)" : "var(--success-color)", isAlert: diffDays <= 15, days: diffDays };
  };

  const pendingApprovals = (data.approvals || []).filter(a => a.status === "معلق");

  return (
    <div className="animate-fade-in">
      {isAdmin && pendingApprovals.length > 0 && (
        <div style={{ backgroundColor: "#fffbeb", border: "1px solid #f59e0b", borderRadius: "12px", padding: "20px", marginBottom: "30px", boxShadow: "var(--shadow-md)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "15px" }}>
            <span style={{ fontSize: "22px" }}>⚠️</span>
            <h2 style={{ margin: 0, fontSize: "18px", color: "#b45309", fontWeight: "800" }}>طلبات معلقة بانتظار اعتماد المدير العام ({pendingApprovals.length})</h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "15px" }}>
            {pendingApprovals.map(a => (
              <div key={a.id} style={{ backgroundColor: "#fff", padding: "15px", borderRadius: "8px", border: "1px solid #fde68a", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                    <span style={{ fontWeight: "800", color: "var(--primary-color)" }}>عقد: {a.contractNumber || "غير محدد"}</span>
                    <span className="badge" style={{ backgroundColor: "#fef3c7", color: "#d97706" }}>طلب {a.actionType}</span>
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "5px" }}>👤 بواسطة: {a.requestedBy}</div>
                  <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "12px" }}>📅 التاريخ: {a.requestDate}</div>
                </div>
                <div style={{ display: "flex", gap: "10px", borderTop: "1px solid #fef3c7", paddingTop: "12px" }}>
                  <button onClick={() => handleApproveRequest(a)} className="btn btn-primary" style={{ flex: 1, backgroundColor: "#10b981", borderColor: "#10b981", padding: "8px" }}>✅ اعتماد وتطبيق</button>
                  <button onClick={() => handleRejectRequest(a.id)} className="btn btn-outline" style={{ padding: "8px 15px", color: "#ef4444", borderColor: "#ef4444" }}>❌ رفض</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "30px" }}>
        <div style={{ display: "flex", gap: "25px", alignItems: "center" }}>
          <h1 style={{ margin: 0, fontSize: "24px", fontWeight: "800" }}>مركز العقود والتحصيل</h1>
          <div style={{ display: "flex", backgroundColor: "#f1f5f9", borderRadius: "10px", padding: "4px" }}>
            <button onClick={() => setViewMode("نشط")} style={{ padding: "8px 20px", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "700", backgroundColor: viewMode === "نشط" ? "#fff" : "transparent", color: viewMode === "نشط" ? "var(--primary-color)" : "#64748b", boxShadow: viewMode === "نشط" ? "var(--shadow-sm)" : "none", transition: "0.2s" }}>النشطة</button>
            <button onClick={() => setViewMode("أرشيف")} style={{ padding: "8px 20px", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "700", backgroundColor: viewMode === "أرشيف" ? "#fff" : "transparent", color: viewMode === "أرشيف" ? "var(--primary-color)" : "#64748b", boxShadow: viewMode === "أرشيف" ? "var(--shadow-sm)" : "none", transition: "0.2s" }}>الأرشيف</button>
          </div>
        </div>
        <div style={{ display: "flex", gap: "12px" }}>
          <input type="text" placeholder="بحث..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="input" style={{ width: "250px" }} />
          <button onClick={openNewContractModal} className="btn btn-primary">+ عقد جديد</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "25px" }}>
        {filteredContracts.map(c => {
          const tenant = tenants.find(t => t.id === Number(c.tenantId));
          const unit = units.find(u => u.id === Number(c.unitId));
          const contractPayments = allPayments.filter(p => p.contractId === c.id);
          const totalPaid = contractPayments.reduce((s, p) => s + Number(p.amount || 0), 0);
          const remaining = Number(c.amount) - totalPaid;
          const payInfo = getNextPaymentInfo(c, totalPaid);
          const timeInfo = getRemainingContractTime(c.endDate);
          const isContractExpiredOrArchived = c.status === "منتهي" || viewMode === "أرشيف";

          return (
            <div key={c.id} className="card card-interactive" style={{ padding: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <span style={{ color: "var(--primary-color)", fontWeight: "800", fontSize: "15px" }}>{c.contractNumber}</span>
                  {c.ejarNumber && <span style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: "600" }}>إيجار: {c.ejarNumber}</span>}
                </div>
                <span className={`badge ${c.status === "نشط" ? "badge-success" : "badge-danger"}`}>{c.status}</span>
              </div>
              
              <div style={{ marginBottom: "15px" }}>
                <div style={{ fontSize: "18px", fontWeight: "800", marginBottom: "4px" }}>{tenant ? tenant.name : "مستأجر غير معروف"}</div>
                <div style={{ fontSize: "13px", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "5px" }}>
                  <span>🏠</span> {unit ? unit.title : "وحدة غير معروفة"}
                </div>
                {(c.idNumber || c.nationality) && (
                  <div style={{ display: "flex", gap: "15px", marginTop: "6px", flexWrap: "wrap" }}>
                    {c.idNumber && (
                      <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: "700", display: "flex", alignItems: "center", gap: "4px" }}>
                        🪹 رقم الهوية: <span style={{ color: "var(--text-color)" }}>{c.idNumber}</span>
                      </span>
                    )}
                    {c.nationality && (
                      <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: "700", display: "flex", alignItems: "center", gap: "4px" }}>
                        🌍 الجنسية: <span style={{ color: "var(--text-color)" }}>{c.nationality}</span>
                      </span>
                    )}
                  </div>
                )}
              </div>

               <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "15px" }}>
                  <div style={{ backgroundColor: "#f8fafc", padding: "10px", borderRadius: "8px" }}>
                    <div style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: "700" }}>الإيجار</div>
                    <div style={{ fontSize: "15px", fontWeight: "800" }}>{formatCurrency(c.rentAmount || c.amount)}</div>
                  </div>
                  <div style={{ backgroundColor: "#f8fafc", padding: "10px", borderRadius: "8px" }}>
                    <div style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: "700" }}>المياه</div>
                    <div style={{ fontSize: "15px", fontWeight: "800" }}>{formatCurrency(c.waterAmount || 0)}</div>
                  </div>
                  <div style={{ backgroundColor: "#f8fafc", padding: "10px", borderRadius: "8px" }}>
                    <div style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: "700" }}>إجمالي العقد</div>
                    <div style={{ fontSize: "15px", fontWeight: "800", color: "var(--primary-color)" }}>{formatCurrency(c.amount)}</div>
                  </div>
                  <div style={{ backgroundColor: "#f8fafc", padding: "10px", borderRadius: "8px" }}>
                    <div style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: "700" }}>التأمين (مؤمن)</div>
                    <div style={{ fontSize: "15px", fontWeight: "800", color: "#64748b" }}>{formatCurrency(c.securityDeposit || 0)}</div>
                  </div>
                  <div style={{ backgroundColor: "#f8fafc", padding: "10px", borderRadius: "8px" }}>
                    <div style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: "700" }}>طريقة الدفع</div>
                    <div style={{ fontSize: "14px", fontWeight: "700" }}>{c.paymentTerms || "غير محدد"}</div>
                  </div>
                  <div style={{ backgroundColor: "#f8fafc", padding: "10px", borderRadius: "8px" }}>
                    <div style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: "700" }}>قناة التحصيل</div>
                    <div style={{ fontSize: "13px", fontWeight: "700", color: c.paymentChannel === "Office" ? "#2563eb" : "#059669" }}>
                      {c.paymentChannel === "Office" ? "🏢 مكتبي" : "🌐 إيجار"}
                    </div>
                  </div>
                  <div style={{ backgroundColor: "#fef2f2", padding: "10px", borderRadius: "8px" }}>
                    <div style={{ fontSize: "11px", color: "#b91c1c", fontWeight: "700" }}>رسوم توثيق عقود</div>
                    <div style={{ fontSize: "14px", fontWeight: "800", color: "#b91c1c" }}>{formatCurrency(c.adminFees || 0)}</div>
                  </div>
                  <div style={{ backgroundColor: "#fdf2f8", padding: "10px", borderRadius: "8px" }}>
                    <div style={{ fontSize: "11px", color: "#be185d", fontWeight: "700" }}>رسوم السعي</div>
                    <div style={{ fontSize: "14px", fontWeight: "800", color: "#be185d" }}>{formatCurrency(c.brokerageFees || 0)}</div>
                  </div>
               </div>

              <div style={{ marginBottom: "20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "6px" }}>
                  <span style={{ color: "var(--success-color)", fontWeight: "700" }}>محصل: {totalPaid.toLocaleString()}</span>
                  <span style={{ color: remaining > 0 ? "var(--danger-color)" : "var(--success-color)", fontWeight: "700" }}>باقي: {remaining.toLocaleString()}</span>
                </div>
                <div style={{ width: "100%", height: "8px", backgroundColor: "#f1f5f9", borderRadius: "10px", overflow: "hidden" }}>
                  <div style={{ width: `${Math.min(100, (totalPaid / c.amount) * 100)}%`, height: "100%", backgroundColor: "var(--success-color)", borderRadius: "10px" }}></div>
                </div>
              </div>

              <div style={{ padding: "12px", backgroundColor: "#f8fafc", borderRadius: "8px", marginBottom: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
                <div style={{ fontSize: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
                  <span>⏳</span> <span style={{ color: timeInfo.color, fontWeight: "700" }}>{timeInfo.text}</span>
                </div>
                <div style={{ fontSize: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
                  <span>🔔</span> <span style={{ color: payInfo.color, fontWeight: "700" }}>{payInfo.text}</span>
                </div>
              </div>

              <div style={{ display: "flex", gap: "10px" }}>
                {isContractExpiredOrArchived ? (
                  <>
                    <button onClick={() => handleRenewContract(c)} className="btn btn-primary" style={{ flex: 1, backgroundColor: "#10b981", borderColor: "#10b981" }} title="تجديد / تحديث العقد بسيريال جديد">✨ تحديث / تجديد العقد</button>
                    <div style={{ display: "flex", gap: "5px" }}>
                      <button onClick={() => openWhatsAppRentDue(c, tenant, unit, remaining)} className="btn btn-outline" style={{ padding: "10px", borderColor: "#10b981", color: "#059669" }} title="إرسال تذكير بالدفعة عبر الواتساب">💬 تذكير</button>
                      <button onClick={() => setPrintingStatement(c)} className="btn btn-outline" style={{ padding: "10px" }} title="كشف حساب المستأجر">📊</button>
                      <button onClick={() => setPrintingContract({ contract: c, tenant, unit })} className="btn btn-outline" style={{ padding: "10px" }} title="طباعة العقد">🖨️</button>
                      <button onClick={() => handleUpdateNote(c.id, c.notes)} className="btn btn-outline" style={{ padding: "10px" }} title="ملاحظات">📝</button>
                      {isAdmin && <button onClick={() => handleDelete(c.id)} className="btn" style={{ padding: "10px", backgroundColor: "#fee2e2", color: "#ef4444" }}>🗑️</button>}
                    </div>
                  </>
                ) : (
                  <>
                    <button onClick={() => { setSelectedContract(c); setIsPaymentModalOpen(true); }} className="btn btn-primary" style={{ flex: 1 }}>💵 تحصيل</button>
                    <button onClick={() => handleEdit(c)} className="btn btn-outline" style={{ flex: 1 }}>تعديل</button>
                    <button onClick={() => setTransferModal({ isOpen: true, contract: c, newTenantId: "", newTenantName: "", transferDate: new Date().toISOString().split("T")[0], note: "", quickTenantPhone: "" })} className="btn btn-outline" style={{ padding: "10px" }} title="تنازل عن العقد">🔄 تنازل</button>
                    <button onClick={() => setTerminateModal({ isOpen: true, contract: c, terminationDate: new Date().toISOString().split("T")[0], penaltyAmount: "", newContractTotal: c.amount, unitStatusAfter: "متاح", reason: "" })} className="btn btn-outline" style={{ padding: "10px", color: "var(--danger-color)", borderColor: "var(--danger-color)" }} title="إنهاء مبكر / فسخ العقد">🛑 إنهاء</button>
                    <div style={{ display: "flex", gap: "5px" }}>
                      <button onClick={() => openWhatsAppRentDue(c, tenant, unit, remaining)} className="btn btn-outline" style={{ padding: "10px", borderColor: "#10b981", color: "#059669" }} title="إرسال تذكير بالدفعة عبر الواتساب">💬</button>
                      <button onClick={() => setPrintingStatement(c)} className="btn btn-outline" style={{ padding: "10px" }} title="كشف حساب المستأجر">📊</button>
                      <button onClick={() => setPrintingContract({ contract: c, tenant, unit })} className="btn btn-outline" style={{ padding: "10px" }} title="طباعة العقد">🖨️</button>
                      <button onClick={() => handleUpdateNote(c.id, c.notes)} className="btn btn-outline" style={{ padding: "10px" }} title="ملاحظات">📝</button>
                      {isAdmin && <button onClick={() => handleDelete(c.id)} className="btn" style={{ padding: "10px", backgroundColor: "#fee2e2", color: "#ef4444" }}>🗑️</button>}
                    </div>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {isPaymentModalOpen && selectedContract && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ width: "450px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h2 style={{ margin: 0, fontSize: "20px" }}>تسجيل دفعة إيجار</h2>
              <button onClick={() => setIsPaymentModalOpen(false)} style={{ background: "none", border: "none", fontSize: "20px", cursor: "pointer", color: "var(--text-muted)" }}>✕</button>
            </div>
            <form onSubmit={handleRecordPayment}>
              <div style={{ marginBottom: "15px" }}>
                <label style={{ display: "block", marginBottom: "8px", fontWeight: "700" }}>المبلغ ({currencySymbol})</label>
                <input type="number" value={newPayment.amount} onChange={e => setNewPayment({...newPayment, amount: e.target.value})} className="input" required />
              </div>
              <div style={{ marginBottom: "15px" }}>
                <label style={{ display: "block", marginBottom: "8px", fontWeight: "700" }}>تاريخ السداد</label>
                <input type="date" value={newPayment.date} onChange={e => setNewPayment({...newPayment, date: e.target.value})} className="input" required />
              </div>
              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", marginBottom: "8px", fontWeight: "700" }}>ملاحظات</label>
                <input type="text" value={newPayment.note} onChange={e => setNewPayment({...newPayment, note: e.target.value})} className="input" placeholder="مثال: دفعة شهر مايو" />
              </div>
              <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                {editingPaymentId && (
                  <button type="button" onClick={() => { setEditingPaymentId(null); setNewPayment({ amount: "", date: new Date().toISOString().split("T")[0], note: "" }); }} className="btn btn-outline">إلغاء التعديل</button>
                )}
                <button type="button" onClick={() => { setIsPaymentModalOpen(false); setEditingPaymentId(null); }} className="btn btn-outline">إغلاق</button>
                <button type="submit" className="btn btn-primary">{editingPaymentId ? "حفظ التعديل" : "تأكيد السداد"}</button>
              </div>
            </form>
            
            <div style={{ marginTop: "30px", borderTop: "1px solid var(--border-color)", paddingTop: "20px" }}>
              <h4 style={{ margin: "0 0 15px", fontSize: "14px", fontWeight: "800" }}>الدفعات السابقة:</h4>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {allPayments.filter(p => p.contractId === selectedContract.id).map((p, i) => (
                  <div key={i} style={{ padding: "12px", backgroundColor: "#f8fafc", borderRadius: "8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontWeight: "800", fontSize: "13px" }}>{formatCurrency(p.amount)}</div>
                      <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>{p.date} - {p.note}</div>
                    </div>
                    <div style={{ display: "flex", gap: "5px" }}>
                      <button onClick={() => openWhatsAppReceipt(p, selectedContract, tenants.find(t => t.id === Number(selectedContract.tenantId)))} className="btn btn-outline" style={{ padding: "6px 10px", fontSize: "11px", borderColor: "#10b981", color: "#059669" }} title="إرسال السند للواتساب">💬 واتساب</button>
                      <button onClick={() => setPrintingReceipt(p)} className="btn btn-outline" style={{ padding: "6px 12px", fontSize: "11px" }}>🖨️ إيصال</button>
                      {(isAdmin || user?.permissions?.includes("vouchers_manage")) && (
                        <>
                          <button onClick={() => { setEditingPaymentId(p.id); setNewPayment({ amount: p.amount, date: p.date || new Date().toISOString().split("T")[0], note: p.note || "" }); }} className="btn btn-outline" style={{ padding: "6px 12px", fontSize: "11px" }}>✏️ تعديل</button>
                          <button onClick={() => handleDeletePayment(p.id)} className="btn btn-danger" style={{ padding: "6px 12px", fontSize: "11px", backgroundColor: "#ef4444", color: "#fff", border: "none", borderRadius: "5px" }}>🗑️ حذف</button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <ContractFormModal 
          isOpen={isModalOpen}
          isEditMode={isEditMode}
          editingId={editingId}
          initialData={newContract}
          tenants={tenants}
          units={units}
          onClose={() => setIsModalOpen(false)}
          onSave={async (contractData) => {
             // Handle the logic originally in handleAddOrUpdate but adapted for the modal's output
             // We can just keep the main handleAddOrUpdate logic but trigger it from here
             await handleAddOrUpdateFromModal(contractData);
          }}
          generateNextNum={() => generateNextContractNumber(data?.contracts || [])}
          api={api}
        />
      )}

      {printingReceipt && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setPrintingReceipt(null) }}>
          <div className="modal-content" style={{ width: "230mm", maxWidth: "95vw", padding: "20px", display: "flex", flexDirection: "column" }}>
            <div className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <div>
                <h2 style={{ margin: 0 }}>معاينة السند / الإيصال</h2>
                <p style={{ margin: "5px 0 0 0", color: "var(--text-muted)", fontSize: "13px" }}>يمكنك الطباعة أو اختيار 'حفظ كـ PDF' من نافذة الطابعة</p>
              </div>
              <div style={{ display: "flex", gap: "10px" }}>
                 <button onClick={() => window.print()} className="btn btn-primary" style={{ padding: "10px 20px" }}>🖨️ طباعة</button>
                 <button onClick={() => setPrintingReceipt(null)} className="btn btn-outline">إغلاق</button>
              </div>
            </div>
            <div style={{ overflow: "auto", maxHeight: "75vh", backgroundColor: "#f8fafc", padding: "20px", borderRadius: "8px", border: "1px solid var(--border-color)" }}>
              <ReceiptPrint 
                receipt={printingReceipt} 
                companySettings={data.settings || {}} 
                tenantName={tenants.find(t => t.id === Number(data.contracts.find(c => c.id === printingReceipt.contractId)?.tenantId))?.name || ""} 
                contractNumber={data.contracts.find(c => c.id === printingReceipt.contractId)?.contractNumber || ""} 
                paymentChannel={data.contracts.find(c => c.id === printingReceipt.contractId)?.paymentChannel}
                isPreview={true} 
              />
            </div>
          </div>
        </div>
      )}

      {printingStatement && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setPrintingStatement(null) }}>
          <div className="modal-content" style={{ width: "230mm", maxWidth: "95vw", padding: "20px", display: "flex", flexDirection: "column" }}>
            <div className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
                <div>
                  <h2 style={{ margin: 0 }}>معاينة كشف حساب المستأجر</h2>
                  <p style={{ margin: "5px 0 0 0", color: "var(--text-muted)", fontSize: "13px" }}>مراجعة دفعات المستأجر والمتبقي عليه قبل الطباعة</p>
                </div>
                <div style={{ display: "flex", gap: "15px", alignItems: "center", backgroundColor: "#f8fafc", padding: "10px 20px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <label style={{ fontSize: "12px", fontWeight: "700" }}>من:</label>
                    <input type="date" value={statementStartDate} onChange={e => setStatementStartDate(e.target.value)} className="input" style={{ width: "140px", padding: "4px 8px" }} />
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <label style={{ fontSize: "12px", fontWeight: "700" }}>إلى:</label>
                    <input type="date" value={statementEndDate} onChange={e => setStatementEndDate(e.target.value)} className="input" style={{ width: "140px", padding: "4px 8px" }} />
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", gap: "10px" }}>
                 <button onClick={() => window.print()} className="btn btn-primary" style={{ padding: "10px 20px" }}>🖨️ طباعة الكشف</button>
                 <button onClick={() => setPrintingStatement(null)} className="btn btn-outline">إغلاق</button>
              </div>
            </div>
            <div style={{ overflow: "auto", maxHeight: "75vh", backgroundColor: "#f8fafc", padding: "20px", borderRadius: "8px", border: "1px solid var(--border-color)" }}>
              <TenantStatementPrint 
                contract={printingStatement}
                tenant={tenants.find(t => t.id === Number(printingStatement.tenantId))}
                payments={allPayments.filter(p => p.contractId === printingStatement.id)}
                companySettings={data.settings || {}}
                dateRange={{ start: statementStartDate, end: statementEndDate }}
                isPreview={true}
              />
            </div>
          </div>
        </div>
      )}

      {noteModal.isOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ width: "400px" }}>
            <h3 style={{ marginTop: 0, marginBottom: "20px" }}>📝 ملاحظات العقد</h3>
            <textarea value={noteModal.text} onChange={e => setNoteModal({...noteModal, text: e.target.value})} className="input" style={{ height: "150px", marginBottom: "20px" }} placeholder="اكتب ملاحظتك هنا..."></textarea>
            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button onClick={() => setNoteModal({ isOpen: false, contractId: null, text: "" })} className="btn btn-outline">إلغاء</button>
              <button onClick={handleSaveNote} className="btn btn-primary">حفظ الملاحظة</button>
            </div>
          </div>
        </div>
      )}

      {transferModal.isOpen && transferModal.contract && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ width: "500px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h2 style={{ margin: 0, fontSize: "20px" }}>🔄 نقل / تنازل عن العقد</h2>
              <button onClick={() => setTransferModal({ isOpen: false, contract: null, newTenantId: "", newTenantName: "", transferDate: new Date().toISOString().split("T")[0], note: "", quickTenantPhone: "" })} style={{ background: "none", border: "none", fontSize: "20px", cursor: "pointer", color: "var(--text-muted)" }}>✕</button>
            </div>
            <p style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "20px" }}>
              سيتم نقل العقد رقم <strong style={{ color: "var(--primary-color)" }}>{transferModal.contract.contractNumber}</strong> إلى المستأجر الجديد للمدة المتبقية، مع توثيق اسم المستأجر السابق وتاريخ التنازل في سجل الملاحظات.
            </p>

            <form onSubmit={handleTransferContract}>
              <div style={{ marginBottom: "15px" }}>
                <label style={{ display: "block", marginBottom: "8px", fontWeight: "700" }}>المستأجر الجديد (المتنازَل له)</label>
                <input type="text" list="transfer-tenant-options" placeholder="اختر أو اكتب اسم المستأجر الجديد..." value={transferModal.newTenantName || ""} onChange={e => {
                  const val = e.target.value;
                  const existing = tenants.find(t => t.name === val);
                  setTransferModal({...transferModal, newTenantName: val, newTenantId: existing ? existing.id : ""});
                }} className="input" required />
                <datalist id="transfer-tenant-options">{tenants.map(t => <option key={t.id} value={t.name} />)}</datalist>
                {!transferModal.newTenantId && transferModal.newTenantName && (
                  <div style={{ marginTop: "10px", padding: "12px", backgroundColor: "#f0f9ff", borderRadius: "8px", border: "1px dashed var(--primary-color)" }}>
                    <div style={{ fontSize: "12px", marginBottom: "6px", fontWeight: "700", color: "var(--primary-color)" }}>✨ مستأجر جديد؟ يرجى إدخال الجوال لإضافته:</div>
                    <input type="text" placeholder="رقم الجوال..." value={transferModal.quickTenantPhone || ""} onChange={e => setTransferModal({...transferModal, quickTenantPhone: e.target.value})} className="input" style={{ padding: "6px" }} />
                  </div>
                )}
              </div>

              <div style={{ marginBottom: "15px" }}>
                <label style={{ display: "block", marginBottom: "8px", fontWeight: "700" }}>تاريخ التنازل / النقل</label>
                <input type="date" value={transferModal.transferDate || ""} onChange={e => setTransferModal({...transferModal, transferDate: e.target.value})} className="input" required />
              </div>

              <div style={{ marginBottom: "25px" }}>
                <label style={{ display: "block", marginBottom: "8px", fontWeight: "700" }}>تفاصيل إضافية (تُضاف للملاحظات)</label>
                <input type="text" value={transferModal.note || ""} onChange={e => setTransferModal({...transferModal, note: e.target.value})} className="input" placeholder="مثال: تم التنازل وقام المستأجر الجديد بسداد المتبقي..." />
              </div>

              <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", borderTop: "1px solid var(--border-color)", paddingTop: "20px" }}>
                <button type="button" onClick={() => setTransferModal({ isOpen: false, contract: null, newTenantId: "", newTenantName: "", transferDate: new Date().toISOString().split("T")[0], note: "", quickTenantPhone: "" })} className="btn btn-outline">إلغاء</button>
                <button type="submit" className="btn btn-primary">تأكيد التنازل</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {terminateModal.isOpen && terminateModal.contract && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ width: "500px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h2 style={{ margin: 0, fontSize: "20px", color: "var(--danger-color)" }}>🛑 إنهاء مبكر / فسخ العقد</h2>
              <button onClick={() => setTerminateModal({ isOpen: false, contract: null, terminationDate: new Date().toISOString().split("T")[0], penaltyAmount: "", newContractTotal: "", unitStatusAfter: "متاح", reason: "" })} style={{ background: "none", border: "none", fontSize: "20px", cursor: "pointer", color: "var(--text-muted)" }}>✕</button>
            </div>
            <p style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "20px" }}>
              سيتم إنهاء العقد رقم <strong style={{ color: "var(--primary-color)" }}>{terminateModal.contract.contractNumber}</strong> وتعديل تاريخ نهايته ليصبح تاريخ الإخلاء الفعلي، مع إتاحة الوحدة العقارية وتوثيق المخالصة.
            </p>

            <form onSubmit={handleTerminateContract}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px", marginBottom: "15px" }}>
                <div>
                  <label style={{ display: "block", marginBottom: "8px", fontWeight: "700" }}>تاريخ الإخلاء / الفسخ</label>
                  <input type="date" value={terminateModal.terminationDate || ""} onChange={e => setTerminateModal({...terminateModal, terminationDate: e.target.value})} className="input" required />
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: "8px", fontWeight: "700" }}>حالة الوحدة بعد الإخلاء</label>
                  <select value={terminateModal.unitStatusAfter || "متاح"} onChange={e => setTerminateModal({...terminateModal, unitStatusAfter: e.target.value})} className="input" required>
                    <option value="متاح">متاح (جاهز للتأجير)</option>
                    <option value="صيانة">صيانة / تنظيف</option>
                  </select>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px", marginBottom: "15px" }}>
                <div>
                  <label style={{ display: "block", marginBottom: "8px", fontWeight: "700" }}>غرامة / شرط جزائي ({currencySymbol})</label>
                  <input type="number" value={terminateModal.penaltyAmount || ""} onChange={e => setTerminateModal({...terminateModal, penaltyAmount: e.target.value})} className="input" placeholder="مثال: 2000 (اختياري)" />
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: "8px", fontWeight: "700" }}>إجمالي العقد بعد التسوية</label>
                  <input type="number" value={terminateModal.newContractTotal || ""} onChange={e => setTerminateModal({...terminateModal, newContractTotal: e.target.value})} className="input" placeholder={`الأصلي: ${terminateModal.contract.amount}`} />
                  <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>اتركه كما هو أو عدله للمبلغ المتفق عليه</span>
                </div>
              </div>

              <div style={{ marginBottom: "25px" }}>
                <label style={{ display: "block", marginBottom: "8px", fontWeight: "700" }}>سبب الفسخ وتفاصيل المخالصة</label>
                <input type="text" value={terminateModal.reason || ""} onChange={e => setTerminateModal({...terminateModal, reason: e.target.value})} className="input" placeholder="مثال: رغبة المستأجر في المغادرة وتمت المخالصة وتثبيت الدفعات..." required />
              </div>

              <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", borderTop: "1px solid var(--border-color)", paddingTop: "20px" }}>
                <button type="button" onClick={() => setTerminateModal({ isOpen: false, contract: null, terminationDate: new Date().toISOString().split("T")[0], penaltyAmount: "", newContractTotal: "", unitStatusAfter: "متاح", reason: "" })} className="btn btn-outline">إلغاء</button>
                <button type="submit" className="btn btn-primary" style={{ backgroundColor: "var(--danger-color)", borderColor: "var(--danger-color)" }}>تأكيد الإنهاء والإخلاء</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {printingContract && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setPrintingContract(null) }}>
          <div className="modal-content" style={{ width: "230mm", maxWidth: "95vw", padding: "20px", display: "flex", flexDirection: "column" }}>
            <div className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <div>
                <h2 style={{ margin: 0 }}>🖨️ معاينة العقد قبل الطباعة</h2>
                <p style={{ margin: "5px 0 0 0", color: "var(--text-muted)", fontSize: "13px" }}>راجع العقد ثم اضغط طباعة أو احفظه كـ PDF</p>
              </div>
              <div style={{ display: "flex", gap: "10px" }}>
                <button onClick={() => window.print()} className="btn btn-primary" style={{ padding: "10px 20px" }}>🖨️ طباعة / حفظ PDF</button>
                <button onClick={() => setPrintingContract(null)} className="btn btn-outline">إغلاق</button>
              </div>
            </div>
            <div style={{ overflow: "auto", maxHeight: "75vh", backgroundColor: "#f8fafc", padding: "20px", borderRadius: "8px", border: "1px solid var(--border-color)" }}>
              <ContractPrint
                contract={printingContract.contract}
                tenant={printingContract.tenant}
                unit={printingContract.unit}
                building={data?.buildings?.find(b => b.id === (printingContract.unit?.buildingId || printingContract.unit?.building_id))}
                companySettings={data?.settings || {}}
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


