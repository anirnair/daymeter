package com.daymeter.writer

import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter

object Ist {
    val ZONE: ZoneId = ZoneId.of("Asia/Kolkata")
    private val stampFmt: DateTimeFormatter = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ssxxx")

    fun now(): ZonedDateTime = ZonedDateTime.now(ZONE)
    fun today(): LocalDate = LocalDate.now(ZONE)
    fun formatStamp(time: ZonedDateTime = now()): String =
        time.withNano(0).format(stampFmt).replace("+05:30", "+0530")

    fun formatStamp(ms: Long): String =
        formatStamp(Instant.ofEpochMilli(ms).atZone(ZONE))
}

data class DayWindow(val date: LocalDate, val startMs: Long, val endMs: Long) {
    companion object {
        fun of(date: LocalDate, now: Instant = Instant.now()): DayWindow {
            val start = date.atStartOfDay(Ist.ZONE).toInstant()
            val endOfDay = date.plusDays(1).atStartOfDay(Ist.ZONE).toInstant()
            val end = if (now.isBefore(endOfDay)) now else endOfDay.minusMillis(1)
            val clipped = if (end.isBefore(start)) start else end
            return DayWindow(date, start.toEpochMilli(), clipped.toEpochMilli())
        }
    }
}
