import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle, Clock, CreditCard, Download, Landmark, Scale } from 'lucide-react';
import { useWorkerPayments } from '@/hooks/useWorkerPayments';

export default function Pagos() {
  const { payments, loading, payoutMethod, jobs, savePayoutMethod, savingPayoutMethod } = useWorkerPayments();
  const [tab, setTab] = useState<'todos' | 'liberados' | 'escrow'>('todos');
  const [filterJobId, setFilterJobId] = useState('');
  const [showPayoutForm, setShowPayoutForm] = useState(false);
  const [draftType, setDraftType] = useState<'bank_account' | 'paypal' | 'zelle' | 'cashapp'>('bank_account');
  const [draftLabel, setDraftLabel] = useState('');
  const [draftBankName, setDraftBankName] = useState('');
  const [draftEmail, setDraftEmail] = useState('');

  const filteredPayments = useMemo(() => {
    return payments.filter((payment) => {
      if (filterJobId && payment.jobId !== filterJobId) return false;
      if (tab === 'liberados') return payment.status === 'released';
      if (tab === 'escrow') return payment.status !== 'released';
      return true;
    });
  }, [filterJobId, payments, tab]);

  const totalLiberado = payments.filter((payment) => payment.status === 'released').reduce((sum, payment) => sum + payment.amount, 0);
  const totalEscrow = payments.filter((payment) => payment.status === 'in_escrow').reduce((sum, payment) => sum + payment.amount, 0);
  const totalPendiente = payments.filter((payment) => payment.status === 'pending').reduce((sum, payment) => sum + payment.amount, 0);

  return (
    <div className="min-h-screen bg-[#F5F7FA]">
      <div className="px-4 pt-3">
        <div className="rounded-2xl bg-gradient-to-br from-[#0D7377] to-[#0A5B5E] p-4 text-white shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.22em] text-white/70">Pagos</p>
              <h1 className="mt-1 text-lg font-bold">Escrow y cobros</h1>
              <p className="mt-1 text-xs text-white/80">La movil ya refleja liberaciones, fondos retenidos y senales de disputa.</p>
            </div>
            <div className="rounded-xl bg-white/10 p-2">
              <Landmark className="h-5 w-5" />
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 pt-3 pb-2">
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <div className="grid grid-cols-3 gap-4">
            <div className="border-r border-gray-100 text-center">
              <p className="mb-1 text-[10px] uppercase tracking-wide text-[#8B9DAB]">Liberado</p>
              <p className="text-xl font-bold text-emerald-500">${totalLiberado.toFixed(2)}</p>
            </div>
            <div className="border-r border-gray-100 text-center">
              <p className="mb-1 text-[10px] uppercase tracking-wide text-[#8B9DAB]">En escrow</p>
              <p className="text-xl font-bold text-blue-500">${totalEscrow.toFixed(2)}</p>
            </div>
            <div className="text-center">
              <p className="mb-1 text-[10px] uppercase tracking-wide text-[#8B9DAB]">Pendiente</p>
              <p className="text-xl font-bold text-amber-500">${totalPendiente.toFixed(2)}</p>
            </div>
          </div>
        </div>
      </div>

      {totalEscrow > 0 && (
        <div className="px-4 py-2">
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-3">
            <div className="flex items-start gap-2">
              <Clock className="mt-0.5 h-4 w-4 text-blue-600" />
              <div>
                <p className="text-xs font-semibold text-blue-800">${totalEscrow.toFixed(2)} en escrow</p>
                <p className="mt-0.5 text-[11px] text-blue-700">Estos fondos se liberan cuando el cliente aprueba hitos o cierres.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="px-4 py-2">
        <button
          onClick={() => setShowPayoutForm((value) => !value)}
          className="flex w-full items-center justify-between rounded-xl bg-white p-4 text-left shadow-sm"
        >
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-[#0D7377]/10 p-2">
              <CreditCard className="h-4 w-4 text-[#0D7377]" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[#1A2B3C]">Metodo de cobro</p>
              <p className="text-xs text-[#8B9DAB]">{payoutMethod ? payoutMethod.label : 'Aun no configurado'}</p>
            </div>
          </div>
          <span className="text-xs font-semibold text-[#0D7377]">{payoutMethod?.verified ? 'Verificado' : 'Configurar'}</span>
        </button>
      </div>

      {showPayoutForm && (
        <div className="px-4 py-2">
          <div className="space-y-3 rounded-xl bg-white p-4 shadow-sm">
            <div className="grid grid-cols-2 gap-2">
              {(['bank_account', 'paypal', 'zelle', 'cashapp'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setDraftType(type)}
                  className={`rounded-xl border px-3 py-2 text-xs font-semibold ${draftType === type ? 'border-[#0D7377] bg-[#0D7377]/5 text-[#0D7377]' : 'border-gray-200 text-[#5A6B7D]'}`}
                >
                  {type === 'bank_account' ? 'Cuenta bancaria' : type === 'paypal' ? 'PayPal' : type === 'zelle' ? 'Zelle' : 'Cash App'}
                </button>
              ))}
            </div>
            <input
              value={draftLabel}
              onChange={(event) => setDraftLabel(event.target.value)}
              placeholder="Alias visible del metodo"
              className="w-full rounded-xl border border-gray-200 px-3 py-3 text-sm outline-none"
            />
            {draftType === 'bank_account' ? (
              <input
                value={draftBankName}
                onChange={(event) => setDraftBankName(event.target.value)}
                placeholder="Banco"
                className="w-full rounded-xl border border-gray-200 px-3 py-3 text-sm outline-none"
              />
            ) : (
              <input
                value={draftEmail}
                onChange={(event) => setDraftEmail(event.target.value)}
                placeholder="Correo o identificador"
                className="w-full rounded-xl border border-gray-200 px-3 py-3 text-sm outline-none"
              />
            )}
            <button
              onClick={() => void savePayoutMethod({
                type: draftType,
                label: draftLabel || 'Metodo de cobro',
                bankName: draftBankName || undefined,
                email: draftEmail || undefined,
              })}
              disabled={savingPayoutMethod}
              className="w-full rounded-xl bg-[#0D7377] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              {savingPayoutMethod ? 'Guardando...' : 'Guardar metodo'}
            </button>
          </div>
        </div>
      )}

      <div className="px-4 py-2">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {([
            ['todos', 'Todos'],
            ['liberados', 'Liberados'],
            ['escrow', 'Escrow y pendientes'],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              onClick={() => setTab(value)}
              className={`rounded-full px-4 py-2 text-xs font-semibold ${tab === value ? 'bg-[#0D7377] text-white' : 'border border-gray-200 bg-white text-[#5A6B7D]'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {jobs.length > 1 && (
        <div className="px-4 py-2">
          <select
            value={filterJobId}
            onChange={(event) => setFilterJobId(event.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm text-[#1A2B3C] outline-none"
          >
            <option value="">Todos los trabajos</option>
            {jobs.map((job) => (
              <option key={job.id} value={job.id}>{job.title}</option>
            ))}
          </select>
        </div>
      )}

      <div className="px-4 py-2">
        <h3 className="mb-2 text-sm font-semibold text-[#1A2B3C]">Historial de pagos</h3>
        <div className="divide-y divide-gray-50 rounded-xl bg-white shadow-sm">
          {loading ? (
            <div className="p-4 text-xs text-[#8B9DAB]">Sincronizando pagos...</div>
          ) : filteredPayments.length === 0 ? (
            <div className="p-6 text-center">
              <p className="text-sm font-medium text-[#1A2B3C]">Sin movimientos en este filtro</p>
              <p className="mt-1 text-xs text-[#8B9DAB]">Cuando haya depositos o liberaciones apareceran aqui.</p>
            </div>
          ) : filteredPayments.map((payment) => (
            <div key={payment.id} className={`flex items-center gap-3 p-4 ${payment.disputed ? 'bg-red-50/50' : ''}`}>
              <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${
                payment.disputed
                  ? 'bg-red-50'
                  : payment.status === 'released'
                    ? 'bg-emerald-50'
                    : payment.status === 'in_escrow'
                      ? 'bg-blue-50'
                      : 'bg-amber-50'
              }`}>
                {payment.disputed ? (
                  <Scale className="h-5 w-5 text-red-500" />
                ) : payment.status === 'released' ? (
                  <CheckCircle className="h-5 w-5 text-emerald-500" />
                ) : payment.status === 'in_escrow' ? (
                  <Clock className="h-5 w-5 text-blue-500" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-[#1A2B3C]">{payment.description}</p>
                <p className="text-xs text-[#8B9DAB]">{payment.jobTitle ? `${payment.jobTitle} · ` : ''}{payment.date}</p>
              </div>
              <div className="flex-shrink-0 text-right">
                <p className={`text-sm font-semibold ${payment.disputed ? 'text-red-600' : 'text-[#1A2B3C]'}`}>${payment.amount.toFixed(2)}</p>
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                  payment.disputed
                    ? 'bg-red-50 text-red-600'
                    : payment.status === 'released'
                      ? 'bg-emerald-50 text-emerald-600'
                      : payment.status === 'in_escrow'
                        ? 'bg-blue-50 text-blue-600'
                        : 'bg-amber-50 text-amber-600'
                }`}>
                  {payment.disputed ? 'En disputa' : payment.status === 'released' ? 'Liberado' : payment.status === 'in_escrow' ? 'En escrow' : 'Pendiente'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="px-4 py-4">
        <button className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#0D7377] py-3.5 text-sm font-medium text-white shadow-md transition-transform active:scale-[0.98]">
          <Download className="h-4 w-4" />
          Solicitar retiro
        </button>
      </div>
    </div>
  );
}
