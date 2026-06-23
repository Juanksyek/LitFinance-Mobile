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
import kotlin.math.roundToInt

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
            val income = prefs.getFloat("monthlyIncome", 0f)
            val expenses = prefs.getFloat("monthlyExpenses", 0f)
            val incomeDisplay = prefs.getString("monthlyIncomeDisplay", "$0.00") ?: "$0.00"
            val expensesDisplay = prefs.getString("monthlyExpensesDisplay", "$0.00") ?: "$0.00"
            val currency = prefs.getString("currency", "MXN") ?: "MXN"
            val updatedAt = prefs.getString("monthlyUpdatedAt", null)
            val maxAmount = maxOf(income, expenses, 1f)
            val incomeProgress = ((income / maxAmount) * 100).roundToInt()
            val expensesProgress = ((expenses / maxAmount) * 100).roundToInt()

            val views = RemoteViews(context.packageName, R.layout.widget_balance)
            views.setTextViewText(R.id.txt_income, incomeDisplay)
            views.setTextViewText(R.id.txt_expenses, expensesDisplay)
            views.setTextViewText(R.id.txt_currency, currency)
            views.setProgressBar(R.id.progress_income, 100, incomeProgress, false)
            views.setProgressBar(R.id.progress_expenses, 100, expensesProgress, false)

            val timeStr = if (updatedAt != null) {
                "Actualizado: $updatedAt"
            } else {
                val sdf = SimpleDateFormat("HH:mm", Locale.getDefault())
                "Actualizado: ${sdf.format(Date())}"
            }
            views.setTextViewText(R.id.txt_updated, timeStr)

            val openIntent = Intent(context, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            }
            val openPi = PendingIntent.getActivity(context, 0, openIntent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
            views.setOnClickPendingIntent(R.id.widget_balance_root, openPi)

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
