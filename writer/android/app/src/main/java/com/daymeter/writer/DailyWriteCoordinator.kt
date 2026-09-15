package com.daymeter.writer

import android.content.Context
import java.time.ZonedDateTime

data class WriteResult(
    val status: Status,
    val message: String,
    val snapshot: ReportedSnapshot? = null,
    val at: ZonedDateTime = Ist.now(),
) {
    enum class Status { WROTE, SKIPPED, BLOCKED, FAILED }
}

class DailyWriteCoordinator(
    private val context: Context,
    private val store: ReportedStore = ReportedStore(context),
    private val collector: ReportedCollector = ReportedCollector(context),
) {
    fun runManual(): WriteResult {
        if (!UsageAccess.isGranted(context)) return blocked()
        return writeDate(Ist.today(), force = true)
    }

    fun runAuto(): WriteResult {
        if (!UsageAccess.isGranted(context)) return blocked()
        val today = Ist.today()
        val yesterday = writeDate(today.minusDays(1), force = false)
        if (yesterday.status == WriteResult.Status.WROTE) return yesterday
        return writeDate(today, force = true)
    }

    private fun writeDate(date: java.time.LocalDate, force: Boolean): WriteResult {
        return try {
            val window = DayWindow.of(date)
            val snapshot = collector.collect(window)
            if (!force && snapshot.hours <= 0 && snapshot.sessions.isEmpty()) {
                return WriteResult(WriteResult.Status.SKIPPED, "No usage yet for $date")
            }
            store.upsert(snapshot)
            val clocks = snapshot.sessions.size
            WriteResult(
                WriteResult.Status.WROTE,
                "Wrote ${"%.2f".format(snapshot.hours)}h · ${clocks} timed session${if (clocks == 1) "" else "s"} for $date",
                snapshot,
            )
        } catch (err: Throwable) {
            WriteResult(WriteResult.Status.FAILED, err.message ?: "write failed")
        }
    }

    private fun blocked() = WriteResult(
        WriteResult.Status.BLOCKED,
        "Usage access is off. Open system settings, then Run once.",
    )
}
