package com.ceoclinicos.clinicosdoc.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import com.ceoclinicos.clinicosdoc.ui.theme.Navy
import com.ceoclinicos.clinicosdoc.ui.theme.Teal
import com.ceoclinicos.clinicosdoc.ui.theme.TextSecondary

data class BottomNavItem(
    val label: String,
    val icon: ImageVector,
    val activeIcon: ImageVector,
)

@Composable
fun PremiumBottomBar(
    currentIndex: Int,
    onTap: (Int) -> Unit,
    items: List<BottomNavItem>,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .background(androidx.compose.ui.graphics.Color.White)
            .padding(horizontal = 12.dp, vertical = 8.dp),
        horizontalArrangement = Arrangement.SpaceEvenly,
    ) {
        items.forEachIndexed { index, item ->
            val selected = index == currentIndex
            Column(
                modifier = Modifier
                    .weight(1f)
                    .clickable { onTap(index) }
                    .background(
                        color = if (selected) Teal.copy(alpha = 0.1f) else androidx.compose.ui.graphics.Color.Transparent,
                        shape = RoundedCornerShape(16.dp),
                    )
                    .padding(vertical = 10.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Icon(
                    imageVector = if (selected) item.activeIcon else item.icon,
                    contentDescription = item.label,
                    tint = if (selected) Teal else TextSecondary,
                )
                Text(
                    text = item.label,
                    style = androidx.compose.material3.MaterialTheme.typography.labelLarge.copy(
                        fontSize = androidx.compose.ui.unit.TextUnit.Unspecified,
                    ),
                    color = if (selected) Teal else TextSecondary,
                )
            }
        }
    }
}
