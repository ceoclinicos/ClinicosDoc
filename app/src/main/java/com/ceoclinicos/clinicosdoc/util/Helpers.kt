package com.ceoclinicos.clinicosdoc.util

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.content.ContextCompat
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId

object PermissionHelper {
    fun hasMicrophone(context: Context): Boolean =
        ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) ==
            PackageManager.PERMISSION_GRANTED

    fun hasPhotos(context: Context): Boolean =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            ContextCompat.checkSelfPermission(context, Manifest.permission.READ_MEDIA_IMAGES) ==
                PackageManager.PERMISSION_GRANTED
        } else {
            ContextCompat.checkSelfPermission(context, Manifest.permission.READ_EXTERNAL_STORAGE) ==
                PackageManager.PERMISSION_GRANTED
        }

    fun openAppSettings(context: Context) {
        context.startActivity(
            Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                data = Uri.fromParts("package", context.packageName, null)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            },
        )
    }
}

object PatientUtils {
    /** Convierte Instant a LocalDate sin usar LocalDate.ofInstant (requiere API 33+). */
    fun toLocalDate(instant: Instant, zone: ZoneId = ZoneId.systemDefault()): LocalDate =
        instant.atZone(zone).toLocalDate()

    fun calcAge(birth: Instant, zone: ZoneId = ZoneId.systemDefault()): Int {
        val birthDate = toLocalDate(birth, zone)
        val now = LocalDate.now(zone)
        var age = now.year - birthDate.year
        if (now.monthValue < birthDate.monthValue ||
            (now.monthValue == birthDate.monthValue && now.dayOfMonth < birthDate.dayOfMonth)
        ) {
            age--
        }
        return age
    }
}
