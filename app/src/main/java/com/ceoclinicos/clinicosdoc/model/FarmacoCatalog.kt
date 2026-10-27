package com.ceoclinicos.clinicosdoc.model

/**
 * Catálogo local de presentaciones frecuentes (VE / uso ambulatorio).
 * Paridad con web/src/shared/farmaco-catalog.ts
 */
data class FarmacoCatalogItem(
    val principioActivo: String,
    val concentracion: String = "",
    val presentacion: String = "Tabletas",
) {
    fun label(): String =
        if (concentracion.isBlank()) "$principioActivo · $presentacion"
        else "$principioActivo $concentracion · $presentacion"
}

object FarmacoCatalog {
    val items: List<FarmacoCatalogItem> = listOf(
        FarmacoCatalogItem("Acetaminofén", "500 mg", "Tabletas"),
        FarmacoCatalogItem("Acetaminofén", "650 mg", "Tabletas"),
        FarmacoCatalogItem("Acetaminofén", "1 g", "Tabletas"),
        FarmacoCatalogItem("Acetaminofén", "120 mg/5 ml", "Suspensión"),
        FarmacoCatalogItem("Acetaminofén", "160 mg/5 ml", "Suspensión"),
        FarmacoCatalogItem("Ibuprofeno", "400 mg", "Tabletas"),
        FarmacoCatalogItem("Ibuprofeno", "600 mg", "Tabletas"),
        FarmacoCatalogItem("Ibuprofeno", "800 mg", "Tabletas"),
        FarmacoCatalogItem("Ibuprofeno", "100 mg/5 ml", "Suspensión"),
        FarmacoCatalogItem("Diclofenaco", "50 mg", "Tabletas"),
        FarmacoCatalogItem("Diclofenaco", "75 mg", "Inyectable"),
        FarmacoCatalogItem("Naproxeno", "250 mg", "Tabletas"),
        FarmacoCatalogItem("Naproxeno", "500 mg", "Tabletas"),
        FarmacoCatalogItem("Ketoprofeno", "100 mg", "Cápsulas"),
        FarmacoCatalogItem("Tramadol", "50 mg", "Cápsulas"),
        FarmacoCatalogItem("Tramadol", "100 mg", "Inyectable"),
        FarmacoCatalogItem("Amoxicilina", "500 mg", "Cápsulas"),
        FarmacoCatalogItem("Amoxicilina", "875 mg", "Tabletas"),
        FarmacoCatalogItem("Amoxicilina", "250 mg/5 ml", "Suspensión"),
        FarmacoCatalogItem("Amoxicilina + Ácido Clavulánico", "875 mg / 125 mg", "Tabletas"),
        FarmacoCatalogItem("Amoxicilina + Ácido Clavulánico", "500 mg / 125 mg", "Tabletas"),
        FarmacoCatalogItem("Amoxicilina + Ácido Clavulánico", "400 mg / 57 mg / 5 ml", "Suspensión"),
        FarmacoCatalogItem("Azitromicina", "500 mg", "Tabletas"),
        FarmacoCatalogItem("Azitromicina", "200 mg/5 ml", "Suspensión"),
        FarmacoCatalogItem("Ciprofloxacina", "500 mg", "Tabletas"),
        FarmacoCatalogItem("Levofloxacina", "500 mg", "Tabletas"),
        FarmacoCatalogItem("Cefalexina", "500 mg", "Cápsulas"),
        FarmacoCatalogItem("Cefalexina", "250 mg/5 ml", "Suspensión"),
        FarmacoCatalogItem("Ceftriaxona", "1 g", "Inyectable"),
        FarmacoCatalogItem("Metronidazol", "500 mg", "Tabletas"),
        FarmacoCatalogItem("Metronidazol", "250 mg/5 ml", "Suspensión"),
        FarmacoCatalogItem("Claritromicina", "500 mg", "Tabletas"),
        FarmacoCatalogItem("Doxiciclina", "100 mg", "Cápsulas"),
        FarmacoCatalogItem("Trimetoprima + Sulfametoxazol", "160 mg / 800 mg", "Tabletas"),
        FarmacoCatalogItem("Trimetoprima + Sulfametoxazol", "40 mg / 200 mg / 5 ml", "Suspensión"),
        FarmacoCatalogItem("Nitrofurantoína", "100 mg", "Cápsulas"),
        FarmacoCatalogItem("Clindamicina", "300 mg", "Cápsulas"),
        FarmacoCatalogItem("Loratadina", "10 mg", "Tabletas"),
        FarmacoCatalogItem("Loratadina", "5 mg/5 ml", "Jarabe"),
        FarmacoCatalogItem("Cetirizina", "10 mg", "Tabletas"),
        FarmacoCatalogItem("Cetirizina", "5 mg/5 ml", "Jarabe"),
        FarmacoCatalogItem("Desloratadina", "5 mg", "Tabletas"),
        FarmacoCatalogItem("Clorfenamina", "4 mg", "Tabletas"),
        FarmacoCatalogItem("Difenhidramina", "25 mg", "Cápsulas"),
        FarmacoCatalogItem("Salbutamol", "100 mcg", "Inhalador"),
        FarmacoCatalogItem("Salbutamol", "2 mg/5 ml", "Jarabe"),
        FarmacoCatalogItem("Budesonida", "200 mcg", "Inhalador"),
        FarmacoCatalogItem("Montelukast", "10 mg", "Tabletas"),
        FarmacoCatalogItem("Montelukast", "5 mg", "Tabletas"),
        FarmacoCatalogItem("Ambroxol", "30 mg", "Tabletas"),
        FarmacoCatalogItem("Ambroxol", "15 mg/5 ml", "Jarabe"),
        FarmacoCatalogItem("Dextrometorfano", "15 mg/5 ml", "Jarabe"),
        FarmacoCatalogItem("Prednisona", "5 mg", "Tabletas"),
        FarmacoCatalogItem("Prednisona", "20 mg", "Tabletas"),
        FarmacoCatalogItem("Prednisona", "50 mg", "Tabletas"),
        FarmacoCatalogItem("Dexametasona", "4 mg", "Tabletas"),
        FarmacoCatalogItem("Dexametasona", "4 mg/ml", "Inyectable"),
        FarmacoCatalogItem("Hidrocortisona", "100 mg", "Inyectable"),
        FarmacoCatalogItem("Omeprazol", "20 mg", "Cápsulas"),
        FarmacoCatalogItem("Omeprazol", "40 mg", "Cápsulas"),
        FarmacoCatalogItem("Pantoprazol", "40 mg", "Tabletas"),
        FarmacoCatalogItem("Esomeprazol", "40 mg", "Tabletas"),
        FarmacoCatalogItem("Ranitidina", "150 mg", "Tabletas"),
        FarmacoCatalogItem("Domperidona", "10 mg", "Tabletas"),
        FarmacoCatalogItem("Metoclopramida", "10 mg", "Tabletas"),
        FarmacoCatalogItem("Metoclopramida", "10 mg/2 ml", "Inyectable"),
        FarmacoCatalogItem("Ondansetrón", "8 mg", "Tabletas"),
        FarmacoCatalogItem("Loperamida", "2 mg", "Cápsulas"),
        FarmacoCatalogItem("Hioscina butilbromuro", "10 mg", "Tabletas"),
        FarmacoCatalogItem("Hioscina butilbromuro", "20 mg/ml", "Inyectable"),
        FarmacoCatalogItem("Lactulosa", "3,3 g/5 ml", "Jarabe"),
        FarmacoCatalogItem("Sales de rehidratación oral", "", "Sobres"),
        FarmacoCatalogItem("Losartán", "50 mg", "Tabletas"),
        FarmacoCatalogItem("Losartán", "100 mg", "Tabletas"),
        FarmacoCatalogItem("Enalapril", "10 mg", "Tabletas"),
        FarmacoCatalogItem("Enalapril", "20 mg", "Tabletas"),
        FarmacoCatalogItem("Amlodipino", "5 mg", "Tabletas"),
        FarmacoCatalogItem("Amlodipino", "10 mg", "Tabletas"),
        FarmacoCatalogItem("Atenolol", "50 mg", "Tabletas"),
        FarmacoCatalogItem("Metoprolol", "50 mg", "Tabletas"),
        FarmacoCatalogItem("Hidroclorotiazida", "25 mg", "Tabletas"),
        FarmacoCatalogItem("Furosemida", "40 mg", "Tabletas"),
        FarmacoCatalogItem("Espironolactona", "25 mg", "Tabletas"),
        FarmacoCatalogItem("Ácido acetilsalicílico", "100 mg", "Tabletas"),
        FarmacoCatalogItem("Clopidogrel", "75 mg", "Tabletas"),
        FarmacoCatalogItem("Atorvastatina", "20 mg", "Tabletas"),
        FarmacoCatalogItem("Atorvastatina", "40 mg", "Tabletas"),
        FarmacoCatalogItem("Metformina", "850 mg", "Tabletas"),
        FarmacoCatalogItem("Metformina", "500 mg", "Tabletas"),
        FarmacoCatalogItem("Glibenclamida", "5 mg", "Tabletas"),
        FarmacoCatalogItem("Insulina NPH", "100 UI/ml", "Inyectable"),
        FarmacoCatalogItem("Insulina regular", "100 UI/ml", "Inyectable"),
        FarmacoCatalogItem("Hierro (sulfato ferroso)", "325 mg", "Tabletas"),
        FarmacoCatalogItem("Ácido fólico", "5 mg", "Tabletas"),
        FarmacoCatalogItem("Complejo B", "", "Tabletas"),
        FarmacoCatalogItem("Vitamina C", "500 mg", "Tabletas"),
        FarmacoCatalogItem("Vitamina D3", "1000 UI", "Cápsulas"),
        FarmacoCatalogItem("Calcio carbonato", "500 mg", "Tabletas"),
        FarmacoCatalogItem("Albendazol", "400 mg", "Tabletas"),
        FarmacoCatalogItem("Ivermectina", "6 mg", "Tabletas"),
        FarmacoCatalogItem("Fluconazol", "150 mg", "Cápsulas"),
        FarmacoCatalogItem("Nistatina", "100.000 UI/ml", "Suspensión"),
        FarmacoCatalogItem("Clotrimazol", "1 %", "Crema"),
        FarmacoCatalogItem("Miconazol", "2 %", "Crema"),
        FarmacoCatalogItem("Hidrocortisona", "1 %", "Crema"),
        FarmacoCatalogItem("Betametasona", "0,05 %", "Crema"),
        FarmacoCatalogItem("Diclofenaco", "1 %", "Gel"),
        FarmacoCatalogItem("Óvulos de clotrimazol", "500 mg", "Óvulos"),
        FarmacoCatalogItem("Levotiroxina", "50 mcg", "Tabletas"),
        FarmacoCatalogItem("Levotiroxina", "100 mcg", "Tabletas"),
        FarmacoCatalogItem("Sertralina", "50 mg", "Tabletas"),
        FarmacoCatalogItem("Alprazolam", "0,5 mg", "Tabletas"),
        FarmacoCatalogItem("Clonazepam", "2 mg", "Tabletas"),
        FarmacoCatalogItem("Diazepam", "10 mg", "Tabletas"),
    )

    private fun fold(s: String): String =
        s.lowercase()
            .replace('á', 'a').replace('é', 'e').replace('í', 'i')
            .replace('ó', 'o').replace('ú', 'u').replace('ü', 'u').replace('ñ', 'n')
            .replace(Regex("\\s+"), " ")
            .trim()

    fun search(query: String, limit: Int = 25): List<FarmacoCatalogItem> {
        val q = fold(query)
        if (q.isBlank()) return items.take(limit)
        val tokens = q.split(" ").filter { it.isNotBlank() }
        return items.mapNotNull { item ->
            val hay = fold("${item.principioActivo} ${item.concentracion} ${item.presentacion}")
            var score = 0
            if (hay.startsWith(q)) score += 40
            if (fold(item.principioActivo).startsWith(q)) score += 30
            for (t in tokens) {
                if (!hay.contains(t)) return@mapNotNull null
                score += 10
            }
            item to score
        }
            .sortedWith(compareByDescending<Pair<FarmacoCatalogItem, Int>> { it.second }
                .thenBy { it.first.principioActivo })
            .take(limit)
            .map { it.first }
    }
}
