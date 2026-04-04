package com.litfinance.app.widgets

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews
import com.litfinance.app.R
import com.litfinance.app.MainActivity
import java.text.SimpleDateFormat
import java.util.*

class BalanceWidgetProvider : AppWidgetProvider() {

    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        for (widgetId in appWidgetIds) {
            updateWidget(context, appWidgetManager, widgetId)
        }
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        if (intent.action == ACTION_REFRESH) {
            val mgr = AppWidgetManager.getInstance(context)
            val ids = mgr.getAppWidgetIds(ComponentName(context, BalanceWidgetProvider::class.java))
            onUpdate(context, mgr, ids)
        }
    }

    companion object {
        const val ACTION_REFRESH = "com.litfinance.app.WIDGET_BALANCE_REFRESH"
        private const val PREFS_NAME = "LitFinanceWidgetData"

        fun updateWidget(context: Context, appWidgetManager: AppWidgetManager, widgetId: Int) {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val balance = prefs.getString("balance", "$0.00") ?: "$0.00"
            val currency = prefs.getString("currency", "MXN") ?: "MXN"
            val updatedAt = prefs.getString("balanceUpdatedAt", null)

            val views = RemoteViews(context.packageName, R.layout.widget_balance)
            views.setTextViewText(R.id.txt_balance, balance)
            views.setTextViewText(R.id.txt_currency, currency)

            val timeStr = if (updatedAt != null) {
                "Actualizado: $updatedAt"
            } else {
                val sdf = SimpleDateFormat("HH:mm", Locale.getDefault())
                "Actualizado: ${sdf.format(Date())}"
            }
            views.setTextViewText(R.id.txt_updated, timeStr)

            // Tap on widget opens the app
            val openIntent = Intent(context, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            }
            val openPi = PendingIntent.getActivity(context, 0, openIntent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
            views.setOnClickPendingIntent(R.id.widget_balance_root, openPi)

            // Refresh button
            val refreshIntent = Intent(context, BalanceWidgetProvider::class.java).apply {
                action = ACTION_REFRESH
            }
            val refreshPi = PendingIntent.getBroadcast(context, 1, refreshIntent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
            views.setOnClickPendingIntent(R.id.btn_refresh, refreshPi)

            appWidgetManager.updateAppWidget(widgetId, views)
        }

        fun updateAll(context: Context) {
            val mgr = AppWidgetManager.getInstance(context)
            val ids = mgr.getAppWidgetIds(ComponentName(context, BalanceWidgetProvider::class.java))
            for (id in ids) {
                updateWidget(context, mgr, id)
            }
        }
    }
}
