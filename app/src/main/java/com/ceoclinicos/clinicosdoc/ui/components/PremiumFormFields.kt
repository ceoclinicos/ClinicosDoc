package com.ceoclinicos.clinicosdoc.ui.components

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import com.ceoclinicos.clinicosdoc.ui.theme.DividerColor
import com.ceoclinicos.clinicosdoc.ui.theme.Navy
import com.ceoclinicos.clinicosdoc.ui.theme.Teal
import com.ceoclinicos.clinicosdoc.ui.theme.TextSecondary

@Composable
fun PremiumTextField(
    label: String,
    value: String,
    onValueChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    hint: String? = null,
    prefixIcon: ImageVector? = null,
    keyboardOptions: KeyboardOptions = KeyboardOptions.Default,
    visualTransformation: VisualTransformation = VisualTransformation.None,
    singleLine: Boolean = true,
    maxLines: Int = if (singleLine) 1 else Int.MAX_VALUE,
    isError: Boolean = false,
    errorMessage: String? = null,
    readOnly: Boolean = false,
    placeholderColor: Color = TextSecondary.copy(alpha = 0.38f),
) {
    Column(modifier = modifier) {
        Text(
            text = label,
            style = MaterialTheme.typography.labelLarge.copy(color = TextSecondary, fontSize = MaterialTheme.typography.labelLarge.fontSize),
        )
        Spacer(modifier = Modifier.height(8.dp))
        OutlinedTextField(
            value = value,
            onValueChange = onValueChange,
            modifier = Modifier.fillMaxWidth(),
            placeholder = hint?.let { { Text(it, color = placeholderColor) } },
            leadingIcon = prefixIcon?.let { { Icon(it, contentDescription = null, tint = Teal) } },
            keyboardOptions = keyboardOptions,
            visualTransformation = visualTransformation,
            readOnly = readOnly,
            singleLine = singleLine,
            maxLines = maxLines,
            isError = isError,
            shape = RoundedCornerShape(14.dp),
            colors = OutlinedTextFieldDefaults.colors(
                focusedBorderColor = Teal,
                unfocusedBorderColor = DividerColor,
            ),
        )
        if (errorMessage != null) {
            Text(
                text = errorMessage,
                color = MaterialTheme.colorScheme.error,
                style = MaterialTheme.typography.bodySmall,
                modifier = Modifier.padding(top = 4.dp),
            )
        }
    }
}

@Composable
fun PremiumPrimaryButton(
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    loading: Boolean = false,
    enabled: Boolean = true,
    icon: ImageVector? = null,
    fillMaxWidth: Boolean = true,
) {
    Button(
        onClick = onClick,
        modifier = modifier
            .then(if (fillMaxWidth) Modifier.fillMaxWidth() else Modifier)
            .height(54.dp),
        enabled = enabled && !loading,
        shape = RoundedCornerShape(14.dp),
        colors = ButtonDefaults.buttonColors(
            containerColor = Navy,
            disabledContainerColor = Navy.copy(alpha = 0.5f),
        ),
    ) {
        if (loading) {
            CircularProgressIndicator(
                modifier = Modifier.size(22.dp),
                strokeWidth = 2.dp,
                color = androidx.compose.ui.graphics.Color.White,
            )
        } else {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(label, style = MaterialTheme.typography.labelLarge.copy(color = androidx.compose.ui.graphics.Color.White))
                if (icon != null) {
                    Spacer(modifier = Modifier.width(8.dp))
                    Icon(icon, contentDescription = null, modifier = Modifier.size(20.dp))
                }
            }
        }
    }
}

fun keyboardCapitalizationWords() = KeyboardOptions(capitalization = KeyboardCapitalization.Words)
fun keyboardDigits() = KeyboardOptions(keyboardType = KeyboardType.Number)
fun keyboardPassword() = KeyboardOptions(keyboardType = KeyboardType.Password)
fun keyboardPhone() = KeyboardOptions(keyboardType = KeyboardType.Phone)
