package com.ceoclinicos.clinicosdoc.data

import android.content.SharedPreferences

/** Escritura síncrona para no perder datos al salir de la app de inmediato. */
internal fun SharedPreferences.Editor.persist(): Boolean = commit()
