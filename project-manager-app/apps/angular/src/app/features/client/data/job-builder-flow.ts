import { JobBudgetType } from '../job-intake.data';

export type JobBuilderFlowState =
  | 'idle'
  | 'intent_detected'
  | 'collecting_category'
  | 'collecting_specialty'
  | 'collecting_details'
  | 'collecting_location'
  | 'collecting_budget'
  | 'collecting_files'
  | 'reviewing'
  | 'published'
  | 'ready_for_budget';

export type JobBuilderFlowSnapshot = {
  state: JobBuilderFlowState;
  stateLabel: string;
  completion: number;
  missingFields: string[];
  nextQuestion: string;
};

export type JobBuilderFlowInput = {
  categoryId: string;
  subcategoryId: string;
  title: string;
  description: string;
  city: string;
  budgetType: JobBudgetType;
  budgetMin: number;
  budgetMax: number;
  budgetConfirmed: boolean;
  attachmentsExpected: boolean;
  fileCount: number;
  published: boolean;
};

const STATE_LABELS: Record<JobBuilderFlowState, string> = {
  idle: 'Idle',
  intent_detected: 'Intent detected',
  collecting_category: 'Collecting category',
  collecting_specialty: 'Collecting specialty',
  collecting_details: 'Collecting details',
  collecting_location: 'Collecting location',
  collecting_budget: 'Collecting budget',
  collecting_files: 'Collecting files',
  reviewing: 'Reviewing',
  published: 'Published',
  ready_for_budget: 'Ready for budget',
};

function hasTitle(title: string): boolean {
  return title.trim().length >= 5;
}

function hasDescription(description: string): boolean {
  return description.trim().length >= 20;
}

function hasBudgetRange(input: JobBuilderFlowInput): boolean {
  return input.budgetMin > 0 && (input.budgetType !== 'range' || input.budgetMax >= input.budgetMin);
}

function completionScore(input: JobBuilderFlowInput) {
  let score = 0;
  if (input.categoryId.trim()) score += 15;
  if (input.subcategoryId.trim()) score += 15;
  if (hasTitle(input.title)) score += 15;
  if (hasDescription(input.description)) score += 20;
  if (input.city.trim()) score += 15;
  if (input.budgetConfirmed && hasBudgetRange(input)) score += 10;
  if (!input.attachmentsExpected || input.fileCount > 0) score += 10;
  return Math.min(score, 100);
}

export function deriveJobBuilderFlow(input: JobBuilderFlowInput): JobBuilderFlowSnapshot {
  const hasAnyIntent = Boolean(
    input.categoryId.trim() ||
      input.subcategoryId.trim() ||
      input.title.trim() ||
      input.description.trim() ||
      input.city.trim() ||
      input.budgetConfirmed,
  );

  if (input.published) {
    return {
      state: 'published',
      stateLabel: STATE_LABELS.published,
      completion: 100,
      missingFields: [],
      nextQuestion: 'Tu trabajo ya fue publicado. Puedes iniciar otro proyecto cuando quieras.',
    };
  }

  if (!hasAnyIntent) {
    return {
      state: 'idle',
      stateLabel: STATE_LABELS.idle,
      completion: 0,
      missingFields: ['category'],
      nextQuestion: '¿Qué tipo de trabajo necesitas publicar?',
    };
  }

  if (!input.categoryId.trim()) {
    return {
      state: 'intent_detected',
      stateLabel: STATE_LABELS.intent_detected,
      completion: completionScore(input),
      missingFields: ['category'],
      nextQuestion: 'Entiendo la intención. ¿Qué categoría principal describe mejor el trabajo?',
    };
  }

  if (!input.subcategoryId.trim()) {
    return {
      state: 'collecting_specialty',
      stateLabel: STATE_LABELS.collecting_specialty,
      completion: completionScore(input),
      missingFields: ['subcategory'],
      nextQuestion: '¿Qué especialidad específica necesitas dentro de esta categoría?',
    };
  }

  if (!hasTitle(input.title) || !hasDescription(input.description)) {
    const missingFields = [];
    if (!hasTitle(input.title)) missingFields.push('title');
    if (!hasDescription(input.description)) missingFields.push('description');
    return {
      state: 'collecting_details',
      stateLabel: STATE_LABELS.collecting_details,
      completion: completionScore(input),
      missingFields,
      nextQuestion: 'Describe el alcance con más detalle para preparar un expediente más preciso.',
    };
  }

  if (!input.city.trim()) {
    return {
      state: 'collecting_location',
      stateLabel: STATE_LABELS.collecting_location,
      completion: completionScore(input),
      missingFields: ['city'],
      nextQuestion: '¿En qué ciudad se realizará el trabajo?',
    };
  }

  if (!input.budgetConfirmed) {
    return {
      state: 'ready_for_budget',
      stateLabel: STATE_LABELS.ready_for_budget,
      completion: completionScore(input),
      missingFields: ['budget'],
      nextQuestion: '¿Tienes presupuesto o quieres que Prometeo sugiera un rango?',
    };
  }

  if (!hasBudgetRange(input)) {
    return {
      state: 'collecting_budget',
      stateLabel: STATE_LABELS.collecting_budget,
      completion: completionScore(input),
      missingFields: ['budget'],
      nextQuestion: 'Ajusta el presupuesto para que el rango sea consistente antes de publicar.',
    };
  }

  if (input.attachmentsExpected && input.fileCount === 0) {
    return {
      state: 'collecting_files',
      stateLabel: STATE_LABELS.collecting_files,
      completion: completionScore(input),
      missingFields: ['files'],
      nextQuestion: 'Prometeo detectó que esperabas adjuntar archivos. ¿Quieres subir fotos o planos antes de publicar?',
    };
  }

  return {
    state: 'reviewing',
    stateLabel: STATE_LABELS.reviewing,
    completion: completionScore(input),
    missingFields: [],
    nextQuestion: 'El expediente ya está listo. Revisa y publica cuando quieras.',
  };
}
