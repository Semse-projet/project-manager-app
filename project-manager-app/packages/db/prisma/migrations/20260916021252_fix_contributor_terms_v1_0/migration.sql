-- Safe idempotent fix: insert ContributorTermsVersion v1.0 with bilingual terms
-- Migration: 20260916_fix_contributor_terms_v1_0
-- This inserts the missing v1.0 terms that should have been seeded by packages/db/prisma/seed.ts
-- ON CONFLICT (version) DO NOTHING ensures idempotency on rerun

INSERT INTO "ContributorTermsVersion" (
  id,
  version,
  "effectiveAt",
  "contentEs",
  "contentEn",
  "contentHash",
  "isActive",
  "createdAt"
) VALUES (
  'contributor_terms_v1_0',
  '1.0',
  '2026-09-15T00:00:00.000Z'::timestamp,
  '# Programa de Contribuidores de Conocimiento SEMSE — Términos v1.0

**Fecha de vigencia:** 15 de septiembre de 2026

## Participación voluntaria
Participar en una misión de SEMSE es voluntario. Puedes dejar de participar en cualquier momento sin penalización.

## Elegibilidad
Al aceptar estos términos, confirmas que tienes al menos 18 años y capacidad legal para aceptarlos.

## Autorización para grabar
Solo puedes grabar en lugares y trabajos donde tengas autorización. No puedes subir: información privada de clientes sin autorización, documentos personales, números de tarjetas, credenciales, códigos de acceso, información médica, datos personales innecesarios, ni material protegido que no tengas derecho a compartir. Evita mostrar rostros, direcciones y datos identificativos cuando no sean necesarios.

## Seguridad
El contenido nunca justifica trabajar energizado innecesariamente, retirar tu equipo de protección personal, operar un vehículo mientras grabas, usar una herramienta de forma insegura, violar OSHA, el NEC, las instrucciones del fabricante, permisos o normas aplicables, ni poner a otra persona en riesgo para obtener mejor contenido. La documentación debe detenerse cuando interfiera con la seguridad.

## No instrucciones falsas
Debes documentar lo que realmente ocurrió. Está prohibido inventar medidas, representar trabajo ajeno como propio, falsificar resultados, editar evidencia para ocultar errores relevantes, o reciclar la misma evidencia como múltiples trabajos sin declararlo. Un error real puede documentarse si explicas qué ocurrió, cómo se detectó, cómo se corrigió y cuál fue el resultado — no se debe incentivar recrear intencionalmente fallas peligrosas.

## Compensación
Cada misión muestra, antes de aceptarla, la compensación disponible, el alcance, los requisitos, los criterios de aprobación, posibles bonos y la fecha límite. SEMSE no modifica retroactivamente el pago de una misión ya aceptada.

## Revisión
Una entrega pasa por estos estados: disponible, aceptada, en progreso, enviada, en revisión, cambios solicitados, aprobada, rechazada, pago pendiente, pagada, en disputa o cancelada. Un rechazo nunca se convierte en una simple eliminación del registro.

## Derecho de corrección y de apelación
Cuando corresponda, puedes corregir una entrega incompleta. Todo rechazo incluye una razón, y puedes apelarlo. SEMSE conserva la decisión original, la razón, tu apelación, quién la revisó y el resultado final.

## Uso del contenido
Conservas los derechos que legalmente te correspondan sobre tu material original, pero otorgas a SEMSEproject una licencia suficiente para almacenar, copiar, procesar, transcribir, traducir, analizar, clasificar, generar datos derivados, crear material educativo, y usarlo para desarrollar y mejorar productos, modelos, herramientas y sistemas de conocimiento de SEMSEproject. Esta sección puede ser reemplazada tras revisión jurídica.

## Uso de IA
SEMSE puede usar sistemas automatizados para transcribir, identificar herramientas o materiales, extraer pasos, detectar medidas mencionadas, clasificar tareas, identificar problemas y soluciones, y generar conocimiento estructurado. Un resultado generado por IA nunca modifica silenciosamente tu evidencia original.

## Provenance (trazabilidad)
Todo conocimiento derivado conserva una referencia a la entrega y evidencia originales, el rango de tiempo del video cuando esté disponible, el modelo o proceso utilizado, la fecha de extracción y su versión.

## Relación laboral
Aceptar una misión de este programa no modifica, por sí sola, ninguna relación laboral existente entre tú y SEMSE ni con terceros.

## Impuestos
Algunas compensaciones podrían estar sujetas a requisitos tributarios o de reporte según tu jurisdicción y el monto recibido. SEMSE no promete una clasificación fiscal específica.

## Privacidad
SEMSE recopila únicamente la información necesaria para operar el programa (identidad, evidencia enviada, consentimiento, historial de pago). Consulta la Política de Privacidad de SEMSE para más detalles.

## Actualizaciones
Estos términos están versionados. Una nueva versión material requiere una nueva aceptación para futuras misiones. Tu aceptación de la versión 1.0 permanece registrada incluso si en el futuro existe una versión 1.1 o posterior.',
  '# SEMSE Knowledge Contributor Program — Terms v1.0

**Effective date:** September 15, 2026

## Voluntary participation
Participating in a SEMSE mission is voluntary. You may stop participating at any time without penalty.

## Eligibility
By accepting these terms, you confirm you are at least 18 years old and have the legal capacity to accept them.

## Authorization to record
You may only record work and locations where you have authorization. You may not upload: private client information without authorization, personal documents, card numbers, credentials, access codes, medical information, unnecessary personal data, or protected material you don't have the right to share. Avoid showing faces, addresses and identifying details when not necessary.

## Safety
Content never justifies working on energized equipment unnecessarily, removing your PPE, operating a vehicle while recording, using a tool unsafely, violating OSHA, the NEC, manufacturer instructions, permits or applicable codes, or putting anyone else at risk to get better footage. Documentation must stop when it interferes with safety.

## No fabricated instructions
You must document what actually happened. It is prohibited to invent measurements, present someone else's work as your own, falsify results, edit evidence to hide relevant mistakes, or reuse the same evidence as multiple submissions without disclosing it. A real mistake can be documented if you explain what happened, how it was caught, how it was corrected, and what the outcome was — intentionally recreating dangerous failures is never encouraged.

## Compensation
Every mission shows, before you accept it, the available compensation, scope, requirements, approval criteria, possible bonuses and the deadline. SEMSE does not retroactively change the payment for a mission you already accepted.

## Review
A submission moves through these states: available, accepted, in progress, submitted, under review, changes requested, approved, rejected, payment pending, paid, disputed or cancelled. A rejection is never turned into a plain deletion of the record.

## Right to correct and to appeal
When applicable, you may correct an incomplete submission. Every rejection includes a reason, and you may appeal it. SEMSE keeps the original decision, the reason, your appeal, who reviewed it, and the final outcome.

## Use of content
You keep whatever rights you legally hold over your original material, but you grant SEMSEproject a license sufficient to store, copy, process, transcribe, translate, analyze, classify, generate derived data, create educational material, and use it to develop and improve SEMSEproject''s products, models, tools and knowledge systems. This section may be replaced after legal review.

## Use of AI
SEMSE may use automated systems to transcribe, identify tools or materials, extract steps, detect mentioned measurements, classify tasks, identify problems and solutions, and generate structured knowledge. An AI-generated result never silently modifies your original evidence.

## Provenance
Every piece of derived knowledge keeps a reference back to the original submission and evidence, the video time range when available, the model or process used, the extraction date and its version.

## Employment relationship
Accepting a mission in this program does not, by itself, change any existing employment relationship between you and SEMSE or any third party.

## Taxes
Some compensation may be subject to tax or reporting requirements depending on your jurisdiction and the amount received. SEMSE does not promise a specific tax classification.

## Privacy
SEMSE collects only the information necessary to operate the program (identity, submitted evidence, consent, payment history). See SEMSE''s Privacy Policy for details.

## Updates
These terms are versioned. A material new version requires new acceptance for future missions. Your acceptance of version 1.0 stays on record even once a version 1.1 or later exists.',
  'd346c1f1c633e42bf0443ff9b792c04031601f4fbfa71d985e68fae56f1c84f5',
  true,
  NOW()
)
ON CONFLICT (version) DO NOTHING;

