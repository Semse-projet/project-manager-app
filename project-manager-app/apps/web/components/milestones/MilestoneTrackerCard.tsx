"use client";

/**
 * MilestoneTrackerCard — Evidence + Approval + Payment Readiness
 *
 * Constitution principle: "Evidence before dispute. Milestones are the
 * unit of control. The user must see what's approved, what's blocked,
 * what requires evidence."
 *
 * Supports all 4 milestone actions: submit, approve, reject, request-changes.
 */

import { useState } from "react";
import {
  CheckCircle, XCircle, Clock, Camera, FileText, AlertTriangle,
  ChevronDown, ChevronUp, DollarSign, Eye, MessageSquare,
} from "lucide-react";

type EvidenceStatus = "missing" | "submitted" | "approved" | "rejected";
type ApprovalStatus = "pending" | "approved" | "changes_requested" | "rejected" | "disputed";
type PaymentReadiness = "not_ready" | "ready_to_release" | "released" | "held";
type MilestoneStatus = "DRAFT" | "AWAITING_REVIEW" | "SUBMITTED" | "APPROVED" | "REJECTED" | "PAID";

type EvidenceItem = {
  id:          string;
  label:       string;
  description?: string;
  kind:        "PHOTO" | "VIDEO" | "DOCUMENT";
  phase:       "before" | "during" | "after";
  required:    boolean;
  status:      EvidenceStatus;
  reviewNote?: string;
};

type MilestoneTrackerData = {
  id:              string;
  title:           string;
  description?:    string;
  amount:          number;
  sequence:        number;
  status:          MilestoneStatus;
  paymentReadiness?: PaymentReadiness;
  evidenceReadiness?: string;
  clientNote?:     string;
  evidenceItems?:  EvidenceItem[];
  // BuildOps-sourced evidence requirements (from tool engine)
  requiredEvidence?: string[];
};

type MilestoneAction = "submit" | "approve" | "reject" | "request-changes";

type Props = {
  milestone:    MilestoneTrackerData;
  role:         "client" | "professional" | "ops";
  onAction?:    (milestoneId: string, action: MilestoneAction, payload?: { comment?: string }) => Promise<void>;
  className?:   string;
};

const STATUS_META: Record<MilestoneStatus, { label: string; color: string; icon: React.ReactNode }> = {
  DRAFT:           { label: "Draft",        color: "text-slate-400 bg-slate-900 border-slate-700",  icon: <Clock size={12} /> },
  AWAITING_REVIEW: { label: "In Review",    color: "text-yellow-300 bg-yellow-950/40 border-yellow-700", icon: <Eye size={12} /> },
  SUBMITTED:       { label: "Submitted",    color: "text-blue-300 bg-blue-950/40 border-blue-700",  icon: <Eye size={12} /> },
  APPROVED:        { label: "Approved",     color: "text-green-300 bg-green-950/40 border-green-700", icon: <CheckCircle size={12} /> },
  REJECTED:        { label: "Rejected",     color: "text-red-300 bg-red-950/40 border-red-700",     icon: <XCircle size={12} /> },
  PAID:            { label: "Paid",         color: "text-emerald-300 bg-emerald-950/40 border-emerald-700", icon: <DollarSign size={12} /> },
};

const EVIDENCE_STATUS_META: Record<EvidenceStatus, { label: string; color: string }> = {
  missing:   { label: "Required",  color: "text-slate-500" },
  submitted: { label: "Submitted", color: "text-yellow-400" },
  approved:  { label: "Approved",  color: "text-green-400"  },
  rejected:  { label: "Rejected",  color: "text-red-400"    },
};

const KIND_ICON: Record<string, React.ReactNode> = {
  PHOTO:    <Camera size={12} />,
  VIDEO:    <Camera size={12} />,
  DOCUMENT: <FileText size={12} />,
};

