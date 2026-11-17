# 🏕️ Contingente AGSCH • Polonia 2027 — Mini CRM de Gestión

Sistema web administrativo y financiero diseñado para el Equipo de Gestión del Contingente de la **Asociación de Guías y Scouts de Chile (AGSCH)** al **26° World Scout Jamboree (Gdańsk, Polonia 2027)**.

---

## ✨ Características Principales

### 1. 📋 Ficha Integral del Participante
* **Validación de RUT Chileno**: Algoritmo oficial Módulo 11 con autoformato (`XX.XXX.XXX-Y`).
* **Datos Personales y Contacto**: Nombre completo, fecha de nacimiento, correo, teléfono y género.
* **Apoderado / Contacto de Emergencia**: Nombre, parentesco, teléfono y correo electrónico.
* **Estructura Scout AGSCH**: Zona Scout, Distrito, Grupo Guía y Scout, Unidad o Patrulla.
* **Roles en el Contingente**:
  * ⚜️ **Joven / Participante** (14 a 17 años)
  * 🎒 **Educador / Dirigente de Unidad**
  * 🌍 **IST** (International Service Team / Servicio)
  * 🏛️ **CMT** (Contingent Management Team)
* **Estados de Inscripción**: Preinscrito, Confirmado, Lista de Espera, Retirado.
* **Ficha de Salud y Dieta**: Alergias, notas médicas y restricciones alimentarias.

### 2. 💵 Control Financiero y Calendario de Cuotas (USD)
* **Moneda Oficial**: Todos los valores, cuotas y abonos operan en **Dólares Estadounidenses (USD)**.
* **Planes Diferenciados por Rol**:
  * **Jóvenes**: $3,600 USD (6 cuotas programadas de $600 USD).
  * **Dirigentes**: $3,300 USD (6 cuotas programadas de $550 USD).
  * **IST**: $2,200 USD (4 cuotas programadas de $550 USD).
  * **CMT**: $2,200 USD (4 cuotas programadas de $550 USD).
* **Registro de Abonos**:
  * Fecha de pago, monto en USD, medio de pago (Transferencia, Depósito, Tarjeta, etc.), número de operación bancaria y notas.
  * Imputación cronológica a las cuotas programadas.
* **Semáforo de Salud Financiera en Tiempo Real**:
  * 🟢 **Al día**: Sin cuotas vencidas pendientes a la fecha.
  * 🔴 **En mora**: Alerta con monto adeudado y cantidad de cuotas vencidas impagas.
  * 🔵 **Pagado 100%**: Cuota de participación completada.

### 3. 📊 Carga Masiva y Exportación
* **Importación desde Excel / CSV**:
  * Carga masiva de participantes arrastrando la planilla.
  * Descarga directa de la plantilla oficial de columnas (`.xlsx`).
  * Mapeo tolerante y actualización automática si el RUT ya existe.
* **Exportación Dinámica**: Descarga en Excel (`.xlsx`) respetando los filtros activos (búsqueda, rol, estado, situación financiera).

### 4. 🔐 Seguridad y Acceso
* Autenticación interna con credenciales seguras (bcrypt + JWT HTTP-only cookies).
* Rutas y APIs administrativas protegidas.

---

## 🚀 Puesta en Marcha

### Prerrequisitos
* Node.js v20+ o v22+
* npm

### 1. Instalación de dependencias
```bash
npm install
```

### 2. Base de datos y datos iniciales
El proyecto usa SQLite local mediante Prisma ORM (sin requerir servidores externos ni Docker):
```bash
# Aplica el esquema a la base de datos SQLite
npx prisma db push

# Carga los planes de pago y participantes de prueba
npm run seed
```

### 3. Iniciar en desarrollo
```bash
npm run dev
```
Abre en tu navegador [http://localhost:3000](http://localhost:3000).

### 4. Compilar para producción
```bash
npm run build
npm start
```

---

## 🔑 Credenciales Iniciales de Administrador

* **Correo:** `admin@agsch.cl`
* **Contraseña:** `admin123`

*(En la pantalla de inicio de sesión cuentas además con un botón de **Autocompletar** para acceso rápido en desarrollo).*

---

## 🧪 Pruebas y Verificación

Para ejecutar la suite de validación lógica (RUTs chilenos, cálculo de mora, planes y exportación Excel):
```bash
npm run test:verify
```

---

## 🛠️ Stack Tecnológico
* **Framework:** Next.js (App Router, React 19, TypeScript)
* **Estilos:** Tailwind CSS 4 + Lucide React
* **Base de datos & ORM:** SQLite + Prisma ORM 6
* **Planillas & Reportes:** XLSX (SheetJS)
* **Autenticación:** Jose (JWT) + Bcryptjs
