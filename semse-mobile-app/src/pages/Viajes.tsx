import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Briefcase, Calendar, CheckCircle2, DollarSign, MapPin, PlaneTakeoff, Plus } from 'lucide-react';
import { useWorkerTravel } from '@/hooks/useWorkerTravel';

export default function Viajes() {
  const navigate = useNavigate();
  const { trips, expenses, loading } = useWorkerTravel();

  const activeTrip = trips.find((trip) => trip.rawStatus === 'ACTIVE');
  const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const pendingSettlement = trips.filter((trip) => trip.rawStatus === 'PENDING_SETTLEMENT').length;
  const readyToClose = trips.filter((trip) => trip.readyToClose).length;
  const tripsWithRisk = trips.filter((trip) => {
    const overBudget = typeof trip.approvedBudget === 'number' && typeof trip.totalSpent === 'number' && trip.totalSpent > trip.approvedBudget;
    return (trip.missingReceipts ?? 0) > 0 || overBudget;
  }).length;

  const sortedTrips = [...trips].sort((left, right) => {
    const readyDelta = Number(Boolean(right.readyToClose)) - Number(Boolean(left.readyToClose));
    if (readyDelta !== 0) return readyDelta;

    const missingDelta = (right.missingReceipts ?? 0) - (left.missingReceipts ?? 0);
    if (missingDelta !== 0) return missingDelta;

    return String(right.startDate).localeCompare(String(left.startDate));
  });

  return (
    <div className="min-h-screen bg-[#F5F7FA]">
      <div className="px-4 pt-3">
        <div className="rounded-2xl bg-gradient-to-br from-[#0D7377] to-[#0A5B5E] p-4 text-white shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.22em] text-white/70">Movilidad y estancia</p>
              <h1 className="mt-1 text-lg font-bold">Operacion de viajes</h1>
              <p className="mt-1 text-xs text-white/80">La vista movil ya refleja liquidacion, soportes faltantes y presion de presupuesto.</p>
            </div>
            <div className="rounded-xl bg-white/10 p-2">
              <PlaneTakeoff className="h-5 w-5" />
            </div>
          </div>
        </div>
      </div>

      {activeTrip && (
        <div className="px-4 pt-3 pb-2">
          <div className="rounded-xl border-l-4 border-[#0D7377] bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <span className="rounded-full bg-[#0D7377]/10 px-2 py-0.5 text-[10px] font-semibold text-[#0D7377]">
                En curso
              </span>
              <button onClick={() => navigate('/gastos')} className="text-xs font-medium text-[#0D7377]">Ver liquidacion</button>
            </div>
            <div className="mb-3 flex items-center gap-3">
              <div className="flex-1">
                <p className="text-xs text-[#8B9DAB]">Origen</p>
                <p className="text-sm font-semibold text-[#1A2B3C]">{activeTrip.origin}</p>
              </div>
              <div className="flex items-center gap-1">
                <div className="h-2 w-2 rounded-full bg-[#0D7377]" />
                <div className="h-0.5 w-12 border-t-2 border-dashed border-[#0D7377]" />
                <ArrowRight className="h-3 w-3 text-[#0D7377]" />
              </div>
              <div className="flex-1 text-right">
                <p className="text-xs text-[#8B9DAB]">Destino</p>
                <p className="text-sm font-semibold text-[#1A2B3C]">{activeTrip.destination}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-[#5A6B7D]">
              <Calendar className="h-3 w-3" />
              <span>{activeTrip.startDate} - {activeTrip.endDate}</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {(activeTrip.missingReceipts ?? 0) > 0 && (
                <span className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-700">
                  {activeTrip.missingReceipts} soporte(s) faltante(s)
                </span>
              )}
              {activeTrip.blockedReason && (
                <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600">
                  {activeTrip.blockedReason}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="px-4 py-2">
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-white p-3 text-center shadow-sm">
            <Briefcase className="mx-auto mb-1 h-5 w-5 text-[#0D7377]" />
            <p className="text-lg font-bold text-[#1A2B3C]">{trips.length}</p>
            <p className="text-[10px] text-[#8B9DAB]">Total viajes</p>
          </div>
          <div className="rounded-xl bg-white p-3 text-center shadow-sm">
            <Calendar className="mx-auto mb-1 h-5 w-5 text-blue-500" />
            <p className="text-lg font-bold text-[#1A2B3C]">{pendingSettlement}</p>
            <p className="text-[10px] text-[#8B9DAB]">Por liquidar</p>
          </div>
          <div className="rounded-xl bg-white p-3 text-center shadow-sm">
            <DollarSign className="mx-auto mb-1 h-5 w-5 text-amber-500" />
            <p className="text-lg font-bold text-[#1A2B3C]">${totalExpenses.toFixed(2)}</p>
            <p className="text-[10px] text-[#8B9DAB]">Gasto cargado</p>
          </div>
          <div className="rounded-xl bg-white p-3 text-center shadow-sm">
            <CheckCircle2 className="mx-auto mb-1 h-5 w-5 text-emerald-500" />
            <p className="text-lg font-bold text-[#1A2B3C]">{readyToClose}</p>
            <p className="text-[10px] text-[#8B9DAB]">Listos para cerrar</p>
          </div>
        </div>
      </div>

      {tripsWithRisk > 0 && (
        <div className="px-4 py-2">
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-600" />
              <div>
                <p className="text-xs font-semibold text-amber-800">Atencion operativa</p>
                <p className="mt-0.5 text-[11px] text-amber-700">{tripsWithRisk} viaje(s) tienen soportes faltantes o presion de presupuesto.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="px-4 py-2">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[#1A2B3C]">Viajes</h3>
          <span className="text-[11px] text-[#8B9DAB]">{loading ? 'Sincronizando...' : `${trips.length} registro(s)`}</span>
        </div>
        <div className="space-y-2">
          {sortedTrips.map((trip) => {
            const overBudget = typeof trip.approvedBudget === 'number' && typeof trip.totalSpent === 'number' && trip.totalSpent > trip.approvedBudget;
            const badgeClass =
              trip.rawStatus === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700'
              : trip.rawStatus === 'PENDING_SETTLEMENT' ? 'bg-amber-50 text-amber-700'
              : trip.rawStatus === 'CLOSED' ? 'bg-slate-100 text-slate-600'
              : 'bg-blue-50 text-blue-600';

            return (
              <div key={trip.id} className={`rounded-xl border bg-white p-4 shadow-sm ${trip.readyToClose ? 'border-blue-200' : overBudget ? 'border-red-200' : 'border-white'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${trip.readyToClose ? 'bg-blue-50' : overBudget ? 'bg-red-50' : 'bg-[#0D7377]/10'}`}>
                      {trip.readyToClose ? <CheckCircle2 className="h-5 w-5 text-blue-600" /> : overBudget ? <AlertTriangle className="h-5 w-5 text-red-500" /> : <MapPin className="h-5 w-5 text-[#0D7377]" />}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[#1A2B3C]">Viaje a {trip.destination}</p>
                      <p className="text-xs text-[#5A6B7D]">{trip.jobTitle ?? 'Trabajo operativo'} · {trip.startDate}</p>
                    </div>
                  </div>
                  <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${badgeClass}`}>
                    {trip.rawStatus === 'ACTIVE' ? 'Activo' : trip.rawStatus === 'PENDING_SETTLEMENT' ? 'Por liquidar' : trip.rawStatus === 'CLOSED' ? 'Cerrado' : 'Planificado'}
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2">
                  <div className="rounded-lg bg-[#F5F7FA] px-3 py-2">
                    <p className="text-[10px] uppercase tracking-wide text-[#8B9DAB]">Soportes</p>
                    <p className="mt-1 text-sm font-semibold text-[#1A2B3C]">{trip.receiptCount ?? 0}</p>
                  </div>
                  <div className="rounded-lg bg-[#F5F7FA] px-3 py-2">
                    <p className="text-[10px] uppercase tracking-wide text-[#8B9DAB]">Faltantes</p>
                    <p className="mt-1 text-sm font-semibold text-[#1A2B3C]">{trip.missingReceipts ?? 0}</p>
                  </div>
                  <div className="rounded-lg bg-[#F5F7FA] px-3 py-2">
                    <p className="text-[10px] uppercase tracking-wide text-[#8B9DAB]">Saldo</p>
                    <p className={`mt-1 text-sm font-semibold ${typeof trip.expectedBalance === 'number' && trip.expectedBalance < 0 ? 'text-red-600' : 'text-[#1A2B3C]'}`}>
                      {typeof trip.expectedBalance === 'number' ? `$${trip.expectedBalance.toFixed(0)}` : 'N/D'}
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {(trip.missingExpenseReceipts ?? 0) > 0 && (
                    <span className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-700">
                      {trip.missingExpenseReceipts} gasto(s) sin soporte
                    </span>
                  )}
                  {(trip.missingLodgingReceipts ?? 0) > 0 && (
                    <span className="rounded-full bg-violet-50 px-2 py-1 text-[10px] font-semibold text-violet-700">
                      {trip.missingLodgingReceipts} hospedaje(s) sin soporte
                    </span>
                  )}
                  {trip.readyToClose && (
                    <span className="rounded-full bg-blue-50 px-2 py-1 text-[10px] font-semibold text-blue-700">
                      listo para cerrar
                    </span>
                  )}
                  {trip.blockedReason && (
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600">
                      {trip.blockedReason}
                    </span>
                  )}
                  {overBudget && (
                    <span className="rounded-full bg-red-50 px-2 py-1 text-[10px] font-semibold text-red-700">
                      sobre presupuesto
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="space-y-2 px-4 py-4">
        <button
          onClick={() => navigate('/hospedaje')}
          className="flex w-full items-center justify-between rounded-xl bg-white p-4 text-left shadow-sm active:bg-gray-50"
        >
          <span className="text-sm font-medium text-[#1A2B3C]">Hospedaje</span>
          <ArrowRight className="h-4 w-4 text-[#8B9DAB]" />
        </button>
        <button
          onClick={() => navigate('/gastos')}
          className="flex w-full items-center justify-between rounded-xl bg-white p-4 text-left shadow-sm active:bg-gray-50"
        >
          <span className="text-sm font-medium text-[#1A2B3C]">Gastos de viaje</span>
          <ArrowRight className="h-4 w-4 text-[#8B9DAB]" />
        </button>
        <button
          onClick={() => navigate('/anticipos')}
          className="flex w-full items-center justify-between rounded-xl bg-white p-4 text-left shadow-sm active:bg-gray-50"
        >
          <span className="text-sm font-medium text-[#1A2B3C]">Anticipos</span>
          <ArrowRight className="h-4 w-4 text-[#8B9DAB]" />
        </button>
      </div>

      <div className="px-4 py-2 pb-8">
        <button className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#0D7377] py-3.5 text-sm font-medium text-white shadow-md transition-transform active:scale-[0.98]">
          <Plus className="h-4 w-4" />
          Nuevo viaje
        </button>
      </div>
    </div>
  );
}
