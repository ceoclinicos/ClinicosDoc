package com.ceoclinicos.clinicosdoc.ui.screens

import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.automirrored.filled.Login
import androidx.compose.material.icons.outlined.Badge
import androidx.compose.material.icons.outlined.CreditCard
import androidx.compose.material.icons.outlined.Lock
import androidx.compose.material.icons.outlined.MedicalServices
import androidx.compose.material.icons.outlined.PhoneAndroid
import androidx.compose.material.icons.outlined.Verified
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.MenuAnchorType
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import com.ceoclinicos.clinicosdoc.data.DoctorStorage
import com.ceoclinicos.clinicosdoc.model.DoctorProfile
import com.ceoclinicos.clinicosdoc.service.DoctorAuthService
import com.ceoclinicos.clinicosdoc.service.MppsValidationService
import com.ceoclinicos.clinicosdoc.ui.components.AppScaffold
import com.ceoclinicos.clinicosdoc.ui.components.PremiumPrimaryButton
import com.ceoclinicos.clinicosdoc.ui.components.PremiumTextField
import com.ceoclinicos.clinicosdoc.ui.components.keyboardCapitalizationWords
import com.ceoclinicos.clinicosdoc.ui.components.keyboardDigits
import com.ceoclinicos.clinicosdoc.ui.components.keyboardPassword
import com.ceoclinicos.clinicosdoc.ui.components.keyboardPhone
import com.ceoclinicos.clinicosdoc.ui.theme.DividerColor
import com.ceoclinicos.clinicosdoc.ui.theme.Teal
import com.ceoclinicos.clinicosdoc.ui.theme.TextSecondary
import com.ceoclinicos.clinicosdoc.util.CedulaNormalizer

import kotlinx.coroutines.launch

