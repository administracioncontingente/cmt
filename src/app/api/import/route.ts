import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { formatRut, cleanRut, validateRut } from '@/lib/rut';
import * as XLSX from 'xlsx';

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  // Genera plantilla vacía de ejemplo
  const templateRows = [
    {
      'RUT': '12.345.678-5',
      'Nombres': 'Ignacio Andrés',
      'Apellidos': 'Pérez Valenzuela',
      'Correo': 'ignacio.perez@ejemplo.cl',
      'Teléfono': '+56 9 1234 5678',
      'Fecha Nacimiento (AAAA-MM-DD)': '2010-04-15',
      'Género (M/F)': 'M',
      'Rol (JOVEN/DIRIGENTE/IST/CMT)': 'JOVEN',
      'Estado (PRE_INSCRITO/CONFIRMADO)': 'PRE_INSCRITO',
      'Zona Scout': 'Santiago Oriente',
      'Distrito Scout': 'La Reina',
      'Grupo Scout': 'Grupo Scout San Francisco',
      'Unidad o Patrulla': 'Tropa Cóndor',
      'Nombre Apoderado': 'Claudia Valenzuela',
      'Parentesco Apoderado': 'Madre',
      'Teléfono Apoderado': '+56 9 8765 4321',
      'Correo Apoderado': 'claudia.v@ejemplo.cl',
      'Restricciones Dietarias': 'Sin mariscos',
      'Notas': 'Preinscrito en primera convocatoria',
    },
  ];

  const worksheet = XLSX.utils.json_to_sheet(templateRows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Plantilla Participantes');
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="Plantilla_Carga_Participantes_AGSCH.xlsx"',
    },
  });
}

