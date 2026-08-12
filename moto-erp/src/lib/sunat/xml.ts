/**
 * Generador de XML UBL 2.1 para comprobantes electronicos SUNAT.
 *
 * Cubre Invoice (factura / boleta), CreditNote y DebitNote con la estructura
 * y los catalogos que exige SUNAT.
 *
 * IMPORTANTE: el bloque <ext:ExtensionContent> queda vacio a proposito. Ahi va
 * la firma digital (ds:Signature) que se genera con el certificado digital de
 * la empresa. Esa firma la coloca el OSE/PSE (Nubefact, Efact, Bizlinks, ...)
 * o un paso de firmado propio. Ver src/lib/sunat/proveedor.ts.
 */

import { TIPO_OPERACION_VENTA_INTERNA, LEYENDA_MONTO_LETRAS } from './catalogos';
import type { ComprobanteCpe, ItemCpe } from './tipos';

function esc(valor: string | number | null | undefined): string {
  if (valor === null || valor === undefined) return '';
  return String(valor)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function n(valor: number, decimales = 2): string {
  return valor.toFixed(decimales);
}

/** Nombre del archivo segun la norma SUNAT: RUC-TIPO-SERIE-CORRELATIVO */
export function nombreArchivoCpe(c: ComprobanteCpe): string {
  return `${c.emisor.ruc}-${c.tipoDocumento}-${c.serie}-${c.correlativo}`;
}

function bloqueExtensiones(): string {
  return `  <ext:UBLExtensions>
    <ext:UBLExtension>
      <ext:ExtensionContent>
        <!-- Aqui se inserta la firma digital (ds:Signature) con el certificado de la empresa -->
      </ext:ExtensionContent>
    </ext:UBLExtension>
  </ext:UBLExtensions>`;
}

function bloqueFirma(rucEmisor: string, razonSocial: string): string {
  return `  <cac:Signature>
    <cbc:ID>${esc(rucEmisor)}</cbc:ID>
    <cac:SignatoryParty>
      <cac:PartyIdentification>
        <cbc:ID>${esc(rucEmisor)}</cbc:ID>
      </cac:PartyIdentification>
      <cac:PartyName>
        <cbc:Name><![CDATA[${razonSocial}]]></cbc:Name>
      </cac:PartyName>
    </cac:SignatoryParty>
    <cac:DigitalSignatureAttachment>
      <cac:ExternalReference>
        <cbc:URI>#SignatureSP</cbc:URI>
      </cac:ExternalReference>
    </cac:DigitalSignatureAttachment>
  </cac:Signature>`;
}

function bloqueEmisor(c: ComprobanteCpe): string {
  const e = c.emisor;
  return `  <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PartyIdentification>
        <cbc:ID schemeID="6" schemeName="Documento de Identidad" schemeAgencyName="PE:SUNAT" schemeURI="urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo06">${esc(e.ruc)}</cbc:ID>
      </cac:PartyIdentification>
      <cac:PartyName>
        <cbc:Name><![CDATA[${e.nombreComercial ?? e.razonSocial}]]></cbc:Name>
      </cac:PartyName>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName><![CDATA[${e.razonSocial}]]></cbc:RegistrationName>
        <cac:RegistrationAddress>
          <cbc:ID schemeName="Ubigeos" schemeAgencyName="PE:INEI">${esc(e.ubigeo)}</cbc:ID>
          <cbc:AddressTypeCode listAgencyName="PE:SUNAT" listName="Establecimientos anexos">0000</cbc:AddressTypeCode>
          <cbc:CityName><![CDATA[${e.provincia ?? ''}]]></cbc:CityName>
          <cbc:CountrySubentity><![CDATA[${e.departamento ?? ''}]]></cbc:CountrySubentity>
          <cbc:District><![CDATA[${e.distrito ?? ''}]]></cbc:District>
          <cac:AddressLine>
            <cbc:Line><![CDATA[${e.direccion}]]></cbc:Line>
          </cac:AddressLine>
          <cac:Country>
            <cbc:IdentificationCode listID="ISO 3166-1" listAgencyName="United Nations Economic Commission for Europe" listName="Country">PE</cbc:IdentificationCode>
          </cac:Country>
        </cac:RegistrationAddress>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingSupplierParty>`;
}

function bloqueReceptor(c: ComprobanteCpe): string {
  const r = c.receptor;
  const direccion = r.direccion
    ? `        <cac:RegistrationAddress>
          <cac:AddressLine>
            <cbc:Line><![CDATA[${r.direccion}]]></cbc:Line>
          </cac:AddressLine>
        </cac:RegistrationAddress>
`
    : '';
  return `  <cac:AccountingCustomerParty>
    <cac:Party>
      <cac:PartyIdentification>
        <cbc:ID schemeID="${esc(r.tipoDocumento)}" schemeName="Documento de Identidad" schemeAgencyName="PE:SUNAT" schemeURI="urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo06">${esc(r.numeroDocumento)}</cbc:ID>
      </cac:PartyIdentification>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName><![CDATA[${r.nombre}]]></cbc:RegistrationName>
${direccion}      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingCustomerParty>`;
}

function bloqueFormaPago(c: ComprobanteCpe): string {
  if (c.formaPago === 'Contado') {
    return `  <cac:PaymentTerms>
    <cbc:ID>FormaPago</cbc:ID>
    <cbc:PaymentMeansID>Contado</cbc:PaymentMeansID>
  </cac:PaymentTerms>`;
  }
  const pendiente = c.montoPendiente ?? c.importeTotal;
  return `  <cac:PaymentTerms>
    <cbc:ID>FormaPago</cbc:ID>
    <cbc:PaymentMeansID>Credito</cbc:PaymentMeansID>
    <cbc:Amount currencyID="${esc(c.moneda)}">${n(pendiente)}</cbc:Amount>
  </cac:PaymentTerms>
  <cac:PaymentTerms>
    <cbc:ID>Cuota001</cbc:ID>
    <cbc:Amount currencyID="${esc(c.moneda)}">${n(pendiente)}</cbc:Amount>
    <cbc:PaymentDueDate>${esc(c.fechaVencimiento ?? c.fechaEmision)}</cbc:PaymentDueDate>
  </cac:PaymentTerms>`;
}

function subtotalTributo(
  c: ComprobanteCpe,
  importe: number,
  base: number,
  id: string,
  nombre: string,
  codigo: string,
): string {
  return `    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="${esc(c.moneda)}">${n(base)}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="${esc(c.moneda)}">${n(importe)}</cbc:TaxAmount>
      <cac:TaxCategory>
        <cac:TaxScheme>
          <cbc:ID schemeName="Codigo de tributos" schemeAgencyName="PE:SUNAT" schemeURI="urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo05">${id}</cbc:ID>
          <cbc:Name>${nombre}</cbc:Name>
          <cbc:TaxTypeCode>${codigo}</cbc:TaxTypeCode>
        </cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>`;
}

function bloqueTotalesImpuestos(c: ComprobanteCpe): string {
  const subtotales: string[] = [];

  if (c.totalOpGravadas > 0 || c.totalIgv > 0) {
    subtotales.push(subtotalTributo(c, c.totalIgv, c.totalOpGravadas, '1000', 'IGV', 'VAT'));
  }
  if (c.totalOpExoneradas > 0) {
    subtotales.push(subtotalTributo(c, 0, c.totalOpExoneradas, '9997', 'EXO', 'VAT'));
  }
  if (c.totalOpInafectas > 0) {
    subtotales.push(subtotalTributo(c, 0, c.totalOpInafectas, '9998', 'INA', 'FRE'));
  }

  return `  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="${esc(c.moneda)}">${n(c.totalIgv)}</cbc:TaxAmount>
${subtotales.join('\n')}
  </cac:TaxTotal>`;
}

function bloqueTotalesMonetarios(c: ComprobanteCpe, etiqueta: string): string {
  const valorVenta = c.totalOpGravadas + c.totalOpExoneradas + c.totalOpInafectas;
  const descuento =
    c.totalDescuentos > 0
      ? `    <cbc:AllowanceTotalAmount currencyID="${esc(c.moneda)}">${n(c.totalDescuentos)}</cbc:AllowanceTotalAmount>\n`
      : '';
  return `  <cac:${etiqueta}>
    <cbc:LineExtensionAmount currencyID="${esc(c.moneda)}">${n(valorVenta)}</cbc:LineExtensionAmount>
    <cbc:TaxInclusiveAmount currencyID="${esc(c.moneda)}">${n(c.importeTotal)}</cbc:TaxInclusiveAmount>
${descuento}    <cbc:PayableAmount currencyID="${esc(c.moneda)}">${n(c.importeTotal)}</cbc:PayableAmount>
  </cac:${etiqueta}>`;
}

function bloqueLinea(c: ComprobanteCpe, item: ItemCpe, etiquetaLinea: string, etiquetaCantidad: string): string {
  const descuento =
    item.descuento > 0
      ? `    <cac:AllowanceCharge>
      <cbc:ChargeIndicator>false</cbc:ChargeIndicator>
      <cbc:AllowanceChargeReasonCode listAgencyName="PE:SUNAT" listName="Cargo/descuento" listURI="urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo53">00</cbc:AllowanceChargeReasonCode>
      <cbc:Amount currencyID="${esc(c.moneda)}">${n(item.descuento)}</cbc:Amount>
    </cac:AllowanceCharge>
`
      : '';

  return `  <cac:${etiquetaLinea}>
    <cbc:ID>${item.orden}</cbc:ID>
    <cbc:${etiquetaCantidad} unitCode="${esc(item.unidadMedida)}" unitCodeListID="UN/ECE rec 20" unitCodeListAgencyName="United Nations Economic Commission for Europe">${n(item.cantidad, 3)}</cbc:${etiquetaCantidad}>
    <cbc:LineExtensionAmount currencyID="${esc(c.moneda)}">${n(item.valorVenta)}</cbc:LineExtensionAmount>
    <cac:PricingReference>
      <cac:AlternativeConditionPrice>
        <cbc:PriceAmount currencyID="${esc(c.moneda)}">${n(item.precioUnitario, 4)}</cbc:PriceAmount>
        <cbc:PriceTypeCode listName="Tipo de Precio" listAgencyName="PE:SUNAT" listURI="urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo16">01</cbc:PriceTypeCode>
      </cac:AlternativeConditionPrice>
    </cac:PricingReference>
${descuento}    <cac:TaxTotal>
      <cbc:TaxAmount currencyID="${esc(c.moneda)}">${n(item.igv)}</cbc:TaxAmount>
      <cac:TaxSubtotal>
        <cbc:TaxableAmount currencyID="${esc(c.moneda)}">${n(item.valorVenta)}</cbc:TaxableAmount>
        <cbc:TaxAmount currencyID="${esc(c.moneda)}">${n(item.igv)}</cbc:TaxAmount>
        <cac:TaxCategory>
          <cbc:Percent>${n(c.igvPorcentaje)}</cbc:Percent>
          <cbc:TaxExemptionReasonCode listAgencyName="PE:SUNAT" listName="Afectacion del IGV" listURI="urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo07">${esc(item.codigoAfectacion)}</cbc:TaxExemptionReasonCode>
          <cac:TaxScheme>
            <cbc:ID schemeName="Codigo de tributos" schemeAgencyName="PE:SUNAT" schemeURI="urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo05">${esc(item.tributoId)}</cbc:ID>
            <cbc:Name>${esc(item.tributoNombre)}</cbc:Name>
            <cbc:TaxTypeCode>${esc(item.tributoCodigo)}</cbc:TaxTypeCode>
          </cac:TaxScheme>
        </cac:TaxCategory>
      </cac:TaxSubtotal>
    </cac:TaxTotal>
    <cac:Item>
      <cbc:Description><![CDATA[${item.descripcion}]]></cbc:Description>
      <cac:SellersItemIdentification>
        <cbc:ID><![CDATA[${item.codigo}]]></cbc:ID>
      </cac:SellersItemIdentification>
    </cac:Item>
    <cac:Price>
      <cbc:PriceAmount currencyID="${esc(c.moneda)}">${n(item.valorUnitario, 4)}</cbc:PriceAmount>
    </cac:Price>
  </cac:${etiquetaLinea}>`;
}

function cabeceraXml(): string {
  return '<?xml version="1.0" encoding="UTF-8" standalone="no"?>';
}

const NS_COMUNES = `xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
  xmlns:ds="http://www.w3.org/2000/09/xmldsig#"
  xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2"`;

/** Factura (01) y Boleta (03). */
function generarInvoice(c: ComprobanteCpe): string {
  const vencimiento = c.fechaVencimiento
    ? `  <cbc:DueDate>${esc(c.fechaVencimiento)}</cbc:DueDate>\n`
    : '';

  return `${cabeceraXml()}
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
  ${NS_COMUNES}>
${bloqueExtensiones()}
  <cbc:UBLVersionID>2.1</cbc:UBLVersionID>
  <cbc:CustomizationID>2.0</cbc:CustomizationID>
  <cbc:ID>${esc(c.serie)}-${esc(c.correlativo)}</cbc:ID>
  <cbc:IssueDate>${esc(c.fechaEmision)}</cbc:IssueDate>
  <cbc:IssueTime>${esc(c.horaEmision)}</cbc:IssueTime>
${vencimiento}  <cbc:InvoiceTypeCode listID="${TIPO_OPERACION_VENTA_INTERNA}" listAgencyName="PE:SUNAT" listName="Tipo de Documento" listURI="urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo01">${esc(c.tipoDocumento)}</cbc:InvoiceTypeCode>
  <cbc:Note languageLocaleID="${LEYENDA_MONTO_LETRAS}"><![CDATA[${c.leyenda}]]></cbc:Note>
  <cbc:DocumentCurrencyCode listID="ISO 4217 Alpha" listAgencyName="United Nations Economic Commission for Europe" listName="Currency">${esc(c.moneda)}</cbc:DocumentCurrencyCode>
${bloqueFirma(c.emisor.ruc, c.emisor.razonSocial)}
${bloqueEmisor(c)}
${bloqueReceptor(c)}
${bloqueFormaPago(c)}
${bloqueTotalesImpuestos(c)}
${bloqueTotalesMonetarios(c, 'LegalMonetaryTotal')}
${c.items.map((i) => bloqueLinea(c, i, 'InvoiceLine', 'InvoicedQuantity')).join('\n')}
</Invoice>`;
}

function bloqueReferenciaNota(c: ComprobanteCpe): string {
  const ref = c.referencia!;
  return `  <cac:DiscrepancyResponse>
    <cbc:ReferenceID>${esc(ref.numeroDocumento)}</cbc:ReferenceID>
    <cbc:ResponseCode>${esc(ref.codigoMotivo)}</cbc:ResponseCode>
    <cbc:Description><![CDATA[${ref.descripcionMotivo}]]></cbc:Description>
  </cac:DiscrepancyResponse>
  <cac:BillingReference>
    <cac:InvoiceDocumentReference>
      <cbc:ID>${esc(ref.numeroDocumento)}</cbc:ID>
      <cbc:DocumentTypeCode listAgencyName="PE:SUNAT" listName="Tipo de Documento" listURI="urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo01">${esc(ref.tipoDocumento)}</cbc:DocumentTypeCode>
    </cac:InvoiceDocumentReference>
  </cac:BillingReference>`;
}

/** Nota de credito (07) y nota de debito (08). */
function generarNota(c: ComprobanteCpe): string {
  const esCredito = c.tipoDocumento === '07';
  const raiz = esCredito ? 'CreditNote' : 'DebitNote';
  const ns = esCredito
    ? 'urn:oasis:names:specification:ubl:schema:xsd:CreditNote-2'
    : 'urn:oasis:names:specification:ubl:schema:xsd:DebitNote-2';
  const etiquetaLinea = esCredito ? 'CreditNoteLine' : 'DebitNoteLine';
  const etiquetaCantidad = esCredito ? 'CreditedQuantity' : 'DebitedQuantity';
  const etiquetaTotales = esCredito ? 'LegalMonetaryTotal' : 'RequestedMonetaryTotal';

  return `${cabeceraXml()}
<${raiz} xmlns="${ns}"
  ${NS_COMUNES}>
${bloqueExtensiones()}
  <cbc:UBLVersionID>2.1</cbc:UBLVersionID>
  <cbc:CustomizationID>2.0</cbc:CustomizationID>
  <cbc:ID>${esc(c.serie)}-${esc(c.correlativo)}</cbc:ID>
  <cbc:IssueDate>${esc(c.fechaEmision)}</cbc:IssueDate>
  <cbc:IssueTime>${esc(c.horaEmision)}</cbc:IssueTime>
  <cbc:Note languageLocaleID="${LEYENDA_MONTO_LETRAS}"><![CDATA[${c.leyenda}]]></cbc:Note>
  <cbc:DocumentCurrencyCode listID="ISO 4217 Alpha" listAgencyName="United Nations Economic Commission for Europe" listName="Currency">${esc(c.moneda)}</cbc:DocumentCurrencyCode>
${bloqueReferenciaNota(c)}
${bloqueFirma(c.emisor.ruc, c.emisor.razonSocial)}
${bloqueEmisor(c)}
${bloqueReceptor(c)}
${bloqueTotalesImpuestos(c)}
${bloqueTotalesMonetarios(c, etiquetaTotales)}
${c.items.map((i) => bloqueLinea(c, i, etiquetaLinea, etiquetaCantidad)).join('\n')}
</${raiz}>`;
}

/** Punto de entrada: genera el XML segun el tipo de documento. */
export function generarXmlCpe(c: ComprobanteCpe): string {
  if (c.tipoDocumento === '07' || c.tipoDocumento === '08') {
    if (!c.referencia) {
      throw new Error('Una nota de credito/debito necesita el documento de referencia.');
    }
    return generarNota(c);
  }
  return generarInvoice(c);
}
