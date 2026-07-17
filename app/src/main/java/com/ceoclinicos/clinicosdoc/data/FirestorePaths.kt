package com.ceoclinicos.clinicosdoc.data

/**
 * Colecciones de ClinicosDoc en Firebase (proyecto compartido).
 * Datos clínicos bajo clinicosdoc_user/{userId}/...
 */
object FirestorePaths {
    const val PREFIX = "clinicosdoc_"

    /** Perfil del médico (documento = id de usuario en login actual). */
    const val USERS = "${PREFIX}user"

    const val SUB_PATIENTS = "patients"
    const val SUB_DOCUMENTS = "documents"
    const val SUB_APPOINTMENTS = "appointments"
    const val SUB_TEMPLATES = "templates"
    const val SUB_HEADERS = "headers"
    const val SUB_PHYSICAL_EXAM = "physical_exam_systems"
    /** Borradores de Redactar (sync app ↔ web). */
    const val SUB_DRAFTS = "drafts"

    /**
     * Registro global de pacientes (compartido entre médicos).
     * Documento = `{cedula}_{nombre}` ej. `23536843_jhonnoriega`
     * Subcolección `documents` = informes de todos los médicos para ese paciente.
     */
    const val GLOBAL_PATIENTS = "${PREFIX}patients"

    /** Registro portal pacientes (modo paciente / ficha emergencia). */
    const val PORTAL_PACIENTES = "pacientes"
    const val FICHAS_EMERGENCIA = "fichas_emergencia"
    const val FICHAS_EMERGENCIA_CEDULA = "fichas_emergencia_cedula"

    // Colecciones planas legadas (no usar en sync nuevo):
    const val DOCUMENTS = "${PREFIX}documents"
    const val APPOINTMENTS = "${PREFIX}appointments"
    const val TEMPLATES = "${PREFIX}templates"
    const val HEADERS = "${PREFIX}headers"
}