private enum class AuthMode { REGISTRO, LOGIN }

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DoctorLoginScreen(onRegistered: () -> Unit) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var authMode by remember { mutableStateOf(AuthMode.REGISTRO) }
    var step by remember { mutableIntStateOf(0) }
    var loading by remember { mutableStateOf(false) }

    var nombre by remember { mutableStateOf("") }
    var cedula by remember { mutableStateOf("") }
    var mpps by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var sexo by remember { mutableStateOf<String?>(null) }
    var especialidad by remember { mutableStateOf<String?>(null) }
    var especialidadOtra by remember { mutableStateOf("") }
    var whatsapp by remember { mutableStateOf("") }

    var nombreError by remember { mutableStateOf<String?>(null) }
    var cedulaError by remember { mutableStateOf<String?>(null) }
    var mppsError by remember { mutableStateOf<String?>(null) }
    var passwordError by remember { mutableStateOf<String?>(null) }
    var whatsappError by remember { mutableStateOf<String?>(null) }

    val firebaseReady = remember(context) { DoctorAuthService.isConfigured(context) }
    val sexos = listOf("Masculino", "Femenino", "Otro")
    val especialidades = listOf(
        "Medicina general", "Medicina interna", "Pediatría", "Ginecología",
        "Cardiología", "Dermatología", "Traumatología", "Neurología",
        "Psiquiatría", "Cirugía general", "Otra",
    )

    fun showToast(msg: String) = Toast.makeText(context, msg, Toast.LENGTH_SHORT).show()

    AppScaffold(
        title = if (authMode == AuthMode.LOGIN) "Iniciar sesión" else "Registro médico",
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 24.dp, vertical = 16.dp),
        ) {
            SingleChoiceSegmentedButtonRow(modifier = Modifier.fillMaxWidth()) {
                SegmentedButton(
                    selected = authMode == AuthMode.REGISTRO,
                    onClick = {
                        authMode = AuthMode.REGISTRO
                        step = 0
                    },
                    shape = SegmentedButtonDefaults.itemShape(index = 0, count = 2),
                ) { Text("Registro") }
                SegmentedButton(
                    selected = authMode == AuthMode.LOGIN,
                    onClick = {
                        authMode = AuthMode.LOGIN
                        step = 0
                    },
                    shape = SegmentedButtonDefaults.itemShape(index = 1, count = 2),
                ) { Text("Login") }
            }

            if (authMode == AuthMode.REGISTRO) {
                Spacer(modifier = Modifier.height(20.dp))
                StepIndicator(currentStep = step)
            }

            Spacer(modifier = Modifier.height(28.dp))
            Text(
                when {
                    authMode == AuthMode.LOGIN -> "Accede a tu cuenta"
                    step == 0 -> "Identificación"
                    else -> "Perfil profesional"
                },
                style = MaterialTheme.typography.headlineLarge,
            )
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                when {
                    authMode == AuthMode.LOGIN -> "Usa tu cédula y contraseña"
                    step == 0 -> "Nombre, cédula, MPPS y contraseña"
                    else -> "Completa tu información de contacto"
                },
                style = MaterialTheme.typography.bodyMedium,
            )
            if (!firebaseReady) {
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    "Firebase no detectado. Verifica google-services.json en app/.",
                    style = MaterialTheme.typography.bodySmall,
                    color = TextSecondary,
                )
            }

            Spacer(modifier = Modifier.height(24.dp))

            when (authMode) {
                AuthMode.LOGIN -> LoginForm(
                    cedula = cedula,
                    onCedulaChange = { cedula = it },
                    password = password,
                    onPasswordChange = { password = it },
                    cedulaError = cedulaError,
                    passwordError = passwordError,
                    loading = loading,
                    onLogin = {
                        cedulaError = when {
                            cedula.isBlank() -> "Ingresa tu cédula"
                            !CedulaNormalizer.isValid(cedula) -> "Cédula inválida"
                            else -> null
                        }
                        passwordError = if (password.isBlank()) "Ingresa tu contraseña" else null
                        if (cedulaError != null || passwordError != null) return@LoginForm

                        if (!firebaseReady) {
                            showToast("Necesitas internet para iniciar sesión")
                            return@LoginForm
                        }

                        loading = true
                        scope.launch {
                            val result = DoctorAuthService.signIn(context, cedula, password)
                            loading = false
                            result.fold(
                                onSuccess = { onRegistered() },
                                onFailure = { showToast(it.message ?: "Error al iniciar sesión") },
                            )
                        }
                    },
                )

                AuthMode.REGISTRO -> when (step) {
                    0 -> RegistrationStep1(
                        nombre = nombre,
                        onNombreChange = { nombre = it },
                        cedula = cedula,
                        onCedulaChange = { cedula = it },
                        mpps = mpps,
                        onMppsChange = { mpps = it.filter { c -> c.isDigit() } },
                        password = password,
                        onPasswordChange = { password = it },
                        nombreError = nombreError,
                        cedulaError = cedulaError,
                        mppsError = mppsError,
                        passwordError = passwordError,
                        loading = loading,
                        onNext = {
                            nombreError = if (nombre.isBlank()) "Ingresa tu nombre" else null
                            cedulaError = when {
                                cedula.isBlank() -> "Ingresa tu cédula"
                                !CedulaNormalizer.isValid(cedula) -> "Cédula inválida"
                                else -> null
                            }
                            mppsError = if (mpps.isBlank()) "Ingresa tu MPPS" else null
                            passwordError = when {
                                password.isBlank() -> "Ingresa tu contraseña"
                                password.length < 4 -> "Mínimo 4 caracteres"
                                else -> null
                            }
                            if (listOf(nombreError, cedulaError, mppsError, passwordError).any { it != null }) {
                                return@RegistrationStep1
                            }
                            loading = true
                            scope.launch {
                                val result = MppsValidationService.validate(cedula, mpps)
                                loading = false
                                result.fold(
                                    onSuccess = { medico ->
                                        mppsError = null
                                        mpps = medico.mpps.filter { it.isDigit() }.ifBlank { mpps }
                                        if (nombre.isBlank() && medico.nombreCompleto.isNotBlank()) {
                                            nombre = medico.nombreCompleto
                                        }
                                        showToast("MPPS verificado: ${medico.profesion}")
                                        step = 1
                                    },
                                    onFailure = {
                                        mppsError = it.message ?: "No se pudo validar MPPS"
                                        showToast(mppsError ?: "Error de validación")
                                    },
                                )
                            }
                        },
                    )

                    else -> RegistrationStep2(
                        sexos = sexos,
                        sexo = sexo,
                        onSexoChange = { sexo = it },
                        especialidades = especialidades,
                        especialidad = especialidad,
                        onEspecialidadChange = { especialidad = it },
                        especialidadOtra = especialidadOtra,
                        onEspecialidadOtraChange = { especialidadOtra = it },
                        whatsapp = whatsapp,
                        onWhatsappChange = { whatsapp = it.filter { c -> c.isDigit() } },
                        whatsappError = whatsappError,
                        loading = loading,
                        onBack = { step = 0 },
                        onFinish = {
                            whatsappError = when {
                                whatsapp.isBlank() -> "Ingresa tu WhatsApp"
                                whatsapp.length < 10 -> "Número inválido"
                                else -> null
                            }
                            if (sexo == null || especialidad == null || whatsappError != null) {
                                if (sexo == null || especialidad == null) {
                                    showToast("Selecciona sexo y especialidad")
                                }
                                return@RegistrationStep2
                            }
                            val especialidadFinal = if (especialidad == "Otra") {
                                especialidadOtra.trim().also {
                                    if (it.isBlank()) {
                                        showToast("Escribe tu especialidad")
                                        return@RegistrationStep2
                                    }
                                }
                            } else {
                                especialidad!!
                            }

                            val profile = DoctorProfile(
                                nombre = nombre.trim(),
                                cedula = cedula.trim(),
                                mpps = mpps.trim(),
                                sexo = sexo!!,
                                especialidad = especialidadFinal,
                                whatsapp = whatsapp.trim(),
                            )

                            loading = true
                            scope.launch {
                                if (firebaseReady) {
                                    val result = DoctorAuthService.register(context, password, profile)
                                    loading = false
                                    result.fold(
                                        onSuccess = { onRegistered() },
                                        onFailure = { showToast(it.message ?: "Error al registrar") },
                                    )
                                } else {
                                    val check = MppsValidationService.validate(profile.cedula, profile.mpps)
                                    if (check.isFailure) {
                                        loading = false
                                        showToast(check.exceptionOrNull()?.message ?: "No se pudo validar MPPS")
                                        return@launch
                                    }
                                    DoctorStorage.saveProfileLocal(context, profile)
                                    loading = false
                                    onRegistered()
                                }
                            }
                        },
                    )
                }
            }

            Spacer(modifier = Modifier.height(24.dp))
        }
    }
}

