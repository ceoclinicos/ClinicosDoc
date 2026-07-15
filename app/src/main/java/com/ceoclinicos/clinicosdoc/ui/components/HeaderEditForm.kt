package com.ceoclinicos.clinicosdoc.ui.components

import android.net.Uri
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Image
import androidx.compose.material.icons.outlined.Label
import androidx.compose.material.icons.outlined.MedicalServices
import androidx.compose.material.icons.outlined.Notes
import androidx.compose.material.icons.outlined.Person
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import com.ceoclinicos.clinicosdoc.data.HeaderStorage
import com.ceoclinicos.clinicosdoc.model.DocumentHeader
import com.ceoclinicos.clinicosdoc.model.HeaderType
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HeaderEditForm(
    headerId: String,
    onSaved: (DocumentHeader) -> Unit,
    onCancel: (() -> Unit)? = null,
    modifier: Modifier = Modifier,
    saveButtonLabel: String = "Guardar encabezado",
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var header by remember(headerId) { mutableStateOf<DocumentHeader?>(null) }
    var name by remember(headerId) { mutableStateOf("") }
    var headerType by remember(headerId) { mutableStateOf(HeaderType.MEDICO) }
    var doctorName by remember(headerId) { mutableStateOf("") }
    var subtitle by remember(headerId) { mutableStateOf("") }
    var description by remember(headerId) { mutableStateOf("") }
    var logoPath by remember(headerId) { mutableStateOf<String?>(null) }
    var logoBase64 by remember(headerId) { mutableStateOf<String?>(null) }
    var isDefault by remember(headerId) { mutableStateOf(false) }
    var savingLogo by remember { mutableStateOf(false) }

    val imagePicker = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri: Uri? ->
        if (uri == null) return@rememberLauncherForActivityResult
        savingLogo = true
        scope.launch {
            runCatching {
                withContext(Dispatchers.IO) {
                    HeaderStorage.persistLogo(context, uri, headerId)
                }
            }.fold(
                onSuccess = { result ->
                    logoPath = result.path
                    logoBase64 = result.base64
                },
                onFailure = { e ->
                    Toast.makeText(
                        context,
                        e.message ?: "No se pudo cargar la imagen",
                        Toast.LENGTH_LONG,
                    ).show()
                },
            )
            savingLogo = false
        }
    }

    fun bindHeader(h: DocumentHeader) {
        header = h
        name = h.name
        headerType = h.headerType
        doctorName = h.doctorName
        subtitle = h.subtitle
        description = h.description
        logoPath = h.logoPath
        logoBase64 = h.logoBase64
        isDefault = h.isDefault
    }

    LaunchedEffect(headerId) {
        HeaderStorage.findById(context, headerId)?.let { bindHeader(it) }
    }

    fun buildHeader(): DocumentHeader? = header?.copy(
        name = name.trim(),
        headerType = headerType,
        doctorName = doctorName.trim(),
        subtitle = subtitle.trim(),
        description = description.trim(),
        logoPath = logoPath,
        logoBase64 = logoBase64,
        isDefault = isDefault,
        infoLines = emptyList(),
    )

    val titleLabel = if (headerType == HeaderType.CLINICA) {
        "Texto principal — nombre de la clínica *"
    } else {
        "Texto principal — nombre del médico *"
    }
    val subtitleLabel = if (headerType == HeaderType.CLINICA) {
        "Texto secundario (servicios, opcional)"
    } else {
        "Texto secundario (especialidad, opcional)"
    }

    Column(modifier = modifier.fillMaxWidth()) {
        buildHeader()?.let { HeaderPreview(header = it) }
        Spacer(modifier = Modifier.height(16.dp))

        Text("Tipo de encabezado", style = MaterialTheme.typography.labelLarge)
        Spacer(modifier = Modifier.height(8.dp))
        SingleChoiceSegmentedButtonRow(modifier = Modifier.fillMaxWidth()) {
            HeaderType.entries.forEachIndexed { index, type ->
                SegmentedButton(
                    selected = headerType == type,
                    onClick = { headerType = type },
                    shape = SegmentedButtonDefaults.itemShape(index = index, count = HeaderType.entries.size),
                ) { Text(type.label) }
            }
        }

        Spacer(modifier = Modifier.height(16.dp))
        PremiumTextField("Nombre interno", name, { name = it }, prefixIcon = Icons.Outlined.Label)
        Spacer(modifier = Modifier.height(16.dp))
        OutlinedButton(
            onClick = { imagePicker.launch("image/*") },
            enabled = !savingLogo,
        ) {
            androidx.compose.material3.Icon(Icons.Outlined.Image, contentDescription = null)
            Text(
                when {
                    savingLogo -> "Cargando imagen..."
                    logoPath == null -> "Agregar logo (izquierda)"
                    else -> "Cambiar logo"
                },
            )
        }
        Text(
            "Requisito: imagen cuadrada 256×256 o 512×512 px",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(top = 6.dp),
        )
        if (logoPath != null || logoBase64 != null) {
            TextButton(onClick = {
                logoPath = null
                logoBase64 = null
            }) { Text("Quitar logo") }
        }
        Spacer(modifier = Modifier.height(16.dp))
        PremiumTextField(
            titleLabel,
            doctorName,
            { doctorName = it },
            prefixIcon = Icons.Outlined.Person,
            keyboardOptions = keyboardCapitalizationWords(),
        )
        Spacer(modifier = Modifier.height(16.dp))
        PremiumTextField(subtitleLabel, subtitle, { subtitle = it }, prefixIcon = Icons.Outlined.MedicalServices)
        Spacer(modifier = Modifier.height(16.dp))
        PremiumTextField(
            "Texto descriptivo (dirección, teléfono, etc., opcional)",
            description,
            { description = it },
            prefixIcon = Icons.Outlined.Notes,
            singleLine = false,
            maxLines = 5,
        )
        Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Column(modifier = Modifier.weight(1f)) { Text("Encabezado predeterminado") }
            Switch(checked = isDefault, onCheckedChange = { isDefault = it })
        }
        Spacer(modifier = Modifier.height(16.dp))
        PremiumPrimaryButton(
            label = saveButtonLabel,
            onClick = {
                val h = buildHeader() ?: return@PremiumPrimaryButton
                if (h.name.isBlank() || h.doctorName.isBlank()) {
                    Toast.makeText(context, "Completa el nombre interno y el texto principal", Toast.LENGTH_SHORT).show()
                    return@PremiumPrimaryButton
                }
                scope.launch {
                    val saved = withContext(Dispatchers.IO) {
                        HeaderStorage.upsert(context, h)
                    }
                    bindHeader(saved)
                    Toast.makeText(context, "Encabezado guardado", Toast.LENGTH_SHORT).show()
                    onSaved(saved)
                }
            },
        )
        onCancel?.let { cancel ->
            TextButton(onClick = cancel, modifier = Modifier.padding(top = 4.dp)) {
                Text("Cerrar edición")
            }
        }
    }
}
