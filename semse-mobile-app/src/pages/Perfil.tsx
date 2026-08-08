import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Briefcase,
  Calendar,
  Check,
  Edit2,
  Mail,
  MapPin,
  Phone,
  Scale,
  Shield,
  Star,
} from 'lucide-react';
import { useWorkerProfile } from '@/hooks/useWorkerProfile';

const AVAILABILITY_OPTIONS = ['Disponible', 'Ocupado', 'No disponible'] as const;
type Availability = (typeof AVAILABILITY_OPTIONS)[number];

const AVAILABILITY_COLORS: Record<Availability, string> = {
  'Disponible': '#10b981',
  'Ocupado': '#f97316',
  'No disponible': '#6b7280',
};

function StarRow({ score }: { score: number }) {
  const color = score >= 4 ? '#10b981' : score >= 3 ? '#f59e0b' : '#ef4444';
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={`w-3.5 h-3.5 ${n <= score ? '' : 'opacity-20'}`}
          style={{ color, fill: n <= score ? color : 'transparent' }}
        />
      ))}
      <span className="ml-1 text-xs font-bold" style={{ color }}>{score}/5</span>
    </div>
  );
}

export default function Perfil() {
  const navigate = useNavigate();
  const { profile, loading } = useWorkerProfile();
  const [editing, setEditing] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [availability, setAvailability] = useState<Availability>('Disponible');

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5F7FA] px-4 py-10">
        <div className="space-y-3">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-20 rounded-xl bg-white animate-pulse shadow-sm" />
          ))}
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-[#F5F7FA] px-4 py-10">
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold text-[#1A2B3C]">Perfil no disponible</p>
        </div>
      </div>
    );
  }

  const displayName = editedName || profile.name;
  const avColor = AVAILABILITY_COLORS[availability];

  return (
    <div className="min-h-screen bg-[#F5F7FA]">
      {/* Header card */}
      <div className="bg-white px-4 pt-4 pb-5">
        <div className="flex flex-col items-center">
          <div className="mb-3 h-20 w-20 overflow-hidden rounded-full border-4 border-[#0D7377]/10">
            <img src={profile.avatar} alt={displayName} className="h-full w-full object-cover" />
          </div>
          {editing ? (
            <input
              value={editedName}
              onChange={(event) => setEditedName(event.target.value)}
              className="mb-1 w-full max-w-xs rounded-lg border border-[#0D7377] px-3 py-1.5 text-center text-lg font-bold text-[#1A2B3C] outline-none"
            />
          ) : (
            <h2 className="text-xl font-bold text-[#1A2B3C]">{displayName}</h2>
          )}
          <p className="mt-0.5 text-sm text-[#5A6B7D]">{profile.role}</p>

          <div className="mt-2 flex items-center gap-1.5">
            <div className="flex">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star
                  key={s}
                  className={`h-4 w-4 ${s <= Math.round(profile.avgRating) ? 'text-amber-400' : 'text-gray-200'}`}
                  style={{ fill: s <= Math.round(profile.avgRating) ? '#fbbf24' : 'transparent' }}
                />
              ))}
            </div>
            <span className="text-sm font-semibold text-[#1A2B3C]">{profile.avgRating.toFixed(1)}</span>
            <span className="text-xs text-[#8B9DAB]">({profile.ratings.length || profile.reviewCount} evaluaciones)</span>
          </div>

          <button
            onClick={() => setEditing((prev) => !prev)}
            className="mt-3 flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-[#5A6B7D]"
          >
            {editing ? <><Check className="h-3.5 w-3.5" /> Guardar</> : <><Edit2 className="h-3.5 w-3.5" /> Editar perfil</>}
          </button>
        </div>
      </div>

      {/* Open disputes alert */}
      {profile.openDisputesCount > 0 && (
        <div className="px-4 pt-3">
          <div className="rounded-xl border border-red-200 bg-red-50 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <Scale className="mt-0.5 h-4 w-4 text-red-500 shrink-0" />
                <div>
                  <p className="text-sm font-bold text-red-700">
                    {profile.openDisputesCount} disputa{profile.openDisputesCount > 1 ? 's' : ''} abierta{profile.openDisputesCount > 1 ? 's' : ''}
                  </p>
                  <p className="mt-0.5 text-xs text-red-600">Responde para proteger tu reputacion y evitar retencion de pagos.</p>
                </div>
              </div>
              <button
                onClick={() => navigate('/disputas')}
                className="shrink-0 rounded-lg border border-red-300 bg-red-100 px-3 py-1.5 text-xs font-bold text-red-700"
              >
                Ver →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 px-4 pt-3">
        <div className="rounded-xl bg-white p-3 text-center shadow-sm">
          <Briefcase className="mx-auto mb-1 h-5 w-5 text-[#0D7377]" />
          <p className="text-lg font-bold text-[#1A2B3C]">{profile.completedJobsCount || profile.jobsCompleted}</p>
          <p className="text-[10px] text-[#8B9DAB]">Completados</p>
        </div>
        <div className="rounded-xl bg-white p-3 text-center shadow-sm">
          <Star className="mx-auto mb-1 h-5 w-5 text-amber-500" />
          <p className="text-lg font-bold text-[#1A2B3C]">{profile.avgRating.toFixed(1)}</p>
          <p className="text-[10px] text-[#8B9DAB]">Rating</p>
        </div>
        <div className="rounded-xl bg-white p-3 text-center shadow-sm">
          <Calendar className="mx-auto mb-1 h-5 w-5 text-blue-500" />
          <p className="text-base font-bold text-[#1A2B3C]">{profile.memberSince}</p>
          <p className="text-[10px] text-[#8B9DAB]">Miembro</p>
        </div>
      </div>

      {/* Contact info */}
      <div className="px-4 pt-3">
        <div className="divide-y divide-gray-50 rounded-xl bg-white shadow-sm">
          <div className="flex items-center gap-3 p-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-50">
              <Phone className="h-4 w-4 text-[#0D7377]" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-[#8B9DAB]">Telefono</p>
              <p className="text-sm font-medium text-[#1A2B3C]">{profile.phone}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50">
              <Mail className="h-4 w-4 text-blue-500" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-[#8B9DAB]">Correo</p>
              <p className="text-sm font-medium text-[#1A2B3C]">{profile.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-50">
              <MapPin className="h-4 w-4 text-amber-500" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-[#8B9DAB]">Ubicacion</p>
              <p className="text-sm font-medium text-[#1A2B3C]">{profile.location}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Availability */}
      <div className="px-4 pt-3">
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-bold text-[#1A2B3C]">Disponibilidad</h3>
          <div className="flex flex-wrap gap-2">
            {AVAILABILITY_OPTIONS.map((option) => {
              const color = AVAILABILITY_COLORS[option];
              const selected = availability === option;
              return (
                <button
                  key={option}
                  onClick={() => setAvailability(option)}
                  className="rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors"
                  style={{
                    border: `1px solid ${selected ? color : '#e5e7eb'}`,
                    background: selected ? `${color}18` : 'transparent',
                    color: selected ? color : '#8B9DAB',
                  }}
                >
                  {option}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-[11px] text-[#8B9DAB]">Visible para clientes al buscar profesionales</p>
          <div className="mt-2 flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full" style={{ background: avColor }} />
            <span className="text-xs font-semibold" style={{ color: avColor }}>{availability}</span>
          </div>
        </div>
      </div>

      {/* Specialty */}
      <div className="px-4 pt-3">
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-bold text-[#1A2B3C]">Especialidad</h3>
          <div className="flex flex-wrap gap-2">
            {profile.specialty.split(',').map((specialty) => (
              <span
                key={specialty.trim()}
                className="rounded-full bg-[#0D7377]/10 px-3 py-1 text-xs font-semibold text-[#0D7377]"
              >
                {specialty.trim()}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Ratings list */}
      <div className="px-4 pt-3">
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#1A2B3C]">Resenas recibidas</h3>
            {profile.ratings.length > 0 && (
              <span className="text-[11px] font-semibold text-[#8B9DAB]">{profile.ratings.length} total</span>
            )}
          </div>
          {profile.ratings.length === 0 ? (
            <p className="text-sm text-[#8B9DAB]">
              {loading ? 'Cargando resenas...' : 'Aun no tienes resenas. Se publican despues de cada trabajo completado.'}
            </p>
          ) : (
            <div className="space-y-3">
              {profile.ratings.slice(0, 5).map((rating) => (
                <div key={rating.id} className="rounded-xl border border-gray-100 p-3">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <StarRow score={rating.score} />
                    <span className="text-[11px] text-[#8B9DAB]">{rating.createdAt}</span>
                  </div>
                  <p className="text-xs text-[#1A2B3C] leading-relaxed">
                    {rating.comment ?? 'Sin comentario escrito.'}
                  </p>
                  <p className="mt-1 text-[11px] text-[#8B9DAB]">Trabajo: {rating.jobTitle}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Trust badge */}
      <div className="px-4 pt-3 pb-8">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex items-center gap-3">
            <Shield className="h-5 w-5 text-emerald-600 shrink-0" />
            <div>
              <p className="text-sm font-bold text-emerald-700">Perfil verificado</p>
              <p className="mt-0.5 text-[11px] text-emerald-600">
                Identidad y licencias confirmadas por SEMSE &middot; Miembro desde {profile.memberSince}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
