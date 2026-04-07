package com.litfinance.app.widgets

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.view.View
import android.widget.RemoteViews
import com.litfinance.app.R
import com.litfinance.app.MainActivity
import org.json.JSONArray
import org.json.JSONException

class RecentTransactionsWidgetProvider : AppWidgetProvider() {

    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        for (widgetId in appWidgetIds) {
            updateWidget(context, appWidgetManager, widgetId)
        }
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        if (intent.action == ACTION_REFRESH) {
            val mgr = AppWidgetManager.getInstance(context)
            val ids = mgr.getAppWidgetIds(ComponentName(context, RecentTransactionsWidgetProvider::class.java))
            onUpdate(context, mgr, ids)
        }
    }

    companion object {
        const val ACTION_REFRESH = "com.litfinance.app.WIDGET_TRANSACTIONS_REFRESH"
        private const val PREFS_NAME = "LitFinanceWidgetData"

        private data class RowIds(val row: Int, val icon: Int, val concept: Int, val date: Int, val amount: Int)

        fun updateWidget(context: Context, appWidgetManager: AppWidgetManager, widgetId: Int) {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val txnJson = prefs.getString("recentTransactions", "[]") ?: "[]"

            val views = RemoteViews(context.packageName, R.layout.widget_recent_transactions)

            val rows = listOf(
                RowIds(R.id.txn_row_1, R.id.txn_icon_1, R.id.txn_concept_1, R.id.txn_date_1, R.id.txn_amount_1),
                RowIds(R.id.txn_row_2, R.id.txn_icon_2, R.id.txn_concept_2, R.id.txn_date_2, R.id.txn_amount_2),
                RowIds(R.id.txn_row_3, R.id.txn_icon_3, R.id.txn_concept_3, R.id.txn_date_3, R.id.txn_amount_3)
            )

            try {
                val txns = JSONArray(txnJson)
                val count = txns.length().coerceAtMost(3)

                if (count == 0) {
                    views.setViewVisibility(R.id.txn_empty, View.VISIBLE)
                    for (r in rows) views.setViewVisibility(r.row, View.GONE)
                } else {
                    views.setViewVisibility(R.id.txn_empty, View.GONE)
                    for (i in rows.indices) {
                        if (i < count) {
                            val obj = txns.getJSONObject(i)
                            views.setViewVisibility(rows[i].row, View.VISIBLE)
                            views.setTextViewText(rows[i].icon, obj.optString("icon", "\uD83D\uDCB0"))
                            views.setTextViewText(rows[i].concept, obj.optString("concept", ""))
                            views.setTextViewText(rows[i].date, obj.optString("date", ""))
                            val amount = obj.optString("amount", "$0.00")
                            views.setTextViewText(rows[i].amount, amount)
                            // Color: green for income, red-ish for expense
                            val isIncome = obj.optBoolean("isIncome", false)
                            val color = if (isIncome) 0xFF4CAF50.toInt() else 0xFFFF5252.toInt()
                            views.setTextColor(rows[i].amount, color)
                        } else {
                            views.setViewVisibility(rows[i].row, View.GONE)
                        }
                    }
                }
            } catch (e: JSONException) {
                views.setViewVisibility(R.id.txn_empty, View.VISIBLE)
                for (r in rows) views.setViewVisibility(r.row, View.GONE)
            }

            // Tap opens app
            val openIntent = Intent(context, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            }
            val openPi = PendingIntent.getActivity(context, 20, openIntent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
            views.setOnClickPendingIntent(R.id.widget_transactions_root, openPi)

            // Refresh
            val refreshIntent = Intent(context, RecentTransactionsWidgetProvider::class.java).apply {
                action = ACTION_REFRESH
            }
            val refreshPi = PendingIntent.getBroadcast(context, 21, refreshIntent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
            views.setOnClickPendingIntent(R.id.btn_refresh_txns, refreshPi)

            appWidgetManager.updateAppWidget(widgetId, views)
        }

        fun updateAll(context: Context) {
            val mgr = AppWidgetManager.getInstance(context)
            val ids = mgr.getAppWidgetIds(ComponentName(context, RecentTransactionsWidgetProvider::class.java))
            for (id in ids) {
                updateWidget(context, mgr, id)
            }
        }
    }
}
