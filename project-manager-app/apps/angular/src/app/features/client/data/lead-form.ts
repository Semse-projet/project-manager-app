import type { ContractorLead } from '../../../core/api/leads.api';

export type LeadFormDraft = {
  name: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  state: string;
  jobType: string;
  description: string;
  budgetRange: string;
  urgency: string;
  notes: string;
  nextAction: string;
  source: string;
};

export const EMPTY_LEAD_FORM: LeadFormDraft = {
  name: '',
  phone: '',
  email: '',
  address: '',
  city: '',
  state: '',
  jobType: '',
  description: '',
  budgetRange: '',
  urgency: '',
  notes: '',
  nextAction: '',
  source: '',
};

function optionalText(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

export function buildLeadCreatePayload(form: LeadFormDraft): Partial<ContractorLead> & { name: string } {
  return {
    name: form.name.trim(),
    phone: optionalText(form.phone),
    email: optionalText(form.email),
    address: optionalText(form.address),
    city: optionalText(form.city),
    state: optionalText(form.state),
    jobType: optionalText(form.jobType),
    description: optionalText(form.description),
    budgetRange: optionalText(form.budgetRange),
    urgency: optionalText(form.urgency),
    notes: optionalText(form.notes),
    nextAction: optionalText(form.nextAction),
    source: optionalText(form.source),
  };
}
