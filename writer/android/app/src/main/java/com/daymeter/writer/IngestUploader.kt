package com.daymeter.writer

import android.content.Context
import java.security.MessageDigest

object IngestUploader {
    fun fingerprint(body: String): String {
        val digest = MessageDigest.getInstance("SHA-256").digest(body.toByteArray(Charsets.UTF_8))
        return digest.joinToString("") { "%02x".format(it) }
    }

    fun upload(context: Context, store: ReportedStore, force: Boolean): Boolean {
        val body = store.ingestBody()
        if (body.isBlank()) return false
        val fp = fingerprint(body)
        if (!force && IngestState.alreadyUploaded(context, fp)) return true
        return when (IngestClient.upload(body, "application/json; charset=utf-8")) {
            IngestOutcome.UPLOADED -> {
                IngestState.markUploaded(context, fp, "sessions")
                true
            }
            IngestOutcome.FAILED_RETRY -> {
                IngestState.markFailed(context, true)
                false
            }
            IngestOutcome.FAILED_FATAL -> {
                IngestState.markFailed(context, false)
                false
            }
        }
    }
}
