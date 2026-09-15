package com.daymeter.writer

data class PhoneSession(
    val ts: String,
    val end: String,
    val app: String,
    val seconds: Double,
    val className: String? = null,
)

data class ReportedSnapshot(
    val timestampIst: String,
    val dateIst: String,
    val hours: Double,
    val top: List<String>,
    val switches: Int?,
    val sessions: List<PhoneSession> = emptyList(),
) {
    fun toLine(): String {
        val hoursText = String.format(java.util.Locale.US, "%.2f", hours)
        val core = "$timestampIst\treported\thours=$hoursText\ttop=${top.joinToString(",")}"
        return if (switches != null) "$core\tswitches=$switches" else core
    }
}
