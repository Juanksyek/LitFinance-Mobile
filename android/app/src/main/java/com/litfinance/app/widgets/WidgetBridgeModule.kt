package com.litfinance.app.widgets

import android.content.Context
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.Promise
import org.json.JSONArray
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.*

class WidgetBridgeModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "WidgetBridge"

    companion object {
        private const val PREFS_NAME = "LitFinanceWidgetData"
    }

    @ReactMethod
    fun updateBalance(balance: String, currency: String, promise: Promise) {
        try {
            val prefs = reactApplicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val sdf = SimpleDateFormat("HH:mm", Locale.getDefault())
            prefs.edit()
                .putString("balance", balance)
                .putString("currency", currency)
                .putString("balanceUpdatedAt", sdf.format(Date()))
                .apply()

            BalanceWidgetProvider.updateAll(reactApplicationContext)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("WIDGET_ERROR", e.message)
        }
    }

    @ReactMethod
    fun updateTransactions(transactions: ReadableArray, promise: Promise) {
        try {
            val jsonArray = JSONArray()
            for (i in 0 until transactions.size()) {
                val map = transactions.getMap(i)
                val obj = JSONObject()
                obj.put("icon", map?.getString("icon") ?: "\uD83D\uDCB0")
                obj.put("concept", map?.getString("concept") ?: "")
                obj.put("date", map?.getString("date") ?: "")
                obj.put("amount", map?.getString("amount") ?: "$0.00")
                obj.put("isIncome", map?.getBoolean("isIncome") ?: false)
                jsonArray.put(obj)
            }

            val prefs = reactApplicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            prefs.edit()
                .putString("recentTransactions", jsonArray.toString())
                .apply()

            RecentTransactionsWidgetProvider.updateAll(reactApplicationContext)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("WIDGET_ERROR", e.message)
        }
    }
}