function normalizeHeader(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: 'No se ha adjuntado ningún archivo Excel o CSV' },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const workbook = XLSX.read(buffer, { type: 'buffer', codepage: 65001 });

    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      return NextResponse.json(
        { error: 'El archivo Excel no contiene hojas de cálculo' },
        { status: 400 }
      );
    }

    const worksheet = workbook.Sheets[firstSheetName];
    const rawRows: Record<string, any>[] = XLSX.utils.sheet_to_json(worksheet, {
      defval: '',
    });

    if (rawRows.length === 0) {
      return NextResponse.json(
        { error: 'La hoja de cálculo está vacía' },
        { status: 400 }
      );
    }

    // Pre-cargar planes de pago existentes
    const plans = await prisma.paymentPlan.findMany();
    const planMap = new Map(plans.map((p) => [p.roleKey, p.id]));

    let importedCount = 0;
    let updatedCount = 0;
    const errors: { row: number; rut?: string; reason: string }[] = [];

    for (let i = 0; i < rawRows.length; i++) {
      const row = rawRows[i];
      const rowNumber = i + 2; // Considerando cabecera en fila 1

      // Mapear campos normalizando claves
      const mapped: Record<string, any> = {};
      for (const [key, val] of Object.entries(row)) {
        const normKey = normalizeHeader(key);
        if (normKey.includes('rut') || normKey === 'identificador') mapped.rut = String(val).trim();
        else if (normKey.includes('nombre') && !normKey.includes('apoderado')) mapped.firstName = String(val).trim();
        else if (normKey.includes('apellido')) mapped.lastName = String(val).trim();
        else if (normKey.includes('correo') && !normKey.includes('apoderado') || normKey === 'email') mapped.email = String(val).trim();
        else if (normKey.includes('telefono') && !normKey.includes('apoderado')) mapped.phone = String(val).trim();
        else if (normKey.includes('nacimiento') || normKey.includes('fechanac')) mapped.birthDate = val;
        else if (normKey.includes('genero') || normKey.includes('sexo')) mapped.gender = String(val).trim().toUpperCase();
        else if (normKey.includes('rol') || normKey.includes('categoria')) mapped.contingentRole = String(val).trim().toUpperCase();
        else if (normKey.includes('estado')) mapped.status = String(val).trim().toUpperCase();
        else if (normKey.includes('zona')) mapped.scoutZone = String(val).trim();
        else if (normKey.includes('distrito')) mapped.scoutDistrict = String(val).trim();
        else if (normKey.includes('grupo')) mapped.scoutGroup = String(val).trim();
        else if (normKey.includes('unidad') || normKey.includes('patrulla')) mapped.unitOrPatrol = String(val).trim();
        else if (normKey.includes('apoderado') && normKey.includes('nombre')) mapped.guardianName = String(val).trim();
        else if (normKey.includes('parentesco')) mapped.guardianRelationship = String(val).trim();
        else if (normKey.includes('apoderado') && normKey.includes('telefono')) mapped.guardianPhone = String(val).trim();
        else if (normKey.includes('apoderado') && normKey.includes('correo')) mapped.guardianEmail = String(val).trim();
        else if (normKey.includes('dieta') || normKey.includes('alimentar')) mapped.dietaryRestrictions = String(val).trim();
        else if (normKey.includes('medica') || normKey.includes('alergia')) mapped.medicalNotes = String(val).trim();
        else if (normKey.includes('nota') || normKey.includes('observacion')) mapped.notes = String(val).trim();
      }

      if (!mapped.rut || !mapped.firstName || !mapped.lastName) {
        errors.push({
          row: rowNumber,
          rut: mapped.rut,
          reason: 'Faltan campos obligatorios (RUT, Nombres o Apellidos)',
        });
        continue;
      }

      const cleanedRut = cleanRut(mapped.rut);
      const formattedRut = formatRut(cleanedRut);

      // Normalizar Rol
      let roleKey = 'JOVEN';
      if (mapped.contingentRole) {
        const r = mapped.contingentRole.toUpperCase();
        if (r.includes('DIRIGENTE') || r.includes('EDUCADOR') || r.includes('LEADER')) roleKey = 'DIRIGENTE';
        else if (r.includes('IST') || r.includes('SERVICIO')) roleKey = 'IST';
        else if (r.includes('CMT') || r.includes('CONTINGENTE')) roleKey = 'CMT';
        else roleKey = 'JOVEN';
      }

      // Normalizar Estado
      let statusKey = 'PRE_INSCRITO';
      if (mapped.status) {
        const s = mapped.status.toUpperCase();
        if (s.includes('CONFIRM')) statusKey = 'CONFIRMADO';
        else if (s.includes('ESPERA')) statusKey = 'LISTA_ESPERA';
        else if (s.includes('RETIR')) statusKey = 'RETIRADO';
        else statusKey = 'PRE_INSCRITO';
      }

      const planId = planMap.get(roleKey) || null;

      // Normalizar fecha de nacimiento
      let parsedBirthDate: Date | null = null;
      if (mapped.birthDate) {
        const d = new Date(mapped.birthDate);
        if (!isNaN(d.getTime())) {
          parsedBirthDate = d;
        }
      }

      const email = mapped.email || `${cleanedRut.toLowerCase()}@participante.agsch.cl`;

      try {
        const existing = await prisma.participant.findUnique({
          where: { rut: formattedRut },
        });

        if (existing) {
          await prisma.participant.update({
            where: { rut: formattedRut },
            data: {
              firstName: mapped.firstName || existing.firstName,
              lastName: mapped.lastName || existing.lastName,
              email: mapped.email || existing.email,
              phone: mapped.phone || existing.phone,
              birthDate: parsedBirthDate || existing.birthDate,
              gender: mapped.gender || existing.gender,
              scoutZone: mapped.scoutZone || existing.scoutZone,
              scoutDistrict: mapped.scoutDistrict || existing.scoutDistrict,
              scoutGroup: mapped.scoutGroup || existing.scoutGroup,
              contingentRole: roleKey,
              status: statusKey,
              unitOrPatrol: mapped.unitOrPatrol || existing.unitOrPatrol,
              guardianName: mapped.guardianName || existing.guardianName,
              guardianRelationship: mapped.guardianRelationship || existing.guardianRelationship,
              guardianPhone: mapped.guardianPhone || existing.guardianPhone,
              guardianEmail: mapped.guardianEmail || existing.guardianEmail,
              dietaryRestrictions: mapped.dietaryRestrictions || existing.dietaryRestrictions,
              medicalNotes: mapped.medicalNotes || existing.medicalNotes,
              notes: mapped.notes || existing.notes,
              planId: existing.planId || planId,
            },
          });
          updatedCount++;
        } else {
          await prisma.participant.create({
            data: {
              rut: formattedRut,
              firstName: mapped.firstName,
              lastName: mapped.lastName,
              email,
              phone: mapped.phone || null,
              birthDate: parsedBirthDate,
              gender: mapped.gender || null,
              scoutZone: mapped.scoutZone || null,
              scoutDistrict: mapped.scoutDistrict || null,
              scoutGroup: mapped.scoutGroup || null,
              contingentRole: roleKey,
              status: statusKey,
              unitOrPatrol: mapped.unitOrPatrol || null,
              guardianName: mapped.guardianName || null,
              guardianRelationship: mapped.guardianRelationship || null,
              guardianPhone: mapped.guardianPhone || null,
              guardianEmail: mapped.guardianEmail || null,
              dietaryRestrictions: mapped.dietaryRestrictions || null,
              medicalNotes: mapped.medicalNotes || null,
              notes: mapped.notes || null,
              planId,
            },
          });
          importedCount++;
        }
      } catch (err: any) {
        errors.push({
          row: rowNumber,
          rut: formattedRut,
          reason: err.message || 'Error al persistir en base de datos',
        });
      }
    }

    return NextResponse.json({
      success: true,
      totalRows: rawRows.length,
      importedCount,
      updatedCount,
      errorsCount: errors.length,
      errors,
    });
  } catch (error) {
    console.error('Error during bulk import:', error);
    return NextResponse.json(
      { error: 'Error al procesar el archivo de importación' },
      { status: 500 }
    );
  }
}
