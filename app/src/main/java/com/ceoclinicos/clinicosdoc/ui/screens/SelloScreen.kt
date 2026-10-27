package com.ceoclinicos.clinicosdoc.ui.screens

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.util.Base64
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Image
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Approval
import androidx.compose.material.icons.outlined.Image
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.canhub.cropper.CropImageContract
import com.canhub.cropper.CropImageContractOptions
import com.canhub.cropper.CropImageOptions
import com.canhub.cropper.CropImageView
import com.ceoclinicos.clinicosdoc.data.SelloMedico
import com.ceoclinicos.clinicosdoc.data.SelloStorage
import com.ceoclinicos.clinicosdoc.ui.components.AppScaffold
import com.ceoclinicos.clinicosdoc.ui.theme.DividerColor
import com.ceoclinicos.clinicosdoc.ui.theme.Teal
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File

@Composable
fun SelloScreen(onBack: () -> Unit = {}) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var sello by remember { mutableStateOf(SelloStorage.load(context)) }
    var saving by remember { mutableStateOf(false) }

    val cropLauncher = rememberLauncherForActivityResult(CropImageContract()) { result ->
        if (!result.isSuccessful) return@rememberLauncherForActivityResult
        val uri = result.uriContent ?: return@rememberLauncherForActivityResult
        saving = true
        scope.launch {
            runCatching {
                withContext(Dispatchers.IO) { SelloStorage.saveFromUri(context, uri) }
            }.fold(
                onSuccess = { sello = it },
                onFailure = { e ->
                    Toast.makeText(
                        context,
                        e.message ?: "No se pudo cargar la imagen",
                        Toast.LENGTH_LONG,
                    ).show()
                },
            )
            saving = false
        }
    }

    val imagePicker = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri: Uri? ->
        uri ?: return@rememberLauncherForActivityResult
        cropLauncher.launch(
            CropImageContractOptions(
                uri,
                CropImageOptions(
                    cropShape = CropImageView.CropShape.RECTANGLE,
                    guidelines = CropImageView.Guidelines.ON,
                    outputRequestWidth = 1024,
                    outputRequestHeight = 1024,
                    outputRequestSizeOptions = CropImageView.RequestSizeOptions.RESIZE_INSIDE,
                    outputCompressFormat = Bitmap.CompressFormat.JPEG,
                    outputCompressQuality = 95,
                    activityTitle = "Ajustar sello",
                ),
            ),
        )
    }

    AppScaffold(title = "Sello médico", onBack = onBack) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 24.dp, vertical = 16.dp),
        ) {
            SelloPreview(sello)
            Spacer(modifier = Modifier.height(20.dp))
            Text(
                "El sello se imprime centrado al pie de informes e historias clínicas. " +
                    "En cada documento decides con el check \"Incluir sello médico\" si aparece o no.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Spacer(modifier = Modifier.height(20.dp))
            OutlinedButton(
                onClick = { imagePicker.launch("image/*") },
                enabled = !saving,
                modifier = Modifier.fillMaxWidth(),
            ) {
                Icon(Icons.Outlined.Image, contentDescription = null)
                Text(
                    when {
                        saving -> "Cargando sello..."
                        sello == null -> "Subir foto del sello"
                        else -> "Cambiar sello"
                    },
                )
            }
            Text(
                "Puedes hacer zoom y arrastrar la foto para encuadrar el sello antes de guardarla.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(top = 6.dp),
            )
            if (sello != null) {
                TextButton(
                    onClick = {
                        SelloStorage.clear(context)
                        sello = null
                    },
                ) {
                    Text("Quitar sello")
                }
            }
        }
    }
}

@Composable
private fun SelloPreview(sello: SelloMedico?) {
    val bitmap = remember(sello) {
        sello?.path?.takeIf { File(it).exists() }?.let { BitmapFactory.decodeFile(it) }
            ?: sello?.base64?.let { b64 ->
                runCatching {
                    val bytes = Base64.decode(b64, Base64.DEFAULT)
                    BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
                }.getOrNull()
            }
    }
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(200.dp)
            .border(1.dp, DividerColor, RoundedCornerShape(16.dp))
            .clip(RoundedCornerShape(16.dp)),
        contentAlignment = Alignment.Center,
    ) {
        if (bitmap != null) {
            Image(
                bitmap = bitmap.asImageBitmap(),
                contentDescription = "Sello médico",
                modifier = Modifier.size(160.dp),
                contentScale = ContentScale.Fit,
            )
        } else {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Icon(
                    Icons.Outlined.Approval,
                    contentDescription = null,
                    tint = Teal.copy(alpha = 0.5f),
                    modifier = Modifier.size(48.dp),
                )
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    "Sin sello cargado",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    textAlign = TextAlign.Center,
                )
            }
        }
    }
}
