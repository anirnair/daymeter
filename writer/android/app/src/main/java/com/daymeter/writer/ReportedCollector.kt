package com.daymeter.writer

import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context

class ReportedCollector(private val usageStatsManager: UsageStatsManager) {
    constructor(context: Context) : this(context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager)

    fun collect(window: DayWindow, timestampIst: String = Ist.formatStamp()): ReportedSnapshot {
        val fromEvents = collectSessions(window)
        val stats = collectFromUsageStats(window)
        val sessions = fromEvents
        val timeByPackage = LinkedHashMap<String, Long>()
        if (sessions.isNotEmpty()) {
            for (session in sessions) {
                val ms = (session.seconds * 1000).toLong()
                timeByPackage[session.app] = (timeByPackage[session.app] ?: 0L) + ms
            }
        } else {
            timeByPackage.putAll(stats)
        }
        val hours = timeByPackage.values.sum().coerceAtLeast(0L) / 3_600_000.0
        val switches = if (sessions.size > 1) sessions.size - 1 else if (sessions.isNotEmpty()) 0 else null
        return ReportedSnapshot(
            timestampIst = timestampIst,
            dateIst = window.date.toString(),
            hours = hours,
            top = topPackages(timeByPackage),
            switches = switches,
            sessions = sessions.take(1_500),
        )
    }

    private fun collectSessions(window: DayWindow): List<PhoneSession> {
        return try {
            val events = usageStatsManager.queryEvents(window.startMs, window.endMs) ?: return emptyList()
            val event = UsageEvents.Event()
            val ticks = mutableListOf<UsageTick>()
            while (events.hasNextEvent()) {
                events.getNextEvent(event)
                val kind = Sessionizer.kind(event.eventType) ?: continue
                val pkg = event.packageName ?: continue
                val at = event.timeStamp
                if (at < window.startMs || at > window.endMs) continue
                if (IGNORED.contains(pkg)) continue
                ticks += UsageTick(
                    ms = at,
                    app = if (kind == UsageTick.Kind.OFF) pkg else pkg,
                    kind = kind,
                    className = event.className,
                )
            }
            Sessionizer.sessions(ticks, closeOpenAtMs = window.endMs)
        } catch (_: SecurityException) {
            emptyList()
        }
    }

    private fun collectFromUsageStats(window: DayWindow): Map<String, Long> {
        val stats = try {
            usageStatsManager.queryUsageStats(UsageStatsManager.INTERVAL_BEST, window.startMs, window.endMs)
        } catch (_: SecurityException) {
            emptyList()
        } ?: emptyList()
        val merged = LinkedHashMap<String, Long>()
        for (item in stats) {
            val pkg = item.packageName ?: continue
            if (IGNORED.contains(pkg)) continue
            val time = item.totalTimeInForeground
            if (time > 0) merged[pkg] = (merged[pkg] ?: 0L) + time
        }
        return merged
    }

    private fun topPackages(timeByPackage: Map<String, Long>, limit: Int = 8): List<String> =
        timeByPackage.entries
            .filter { it.value > 0 && it.key !in IGNORED }
            .sortedByDescending { it.value }
            .take(limit)
            .map { it.key.replace(Regex("[\\t\\n\\r,]"), "") }

    companion object {
        private val IGNORED = setOf("android", "com.android.systemui")
    }
}
