"use client";

import React from "react";
import { X, Loader2 } from "lucide-react";

export interface SemseContextPanelProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  statusTag?: {
    label: string;
    bg: string;
    border: string;
    color: string;
  };
  tabs: Array<{ id: string; label: string }>;
  activeTab: string;
  onTabChange: (tabId: string) => void;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  isLoading?: boolean;
}

export function SemseContextPanel({
  isOpen,
  onClose,
  title,
  subtitle,
  statusTag,
  tabs,
  activeTab,
  onTabChange,
  actions,
  children,
  isLoading = false,
}: SemseContextPanelProps) {
  if (!isOpen) return null;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        border: "1px solid var(--border)",
        borderRadius: "16px",
        background: "linear-gradient(180deg, rgba(15,23,42,0.96) 0%, rgba(8,12,24,0.98) 100%)",
        boxShadow: "0 10px 30px -10px rgba(0, 0, 0, 0.7)",
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "16px 20px",
          borderBottom: "1px solid var(--border)",
          background: "rgba(30,41,59,0.15)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "12px",
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginBottom: "4px" }}>
            <span style={{ fontSize: "11px", letterSpacing: "0.1em", textTransform: "uppercase", color: "#7dd3fc", fontWeight: 700 }}>
              Detalle del Trace
            </span>
            {statusTag && (
              <span
                style={{
                  padding: "2px 8px",
                  borderRadius: "999px",
                  fontSize: "10px",
                  fontWeight: 700,
                  background: statusTag.bg,
                  border: `1px solid ${statusTag.border}`,
                  color: statusTag.color,
                  textTransform: "uppercase",
                }}
              >
                {statusTag.label}
              </span>
            )}
          </div>
          <h3
            style={{
              fontSize: "16px",
              fontWeight: 800,
              color: "var(--ink)",
              margin: 0,
              wordBreak: "break-all",
              fontFamily: "monospace",
            }}
          >
            {title}
          </h3>
          {subtitle && (
            <p style={{ fontSize: "12px", color: "var(--muted)", margin: "4px 0 0 0" }}>
              {subtitle}
            </p>
          )}
        </div>

        <button
          onClick={onClose}
          aria-label="Cerrar panel"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: "8px",
            width: "32px",
            height: "32px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            color: "var(--muted)",
            transition: "all 0.2s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(255,255,255,0.08)";
            e.currentTarget.style.color = "var(--ink)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "rgba(255,255,255,0.04)";
            e.currentTarget.style.color = "var(--muted)";
          }}
        >
          <X size={16} />
        </button>
      </div>

      {/* Tabs list navigation */}
      <div
        style={{
          display: "flex",
          borderBottom: "1px solid var(--border)",
          background: "rgba(15,23,42,0.4)",
          overflowX: "auto",
          scrollbarWidth: "none",
        }}
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              style={{
                padding: "12px 16px",
                fontSize: "12px",
                fontWeight: isActive ? 700 : 500,
                color: isActive ? "#38bdf8" : "var(--muted)",
                background: isActive ? "rgba(56,189,248,0.05)" : "transparent",
                border: "none",
                borderBottom: isActive ? "2px solid #38bdf8" : "2px solid transparent",
                cursor: "pointer",
                whiteSpace: "nowrap",
                transition: "all 0.2s ease",
                flex: 1,
                textAlign: "center",
              }}
              onMouseEnter={(e) => {
                if (!isActive) e.currentTarget.style.color = "var(--ink)";
              }}
              onMouseLeave={(e) => {
                if (!isActive) e.currentTarget.style.color = "var(--muted)";
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Contents area */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "20px",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
        }}
      >
        {isLoading ? (
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "12px",
              color: "var(--muted)",
              minHeight: "200px",
            }}
          >
            <Loader2 className="animate-spin" size={24} style={{ color: "#38bdf8" }} />
            <span style={{ fontSize: "13px" }}>Cargando datos...</span>
          </div>
        ) : (
          children
        )}
      </div>

      {/* Actions footer if provided */}
      {actions && (
        <div
          style={{
            padding: "16px 20px",
            borderTop: "1px solid var(--border)",
            background: "rgba(15,23,42,0.8)",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
          }}
        >
          {actions}
        </div>
      )}
    </div>
  );
}
