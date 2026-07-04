package com.ceoclinicos.clinicosdoc.ui.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.MenuAnchorType
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.ceoclinicos.clinicosdoc.ui.theme.DividerColor
import com.ceoclinicos.clinicosdoc.ui.theme.Teal
import com.ceoclinicos.clinicosdoc.ui.theme.TextSecondary
import com.ceoclinicos.clinicosdoc.util.PatientUtils
import java.time.Instant
import java.time.LocalDate
import java.time.YearMonth
import java.time.ZoneId

private val MONTH_NAMES = listOf(
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
)

/**
 * Selector de fecha de nacimiento: tres desplegables (Día, Mes, Año).
 * Solo permite fechas desde hoy hacia atrás, hasta [maxYearsBack] años.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BirthDateSelector(
    selected: Instant?,
    onDateChange: (Instant) -> Unit,
    modifier: Modifier = Modifier,
    maxYearsBack: Int = 120,
) {
    val zone = remember { ZoneId.systemDefault() }
    val today = remember { LocalDate.now(zone) }
    val minYear = today.year - maxYearsBack

    val initial = remember(selected, today) {
        selected?.let { PatientUtils.toLocalDate(it, zone) }
            ?: LocalDate.of(today.year - 30, today.monthValue.coerceAtMost(12), 1)
    }

    var year by remember(initial) { mutableIntStateOf(initial.year.coerceIn(minYear, today.year)) }
    var month by remember(initial) { mutableIntStateOf(initial.monthValue) }
    var day by remember(initial) { mutableIntStateOf(initial.dayOfMonth) }

    fun maxMonthForYear(y: Int): Int = if (y == today.year) today.monthValue else 12

    fun maxDayForYearMonth(y: Int, m: Int): Int {
        val lastDay = YearMonth.of(y, m).lengthOfMonth()
        return if (y == today.year && m == today.monthValue) {
            today.dayOfMonth.coerceAtMost(lastDay)
        } else {
            lastDay
        }
    }

    fun applyDate(y: Int, m: Int, d: Int) {
        val clampedYear = y.coerceIn(minYear, today.year)
        val clampedMonth = m.coerceIn(1, maxMonthForYear(clampedYear))
        val clampedDay = d.coerceIn(1, maxDayForYearMonth(clampedYear, clampedMonth))
        year = clampedYear
        month = clampedMonth
        day = clampedDay
        val date = LocalDate.of(clampedYear, clampedMonth, clampedDay)
        onDateChange(date.atStartOfDay(zone).toInstant())
    }

    LaunchedEffect(Unit) {
        if (selected == null) {
            applyDate(year, month, day)
        }
    }

    val years = remember(today, minYear) { (today.year downTo minYear).map { it.toString() } }
    val months = remember(year, today) {
        (1..maxMonthForYear(year)).map { MONTH_NAMES[it - 1] }
    }
    val days = remember(year, month, today) {
        (1..maxDayForYearMonth(year, month)).map { it.toString() }
    }

    Column(modifier = modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            DateDropdownField(
                label = "Día",
                value = day.toString(),
                options = days,
                onSelect = { applyDate(year, month, it.toInt()) },
                modifier = Modifier.weight(1f),
            )
            DateDropdownField(
                label = "Mes",
                value = MONTH_NAMES[month - 1],
                options = months,
                onSelect = { name ->
                    val idx = MONTH_NAMES.indexOf(name) + 1
                    if (idx > 0) applyDate(year, idx, day)
                },
                modifier = Modifier.weight(1.4f),
            )
            DateDropdownField(
                label = "Año",
                value = year.toString(),
                options = years,
                onSelect = { applyDate(it.toInt(), month, day) },
                modifier = Modifier.weight(1.2f),
            )
        }
        Text(
            text = "Toca cada campo para desplegar · hasta ${minYear}",
            style = MaterialTheme.typography.bodySmall,
            color = TextSecondary,
            modifier = Modifier.padding(top = 8.dp),
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun DateDropdownField(
    label: String,
    value: String,
    options: List<String>,
    onSelect: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    var expanded by remember { mutableStateOf(false) }

    Column(modifier = modifier) {
        Text(
            text = label,
            style = MaterialTheme.typography.labelLarge.copy(fontWeight = FontWeight.SemiBold),
            color = TextSecondary,
            modifier = Modifier.padding(bottom = 6.dp),
        )
        ExposedDropdownMenuBox(
            expanded = expanded,
            onExpandedChange = { expanded = it },
            modifier = Modifier.fillMaxWidth(),
        ) {
            OutlinedTextField(
                value = value,
                onValueChange = {},
                readOnly = true,
                singleLine = true,
                trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded) },
                modifier = Modifier
                    .menuAnchor(MenuAnchorType.PrimaryNotEditable)
                    .fillMaxWidth(),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = Teal,
                    unfocusedBorderColor = DividerColor,
                    focusedTrailingIconColor = Teal,
                ),
            )
            DropdownMenu(
                expanded = expanded,
                onDismissRequest = { expanded = false },
            ) {
                options.forEach { option ->
                    DropdownMenuItem(
                        text = { Text(option) },
                        onClick = {
                            onSelect(option)
                            expanded = false
                        },
                    )
                }
            }
        }
    }
}
