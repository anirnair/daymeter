package com.daymeter.writer

import android.content.Context

object IngestState {
    private const val PREFS = "daymeter_writer_ingest"
    private const val KEY_FINGERPRINT = "fingerprint"
    private const val KEY_STATUS = "status"
    private const val KEY_DETAIL = "detail"
    private const val KEY_AT = "at"

    data class Snapshot(val status: String, val detail: String?, val atIst: String?)

    fun alreadyUploaded(context: Context, fingerprint: String): Boolean =
        prefs(context).getString(KEY_FINGERPRINT, "") == fingerprint

    fun markUploaded(context: Context, fingerprint: String, detail: String) {
        prefs(context).edit()
            .putString(KEY_FINGERPRINT, fingerprint)
            .putString(KEY_STATUS, "uploaded")
            .putString(KEY_DETAIL, detail)
            .putString(KEY_AT, Ist.formatStamp())
            .apply()
    }

    fun markPending(context: Context) {
        prefs(context).edit().putString(KEY_STATUS, "pending").putString(KEY_AT, Ist.formatStamp()).apply()
    }

    fun markFailed(context: Context, retryable: Boolean) {
        prefs(context).edit()
            .putString(KEY_STATUS, "failed")
            .putString(KEY_DETAIL, if (retryable) "retry" else "fatal")
            .putString(KEY_AT, Ist.formatStamp())
            .apply()
    }

    fun read(context: Context): Snapshot {
        val p = prefs(context)
        return Snapshot(
            status = p.getString(KEY_STATUS, "idle") ?: "idle",
            detail = p.getString(KEY_DETAIL, null),
            atIst = p.getString(KEY_AT, null),
        )
    }

    private fun prefs(context: Context) = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
}

object LastRunState {
    private const val PREFS = "daymeter_writer_state"

    data class Snapshot(
        val atIst: String?,
        val status: String?,
        val message: String?,
        val triggeredBy: String?,
        val line: String?,
    )

    fun save(context: Context, result: WriteResult, triggeredBy: String) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
            .putString("last_run_at", Ist.formatStamp(result.at))
            .putString("last_run_status", result.status.name)
            .putString("last_run_message", result.message)
            .putString("last_run_by", triggeredBy)
            .putString("last_run_line", result.snapshot?.toLine())
            .apply()
    }

    fun read(context: Context): Snapshot {
        val p = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        return Snapshot(
            atIst = p.getString("last_run_at", null),
            status = p.getString("last_run_status", null),
            message = p.getString("last_run_message", null),
            triggeredBy = p.getString("last_run_by", null),
            line = p.getString("last_run_line", null),
        )
    }
}
