package com.daymeter.writer

data class UsageTick(
    val ms: Long,
    val app: String,
    val kind: Kind,
    val className: String? = null,
) {
    enum class Kind { FG, BG, OFF }
}

object Sessionizer {
    const val MOVE_TO_FOREGROUND = 1
    const val MOVE_TO_BACKGROUND = 2
    const val SCREEN_NON_INTERACTIVE = 16
    const val KEYGUARD_SHOWN = 17
    const val ACTIVITY_RESUMED = 23
    const val ACTIVITY_PAUSED = 24
    const val ACTIVITY_STOPPED = 25
    const val ACTIVITY_DESTROYED = 26
    const val DEVICE_SHUTDOWN = 28

    fun kind(type: Int): UsageTick.Kind? = when (type) {
        MOVE_TO_FOREGROUND, ACTIVITY_RESUMED -> UsageTick.Kind.FG
        MOVE_TO_BACKGROUND, ACTIVITY_PAUSED, ACTIVITY_STOPPED, ACTIVITY_DESTROYED -> UsageTick.Kind.BG
        SCREEN_NON_INTERACTIVE, KEYGUARD_SHOWN, DEVICE_SHUTDOWN -> UsageTick.Kind.OFF
        else -> null
    }

    fun sessions(ticks: List<UsageTick>, closeOpenAtMs: Long? = null): List<PhoneSession> {
        val ordered = ticks.sortedWith(compareBy(UsageTick::ms, { it.kind.name }))
        var current: UsageTick? = null
        val out = mutableListOf<PhoneSession>()

        fun close(endMs: Long) {
            val start = current ?: return
            current = null
            val seconds = (endMs - start.ms) / 1000.0
            if (seconds <= 0) return
            out += PhoneSession(
                ts = Ist.formatStamp(start.ms),
                end = Ist.formatStamp(endMs),
                app = start.app,
                seconds = seconds,
                className = start.className,
            )
        }

        for (ev in ordered) {
            when (ev.kind) {
                UsageTick.Kind.OFF -> close(ev.ms)
                UsageTick.Kind.FG -> {
                    val cur = current
                    if (cur != null && cur.app != ev.app) close(ev.ms)
                    else if (cur != null && cur.app == ev.app) continue
                    current = ev
                }
                UsageTick.Kind.BG -> {
                    val cur = current
                    if (cur != null && (cur.app == ev.app || ev.app.isBlank())) close(ev.ms)
                }
            }
        }
        if (closeOpenAtMs != null) {
            val cur = current
            if (cur != null && closeOpenAtMs > cur.ms) close(closeOpenAtMs)
        }
        return out
    }
}
