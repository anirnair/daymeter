package com.daymeter.writer

import android.app.Application

class DaymeterWriterApp : Application() {
    override fun onCreate() {
        super.onCreate()
        DailyWriteScheduler.ensure(this)
        IngestUploadScheduler.ensure(this)
    }
}