@Composable
private fun LoginForm(
    cedula: String,
    onCedulaChange: (String) -> Unit,
    password: String,
    onPasswordChange: (String) -> Unit,
    cedulaError: String?,
    passwordError: String?,
    loading: Boolean,
    onLogin: () -> Unit,
) {
    PremiumTextField(
        "Cédula",
        cedula,
        onCedulaChange,
        hint = "Ej. V-12345678",
        prefixIcon = Icons.Outlined.CreditCard,
        isError = cedulaError != null,
        errorMessage = cedulaError,
    )
    Spacer(modifier = Modifier.height(20.dp))
    PremiumTextField(
        "Contraseña",
        password,
        onPasswordChange,
        hint = "Mínimo 4 caracteres",
        prefixIcon = Icons.Outlined.Lock,
        keyboardOptions = keyboardPassword(),
        visualTransformation = PasswordVisualTransformation(),
        isError = passwordError != null,
        errorMessage = passwordError,
    )
    Spacer(modifier = Modifier.height(32.dp))
    PremiumPrimaryButton(
        label = "Iniciar sesión",
        onClick = onLogin,
        loading = loading,
        icon = Icons.AutoMirrored.Filled.Login,
    )
}

@Composable
private fun RegistrationStep1(
    nombre: String,
    onNombreChange: (String) -> Unit,
    cedula: String,
    onCedulaChange: (String) -> Unit,
    mpps: String,
    onMppsChange: (String) -> Unit,
    password: String,
    onPasswordChange: (String) -> Unit,
    nombreError: String?,
    cedulaError: String?,
    mppsError: String?,
    passwordError: String?,
    loading: Boolean,
    onNext: () -> Unit,
) {
    PremiumTextField(
        "Nombre a mostrar",
        nombre,
        onNombreChange,
        hint = "Ej. Dr. Juan Pérez",
        prefixIcon = Icons.Outlined.Badge,
        keyboardOptions = keyboardCapitalizationWords(),
        isError = nombreError != null,
        errorMessage = nombreError,
    )
    Spacer(modifier = Modifier.height(20.dp))
    PremiumTextField(
        "Cédula",
        cedula,
        onCedulaChange,
        hint = "Ej. V-12345678",
        prefixIcon = Icons.Outlined.CreditCard,
        isError = cedulaError != null,
        errorMessage = cedulaError,
    )
    Spacer(modifier = Modifier.height(20.dp))
    PremiumTextField(
        "MPPS",
        mpps,
        onMppsChange,
        hint = "Número de registro MPPS",
        prefixIcon = Icons.Outlined.Verified,
        keyboardOptions = keyboardDigits(),
        isError = mppsError != null,
        errorMessage = mppsError,
    )
    Spacer(modifier = Modifier.height(20.dp))
    PremiumTextField(
        "Contraseña",
        password,
        onPasswordChange,
        hint = "Mínimo 4 caracteres",
        prefixIcon = Icons.Outlined.Lock,
        keyboardOptions = keyboardPassword(),
        visualTransformation = PasswordVisualTransformation(),
        isError = passwordError != null,
        errorMessage = passwordError,
    )
    Spacer(modifier = Modifier.height(32.dp))
    PremiumPrimaryButton(
        label = if (loading) "Validando MPPS…" else "Siguiente",
        onClick = onNext,
        loading = loading,
        icon = Icons.AutoMirrored.Filled.ArrowForward,
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun RegistrationStep2(
    sexos: List<String>,
    sexo: String?,
    onSexoChange: (String) -> Unit,
    especialidades: List<String>,
    especialidad: String?,
    onEspecialidadChange: (String?) -> Unit,
    especialidadOtra: String,
    onEspecialidadOtraChange: (String) -> Unit,
    whatsapp: String,
    onWhatsappChange: (String) -> Unit,
    whatsappError: String?,
    loading: Boolean,
    onBack: () -> Unit,
    onFinish: () -> Unit,
) {
    var especialidadExpanded by remember { mutableStateOf(false) }

    Text("Sexo", style = MaterialTheme.typography.labelLarge.copy(color = TextSecondary))
    Spacer(modifier = Modifier.height(10.dp))
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        sexos.forEach { option ->
            FilterChip(
                selected = sexo == option,
                onClick = { onSexoChange(option) },
                label = { Text(option) },
                colors = FilterChipDefaults.filterChipColors(
                    selectedContainerColor = Teal.copy(alpha = 0.15f),
                    selectedLabelColor = Teal,
                ),
            )
        }
    }
    Spacer(modifier = Modifier.height(24.dp))
    Text("Especialidad", style = MaterialTheme.typography.labelLarge.copy(color = TextSecondary))
    Spacer(modifier = Modifier.height(8.dp))
    ExposedDropdownMenuBox(
        expanded = especialidadExpanded,
        onExpandedChange = { especialidadExpanded = !especialidadExpanded },
        modifier = Modifier.fillMaxWidth(),
    ) {
        OutlinedTextField(
            value = especialidad ?: "",
            onValueChange = {},
            readOnly = true,
            placeholder = { Text("Selecciona tu especialidad") },
            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = especialidadExpanded) },
            leadingIcon = { Icon(Icons.Outlined.MedicalServices, contentDescription = null, tint = Teal) },
            modifier = Modifier
                .menuAnchor(MenuAnchorType.PrimaryNotEditable)
                .fillMaxWidth(),
            colors = OutlinedTextFieldDefaults.colors(
                focusedBorderColor = Teal,
                cursorColor = Teal,
            ),
        )
        DropdownMenu(
            expanded = especialidadExpanded,
            onDismissRequest = { especialidadExpanded = false },
        ) {
            especialidades.forEach { option ->
                DropdownMenuItem(
                    text = { Text(option) },
                    onClick = {
                        onEspecialidadChange(option)
                        especialidadExpanded = false
                    },
                )
            }
        }
    }
    if (especialidad == "Otra") {
        Spacer(modifier = Modifier.height(12.dp))
        PremiumTextField(
            "Especifica tu especialidad",
            especialidadOtra,
            onEspecialidadOtraChange,
            hint = "Ej. Endocrinología",
            prefixIcon = Icons.Outlined.MedicalServices,
            keyboardOptions = keyboardCapitalizationWords(),
        )
    }
    Spacer(modifier = Modifier.height(20.dp))
    PremiumTextField(
        "Teléfono WhatsApp",
        whatsapp,
        onWhatsappChange,
        hint = "Ej. 04141234567",
        prefixIcon = Icons.Outlined.PhoneAndroid,
        keyboardOptions = keyboardPhone(),
        isError = whatsappError != null,
        errorMessage = whatsappError,
    )
    Spacer(modifier = Modifier.height(32.dp))
    BoxWithConstraints(modifier = Modifier.fillMaxWidth()) {
        val gap = 12.dp
        val backWidth = (maxWidth - gap) * 0.33f
        val enterWidth = maxWidth - backWidth - gap
        Row(modifier = Modifier.fillMaxWidth()) {
            OutlinedButton(
                onClick = onBack,
                modifier = Modifier.width(backWidth).height(54.dp),
                enabled = !loading,
            ) {
                Text("Atrás")
            }
            Spacer(modifier = Modifier.width(gap))
            PremiumPrimaryButton(
                label = "Entrar",
                onClick = onFinish,
                modifier = Modifier.width(enterWidth),
                loading = loading,
                fillMaxWidth = false,
            )
        }
    }
}

@Composable
private fun StepIndicator(currentStep: Int) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        StepDot(active = true, label = "1")
        Box(modifier = Modifier.weight(1f).height(2.dp).background(if (currentStep >= 1) Teal else DividerColor))
        StepDot(active = currentStep >= 1, label = "2")
    }
}

@Composable
private fun StepDot(active: Boolean, label: String) {
    Box(
        modifier = Modifier
            .size(32.dp)
            .background(if (active) Teal else DividerColor, CircleShape),
        contentAlignment = Alignment.Center,
    ) {
        Text(label, color = if (active) androidx.compose.ui.graphics.Color.White else TextSecondary)
    }
}
