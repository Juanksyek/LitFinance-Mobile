package com.litfinance.app.widgets

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.RemoteViews
import com.litfinance.app.R
import com.litfinance.app.MainActivity

class QuickActionsWidgetProvider : AppWidgetProvider() {

    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        for (widgetId in appWidgetIds) {
            updateWidget(context, appWidgetManager, widgetId)
        }
    }

    companion object {
        private fun makeDeepLinkIntent(context: Context, path: String, requestCode: Int): PendingIntent {
            val intent = Intent(context, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                data = Uri.parse("litfinance://widget/$path")
            }
            return PendingIntent.getActivity(context, requestCode, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        }

        fun updateWidget(context: Context, appWidgetManager: AppWidgetManager, widgetId: Int) {
            val views = RemoteViews(context.packageName, R.layout.widget_quick_actions)

            views.setOnClickPendingIntent(R.id.btn_scan, makeDeepLinkIntent(context, "scan", 10))
            views.setOnClickPendingIntent(R.id.btn_add_mov, makeDeepLinkIntent(context, "movement", 11))
            views.setOnClickPendingIntent(R.id.btn_analytics, makeDeepLinkIntent(context, "analytics", 12))
            views.setOnClickPendingIntent(R.id.btn_settings, makeDeepLinkIntent(context, "settings", 13))

            appWidgetManager.updateAppWidget(widgetId, views)
        }
    }
}
