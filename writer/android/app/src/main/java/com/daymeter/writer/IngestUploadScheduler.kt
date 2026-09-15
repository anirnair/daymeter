package com.daymeter.writer

import android.content.Context
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import java.util.concurrent.TimeUnit

object IngestUploadScheduler {
    private const val UNIQUE = "daymeter-ingest-upload"

    fun ensure(context: Context) {
        val request = PeriodicWorkRequestBuilder<IngestUploadWorker>(15, TimeUnit.MINUTES).build()
        WorkManager.getInstance(context).enqueueUniquePeriodicWork(
            UNIQUE,
            ExistingPeriodicWorkPolicy.UPDATE,
            request,
        )
    }
}
