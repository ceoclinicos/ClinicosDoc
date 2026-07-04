package com.ceoclinicos.clinicosdoc.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.LocalHospital
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.ceoclinicos.clinicosdoc.model.DocumentHeader
import com.ceoclinicos.clinicosdoc.ui.theme.DividerColor
import com.ceoclinicos.clinicosdoc.ui.theme.SurfaceBg
import com.ceoclinicos.clinicosdoc.ui.theme.Teal
import com.ceoclinicos.clinicosdoc.ui.theme.TextSecondary
import java.io.File

@Composable
fun HeaderPreview(
    header: DocumentHeader,
    modifier: Modifier = Modifier,
    compact: Boolean = false,
) {
    val logoSize = if (compact) 64.dp else 80.dp
    val bodySize = MaterialTheme.typography.bodyLarge.fontSize
    val mainSize = (bodySize.value + 2).sp
    val secondarySize = bodySize
    val descSize = MaterialTheme.typography.bodyMedium.fontSize
    val logoGap = 14.dp
    val hasLogo = header.logoPath != null && File(header.logoPath).exists()
    val frameModifier = modifier
        .fillMaxWidth()
        .border(1.dp, DividerColor, RoundedCornerShape(16.dp))
        .padding(if (compact) 14.dp else 18.dp)

    if (compact) {
        Row(modifier = frameModifier, verticalAlignment = Alignment.Top) {
            if (hasLogo) {
                LogoBox(path = header.logoPath, size = logoSize)
                Spacer(modifier = Modifier.width(logoGap))
            }
            HeaderTextBlock(
                header = header,
                mainSize = mainSize,
                secondarySize = secondarySize,
                descSize = descSize,
                modifier = Modifier
                    .weight(1f)
                    .padding(top = 6.dp),
            )
            if (hasLogo) {
                Spacer(modifier = Modifier.width(logoSize + logoGap))
            }
        }
    } else {
        Column(
            modifier = frameModifier,
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            if (hasLogo) {
                LogoBox(path = header.logoPath, size = logoSize)
                Spacer(modifier = Modifier.height(12.dp))
            }
            HeaderTextBlock(
                header = header,
                mainSize = mainSize,
                secondarySize = secondarySize,
                descSize = descSize,
                modifier = Modifier.fillMaxWidth(),
            )
        }
    }
}

@Composable
private fun HeaderTextBlock(
    header: DocumentHeader,
    mainSize: TextUnit,
    secondarySize: TextUnit,
    descSize: TextUnit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        if (header.doctorName.trim().isNotEmpty()) {
            Text(
                text = header.doctorName.trim(),
                modifier = Modifier.fillMaxWidth(),
                style = MaterialTheme.typography.bodyLarge.copy(
                    fontSize = mainSize,
                    fontWeight = FontWeight.Bold,
                ),
                textAlign = TextAlign.Center,
            )
        } else {
            Text(
                text = "Texto principal (requerido)",
                modifier = Modifier.fillMaxWidth(),
                style = MaterialTheme.typography.bodyLarge.copy(
                    fontSize = mainSize,
                    fontWeight = FontWeight.Bold,
                    color = TextSecondary,
                ),
                textAlign = TextAlign.Center,
            )
        }
        if (header.subtitle.trim().isNotEmpty()) {
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = header.subtitle.trim(),
                modifier = Modifier.fillMaxWidth(),
                style = MaterialTheme.typography.bodyLarge.copy(fontSize = secondarySize),
                color = Teal,
                textAlign = TextAlign.Center,
            )
        }
        if (header.description.trim().isNotEmpty()) {
            Spacer(modifier = Modifier.height(6.dp))
            Text(
                text = header.description.trim(),
                modifier = Modifier.fillMaxWidth(),
                style = MaterialTheme.typography.bodyMedium.copy(fontSize = descSize),
                color = TextSecondary,
                textAlign = TextAlign.Center,
            )
        }
    }
}

@Composable
private fun LogoBox(
    path: String?,
    size: androidx.compose.ui.unit.Dp,
    modifier: Modifier = Modifier,
) {
    val boxModifier = modifier
        .size(size)
        .clip(RoundedCornerShape(12.dp))
        .border(1.dp, DividerColor, RoundedCornerShape(12.dp))
    if (path != null && File(path).exists()) {
        AsyncImage(
            model = File(path),
            contentDescription = "Logo",
            modifier = boxModifier,
            contentScale = ContentScale.Crop,
        )
    } else {
        Box(
            modifier = boxModifier.background(SurfaceBg),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                Icons.Outlined.LocalHospital,
                contentDescription = null,
                tint = Teal.copy(alpha = 0.5f),
                modifier = Modifier.size(size * 0.45f),
            )
        }
    }
}
