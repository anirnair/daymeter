package com.daymeter.writer

import android.os.Bundle
import android.widget.Button
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import kotlin.concurrent.thread

class MainActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        DailyWriteScheduler.ensure(this)
        IngestUploadScheduler.ensure(this)

        findViewById<Button>(R.id.btn_open_usage).setOnClickListener {
            startActivity(UsageAccess.settingsIntent())
        }
        findViewById<Button>(R.id.btn_write_now).setOnClickListener { writeNow() }
        findViewById<Button>(R.id.btn_backfill).setOnClickListener { backfillYesterday() }
        refresh()
    }

    override fun onResume() {
        super.onResume()
        refresh()
    }

    private fun refresh() {
        val store = ReportedStore(this)
        val snapshot = snapshotFromJson(store)
        val hours = snapshot?.hours ?: 0.0
        val sessions = snapshot?.sessions?.size ?: 0
        val ingest = IngestState.read(this)
        val last = LastRunState.read(this)
        findViewById<TextView>(R.id.status).text = buildString {
            append(if (UsageAccess.isGranted(this@MainActivity)) "Usage access: granted\n" else "Usage access: missing — tap Open usage settings\n")
            append("Today (${Ist.today()}): ${"%.2f".format(hours)}h · $sessions timed sessions\n")
            append("Last write: ${last.status ?: "none"} ${last.message ?: ""}\n")
            append("Last ingest: ${ingest.status} ${ingest.atIst ?: ""}\n")
            append("Posts every ~15 min to daymeter.vercel.app with UsageEvents 1/2/23/24/25.\n")
            append("Also posts the same JSON to Origin dashboard9 as backup.")
        }
        findViewById<Button>(R.id.btn_write_now).isEnabled = UsageAccess.isGranted(this)
        findViewById<Button>(R.id.btn_backfill).isEnabled = UsageAccess.isGranted(this)
    }

    private fun writeNow() {
        findViewById<TextView>(R.id.status).text = "Collecting UsageEvents…"
        thread {
            val coordinator = DailyWriteCoordinator(this)
            val result = coordinator.runManual()
            LastRunState.save(this, result, "manual")
            val ok = result.snapshot != null && IngestUploader.upload(this, ReportedStore(this), force = true)
            runOnUiThread {
                findViewById<TextView>(R.id.status).text =
                    if (ok) result.message + " · uploaded"
                    else result.message
                refresh()
            }
        }
    }

    private fun backfillYesterday() {
        findViewById<TextView>(R.id.status).text = "Backfilling yesterday…"
        thread {
            val coordinator = DailyWriteCoordinator(this)
            val result = coordinator.runAuto()
            LastRunState.save(this, result, "backfill")
            val ok = IngestUploader.upload(this, ReportedStore(this), force = true)
            runOnUiThread {
                findViewById<TextView>(R.id.status).text =
                    if (ok) result.message + " · uploaded" else result.message
                refresh()
            }
        }
    }

    private fun snapshotFromJson(store: ReportedStore): ReportedSnapshot? {
        val text = store.ingestBody()
        if (text.isBlank() || !text.trimStart().startsWith("{")) return null
        return try {
            val json = org.json.JSONObject(text)
            val sessions = json.optJSONArray("sessions")
            val list = mutableListOf<PhoneSession>()
            if (sessions != null) {
                for (i in 0 until sessions.length()) {
                    val row = sessions.optJSONObject(i) ?: continue
                    list += PhoneSession(
                        ts = row.optString("ts"),
                        end = row.optString("end"),
                        app = row.optString("app"),
                        seconds = row.optDouble("seconds"),
                        className = row.optString("className").ifBlank { null },
                    )
                }
            }
            val top = mutableListOf<String>()
            val tops = json.optJSONArray("top")
            if (tops != null) {
                for (i in 0 until tops.length()) top += tops.optString(i)
            }
            ReportedSnapshot(
                timestampIst = Ist.formatStamp(),
                dateIst = json.optString("day"),
                hours = json.optDouble("hours"),
                top = top,
                switches = if (json.has("switches")) json.optInt("switches") else null,
                sessions = list,
            )
        } catch (_: Exception) {
            null
        }
    }
}
