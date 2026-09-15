package com.daymeter.writer

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters

class DailyWriteWorker(
    context: Context,
    params: WorkerParameters,
) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result {
        val coordinator = DailyWriteCoordinator(applicationContext)
        val result = coordinator.runAuto()
        LastRunState.save(applicationContext, result, "auto")
        if (result.status == WriteResult.Status.BLOCKED) return Result.retry()
        val store = ReportedStore(applicationContext)
        val ok = IngestUploader.upload(applicationContext, store, force = false)
        DailyWriteScheduler.ensure(applicationContext)
        IngestUploadScheduler.ensure(applicationContext)
        return if (ok || result.status == WriteResult.Status.SKIPPED) Result.success() else Result.retry()
    }
}
