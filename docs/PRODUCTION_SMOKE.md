# Smoke de producción — Clínicos Doc

Reglas Firestore: **no requieren plan de pago** (Spark/Blaze igual). Desplegar con:

```bash
firebase deploy --only firestore:rules
```

(Desde la raíz del repo, proyecto Firebase correcto.)

---

## A. Seguridad (tras desplegar reglas)

- [ ] Médico A no ve invitaciones pendientes de médico B
- [ ] Médico miembro no puede quitar a otro de `members` ni borrar plantillas de la clínica
- [ ] Clínica solo administra su propio `clinicId` (uid = clinicId)
- [ ] Unirse por código sigue funcionando (invite con campo `nombre`)

## B. Flujo clínica → médico → informe

1. [ ] Registrar / login clínica (web)
2. [ ] Equipo: invitar médico por cédula → aparece en **Invitaciones pendientes** (vence ~7 días)
3. [ ] Médico (app o web Configuración → Centros): ve invitación → **Aceptar**
4. [ ] Clínica: médico pasa a **Médicos vinculados**
5. [ ] Médico: Redactar → origen = clínica → plantilla institucional
6. [ ] Guardar / PDF; en panel clínica el paciente/informe aparece
7. [ ] Médico: plantillas personales siguen disponibles

## C. Caducidad / rechazo

- [ ] Rechazar invitación → desaparece de lista clínica
- [ ] (Opcional) Invitación >7 días sin aceptar → desaparece al refrescar Equipo

## D. API / entorno

- [ ] `VITE_API_BASE` / app apuntan a API prod
- [ ] `POST /api/clinic-memberships` con token médico → `memberships` tras aceptar
- [ ] Login médico y clínica emiten claim `role` + `cedula`/`rif`

## E. Criterio de listo

Pasar **A + B** con 1 clínica y 1 médico reales de prueba. Luego piloto externo.
