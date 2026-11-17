/**
 * Limpia un RUT eliminando puntos, guiones y espacios.
 */
export function cleanRut(rut: string): string {
  if (!rut) return '';
  return rut.replace(/[^0-9kK]/g, '').toUpperCase();
}

/**
 * Calcula el Dígito Verificador (DV) para un cuerpo de RUT dado.
 */
export function calculateDv(rutBody: string): string {
  const cleanBody = rutBody.replace(/[^0-9]/g, '');
  if (!cleanBody) return '';

  let sum = 0;
  let multiplier = 2;

  for (let i = cleanBody.length - 1; i >= 0; i--) {
    sum += parseInt(cleanBody[i], 10) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }

  const remainder = sum % 11;
  const expectedDv = 11 - remainder;

  if (expectedDv === 11) return '0';
  if (expectedDv === 10) return 'K';
  return expectedDv.toString();
}

/**
 * Valida un RUT chileno usando el algoritmo oficial Módulo 11.
 */
export function validateRut(rut: string): boolean {
  const cleaned = cleanRut(rut);
  if (cleaned.length < 2) return false;

  const body = cleaned.slice(0, -1);
  const dv = cleaned.slice(-1).toUpperCase();

  if (!/^\d+$/.test(body)) return false;

  const expectedDv = calculateDv(body);
  return dv === expectedDv;
}

/**
 * Formatea un RUT chileno al estándar XX.XXX.XXX-Y
 */
export function formatRut(rut: string): string {
  const cleaned = cleanRut(rut);
  if (cleaned.length < 2) return rut;

  const body = cleaned.slice(0, -1);
  const dv = cleaned.slice(-1);

  let formattedBody = '';
  let count = 0;
  for (let i = body.length - 1; i >= 0; i--) {
    formattedBody = body[i] + formattedBody;
    count++;
    if (count % 3 === 0 && i !== 0) {
      formattedBody = '.' + formattedBody;
    }
  }

  return `${formattedBody}-${dv}`;
}
