# Manual de Usuario Oficial
## Sistema de Gestión del Contingente Nacional • 26° World Scout Jamboree (Polonia 2027)
### Asociación de Guías y Scouts de Chile (AGSCH)

---

## 📋 Índice
1. [Introducción y Objetivos](#1-introducción-y-objetivos)
2. [Perfiles de Acceso y Roles](#2-perfiles-de-acceso-y-roles)
3. [Módulo Administrativo (CRM del Contingente)](#3-módulo-administrativo-crm-del-contingente)
   - [3.1 Inicio de Sesión](#31-inicio-de-sesión)
   - [3.2 Dashboard y Estadísticas Financieras](#32-dashboard-y-estadísticas-financieras)
   - [3.3 Gestión y Búsqueda de Participantes](#33-gestión-y-búsqueda-de-participantes)
   - [3.4 Ficha Detallada del Participante](#34-ficha-detallada-del-participante)
   - [3.5 Registro y Conciliación de Pagos](#35-registro-y-conciliación-de-pagos)
   - [3.6 Exportación de Datos a Excel](#36-exportación-de-datos-a-excel)
4. [Portal de Ficha Médica Tri-Lingüe (Apoderados y Participantes)](#4-portal-de-ficha-médica-tri-lingüe-apoderados-y-participantes)
   - [4.1 Acceso Seguro con RUT y Correo](#41-acceso-seguro-con-rut-y-correo)
   - [4.2 Verificación de Identidad con Código OTP (6 dígitos)](#42-verificación-de-identidad-con-código-otp-6-dígitos)
   - [4.3 Formulario Clínico y Secciones Médicas](#43-formulario-clínico-y-secciones-médicas)
   - [4.4 Motor de Traducción Automática (Español, Inglés, Polaco)](#44-motor-de-traducción-automática-español-inglés-polaco)
   - [4.5 Declaración y Consentimiento de Emergencia](#45-declaración-y-consentimiento-de-emergencia)
   - [4.6 Generación del Carnet y Código QR de Emergencia](#46-generación-del-carnet-y-código-qr-de-emergencia)
5. [Portal de Emergencia Médica en Campamento (Polonia)](#5-portal-de-emergencia-médica-en-campamento-polonia)
   - [5.1 Escaneo del Código QR](#51-escaneo-del-código-qr)
   - [5.2 Selector Rápido de Idioma (Polski / English / Español)](#52-selector-rápido-de-idioma-polski--english--español)
   - [5.3 Detección de Condiciones Críticas (Alergias Severas, EpiPen, Cadena de Frío)](#53-detección-de-condiciones-críticas-alergias-severas-epipen-cadena-de-frío)
   - [5.4 Marcación Rápida de Teléfonos de Emergencia y Seguro de Viaje](#54-marcación-rápida-de-teléfonos-de-emergencia-y-seguro-de-viaje)
6. [Resolución de Dudas Frecuentes (FAQ)](#6-resolución-de-dudas-frecuentes-faq)

---

## 1. Introducción y Objetivos
El **Sistema de Gestión del Contingente AGSCH Polonia 2027** es una plataforma web integral diseñada para coordinar a más de 1.300 participantes chilenos (jóvenes, dirigentes, miembros del IST y equipo de gestión CMT) que participarán en el 26° Jamboree Scout Mundial en Gdansk, Polonia.

### Objetivos Clave:
* **Control Financiero:** Seguimiento riguroso de cuotas oficiales fijadas en dólares estadounidenses (USD) y registro de transferencias bancarias.
* **Seguridad y Salud en el Extranjero:** Levantamiento previo de antecedentes médicos validados por los apoderados legales y traducidos clínicamente a inglés y polaco.
* **Respuesta Rápida en Emergencias:** Visualización instantánea del historial clínico en caso de incidentes en Polonia mediante credenciales físicas con código QR.

---

## 2. Perfiles de Acceso y Roles

```
┌────────────────────────────────────────────────────────────────────────┐
│                        PERFILES DE USUARIOS                            │
├───────────────────────┬───────────────────────┬────────────────────────┤
│ Administrador / CMT   │ Apoderado / Scout     │ Equipo Médico (Polonia)│
├───────────────────────┼───────────────────────┼────────────────────────┤
│ • Acceso con email y  │ • Acceso vía RUT y    │ • Acceso público vía   │
│   password a /login   │   correo registrado   │   escaneo de QR        │
│ • Control financiero  │ • Validación por OTP  │ • Vista rápida tri-    │
│ • Edición de cupos y  │ • Llenado y firma de  │   lingüe (PL/EN/ES)    │
│   datos logísticos    │   Ficha Médica WSJ    │ • Alertas de EpiPen y  │
│ • Exportación Excel   │ • Descarga carnet QR  │   cadena de frío       │
└───────────────────────┴───────────────────────┴────────────────────────┘
```

---

## 3. Módulo Administrativo (CRM del Contingente)

### 3.1 Inicio de Sesión
1. Ingrese a la ruta `/login` en el dominio de la plataforma.
2. Escriba sus credenciales autorizadas:
   * **Usuario:** `admin@agsch.cl` o `administracioncontingente@guiasyscoutschile.cl`
   * **Contraseña:** `admin123`
3. Haga clic en **"Ingresar al Sistema"**. Se generará una sesión encriptada de 7 días.

### 3.2 Dashboard y Estadísticas Financieras
En la parte superior de la vista principal encontrará las tarjetas métricas en tiempo real:
* **Total Recaudado (USD):** Suma global de todos los pagos validados.
* **Porcentaje de Recaudación:** Avance respecto a la meta financiera total del contingente.
* **Participantes al Día:** Cantidad y porcentaje de personas sin deuda vencida a la fecha.
* **Participantes en Mora / Deuda:** Cantidad de personas con cuotas pendientes.
* **Fichas Médicas Completadas:** Indicador de cumplimiento sanitario del contingente.

### 3.3 Gestión y Búsqueda de Participantes
La tabla principal permite ordenar, paginar y filtrar al contingente:
* **Buscador en Vivo:** Escriba el RUT (con o sin puntos), Nombre, Apellido, Código de Cupo (ej: `PAR014`, `IST106`), o Grupo Scout.
* **Filtros Rápidos:**
  * Por Rol: `Participante / Joven`, `Dirigente`, `IST`, `CMT`.
  * Por Estado Financiero: `Total Pagado`, `Al Día`, `Adeuda`, `Baja`.
  * Por Territorio: `SUR`, `CENTRO`, `NORTE`.
  * Por Estado de Ficha Médica: `Completada`, `Pendiente`, `Alergia Severa`.

### 3.4 Ficha Detallada del Participante
Al hacer clic en cualquier fila de la tabla, se abrirá el modal con 4 pestañas:
1. **Datos Personales y Scout:** Cédula, fecha de nacimiento, edad al campamento, Zona, Distrito, Grupo y nivel de formación.
2. **Logística y Asignación:** Territorio, Unidad, Patrulla asignada, talla de uniforme oficial y estado de registro en Polonia.
3. **Historial de Pagos y Cuotas:** Desglose de cuotas requeridas vs. abonos realizados, con saldo a favor o deuda final en USD.
4. **Ficha Médica WSJ:** Vista previa del estado de la ficha, tipo de sangre, alergias registradas y botón para **Copiar enlace directo de llenado para enviar por WhatsApp al apoderado**.

### 3.5 Registro y Conciliación de Pagos
Para registrar un nuevo abono:
1. Abra la ficha del participante.
2. En la pestaña de Pagos, presione **"+ Registrar Abono"**.
3. Ingrese:
   * Monto en USD (o equivalente registrado).
   * Fecha de la operación.
   * Método de pago (Transferencia, Depósito, etc.).
   * Número de documento / Comprobante bancario.
   * Observaciones adicionales.
4. Presione **"Guardar Abono"**. Los saldos y el estado del participante se recalcularán automáticamente.

### 3.6 Exportación de Datos a Excel
En la barra superior de herramientas, presione el botón **"Descargar Excel"**:
* Descarga una planilla `.xlsx` con todas las columnas demográficas, territoriales, logísticas y financieras del contingente para respaldos o informes a la Comisión de Finanzas de la Corte Nacional.

---

## 4. Portal de Ficha Médica Tri-Lingüe (Apoderados y Participantes)

El portal médico está optimizado para teléfonos celulares y computadores en la ruta `/ficha-medica`.

### 4.1 Acceso Seguro con RUT y Correo
1. El apoderado ingresa el **RUT del participante** (ej: `21.345.678-4`).
2. Ingresa el **Correo electrónico registrado** (el correo del apoderado o del participante).
3. Presiona **"Continuar"**. El sistema valida que el participante exista y pertenezca al contingente.

### 4.2 Verificación de Identidad con Código OTP (6 dígitos)
Para garantizar que solo el tutor legal o el participante autorizado complete o modifique datos de salud:
1. El sistema genera un código numérico aleatorio de 6 dígitos con **vigencia de 15 minutos**.
2. El código se envía automáticamente al correo electrónico del apoderado.
3. El apoderado ingresa los 6 dígitos en la pantalla de verificación.
4. Al validar, se genera un token de sesión seguro con vigencia de 2 horas para completar el formulario.

> [!NOTE] En entornos de prueba o desarrollo, el código OTP se visualiza también en consola para facilitar auditorías técnicas sin depender de pasarelas SMTP externas.

### 4.3 Formulario Clínico y Secciones Médicas
El formulario está organizado en 7 secciones clínicas:
1. **Datos Biométricos:** Tipo y factor sanguíneo (O+, O-, A+, etc.), estatura en cm y peso en kg.
2. **Contacto de Emergencia 24/7:** Nombre del contacto primario, relación/parentesco, teléfono internacional (con código de país) y correo.
3. **Seguro Médico Internacional:** Compañía aseguradora, número de póliza contratada y teléfono de asistencia en el extranjero.
4. **Alergias e Inmunología:**
   * ¿Presenta alergias severas (medicamentos, alimentos, picaduras de insectos)?
   * ¿Porta inyector de Epinefrina (EpiPen / Anapen)?
   * Descripción clínica detallada.
5. **Condiciones Médicas y Medicamentos Habituales:**
   * Enfermedades crónicas (asma, diabetes tipo 1/2, epilepsia, celiaquía).
   * Medicamentos continuos, dosis y si **requiere cadena de frío (refrigeración a 2°C - 8°C)** en campamento.
6. **Vacunas y Cirugías:**
   * Año de la última dosis de refuerzo antitetánica (obligatoria para actividades scouts).
   * Cirugías recientes, fracturas, prótesis, implantes o dispositivos médicos (lentes de contacto, audífonos).
7. **Limitaciones de Actividad:**
   * Restricciones para caminatas prolongadas o natación en actividades acuáticas.

### 4.4 Motor de Traducción Automática (Español, Inglés, Polaco)
Al guardar la ficha:
* El motor semántico médico procesa cada término en español y genera automáticamente las traducciones oficiales al **Inglés** y al **Polaco**.
* **Ejemplos de rigor terminológico aplicado:**
  * `Penicilina` ➔ EN: *Penicillin* ➔ PL: *Penicylina*
  * `Asma bronquial` ➔ EN: *Bronchial asthma* ➔ PL: *Astma oskrzelowa*
  * `Insulina (Cadena de frío)` ➔ EN: *Insulin (Cold chain required)* ➔ PL: *Insulina (Wymaga łańcucha chłodniczego)*
  * `Celíaco / Sin Gluten` ➔ EN: *Celiac disease (Gluten-free diet)* ➔ PL: *Celiakia (Dieta bezglutenowa)*
  * `Porta EpiPen` ➔ EN: *Carries EpiPen (Auto-injector)* ➔ PL: *Posiada autostrzykawkę z adrenaliną (EpiPen)*

### 4.5 Declaración y Consentimiento de Emergencia
El apoderado o participante mayor de edad debe aceptar la cláusula de autorización de atención médica de urgencia en territorio polaco e ingresar su Nombre Completo y RUT antes de firmar electrónicamente.

### 4.6 Generación del Carnet y Código QR de Emergencia
Una vez enviada la ficha:
* El sistema confirma la recepción exitosa.
* Se genera un **Código QR Único e Intransferible**.
* El apoderado puede imprimir la Ficha Clínica o descargar la tarjeta de emergencia en PDF/Imagen para plastificarla y adherirla a la credencial oficial del Jamboree.

---

## 5. Portal de Emergencia Médica en Campamento (Polonia)

Diseñado especialmente para el equipo médico polaco (*Harcerskie Ochotnicze Pogotowie Ratunkowe*) y paramédicos internacionales del WSJ en Gdansk.

### 5.1 Escaneo del Código QR
Al escanear el código QR con cualquier teléfono inteligente o tablet de emergencias (sin necesidad de instalar ninguna app):
* Se abre directamente la URL pública protegida: `/medico/[qrAccessCode]`.
* No requiere contraseña de usuario administrativo, permitiendo **atención inmediata en segundos**.

### 5.2 Selector Rápido de Idioma (Polski / English / Español)
En la esquina superior derecha, los paramédicos pueden cambiar el idioma de la ficha con un solo toque:
* **🇵🇱 Polski (por defecto para personal local):** Todos los diagnósticos, medicamentos y advertencias se visualizan en idioma polaco estándar.
* **🇬🇧 English:** Formato médico internacional en inglés.
* **🇨🇱 Español:** Registro original ingresado por el apoderado en Chile.

### 5.3 Detección de Condiciones Críticas
Si el participante presenta condiciones de riesgo vital, el portal despliega alertas visuales prominentes:
* 🔴 **ALERTA ROJA (EpiPen):** Indica en polaco e inglés que el paciente porta inyector de adrenalina para shock anafiláctico.
* ❄️ **ALERTA CELESTE (Cadena de Frío):** Señala medicamentos que deben mantenerse en el refrigerador del hospital de campaña.
* ⚠️ **TIPO DE SANGRE DESTACADO:** Insignia de gran visibilidad para transfusiones inmediatas.

### 5.4 Marcación Rápida de Teléfonos de Emergencia
* Botón de llamada directa al **Contacto de Emergencia en Chile**.
* Botón de llamada directa a la **Central de Asistencia del Seguro de Viaje** para activación de cobertura médica en hospitales polacos.

---

## 6. Resolución de Dudas Frecuentes (FAQ)

### ¿Qué hago si el apoderado no recibe el código OTP de 6 dígitos?
1. Verifique que el correo ingresado coincida exactamente con el registrado en la base de datos institucional.
2. Revise la carpeta de correo no deseado (Spam).
3. Puede solicitar un nuevo código pasados 60 segundos con el botón *"Reenviar código"*.

### ¿Cómo actualizo una ficha si el participante cambió de medicación?
El apoderado puede volver a ingresar a `/ficha-medica` con el RUT y correo en cualquier momento. Al validar el nuevo código OTP, el sistema cargará los datos guardados anteriormente para que solo deba modificar lo necesario y volver a guardar.

### ¿Qué pasa si no hay conexión a internet en alguna actividad en el bosque polaco?
Se recomienda a todos los jefes de unidad y participantes portar una copia física impresa de la ficha médica tri-lingüe generada por el sistema junto a su pasaporte.

---
*Documento emitido por el Equipo de Gestión del Contingente Nacional (CMT) • Asociación de Guías y Scouts de Chile.*
