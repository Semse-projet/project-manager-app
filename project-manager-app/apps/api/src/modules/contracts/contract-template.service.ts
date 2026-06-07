import { Injectable } from "@nestjs/common";

export type ContractParties = {
  clientName:    string;
  clientEmail:   string;
  proName:       string;
  proEmail:      string;
  projectTitle:  string;
  totalAmount:   number;
  currency:      string;
  startDate:     string;
  zipCode?:      string;
};

export type ContractTermsJson = {
  trade:          string;
  templateVersion: string;
  parties:        ContractParties;
  scope:          string;
  materials:      string[];
  milestones:     Array<{ title: string; amount: number; description: string }>;
  totalAmount:    number;
  warranty:       string;
  permits:        string;
  disputeClause:  string;
  changeOrders:   string;
  generatedAt:    string;
};

// 1.4.B: Per-trade contract templates
const TRADE_SCOPE: Record<string, string> = {
  electrical:  "Instalación eléctrica completa según NEC y código local. Incluye cableado, breakers, tomacorrientes GFCI y panel. Excluye obra civil.",
  plumbing:    "Trabajo de plomería residencial según UPC. Incluye tuberías de suministro y drenaje, instalación de accesorios. Excluye excavación mayor.",
  drywall:     "Instalación de tablaroca, acabado con 3 capas de compound, textura y preparación para pintura. No incluye pintura ni molduras.",
  painting:    "Pintura interior/exterior con imprimador y 2 capas. Incluye preparación de superficies, enmascarado y limpieza final.",
  roofing:     "Sustitución o reparación de techo. Incluye underlayment, instalación de shingles y sellado de penetraciones. Excluye estructura de madera.",
  concrete:    "Obra de concreto: mezcla, colado, nivelación y curado. Incluye encofrado básico. Excluye excavación y relleno.",
  flooring:    "Instalación de piso (materiales incluidos en líneas de materiales). Incluye nivelación de subpiso, instalación y rodapié.",
  hvac:        "Instalación/sustitución de sistema HVAC. Incluye unidad, ductos según plan, termostato y pruebas de funcionamiento.",
  carpentry:   "Carpintería fina: instalación de puertas, marcos, gabinetes o estructuras de madera según alcance acordado.",
  tile:        "Instalación de azulejo o mosaico. Incluye preparación de superficie, adhesivo, lechada y sellado. Excluye plomería.",
  default:     "Trabajo de construcción/remodelación según especificaciones del estimado adjunto. El contratista utilizará materiales de calidad y mano de obra profesional.",
};

const WARRANTY_BY_TRADE: Record<string, string> = {
  electrical: "12 meses en mano de obra. Garantía de fabricante en materiales.",
  plumbing:   "12 meses en mano de obra y sellados. Garantía de fabricante en accesorios.",
  roofing:    "5 años en mano de obra de instalación. Garantía de fabricante en materiales.",
  hvac:       "12 meses en mano de obra. Garantía del fabricante en equipo (2-10 años).",
  default:    "90 días en mano de obra. Garantía de fabricante en materiales.",
};

const PERMITS_BY_TRADE: Record<string, string> = {
  electrical: "El contratista gestionará el permiso eléctrico municipal si es requerido. Costo incluido en el total.",
  plumbing:   "El contratista coordinará la inspección de plomería si aplica. Permisos a cargo del contratista.",
  roofing:    "Si el municipio requiere permiso de remodelación de techo, el cliente lo facilitará o ambas partes acordarán costo.",
  default:    "Las partes acordarán quién gestiona los permisos aplicables antes de iniciar trabajos.",
};

const DISPUTE_CLAUSE = `
Cualquier disputa derivada de este contrato se resolverá primero mediante mediación entre las partes.
Si no se llega a acuerdo en 15 días naturales, se someterá a arbitraje vinculante según las reglas AAA.
La plataforma SEMSE actuará como custodio neutral de pagos hasta la resolución.`.trim();

const CHANGE_ORDER_CLAUSE = `
Todo cambio al alcance original deberá documentarse en una Orden de Cambio firmada por ambas partes antes de ejecutarse.
Los cambios que excedan el 10% del valor total requieren aprobación escrita.
El trabajo extra no autorizado previamente no será cobrado ni reclamado.`.trim();

@Injectable()
export class ContractTemplateService {
  generate(trade: string, parties: ContractParties, milestones: ContractTermsJson["milestones"]): ContractTermsJson {
    const key = trade.toLowerCase();
    const scope    = TRADE_SCOPE[key]    ?? TRADE_SCOPE.default!;
    const warranty = WARRANTY_BY_TRADE[key] ?? WARRANTY_BY_TRADE.default!;
    const permits  = PERMITS_BY_TRADE[key]  ?? PERMITS_BY_TRADE.default!;
    const totalAmount = milestones.reduce((s, m) => s + m.amount, 0) || parties.totalAmount;

    return {
      trade,
      templateVersion: "1.4.0",
      parties,
      scope,
      materials: [
        "Materiales especificados en el estimado adjunto.",
        "El contratista proveerá materiales de las marcas/calidades listadas.",
        "Cualquier sustitución requiere aprobación escrita del cliente.",
      ],
      milestones,
      totalAmount,
      warranty,
      permits,
      disputeClause:  DISPUTE_CLAUSE,
      changeOrders:   CHANGE_ORDER_CLAUSE,
      generatedAt:    new Date().toISOString(),
    };
  }

  toPlainText(terms: ContractTermsJson): string {
    const m = terms.milestones.map((ms, i) =>
      `  ${i + 1}. ${ms.title} — $${ms.amount.toLocaleString()} (${ms.description})`
    ).join("\n");

    return `CONTRATO DE SERVICIOS DE CONSTRUCCIÓN
======================================

PARTES:
  Cliente:       ${terms.parties.clientName} <${terms.parties.clientEmail}>
  Contratista:   ${terms.parties.proName} <${terms.parties.proEmail}>

PROYECTO: ${terms.parties.projectTitle}
OFICIO:   ${terms.trade.toUpperCase()}
FECHA INICIO: ${terms.parties.startDate}

ALCANCE DEL TRABAJO:
${terms.scope}

MATERIALES:
${terms.materials.map(m => `  • ${m}`).join("\n")}

HITOS Y PAGOS:
${m}

TOTAL: $${terms.totalAmount.toLocaleString()} ${terms.parties.currency}

GARANTÍA:
${terms.warranty}

PERMISOS:
${terms.permits}

ÓRDENES DE CAMBIO:
${terms.changeOrders}

DISPUTAS:
${terms.disputeClause}

Generado por SEMSE ProTools el ${new Date(terms.generatedAt).toLocaleDateString("es-MX")}.
Versión de plantilla: ${terms.templateVersion}
`;
  }
}
