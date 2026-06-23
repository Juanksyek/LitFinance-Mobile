package com.litfinance.app.widgets

import android.content.Context
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise
import java.text.SimpleDateFormat
import java.util.*

class WidgetBridgeModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "WidgetBridge"

    companion object {
        private const val PREFS_NAME = "LitFinanceWidgetData"
    }

    @ReactMethod
    fun updateMonthlySummary(
        income: Double,
        expenses: Double,
        incomeDisplay: String,
        expensesDisplay: String,
        currency: String,
        promise: Promise
    ) {
        try {
            val prefs = reactApplicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val sdf = SimpleDateFormat("HH:mm", Locale.getDefault())
            prefs.edit()
                .putFloat("monthlyIncome", income.coerceAtLeast(0.0).toFloat())
                .putFloat("monthlyExpenses", expenses.coerceAtLeast(0.0).toFloat())
                .putString("monthlyIncomeDisplay", incomeDisplay)
                .putString("monthlyExpensesDisplay", expensesDisplay)
                .putString("currency", currency)
                .putString("monthlyUpdatedAt", sdf.format(Date()))
                .apply()

            BalanceWidgetProvider.updateAll(reactApplicationContext)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("WIDGET_ERROR", e.message)
        }
    }
}
