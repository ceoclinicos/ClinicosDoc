/** Catálogo local de presentaciones frecuentes (VE / uso ambulatorio). */
export interface FarmacoCatalogItem {
  principioActivo: string;
  concentracion: string;
  presentacion: string;
}

export function formatFarmacoCatalogLabel(item: FarmacoCatalogItem): string {
  const conc = item.concentracion.trim();
  return conc
    ? `${item.principioActivo} ${conc} · ${item.presentacion}`
    : `${item.principioActivo} · ${item.presentacion}`;
}

function fold(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Presentaciones habituales (~100). Primer resultado de búsqueda se antepone «Otros…» en UI. */
export const FARMACO_CATALOG: FarmacoCatalogItem[] = [
  // Analgésicos / antipiréticos
  { principioActivo: "Acetaminofén", concentracion: "500 mg", presentacion: "Tabletas" },
  { principioActivo: "Acetaminofén", concentracion: "650 mg", presentacion: "Tabletas" },
  { principioActivo: "Acetaminofén", concentracion: "1 g", presentacion: "Tabletas" },
  { principioActivo: "Acetaminofén", concentracion: "120 mg/5 ml", presentacion: "Suspensión" },
  { principioActivo: "Acetaminofén", concentracion: "160 mg/5 ml", presentacion: "Suspensión" },
  { principioActivo: "Ibuprofeno", concentracion: "400 mg", presentacion: "Tabletas" },
  { principioActivo: "Ibuprofeno", concentracion: "600 mg", presentacion: "Tabletas" },
  { principioActivo: "Ibuprofeno", concentracion: "800 mg", presentacion: "Tabletas" },
  { principioActivo: "Ibuprofeno", concentracion: "100 mg/5 ml", presentacion: "Suspensión" },
  { principioActivo: "Diclofenaco", concentracion: "50 mg", presentacion: "Tabletas" },
  { principioActivo: "Diclofenaco", concentracion: "75 mg", presentacion: "Inyectable" },
  { principioActivo: "Naproxeno", concentracion: "250 mg", presentacion: "Tabletas" },
  { principioActivo: "Naproxeno", concentracion: "500 mg", presentacion: "Tabletas" },
  { principioActivo: "Ketoprofeno", concentracion: "100 mg", presentacion: "Cápsulas" },
  { principioActivo: "Tramadol", concentracion: "50 mg", presentacion: "Cápsulas" },
  { principioActivo: "Tramadol", concentracion: "100 mg", presentacion: "Inyectable" },

  // Antibióticos
  { principioActivo: "Amoxicilina", concentracion: "500 mg", presentacion: "Cápsulas" },
  { principioActivo: "Amoxicilina", concentracion: "875 mg", presentacion: "Tabletas" },
  { principioActivo: "Amoxicilina", concentracion: "250 mg/5 ml", presentacion: "Suspensión" },
  { principioActivo: "Amoxicilina + Ácido Clavulánico", concentracion: "875 mg / 125 mg", presentacion: "Tabletas" },
  { principioActivo: "Amoxicilina + Ácido Clavulánico", concentracion: "500 mg / 125 mg", presentacion: "Tabletas" },
  { principioActivo: "Amoxicilina + Ácido Clavulánico", concentracion: "400 mg / 57 mg / 5 ml", presentacion: "Suspensión" },
  { principioActivo: "Azitromicina", concentracion: "500 mg", presentacion: "Tabletas" },
  { principioActivo: "Azitromicina", concentracion: "200 mg/5 ml", presentacion: "Suspensión" },
  { principioActivo: "Ciprofloxacina", concentracion: "500 mg", presentacion: "Tabletas" },
  { principioActivo: "Levofloxacina", concentracion: "500 mg", presentacion: "Tabletas" },
  { principioActivo: "Cefalexina", concentracion: "500 mg", presentacion: "Cápsulas" },
  { principioActivo: "Cefalexina", concentracion: "250 mg/5 ml", presentacion: "Suspensión" },
  { principioActivo: "Ceftriaxona", concentracion: "1 g", presentacion: "Inyectable" },
  { principioActivo: "Metronidazol", concentracion: "500 mg", presentacion: "Tabletas" },
  { principioActivo: "Metronidazol", concentracion: "250 mg/5 ml", presentacion: "Suspensión" },
  { principioActivo: "Claritromicina", concentracion: "500 mg", presentacion: "Tabletas" },
  { principioActivo: "Doxiciclina", concentracion: "100 mg", presentacion: "Cápsulas" },
  { principioActivo: "Trimetoprima + Sulfametoxazol", concentracion: "160 mg / 800 mg", presentacion: "Tabletas" },
  { principioActivo: "Trimetoprima + Sulfametoxazol", concentracion: "40 mg / 200 mg / 5 ml", presentacion: "Suspensión" },
  { principioActivo: "Nitrofurantoína", concentracion: "100 mg", presentacion: "Cápsulas" },
  { principioActivo: "Clindamicina", concentracion: "300 mg", presentacion: "Cápsulas" },

  // Respiratorio / antialérgico
  { principioActivo: "Loratadina", concentracion: "10 mg", presentacion: "Tabletas" },
  { principioActivo: "Loratadina", concentracion: "5 mg/5 ml", presentacion: "Jarabe" },
  { principioActivo: "Cetirizina", concentracion: "10 mg", presentacion: "Tabletas" },
  { principioActivo: "Cetirizina", concentracion: "5 mg/5 ml", presentacion: "Jarabe" },
  { principioActivo: "Desloratadina", concentracion: "5 mg", presentacion: "Tabletas" },
  { principioActivo: "Clorfenamina", concentracion: "4 mg", presentacion: "Tabletas" },
  { principioActivo: "Difenhidramina", concentracion: "25 mg", presentacion: "Cápsulas" },
  { principioActivo: "Salbutamol", concentracion: "100 mcg", presentacion: "Inhalador" },
  { principioActivo: "Salbutamol", concentracion: "2 mg/5 ml", presentacion: "Jarabe" },
  { principioActivo: "Budesonida", concentracion: "200 mcg", presentacion: "Inhalador" },
  { principioActivo: "Montelukast", concentracion: "10 mg", presentacion: "Tabletas" },
  { principioActivo: "Montelukast", concentracion: "5 mg", presentacion: "Tabletas" },
  { principioActivo: "Ambroxol", concentracion: "30 mg", presentacion: "Tabletas" },
  { principioActivo: "Ambroxol", concentracion: "15 mg/5 ml", presentacion: "Jarabe" },
  { principioActivo: "Dextrometorfano", concentracion: "15 mg/5 ml", presentacion: "Jarabe" },
  { principioActivo: "Prednisona", concentracion: "5 mg", presentacion: "Tabletas" },
  { principioActivo: "Prednisona", concentracion: "20 mg", presentacion: "Tabletas" },
  { principioActivo: "Prednisona", concentracion: "50 mg", presentacion: "Tabletas" },
  { principioActivo: "Dexametasona", concentracion: "4 mg", presentacion: "Tabletas" },
  { principioActivo: "Dexametasona", concentracion: "4 mg/ml", presentacion: "Inyectable" },
  { principioActivo: "Hidrocortisona", concentracion: "100 mg", presentacion: "Inyectable" },

  // GI
  { principioActivo: "Omeprazol", concentracion: "20 mg", presentacion: "Cápsulas" },
  { principioActivo: "Omeprazol", concentracion: "40 mg", presentacion: "Cápsulas" },
  { principioActivo: "Pantoprazol", concentracion: "40 mg", presentacion: "Tabletas" },
  { principioActivo: "Esomeprazol", concentracion: "40 mg", presentacion: "Tabletas" },
  { principioActivo: "Ranitidina", concentracion: "150 mg", presentacion: "Tabletas" },
  { principioActivo: "Domperidona", concentracion: "10 mg", presentacion: "Tabletas" },
  { principioActivo: "Metoclopramida", concentracion: "10 mg", presentacion: "Tabletas" },
  { principioActivo: "Metoclopramida", concentracion: "10 mg/2 ml", presentacion: "Inyectable" },
  { principioActivo: "Ondansetrón", concentracion: "8 mg", presentacion: "Tabletas" },
  { principioActivo: "Loperamida", concentracion: "2 mg", presentacion: "Cápsulas" },
  { principioActivo: "Hioscina butilbromuro", concentracion: "10 mg", presentacion: "Tabletas" },
  { principioActivo: "Hioscina butilbromuro", concentracion: "20 mg/ml", presentacion: "Inyectable" },
  { principioActivo: "Lactulosa", concentracion: "3,3 g/5 ml", presentacion: "Jarabe" },
  { principioActivo: "Sales de rehidratación oral", concentracion: "", presentacion: "Sobres" },

  // Cardiovascular / metabólico
  { principioActivo: "Losartán", concentracion: "50 mg", presentacion: "Tabletas" },
  { principioActivo: "Losartán", concentracion: "100 mg", presentacion: "Tabletas" },
  { principioActivo: "Enalapril", concentracion: "10 mg", presentacion: "Tabletas" },
  { principioActivo: "Enalapril", concentracion: "20 mg", presentacion: "Tabletas" },
  { principioActivo: "Amlodipino", concentracion: "5 mg", presentacion: "Tabletas" },
  { principioActivo: "Amlodipino", concentracion: "10 mg", presentacion: "Tabletas" },
  { principioActivo: "Atenolol", concentracion: "50 mg", presentacion: "Tabletas" },
  { principioActivo: "Metoprolol", concentracion: "50 mg", presentacion: "Tabletas" },
  { principioActivo: "Hidroclorotiazida", concentracion: "25 mg", presentacion: "Tabletas" },
  { principioActivo: "Furosemida", concentracion: "40 mg", presentacion: "Tabletas" },
  { principioActivo: "Espironolactona", concentracion: "25 mg", presentacion: "Tabletas" },
  { principioActivo: "Ácido acetilsalicílico", concentracion: "100 mg", presentacion: "Tabletas" },
  { principioActivo: "Clopidogrel", concentracion: "75 mg", presentacion: "Tabletas" },
  { principioActivo: "Atorvastatina", concentracion: "20 mg", presentacion: "Tabletas" },
  { principioActivo: "Atorvastatina", concentracion: "40 mg", presentacion: "Tabletas" },
  { principioActivo: "Metformina", concentracion: "850 mg", presentacion: "Tabletas" },
  { principioActivo: "Metformina", concentracion: "500 mg", presentacion: "Tabletas" },
  { principioActivo: "Glibenclamida", concentracion: "5 mg", presentacion: "Tabletas" },
  { principioActivo: "Insulina NPH", concentracion: "100 UI/ml", presentacion: "Inyectable" },
  { principioActivo: "Insulina regular", concentracion: "100 UI/ml", presentacion: "Inyectable" },

  // Otros frecuentes
  { principioActivo: "Hierro (sulfato ferroso)", concentracion: "325 mg", presentacion: "Tabletas" },
  { principioActivo: "Ácido fólico", concentracion: "5 mg", presentacion: "Tabletas" },
  { principioActivo: "Complejo B", concentracion: "", presentacion: "Tabletas" },
  { principioActivo: "Vitamina C", concentracion: "500 mg", presentacion: "Tabletas" },
  { principioActivo: "Vitamina D3", concentracion: "1000 UI", presentacion: "Cápsulas" },
  { principioActivo: "Calcio carbonato", concentracion: "500 mg", presentacion: "Tabletas" },
  { principioActivo: "Albendazol", concentracion: "400 mg", presentacion: "Tabletas" },
  { principioActivo: "Ivermectina", concentracion: "6 mg", presentacion: "Tabletas" },
  { principioActivo: "Fluconazol", concentracion: "150 mg", presentacion: "Cápsulas" },
  { principioActivo: "Nistatina", concentracion: "100.000 UI/ml", presentacion: "Suspensión" },
  { principioActivo: "Clotrimazol", concentracion: "1 %", presentacion: "Crema" },
  { principioActivo: "Miconazol", concentracion: "2 %", presentacion: "Crema" },
  { principioActivo: "Hidrocortisona", concentracion: "1 %", presentacion: "Crema" },
  { principioActivo: "Betametasona", concentracion: "0,05 %", presentacion: "Crema" },
  { principioActivo: "Diclofenaco", concentracion: "1 %", presentacion: "Gel" },
  { principioActivo: "Óvulos de clotrimazol", concentracion: "500 mg", presentacion: "Óvulos" },
  { principioActivo: "Levotiroxina", concentracion: "50 mcg", presentacion: "Tabletas" },
  { principioActivo: "Levotiroxina", concentracion: "100 mcg", presentacion: "Tabletas" },
  { principioActivo: "Sertralina", concentracion: "50 mg", presentacion: "Tabletas" },
  { principioActivo: "Alprazolam", concentracion: "0,5 mg", presentacion: "Tabletas" },
  { principioActivo: "Clonazepam", concentracion: "2 mg", presentacion: "Tabletas" },
  { principioActivo: "Diazepam", concentracion: "10 mg", presentacion: "Tabletas" },
];

/** Incluye “Inhalador” aunque no esté en RECETA_PRESENTACIONES base. */
export function searchFarmacoCatalog(query: string, limit = 25): FarmacoCatalogItem[] {
  const q = fold(query);
  if (!q) return FARMACO_CATALOG.slice(0, limit);
  const tokens = q.split(" ").filter(Boolean);
  const scored = FARMACO_CATALOG.map((item) => {
    const hay = fold(`${item.principioActivo} ${item.concentracion} ${item.presentacion}`);
    let score = 0;
    if (hay.startsWith(q)) score += 40;
    if (fold(item.principioActivo).startsWith(q)) score += 30;
    for (const t of tokens) {
      if (hay.includes(t)) score += 10;
      else return { item, score: -1 };
    }
    return { item, score };
  })
    .filter((x) => x.score >= 0)
    .sort((a, b) => b.score - a.score || a.item.principioActivo.localeCompare(b.item.principioActivo, "es"));
  return scored.slice(0, limit).map((x) => x.item);
}