function EvidenceChecklist({ items, required }: { items?: EvidenceItem[]; required?: string[] }) {
  if (!items?.length && !required?.length) return null;

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted mb-3">Evidence checklist</div>
      <div className="space-y-2">
        {/* Structured evidence items */}
        {items?.map(item => {
          const meta = EVIDENCE_STATUS_META[item.status];
          const check = item.status === "approved" ? "✓" :
                        item.status === "submitted" ? "○" :
                        item.status === "rejected"  ? "✗" : "□";
          return (
            <div key={item.id} className="flex items-start gap-3">
              <span className={`mt-0.5 flex-shrink-0 font-mono text-sm ${meta.color}`}>{check}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs ${meta.color}`}>{KIND_ICON[item.kind]}</span>
                  <span className="text-xs text-ink">{item.label}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded border ${
                    item.status === "approved"  ? "border-green-700/50 text-green-400" :
                    item.status === "submitted" ? "border-yellow-700/50 text-yellow-400" :
                    item.status === "rejected"  ? "border-red-700/50 text-red-400" :
                    "border-slate-700 text-slate-500"
                  }`}>{meta.label}</span>
                  {!item.required && <span className="text-xs text-slate-600">optional</span>}
                </div>
                {item.description && <p className="text-xs text-muted mt-0.5">{item.description}</p>}
                {item.reviewNote && (
                  <p className="text-xs text-orange-300 mt-0.5 flex items-center gap-1">
                    <MessageSquare size={10} /> {item.reviewNote}
                  </p>
                )}
              </div>
            </div>
          );
        })}

        {/* Simple required evidence strings (from engine output) */}
        {required?.map((req, i) => (
          <div key={i} className="flex items-center gap-3 text-xs text-slate-400">
            <span className="font-mono text-slate-600">□</span>
            <Camera size={10} className="flex-shrink-0 text-slate-600" />
            <span>{req}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PaymentReadinessBar({ readiness }: { readiness?: PaymentReadiness }) {
  if (!readiness || readiness === "not_ready") return null;
  const colors = {
    ready_to_release: "border-green-500/30 bg-green-950/20 text-green-300",
    released:         "border-emerald-500/30 bg-emerald-950/20 text-emerald-300",
    held:             "border-orange-500/30 bg-orange-950/20 text-orange-300",
  };
  const labels = {
    ready_to_release: "✓ Payment ready to release",
    released:         "✓ Payment released",
    held:             "⚠ Payment on hold",
  };
  return (
    <div className={`rounded-lg border px-3 py-2 text-xs font-semibold ${colors[readiness]}`}>
      {labels[readiness]}
    </div>
  );
}

export function MilestoneTrackerCard({ milestone, role, onAction, className = "" }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [comment, setComment] = useState("");
  const [showComment, setShowComment] = useState(false);
  const [pendingAction, setPendingAction] = useState<MilestoneAction | null>(null);

  const statusMeta = STATUS_META[milestone.status] ?? STATUS_META.DRAFT;
  const hasEvidence = (milestone.evidenceItems?.length ?? 0) > 0 || (milestone.requiredEvidence?.length ?? 0) > 0;

  const evidenceComplete = milestone.evidenceItems
    ? milestone.evidenceItems.filter(e => e.required).every(e => e.status === "approved" || e.status === "submitted")
    : true;

  async function runAction(action: MilestoneAction) {
    if (!onAction) return;
    setLoading(true);
    try {
      await onAction(milestone.id, action, comment ? { comment } : undefined);
      setComment("");
      setShowComment(false);
      setPendingAction(null);
    } finally {
      setLoading(false);
    }
  }

  // What actions are available based on role + status
  const canSubmit        = role === "professional" && milestone.status === "DRAFT";
  const canApprove       = role === "client" && (milestone.status === "SUBMITTED" || milestone.status === "AWAITING_REVIEW");
  const canReject        = role === "client" && (milestone.status === "SUBMITTED" || milestone.status === "AWAITING_REVIEW");
  const canRequestChange = role === "client" && (milestone.status === "SUBMITTED" || milestone.status === "AWAITING_REVIEW");
  const hasActions = canSubmit || canApprove || canReject || canRequestChange;

  return (
    <div className={`rounded-2xl border border-white/[0.08] bg-white/[0.02] overflow-hidden ${className}`}>
      {/* Header */}
      <div className="flex items-center gap-4 px-5 py-4">
        {/* Sequence number */}
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-white/[0.06] border border-white/[0.08] flex items-center justify-center text-sm font-bold text-muted">
          {milestone.sequence}
        </div>

        {/* Title + status */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold text-ink">{milestone.title}</h3>
            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${statusMeta.color}`}>
              {statusMeta.icon}
              {statusMeta.label}
            </span>
          </div>
          {milestone.description && (
            <p className="text-xs text-muted mt-0.5 line-clamp-1">{milestone.description}</p>
          )}
        </div>

        {/* Amount */}
        <div className="flex-shrink-0 text-right">
          <div className="text-sm font-bold text-ink">${milestone.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}</div>
          {milestone.paymentReadiness === "ready_to_release" && (
            <div className="text-xs text-green-400">Ready to pay</div>
          )}
        </div>

        {/* Expand toggle */}
        {(hasEvidence || hasActions || milestone.clientNote) && (
          <button
            type="button"
            onClick={() => setExpanded(e => !e)}
            className="flex-shrink-0 rounded-lg p-1.5 text-muted hover:text-ink hover:bg-white/[0.05] transition"
          >
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        )}
      </div>

      {/* Expanded section */}
      {expanded && (
        <div className="border-t border-white/[0.05] px-5 py-4 space-y-4">
          {/* Payment readiness */}
          <PaymentReadinessBar readiness={milestone.paymentReadiness} />

          {/* Evidence checklist */}
          <EvidenceChecklist
            items={milestone.evidenceItems}
            required={milestone.requiredEvidence}
          />

          {/* Evidence warning */}
          {hasEvidence && !evidenceComplete && milestone.status !== "APPROVED" && milestone.status !== "PAID" && (
            <div className="flex items-center gap-2 rounded-lg border border-orange-500/20 bg-orange-950/15 px-3 py-2 text-xs text-orange-300">
              <AlertTriangle size={12} className="flex-shrink-0" />
              Some required evidence is missing or pending review.
            </div>
          )}

          {/* Client note */}
          {milestone.clientNote && (
            <div className="rounded-lg border border-blue-500/20 bg-blue-950/15 px-3 py-2">
              <div className="text-xs font-semibold text-blue-400 mb-1">Client note</div>
              <p className="text-xs text-blue-200">{milestone.clientNote}</p>
            </div>
          )}

          {/* Comment input for reject/request-changes */}
          {showComment && (
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted">Comment (required)</label>
              <textarea
                value={comment}
                onChange={e => setComment(e.target.value)}
                placeholder="Describe what needs to be changed or why you're rejecting..."
                rows={3}
                className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-ink placeholder:text-muted resize-none focus:outline-none focus:border-white/[0.18]"
              />
            </div>
          )}

          {/* Action buttons */}
          {hasActions && (
            <div className="flex flex-wrap gap-2">
              {canSubmit && (
                <button
                  onClick={() => runAction("submit")}
                  disabled={loading}
                  className="rounded-xl bg-cyan-400 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-cyan-300 disabled:opacity-60 transition"
                >
                  {loading ? "Submitting…" : "Submit milestone"}
                </button>
              )}

              {canApprove && (
                <button
                  onClick={() => runAction("approve")}
                  disabled={loading}
                  className="rounded-xl bg-green-600 px-4 py-2 text-sm font-bold text-white hover:bg-green-500 disabled:opacity-60 transition"
                >
                  {loading && pendingAction === "approve" ? "Approving…" : "✓ Approve"}
                </button>
              )}

              {canRequestChange && (
                <button
                  onClick={() => {
                    if (!showComment) { setShowComment(true); setPendingAction("request-changes"); return; }
                    if (!comment.trim()) return;
                    runAction("request-changes");
                  }}
                  disabled={loading}
                  className="rounded-xl border border-yellow-600/50 bg-yellow-950/30 px-4 py-2 text-sm font-semibold text-yellow-300 hover:border-yellow-500 disabled:opacity-60 transition"
                >
                  {loading && pendingAction === "request-changes" ? "Sending…" : "Request changes"}
                </button>
              )}

              {canReject && (
                <button
                  onClick={() => {
                    if (!showComment) { setShowComment(true); setPendingAction("reject"); return; }
                    if (!comment.trim()) return;
                    runAction("reject");
                  }}
                  disabled={loading}
                  className="rounded-xl border border-red-700/50 bg-red-950/30 px-4 py-2 text-sm font-semibold text-red-400 hover:border-red-600 disabled:opacity-60 transition"
                >
                  {loading && pendingAction === "reject" ? "Rejecting…" : "✗ Reject"}
                </button>
              )}

              {showComment && (
                <button
                  onClick={() => { setShowComment(false); setComment(""); setPendingAction(null); }}
                  className="rounded-xl border border-white/[0.08] px-4 py-2 text-sm text-muted hover:text-ink transition"
                >
                  Cancel
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
