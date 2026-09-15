package com.daymeter.writer

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

class ReportedStore(private val root: File) {
    constructor(context: Context) : this(daymeterDir(context))

    val tsvFile: File get() = File(root, "phone-reported.tsv")
    val jsonFile: File get() = File(root, "phone.json")

    fun lastLine(): String? = readLines().lastOrNull()

    fun lineForDate(dateIst: String): String? =
        readLines().asReversed().firstOrNull { dateKey(it) == dateIst }

    fun upsert(snapshot: ReportedSnapshot) {
        root.mkdirs()
        val line = snapshot.toLine()
        val kept = readLines().filter { dateKey(it) != snapshot.dateIst }
        tsvFile.writeText((kept + line).joinToString("\n", postfix = "\n"))
        jsonFile.writeText(toIngestJson(snapshot).toString())
    }

    fun ingestBody(): String = if (jsonFile.exists()) jsonFile.readText() else lastLine().orEmpty()

    private fun readLines(): List<String> {
        if (!tsvFile.exists()) return emptyList()
        return tsvFile.readLines().map { it.trimEnd() }.filter { it.isNotBlank() }
    }

    companion object {
        fun daymeterDir(context: Context): File {
            val parent = context.getExternalFilesDir(null) ?: context.filesDir
            return File(parent, "daymeter")
        }

        fun dateKey(line: String): String? = line.substringBefore('\t').take(10).takeIf { it.length == 10 }

        fun toIngestJson(snapshot: ReportedSnapshot): JSONObject {
            val json = JSONObject()
            json.put("device", "phone")
            json.put("day", snapshot.dateIst)
            json.put("hours", snapshot.hours)
            json.put("top", JSONArray(snapshot.top))
            if (snapshot.switches != null) json.put("switches", snapshot.switches)
            val sessions = JSONArray()
            for (session in snapshot.sessions) {
                val row = JSONObject()
                row.put("ts", session.ts)
                row.put("end", session.end)
                row.put("app", session.app)
                row.put("seconds", session.seconds)
                row.put("device", "phone")
                if (!session.className.isNullOrBlank()) row.put("className", session.className)
                sessions.put(row)
            }
            json.put("sessions", sessions)
            json.put("source", "writer")
            json.put("collector", "daymeter-writer")
            return json
        }
    }
}
