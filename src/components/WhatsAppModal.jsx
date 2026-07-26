import React, { useState, useEffect } from "react";
import { openWhatsAppLink, formatPhoneNumber } from "../utils/whatsappHelper";

export default function WhatsAppModal({ isOpen, onClose, defaultPhone, defaultMessage, title }) {
  const [phone, setPhone] = useState(defaultPhone || "");
  const [message, setMessage] = useState(defaultMessage || "");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setPhone(defaultPhone || "");
    setMessage(defaultMessage || "");
    setCopied(false);
  }, [defaultPhone, defaultMessage, isOpen]);

  if (!isOpen) return null;

  const formattedFormattedPhone = formatPhoneNumber(phone);

  const handleSend = () => {
    openWhatsAppLink(phone, message);
    onClose();
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(15, 23, 42, 0.7)",
      backdropFilter: "blur(6px)",
      zIndex: 9999,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "20px",
      direction: "rtl"
    }}>
      <div style={{
        backgroundColor: "#ffffff",
        borderRadius: "16px",
        width: "100%",
        maxWidth: "520px",
        boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
        overflow: "hidden",
        border: "1px solid #e2e8f0",
        animation: "fadeIn 0.2s ease-out"
      }}>
        {/* Header */}
        <div style={{
          background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
          color: "#ffffff",
          padding: "18px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "24px" }}>💬</span>
            <h3 style={{ margin: 0, fontSize: "18px", fontWeight: "800" }}>{title || "إرسال رسالة عبر الواتساب"}</h3>
          </div>
          <button 
            onClick={onClose}
            style={{
              background: "rgba(255, 255, 255, 0.2)",
              border: "none",
              color: "#fff",
              fontSize: "18px",
              width: "32px",
              height: "32px",
              borderRadius: "50%",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: "24px" }}>
          {/* Phone Field */}
          <div style={{ marginBottom: "18px" }}>
            <label style={{ display: "block", fontSize: "14px", fontWeight: "700", color: "#334155", marginBottom: "6px" }}>
              📱 رقم هاتف المستأجر (الواتساب):
            </label>
            <input 
              type="text" 
              value={phone} 
              onChange={(e) => setPhone(e.target.value)}
              placeholder="مثال: 0501234567"
              style={{
                width: "100%",
                padding: "10px 14px",
                borderRadius: "8px",
                border: "1.5px solid #cbd5e1",
                fontSize: "15px",
                direction: "ltr",
                textAlign: "right",
                fontWeight: "600",
                outline: "none"
              }}
            />
            {formattedFormattedPhone && (
              <span style={{ fontSize: "12px", color: "#059669", fontWeight: "700", marginTop: "4px", display: "inline-block" }}>
                ✓ الرقم المعتمد للإرسال: +{formattedFormattedPhone}
              </span>
            )}
          </div>

          {/* Message Field */}
          <div style={{ marginBottom: "18px" }}>
            <label style={{ display: "block", fontSize: "14px", fontWeight: "700", color: "#334155", marginBottom: "6px" }}>
              📝 معاينة وتعديل نص الرسالة:
            </label>
            <textarea 
              rows={8}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: "10px",
                border: "1.5px solid #cbd5e1",
                fontSize: "14px",
                fontFamily: "inherit",
                lineHeight: "1.6",
                backgroundColor: "#f8fafc",
                color: "#1e293b",
                resize: "vertical",
                outline: "none"
              }}
            />
          </div>

          {/* Buttons */}
          <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
            <button 
              type="button" 
              onClick={handleCopy}
              style={{
                padding: "10px 18px",
                borderRadius: "8px",
                border: "1px solid #cbd5e1",
                backgroundColor: "#f1f5f9",
                color: "#334155",
                fontWeight: "700",
                fontSize: "14px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px"
              }}
            >
              {copied ? "✅ تم النسخ!" : "📋 نسخ النص"}
            </button>

            <button 
              type="button" 
              onClick={handleSend}
              style={{
                padding: "10px 24px",
                borderRadius: "8px",
                border: "none",
                background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                color: "#ffffff",
                fontWeight: "800",
                fontSize: "14px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                boxShadow: "0 4px 12px rgba(16, 185, 129, 0.3)"
              }}
            >
              <span>🟢</span>
              <span>إرسال عبر الواتساب</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
