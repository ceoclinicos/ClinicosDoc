package com.ceoclinicos.clinicosdoc.ui.navigation

object Routes {
    const val AUTH = "auth"
    const val MAIN = "main"
    const val SETTINGS = "settings"
    const val TEMPLATES = "templates"
    const val TEMPLATES_RECETAS = "templates_recetas"
    const val PLANTILLAS_HUB = "plantillas_hub"
    const val PHYSICAL_EXAM_CATALOG = "physical_exam_catalog"
    const val TEMPLATE_EDIT = "template_edit/{templateId}/{isNew}"
    const val HEADERS = "headers"
    const val HEADER_EDIT = "header_edit/{headerId}/{isNew}"
    const val ADD_PATIENT = "add_patient"
    const val ADD_APPOINTMENT = "add_appointment"
    const val INFORME_DETAIL = "informe_detail/{docId}"
    const val GENERAR_ORDENES = "generar_ordenes"

    fun informeDetail(docId: String) = "informe_detail/$docId"
    const val DRAFTS = "drafts"
    const val REDACTAR = "redactar/{docType}/{templateId}/{headerId}/{draftId}"

    fun templateEdit(templateId: String, isNew: Boolean) =
        "template_edit/$templateId/$isNew"

    fun headerEdit(headerId: String, isNew: Boolean) =
        "header_edit/$headerId/$isNew"

    fun redactar(
        docType: String,
        templateId: String,
        headerId: String,
        draftId: String = "_none_",
    ) = "redactar/$docType/$templateId/$headerId/$draftId"
}
