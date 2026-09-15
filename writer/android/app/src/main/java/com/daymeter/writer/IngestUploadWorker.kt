package com.daymeter.writer

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters

class IngestUploadWorker(
    context: Context,
    params: WorkerParameters,
) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result {
        val coordinator = DailyWriteCoordinator(applicationContext)
        val result = coordinator.runAuto()
        LastRunState.save(applicationContext, result, "ingest")
        val store = ReportedStore(applicationContext)
        val ok = IngestUploader.upload(applicationContext, store, force = true)
        return if (ok) Result.success() else Result.retry()
    }
}
